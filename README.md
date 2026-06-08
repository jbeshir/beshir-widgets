# beshir-widgets

A collection of independent, iframe-embeddable web widgets. Each widget is a self-contained Vite SPA deployed automatically to its own subdomain on Cloudflare Workers via GitHub Actions. Widgets are designed to be embedded in any page without coordination with the host origin.

## Widget index

| Widget | Live URL | Description |
|---|---|---|
| function-plotter | https://function-plotter.widgets.beshir.org | Plot any function of x. |

## Embedding

```html
<iframe src="https://function-plotter.widgets.beshir.org" loading="lazy" style="width:100%;height:480px;border:0"></iframe>
```

## Default stack

- **Runtime: Preact core** (not React). Tiny, framework-agnostic libraries pair well with it; React-only packages should generally be avoided unless they justify the `preact/compat` cost.
- **Charts: Observable Plot** (`@observablehq/plot`) as the default for chart-like widgets — grammar-of-graphics, SVG output, no CDN required.
- **Target: prettiness-first within a ~100–150 KB gzip budget.** A polished widget is the goal; the lightweight Preact + modular D3/SVG tier (≈19 KB) is a deliberate choice when bytes matter (many widgets on one page, intentionally minimal embed), not the default.
- See [`LIBRARIES.md`](./LIBRARIES.md) for the curated library menu, and [`DATA.md`](./DATA.md) for the per-widget data contract (`static` / `prebake` / `live`).
- Widgets must stay **fully self-contained and offline-capable**: everything bundled by Vite, no runtime CDN, no remote fonts/scripts, no external tile/font/asset fetches at runtime.

## Per-widget convention

Each widget lives under `widgets/<slug>/` and contains:
- `package.json` — npm manifest with build scripts
- `package-lock.json` — lockfile committed to the repo
- `widget.json` — metadata: slug, title, description, build config, Cloudflare routing
- `wrangler.jsonc` — Cloudflare Workers deployment config

The slug determines the worker name (`widget-<slug>`) and the hostname (`<slug>.widgets.beshir.org`).

## CI deploys

Pushes to `main` trigger `.github/workflows/deploy-widgets.yml`, which discovers all widget directories, builds each one with `npm ci && npm run build`, and deploys via `wrangler deploy`. Pull requests trigger `.github/workflows/check-widgets.yml`, which validates all `widget.json`/`wrangler.jsonc` configs and builds each widget without deploying.

## Cloudflare setup (one-time, manual)

- Create a Cloudflare API token with account scope `Workers Scripts: Edit` plus zone scope (`beshir.org`) `Workers Routes: Edit`. Do NOT grant `DNS: Write`; `custom_domain: true` in `wrangler.jsonc` provisions DNS automatically.
- Add GitHub repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Ensure no conflicting CNAME exists on the widget hostnames before first deploy.

## New widgets

New widgets are normally scaffolded via the `build-widget` Claude skill, which copies the `function-plotter` template and customises it.
