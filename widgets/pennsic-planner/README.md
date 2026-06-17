# Pennsic Planner

A schedule browser and personal planner for **Pennsic War 53** (2026), embedded as a
single-page Preact widget served via Cloudflare Workers.

## Features

- **Timetable** — 14-day browser with side-by-side concurrent-session lanes, sticky time
  gutter, and horizontal scroll when many classes overlap.  Opens on the busiest day
  by default.
- **Filters** — multi-select track chips with a searchable dropdown, location select, and
  full-text search across title / instructor / description.  Result count updates live.
- **My Plan** — click any session block to add or remove it.  In-plan blocks show a ✓
  badge.  Time-conflict detection highlights overlapping sessions on the My Plan tab.
- **Agenda view** — My Plan tab groups selections by day in chronological order with
  quick-remove buttons.
- **CSV import** — paste or upload a fresh
  [thing.pennsicuniversity.org](https://thing.pennsicuniversity.org/) calendars CSV to
  replace the bundled snapshot.  Plan selections whose IDs survived the import are
  preserved automatically; a success banner reports the row count.  A *Reset* button
  restores the bundled data at any time.
- **Calendar export (.ics)** — downloads a standards-compliant iCalendar file (one
  `VEVENT` per planned session) with a self-contained `VTIMEZONE` for
  `America/New_York`, so events land at the correct Eastern wall-clock time in Google
  Calendar, Apple Calendar, and Outlook.
- **Persistence** — selected sessions and any imported dataset survive page reloads via
  the `PlanStore` abstraction (localStorage backend by default).
- **Accessibility** — all interactive elements carry `aria-label`, session blocks
  implement `role="button"` with keyboard handling and `aria-pressed`.
- **Dark mode** — full `prefers-color-scheme: dark` theme; all transitions respect
  `prefers-reduced-motion`.
- **Iframe-ready** — sends `{ type: "resize", height }` to `window.parent` via
  `ResizeObserver` for auto-height embedding.

## Data

| Mode | Details |
|---|---|
| **Static snapshot** | `src/data/sessions-2026.json` — 1,836 sessions, normalized from the official Pennsic 53 CSV export captured 2026-06-17. Bundled at build time; the widget renders fully offline. |
| **Import refresh** | Users upload or paste a new CSV from [thing.pennsicuniversity.org](https://thing.pennsicuniversity.org/) (Import / Export tab). `src/lib/normalize.js` normalizes it client-side to the same schema. The imported dataset is stored in `PlanStore` (localStorage) and overrides the bundle until the user resets. |

The sample fixture used by the beshir-widgets validator is `src/data/sample-2026.json`
(60 records), referenced in `widget.json → data.sample`.

## Swapping in a Cloudflare KV backend

All persistence goes through one async module — `src/store.ts` — which exports a
`PlanStore` interface:

```ts
export interface PlanStore {
  getPlan(): Promise<string[]>;
  setPlan(ids: string[]): Promise<void>;
  togglePlan(id: string): Promise<string[]>;
  getDataset(): Promise<Session[] | null>;
  setDataset(dataset: Session[] | null): Promise<void>;
  subscribe(listener: (change: PlanChange) => void): () => void;
}
```

The UI calls **only** these methods.  `localStorage` is touched exclusively inside
`LocalPlanStore` in `store.ts`.

To store a signed-in user's plan in **Cloudflare KV**:

1. Add a `KVNamespace` binding (`PLAN_KV`) to `wrangler.jsonc` and a Worker route that
   reads/writes `PLAN_KV` under a key derived from the user's identity (e.g.
   `plan:v1:<userId>`).

2. Write a `RemotePlanStore` class that implements `PlanStore` by calling
   `fetch('/api/plan', …)` (or a typed RPC stub) — the `RemotePlanStore` keeps an
   in-memory cache and calls `this.emit(change)` after each mutation, exactly as
   `LocalPlanStore` does.

3. At startup, decide which implementation to use (e.g. if a session cookie is present,
   instantiate `RemotePlanStore`; otherwise fall back to `LocalPlanStore`):

   ```ts
   // src/store.ts  (modified)
   export const planStore: PlanStore = isSignedIn()
     ? new RemotePlanStore('/api/plan')
     : new LocalPlanStore();
   ```

No UI component needs to change — the async interface is the only seam.

## Dev / build

```bash
# Install dependencies
npm install

# Start the Vite dev server
npm run dev

# Production build → dist/
npm run build

# Run the Node test suite (importer + .ics)
npm test
```

The build bundles the entire 1,836-session dataset as a static asset
(`chunkSizeWarningLimit` is raised to 2048 KB accordingly).

## Embed

```html
<iframe
  src="https://pennsic-planner.widgets.beshir.org"
  loading="lazy"
  style="width:100%;height:760px;border:0"
></iframe>
```

Add `id="pennsic-planner-frame"` and listen for `{ type: "resize", height }` messages
to implement automatic height adjustment:

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'resize') {
    document.getElementById('pennsic-planner-frame').style.height = e.data.height + 'px';
  }
});
```

## Deployment

The widget is deployed as a Cloudflare Worker (`widget-pennsic-planner`) serving static
assets from `dist/`.  See `wrangler.jsonc` for the route and domain configuration.
After `npm run build`, deploy with `npx wrangler deploy`.
