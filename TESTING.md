# Widget testing — the journey harness

Source-of-truth for the interaction-and-UX testing stage, alongside
[`LIBRARIES.md`](./LIBRARIES.md) and [`DATA.md`](./DATA.md).

Two gates run on every widget:

1. **First-paint gate** — `scripts/render.cjs` loads the built `dist/index.html`,
   waits for the `#widget-ready` marker, and takes one screenshot. Unchanged.
2. **Journey gate** — `scripts/journey.cjs` drives the widget through a matrix of
   `state × viewport × scheme` cells described by an **optional** per-widget
   sidecar `widgets/<slug>/journey.json`, capturing a screenshot per cell plus
   correctness signals. A widget with no `journey.json` skips this gate.

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
# build the widget first (produces dist/)
cd widgets/<slug> && npm install && npm run build && cd ../..

# first-paint gate
node scripts/render.cjs widgets/<slug>/dist/index.html

# journey gate (skips widgets with no journey.json)
node scripts/journey.cjs \
  "$PWD/widgets/<slug>/dist/index.html" \
  "$PWD/widgets/<slug>/journey.json" \
  "$PWD/.journey-out"
```

The spec is also shape-checked by `node scripts/validate-widgets.mjs` whenever a
`journey.json` is present, and CI runs both gates in
`.github/workflows/check-widgets.yml`.
