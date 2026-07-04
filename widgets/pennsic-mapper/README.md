# Pennsic Mapper

A camp-map browser and shareable personal map for **Pennsic War 53** (2026), embedded as a
single-page Preact widget served via Cloudflare Workers, with a map API backed by Cloudflare D1.

## Features

- **Base map** — the **official Pennsic War land map** for Pennsic LIII (2026), bundled as a single
  static image and served offline. See *Base-map provenance* below.
- **Pan & zoom** — the real map is dense (block labels like `N38`, `E06`, `W17`, street names), so
  it is pan/zoomable: pinch, mouse-wheel, or drag, plus explicit **zoom-in / zoom-out / reset**
  buttons for keyboard and touch. Pins are glued to the map at every zoom level.
- **Pins** — click, tap, or keyboard-activate anywhere on the map to drop a coloured, labelled pin
  (camp, gate, landmark, meetup spot, whatever you like). Drag to reposition, click to
  relabel/recolour/delete. Pin positions are stored as normalized `[0,1]` image coordinates, so
  they stay put regardless of the current pan/zoom.
- **Legend** — every pin listed as swatch + label; clicking a row jumps to that pin on the map.
- **Map key & royal encampments** — the information blocks printed on the base map (icon/fill
  legend, Town Square area key, bus routes, credit) and the Royal Encampments kingdom→block list are
  reproduced as real, legible HTML in two collapsible panels near the map, so you never have to zoom
  in tight to read the raster print. The map image itself is left completely intact. Each royal
  encampment row is a button that pans/zooms the map to that kingdom's block and pulses it. The
  content is bundled TypeScript (`src/data/mapKey.ts`), hand-transcribed from the map — never scraped
  at runtime; the per-block coordinates are approximate centroids estimated by eye.
- **Shareable maps** — see *Storage* below. Start a map, get a private edit link and a
  read-only share link; anyone with the share link can view it and duplicate it into their own
  editable copy.
- **Dark mode** — full `prefers-color-scheme: dark` theme for all UI chrome (pins, legend, zoom
  controls, editor). The printed map keeps its native colours in both themes, presented in a framed
  card; transitions respect `prefers-reduced-motion`.
- **Iframe-ready** — sends `{ type: "resize", height }` to `window.parent` via `ResizeObserver`
  for auto-height embedding.

## Storage

Maps are **remote-by-default**, stored in Cloudflare D1 and reached by capability URLs. There is
no durable local map: `localStorage` holds only a non-authoritative "your maps on this device"
shortcut list, so clearing it loses the shortcuts, never a map.

- **Edit URL** `…/#/m/<id>/<secret>` — the secret lives in the URL fragment, so it never
  reaches the server or its logs. Grants editing.
- **Share URL** `…/#/m/<id>` — read-only view, with a "Duplicate to edit" action.

The data model is **event-keyed**. A map row carries an `event_id`; the URL never does. New maps
attach to the default event (`pennsic-53`).

Adding a future Pennsic without breaking existing maps or URLs (full steps in
[`maintenance/README.md`](./maintenance/README.md)):

1. Bundle the new year's official land-map PNG and add an entry to `src/data/events.ts`.
2. Insert an `events` row with `is_default = 1` (and clear the old default).
3. Update `DEFAULT_EVENT_ID` in `src/data/events.ts` and `worker/index.ts` to match.

### Creation gate

A fresh visit (no hash) renders a **locked, read-only preview**: the map is fully pannable and
zoomable and every reference panel (Map key, Royal encampments, Layers, Your pins) works, but pin
editing and the map name are disabled and the top bar shows a **"Create shared map"** button in
place of Share. **No D1 row exists until you click it** — a casual visitor, a bot, or someone just
poking at the map never mints a row, and there is never an "edited but not yet saved" state to lose
on a refresh.

Clicking "Create shared map" issues `POST /api/map` (default name, no pins). On success the widget
stores the returned `id` + `editSecret`, swaps `location.hash` to the real edit link, and unlocks
editing; from then on every edit debounce-syncs exactly as before, and the top bar shows the working
Share popover. On failure (offline, network error, server rejection) the preview stays put and the
button surfaces an inline error with a **Try again** retry — the page is never blanked.

Once a row exists, no pin edit is ever silently dropped: if a save fails or races another writer, the
widget reloads the server's copy and surfaces that your last change may not have been saved.

