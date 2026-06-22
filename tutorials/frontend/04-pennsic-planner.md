# Building the Pennsic Planner

Build the [Pennsic Planner](https://pennsic-planner.widgets.beshir.org) — a day-grid event planner that stores shareable plans in Cloudflare D1 and generates `.ics` exports entirely in the browser. This tutorial assumes you have worked through [01 (function-plotter)](./01-function-plotter.md), [02 (image-comparison-table)](./02-image-comparison-table.md), and [03 (japanese-verb-tower)](./03-japanese-verb-tower.md); it builds on their `useState`/`useMemo`/`useEffect` foundations, lifting state up, URL-driven view routing, and the Cloudflare Workers + Static Assets model. Visual and CSS decisions are covered in the companion [design tutorial](../design/04-pennsic-planner.md). The headline new ground is five topics not covered before: an **external observable store** (the `PlanStore` pub-sub seam), **remote persistence with optimistic concurrency** (`If-Match` PUT, debounce coalescing, 409 conflict reload), **hash-based capability URL routing** (the edit secret lives in the URL fragment, never transmitted to the server), **JS-computed layout geometry** (minute-of-day arithmetic and greedy interval-partitioning), and **client-side ICS file generation and download**.

## What you'll build

The live widget is at **https://pennsic-planner.widgets.beshir.org**. Open it and you can browse the Pennsic 53 (2026) class schedule as a side-by-side day timetable, pick sessions to attend, save your plan under a shareable link, and export it to a `.ics` file your calendar app can import. Your plan persists across page reloads and reopens on any device from a single bookmark.

The widget's metadata:

```json
<!-- widgets/pennsic-planner/widget.json:3-5 -->
"slug": "pennsic-planner",
"title": "Pennsic Planner",
"description": "Browse the Pennsic 53 (2026) class schedule as a side-by-side day timetable, build a shareable personal calendar with time-conflict detection (stored online and reached by a link), and export your plan to calendar (.ics).",
```

The `widget.json` metadata contract — `slug`, `hostname`, `embeddable` — is unchanged from tutorial 01; see [01 §What you'll build](./01-function-plotter.md) for the full explanation. The visual treatment — colour scheme, timetable grid layout, conflict badges — is covered in the companion [design tutorial](../design/04-pennsic-planner.md). This tutorial covers the JavaScript architecture.

### The headline shift: remote-first state

The previous three tutorials kept mutable state in the browser. Tutorial 01 computed everything from user input; tutorial 02 had no server state at all; tutorial 03 introduced a Cloudflare Worker backend but only to serve read-only conjugation results. Nothing needed to survive a page reload or be shared across browsers.

This widget is different. A plan must survive reloads, be reachable via a bookmarkable link, and sync edits without silently discarding changes — requirements that rule out `localStorage` and demand a cloud store. Plans live in **Cloudflare D1** (serverless SQLite bound to the Worker); the frontend reaches them through a single persistence seam, `planStore`:

```ts
// widgets/pennsic-planner/src/store.ts:1-17
// PlanStore — the single persistence seam for the planner.
//
// A "plan" is no longer device-local: it is a named calendar of selected session ids that belongs to
// one event and lives in Cloudflare D1, reached by a capability URL. This store is remote-first. It
// owns the in-memory snapshot of the *active* calendar and talks to the Worker over fetch():
//
//   open(id, secret)   GET  /api/calendar/:id     — load an existing calendar (edit or read-only)
//   create(name, ids)  POST /api/calendar         — make a new calendar, return its id + edit secret
//   togglePlan(id)     PUT  /api/calendar/:id      — debounced, optimistic-concurrency edit
//
// Edits update the snapshot immediately and are flushed to D1 on a short debounce with If-Match on
// the current revision. A 409 (someone else edited the same calendar) is surfaced — never silently
// dropped — by reloading the server's copy and telling the UI the last change may not have saved.
//
// The bundled event schedules are the only datasets (see data/events.ts); there is no user-provided
// dataset, so this store carries none. localStorage is used ONLY by lib/deviceCalendars.ts for a
// non-authoritative "calendars on this device" shortcut list — never for a plan.
```

`planStore` — a singleton `RemotePlanStore` hidden behind a `PlanStore` interface — is the headline concept of this tutorial. Section 04 covers it in full.

### Five new areas

This tutorial introduces five topics not seen in earlier entries: an **external observable store** (the `PlanStore` interface and its pub-sub bridge into Preact), **remote persistence with optimistic concurrency** (`If-Match` on every PUT, debounce coalescing, 409 conflict reload), **hash-based capability URL routing** (the edit secret lives in the URL fragment, never transmitted to the server), **JS-computed layout geometry** (minute-of-day arithmetic and greedy lane partitioning for the time-grid), and **client-side ICS file generation and download** (`Blob` → `createObjectURL` → synthetic click, with RFC 5545 line folding).

The state machine that ties them together is encoded in one line:

```ts
// widgets/pennsic-planner/src/App.tsx:30
type AppMode = Mode | 'loading' | 'notfound' | 'missing-event' | 'error';
```

`Mode` covers the active calendar states (`landing | edit | readonly`); `AppMode` extends it with the transient `loading` state and the terminal error states. Every section in this tutorial maps to one or more transitions on this type.

With the widget's scope and architectural shift clear, the next section maps the full stack — Preact, Vite, Cloudflare Workers, and the D1 layer that makes shareable plans possible.

## The stack and why

The Pennsic Planner uses the same three-layer foundation as the Japanese Verb Tower ([03](./03-japanese-verb-tower.md)): **Preact** renders the UI, **Vite** bundles and type-checks the frontend, and a **Cloudflare Worker** serves the compiled SPA and handles API requests. If you worked through that tutorial, the shape of `wrangler.jsonc` will look familiar — `main` pointing at the Worker entry, `assets` pointing at `./dist/`, `run_worker_first` routing `/api/*` through the Worker while static assets bypass it:

```jsonc
// widgets/pennsic-planner/wrangler.jsonc:6-13
"main": "worker/index.ts",
"assets": {
  "directory": "./dist/",
  "binding": "ASSETS",
  "not_found_handling": "single-page-application",
  // /api/* runs the Worker first; everything else is served straight from static assets.
  "run_worker_first": ["/api/*"]
},
```

The tutorial does not re-teach this model — see [03](./03-japanese-verb-tower.md) for the full explanation of `run_worker_first`, `not_found_handling`, and why that configuration gives you a single-origin SPA+API from one Worker deployment. Preact's component model and `@preact/preset-vite` are covered in [01](./01-function-plotter.md).

What this tutorial adds is the fourth layer: **Cloudflare D1**, a serverless SQLite database that makes user-created calendars persistent and shareable.

### Cloudflare D1: serverless SQLite on the edge

D1 is Cloudflare's managed SQLite product. The database is declared in `wrangler.jsonc` and injected into the Worker as a property on `env`:

```jsonc
// widgets/pennsic-planner/wrangler.jsonc:14-20
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "widget-pennsic-planner",
    "database_id": "acb68fb0-cd85-44d9-961a-581592590ce4"
  }
],
```

The `binding` key is the name of the property Cloudflare wires onto `env` at runtime. No connection string, no driver initialization — declare the binding, and the Worker receives a live `D1Database` handle:

```ts
// widgets/pennsic-planner/worker/index.ts:17-21
interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  CREATE_LIMITER: RateLimit;
}
```

`D1Database` exposes a prepared-statement API (`env.DB.prepare(sql).bind(...).run()` / `.first<T>()`) that the Worker uses for every calendar read and write. You do not need to know SQL to follow this tutorial, but you do need a mental model of the one table the planner uses.

### What D1 stores — and what it doesn't

D1 holds one table, `calendars`. Each row has this shape:

```ts
// widgets/pennsic-planner/worker/index.ts:33-42
interface CalendarRow {
  id: string;
  event_id: string;
  name: string;
  session_ids: string;
  edit_secret_hash: string;
  rev: number;
  created_at: string;
  updated_at: string;
}
```

`id` is a random URL-safe token (the calendar's public identity). `session_ids` is a JSON-serialized array of session ID strings — the user's chosen sessions stored as a single text column. `rev` is a monotonically increasing revision counter used for optimistic concurrency (covered in the [Effects and integration](#effects-and-integration) section). `edit_secret_hash` is a SHA-256 digest — never the plaintext secret.

**What is not in D1: the schedule.** The full list of sessions — titles, times, locations, tracks, the entire Pennsic programme — is bundled into the SPA at build time, not stored in the database. The comment at the top of `events.ts` states the design intent directly:

```ts
// widgets/pennsic-planner/src/data/events.ts:1-7
// Events manifest — the SPA's map of event id → bundled schedule and metadata.
//
// Events are first-class: a calendar belongs to exactly one event, and the app resolves a calendar's
// schedule by looking its event_id up here. Schedules are bundled in the build (never in D1), so the
// widget renders fully offline. Adding a future Pennsic is a build-only change: import its schedule,
// add an entry below, and move `isDefault` (and DEFAULT_EVENT_ID) to it. Existing calendars and their
// capability URLs keep working because the event id is stable and never encoded in the URL.
```

The `EVENTS` registry (lines 25 onward) maps a stable string like `"pennsic-53"` to its full `EventDef`, which includes the imported `sessions-2026.json` array. A D1 row stores only the `event_id` string. When the app loads a calendar, it reads the row from D1 and then looks up the schedule locally with `getEvent(cal.eventId)`.

This split has two concrete payoffs:

- **The frontend renders fully offline.** Once the SPA bundle is cached, displaying the schedule requires no network. Only creating or saving a *plan* touches D1.
- **Adding a future year is a build-only change.** Import the new schedule, add an entry to `EVENTS`, update `DEFAULT_EVENT_ID`. Existing capability URLs keep working because `event_id` is a stable string that never appears in the URL.

### The edit secret

The plaintext edit secret lives in exactly two places: the capability URL fragment (in the user's browser) and `active.secret` in the store's in-memory state. D1 stores only the SHA-256 hash. On every `PUT` request, the Worker hashes the presented secret and compares it against `edit_secret_hash` in constant time. See `worker/index.ts` for the verification logic; the [Hash routing and capability URLs](#hash-routing-and-capability-urls) section explains the URL structure, and [Effects and integration](#effects-and-integration) covers the write protocol end-to-end.

### Rate limiting

The `CREATE_LIMITER` binding in `Env` is a Workers rate-limit binding — the same primitive introduced in [03](./03-japanese-verb-tower.md). It caps calendar creation at 10 per minute per IP. The declaration is at `wrangler.jsonc:21-23`; no new concepts are required here.

### The full picture

| Layer | Technology | Role |
|---|---|---|
| Frontend | Preact + Vite | Component tree, bundle, dev server |
| Edge runtime | Cloudflare Worker | Serves SPA, handles `/api/calendar` routes |
| Persistence | Cloudflare D1 | Stores plan metadata (name, session IDs, rev, secret hash) |
| Schedule | Bundled JSON | Sessions bundled at build time; never in D1 |

With the storage layer in place, the next section covers how the app mounts and establishes its initial display mode before any async load.

## Initialisation & the ready signal

For the mechanics of `render()` and the ES-module entry point, see [01](./01-function-plotter.md). This section focuses on what happens in the moments between the module loading and the async store resolving: how `App` establishes its initial display mode synchronously from the URL hash, and what the `#widget-ready` sentinel actually signals to the outside world.

### Mounting

`main.tsx` follows the same shape as every other widget in the series:

```tsx
// widgets/pennsic-planner/src/main.tsx:1-13
import { render } from 'preact';
import { App } from './App';
import './styles.css';

// Embedded in an iframe the frame is already the container, so shed the
// standalone page chrome (outer background, centering, card shadow/border)
// and let the card fill the frame. Append ?embed=0 to force the framed look.
if (window.self !== window.top && new URLSearchParams(location.search).get('embed') !== '0') {
  document.documentElement.classList.add('embedded');
}

const root = document.getElementById('root');
if (root) render(<App />, root);
```

The iframe detection (`window.self !== window.top`) and the `embedded` CSS class are unchanged from [01](./01-function-plotter.md) — reference rather than re-teach. What matters here is the line `render(<App />, root)`: by the time `App`'s constructor runs, `location.hash` is already set to whatever the browser parsed from the URL bar. That timing is the foundation of everything that follows.

### Reading the hash synchronously at construction

`App` declares its mode state with a lazy initialiser:

```tsx
// widgets/pennsic-planner/src/App.tsx:47
const [mode, setMode] = useState<AppMode>(initialMode);
```

The lazy `useState` initialiser — passing a function rather than a value — is covered in [02](./02-image-comparison-table.md). What matters here is *which* function is passed. `initialMode` runs once, at component construction, before any render:

```tsx
// widgets/pennsic-planner/src/App.tsx:40-43
function initialMode(): AppMode {
  if (typeof location === 'undefined') return 'landing';
  return parseHash(location.hash).mode === 'landing' ? 'landing' : 'loading';
}
```

`initialMode` reads `location.hash` synchronously and consults `parseHash` — the same route parser used everywhere else in the app. The logic is a binary fork: if the hash resolves to the landing route (no plan ID present), start in `'landing'`; if the hash identifies a plan, start in `'loading'` immediately, because an async fetch will be needed before the UI can be meaningful.

This eliminates a class of flash bugs. Without it, `App` would have to pick an arbitrary default — almost certainly `'landing'` — and then asynchronously correct it once a `hashchange` event or an effect fired. For a user arriving at a direct edit link (`#/c/<id>/<secret>`), that would mean momentarily displaying the landing screen before jumping to the editor, a visible jolt. Reading the hash at construction time costs nothing and prevents the problem entirely.

### Why reading the hash at startup is not redundant with the `hashchange` listener

`hashchange` fires on `window` whenever `location.hash` changes **without a page reload**. That "without a page reload" clause is the key: `hashchange` does **not** fire on the initial page load. The browser simply loads the page with the hash already in place; there is no transition to announce.

The consequence is that the `hashchange` listener registered later in an effect cannot serve double duty as the initial routing step. Two mechanisms are needed for two distinct moments:

| Moment | Mechanism |
|---|---|
| Initial load — hash already in `location.hash` | `initialMode()` reads it synchronously at construction |
| Subsequent navigation — user clicks Back, or code sets `location.hash` | `hashchange` listener calls the route resolver |

If you replaced `initialMode` with a read inside a `useEffect`, the read would happen *after* paint — too late to prevent the flash. If you relied solely on `hashchange`, the initial hash would be ignored entirely for pages that load with one present.

### `ready` and the `#widget-ready` marker

Alongside `mode`, `App` tracks a second piece of state:

```tsx
// widgets/pennsic-planner/src/App.tsx:46
const [ready, setReady] = useState(false);
```

`ready` starts `false`. It is set to `true` only after the async route resolver — `applyRouteRef.current` — finishes its work and calls `setReady(true)` in every branch, whether the plan loaded successfully, was not found, or produced an error. Until that point, `App` renders its content but keeps one element out of the DOM:

```tsx
// widgets/pennsic-planner/src/App.tsx:316
{ready && <div id="widget-ready" style={{ display: 'none' }} aria-hidden="true" />}
```

The `#widget-ready` convention is established in [01](./01-function-plotter.md). The important detail here is what the sentinel signals: not "the component mounted" (that happens immediately, before any async work) but "the app has finished its first async resolution and is displaying a meaningful state." The test harness waits for `#widget-ready` before asserting anything about the UI. An app that added the marker on mount would pass those assertions against a `'loading'` spinner — a false positive. Deferring it until the resolver completes is what makes the signal trustworthy.

In practice, for the landing route the resolver is near-instant — no fetch required, just a call to `setMode('landing')` and `setReady(true)`. For a plan URL the resolver calls `planStore.open(id, secret)`, awaits the network round-trip, then sets both `mode` and `ready`. Either way, the marker appears at the same logical moment: when the user is looking at something real.

With the mount sequence understood, the next section goes inside the store seam — the pub-sub layer that bridges the external `planStore` singleton into Preact state.

## State and data flow: the store seam

Every component in tutorials [01](./01-function-plotter.md) through [03](./03-japanese-verb-tower.md) was self-contained enough that state lived either inside a single component or, at most, lifted to the nearest common ancestor. The Pennsic Planner breaks that assumption: a plan must survive unmounts, initiate network I/O on its own schedule, and be independently testable. That calls for a different architectural seam — an external observable store that components subscribe to rather than own.

### Why not lift state up?

Lifting state up ([02](./02-image-comparison-table.md)) is the right tool when two or three sibling components share a value and they all have a natural common ancestor that renders them together. The store's requirements rule it out here on three counts:

1. **It must outlive the component tree.** A plan being fetched should not be cancelled because a transient render cycle unmounted `App`. The data belongs to the app's lifetime, not to a component's.
2. **It does network I/O on its own schedule.** The debounced write timer (`WRITE_DEBOUNCE_MS = 700`) runs independently of re-renders. A `useState` value in `App` would tie that timer to React's lifecycle — the wrong owner.
3. **It must be independently testable.** A store instantiated outside any component tree can be exercised in plain Node without a renderer. Lifting state into `App` buries the logic behind JSX.

### Why not a pure engine?

Tutorial [03](./03-japanese-verb-tower.md) introduced the pattern of placing domain logic in framework-free modules outside components. The conjugation engine is a stateless function: `buildTower(verb, ops) → slabs`. Give it the same inputs, get the same output; no memory, no side effects.

`planStore` cannot be a pure engine. It maintains an in-memory snapshot of the active calendar, fires network requests, tracks a write timer, and accumulates listeners. It is stateful, long-lived, and observable — exactly the properties the "pure engine" metaphor excludes. The engine pattern is still the right mental model for the layout and ICS modules (covered in the following sections), but the store sits at the boundary where the app's state and the network's state must be kept in sync over time.

### `PlanStore` as a swappable interface

The store is not exported as its concrete implementation. The module ends with:

```ts
// widgets/pennsic-planner/src/store.ts:307-308
// Singleton — the app imports this one instance.
export const planStore: PlanStore = new RemotePlanStore();
```

The type annotation is `PlanStore`, not `RemotePlanStore`. That one-word difference is the entire seam. The `PlanStore` interface declares every operation the rest of the app is allowed to know about:

```ts
// widgets/pennsic-planner/src/store.ts:41-51
export interface PlanStore {
  getActive(): ActiveCalendar | null;
  getPlan(): string[];
  open(id: string, secret: string | null): Promise<OpenResult>;
  create(name: string, sessionIds: string[]): Promise<{ id: string; secret: string; eventId: string } | null>;
  togglePlan(id: string): void;
  setName(name: string): void;
  clear(): void;
  flush(): Promise<void>;
  subscribe(listener: (change: PlanChange) => void): () => void;
}
```

Any class that satisfies this interface — a `LocalPlanStore` backed by `localStorage`, an in-memory stub for tests — can be swapped in without touching a single component. The rest of the app never calls `new RemotePlanStore()` directly.

### Private state inside `RemotePlanStore`

The concrete class keeps five private fields:

```ts
// widgets/pennsic-planner/src/store.ts:57-63
class RemotePlanStore implements PlanStore {
  private active: ActiveCalendar | null = null;
  private listeners = new Set<(change: PlanChange) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private writing = false;
```

`active` is the in-memory snapshot of the plan. `listeners` is the subscriber set. `timer`, `dirty`, and `writing` belong to the debounced-write protocol covered in [Effects and integration](#effects-and-integration). The key insight is that `listeners` is a `Set`, not an array: listeners are deduplicated automatically, and deletions during iteration are safe.

### The pub-sub seam: `subscribe` and `emit`

`subscribe` adds a listener and returns the function that removes it:

```ts
// widgets/pennsic-planner/src/store.ts:169-172
subscribe(listener: (change: PlanChange) => void): () => void {
  this.listeners.add(listener);
  return () => this.listeners.delete(listener);
}
```

The return value *is* the unsubscribe function. No separate `unsubscribe(token)` call, no listener ID to track — the returned closure is self-contained.

When something changes, `emit` walks every listener inside a `try/catch`:

```ts
// widgets/pennsic-planner/src/store.ts:283-291
private emit(change: PlanChange): void {
  for (const l of this.listeners) {
    try {
      l(change);
    } catch {
      /* a listener throwing must not break the others */
    }
  }
}
```

The try/catch is the isolation guarantee: if one listener throws (a bug in a component's update handler, say), the remaining listeners still receive the change. Without it, a single misbehaving subscriber could silently break the whole app.

### `PlanChange`: the discriminated union

`emit` always passes a `PlanChange`, defined as:

```ts
// widgets/pennsic-planner/src/store.ts:33-35
export type PlanChange =
  | { type: 'active'; calendar: ActiveCalendar | null }
  | { type: 'sync'; status: SyncStatus; message?: string };
```

This is a TypeScript discriminated union: the `type` field is the discriminant, and TypeScript narrows the type fully in each `if`/`switch` branch. The store never tells its listeners *how* a change happened (network response, optimistic update, conflict reload) — only *what* changed. Listeners receive just enough to update the UI.

### Bridging into `useState`: the `useEffect` subscription

`App` has no access to `RemotePlanStore`'s private state. It knows only what flows out through `PlanChange`. To make the component reactive, it bridges the store's push-based changes into Preact's pull-based render cycle using a `useEffect` subscription (`useEffect []` and cleanup are covered in [01](./01-function-plotter.md)):

```ts
// widgets/pennsic-planner/src/App.tsx:46-49
const [ready, setReady] = useState(false);
const [mode, setMode] = useState<AppMode>(initialMode);
const [active, setActive] = useState<ActiveCalendar | null>(null);
const [sync, setSync] = useState<{ status: SyncStatus; message?: string }>({ status: 'idle' });
```

These four `useState` values are `App`'s local mirror of the store's observable state. They are set only by the subscription listener:

```ts
// widgets/pennsic-planner/src/App.tsx:120-130
const unsub = planStore.subscribe((change: PlanChange) => {
  if (change.type === 'active') {
    setActive(change.calendar);
  } else if (change.type === 'sync') {
    setSync({ status: change.status, message: change.message });
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (change.status === 'saved') {
      savedTimer.current = setTimeout(() => setSync({ status: 'idle' }), 2000);
    }
  }
});
```

The `type` discriminant routes each change to the right setter. An `'active'` change replaces the whole calendar snapshot; a `'sync'` change carries a status (`'saving' | 'saved' | 'error' | 'conflict'`) and optional message for the sync badge. The `savedTimer` clears the "Saved" badge two seconds after a successful write — a `useRef`-held timer that belongs to the effect's lifecycle rather than to the store.

The returned `unsub` is captured in `const unsub` and called in the effect's cleanup, so subscriptions never leak across unmounts.

### A note on `useSyncExternalStore`

React 18 introduced `useSyncExternalStore(subscribe, getSnapshot)` as the officially blessed API for exactly this pattern. In React's concurrent renderer, reading store state in the middle of a render pass can produce *tearing* — different components seeing different snapshots of the same store. `useSyncExternalStore` prevents that by forcing all reads to be synchronous and consistent.

Preact has no concurrent renderer. Its rendering is always synchronous: when a state setter fires, the entire tree re-renders before the browser paints. Tearing cannot occur. `useSyncExternalStore` is available via `preact/compat`, but it is implemented as a synchronous stub that immediately returns the snapshot value — it provides no additional tearing protection beyond what `useState` already guarantees in a synchronous renderer.

The manual `subscribe + setState` bridge used here is the equivalent and simpler approach for Preact. If you are porting this pattern to React 18 with a concurrent renderer, replace the subscription in `useEffect` with a `useSyncExternalStore` call — both the `subscribe` method (which already returns an unsubscribe function in the right shape) and `getActive()` slot directly into the API.

The store seam is now fully in place. The next section shows how `planStore.open()` is called from the hash route resolver, completing the picture of how URL, store, and `AppMode` interact.

## Hash routing and capability URLs

URL-driven view selection was introduced in [02](./02-image-comparison-table.md) and bidirectional URL state was covered in [03](./03-japanese-verb-tower.md). This section builds on both: the Pennsic Planner does not merely reflect the URL — it uses the URL fragment as a *security boundary*.

### Why the secret lives in the fragment

The design rationale is stated at the top of `route.ts`:

```ts
// widgets/pennsic-planner/src/lib/route.ts:1-7
// Hash-based routing for the capability URLs.
//
// The secret lives in the URL *fragment* so it never reaches the server (or its logs) and page
// routing stays a static SPA. Two shapes:
//   #/c/<id>/<secret>  → edit mode (full editing)
//   #/c/<id>           → read-only view (duplicate-to-edit offered)
//   anything else      → landing (no calendar)
```

The fragment — everything from `#` onward — is a client-side construct. RFC 3986 §3.5 specifies it is "not provided to the URI scheme processor," so HTTP never receives it; the WHATWG URL Standard specifies that browsers strip it before forming requests; and RFC 9110 excludes it from the `Referer` header. A secret in `#/c/<id>/<secret>` therefore never appears in server access logs, never crosses the wire, and is never leaked via navigation.

This is a **capability URL** in the W3C TAG sense: the URL itself is the credential — no accounts, no login flow. Two shapes give two access levels:

- `#/c/<id>/<secret>` — the private edit link. Bookmark it; do not share it.
- `#/c/<id>` — the public read-only link. Safe to forward to anyone.

The edit secret is stored in D1 as a SHA-256 hash; the server verifies the plaintext on writes. The plaintext only ever lives in the fragment and in `active.secret` in memory.

### Parsing and building routes

The three URL states map to a discriminated union:

```ts
// widgets/pennsic-planner/src/lib/route.ts:9-12
export type Route =
  | { mode: 'landing' }
  | { mode: 'edit'; id: string; secret: string }
  | { mode: 'readonly'; id: string };
```

`parseHash` translates a raw fragment string into a `Route`. It is intentionally tolerant — a malformed shared link must not crash the SPA on boot:

```ts
// widgets/pennsic-planner/src/lib/route.ts:14-24
export function parseHash(hash: string): Route {
  // Accept "#/c/..", "#c/..", and a leading "#/" tolerant of an extra slash.
  const raw = hash.replace(/^#/, '').replace(/^\//, '');
  const parts = raw.split('/').filter((p) => p.length > 0);
  if (parts[0] === 'c' && parts[1]) {
    const id = safeDecode(parts[1]);
    if (parts[2]) return { mode: 'edit', id, secret: safeDecode(parts[2]) };
    return { mode: 'readonly', id };
  }
  return { mode: 'landing' };
}
```

`safeDecode` wraps `decodeURIComponent` in a try/catch so a percent-encoded typo falls back to the raw string rather than throwing. Anything not matching `/c/` is `landing` — a safe default with no network request.

Building routes is the mirror. `capabilityUrls` produces absolute URLs by prepending `origin + pathname + search` and strips any existing fragment:

```ts
// widgets/pennsic-planner/src/lib/route.ts:35-50
export function editHash(id: string, secret: string): string {
  return `#/c/${encodeURIComponent(id)}/${encodeURIComponent(secret)}`;
}

export function shareHash(id: string): string {
  return `#/c/${encodeURIComponent(id)}`;
}

/** Absolute capability URLs for sharing/bookmarking, built from the current page (sans fragment). */
export function capabilityUrls(id: string, secret: string | null): { edit: string | null; share: string } {
  const base = typeof location !== 'undefined' ? location.origin + location.pathname + location.search : '';
  return {
    edit: secret ? base + editHash(id, secret) : null,
    share: base + shareHash(id),
  };
}
```

`CalendarBar` calls this once per render to derive both links from the in-memory `active`:

```tsx
// widgets/pennsic-planner/src/components/CalendarBar.tsx:58
const urls = capabilityUrls(active.id, active.secret);
```

On first creation (`justCreated === true`) the banner displays both links inline with the explicit warning to bookmark the edit link. On every subsequent visit the same links are available behind the Share popover (lines 88–103).

### The AppMode state machine

`Route` describes the URL. `AppMode` describes the application — it extends `Mode` (the stable display states that have a full UI) with transient and terminal states:

```ts
// widgets/pennsic-planner/src/App.tsx:30
type AppMode = Mode | 'loading' | 'notfound' | 'missing-event' | 'error';
```

`Mode` covers `landing | edit | readonly`. The additions:

- `loading` — a D1 fetch is in progress; transient.
- `notfound` — the calendar ID does not exist in D1.
- `missing-event` — the calendar's `eventId` is not bundled in the current build.
- `error` — a generic server or network failure.

The three terminal states display a message with no tabs or calendar bar. One discriminant keeps rendering to a single `switch` and prevents incoherent combinations like `mode === 'readonly' && isLoading === true`.

### The async route resolver

The function that drives these transitions is assigned to `applyRouteRef.current`:

```ts
// widgets/pennsic-planner/src/App.tsx:77-104
applyRouteRef.current = async (route: Route) => {
  if (route.mode === 'landing') {
    planStore.clear();
    setMode('landing');
    setJustCreated(false);
    refreshDevices();
    setReady(true);
    return;
  }

  const existing = planStore.getActive();
  if (existing && existing.id === route.id) {
    // Already in memory (just created / duplicated, or a same-id hash tweak). Don't refetch.
    finalizeCalendarMode(route, existing);
    return;
  }

  setMode('loading');
  const res = await planStore.open(route.id, route.mode === 'edit' ? route.secret : null);
  if (!res.ok) {
    setMode(res.reason === 'notfound' ? 'notfound' : 'error');
    setReady(true);
    return;
  }
  setJustCreated(false);
  refreshDevices();
  finalizeCalendarMode(route, res.calendar);
};
```

The transitions are strict and in order: set `loading` synchronously before the `await`, handle error branches next, then delegate to `finalizeCalendarMode`. The in-memory check skips a redundant D1 fetch when the calendar was just created — the store already has it and the hash change is merely confirming the secret in the URL.

`finalizeCalendarMode` performs one final check before committing to `edit` or `readonly`:

```ts
// widgets/pennsic-planner/src/App.tsx:106-115
function finalizeCalendarMode(route: Route, cal: ActiveCalendar) {
  if (!getEvent(cal.eventId)) {
    setMode('missing-event');
    setReady(true);
    return;
  }
  const editable = route.mode === 'edit' && !!cal.secret;
  setMode(editable ? 'edit' : 'readonly');
  setReady(true);
}
```

`getEvent` confirms the referenced event schedule is bundled in the build. If it is not — for example, a calendar created against a previous year's schedule — the app enters `missing-event` rather than rendering a blank timetable. The editability check requires both a parsed secret in the route *and* a secret in the loaded calendar, which defends against cases where the server rejected the secret and returned a read-only snapshot.

### The applyRouteRef pattern

The resolver is not a named function — it is assigned to `applyRouteRef.current` in the component body:

```ts
// widgets/pennsic-planner/src/App.tsx:76-77
const applyRouteRef = useRef<(route: Route) => Promise<void>>(async () => {});
applyRouteRef.current = async (route: Route) => { ... };
```

This is the **latest-closure ref** pattern. The resolver references `setMode`, `setReady`, and other state setters. If it were defined inside `useEffect(..., [])`, those references would be frozen to mount-time values — a stale closure that silently ignores any state changed after the first render. Assigning to `ref.current` in the component body runs on every render, so the closure always captures current state setters. The `hashchange` listener — registered once with `[]` deps — calls `applyRouteRef.current(...)` and therefore always invokes the up-to-date version.

The full effect block that registers the `hashchange` listener, calls the resolver on mount, and wires the `pagehide` flush is covered in [Effects and integration](#effects-and-integration), where the complete stale-closure solution is shown in context.

With routing and the state machine in place, the next section steps away from the network and turns to the visual problem: computing calendar geometry entirely in JavaScript.

## Layout geometry computed in JS

Before `DayTimeGrid` renders a single event block, three questions must be answered in JavaScript: *where vertically does this block sit?* (time-of-day → proportional offset), *how wide is it?* (does it share a column with a concurrent session?), and *does it conflict with another session in the user's plan?* All three are handled by `src/lib/layout.js` — a DOM-free, framework-free pure JS module with no Preact imports, no `document`. Like the conjugation engine in [03](./03-japanese-verb-tower.md), keeping this logic outside components lets you run it in Node, test it with plain inputs and outputs, and change it without touching any rendering code.

### Guarding against zero-length sessions

Session data comes from an external event feed, so malformed time values must be handled defensively. `minutesEnd` is the internal helper that all three exported functions share:

```js
// widgets/pennsic-planner/src/lib/layout.js:8-16
function minutesEnd(s) {
  let end = hmToMinutes(s.endTime);
  const start = hmToMinutes(s.startTime);
  // Guard against malformed/zero-length: ensure a visible minimum and handle end<=start.
  if (!Number.isFinite(end) || end <= start) {
    end = Number.isFinite(start) ? start + (s.durationMin || 30) : end;
  }
  return end;
}
```

If `endTime` is missing or parses to a value ≤ `startTime`, the end is set to `start + durationMin`, falling back to 30 minutes. Without this guard, a zero-height block would be invisible and a negative-height block would corrupt the cluster arithmetic that follows. The 30-minute floor is never displayed to users — it is a rendering backstop.

### Minute-of-day arithmetic

`DayTimeGrid` receives `rangeStartMin` (the minute-of-day at the grid's top edge) and `pxPerMin` (the pixel-to-minute scale) as props. The component calls `assignLanes` once at the top of its render:

```tsx
// widgets/pennsic-planner/src/components/DayTimeGrid.tsx:39
const placed = assignLanes(sessions) as PlacedSession[];
```

`assignLanes` returns an array of `PlacedSession` values — the original session plus `startMin`, `endMin`, `lane`, and `lanes`. The component maps over that array to produce each event block, computing `top` and `height` by subtracting the range baseline:

```tsx
// widgets/pennsic-planner/src/components/DayTimeGrid.tsx:67-69
{placed.map(({ session: s, startMin, endMin, lane, lanes }) => {
  const top = (startMin - rangeStartMin) * pxPerMin;
  const height = Math.max((endMin - startMin) * pxPerMin, 30);
```

`top` places the block proportionally below the grid's top edge. `height` is clamped to a minimum of 30 px so that very short sessions remain clickable. Both are plain pixel numbers that go directly into an inline `style` — no stylesheet needed for position.

### Assigning lanes: the interval-partitioning problem

When two sessions overlap in time they cannot occupy the same column. `assignLanes` solves the classical **interval partitioning** (minimum-rooms) problem: given a set of intervals, partition them into the fewest groups such that no two intervals in a group overlap. The minimum group count equals the maximum number of sessions simultaneously active at any moment — the *depth* of the interval set. A greedy sweep-line achieves this in O(n log n):

```js
// widgets/pennsic-planner/src/lib/layout.js:32-65
export function assignLanes(sessions) {
  const items = sessions
    .map((s) => ({ session: s, startMin: hmToMinutes(s.startTime), endMin: minutesEnd(s) }))
    .filter((it) => Number.isFinite(it.startMin) && Number.isFinite(it.endMin))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.session.id.localeCompare(b.session.id));
  /** @type {import('../types').PlacedSession[]} */
  const placed = [];
  let i = 0;
  while (i < items.length) {
    let clusterEnd = items[i].endMin;
    let j = i + 1;
    while (j < items.length && items[j].startMin < clusterEnd) {
      if (items[j].endMin > clusterEnd) clusterEnd = items[j].endMin;
      j++;
    }
    const cluster = items.slice(i, j);
    /** @type {number[]} */
    const laneFreeAt = [];
    /** @type {{item: typeof cluster[number], lane: number}[]} */
    const assigned = [];
    for (const it of cluster) {
      let lane = laneFreeAt.findIndex((free) => free <= it.startMin);
      if (lane === -1) { lane = laneFreeAt.length; laneFreeAt.push(it.endMin); }
      else { laneFreeAt[lane] = it.endMin; }
      assigned.push({ item: it, lane });
    }
    const lanes = laneFreeAt.length;
    for (const a of assigned) {
      placed.push({ session: a.item.session, startMin: a.item.startMin, endMin: a.item.endMin, lane: a.lane, lanes });
    }
    i = j;
  }
  return placed;
}
```

Walk through the four steps:

**1. Sort by start time.** Sessions that could possibly overlap are adjacent after sorting.

**2. Flood a cluster.** Starting from item `i`, advance `j` while `items[j].startMin < clusterEnd`, extending `clusterEnd` whenever a later item pushes the boundary out. Everything from `i` to `j` is a maximal cluster of transitively-overlapping sessions — no session outside the cluster overlaps any session inside it.

**3. Assign lanes within the cluster.** `laneFreeAt` is an array indexed by lane number; `laneFreeAt[k]` holds the end minute of the last session assigned to lane `k`. For each item: `findIndex(free => free <= it.startMin)` finds the first lane whose previous occupant has already ended. If no such lane exists, push a new one. This greedy first-fit assignment produces the minimum lane count.

**4. Broadcast `lanes` to the cluster.** After processing the cluster, `laneFreeAt.length` is the total lane count. Every block in the cluster shares the same `lanes` value, which controls its rendered width.

The `lane`/`lanes` pair converts directly to percentage geometry in the component:

```tsx
// widgets/pennsic-planner/src/components/DayTimeGrid.tsx:74-75
left: `${(lane / lanes) * 100}%`,
width: `${(1 / lanes) * 100}%`,
```

Three sessions at 10 AM, 10:15, and 10:30 that all overlap form one cluster; `laneFreeAt` grows to length 3; each block is rendered at 33.3% width.

### Detecting conflicts

`assignLanes` handles visual layout for every session in the grid view. `findConflicts` answers the separate semantic question: does the *user's plan* contain sessions that clash? It returns a `Set<string>` of conflicting session IDs:

```js
// widgets/pennsic-planner/src/lib/layout.js:73-100
export function findConflicts(sessions) {
  /** @type {Set<string>} */
  const conflicting = new Set();
  /** @type {Map<string, import('../types').Session[]>} */
  const byDay = new Map();
  for (const s of sessions) {
    let bucket = byDay.get(s.day);
    if (!bucket) {
      bucket = [];
      byDay.set(s.day, bucket);
    }
    bucket.push(s);
  }
  for (const list of byDay.values()) {
    const spans = list
      .map((s) => ({ id: s.id, a: hmToMinutes(s.startTime), b: minutesEnd(s) }))
      .filter((x) => Number.isFinite(x.a) && Number.isFinite(x.b))
      .sort((x, y) => x.a - y.a);
    for (let i = 0; i < spans.length; i++) {
      for (let k = i + 1; k < spans.length; k++) {
        if (spans[k].a >= spans[i].b) break; // sorted by start; no further overlap with i
        conflicting.add(spans[i].id);
        conflicting.add(spans[k].id);
      }
    }
  }
  return conflicting;
}
```

Grouping by `day` first means sessions on different days are never compared. Within a day, sorting by start time means that once `spans[k].a >= spans[i].b`, no further `k` can overlap with `i` — the `break` is the early termination that keeps the inner loop linear in the common case. Both session IDs are added to the set; every participant in a conflict gets flagged.

`DayTimeGrid` consumes the result one line later:

```tsx
// widgets/pennsic-planner/src/components/DayTimeGrid.tsx:81
const blockClass = `dtg-block${conflicts.has(s.id) ? ' conflict' : ''}`;
```

### Handing geometry to CSS

`top`, `height`, `left`, and `width` depend on runtime data and belong in inline styles. Track colours, however, belong in CSS. `blockStyle` mixes both:

```tsx
// widgets/pennsic-planner/src/components/DayTimeGrid.tsx:71-78
const blockStyle: JSX.CSSProperties & Record<string, unknown> = {
  top,
  height,
  left: `${(lane / lanes) * 100}%`,
  width: `${(1 / lanes) * 100}%`,
  '--tc-l': tc.l,
  '--tc-d': tc.d,
};
```

`--tc-l` and `--tc-d` are the light and dark theme colours for the session's track. Stylesheet rules consume them via `var(--tc-l)` and `var(--tc-d)` — CSS decides what to colour and how; JS supplies only the values. This is the same CSS-custom-property-from-JSX-inline-style pattern introduced in [02](./02-image-comparison-table.md). The split is load-bearing: *where* a block appears is computed from time data in JS (geometry), *how* it looks is controlled by CSS (decoration). For the grid's hour-line rules, column headers, and block decoration, see the design track at [../design/04-pennsic-planner.md](../design/04-pennsic-planner.md).

With the visual layout algorithm in hand, the next section turns to the export path — generating a valid RFC 5545 calendar file from the user's planned sessions without a server round-trip.

## Generating an .ics file in the browser

The "Export to Calendar" button in `MyCalendar` hands the user's planned sessions to their calendar app — no server round-trip. The logic splits across two files: `ics.js` builds the RFC 5545 document string, and `download.js` hands it to the browser as a file. The split is the same one that motivated the pure conjugation engine in [03](./03-japanese-verb-tower.md): keeping `ics.js` DOM-free makes it importable in Node for unit tests, while `download.js` is allowed to be browser-only.

```js
// widgets/pennsic-planner/src/lib/ics.js:1-4
// @ts-check
// RFC-5545 iCalendar export. One timed VEVENT per selected session, zoned to America/New_York via
// a bundled VTIMEZONE so calendars place events at the correct Eastern wall-clock time (never
// floating/naive). Pure ESM JS, dependency-free; shared by the app and test/ics.test.mjs.
```

The call site is a single line in the component:

```tsx
// widgets/pennsic-planner/src/components/MyCalendar.tsx:69
onClick={() => downloadIcs(sessions)}
```

### The VCALENDAR envelope

`buildIcs` opens with the mandatory iCalendar wrapper (RFC 5545 §3.4):

```js
// widgets/pennsic-planner/src/lib/ics.js:102-109
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//beshir.org//Pennsic Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE,
  ];
```

`VERSION:2.0` and `PRODID` are required. `PRODID` is an arbitrary product identifier; the conventional format is `-//Owner//Product//Language`. The `...VTIMEZONE` spread inlines the timezone definition immediately after the envelope opens, before any events.

### TZID, not UTC or floating time

RFC 5545 §3.3.5 offers three forms for `DATE-TIME`. **UTC** (trailing `Z`) pins an absolute instant regardless of where the consumer's calendar is configured. **Floating** (no `Z`, no `TZID`) means "this time wherever the user is" — a user in California would see a Pennsic session three hours earlier than it actually runs. **Local with TZID** — `DTSTART;TZID=America/New_York:20260801T100000` — specifies a wall-clock time at a named timezone and delegates DST arithmetic to the consumer.

For a fixed-location event, `TZID` is correct. The file encodes what a participant sees on the schedule board; the calendar app figures out the UTC offset.

```js
// widgets/pennsic-planner/src/lib/ics.js:131-132
      `DTSTART;TZID=America/New_York:${dtStart}`,
      `DTEND;TZID=America/New_York:${dtEnd}`,
```

### The self-contained VTIMEZONE

Using `TZID` requires a matching `VTIMEZONE` component in the same file. Without it some clients refuse to parse the events; others silently misplace them. You cannot assume the consumer has access to the IANA timezone database.

```js
// widgets/pennsic-planner/src/lib/ics.js:11-30
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'X-LIC-LOCATION:America/New_York',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];
```

`DAYLIGHT` describes the spring-forward: `TZOFFSETFROM:-0500` (before — EST) and `TZOFFSETTO:-0400` (after — EDT). `STANDARD` covers the fall-back with inverted offsets. The `RRULE` encodes the modern US rule: 2nd Sunday of March (`BYMONTH=3;BYDAY=2SU`) and 1st Sunday of November (`BYMONTH=11;BYDAY=1SU`). Pennsic runs late July through early August — always deep in EDT — so only `DAYLIGHT` is active for these events. Both subcomponents are included anyway so the exported file is valid and portable for any date a user might import.

### CRLF: the #1 iCalendar bug

RFC 5545 §3.1 requires every content line to end with CRLF (`\r\n`). Bare LF (`\n`) is non-conforming, and some clients will silently reject the entire file. The final line in `buildIcs` is explicit about it:

```js
// widgets/pennsic-planner/src/lib/ics.js:144
  return lines.map(foldLine).join('\r\n') + '\r\n';
```

If you generate this with a template literal and forget to replace `\n` with `\r\n`, you get a technically invalid file. This is one of the most common ICS generation bugs in the wild.

### 75-octet line folding

Lines longer than 75 **octets** must be folded: insert CRLF followed by a single space and continue. The key word is *octets*, not characters. A naive `substring(0, 75)` fold will split multibyte UTF-8 sequences mid-codepoint. `foldLine` avoids this:

```js
// widgets/pennsic-planner/src/lib/ics.js:50-68
export function foldLine(line) {
  // Work in UTF-8 octets so multibyte characters don't get split across the 75-octet boundary.
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Avoid splitting a multibyte sequence: back off while the next byte is a UTF-8 continuation.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((start === 0 ? '' : ' ') + dec.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74; // subsequent lines reserve one octet for the leading space
  }
  return out.join('\r\n');
}
```

`TextEncoder` converts the string to bytes; the inner `while` backs off `end` as long as `(bytes[end] & 0xc0) === 0x80` — the bit pattern identifying a UTF-8 continuation byte. Backing off until that condition is false lands on a codepoint boundary. Continuation lines use `limit = 74` because the mandatory leading space consumes one octet.

### TEXT escaping

In TEXT-typed properties (`SUMMARY`, `DESCRIPTION`, `LOCATION`), certain characters have structural significance and must be backslash-escaped:

```js
// widgets/pennsic-planner/src/lib/ics.js:37-43
export function escapeText(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}
```

The backslash replacement runs first — otherwise the newly-inserted backslashes would be double-escaped on a later pass. An unescaped comma in a `SUMMARY` will silently truncate the value at that comma in some parsers (commas delimit list values in iCalendar). Newlines within a field become the two-character escape `\n`, not a literal line break.

### Browser file download without a server

```js
// widgets/pennsic-planner/src/lib/download.js:11-20
export function downloadIcs(sessions, filename = 'pennsic-plan-2026.ics') {
  const text = buildIcs(sessions);
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
```

`new Blob([text], { type: 'text/calendar;charset=utf-8' })` wraps the string in a Blob. `URL.createObjectURL(blob)` returns a `blob:<origin>/<uuid>` URL — an in-memory reference the browser maintains until explicitly revoked. An `<a>` element (not appended to the DOM — that is only required for Firefox) gets its `href` set to the object URL, its `download` attribute set to the filename, and `.click()` triggers the browser's native save dialog.

The timing of `revokeObjectURL` matters. The browser captures the download data when `.click()` fires; the actual file write is asynchronous. Revoking *before* `.click()` would silently break the download — the URL would already be invalid. Revoking *after* is safe because the browser has already captured the data. The five-second `setTimeout` is conservative; the point is simply that cleanup must come after `.click()`, not before.

This is why `ics.js` and `download.js` are separate modules. `buildIcs` constructs a plain string: no `document`, no `Blob`, no browser API. You can import it in a Node test, pass a fixed `opts.dtstamp` for determinism, and assert on the exact output. `downloadIcs` is browser-only by nature and tested manually. The module boundary enforces the testability split — the same principle as domain-logic-outside-components from [03](./03-japanese-verb-tower.md).

For the visual treatment of the export button — placement, styles, and the `plan-export-btn` class — see the [design track](../design/04-pennsic-planner.md).

With all the pieces individually explained, the next section connects them: how the `useEffect` at line 118 wires subscription, routing, and page-hide flush together without stale closures, and how `runWrite` guarantees no edit disappears.

## Effects and integration

The [store seam](#state-and-data-flow-the-store-seam) section showed `planStore.subscribe(...)` in isolation; the [Hash routing](#hash-routing-and-capability-urls) section introduced `applyRouteRef` and showed the full resolver body. Here we complete the picture: why the body assignment matters for closure freshness, how the single large `useEffect` at line 118 wires three independent listeners without leaking any of them, and how the store's write protocol guarantees that no edit disappears even when the tab closes mid-debounce.

### One `useEffect`, three listeners

As introduced in [Hash routing](#hash-routing-and-capability-urls), `applyRouteRef.current` is assigned in the component body (line 77) on every render. The once-registered `hashchange` listener captures only the stable ref object; dereferencing `.current` at call time always invokes the freshest closure:

```tsx
// widgets/pennsic-planner/src/App.tsx:132
const onHashChange = () => void applyRouteRef.current(parseHash(location.hash));
```

The store subscription, the hash listener, and the pagehide listener all share the same mount/unmount lifecycle, so they live in a single effect with `[]` deps (App.tsx:118–147). One cleanup block removes all three:

```tsx
// widgets/pennsic-planner/src/App.tsx:118-147
useEffect(() => {
  refreshDevices();
  const unsub = planStore.subscribe((change: PlanChange) => {
    if (change.type === 'active') {
      setActive(change.calendar);
    } else if (change.type === 'sync') {
      setSync({ status: change.status, message: change.message });
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (change.status === 'saved') {
        savedTimer.current = setTimeout(() => setSync({ status: 'idle' }), 2000);
      }
    }
  });

  const onHashChange = () => void applyRouteRef.current(parseHash(location.hash));
  window.addEventListener('hashchange', onHashChange);
  // Flush any pending debounced edit before the tab goes away.
  const onPageHide = () => void planStore.flush();
  window.addEventListener('pagehide', onPageHide);

  void applyRouteRef.current(parseHash(location.hash));

  return () => {
    unsub();
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('pagehide', onPageHide);
    if (savedTimer.current) clearTimeout(savedTimer.current);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Co-locating the three listeners is intentional: anything that should live for the life of the `App` component goes in this block. The effect also calls `applyRouteRef.current(parseHash(location.hash))` immediately (line 138) — this is the initial route resolution on mount, because `hashchange` does not fire on the first page load. The ESLint `exhaustive-deps` disable at line 146 is intentional and safe: the ref is the indirection that breaks the closure dependency, so there are genuinely no dependencies to list.

### `pagehide` + `keepalive: true` — the safe save-on-unload

The pagehide listener is one line:

```tsx
// widgets/pennsic-planner/src/App.tsx:135-136
const onPageHide = () => void planStore.flush();
window.addEventListener('pagehide', onPageHide);
```

`pagehide` fires when the browser is about to remove the page from the document — either destroying it or freezing it for the back/forward cache (bfcache). It is the correct event for save-on-unload because, unlike `unload` and `beforeunload`, listening to `pagehide` does **not** prevent the page from entering bfcache. Both `unload` and `beforeunload` block bfcache entirely and are unreliable on mobile (the OS can kill the browser process before they fire). Never use them for saves.

`flush` does two things — it cancels the debounce timer and calls `runWrite(true)`:

```ts
// widgets/pennsic-planner/src/store.ts:190-196
async flush(): Promise<void> {
  if (this.timer) {
    clearTimeout(this.timer);
    this.timer = null;
  }
  await this.runWrite(true);
}
```

The `true` argument sets `keepalive: true` on the outgoing `fetch` (store.ts:218). `keepalive` tells the browser to keep the request alive even after the initiating page has been torn down — the PUT completes in the background while the tab is closing. The body size limit is 64 KiB; plan payloads are far smaller than that in practice.

`navigator.sendBeacon` looks tempting here but is the wrong tool: it is POST-only, cannot carry `Authorization` or `If-Match` headers, and returns no response to inspect. `keepalive fetch` is the modern replacement — same lifecycle guarantee, but with full HTTP semantics.

### The optimistic concurrency write protocol

Every edit (toggling a session, renaming the plan) updates the in-memory snapshot immediately and then calls `markDirty`:

```ts
// widgets/pennsic-planner/src/store.ts:181-188
private markDirty(): void {
  this.dirty = true;
  if (this.timer) clearTimeout(this.timer);
  this.timer = setTimeout(() => {
    this.timer = null;
    void this.runWrite();
  }, WRITE_DEBOUNCE_MS);
}
```

This is trailing-edge debounce via `setTimeout`, the same pattern introduced in [03](./03-japanese-verb-tower.md). `WRITE_DEBOUNCE_MS` is 700 ms. Rapid edits (fast typing in the name field, quick toggles) each reset the timer; only the final one dispatches a write. The `dirty` flag is set immediately, before any timer fires, so `flush()` during `pagehide` always sees the latest state.

`runWrite` is the core of the write protocol:

```ts
// widgets/pennsic-planner/src/store.ts:198-255
private async runWrite(keepalive = false): Promise<void> {
  if (this.writing) return; // a write is in flight; it re-checks `dirty` when it finishes
  const cal = this.active;
  if (!cal || !cal.secret || !this.dirty) return;

  this.writing = true;
  this.dirty = false;
  const snapshotRev = cal.rev;
  this.emitSync('saving');

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(cal.id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cal.secret}`,
        'If-Match': String(snapshotRev),
      },
      body: JSON.stringify({ name: cal.name, sessionIds: cal.sessionIds }),
      keepalive,
    });
  } catch {
    this.dirty = true; // network blip — let a later change or flush retry
    this.writing = false;
    this.emitSync('error', 'Offline — changes will retry.');
    return;
  }

  if (res.status === 409) {
    // Hold the write lock across the reload so a queued write can't race the refetch.
    await this.reloadAfterConflict();
    this.writing = false;
    return;
  }
  if (!res.ok) {
    this.writing = false;
    // A server-side (5xx) failure is transient: keep the edit dirty so flush()/a later change
    // retries it. A 4xx is our bug or a rejected body — don't loop on it.
    if (res.status >= 500) this.dirty = true;
    this.emitSync('error', res.status >= 500 ? 'Save failed — will retry.' : 'Save failed.');
    return;
  }

  try {
    const data = (await res.json()) as ServerCalendar;
    // Only the rev/updatedAt are authoritative from the response; keep the user's latest local edits.
    if (this.active && this.active.id === cal.id) {
      this.setActive({ ...this.active, rev: data.rev, updatedAt: data.updatedAt ?? this.active.updatedAt });
    }
  } catch {
    /* response body optional for our purposes */
  }
  this.writing = false;
  this.emitSync('saved');

  if (this.dirty) void this.runWrite(); // more edits arrived mid-flight — flush them
}
```

Walk through the states:

**Single-flight guard.** `if (this.writing) return` at line 199 means concurrent calls do not queue. Any edit that arrives while `writing` is true just sets `dirty = true`; the completion handler at line 254 re-calls `runWrite()` if `dirty` is still set. At most one write is ever in flight, with at most one queued re-trigger.

**Optimistic snapshot.** `this.dirty = false` is cleared before the request is sent (line 204). Edits that arrive during the flight are captured by `markDirty`'s subsequent `dirty = true` rather than being discarded.

**`If-Match` and the 409 path.** The PUT carries `If-Match: <rev>` where `rev` is the revision number the store last received from the server. The server compares that against the current stored revision. If another device has written in the meantime, the revisions differ and the server returns 409. The store then calls `reloadAfterConflict`:

```ts
// widgets/pennsic-planner/src/store.ts:257-277
private async reloadAfterConflict(): Promise<void> {
  const cur = this.active;
  if (!cur) return;
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(cur.id)}`, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = (await res.json()) as ServerCalendar;
      this.dirty = false;
      this.setActive({
        ...cur,
        name: data.name,
        rev: data.rev,
        sessionIds: Array.isArray(data.sessionIds) ? data.sessionIds.slice() : [],
        updatedAt: data.updatedAt ?? cur.updatedAt,
      });
    }
  } catch {
    /* leave the local snapshot in place if the reload itself fails */
  }
  this.emitSync('conflict', CONFLICT_MESSAGE);
}
```

A conflict is never silently dropped. The store re-fetches the server's current copy, overwrites `active` with it (updating `rev` to the server value so the next write can succeed), clears `dirty`, and then emits `SyncStatus = 'conflict'` with a user-visible message. The local edits that were in the conflicting PUT are lost — the server's version wins — but the user is told.

**On success.** The response body carries the server's new `rev` and `updatedAt`. The store applies only those fields to `active`, preserving any local edits the user may have made during the flight (line 246). Then `emitSync('saved')` fires.

**Network error.** The `catch` at line 220 handles a network blip: `dirty` is set back to `true` so that a later edit or a manual retry via `flush()` will re-attempt the write. The store emits `'error'` with a "will retry" message — the edit is not lost.

### `SyncBadge` — consuming `SyncStatus`

`CalendarBar.tsx` renders `SyncBadge`, which maps the five `SyncStatus` values to badge text and class:

```tsx
// widgets/pennsic-planner/src/components/CalendarBar.tsx:156-170
function SyncBadge({ sync }: { sync: { status: SyncStatus; message?: string } }) {
  const map: Record<SyncStatus, { text: string; cls: string }> = {
    idle: { text: 'Saved', cls: 'saved' },
    saving: { text: 'Saving…', cls: 'saving' },
    saved: { text: 'Saved', cls: 'saved' },
    error: { text: sync.message ?? 'Save failed', cls: 'error' },
    conflict: { text: 'Reloaded', cls: 'error' },
  };
  const m = map[sync.status];
  return (
    <span class={`cal-sync cal-sync-${m.cls}`} role="status" title={sync.message ?? ''}>
      {m.text}
    </span>
  );
}
```

`SyncBadge` knows nothing about the write protocol. It receives only a `{ status, message }` struct that `App` copied from the store's `'sync'` change event via `setSync`. The chain is `runWrite`/`reloadAfterConflict` → `emitSync` → subscription → `setSync` → `SyncBadge`; each layer handles exactly its own concern.

### `ResizeObserver` for iframe sizing

The second `useEffect` at lines 150–162 is covered in full in [01](./01-function-plotter.md) and is structurally identical here: a `ResizeObserver` watches the container element and debounces `postMessage` calls to resize the hosting iframe. The only change from tutorial 01 is the 100 ms debounce wrapping the `postMessage` (to avoid flooding the parent during rapid layout shifts). Cleanup disconnects the observer and cancels any pending timer.

The final section traces the four user flows — create, toggle, share, export — end-to-end, showing how store, router, and derived data compose into a coherent whole.

## Putting it together

The prior sections each isolated one mechanism: the store seam, hash routing, layout geometry, ICS generation, and the effect wiring. This section traces a single user journey — create a plan, toggle sessions, share it, export it — end-to-end through the code, watching how those pieces compose.

### The derived data chain

Every piece of UI in the planner reads from a chain of `useMemo` values rooted in two pieces of state: the current `AppMode` and the `ActiveCalendar | null` returned by the store subscription. The full dependency graph is:

```
eventDef     ← [mode, active]
dataset      ← eventDef
days         ← dataset
trackColors  ← dataset
filteredSessions ← [dataset, selectedDay, trackFilter, locationFilter, textFilter]
planSet      ← planIds ← [browsing, active]
planSessions ← [dataset, planSet]
conflicts    ← [planSessions]
openSession  ← [dataset, openSessionId]
```

`eventDef` is the root of the chain:

```tsx
// widgets/pennsic-planner/src/App.tsx:165-169
const eventDef = useMemo(() => {
  if ((mode === 'edit' || mode === 'readonly') && active) return getEvent(active.eventId) ?? null;
  if (mode === 'missing-event') return null;
  return DEFAULT_EVENT;
}, [mode, active]);
```

`dataset` is a plain assignment — `const dataset = eventDef ? eventDef.sessions : EMPTY` (App.tsx:171) — rather than another `useMemo`, because `eventDef` itself has stable identity (it's already memoised, so this assignment is a free read).

Below `dataset`, the chain fans out. `filteredSessions` is what the day-grid browses; `planSessions` is what the "My Calendar" tab and the ICS export both consume; `conflicts` is what feeds the warning badge:

```tsx
// widgets/pennsic-planner/src/App.tsx:229-250
const filteredSessions = useMemo(() => {
  let ss = dataset.filter((s) => s.day === selectedDay);
  if (trackFilter.length > 0) ss = ss.filter((s) => trackFilter.includes(s.track));
  if (locationFilter) ss = ss.filter((s) => s.location === locationFilter);
  if (textFilter) {
    const q = textFilter.toLowerCase();
    ss = ss.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.instructor ?? '').toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    );
  }
  return ss;
}, [dataset, selectedDay, trackFilter, locationFilter, textFilter]);

const planSet = useMemo(() => new Set(planIds), [planIds]);
const planSessions = useMemo(
  () => dataset.filter((s) => planSet.has(s.id)),
  [dataset, planSet]
);
const conflicts = useMemo(() => findConflicts(planSessions) as Set<string>, [planSessions]);
```

The cascaded-`useMemo` pattern — each layer re-computes only when its specific inputs change — is the same technique introduced in [01](./01-function-plotter.md) and [02](./02-image-comparison-table.md). What is new here is the scale: the chain spans from global app state all the way down to per-cell conflict flags, all without the components themselves knowing how the data was derived.

### Flow 1: Create

A first-time visitor lands on the browse view. When they click the "Add to Plan" toggle on any session, `handleToggle` fires:

```tsx
// widgets/pennsic-planner/src/App.tsx:271-278
async function handleToggle(id: string): Promise<void> {
  if (mode === 'edit') {
    planStore.togglePlan(id);
  } else if (mode === 'landing') {
    await createWith([id]); // create-on-add: one step from browsing to an editable calendar
  }
  // readonly: toggles are not shown
}
```

In `landing` mode there is no active calendar yet, so `handleToggle` calls `createWith`, which calls `planStore.create`:

```tsx
// widgets/pennsic-planner/src/App.tsx:260-269
async function createWith(sessionIds: string[]): Promise<void> {
  if (busy) return;
  setBusy(true);
  const created = await planStore.create(defaultCalendarName(), sessionIds);
  setBusy(false);
  if (!created) return; // failure already surfaced via the sync badge
  setJustCreated(true);
  refreshDevices();
  location.hash = editHash(created.id, created.secret);
}
```

Inside the store, `create` POSTs the new calendar to `/api/calendar`, builds an `ActiveCalendar` object from the response, calls `this.setActive(calendar)`, and emits `'saved'` (store.ts:110-143). The `emit` fires the subscription listener in `App`, which calls `setActive(change.calendar)`. Separately, `createWith` sets `location.hash = editHash(created.id, created.secret)`. That hash assignment triggers `hashchange`, which calls `applyRouteRef.current(...)`, which calls `setMode('edit')`. The capability URL is the transition mechanism; the store emission keeps the in-memory `active` in sync.

### Flow 2: Toggle/edit

Once in `edit` mode, `handleToggle` takes the first branch:

```tsx
// widgets/pennsic-planner/src/App.tsx:273
planStore.togglePlan(id);
```

`togglePlan` updates the in-memory snapshot synchronously and schedules a write:

```ts
// widgets/pennsic-planner/src/store.ts:146-154
togglePlan(id: string): void {
  if (!this.active || !this.active.secret) return; // editing requires an active editable calendar
  const has = this.active.sessionIds.includes(id);
  const sessionIds = has
    ? this.active.sessionIds.filter((x) => x !== id)
    : [...this.active.sessionIds, id];
  this.setActive({ ...this.active, sessionIds });
  this.markDirty();
}
```

`setActive` emits a `type:'active'` change, so `App`'s subscription fires immediately: `setActive(change.calendar)` updates the component's state. The derived chain re-runs from `planSet` downward — `planSessions` and `conflicts` update, and the grid reflects the change before the network request has even started. That is the "optimistic" part of the write protocol described in [Effects and integration](#effects-and-integration).

`markDirty` schedules the debounced PUT. The `SyncBadge` transitions from idle → "Saving…" → "Saved" as `emitSync` fires, all without the badge knowing anything about the write protocol. This is the props-down/events-up boundary ([02](./02-image-comparison-table.md)) applied at the store level: the badge consumes `SyncStatus` passed as a prop from `App`, which received it from the store subscription.

### Flow 3: Share

`CalendarBar` derives both capability URLs from `active` in one line:

```tsx
// widgets/pennsic-planner/src/components/CalendarBar.tsx:58
const urls = capabilityUrls(active.id, active.secret);
```

`capabilityUrls` is a pure function in `route.ts` that returns `{ edit, share }`. `urls.edit` embeds the secret in the fragment (`#/c/<id>/<secret>`); `urls.share` omits it. Neither URL is sent to any server — `capabilityUrls` constructs them entirely in the browser from the values that are already in memory. The security properties of this shape (fragment never reaches the server, never appears in access logs or the `Referer` header) are explained in [Hash routing and capability URLs](#hash-routing-and-capability-urls). `CalendarBar` renders the edit link only to the user who already has the secret, and surfaces both links — on first creation via the `justCreated` banner, thereafter via the Share popover.

### Flow 4: Export

The "My Calendar" tab shows `planSessions` (the derived chain value) laid out chronologically. Clicking "Export to Calendar (.ics)" triggers:

```tsx
// widgets/pennsic-planner/src/components/MyCalendar.tsx:69
onClick={() => downloadIcs(sessions)}
```

`sessions` here is `planSessions` passed down as a prop — the same array computed by the memoised chain. `downloadIcs` calls `buildIcs` to produce the RFC 5545 document, wraps it in a `Blob`, creates an object URL, and synthesises a link click (the full implementation is in [Generating an .ics file in the browser](#generating-an-ics-file-in-the-browser)). No server round-trip; the file contains exactly the sessions the user planned, generated from the same bundled schedule data that drives the browse view.

### How it composes

The four flows share a common skeleton: `active` (from the store subscription) feeds `eventDef`; `eventDef` feeds `dataset`; every downstream value — filtered sessions, lane geometry, conflict flags, ICS content — reads from `dataset`. The store, the router, and the derived chain are independent; `App` owns only the wiring between them.

## Concepts introduced

| Concept | Section |
|---------|---------|
| Cloudflare D1 as serverless SQLite storage layer bound to a Cloudflare Worker | The stack and why |
| External store / observer seam: `PlanStore` interface as swappable seam; singleton `RemotePlanStore` outside the component tree | State and data flow: the store seam |
| `subscribe(listener)` + `emit(change)` pub-sub; `useEffect` bridge from external store into `useState` | State and data flow: the store seam |
| Capability URLs in the URL fragment: fragment never sent in HTTP requests (RFC 3986 §3.5 / WHATWG URL spec); fragment excluded from `Referer` header | Hash routing and capability URLs |
| Hash route parsing and building: `parseHash`, `editHash`, `shareHash`, `capabilityUrls`; two capability URL shapes (edit / read-only) | Hash routing and capability URLs |
| `AppMode` discriminated-union state machine with async route resolver: `landing \| loading \| edit \| readonly \| notfound \| missing-event \| error` | Hash routing and capability URLs |
| `applyRouteRef` latest-closure ref pattern: ref assigned in component body (not inside `useEffect`) so once-registered event listeners always call the current closure | Introduced: Hash routing and capability URLs / Full implementation: Effects and integration |
| Layout geometry computed in JS: minute-of-day → proportional `top`/`height`; greedy sweep-line interval partitioning for `lane`/`lanes`; inline styles for position, CSS custom props (`--tc-l`/`--tc-d`) for theming | Layout geometry computed in JS |
| `findConflicts` sorted pairwise sweep returning `Set<string>` of conflicting session IDs | Layout geometry computed in JS |
| Client-side RFC 5545 ICS file generation: VCALENDAR structure, self-contained VTIMEZONE with DAYLIGHT/STANDARD RRULE, CRLF line endings, octet-aware 75-byte line folding, TEXT escaping | Generating an .ics file in the browser |
| Browser file download without a server: `Blob` → `URL.createObjectURL` → `<a download>.click()` → `URL.revokeObjectURL` in `setTimeout` | Generating an .ics file in the browser |
| `pagehide` + `keepalive: true` flush: bfcache-safe save-on-unload; why not `unload`/`beforeunload`; `keepalive fetch` vs `navigator.sendBeacon` | Effects and integration |
| Optimistic concurrency write protocol: `If-Match: <rev>` PUT, `writing`/`dirty` single-flight coalescing, 409 → `reloadAfterConflict`, dirty re-check on completion | Effects and integration |
