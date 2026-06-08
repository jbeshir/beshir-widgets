# Widget data

How a widget gets its data, recorded in its `widget.json` so the build and tooling know what to expect. Today every widget is `static`; the `prebake` and `live` modes below are conventions reserved for widgets that need external data, and are not used by any widget yet.

A widget is a static bundle served from a Cloudflare Worker and embedded in an `<iframe>`. Its data is therefore either built into the bundle or fetched over the network when the widget runs. The `data` mode records which.

## Modes

- **`static`** (default) — all data is in the bundle; nothing is fetched at runtime. The `function-plotter` is static: it computes its curve from the expression you type. Omit `data`, or set `{ "mode": "static" }`.

- **`prebake`** *(convention — not yet used by any widget)* — the widget needs real external data, but it is fetched and written into the source tree **before `npm run build`**, so the deployed bundle stays self-contained. The widget commits a representative **`sample`** file (used during local development) and a **`prebake`** command that writes the real **`output`** file; the widget loads `output` when present and falls back to `sample`.

- **`live`** *(convention — not yet used by any widget)* — the widget fetches data at runtime (for example from its Worker). The committed **`sample`** is the fallback used during local development, so the widget still renders without the network.

## `widget.json` `data` block

```json
"data": {
  "mode": "static | prebake | live",
  "sample": "src/data/sample.json",
  "output": "src/data/data.json",
  "prebake": "npm run prebake"
}
```

Required fields per mode (paths are relative to the widget directory):
- **`static`** — omit `data`, or just `{ "mode": "static" }`.
- **`prebake`** — `mode`, `sample`, `output`, `prebake`.
- **`live`** — `mode`, `sample`.

`scripts/validate-widgets.mjs` checks this shape whenever a widget includes a `data` block.

## See also
- [`LIBRARIES.md`](./LIBRARIES.md) — library menu and how to choose.
- [`README.md`](./README.md) — project overview and default stack.
