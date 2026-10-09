# Heraldry Builder

Design rule-checked heraldic arms from a fixed menu of tinctures, ordinaries and charges, read the
auto-generated blazon, and register them in a searchable community armorial. A single-page Preact
widget served via Cloudflare Workers, with a registry API backed by Cloudflare D1.

## Overview

- **Builder.** Pick a field (plain or one of seven divisions), an optional ordinary (ten) and an
  optional group of 1–6 charges (30 charges, 42 drawings with postures). Every option is
  checked against the **rule of tincture** (metal on colour, colour on metal) and against the
  structural rules (legal counts, arrangements and placements). Options that would break a rule
  stay visible but are marked blocked, with an explanation.
- **Blazon.** The formal blazon ("Azure, on a bend Or three unicorns rampant Vert") and a
  plain-English gloss are generated from the structured design, never typed by hand.
- **Registry.** Each community (a *registry*, e.g. one group of friends) keeps its own
  armorial. Registering checks the design against every entry: an exact duplicate is refused, and so
  is a design that is "too close" (no clear difference). Anyone can search the registry by
  component: charge, posture, ordinary, field division, any tincture, charge tincture, or text.
- **No accounts.** Registering returns a private edit link (a capability URL). Keep it to edit or
  withdraw the entry later.
- **Offline-safe.** Without the network (e.g. a `file://` copy) the widget falls back to a bundled
  sample registry. Design, check and search still work there; registering doesn't.
