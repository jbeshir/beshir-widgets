# Widget testing — the journey harness

Source-of-truth for the interaction-and-UX testing stage, alongside
[`LIBRARIES.md`](./LIBRARIES.md) and [`DATA.md`](./DATA.md).

Three gates run on every widget:

1. **First-paint gate** — `scripts/render.cjs` loads the built `dist/index.html`,
   waits for the `#widget-ready` marker, and takes one screenshot. Unchanged.
2. **Journey gate** — `scripts/journey.cjs` drives the widget through a matrix of
   `state × viewport × scheme` cells described by an **optional** per-widget
   sidecar `widgets/<slug>/journey.json`, capturing a screenshot per cell plus
   correctness signals. A widget with no `journey.json` skips this gate.
3. **Rendered theme audit** — `scripts/audit-theme.cjs` uses the built
   `file://` document and the repository manifest to record computed family,
   weight, size, foreground/background composition, text/boundary/focus/status
   checks, opacity and ordinary/200% zoom overflow in light and dark. It applies
   WCAG 2.2 ratios only where CSS layers resolve to a stable solid surface;
   gradients, images and maps are explicitly reported for manual review.

The journey harness is **both a screenshot generator and a correctness gate**: it
exits non-zero if any cell hits a page error, a console error, or fails to reach
its `expect` marker.

## Contract every widget already meets

- **`#widget-ready`** — render an element with `id="widget-ready"` (it may be
  `hidden`) once first meaningful paint is complete (after async fonts/WASM/data).
  Both gates wait for it before doing anything.

## Contract interactive widgets opt into

### `data-widget-state` lifecycle marker

Widgets reflect their lifecycle by setting `data-widget-state` on the root
`<html>` element (`document.documentElement.dataset.widgetState`). The journey
harness awaits transitions on it, so it must be deterministic for a given
sequence of actions. Values, from the vocabulary below — use the ones your UI
actually has:

| value       | meaning |
|-------------|---------|
| `loading`   | still fetching/parsing; not yet interactive |
| `ready`     | first paint done, idle, no user input applied |
| `populated` | showing meaningful results (search hits, a built result, candidates) |
| `empty`     | a query/action produced no results (intentional empty state) |
| `error`     | an action failed / input could not be processed |

At minimum a widget exposes `ready`. Add the others as the UI has them.

### `data-testid` hooks

Interactive controls expose stable `data-testid` attributes so journeys target
behaviour, not styling. Prefer `[data-testid=…]` selectors and ARIA roles over
CSS classes (classes churn with restyling; testids and roles are contracts).

## `journey.json` schema

```jsonc
{
  "matrix": {
    "viewports": ["mobile:390x844", "tablet:768x1024", "desktop:1280x800"],
    "schemes":   ["light", "dark"]
  },
  "states": [
    { "label": "initial", "steps": [], "expect": { "state": "ready" } },
    {
      "label": "search-results",
      "steps": [ { "fill": "[data-testid=search-input]", "value": "taberu" } ],
      "expect": { "state": "populated" }
    }
  ]
}
```

- **`matrix.viewports`** — non-empty; each `^[a-z0-9-]+:\d+x\d+$`
  (`label:WIDTHxHEIGHT`). The label becomes the `<viewportLabel>` in filenames.
- **`matrix.schemes`** — non-empty subset of `light` | `dark`.
- **`states`** — non-empty; each `label` unique within the widget.
- **`steps`** — ordered actions (vocabulary below); `[]` for the initial state.
- **`expect`** — the marker the harness waits on after replaying steps:
  - `{ "state": "<value>" }` — await `document.documentElement.dataset.widgetState === value`.
  - `{ "selector": "<sel>" }` — await the selector becoming visible.

### Action vocabulary for `steps`

