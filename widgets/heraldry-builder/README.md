# Heraldry Builder

Design rule-checked heraldic arms from a fixed menu of tinctures, ordinaries and charges, read the
auto-generated blazon, and register them in a searchable community armorial. A single-page Preact
widget served via Cloudflare Workers, with a registry API backed by Cloudflare D1.

## Overview

- **Builder.** Pick a field (plain or one of seven divisions), an optional ordinary (ten) and an
  optional group of 1–12 charges (28 charges, 40 drawings with postures; counts above six sit
  behind **More…**). The default flow is three steps, Background → Band or shape → Picture; a
  fourth card appears only when it applies: extra pictures on the band (or on a chief), or a
  top band (chief) and a border (bordure) beside the band, with or without pictures. Every option is
  checked against the **rule of tincture** (SENA A3B, below) and against the structural rules
  (legal counts, arrangements and placements, laid out by capacity). Options that would break a
  rule stay visible but are marked blocked, with an explanation. On a divided field charges can
  be **counterchanged** (each takes the field's other tincture), so every count and arrangement
  the builder offers has at least one legal tincture, and a rule-of-tincture violation always
  comes with a one-click fix.
- **Blazon.** The formal blazon ("Azure, on a bend Or three unicorns rampant Vert") and a
  plain-English gloss are generated from the structured design, never typed by hand, in
  SCA house style (Table 7 default arrangements are left unsaid, other arrangements always
  stated; the SCA's default postures likewise).
- **Registry.** Each community (a *registry*, e.g. one group of friends) keeps its own
  armorial. Registering checks the design against every entry: an exact duplicate is refused, and so
  is a design that is "too close": one that conflicts under the SCA's rules (SENA A5), which
  need one substantial change or two distinct changes from every registered design. Anyone can search the registry by
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

**Design.** Above the builder sit a dismissable welcome strip, a small folding **Examples** box (example arms as small shields, each named by its caption in the accessible name and tooltip; open on a device's first visit, folded on later ones, remembered in `localStorage` and folded when storage is unavailable) and an always-visible **Surprise me** button. Loading an example or a surprise replaces the design with an Undo notice. The left column (sticky on wide screens while it fits the viewport) holds the live shield, a Hatching switch, the Shape picker (see Field shapes below), the blazon and plain-English gloss, the readability meter and the Check availability / Register… actions. The right column holds the builder: step 1 **Background** (field), step 2 **Band or shape** (ordinary) and step 3 **Picture** (charge: kind, count with **More…** above six, where it goes, layout, pose with the SCA's default marked, a **With a face (in splendour)** switch for the sun, colour). Under them a quiet secondary row offers the extra layer when it is legal: **+ Add pictures on the band** (a second group of pictures drawn on the band, top bar or border, with its own count, layout, pose and colour, and **Remove these pictures**), **+ Add a top band (chief)** and **+ Add a border (bordure)** (a chief and a bordure beside the band, one of each, together with the pictures: the pictures are refitted to the room they leave, so a layer is offered only when something fits), once a top band or border is there **+ Add pictures on the top bar** and **+ Add pictures on the border** (charges drawn on it: on the border they are small, evenly spaced along its middle, one to twelve, and upright), beside a band or a picture on the background **+ Add pictures along the top (in chief)**, **along the bottom (in base)** or **a picture in the top corner (in canton)** (one such group, never beside pictures set around the band: the picture keeps clear of the room they take; they stand in a row, or in chief and in base also in rows such as two and one, and two long charges crossed), on the picture on the background (not one set around a band) **+ Add pictures on the picture** ("on a heart argent a lion azure", "a unicorn argent charged with a fleur-de-lys", "three flames each charged with a heart": one to four charges on each picture, laid out in the rectangle the picture's drawing offers; one or two on a lion, three or four on a heart or sun; a key, sword, anchor, musical note or cogwheel carries none, and a sun in splendour none), and around a picture on the background with no band **+ Add pictures around the picture** ("a lion between three mullets": two to eight of them — three two above and one below, two on each side or above and below, four in the corners or in a cross, five to eight in a ring round the edge — around one picture, or two side by side, one above the other or crossed, which keep to a box in the middle; one such group beside or around the picture), and beside a band or a picture on the background **+ Add a band or picture across everything (overall)** ("a fess and overall a lion", "a lion and overall a bend", "a rose and overall two swords in saltire": one group, a picture over a band, a band — fess, pale, bend, bend sinister, chevron, cross or saltire — over a picture, or a sword or other long charge over a picture; one charge, or two long charges crossed; drawn over the band or picture but under a top band and a border; its card has a list of what goes across, with the choices SENA App I4 does not allow greyed out and explained), and on the background beside a picture that has no band, pictures around it, or pictures on it **+ Add a second main picture beside the picture** ("a unicorn argent and a rose gules", "two fleurs-de-lys argent and a rose purpure": two groups of pictures that are together the main picture, three pictures at most between them, laid out as one group — one in each part of a field split in two, two and one for three, otherwise side by side, one above the other or along a diagonal; the first picture takes the first place, and the same arrangement applies to both). Step 4 is then a card for each layer (**Remove the top band**, its colour). A layer that can't be drawn (no room, no colour that works, a host that can't carry it) is never offered; the builder keeps what you have chosen and only drops a top band or border when it is what the builder can't draw beside a new band. Options that would break the rule of tincture (or are structurally illegal) stay visible but are marked blocked; pressing one opens an explanation instead of applying it. A lower-layer change that breaks the design shows a violation panel (with a one-click fix when one exists) and disables Check and Register. The Field and Band or shape tiles show the heraldic term under the icon ("Per pale", "Fess"), with the everyday words ("Split down the middle") in the tooltip and the accessible name; the collapsed step summaries and other labels lead with the everyday words. On narrow screens the charge picker uses compact icon-only tiles (names are in the accessible name, the tooltip and a "Selected:" line).

**Check availability** shows an inline result: *Available*, *Already registered* or *Too close*, the last two with the conflicting mini shield, its name and blazon, the differences, and what to change. **Register…** opens a dialog (a bottom sheet on mobile) with a display name (public), an email address (required, private: "Used only to send you your edit/withdraw link. Never shown publicly.") and an optional Discord username (public), inline per-field errors using the same validators as the Worker, and a "What's public?" popover. A server 409 (duplicate / too close) is rendered with the same panel; an offline copy says the registry can't be reached. Success puts the share link first with a primary **Copy share link** button; the edit link sits below in a distinct "Secret edit link — don't share" box (lock icon, masked after 20 characters, Show and **Copy edit link** buttons), followed by a line saying whether it was emailed ("We've emailed it to you at the address you gave", or a clear note to save it now when sending failed or isn't configured). The address shown is what the user typed in this dialog; the API never returns it. The entry is also kept under Your arms on this device.

**Registry.** A "Registry" heading, the entry count and an "Offline sample" badge; a search box (plain-English words: name, colour, charge), selects for kind of charge, charge, posture, ordinary, field, field colour, tincture and charge tincture, removable filter chips and Clear filters, a Refresh button, a card grid (shield, name, plain-English description, blazon) and Show more. A card opens an entry sheet (big shield, blazon, gloss, name, the public Discord username as plain text with a Copy button, share link, **Load into builder**, a quieter "Print a nametag" text link, and the "Lost your link? / Withdraw my registration" link). Failure shows an error panel with Retry and Show offline sample (production never silently swaps to the sample).

**Entry and owner links.** `#/a/<id>` is the public entry page. `#/a/<id>/<secret>` is the owner view. It checks the secret on load (`GET /api/arms/:id/owner`), so a truncated or replaced link shows "This edit link doesn't work" with a way to get a new one instead of a form that fails on Save, and a working link is remembered under Your arms on this device. The owner can edit the display name, Discord username (blank removes it) and display shape (sent with `If-Match`; a stale revision says the entry changed elsewhere and offers Reload), copy the edit link from the same masked secret box, or Withdraw (confirm dialog: "the design is free to register again"). The secret stays in the URL fragment.

**Nametag sheet.** `#/print/<id>` is a printable A4 sheet of cut-out nametags for one entry (shield in its shape, display name, blazon), with the tag printed once or repeated to fill the page (the default). On screen it previews the paper in light colours; Print opens the browser's print dialog and Back returns to the page it was opened from (the entry, when the sheet was opened directly). It is linked only from the entry page and sheet ("Print a nametag"). A bare `#/print` opens Your arms.

**Lost your link? / Withdraw my registration.** Linked from the header and the entry sheet. `#/recover` asks for the email address and always answers "If that address owns any arms, we've sent it a link". `#/recover/<token>` (the emailed link) shows the entry and waits for an explicit click: **Get a new edit link** (shows the new link in the secret box and remembers it on this device; the old link stops working) or **Withdraw this registration** (confirm dialog). Used, expired and malformed links say so and link back to `#/recover`. See Email and recovery below.

**States** (`data-widget-state` on `<html>`): Design — `ready`, `populated`, `error`; Registry — `loading`, `populated`, `empty`, `error`; Your arms — `populated` or `empty`. Dialogs and sheets keep the underlying tab's state.

**Test ids.** Tabs `tab-design|registry|yours`; builder options `shape-heater|banner|round|lozenge` (group `shape-select`), `field-kind-plain`, `division-*`, `ordinary-*`, `charge-*`, `count-N` (above six inside `count-more`, whose options are `count-more-select`), `placement-*`, `swatch-<part>-<tincture>` (charges also `swatch-charge-counterchanged`), `posture-select`, `arrangement-select`, `splendour-toggle`; the layer chooser `add-layer-toggle` and its buttons `add-layer-<co-primary|on-picture|around|in-chief|in-base|in-canton|on-ordinary|chief|on-chief|bordure|on-bordure|overall>`, `remove-layer-<…>`, the steps `step-field|ordinary|charges` and `step-layer-<co-primary|on-picture|around|in-chief|in-base|in-canton|on-ordinary|chief|on-chief|bordure|on-bordure|overall>`, `chief-tincture`, `bordure-tincture`, and for the second main picture, the pictures on the picture, around it, in chief, base or canton, on the band, the top band and the border the same controls under a `co-primary-`, `on-picture-`, `around-`, `in-chief-`, `in-base-`, `in-canton-`, `on-ordinary-`, `on-chief-` or `on-bordure-` prefix (and, for what lies overall, `overall-item-select` with `overall-tincture` for a band, or the picture controls under `overall-` for a picture; for the others `on-ordinary-charge-select`, `on-ordinary-count-N`, `on-ordinary-arrangement-select`, `on-ordinary-posture-select`, `on-ordinary-splendour-toggle`, `on-ordinary-charge-tincture`, `swatch-on-ordinary-charge-<tincture>`); status `blazon`, `gloss`, `violation-panel`, `tincture-explainer`; actions `check-availability`, `open-register`; results `availability-ok|duplicate|too-close|error`; register `register-dialog`, `register-name`, `register-email`, `register-discord`, `register-name-error|email-error|discord-error`, `register-error`, `public-info-button`, `public-info-popover`, `register-submit`, `register-success`, `share-link`, `copy-share-link`, `edit-link` (inside `edit-link-box`, with `copy-edit-link`, `reveal-edit-link`), `register-mail-status` (`data-outcome` sent|failed|disabled); registry `registry-search`, `filter-category|charge|posture|ordinary|division|field-tincture|tincture|charge-tincture`, `clear-filters`, `registry-refresh`, `registry-loading`, `registry-empty`, `registry-error`, `registry-retry`, `registry-show-sample`, `registry-more`, `result-card`, `entry-sheet`, `load-into-builder`, `print-nametag`, `entry-discord`, `copy-entry-discord`, `entry-recover-link`; owner `owner-name`, `owner-discord`, `owner-shape-<shape>`, `owner-save`, `owner-withdraw`, `withdraw-confirm`, `owner-stale`, `owner-denied`, `owner-edit-link`; recovery `header-recover-link`, `recover-view`, `recover-email`, `recover-email-error`, `recover-submit`, `recover-sent`, `recover-offline`, `redeem-view`, `redeem-new-link`, `redeem-withdraw`, `redeem-withdraw-confirm`, `redeem-recovered`, `redeem-edit-link`, `redeem-withdrawn`, `redeem-link-error` (`data-code`); nametag sheet `print-view`, `print-count`, `print-copies-one|fill`, `nametag`, `print-now`, `print-back`.

**Keyboard.** Tab order follows the page; radio-style option groups are one tab stop with arrow keys moving and selecting (blocked options can be focused and explain themselves on Enter/Space). Dialogs and sheets trap focus, Escape closes only the topmost layer (a popover inside a dialog closes first), and focus returns to the opener. Animations are off under `prefers-reduced-motion`.

## Field shapes

Arms can be displayed on a **heater shield** (the default), a **square banner**, a **round** or a
**lozenge**. The shape is display only: it is chosen with the Shape picker under the preview ("just
for display; doesn't change your arms"), saved with the draft, sent with a registration or edit,
stored in its own `field_shape` column and drawn wherever the entry appears (cards, entry page,
owner view, conflicts, Your arms). It is never part of the design JSON, the blazon, the gloss, the
signature, the tags or the "too close" comparison, so two designs that differ only in shape are the
same arms (a duplicate). The owner can change it later without a uniqueness re-check.

All four shapes share the 100 × 120 viewBox (`src/lib/heraldry/geometry.ts`). Each shape has its
own outline, bordure inset (the outline moved inwards), fess point, chief depth and pile; partition
lines and the fess, pale, bend, chevron, cross and saltire are built the same way around the shape's
fess point and clipped to its outline. Charge slots for the banner, round and lozenge
(`shape-slots.ts`) are the heater's tables spread, shifted and sized to fit each shape.

**Validity is shape-independent.** The rule of tincture is judged on the canonical heater layout
only, so every shape gives a design the same verdict, issues, fix suggestions and option locks.
`test/shape-verdict.test.ts` checks this for the sample registry, the validation examples, rule-
breaking designs and generated designs, and also that judging the drawing in each shape gives every
charge its canonical verdict. `test/geometry-fit.test.ts` checks, per shape, that every drawing in
every slot stays inside the outline (with margin), on or clear of its ordinary, and clear of its
neighbours, and that each slot lies on the same parts of a divided field as its heater slot.

Old drafts (saved before shapes existed) and requests without a `shape` use the heater shield.

## Tinctures and hatching

Eight tinctures: three metals and five colours. The rule of tincture follows the SCA's (SENA A3B,
RULES §A): everything placed on the field (primary, secondary and peripheral groups) must have
good contrast with the part of the field it lies on, and a tertiary group with the group it lies
on. Good contrast is a metal with a colour; metal on metal, colour on colour and the same
tincture twice are poor contrast. Divided fields follow the same walk part by part, by area (SENA
A3B1): each charge and band is sampled over the parts it lies on, and a ground counts as metal or
colour once two thirds of it is (`GROUND_CLASS_SHARE`, a herald question); below that it is neutral
and contrasts with both. So a bend Or on quarterly argent and gules, 87% on argent, is metal on
metal, while a charge set across a per pale line is fine in any tincture the field doesn't use
(touching a part of its own tincture always fails). A charge alone in the centre is judged at the
fess point however far a chief pushes it down, and a band on a field divided along its own line
(a chevron on per chevron) lies over the line. A bordure and a chief are placed on the field like
any charge (the only exception SENA makes for peripherals, an augmentation, is not built).
Charges that share a tincture with one part of a divided field go into the other part (GoT Table
7); where the builder has no such layout (per bend, per pale, quarterly…) the design is reported as
not available yet rather than as a violation. The builder shows the rule as "a colour goes on a
metal and a metal on a colour".

| Tincture | Class | Gloss | Fill | Petra Sancta hatching |
|---|---|---|---|---|
| Or | metal | gold | `#F2C230` | dots |
| Argent | metal | white | `#FFFFFF` | plain |
| **Celestine** (non-standard) | metal | sky blue (celestine) | `#3CBDE0` | wavy horizontal lines |
| Azure | colour | blue | `#1F5FBF` | horizontal lines |
| Gules | colour | red | `#D0202E` | vertical lines |
| Vert | colour | green | `#1E8B3A` | diagonal lines (top-left to bottom-right) |
| Purpure | colour | purple | `#7B3F98` | diagonal lines (top-right to bottom-left) |
| Sable | colour | black | `#141414` | horizontal and vertical grid |

**Celestine** is a cyan treated as a metal: the one new tincture proposed for modern heraldry,
named after its single historical example. Celestine on any colour is fine; on Or, Argent or
Celestine it is metal on metal. The tincture picker lists it with the metals, labels it
"Non-standard" on its swatch and in its accessible name. Its
fill is a mid cyan, far lighter than Azure and clearly coloured against Argent (CIEDE2000 34.5
and 28.7), identical in both themes like every fill. Its signature code is `ce`.

**Hatching convention for celestine.** Tradition gives celestine no hatching, so the widget uses
**wavy horizontal lines** (one full wave per pitch, about half a pitch from crest to trough), in
deep teal ink on the cyan. The lines run level like Azure's because celestine is a blue; the wave
says it is a different tincture. It is the only curved pattern, so it can't be read as any of the
dotted, plain or straight-line patterns. Like the others it scales its pitch on charges and keeps
a solid band of the tincture along a charge's edge.

## Counterchanged charges

On a divided field the charges may be **counterchanged**: each charge — or each part of one that
crosses a partition line — takes the field's other tincture. "Per pale Or and Azure, three mullets
counterchanged" has Azure mullets on the Or half, Or mullets on the Azure half, and a mullet across
the line drawn half in each. Every division in the builder has exactly two tinctures (quarterly and
per saltire alternate them), so "the other tincture" is always defined and counterchanging works on
all seven divisions; a charge on the centre of a quarterly field is drawn in four parts.

- **Model.** A group's paint (`Group.paint`) is a `Paint`; the builder uses a plain tincture or
  `{ "k": "counterchanged" }`, which the API accepts as the shorthand string `"counterchanged"`.
- **Where it is allowed.** For a group lying on a divided field: charges on the field, between an
  ordinary, under a chief or within a bordure, and a band or other ordinary on the field. On a
  plain field (nothing to reverse), for charges on an ordinary (not built), or for a group lying
  wholly in one part of the field (it would simply show the other tincture: choose that instead) it
  is a rule-of-tincture issue with its own message.
- **Rule of tincture (SENA A3B2).** Each part shows the other field tincture over its own, so
  every edge that touches is judged like any other: counterchanging is legal exactly when the two
  field tinctures are one metal and one colour (celestine counts as a metal). On "Per pale Or and
  Argent" counterchanged mullets are metal on metal, and on two colours colour on colour, so both
  are refused. This is SENA's text, not the College's practice: a few such arms (2016–2025) were
  registered anyway, and the SCA armorial test files them as `tincture-rule-differs`.
- **Text.** Blazon: the word replaces the tincture ("three mullets counterchanged", "a lion rampant
  counterchanged"). Gloss: "three five-pointed stars in the opposite colours of the field (blue on
  gold, gold on blue)". Signature code `cc`; tag `charge-tincture:counterchanged` (and the
  `chargeTincture=counterchanged` search filter); search finds *counterchanged*, *counterchange*,
  *counter-changed* and the gloss's *opposite colours*. Against any single tincture it is a clear
  tincture difference.
- **Readability.** It adds no tincture of its own; charges cut in two by a partition line score one
  point ("Charges split by the field line").
- **Drawing.** `counterchangedParts()` (geometry.ts) lists, per drawn slot in each shape, the
  partition regions the charge's box overlaps and the opposite tincture for each; the Shield clips
  the charge to each region and fills (and hatches) it in that tincture.

**No dead ends.** Without counterchanging, 1,950 of the field layouts on metal-and-colour divided
fields (e.g. "Per pale Or and Azure, three mullets") had every tincture blocked. The count,
placement and arrangement choices now also check that some charge tincture would be legal and are
blocked with a reason otherwise — a guard that, with counterchanging available, a test shows never
has to fire. When a design is already in a violation, the one-click fix tries a new charge tincture
(counterchanged last), then a new ordinary tincture, then both together, which always finds a way
out.

**Charges on a bend stay upright.** Heraldic convention turns charges on a bend "bendwise", but
which way depends on the charge and its posture (a beast passant walks up the bend, a sword points
up it, an upright charge rotates the other way, and a bend sinister has no settled convention), so
it would need per-charge, per-posture orientation data and fresh art fits on the narrow bend. The
builder keeps every charge upright, which reads best at nametag size, and the geometry tests check
that upright charges fit the bend in every shape.

## Storage

Registrations are **remote**: they live in Cloudflare D1 and are reached through capability URLs.
`localStorage` holds only two device-local conveniences, both written exclusively by
`src/store.ts`:

- `heraldry-builder:device-arms:v1`: the "Your arms on this device" shortcut list (id, registry,
  name, blazon, edit secret, saved time; at most 50). It is non-authoritative, so clearing it loses
  the shortcuts but never an entry.
- `heraldry-builder:draft:v1`: the unsaved builder design, autosaved so a refresh doesn't lose work.

Both are wrapped in `try/catch`; private mode or a full quota just disables them.

### Design model

A design is `{ v: 2, kind: 'arms', field, groups }` (`src/lib/heraldry/design.ts`). The field is a
recursive paint (a tincture, or a division with its parts). Each group carries an item (an
ordinary or a charge), a count, an arrangement and optional position, a paint and, in
`charged`, the groups sitting on it; its role (primary, secondary, peripheral, overall, tertiary)
and relation (between, about, position) say how it relates to the field and the other groups.
There is no cap on groups. `kind: 'badge'` (a fieldless badge) is in the type, as are furs, stains,
proper, field treatments, lines of partition and charge attributes (form, facing, orientation,
parts, holds); the builder does not draw those yet, so `resolve` accepts them and `support.ts`
reports each as an `unsupported` issue naming the gap (the SCA test files records under the same
tags). Input may be loose (shorthand paints, defaults omitted): `resolve` fills every default
(SENA Table 7 arrangements, the SCA's default postures) and puts the groups in canonical order, so
equivalent inputs have one JSON form and one signature. The builder's own space is the
"simple space": one ordinary, one picture group (on the field, between the ordinary, or on it),
extra pictures on the ordinary, a chief and a bordure beside the ordinary, each with pictures of its own, a secondary group set in chief, in base or in canton beside the ordinary or the picture (SENA App I1: beside a central element such charges are secondary; with none they are the primary group), or a secondary group set "between" the picture when it is one group of one or two charges with no band (Table 7's "around any other charge(s)" layouts), a second primary group of charges that is laid out together with the picture (SENA App I1: two groups on the field with no band between are together the primary group; up to three charges between them, in the order they are written, with the one arrangement of all of them), and a tertiary group on the picture when it is the primary charges (Table 7's "on any other charge": one to four on each, each charge's on-box in `charge-art.ts` saying where its drawing carries them; the count is per host charge). `places.ts` names every group of such a design by a structural place (`ordinary`, `picture`, `co-primary`, `on-picture`, `around`, `in-chief`, `in-base`, `in-canton`, `on-ordinary`, `chief`, `on-chief`, `bordure`, `on-bordure`, `overall`) that doesn't change when groups are added or removed, and `layers.ts` adds and removes the layers on top of the band and the picture.

### Registry-keyed model

The data model is **registry-keyed**. Every entry belongs to one row of `registries`, and
uniqueness is enforced per registry. The URL selects a registry with `?registry=<id>`; with no
parameter, the API uses the default registry (`is_default = 1`, `default` today). Tables
(created by `migrations/`):

| table | contents |
|---|---|
| `registries` | `id`, `name`, `is_default`, `created_at`. Seeded with `('default', 'Default', 1, …)`. |
| `arms` | `id`, `registry_id`, `display_name`, `contact_discord` (nullable, CHECK-constrained to a valid Discord username), the normalised `design` JSON, `field_shape` (`heater` \| `banner` \| `round` \| `lozenge`, CHECK-constrained, default `heater`; display only), `signature`, `blazon`, `readability`, the conflict key `partition_key` / `primary_key` (see Uniqueness), `search_text` (blazon + gloss + display name as lowercase words, a space at each end; never contact, email or shape), `edit_secret_hash`, `rev`, `created_at`, `updated_at`. |
| `arms_tags` | `(arms_id, registry_id, tag)`: derived search tags such as `charge:wolf`, `posture:passant`, `ordinary:bordure`, `tincture:or`, indexed on `(registry_id, tag)`. |
| `owner_emails` | `arms_id` (primary key), `email_hmac` (hex HMAC-SHA-256 of the normalised owner address), `key_version`, `created_at`. Indexed on `(email_hmac, key_version)`. Never the address. |
| `owner_tokens` | `token_hash` (SHA-256 of a recovery token), `arms_id`, `created_at`, `expires_at`, `used_at`. |

`arms_tags`, `owner_emails` and `owner_tokens` reference `arms` with `ON DELETE CASCADE`, so deleting an entry is one statement.

**Contacts.** Each contact kind is one nullable column (`contact_discord` today) and one key of
the API's `contact` object (`{ "discord": "name" | null }`), validated by one shared function
(`src/lib/heraldry/contact.ts`) in both the SPA and the Worker. Adding a kind is one
`ALTER TABLE arms ADD COLUMN contact_<kind>` migration, one key and one validator; every kind is
typed and validated separately and nothing has to parse a JSON blob.

### Uniqueness: canonical signature and "too close"

The Worker **never trusts** the client's blazon, signature or tags. On every check, registration
and edit it resolves the submitted design with the shared library: it fills every default (e.g.
five charges default to "two, two and one"), then validates the structure and the SENA rule of
tincture. It then computes everything itself:

- **Canonical signature**, e.g. `arms|az|P:o.bend:1:single:or`. Equivalent inputs normalise to the
  same signature, so you can't "blazon your way out" of a duplicate. A `UNIQUE INDEX` on
  `(registry_id, signature)` makes exact duplicates impossible, even under concurrent
  registrations (a lost race also answers `409 duplicate`).
- **"Too close" rule.** A new design must be clear of every entry in the registry under the SCA's
  rules for conflict (SENA A5): **one substantial change, or two distinct changes**. The library
  (`src/lib/heraldry/difference.ts`) aligns the two designs group by group and lists the changes:
  a different field partition, or adding, removing or changing the type of the primary group, is a
  substantial change; changes of tincture, number, arrangement, secondary and tertiary groups and the
  like are distinct changes. Types are compared by the curated `TYPE_CLASSES` table in
  `charges.ts` (each class cites its SENA or precedent source, and flags the builder's own
  readings): only a mullet and a sun, and an eagle and an owl, are one class. A counterchanged group
  is compared by the tinctures it shows over each part of the field (SENA A5G3a). Each difference comes with the SENA rule it applies, so the panel can say
  why it counts and what to change. An available design also names the first entry it only passed by
  two distinct changes. The field shape is never compared.
- **Conflict key.** A different field partition or primary group is always a substantial change, so
  the check only needs the entries that share both. Each row stores them (`partition_key`,
  `primary_key`, NULL when the field is the primary, `*` when two groups of charges are together the
  primary, which may share a type with any entry that has a primary: `keysMayConflict`), and the Worker loads just those candidates
  through the `arms_registry_conflict_keys` index, in registration order, and reports the first entry
  that is too close.
- A registry holds at most **2,000 entries** (`409 registry_full`), counted with `COUNT(*)`.

### API (`worker/index.ts`)

All responses are JSON. Errors are `{ "error": "<code>", "message": "…" }`, plus extra fields
where noted.

| Route | Purpose |
|---|---|
| `GET /api/arms?…` | Public search (parameters below) → `{ registry: {id,name}, total, offset, limit, items: [{ id, displayName, design, shape, blazon, signature, readability, createdAt }] }`. Never includes the contact. |
| `POST /api/arms/check` | `{ registry?, design }` → `200 { verdict: 'ok' \| 'duplicate' \| 'too-close', conflict?: {id, displayName, blazon, design, shape}, differences?, closest?, registry, blazon, signature, readability }`. `differences` (too-close) are `[{ attr, kind: 'sc' \| 'dc', rule, text, why, item }]` (`rule` is the SENA rule, `item` is `'ordinary'`, `'charge'` or null); `closest` (ok) is `{ conflict, differences }` for the first entry passed only by two distinct changes, else `null`. Not rate-limited. |
| `POST /api/arms` | `{ registry?, displayName, email, contact?: { discord }, design, shape? }` (shape defaults to `heater`) → `201 { id, editSecret, registry: {id,name}, rev: 1, blazon, signature, editLinkEmail: 'sent' \| 'failed' \| 'disabled' }`. The edit link is emailed before answering; the registration stands whatever `editLinkEmail` says. |
| `GET /api/arms/:id` | One entry: `{ id, registry, displayName, contact: { discord }, design, shape, blazon, signature, readability, rev, createdAt, updatedAt }`. Never the secret hash or the owner's email. |
| `GET /api/arms/:id/owner` | Owner check. `Authorization: Bearer <secret>` → `200 { id, owner: true }`; otherwise 401/403 (404 unknown entry). |
| `PUT /api/arms/:id` | Full replacement `{ displayName, contact?: { discord }, design, shape? }` (a missing contact removes it). Requires `Authorization: Bearer <secret>` and `If-Match: <rev>`. Returns the entry with `rev + 1`. |
| `DELETE /api/arms/:id` | Withdraw. Requires `Authorization: Bearer <secret>`. Returns `200 { id, withdrawn: true }`. |
| `POST /api/recover` | `{ email }` → always `202 { accepted: true, message }` (same body whether or not the address owns anything; `400` only for a malformed address). Emails recovery links in the background. |
| `POST /api/recover/lookup` | `{ token }` → `200 { entry: { id, registry, displayName, design, shape, blazon }, expiresAt }`. Does not use the token. |
| `POST /api/recover/redeem` | `{ token }` → uses the token, rotates the edit secret → `200 { id, editSecret, registry, displayName, blazon, rev }`. |
| `POST /api/recover/withdraw` | `{ token }` → uses the token, deletes the entry → `200 { id, withdrawn: true }`. |

**Search parameters** (all optional, AND-combined). Every value is validated against the library's
vocabularies, and an unknown value returns `400 bad_request` with `param`. A parameter the API does not
define returns `400 unknown_param` with `param`.

| Parameter | Matches |
|---|---|
| `registry` | Registry id (default registry when absent; unknown → `404`) |
| `charge` | Charge id, e.g. `wolf`, `fleur-de-lis` |
| `category` | Charge category: `beast`, `monster`, `bird`, `plant`, `geometric`, `object`, `modern` |
| `posture` | `rampant`, `passant`, `statant`, `sejant`, `naiant`, `haurient`, `displayed` |
| `ordinary` | `fess`, `pale`, `bend`, `bend-sinister`, `chevron`, `cross`, `saltire`, `chief`, `bordure`, `pile` |
| `division` | A division (`per-pale`, `per-fess`, `per-bend`, `per-bend-sinister`, `per-saltire`, `per-chevron`, `quarterly`) or `plain` |
| `tincture` | A tincture anywhere on the arms (`or`, `argent`, `celestine`, `azure`, `gules`, `vert`, `sable`, `purpure`) |
| `fieldTincture` | A tincture of the field (either half of a divided field) |
| `chargeTincture` | The charges' tincture, or `counterchanged` |
| `q` | Plain-English words (≤ 60 characters), all of which must match as whole words of the entry's search text (blazon, gloss, display name). Stopwords (*a, the, with, on…*) are ignored, plurals reduced (*wolves* → *wolf*), and everyday words expanded: *yellow* = *gold* = *Or*, *star* = *mullet*, *border* = *bordure*, *bird* = eagle or owl, *animal* = any beast or monster, *cyan* / *sky blue* = *Celestine*; posture words stand for their group (*walking*, *courant* or *passant* find a standing wolf too). *Or* matches only the word, never *bordure* or *Morgan*. A query with no searchable word matches nothing. |
| `limit` / `offset` | Page size 1–50 (default 24) / offset 0–5000. Results are newest first. |

The offline sample search in `src/store.ts` runs the same parameter parsing, query words and tag matching
(`src/lib/heraldry/search.ts`, `search-terms.ts`), so it behaves like the Worker.

**Error codes:**

The codes are the `API_ERROR` constants in `src/lib/heraldry/api-errors.ts`, which the Worker
produces and the app consumes.

| Code | Meaning |
|---|---|
| `unknown_param` (400) | A search parameter the API does not define; `param` names it. |
| `bad_request` (400) | Malformed body, bad search parameter, or bad If-Match. Includes `field` (`displayName`, `email`, `discord`, `shape`, `token`) for field errors and `param` for search errors. |
| `invalid_design` (400) | The design is malformed, structurally illegal, a plain field alone, or breaks the rule of tincture. Includes `issues: [{ code, at, message, slots }]` (`at` is `{ k: 'design' }`, `{ k: 'field' }` or `{ k: 'group', path }`; `code` is `shape`, `structure`, `tincture`, `generic`, or `unsupported` with a `gap` for a construct the builder doesn't draw yet). |
| `unauthorized` (401) | No edit secret. |
| `forbidden` (403) | Wrong edit secret. |
| `not_found` (404) | Unknown entry, registry or route. |
| `token_invalid` (404) | Unknown recovery token (mistyped, truncated, or its entry was withdrawn). |
| `token_used` (410) | The recovery token was already used (or another token for the entry was). |
| `token_expired` (410) | The recovery token is more than 30 minutes old. |
| `method_not_allowed` (405) | Wrong method for the route. |
| `duplicate` (409) | Exact duplicate. Includes `conflict`. |
| `too-close` (409) | No clear difference. Includes `conflict` and `differences`. Spelled like the `too-close` verdict of `/api/arms/check`. |
| `registry_full` (409) | The registry already holds 2,000 entries. |
| `conflict` (409) | Stale revision. |
| `rate_limited` (429) | Too many registrations from this IP. |
| `payload_too_large` (413) | Request body over 16 KB. |
| `internal_error` (500) | Unexpected failure. |

### Capability URLs and edits

- **Owner link** `…/#/a/<id>/<secret>`: edit the name and Discord username, or withdraw. The secret lives
  in the URL fragment, so it never reaches the server or its logs. It is sent only as an
  `Authorization: Bearer` header on edits.
- **Share link** `…/#/a/<id>`: the public entry view.

The edit secret is 32 random bytes (256-bit, base64url) and the entry id is 16 (128-bit). Only the SHA-256 hash of the edit secret is stored, compared in constant time. The order of checks
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

A registration inserts the row, its tags and its owner-email HMAC in one `DB.batch`.

`src/store.ts` is the only module that calls `fetch` (6 s timeout). Every call resolves to
`{ ok: true, … }` or `{ ok: false, kind: 'offline' | 'network' | 'http', status?, code?, message }`.
The UI never touches `localStorage` or the API directly.

### Privacy

- **Public by design.** The display name (required, 1–60 characters) and the Discord username
  (optional) are public, and the register form says so. The owner's email address is private:
  only an HMAC of it is stored (see Email and recovery), and no API returns it. No accounts, IP
  addresses or user agents are stored. The rate limiter keys on the IP but does not persist it.
- **Sanitised.** The display name is NFC-normalised, control characters and bidi override/isolate
  characters (U+202A–202E, U+2066–2069) are removed, newlines become spaces, and length is counted
  in code points. A Discord username follows Discord's rules: a leading `@` is stripped, it is
  lowercased, and it must be 2–32 characters of `a–z`, `0–9`, `_` and `.` with no `..`.
  Both are rendered only as text: never linkified.
- **No harvesting.** The contact is excluded from search and list results and from conflict
  details. It is returned only by `GET /api/arms/:id` and shown only on the entry page. There is
  no bulk export.
- **Withdrawal deletes.** `DELETE` (or a recovery link's Withdraw) removes the row and, by
  `ON DELETE CASCADE`, its tags, owner-email HMAC and recovery tokens outright (nothing is
  retained), which also frees the design for someone else.

### Email and recovery

An email address is **required** at registration. The edit link is emailed to it, and "Lost your
link? / Withdraw my registration" uses it to send the owner a fresh link.

- **Storage.** The address is normalised by trimming and lowercasing the whole address (nothing
  provider-specific: dots and `+tags` are kept), validated (one `@`, a dotted domain, at most
  254 characters) and stored only as `HMAC-SHA-256(EMAIL_HMAC_KEY, address)` with the key's
  version. The plaintext exists only in the request that sends mail; it is never stored, logged or
  returned.
- **Registration email.** Plain text: the entry's name and blazon, the edit link, how to withdraw
  (the edit page's Withdraw, or "Lost your link? / Withdraw" on the site) and the share link. It is
  sent before the response so the success screen can say whether it went (`editLinkEmail`); a
  failure never undoes the registration.
- **Recovery.** `POST /api/recover { email }` always answers 202 with the same body; the lookup
  and sending run after the response (`ctx.waitUntil`), so neither the answer nor its timing
  says whether the address owns anything. An address that owns entries gets one email listing
  every one of them, **in every registry** (the address identifies the owner, who may no longer
  have the `?registry=` link they registered from), each with its own link
  `https://…/#/recover/<token>`. An address that owns nothing gets no email.
- **Tokens.** 32 random bytes (base64url), stored only as SHA-256, valid for 30 minutes, in the
  link's **fragment** (never sent to a server or logged). Opening the link only *shows* the entry
  (`/api/recover/lookup`); the token is used by an explicit click, so mail scanners that open
  links can't burn it. Using a token is one atomic `UPDATE … SET used_at … WHERE used_at IS NULL
  AND expires_at > now`, so it works exactly once. **Get a new edit link** rotates the edit
  secret (only its hash is stored, so the old link stops working; the entry's other outstanding
  tokens are used up too); **Withdraw this registration** deletes the entry. Expired tokens are
  deleted whenever someone asks for recovery.
- **No anti-abuse machinery** (no Turnstile, join codes or extra rate limits) and no
  confirm-your-address step: whoever controls the inbox controls the entries, which is the point.

#### One-time email setup (Resend)

1. Create a [Resend](https://resend.com) account (the free plan sends 3,000 emails a month, 100 a
   day).
2. **Domains → Add domain**: add `widgets.beshir.org` (or `beshir.org`). Resend shows DNS
   records — an MX and a TXT (SPF) record on a `send.` subdomain and a TXT (DKIM) record
   `resend._domainkey` — add them in Cloudflare DNS (DNS only, not proxied), optionally with a
   DMARC TXT record `_dmarc` (`v=DMARC1; p=none;`), then press **Verify**.
3. **API Keys → Create API key** with *Sending access*, restricted to that domain.
4. Set the Worker secrets (from `widgets/heraldry-builder`):

   ```bash
   npx wrangler secret put RESEND_API_KEY      # paste the re_… key
   openssl rand -base64 32                     # generate the HMAC key; keep an offline copy
   npx wrangler secret put EMAIL_HMAC_KEY      # paste the generated key
   ```

5. `MAIL_FROM` and `EMAIL_HMAC_KEY_VERSION` are plain vars in `wrangler.jsonc`. `MAIL_FROM`
   (`Heraldry Builder <heraldry@widgets.beshir.org>`) must use the verified domain.

**Keep `EMAIL_HMAC_KEY` safe.** If it is lost or changed, the stored HMACs no longer match any
address, so "Lost your link?" stops finding existing entries (their owners still have their edit
links). `EMAIL_HMAC_KEY_VERSION` is stored beside each HMAC and recovery only matches rows of the
current version. To replace a leaked key: put the new key, bump `EMAIL_HMAC_KEY_VERSION` and
deploy; entries registered under the old version can no longer be recovered by email.

**Without `RESEND_API_KEY`** (local development) nothing is sent: each would-be email logs one
line `{"event":"mail_skipped","reason":"no_api_key","subject":…}` without the address or any
link, and registration reports `editLinkEmail: 'disabled'` so the success screen tells the user
to save the link. A failed send logs `mail_failed` with the HTTP status only.

**Local development with `wrangler dev`.** Put the secrets in `widgets/heraldry-builder/.dev.vars`
(gitignored; never commit it):

```bash
EMAIL_HMAC_KEY=any-local-value
# RESEND_API_KEY=re_…   # optional: leave out to skip sending
```

then `npm run build && npx wrangler d1 migrations apply widget-heraldry-builder --local && npx wrangler dev`.
`npm run dev` (Vite alone) has no Worker, so registry calls fail into the error state (with Show offline sample); use
`wrangler dev` for the registry flows, or open `dist/index.html` as a file for the offline sample.

### One-time Cloudflare setup

The registry is **not functional until the D1 database exists**. Do this once:

```bash
cd widgets/heraldry-builder

# 1. Create the database (name must match wrangler.jsonc).
npx wrangler d1 create widget-heraldry-builder

# 2. Make wrangler.jsonc → d1_databases[0].database_id the printed id (it already is, for the
#    production database).

# 3. Create the tables and seed the "Default" registry from the migrations.
npx wrangler d1 migrations apply widget-heraldry-builder --remote
```

The deploy token also needs **D1 → Edit**.

### Migrations

`migrations/` is the only schema source (`migrations_dir` in `wrangler.jsonc`); the tests apply the
same files to their local D1 with `readD1Migrations` / `applyD1Migrations`. Never edit an applied
migration: add the next-numbered file.

- `0001_init.sql`: the original schema (tables, indexes, the `default` registry). Every statement is
  `IF NOT EXISTS` / `OR IGNORE`, so re-running it against a database that already has these tables
  changes nothing.
- `0002_registry_integrity_and_prefilter.sql`: one default registry (unique partial index),
  `ON DELETE CASCADE` on `arms_tags` (a table rebuild that copies the rows), and the composite index
  behind the too-close lookup.
- `0003_field_shape.sql`: the `field_shape` column (`NOT NULL DEFAULT 'heater'`, CHECK-constrained to
  the four shapes). Existing rows become heater shields.
- `0004_owner_email_and_discord.sql`: drops the free-text `contact` column (in place: it has no
  index or constraint), adds the CHECK-constrained `contact_discord`, and creates `owner_emails`
  and `owner_tokens`. Production has no arms rows yet, so nothing is lost.
- `0005_search_text.sql`: the `search_text` column free-text search runs over. Existing rows get their
  name and blazon words; the Worker writes the full text (with the gloss) on every register and edit.
- `0006_similarity_groups.sql`: the `division_group`, `ordinary_group` and `charge_group` columns
  and an index over them (superseded by 0007).
- `0007_design_model.sql`: resets the registry for the current design model. It drops and recreates
  `arms`, `arms_tags`, `owner_emails` and `owner_tokens` (every registered entry is discarded; the
  production registry was deliberately thrown away) and keeps `registries`. `arms` gets
  `partition_key` and `primary_key` in place of the six component and group columns, and the
  `arms_registry_conflict_keys` index the too-close lookup uses. **Run `wrangler d1 migrations apply --remote` before deploying the Worker that needs it.**

Local database (used by `wrangler dev`):

```bash
npx wrangler d1 migrations apply widget-heraldry-builder --local
```

Production is a **manual step, run before deploying code that needs the new migration**. CI never
applies migrations:

```bash
npx wrangler d1 migrations list  widget-heraldry-builder --remote   # what is pending
npx wrangler d1 migrations apply widget-heraldry-builder --remote
```

**One-time production baseline.** Production was created from the pre-migration `schema.sql`, so it
already has the 0001 tables but no `d1_migrations` table. Record 0001 as applied once, before the
first `migrations apply --remote` (this is the table shape wrangler itself creates):

```bash
npx wrangler d1 execute widget-heraldry-builder --remote --command "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP); INSERT INTO d1_migrations(name) VALUES ('0001_init.sql');"
```

Skipping this is also safe, because 0001 is idempotent: `apply` would run it as a no-op and record it.

**Adding another registry.** There is no API for creating registries; the owner adds rows with SQL:

```bash
npx wrangler d1 execute widget-heraldry-builder --remote \
  --command "INSERT INTO registries (id, name, is_default, created_at) VALUES ('my-shire', 'The Shire of Example', 0, '2026-11-01T00:00:00Z')"
```

Link people to it with `https://heraldry-builder.widgets.beshir.org/?registry=my-shire`. To change
the default, clear the old default first and then set the new one, in that order — the database
allows only one default at a time, so setting the new row first is rejected. The first statement
only clears the old default when the new id exists, so a mistyped id changes nothing:

```bash
npx wrangler d1 execute widget-heraldry-builder --remote \
  --command "UPDATE registries SET is_default = 0 WHERE is_default = 1 AND EXISTS (SELECT 1 FROM registries WHERE id = 'my-shire'); UPDATE registries SET is_default = 1 WHERE id = 'my-shire'"
```

**Rate limiting.** `POST /api/arms` is unauthenticated by design, so registration is rate-limited
inside the Worker before the body is parsed. It uses the native `ratelimits` binding
(`CREATE_LIMITER` in `wrangler.jsonc`), 10 per minute per IP, under **`namespace_id` `1003`**.
Namespace ids are account-unique: 1001 is pennsic-planner and japanese-verb-tower, 1002 is
pennsic-mapper. No dashboard WAF rule is required. The limit is per-colo and best-effort, which is
proportionate here. Tighten it, or add a Turnstile gate on registration, if abuse ever shows up.
Checks and searches are not limited by it; a check reads only the indexed candidates for the design
(see Uniqueness), so its cost does not grow with the registry. Request bodies are capped at 16 KB
(`413 payload_too_large`, checked on `Content-Length` and again while reading).

**Logging and caching.** Workers observability is on. An unexpected failure logs one JSON line
(`unhandled_error`, route, method, error name and message) and never a body, header, email or
contact. Every API response is `Cache-Control: no-store` with `X-Content-Type-Options: nosniff`.
The widget is served only from its custom domain (`workers_dev` and `preview_urls` are off).

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
- **Sample data:** `src/data/sample-registry.json` holds 20 fictional, hand-authored entries in the
  registry `sample` ("Sample armorial (offline demo)"). A unit test checks that their blazons and
  signatures equal the generator's output byte for byte (`npm run sample:write` regenerates the file).

## Testing

```bash
# Install dependencies
npm install

# Start the Vite dev server
npm run dev

# Production build → dist/
npm run build

# Typecheck the SPA (incl. the store test), the Worker (incl. the lib and Worker tests) and the SCA test tooling
npm run typecheck

# Run all tests: heraldry library, Worker/D1 (vitest-pool-workers, local Miniflare D1), store seam,
# and the SCA armorial test (plain Node; `npx vitest run --project sca` alone)
npm test

# Rewrite the SCA ignore list (test/fixtures/sca/ignored.json) after changing the widget or test/sca/
npm run sca:ignore

# Regenerate public/favicon.ico from public/favicon.svg
npm run favicon
```

- `test/model.test.ts`, `arrangement`, `layout`, `render`, `blazon`, `gloss`, `plain-words`, `tincture`, `counterchange`, `readability`, `tags`, `search*`, `validate`, `uniqueness`, `sample-registry`: the pure library, by topic. The validation examples (`test/validation-cases.ts`) are shared.
- `test/worker.test.ts`: every API route. The migrations are applied to a local D1 before it runs; it covers:
  - create, duplicate, too-close and rule-of-tincture rejections, with forged signatures ignored
  - text sanitisation and caps, Discord normalisation and the `contact_discord` CHECK
  - registration email: required, stored only as an HMAC (the database and every response are
    searched for the address), sent through a mocked `fetch` with the edit link, failure and
    no-key paths still registering, and logs without the address or link
  - the owner check (200/401/403/404)
  - recovery: always 202 for known and unknown addresses, one email per request listing every
    owned entry with fragment links, hashed single-use 30-minute tokens, lookup without use,
    redeem rotating the secret (old link 403, new 200), expiry, and withdraw cascading
  - registry scoping, the UNIQUE race, and the 2,000-entry cap
  - check
  - search filters, `q`, pagination bounds and errors, and parity with the offline search
  - read
  - edit: 401/403/400/409, revision bump, uniqueness re-check and tag rewrite
  - withdraw, which frees the signature
  - the 429 rate-limit path
  - response headers, the 16 KB body cap, the structured error log, one default registry, tag cascade
  - the too-close candidate lookup giving the same verdicts as a full registry scan, and distinct-change verdicts
- `test/prefilter.test.ts`: the conflict key never changes a `checkUnique` verdict, over generated designs.
- `test/migrations.test.ts`: migrations apply from empty, `0001` matches the production schema (`test/fixtures/production-schema.sql`, the original `schema.sql`), re-running it is harmless, `0002`–`0006` carry rows across, and `0007` empties the arms and owner tables, keeps the registries, checks the Discord username, cascades deletes to tags and owner tables, and serves the candidate lookup from its index.
- `test/contact.test.ts`: the shared Discord and email validators.
- `test/store.test.ts`: the store's offline mode (sample search/check, offline refusal of writes,
  owner checks and recovery) and its online result mapping (register with email and Discord,
  owner check, recovery, redeem remembering the new link, withdraw forgetting it), with `fetch`
  stubbed.
- `test/sca-armorial.test.ts`: the widget against every current armory record in the SCA Ordinary &
  Armorial (`test/fixtures/sca/oanda.db`, committed unmodified for tests only; it never reaches
  `dist/`). Each record either matches a design the widget blazons identically, would register,
  draws and lets the Design tab build, or is on the ignore list with the gaps that stop it. See
  `test/fixtures/sca/README.md`.

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
domain, assets, D1, rate-limit bindings and email vars. After the one-time D1 and email setup above
(the `RESEND_API_KEY` and `EMAIL_HMAC_KEY` secrets must exist before registrations work), apply any
pending migrations (see Migrations), then run `npm run build` and `npx wrangler deploy`.

## Deferred features

The model already has a place for each of these (see Design model); the builder, blazon and
drawing do not yet, and `resolve` reports them as `unsupported` rather than guessing:

- **Fieldless badges** (`kind: 'badge'`). Planned for phase B, following SCA practice.
- **Marshalling** (impalement, quartering of two coats): out of scope; the model is designed
  without it.
- **Furs** (ermine, vair), **stains**, **proper**, **lines of partition** (wavy, indented, …),
  **field treatments** (barry, checky, semy, …) and charge attributes such as holding or
  arming and half-field positions (dexter, sinister).
- **More than the supported group combinations**: more than three charges in two main groups, three or more main groups, a band and a picture as the main ones together, charges around, on or across two main pictures, two charge groups beside the main one, more than one charge
  overall (or a pile, chief or bordure overall), tertiary charges on a secondary or overall charge (or with charges around the primary), charges in chief beside pictures set around a band, charges
  around three or more primary charges or "about" them, and positions other than in chief, in base and
  in canton for a group beside the main one. A chief and
  a bordure beside a band, with pictures on them, pictures in chief, base or canton, and pictures
  around the picture, and pictures on the picture, and a band or picture across everything are built (the extra layer cards).
- **Art** is original placeholder drawing; traceable art is under discussion.
- **Moderation:** a moderator token, hidden status and a report link. An owner withdraws their
  own entry, with the edit link or a recovery email.
- **Changing the owner's email address.** It is set at registration; there is no edit route.
- **Registry creation via the API.** The owner adds registries with SQL (see above).

## Licence of charge art

All 40 charge silhouettes in `src/lib/heraldry/charge-art.ts`, and the shield, ordinary and
partition geometry, are **original work drawn for this widget**. They are licensed with this
repository. No artwork is taken from DrawShield, Armoria, Heraldicon, Wikimedia Commons or any
other source.

How the art is drawn and shown:

- Each silhouette is one even-odd path of straight-line polygons (`M`/`L`/`Z` only), centred
  in a 100×100 box with its long axis about 86 units. Animals face dexter (the viewer's left).
- Features are at least about 8 units wide where the design allows, so limbs, antlers, rays and
  horns survive at registry-card and favicon sizes.
- Each charge has an optical `scale` in `CHARGES` (0.88–1.15). Slender charges (sword, key,
  anchor) are drawn larger and solid ones (heart, rose) smaller, so they look the same size.
  `test/geometry-fit.test.ts` checks every drawing at its scale stays on the shield, on or off
  its ordinary, and clear of its neighbours, in every slot table.
- The charge outline is a 0.75 px hairline, dropped entirely on shields under 40 px wide or
  when a charge is drawn under 24 px. With hatching on, a charge's hatch pitch follows its size,
  a solid band of its tincture is kept along its edge, and Sable hatches as a dark grey grid on
  black so it still reads dark.