- **Iframe-ready.** The widget sends `{ type: "resize", height }` to the parent window whenever its
  height changes (see [Embedding](#embedding)).

The domain logic (normalisation, rule of tincture, blazon, gloss, signature, tags, readability,
uniqueness, search) lives in the DOM-free library `src/lib/heraldry/`. The SPA and the Worker both
import it, so the browser's instant feedback and the server's authoritative checks are the same
code.

## UI

Three tabs (`role=tablist`; arrow keys, Home and End move between them): **Design**, **Registry**, **Your arms**.

**Design.** The left column (sticky on wide screens while it fits the viewport) holds the live shield, a Hatching switch, the blazon and plain-English gloss, the readability meter and the Check availability / Register… actions. The right column holds the Field, Ordinary and Charges steps. Options that would break the rule of tincture (or are structurally illegal) stay visible but are marked blocked; pressing one opens an explanation instead of applying it. A lower-layer change that breaks the design shows a violation panel (with a one-click fix when one exists) and disables Check and Register. On narrow screens the charge picker uses compact icon-only tiles (names are in the accessible name, the tooltip and a "Selected:" line).

**Check availability** shows an inline result: *Available*, *Already registered* or *Too close*, the last two with the conflicting mini shield, its name and blazon, the differences, and what to change. **Register…** opens a dialog (a bottom sheet on mobile) with a display name and an optional contact, both labelled "Public — anyone can see this", length counters, and a "What's public?" popover. A server 409 (duplicate / too close) is rendered with the same panel; an offline copy says the registry can't be reached. Success shows a share link and a private edit link with copy buttons and a "save this link" warning; the entry is also kept under Your arms on this device.

**Registry.** Registry name, entry count and an "Offline sample" badge; a search box (name or blazon), selects for charge, posture, ordinary, field, tincture and charge tincture, removable filter chips and Clear filters, a Refresh button, a card grid (shield, name, blazon) and Show more. A card opens an entry sheet (big shield, blazon, gloss, name, public contact as plain text, share link, **Load into builder**). Failure shows an error panel with Retry and Show offline sample (production never silently swaps to the sample).

**Entry and owner links.** `#/a/<id>` is the public entry page. `#/a/<id>/<secret>` is the owner view: edit the display name and contact (sent with `If-Match`; a stale revision says the entry changed elsewhere and offers Reload) or Withdraw (confirm dialog). The secret stays in the URL fragment.

**States** (`data-widget-state` on `<html>`): Design — `ready`, `populated`, `error`; Registry — `loading`, `populated`, `empty`, `error`; Your arms — `populated` or `empty`. Dialogs and sheets keep the underlying tab's state.

**Test ids.** Tabs `tab-design|registry|yours`; builder options `field-kind-plain`, `division-*`, `ordinary-*`, `charge-*`, `count-N`, `placement-*`, `swatch-<part>-<tincture>`, `posture-select`, `arrangement-select`; status `blazon`, `gloss`, `violation-panel`, `tincture-explainer`; actions `check-availability`, `open-register`; results `availability-ok|duplicate|too-close|error`; register `register-dialog`, `register-name`, `register-contact`, `public-info-button`, `public-info-popover`, `register-submit`, `register-success`, `share-link`, `edit-link`; registry `registry-search`, `filter-charge|posture|ordinary|division|tincture|charge-tincture`, `clear-filters`, `registry-refresh`, `registry-loading`, `registry-empty`, `registry-error`, `registry-retry`, `registry-show-sample`, `registry-more`, `result-card`, `entry-sheet`, `load-into-builder`; owner `owner-name`, `owner-contact`, `owner-save`, `owner-withdraw`, `withdraw-confirm`, `owner-stale`.

**Keyboard.** Tab order follows the page; radio-style option groups are one tab stop with arrow keys moving and selecting (blocked options can be focused and explain themselves on Enter/Space). Dialogs and sheets trap focus, Escape closes only the topmost layer (a popover inside a dialog closes first), and focus returns to the opener. Animations are off under `prefers-reduced-motion`.

## Storage

Registrations are **remote**: they live in Cloudflare D1 and are reached through capability URLs.
`localStorage` holds only two device-local conveniences, both written exclusively by
`src/store.ts`:

- `heraldry-builder:device-arms:v1`: the "Your arms on this device" shortcut list (id, registry,
  name, blazon, edit secret, saved time; at most 50). It is non-authoritative, so clearing it loses
  the shortcuts but never an entry.
- `heraldry-builder:draft:v1`: the unsaved builder design, autosaved so a refresh doesn't lose work.

Both are wrapped in `try/catch`; private mode or a full quota just disables them.

### Registry-keyed model

The data model is **registry-keyed**. Every entry belongs to one row of `registries`, and
uniqueness is enforced per registry. The URL selects a registry with `?registry=<id>`; with no
parameter, the API uses the default registry (`is_default = 1`, `default` today). Tables
(`schema.sql`):

| table | contents |
|---|---|
| `registries` | `id`, `name`, `is_default`, `created_at`. Seeded with `('default', 'Default', 1, …)`. |
| `arms` | `id`, `registry_id`, `display_name`, `contact`, the normalised `design` JSON, `signature`, `blazon`, the indexed component columns `field_division` / `ordinary` / `charge`, `readability`, `edit_secret_hash`, `rev`, `created_at`, `updated_at`. |
| `arms_tags` | `(arms_id, registry_id, tag)`: derived search tags such as `charge:wolf`, `posture:passant`, `ordinary:bordure`, `tincture:or`, indexed on `(registry_id, tag)`. |

### Uniqueness: canonical signature and "too close"

The Worker **never trusts** the client's blazon, signature or tags. On every check, registration
and edit it re-normalises the submitted design with the shared library. That means filling every
default (e.g. three charges default to "two and one") and validating the structure and the rule of
tincture. It then computes everything itself:

- **Canonical signature**, e.g. `v1|F:plain:az|O:bend:or|C:unicorn:3:ordinary:forced:rampant:vt`.
  Equivalent inputs normalise to the same signature, so you can't "blazon your way out" of a
  duplicate. A `UNIQUE INDEX` on `(registry_id, signature)` makes exact duplicates impossible,
  even under concurrent registrations (a lost race also answers `409 duplicate`).
- **"Too close" rule.** A new design needs **at least one clear difference** from every entry in
  the registry. The clear differences are:
  - field division
  - field tincture (swapping halves counts)
  - ordinary presence, type or tincture
  - charge presence, type or tincture
  - placement (on the ordinary vs around it)
  - count, unless both counts are 4 or more
  - arrangement, for the same count, when neither arrangement is forced
  - posture, when the postures are in different posture groups

  Rampant vs passant is clear. Passant vs statant is minor, and so is 4 vs 5 charges. The check
  scans the registry in registration order and reports the first conflict, with its minor
  differences listed ("posture (statant ↔ passant)"). This is deliberately more lenient than the
  SCA's rules: it is a nametag system for a community, not a kingdom armorial.
- A registry holds at most **2,000 entries** (`409 registry_full`), which also bounds the scan.

### API (`worker/index.ts`)

All responses are JSON. Errors are `{ "error": "<code>", "message": "…" }`, plus extra fields
where noted.

| Route | Purpose |
|---|---|
| `GET /api/registries` | `[{ id, name, isDefault }]` |
| `GET /api/arms?…` | Public search (parameters below) → `{ registry: {id,name}, total, offset, limit, items: [{ id, displayName, design, blazon, signature, readability, createdAt }] }`. Never includes the contact. |
| `POST /api/arms/check` | `{ registry?, design }` → `200 { verdict: 'ok' \| 'duplicate' \| 'too-close', conflict?: {id, displayName, blazon, design}, differences?, registry, blazon, signature, readability }`. Not rate-limited. |
| `POST /api/arms` | `{ registry?, displayName, contact?, design }` → `201 { id, editSecret, registry: {id,name}, rev: 1, blazon, signature }`. |
| `GET /api/arms/:id` | One entry: `{ id, registry, displayName, contact, design, blazon, signature, readability, rev, createdAt, updatedAt }`. Never the secret hash. |
| `PUT /api/arms/:id` | Full replacement `{ displayName, contact?, design }`. Requires `Authorization: Bearer <secret>` and `If-Match: <rev>`. Returns the entry with `rev + 1`. |
| `DELETE /api/arms/:id` | Withdraw. Requires `Authorization: Bearer <secret>`. Returns `200 { id, withdrawn: true }`. |

**Search parameters** (all optional, AND-combined). Every value is validated against the library's
vocabularies, and an unknown value returns `400 bad_request` with `param`.

| Parameter | Matches |
|---|---|
| `registry` | Registry id (default registry when absent; unknown → `404`) |
| `charge` | Charge id, e.g. `wolf`, `fleur-de-lis` |
| `posture` | `rampant`, `passant`, `statant`, `sejant`, `naiant`, `haurient`, `displayed` |
| `ordinary` | `fess`, `pale`, `bend`, `bend-sinister`, `chevron`, `cross`, `saltire`, `chief`, `bordure`, `pile` |
| `division` | A division (`per-pale`, `per-fess`, `per-bend`, `per-bend-sinister`, `per-saltire`, `per-chevron`, `quarterly`) or `plain` |
| `tincture` | A tincture anywhere on the arms (`or`, `argent`, `azure`, `gules`, `vert`, `sable`, `purpure`) |
| `chargeTincture` | The charges' tincture |
| `q` | Case-insensitive text in the display name or blazon (≤ 60 characters; `%` and `_` match literally) |
| `limit` / `offset` | Page size 1–50 (default 24) / offset 0–5000. Results are newest first. |

The offline sample search in `src/store.ts` runs the same parameter parsing and tag matching
(`src/lib/heraldry/search.ts`), so it behaves like the Worker.

**Error codes:**

| Code | Meaning |
|---|---|
| `bad_request` (400) | Malformed body, bad search parameter, or bad If-Match. Includes `field` for name/contact errors and `param` for search errors. |
| `invalid_design` (400) | The design is malformed, structurally illegal, a plain field alone, or breaks the rule of tincture. Includes `issues: [{ code, layer, message, slots? }]`. |
| `unauthorized` (401) | No edit secret. |
| `forbidden` (403) | Wrong edit secret. |
| `not_found` (404) | Unknown entry, registry or route. |
| `method_not_allowed` (405) | Wrong method for the route. |
| `duplicate` (409) | Exact duplicate. Includes `conflictId` and `conflict`. |
| `too_close` (409) | No clear difference. Includes `conflictId`, `conflict` and `differences`. |
| `registry_full` (409) | The registry already holds 2,000 entries. |
| `conflict` (409) | Stale revision. |
| `rate_limited` (429) | Too many registrations from this IP. |
| `internal_error` (500) | Unexpected failure. |

### Capability URLs and edits

- **Owner link** `…/#/a/<id>/<secret>`: edit the name and contact, or withdraw. The secret lives
  in the URL fragment, so it never reaches the server or its logs. It is sent only as an
  `Authorization: Bearer` header on edits.
- **Share link** `…/#/a/<id>`: the public entry view.

Only the SHA-256 hash of the edit secret is stored, compared in constant time. The order of checks
on `PUT` is:

1. `404` unknown entry
2. `401` no secret
3. `403` wrong secret
4. `400` missing or malformed `If-Match`
5. `409 conflict` stale revision
6. body and design validation
7. uniqueness re-check, excluding the entry itself, when the design changed
8. a conditional `UPDATE … WHERE id = ? AND rev = ?` plus the tag rewrite, in one `DB.batch`
   transaction

A registration inserts the row and its tags in one `DB.batch`.

`src/store.ts` is the only module that calls `fetch` (6 s timeout). Every call resolves to
`{ ok: true, … }` or `{ ok: false, kind: 'offline' | 'network' | 'http', status?, code?, message }`.
The UI never touches `localStorage` or the API directly.

### Privacy

- **Public by design.** The display name (required, 1–60 characters) and the contact (optional,
  ≤ 80 characters) are public, and the register form says so. Nothing else is collected: no
  accounts, emails, IP addresses or user agents are stored. The rate limiter keys on the IP but
  does not persist it.
- **Sanitised.** Both text fields are NFC-normalised. Control characters and bidi override/isolate
  characters (U+202A–202E, U+2066–2069) are removed, newlines become spaces, and length is counted
  in code points. They are rendered only as text: never linkified, no `mailto:`/`tel:`.
- **No harvesting.** The contact is excluded from search and list results and from conflict
  details. It is returned only by `GET /api/arms/:id`. There is no bulk export.
- **Withdrawal deletes.** `DELETE` removes the row and its tags outright (nothing is retained),
  which also frees the design for someone else.

### One-time Cloudflare setup

The registry is **not functional until the D1 database exists**. Do this once:

```bash
cd widgets/heraldry-builder

# 1. Create the database (name must match wrangler.jsonc).
npx wrangler d1 create widget-heraldry-builder

# 2. Paste the printed database_id into wrangler.jsonc → d1_databases[0].database_id,
#    replacing REPLACE_WITH_D1_DATABASE_ID.

# 3. Create the tables and seed the "Default" registry.
npx wrangler d1 execute widget-heraldry-builder --remote --file=schema.sql
```

The deploy token also needs **D1 → Edit**.

**Adding another registry.** There is no API for creating registries; the owner adds rows with SQL:

```bash
npx wrangler d1 execute widget-heraldry-builder --remote \
  --command "INSERT INTO registries (id, name, is_default, created_at) VALUES ('my-shire', 'The Shire of Example', 0, '2026-11-01T00:00:00Z')"
```

Link people to it with `https://heraldry-builder.widgets.beshir.org/?registry=my-shire`. To change
the default, set `is_default = 1` on the new row and `0` on the old one. Keep exactly one default.

**Rate limiting.** `POST /api/arms` is unauthenticated by design, so registration is rate-limited
inside the Worker before the body is parsed. It uses the native `ratelimits` binding
(`CREATE_LIMITER` in `wrangler.jsonc`), 10 per minute per IP, under **`namespace_id` `1003`**.
Namespace ids are account-unique: 1001 is pennsic-planner and japanese-verb-tower, 1002 is
pennsic-mapper. No dashboard WAF rule is required. The limit is per-colo and best-effort, which is
proportionate here. Tighten it, or add a Turnstile gate on registration, if abuse ever shows up.
Checks and searches are not limited by it.

## Data mode

`widget.json` declares `"data": { "mode": "live", "sample": "src/data/sample-registry.json" }`.
There is no external dataset: the registry *is* the users' registrations, created at runtime in
D1. No prebake is needed or wanted, because a build-time snapshot would publish people's entries
and bypass withdrawal.

- **Live (production):** registries, search, entries, checks and registrations go to the Worker. If
  a request fails or times out (~6 s), the Registry tab shows an error state with Retry and a
  **Show offline sample** action. It never silently swaps in the sample.
- **Sample fallback (offline / `file://`):** the store never touches the network. The Registry tab
  shows the bundled sample with an "Offline sample" badge, and filters run locally with the same
  tag logic. "Check availability" runs locally against the sample. "Register" explains that the
  registry can't be reached from an offline copy.
- **Sample data:** `src/data/sample-registry.json` holds 16 fictional, hand-authored entries in the
  registry `sample` ("Sample armorial (offline demo)"). A unit test checks that their blazons and
  signatures equal the generator's output byte for byte.

## Testing

```bash
# Install dependencies
npm install

# Start the Vite dev server
npm run dev

# Production build → dist/
npm run build

# Typecheck the SPA (incl. the store test) and the Worker (incl. the lib and Worker tests)
npm run typecheck

# Run all tests: heraldry library, Worker/D1 (vitest-pool-workers, local Miniflare D1), store seam
npm test

# Regenerate public/favicon.ico from public/favicon.svg
npm run favicon
```

- `test/heraldry.test.ts`: the pure library. Covers every validation example, the uniqueness
  examples, the sample fixture byte check, tags and the options helper.
- `test/worker.test.ts`: every API route. It applies `schema.sql` to a local D1 and covers:
  - create, duplicate, too-close and rule-of-tincture rejections, with forged signatures ignored
  - text sanitisation and caps
  - registry scoping, the UNIQUE race, and the 2,000-entry cap
  - check
  - search filters, `q`, pagination bounds and errors, and parity with the offline search
  - read
  - edit: 401/403/400/409, revision bump, uniqueness re-check and tag rewrite
  - withdraw, which frees the signature
  - the 429 rate-limit path
- `test/store.test.ts`: the store's offline mode (sample search/check, offline write refusal) and
  its online result mapping, with `fetch` stubbed.

No test touches the network or a real Cloudflare account.

## Embedding

```html
<iframe
  id="heraldry-builder-frame"
  src="https://heraldry-builder.widgets.beshir.org"
  loading="lazy"
  style="width:100%;height:900px;border:0"
></iframe>
```

The widget posts `{ type: "resize", height }` whenever its height changes. Listen for it to size
the frame automatically:

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'resize') {
    document.getElementById('heraldry-builder-frame').style.height = e.data.height + 'px';
  }
});
```

Add `?registry=<id>` to the `src` to embed a specific community's registry. `?embed=0` forces the
standalone (non-embedded) layout.

## Deployment

The widget deploys as a Cloudflare Worker (`widget-heraldry-builder`). It serves static assets
from `dist/` and the `/api/*` routes (`run_worker_first`). See `wrangler.jsonc` for the route,
domain, assets, D1 and rate-limit bindings. After the one-time D1 setup above, run
`npm run build` then `npx wrangler deploy`.

## Deferred features

Not in v1, by design:

- **Badges** (fieldless single charges). This is planned for v1.1; the design format reserves
  `v` and a future `kind` discriminator.
- **Marshalling** (impalement, quartering of two coats).
- **Furs** (ermine, vair), **lines of partition** (wavy, indented, …), **multiple charge
  groups**, **tertiary charges**, and the "of the field" blazon economy.
- A **strict SCA-style mode** that requires two clear differences.
- **Moderation:** a moderator token, hidden status and a report link. In v1 an owner withdraws
  their own entry, and a lost edit link has no recovery path.
- **Registry creation via the API.** The owner adds registries with SQL (see above).

## Licence of charge art

All 42 charge silhouettes in `src/lib/heraldry/charge-art.ts`, and the shield, ordinary and
partition geometry, are **original work drawn for this widget**. They are licensed with this
repository. No artwork is taken from DrawShield, Armoria, Heraldicon, Wikimedia Commons or any
other source.
