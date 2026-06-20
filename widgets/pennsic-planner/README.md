# Pennsic Planner

A schedule browser and shareable personal planner for **Pennsic War 53** (2026), embedded
as a single-page Preact widget served via Cloudflare Workers, with a calendar API backed by
Cloudflare D1.

## Features

- **Timetable** — 14-day browser with a wrapping day-tab selector and a time-grouped,
  responsive session grid that fills the width and never scrolls horizontally, however many
  classes overlap. Opens on the busiest day by default.
- **Filters** — multi-select track chips with a searchable dropdown, location select, and
  full-text search across title / instructor / description. Result count updates live.
- **Session detail** — click any session to open a lightbox with the full description,
  instructor, fees, conflict note, and other occurrences of the same class; a ☆ toggle adds
  or removes it from your calendar.
- **My Calendar** — your picks rendered as a proportional time-grid, one column per planned
  day, laid out side by side on wide displays and stacked on narrow ones, with time-conflict
  highlighting. The Timetable tab also shows a current-day plan sidebar on wide displays.
- **Shareable calendars** — see *Storage* below. Create a calendar, get a private edit link
  and a read-only share link; anyone with the share link can view it and duplicate it into
  their own editable copy.
- **Calendar export (.ics)** — downloads a standards-compliant iCalendar file (one `VEVENT`
  per planned session) with a self-contained `VTIMEZONE` for `America/New_York`, so events
  land at the correct Eastern wall-clock time in Google Calendar, Apple Calendar, and Outlook.
- **Accessibility** — interactive elements carry `aria-label`; the day selector is an ARIA
  tablist with roving tabindex; the detail lightbox is a focus-trapped modal dialog.
- **Dark mode** — full `prefers-color-scheme: dark` theme; transitions respect
  `prefers-reduced-motion`.
- **Iframe-ready** — sends `{ type: "resize", height }` to `window.parent` via
  `ResizeObserver` for auto-height embedding.

## Storage

Calendars are **remote-by-default**, stored in Cloudflare D1 and reached by capability URLs.
There is no durable local plan: `localStorage` holds only a non-authoritative "your calendars
on this device" shortcut list, so clearing it loses the shortcuts, never a calendar.

- **Edit URL** `…/#/c/<id>/<secret>` — the secret lives in the URL fragment, so it never
  reaches the server or its logs. Grants editing.
- **Share URL** `…/#/c/<id>` — read-only view, with a "Duplicate to edit" action.

The data model is **event-keyed**. A calendar row carries an `event_id`; the URL never does.
New calendars attach to the default event (`pennsic-53`). A calendar stores **session ids
only**, so refreshing the bundled schedule correctly drops picks whose sessions changed.

Adding a future Pennsic without breaking existing calendars or URLs:

1. Bundle the new schedule JSON and add an entry to `src/data/events.ts`.
2. Insert an `events` row with `is_default = 1` (and clear the old default).
3. Update `DEFAULT_EVENT_ID` in `src/data/events.ts` and `worker/index.ts` to match.

### API (`worker/index.ts`)

| Route | Purpose |
|---|---|
| `POST /api/calendar` | Create; returns `{ id, editSecret, eventId }`. |
| `GET /api/calendar/:id` | Read; returns the calendar (never the secret hash). |
| `PUT /api/calendar/:id` | Edit; `Authorization: Bearer <secret>` + `If-Match: <rev>`. |

Only the SHA-256 hash of the edit secret is stored, compared in constant time; edits use
optimistic concurrency (`If-Match` + a conditional `UPDATE … WHERE rev = ?`).

`src/store.ts` exposes the `PlanStore` seam; `RemotePlanStore` is the D1-backed
implementation the UI talks to. The UI never touches `localStorage` or the API directly.

### One-time Cloudflare setup

The widget is **not functional until the D1 database exists**. Once:

```bash
cd widgets/pennsic-planner

# 1. Create the database (name must match wrangler.jsonc).
npx wrangler d1 create widget-pennsic-planner

# 2. Paste the returned database_id into wrangler.jsonc → d1_databases[0].database_id,
#    replacing REPLACE_WITH_D1_DATABASE_ID.

# 3. Create the tables and seed the pennsic-53 event.
npx wrangler d1 execute widget-pennsic-planner --remote --file=./schema.sql
```

The deploy token also needs **D1 → Edit**. Because `POST /api/calendar` is unauthenticated
by design, add a Cloudflare WAF rate-limiting rule on `/api/calendar` for the widget's
hostname (e.g. ~30 requests/minute per IP) to cap abusive creation.

## Data

| | |
|---|---|
| **Bundled schedule** | `src/data/sessions-2026.json` — 1,836 sessions, normalized from the official Pennsic 53 CSV export captured 2026-06-17. Bundled at build time; the schedule renders fully offline. |
| **Validator fixture** | `src/data/sample-2026.json` (60 records), referenced by `widget.json → data.sample`. |

Schedule refreshes are a repo change, not an in-app upload: regenerate the bundled JSON with
`maintenance/normalize.mjs` from a fresh
[thing.pennsicuniversity.org](https://thing.pennsicuniversity.org/) calendars CSV and commit.

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

# Run the test suite (Worker/D1 via vitest-pool-workers, .ics, normalizer)
npm test
```

The build bundles the entire 1,836-session dataset as a static asset
(`chunkSizeWarningLimit` is raised accordingly).

## Embed

```html
<iframe
  src="https://pennsic-planner.widgets.beshir.org"
  loading="lazy"
  style="width:100%;height:760px;border:0"
></iframe>
```

Add `id="pennsic-planner-frame"` and listen for `{ type: "resize", height }` messages to
implement automatic height adjustment:

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'resize') {
    document.getElementById('pennsic-planner-frame').style.height = e.data.height + 'px';
  }
});
```

## Deployment

The widget deploys as a Cloudflare Worker (`widget-pennsic-planner`) serving static assets
from `dist/` and the `/api/*` calendar routes (`run_worker_first`). See `wrangler.jsonc` for
the route, domain, assets, and D1 binding. After the one-time D1 setup above, `npm run build`
then `npx wrangler deploy`.