| step | effect |
|------|--------|
| `{ "click": "<selector>" }` | click an element |
| `{ "clickRole": { "role": "tab", "name": "Break down" } }` | click by ARIA role (+ optional accessible name) |
| `{ "fill": "<selector>", "value": "<text>" }` | set an input's value |
| `{ "press": "<key>" }` | press a key (e.g. `Enter`) |
| `{ "hover": "<selector>" }` | hover an element |
| `{ "waitFor": "<selector>" }` | wait for a selector to become visible |
| `{ "eval": "<js expression>" }` | escape hatch: evaluate an expression in the page |
| `{ "mockFetch": { "urlPattern": "**/api/map", "method": "POST", "status": 201, "body": { … } } }` | intercept matching requests in the browser and answer with a canned response |

Prefer `[data-testid=…]` selectors and roles. Avoid relying on incidental CSS classes.

#### `mockFetch` — driving network-gated flows offline

Some widgets only reach their most interesting states after a real network
round-trip (e.g. a "Create shared map" `POST /api/map` that mints a row, after
which pin editing unlocks). Both gates run under `file://` with `egress: none`,
so those states would otherwise be untestable. `mockFetch` closes that gap
**without any real network**: it installs an in-page `window.fetch` wrapper that
answers matching calls with a response you specify and delegates everything else
to the real fetch — nothing ever leaves the page, so it behaves identically
whether or not egress is available.

> A `file://` page cannot fetch anything — the browser rejects
> `fetch('/api/map')` outright ("URL scheme file is not supported") — and
> Playwright's network-layer `page.route` does **not** intercept `file://`
> requests, so it is unusable here. Wrapping `window.fetch` in the page is the
> mechanism that actually works under the `file://` gate, and it is strictly more
> general: it catches those relative `file://` fetches too.

Fields (declarative JSON — no inline JS):

| field | meaning |
|-------|---------|
| `urlPattern` | **required.** A URL glob (`*` within a path segment, `**` across segments, `?` a single char) or, wrapped in slashes, a regex (`"/\\/api\\/map$/"`). Anchored and matched against the full request URL — under the gate that is e.g. `file:///api/map`. |
| `method` | optional. Only intercept this HTTP verb; a non-matching verb falls through to any other registered mock (or the real default). Register one `mockFetch` per verb to answer, say, `POST` create and `PUT` sync independently. |
| `status` | response status (default `200`). |
| `body` | response body. An object/array is JSON-stringified (with `Content-Type: application/json`); a string is sent verbatim. |
| `contentType` / `headers` | optional response header overrides. |

Register a `mockFetch` step **before** the step that triggers the request (so it
is ready to intercept it). Its scope is the current state only: every
`state × viewport × scheme` cell runs in its own fresh browser context, so a mock
never leaks into a later state. The shim is installed on the live page (not as an
init script), so it covers same-document (hash) routing but would not survive a
full page navigation — re-register after one if a widget ever does that.

