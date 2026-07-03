# Pennsic Mapper

A camp-map browser and shareable personal map for **Pennsic War 53** (2026), embedded as a
single-page Preact widget served via Cloudflare Workers, with a map API backed by Cloudflare D1.

## Features

- **Base map** — an original, hand-authored parchment-style schematic evoking the publicly
  documented general layout of the Pennsic War site (lake, battlefield, merchants'/A&S row,
  lettered entrance gates, kingdom-camping rings). See *Base-map provenance* below.
- **Pins** — click anywhere on the map to drop a coloured, labelled pin (camp, gate, landmark,
  meetup spot, whatever you like). Drag to reposition, click to relabel/recolour/delete.
- **Legend** — every pin listed as swatch + label; clicking a row jumps to that pin on the map.
- **Shareable maps** — see *Storage* below. Start a map, get a private edit link and a
  read-only share link; anyone with the share link can view it and duplicate it into their own
  editable copy.
- **Dark mode** — full `prefers-color-scheme: dark` theme, including a separate dark variant of
  the base map; transitions respect `prefers-reduced-motion`.
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

Adding a future Pennsic without breaking existing maps or URLs:

1. Bundle the new base-map SVGs and add an entry to `src/data/events.ts`.
2. Insert an `events` row with `is_default = 1` (and clear the old default).
3. Update `DEFAULT_EVENT_ID` in `src/data/events.ts` and `worker/index.ts` to match.

### Offline / local-first behaviour

Starting a map and every pin edit happen **locally first** — the widget never has to reach the
network to go from an empty map to a populated one. A brand-new map has no server id until a
background request succeeds, so the edit/share links render **disabled**, with a caption
("Links appear once your map is saved online.") until that completes. In production this
happens moments after you start a map; the app then swaps `location.hash` to the real edit link
automatically. No pin edit is ever silently dropped: if a save fails or races another writer, the
widget reloads the server's copy and surfaces that your last change may not have been saved.

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

`src/assets/basemap-light.svg` and `src/assets/basemap-dark.svg` are original, hand-authored
schematic illustrations. They evoke the *publicly documented* general layout of the Pennsic War
site — a lake, a battlefield, a merchants'/A&S row, several lettered entrance gates, and
concentric kingdom-camping rings — which are non-copyrightable **layout facts** shared across
countless public maps, trip reports, and camp-planning threads, not a trace or derivative of any
specific copyrighted cartography. No third-party map image or geodata file is bundled or fetched
at runtime. See `widget.json → dataSources` for the same note.

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
  style="width:100%;height:720px;border:0"
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
