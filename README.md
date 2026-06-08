# beshir-widgets

A collection of independent, iframe-embeddable web widgets. Each widget is a self-contained React+Vite app deployed automatically to its own subdomain on Cloudflare Workers via GitHub Actions. Widgets are designed to be embedded in any page without coordination with the host origin.

## Widget index

| Widget | Live URL | Description |
|---|---|---|
| function-plotter | https://function-plotter.widgets.beshir.org | Plot any function of x. |

## Embedding

```html
<iframe src="https://function-plotter.widgets.beshir.org" loading="lazy" style="width:100%;height:400px;border:0"></iframe>
```

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
