# Per-Widget Data Contract

Widgets are offline-bundled Vite SPAs deployed to Cloudflare Workers. The per-widget data contract lets future widgets consume real external data while keeping local dev and the offline E2E render fully self-contained — no runtime egress required from the agent build or validate lanes.

## Modes

- **`static`** (default) — no external data; fully self-contained. The widget ships all its data as part of the bundle (e.g. the function-plotter). No `data` block is required in `widget.json`.

- **`prebake`** — the widget needs real data, but data is fetched and normalized at build/deploy time and baked into the bundle. The widget commits a representative `sample` dataset used in dev and the offline E2E render. A `prebake` command (run by the HOST or CI via the open-egress lane, **never** by the sandboxed agent build) fetches real data and writes the `output` file. The widget code reads `output` if present and falls back to `sample`, so it always renders offline.

- **`live`** — the widget's Cloudflare Worker fetches data at runtime (Workers have egress). The committed `sample` is the offline/E2E fallback so `egress=none` rendering still passes.

## `widget.json` `data` block

```json
"data": {
  "mode": "static | prebake | live",
  "sample": "src/data/sample.json",
  "output": "src/data/data.json",
  "prebake": "npm run prebake"
}
```

Required fields per mode:

- **`static`**: `data` may be omitted entirely, or `{ "mode": "static" }`.
- **`prebake`**: requires `mode`, `sample`, `output`, `prebake`.
- **`live`**: requires `mode`, `sample`.

All paths are relative to the widget directory.

## Why this maps to our egress tiers

The agent build/validate/render lanes run with `none` or `package-managers` egress only — they cannot fetch arbitrary external data. Only the trusted host/CI (open egress) or the deployed Cloudflare Worker can reach external sources. `sample` is what makes the offline lanes work: it is always present in the repo and never fetched at build time. `prebake` keeps real data in the bundle without coupling the deploy build to runtime egress — the host fetches once and writes `output` before the deploy build runs. `live` keeps the Worker as the only runtime fetcher, with `sample` as the offline E2E fallback. This approach borrows Observable Framework's build-time "data loader" pattern without adopting the framework.

## How the build-widget pipeline handles each mode

The pipeline always builds, validates, and renders against `sample` offline. For `prebake` widgets, the host runs the `prebake` command when wiring the deploy (so `output` lands in the tree before the deploy build), then the deploy build picks it up. For `live` widgets, the pipeline ignores the `live` fetch path entirely — `sample` ensures the offline E2E render still passes. `static` widgets have no data step.

## See also

- [`LIBRARIES.md`](./LIBRARIES.md) — curated library menu and "How To Choose" guidelines.
- [`README.md`](./README.md) — project overview and default stack.