Opening an existing map (`#/m/<id>` or `#/m/<id>/<secret>`) is unaffected — it still does a real
`GET`; offline that naturally lands in the error state. The read-only "Duplicate to edit" action is
likewise an explicit, user-initiated creation (`POST` with the copied pins).

### API (`worker/index.ts`)

| Route | Purpose |
|---|---|
| `POST /api/map` | Create; returns `{ id, editSecret, eventId }`. |
| `GET /api/map/:id` | Read; returns the map (never the secret hash). |
| `PUT /api/map/:id` | Edit; `Authorization: Bearer <secret>` + `If-Match: <rev>`. |

Only the SHA-256 hash of the edit secret is stored, compared in constant time; edits use
optimistic concurrency (`If-Match` + a conditional `UPDATE … WHERE rev = ?`). Each pin is
`{ id, x, y, color, label }`, with `x`/`y` normalized `[0,1]` over the base-map image and `color`
one of the 8 fixed palette keys (`src/lib/palette.ts`).

`src/store.ts` exposes the `MapStore` seam; `RemoteMapStore` is the D1-backed implementation the
UI talks to. The UI never touches `localStorage` or the API directly.

### One-time Cloudflare setup

The widget is **not functional until the D1 database exists**. Once:

```bash
cd widgets/pennsic-mapper

# 1. Create the database (name must match wrangler.jsonc).
npx wrangler d1 create widget-pennsic-mapper

# 2. Paste the returned database_id into wrangler.jsonc → d1_databases[0].database_id,
#    replacing the placeholder.

# 3. Create the tables and seed the pennsic-53 event.
npx wrangler d1 execute widget-pennsic-mapper --remote --file=./schema.sql
```

The deploy token also needs **D1 → Edit**.

`POST /api/map` is unauthenticated by design, so creation is rate-limited inside the Worker via
the native `ratelimits` binding (`CREATE_LIMITER` in `wrangler.jsonc`, 10 creates per minute per
IP) — no dashboard WAF rule is required. The limit is per-colo and best-effort, which is
proportionate here; tighten it, or add a Turnstile bot gate on the create flow, if abuse ever
shows up.

## Base-map provenance

`src/assets/pennsic-53-official-map.png` is the **official Pennsic War land map** for Pennsic LIII
(2026) — a single 1648×2551 PNG (~570 KB), supplied for direct use by the widget's owner. It is
bundled at build time and served offline; no map image or geodata is fetched at runtime.

- **Source:** <https://land.pennsicwar.org/maps/53/pennsic_L.png> (official Pennsic War land-map
  site), captured 2026-07-03.
- **Attribution (in-image):** *Map Created by Aakin, Updated by Genoveva, Marit, Tananda.*

The map keeps its native printed colours in both light and dark themes — it is a legend-heavy,
multi-colour document, so recolouring/inverting it for dark mode would destroy legibility. In dark
mode it sits in a framed card (subtle border + padding, very mild dimming) so it doesn't glare;
hue/saturation are never touched. All other UI (pins, legend, zoom controls, editor) meets the
dark-mode contrast bar. See `widget.json → dataSources` and
[`maintenance/README.md`](./maintenance/README.md) for provenance and refresh notes.

## Dev / build

```bash
# Install dependencies
npm install

# Start the Vite dev server
npm run dev

# Production build → dist/
npm run build

# Typecheck the SPA and the Worker
npm run typecheck

# Run the test suite (Worker/D1 via vitest-pool-workers)
npm test
```

## Embed

```html
<iframe
  src="https://pennsic-mapper.widgets.beshir.org"
  loading="lazy"
  style="width:100%;height:760px;border:0"
></iframe>
```

Add `id="pennsic-mapper-frame"` and listen for `{ type: "resize", height }` messages to
implement automatic height adjustment:

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'resize') {
    document.getElementById('pennsic-mapper-frame').style.height = e.data.height + 'px';
  }
});
```

## Deployment

The widget deploys as a Cloudflare Worker (`widget-pennsic-mapper`) serving static assets from
`dist/` and the `/api/*` map routes (`run_worker_first`). See `wrangler.jsonc` for the route,
domain, assets, and D1 binding. After the one-time D1 setup above, `npm run build` then
`npx wrangler deploy`.