Offline-guarded widgets: a widget may deliberately suppress *all* real network
under `file://` so a fresh offline visit never logs a console error (see
`LIBRARIES.md` §5). Installing a `mockFetch` sets a `window.__journeyMockFetch`
flag; such a widget can read it to opt a mocked journey back into its network
path (matching requests are answered in-page; an unmatched request still falls
through to the widget's real fetch) while still refusing to fetch when no mock is
present. With no `mockFetch` in a state's steps the flag is never set, so the
genuine offline path is what gets exercised.

Prefer `[data-testid=…]` selectors and roles. Avoid relying on incidental CSS classes.

## What the harness captures

For every `state × viewport × scheme` cell, into the out-dir:

- `<state>__<viewportLabel>__<scheme>.png` — full-page screenshot at
  `deviceScaleFactor: 2`, `colorScheme: scheme`, `reducedMotion: 'reduce'`.
- In `journey-report.json` — `{ state, viewport, scheme, screenshot,
  consoleErrors, pageErrors, overflow }` per cell, plus an `a11y` accessibility
  tree per state (captured once, on the light scheme) and the resolved index URL.
- `journey-ok` — sentinel (`ok` when every cell passed, `fail` otherwise).

### Determinism guarantees

- An init script runs **before** page scripts and freezes `Date.now` / `new
  Date()` to a fixed epoch and `Math.random` to a fixed seed.
- After load the harness injects a stylesheet disabling all transitions and
  animations, so screenshots are stable.
- It waits on explicit markers (`#widget-ready`, then `expect`) — never a
  settle-timeout. A flaky harness is a failed deliverable.

Widgets that fetch at runtime must keep the offline render path working (see
`LIBRARIES.md` §5): under `file://` there is no network, so guard remote calls
and avoid leaving a transient spinner in the captured frame.

## Running it

```sh
# authoritative source/metadata/theme-ownership validation (run from repository root)
node scripts/validate-widgets.mjs

# build the widget first (produces dist/)
cd widgets/<slug> && npm ci && npm run build && cd ../..

# first-paint gate
node scripts/render.cjs widgets/<slug>/dist/index.html

# journey gate (skips widgets with no journey.json)
node scripts/journey.cjs \
  "$PWD/widgets/<slug>/dist/index.html" \
  "$PWD/widgets/<slug>/journey.json" \
  "$PWD/.journey-out"

# computed/composited audit (after the same build; Playwright must be available)
NODE_PATH="$PWD/widgets/<slug>/node_modules" node scripts/audit-theme.cjs \
  <slug> "$PWD/widgets/<slug>/dist/index.html" "$PWD/.theme-audit"
```

## Theme audit contract

[`scripts/theme-audit-manifest.json`](./scripts/theme-audit-manifest.json) is
the repository-wide audit declaration. Every shipped widget has an identity
heading, functional UI, ordinary text, boundary, focus, and status surface in
the manifest. The audit fails a declared ordinary text/status surface below
14px, a measurable normal-text pair below 4.5:1, a measurable component
boundary below 3:1, missing identity/UI font roles, missing visible focus, or
standalone/200%-zoom overflow. It writes the computed inputs and unrounded
ratio to JSON for review rather than trusting static token values.

The audit additionally walks every visible direct-text element (excluding only
the manifest's named geometry exceptions), so the declaration list is a
state/boundary inventory rather than a tiny selector sample. It records an
unrounded WCAG ratio and APCA Lc for every measurable text pair. WCAG remains
the release gate; APCA is the supplementary house-style signal.

The required evidence matrix is 390×844, 768×1024 and 1280×800, light and dark,
standalone and embedded. `journey.cjs` retains the state-specific screenshots,
accessibility tree and overflow result; the theme audit's JSON records the
computed/composited values, font roles, focus/boundary checks and its explicit
manual-surface checklist. Store both reports and their galleries in the final
validation output. Do not substitute initial-page results for a journey state.

The named density exceptions are not a waiver for controls, instructions,
errors, or state. Each has a selector, rationale, opaque stable surface, and
200%-zoom journey evidence. Map/image/gradient surfaces deliberately have no
invented CSS ratio: their checklist entry must be marked pass with the reviewed
screenshot evidence, otherwise the audit fails.

The spec is also shape-checked by `node scripts/validate-widgets.mjs` whenever a
`journey.json` is present, and CI runs both gates in
`.github/workflows/check-widgets.yml`.

## Local theme ownership

The six independently built widgets deliberately duplicate their theme
primitives. Each widget owns a regular `widgets/<slug>/src/theme.css`, and its
`src/main.tsx` imports that file exactly once as `./theme.css`. This is the
runtime ownership model: there is no shared theme stylesheet, shared theme
package, or cross-widget theme import.

`node scripts/validate-widgets.mjs` is the authoritative repository check for
that contract. It requires exactly the six local theme files and entrypoint
imports, rejects `shared/theme.css`, and rejects source imports that resolve
into `shared/` or another widget. `scripts/audit-theme.cjs` repeats those
ownership checks before auditing a built widget and requires the audit manifest
to cover the same six widgets.
