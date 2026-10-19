# Heraldry Builder

Design rule-checked heraldic arms from a fixed menu of tinctures, ordinaries and charges, read the
auto-generated blazon, and register them in a searchable community armorial. A single-page Preact
widget served via Cloudflare Workers, with a registry API backed by Cloudflare D1.

## Overview

- **Builder.** Pick a field (plain or one of seven divisions, or seven more behind "More divisions and edges…"), an optional ordinary (ten) and an
  optional group of 1–12 charges (59 charges: 37 drawn by hand in 78 drawings — postures, heads turned, heads, the wing —, the rest generated; counts above six sit
  behind **More…**). The default flow is three steps, Background → Band or shape → Picture (the Background step also has a **Badge** tile, "No background": see Fieldless badges); a
  further card appears for each layer added on demand from the "+ Add…" row (pictures on the band, a chief or a bordure,
  around, on or beside the picture, in chief, base or canton, or something overall: see Design below). Every option is
  checked against the **rule of tincture** (SENA A3B, below) and against the structural rules
  (legal counts, arrangements and placements, laid out by capacity). Options that would break a
  rule stay visible but are marked blocked, with an explanation. On a divided field charges can
  be **counterchanged** (each takes the field's other tincture), so every count and arrangement
  the builder offers has at least one legal tincture, and a rule-of-tincture violation always
  comes with a one-click fix.
- **Blazon.** The formal blazon ("Azure, on a bend Or three unicorns rampant Vert") and a
  plain-English gloss are generated from the structured design, never typed by hand, in
  SCA house style (Table 7 default arrangements are left unsaid, other arrangements always
  stated; the SCA's default postures likewise). Charges that have no contrast with one part of a
  divided field (a mullet azure on per pale argent and azure) stand in the other part, as Table 7
  forces them to, and the blazon does not say where: a field divided per pale, per bend, per bend
  sinister or quarterly puts one to three of them in dexter, sinister, or a quarter (sinister chief,
  dexter base…), as per fess and per chevron put them in chief or in base. Any field without a chief
  also lets the main charges be set "in dexter", "in sinister chief" and so on (one to four, one
  alone, two in pale or in fess, or in rows).
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

**Design.** Above the builder sit a dismissable welcome strip, a small folding **Examples** box (example arms as small shields, each named by its caption in the accessible name and tooltip; open on a device's first visit, folded on later ones, remembered in `localStorage` and folded when storage is unavailable) and an always-visible **Surprise me** button. Loading an example or a surprise replaces the design with an Undo notice. The left column (sticky on wide screens while it fits the viewport) holds the live shield, a Hatching switch, the Shape picker (see Field shapes below), the blazon and plain-English gloss, the readability meter and the Check availability / Register… actions. The right column holds the builder: step 1 **Background** (field), step 2 **Band or shape** (ordinary) and step 3 **Picture** (charge: a **Find a picture** search box (`charge-search`; typing shows the best matches first, up to 40, in `charge-search-results`), tabs for **Popular** (`POPULAR_CHARGE_IDS`, the default while no picture or a popular one is chosen) and one per kind of picture, count with **More…** above six, where it goes, layout, pose with the SCA's default marked (a head or demi charge has none: the Pose select says "No pose"), for a picture that faces one closed **Facing, turning and details…** (`charge-more`) — a **Facing** row (Facing left as drawn, Facing right: contourny; Facing out is shown blocked: not drawn), a **Head** row (Looking ahead, Looking out: guardant, Looking back: regardant — offered where the pose is drawn with the head turned so, the lion rampant, passant, statant and sejant guardant and rampant regardant, and shown blocked elsewhere; a new pose keeps the head turned only where it is drawn so) and, for two such pictures, a **Pair** row (Same way, Facing each other — combattant for beasts and monsters rampant, respectant for the rest —, Back to back: addorsed), offered for the main picture alone on the background laid side by side (in fess) or either side of a pale and blocked with its reason elsewhere; it opens by itself while the picture faces right or is a pair, a pair shows "in fess" in the Layout row (another layout sets the two the same way again), a swap keeps the facing when the new picture faces too, and a conflict note about the pose opens it —, a **With a face (in splendour)** switch for the sun, colour). Under each colour picker sits one closed **More colours and patterns…** (`<picker>-more`) for everything beyond a plain colour: a row of kinds (`<picker>-mode-<split|fur|pattern|scatter|treatment|natural>`) — Split in two, Fur, Stripes and checks, Scatter (the background and bands), Brick or scales, Natural colours (pictures that have them) — and under it the options of the kind shown; it opens by itself while the paint is one of them. The background's has no split (the division tiles are that) and, on a divided background, a switch for which part (`field-more-part-1|2`, and `3` on a field divided in three). After the step cards a quiet **+ Add pictures around, on or above** button opens the layer chooser, in three small groups (*On it*, *Around or beside it*, *Across it*), each option named after what it goes with ("Around the lion", "On the band"); one that can't be added here is greyed and says why when pressed, pictures on a top bar or border are listed once there is one, and adding a layer closes the chooser and moves focus to its new card, which has a × in its heading that removes it. The layers: pictures on the band (a second group of pictures drawn on the band, top bar or border, with its own count, layout, pose and colour), **+ Add a top band (chief)** and **+ Add a border (bordure)** (a chief and a bordure beside the band, one of each, together with the pictures: the pictures are refitted to the room they leave, so a layer is offered only when something fits), once a top band or border is there **+ Add pictures on the top bar** and **+ Add pictures on the border** (charges drawn on it: on the border they are small, evenly spaced along its middle, one to twelve, and upright), beside a band or a picture on the background **+ Add pictures along the top (in chief)**, **along the bottom (in base)** or **a picture in the top corner (in canton)** (one such group, never beside pictures set around the band: the picture keeps clear of the room they take; they stand in a row, or in chief and in base also in rows such as two and one, and two long charges crossed), on the picture on the background (not one set around a band) **+ Add pictures on the picture** ("on a heart argent a lion azure", "a unicorn argent charged with a fleur-de-lys", "three flames each charged with a heart": one to four charges on each picture, laid out in the rectangle the picture's drawing offers; one or two on a lion, three or four on a heart or sun; a key, sword, anchor, musical note or cogwheel carries none, and a sun in splendour none), and around a picture on the background with no band **+ Add pictures around the picture** ("a lion between three mullets": two to eight of them — three two above and one below, two on each side or above and below, four in the corners or in a cross, five to eight in a ring round the edge — around one picture, or two side by side, one above the other or crossed, which keep to a box in the middle; one such group beside or around the picture), and beside a band or a picture on the background **+ Add a band or picture across everything (overall)** ("a fess and overall a lion", "a lion and overall a bend", "a rose and overall two swords in saltire": one group, a picture over a band, a band — fess, pale, bend, bend sinister, chevron, cross or saltire — over a picture, or a sword or other long charge over a picture; one charge, or two long charges crossed; drawn over the band or picture but under a top band and a border; its card has a list of what goes across, with the choices SENA App I4 does not allow greyed out and explained), and on the background beside a picture that has no band, pictures around it, or pictures on it **+ Add a second main picture beside the picture** ("a unicorn argent and a rose gules", "two fleurs-de-lys argent and a rose purpure": two groups of pictures that are together the main picture, three pictures at most between them, laid out as one group — one in each part of a field split in two, two and one for three, otherwise side by side, one above the other or along a diagonal; the first picture takes the first place, and the same arrangement applies to both). Step 4 is then a card for each layer (its × labelled "Remove the top band", its colour). A band across everything, a top band or a border starts in a standard tincture no other band or picture has, while one works, so it can be told from what it crosses or meets. A layer that can't be drawn (no room, no colour that works, a host that can't carry it) is greyed in the chooser with its reason; the builder keeps what you have chosen and only drops a top band or border when it is what the builder can't draw beside a new band. Options that would break the rule of tincture (or are structurally illegal) stay visible but are marked blocked; pressing one opens an explanation instead of applying it. A lower-layer change that breaks the design shows a violation panel (with a one-click fix when one exists) and disables Check and Register. The Field and Band or shape tiles show the heraldic term under the icon ("Per pale", "Fess"), with the everyday words ("Split down the middle") in the tooltip and the accessible name; the collapsed step summaries and other labels lead with the everyday words. The picture list is the same on every screen (the Scatter picker under "More colours and patterns…" uses it too, with ids under `<picker>-semy-charge-`; its blocked pictures explain themselves when pressed); on narrow screens it uses compact icon-only tiles (names are in the accessible name, the tooltip and a "Selected:" line).

**Check availability** shows an inline result: *Available*, *Already registered* or *Too close*, the last two with the conflicting mini shield, its name and blazon, the differences, and what to change. **Register…** opens a dialog (a bottom sheet on mobile) with a display name (public), an email address (required, private: "Used only to send you your edit/withdraw link. Never shown publicly.") and an optional Discord username (public), inline per-field errors using the same validators as the Worker, and a "What's public?" popover. A server 409 (duplicate / too close) is rendered with the same panel; an offline copy says the registry can't be reached. Success puts the share link first with a primary **Copy share link** button; the edit link sits below in a distinct "Secret edit link — don't share" box (lock icon, masked after 20 characters, Show and **Copy edit link** buttons), followed by a line saying whether it was emailed ("We've emailed it to you at the address you gave", or a clear note to save it now when sending failed or isn't configured). The address shown is what the user typed in this dialog; the API never returns it. The entry is also kept under Your arms on this device.

**Registry.** A "Registry" heading, the entry count and an "Offline sample" badge; a search box (plain-English words: name, colour, charge), selects for kind of charge, charge, posture, ordinary, field, field colour, tincture and charge tincture, removable filter chips and Clear filters, a Refresh button, a card grid (shield, name, plain-English description, blazon) and Show more. A card opens an entry sheet (big shield, blazon, gloss, name, the public Discord username as plain text with a Copy button, share link, **Load into builder**, a quieter "Print a nametag" text link, and the "Lost your link? / Withdraw my registration" link). Failure shows an error panel with Retry and Show offline sample (production never silently swaps to the sample).

**Entry and owner links.** `#/a/<id>` is the public entry page. `#/a/<id>/<secret>` is the owner view. It checks the secret on load (`GET /api/arms/:id/owner`), so a truncated or replaced link shows "This edit link doesn't work" with a way to get a new one instead of a form that fails on Save, and a working link is remembered under Your arms on this device. The owner can edit the display name, Discord username (blank removes it) and display shape (sent with `If-Match`; a stale revision says the entry changed elsewhere and offers Reload), copy the edit link from the same masked secret box, or Withdraw (confirm dialog: "the design is free to register again"). The secret stays in the URL fragment.

**Nametag sheet.** `#/print/<id>` is a printable A4 sheet of cut-out nametags for one entry (shield in its shape, display name, blazon), with the tag printed once or repeated to fill the page (the default). On screen it previews the paper in light colours; Print opens the browser's print dialog and Back returns to the page it was opened from (the entry, when the sheet was opened directly). It is linked only from the entry page and sheet ("Print a nametag"). A bare `#/print` opens Your arms.

**Lost your link? / Withdraw my registration.** Linked from the header and the entry sheet. `#/recover` asks for the email address and always answers "If that address owns any arms, we've sent it a link". `#/recover/<token>` (the emailed link) shows the entry and waits for an explicit click: **Get a new edit link** (shows the new link in the secret box and remembers it on this device; the old link stops working) or **Withdraw this registration** (confirm dialog). Used, expired and malformed links say so and link back to `#/recover`. See Email and recovery below.

**States** (`data-widget-state` on `<html>`): Design — `ready`, `populated`, `error`; Registry — `loading`, `populated`, `empty`, `error`; Your arms — `populated` or `empty`. Dialogs and sheets keep the underlying tab's state.

**Test ids.** Tabs `tab-design|registry|yours`; builder options `shape-heater|banner|round|lozenge` (group `shape-select`), `field-kind-plain`, `division-*` (including `division-badge`; the seven behind `field-shape-more` are in `field-more-division-select`, and a gyronny's counts `field-pieces-6|8|12`), `ordinary-*`, `charge-<id>`, `charge-none`, `charge-search`, `charge-search-results`, `charge-tab-<popular|kind>`, `count-N` (above six inside `count-more`, whose options are `count-more-select`), `placement-*`, `swatch-<part>-<tincture>` (charges also `swatch-charge-counterchanged`), `posture-select`, `arrangement-select`, `splendour-toggle`, `charge-more` (inside it `facing-to-dexter|to-sinister|affronty` in the group `facing`, `gaze-none|guardant|regardant` in `gaze`, `pair-same|respectant|addorsed` in `pair`: `pair-respectant` is "Facing each other" whatever the charge's word; a charge that turns has the Turned row `turned-<none|palewise|fesswise|fesswise-reversed|bendwise|bendwise-inverted|bendwise-sinister|bendwise-sinister-inverted|inverted|reversed|to-center>` in the same disclosure, each chip with the picture drawn small and turned, the ways it does not take blocked with their reason; a charge with details has the nested closed `charge-details` disclosure: a star's points `points-4`…`points-12` in the group `points`, the toggles `mod-voided|fimbriated|pierced|fitchy|winged|enflamed|slipped|leaved` and `part-crowned|collared` (aria-pressed) and, while fimbriated, `mod-fimbriated-tincture` with swatches `swatch-fimbriation-<tincture>`, while a piece is on its colour `mod-winged|enflamed|slipped|leaved-tincture` or `part-crowned|collared-tincture` with swatches `swatch-<piece>-<tincture>` (flames also `mod-enflamed-proper` in `mod-enflamed-proper-select`)); paint `<picker>-more`, `<picker>-mode-<kind>`, `field-more-part-1|2|3` (the third on a field divided in three, whose third colour is `field-tincture-3`, swatches `swatch-field3-<tincture>`), furs `<picker>-fur-<ermine|vair|potent>`, `<picker>-fur-layout-<plain|counter|en-pointe>`, `<picker>-fur-colour-1|2`; the layer chooser `add-layer-toggle` and its buttons `add-layer-<co-primary|on-picture|around|in-chief|in-base|in-canton|on-ordinary|chief|on-chief|bordure|on-bordure|peripheral|overall>`, `remove-layer-<…>`, the steps `step-field|ordinary|charges` and `step-layer-<co-primary|on-picture|around|in-chief|in-base|in-canton|on-ordinary|chief|on-chief|bordure|on-bordure|peripheral-<i>|overall>`, `chief-tincture`, `bordure-tincture`, the band step's `ordinary-more-select` (`ordinary-base|point|canton|quarter|gyron|orle|tressure|flaunches|gore|pall|label|fret|mount|trimount|baton`), `ordinary-shape-sinister`, `ordinary-shape-thin`, `ordinary-number-2|3` (a tressure) and `ordinary-number-2|3|4` (thin bands), their radio groups `ordinary-number`, `field-edge-select`, `ordinary-edge-select`, `ordinary-outline-select` and `ordinary-cotise-edge-select`, for each corner or edge shape `peripheral-<i>-item-select`, `peripheral-<i>-tincture` (`swatch-peripheral-<i>-<tincture>`), `peripheral-<i>-shape-more`, `peripheral-<i>-shape-sinister`, `peripheral-<i>-number-2|3`, `peripheral-<i>-edge-<line>`, and for the second main picture, the pictures on the picture, around it, in chief, base or canton, on the band, the top band and the border the same controls under a `co-primary-`, `on-picture-`, `around-`, `in-chief-`, `in-base-`, `in-canton-`, `on-ordinary-`, `on-chief-` or `on-bordure-` prefix (and, for what lies overall, `overall-item-select` with `overall-tincture` for a band, or the picture controls under `overall-` for a picture; for the others `on-ordinary-charge-select`, `on-ordinary-count-N`, `on-ordinary-arrangement-select`, `on-ordinary-posture-select`, `on-ordinary-splendour-toggle`, `on-ordinary-charge-tincture`, `swatch-on-ordinary-charge-<tincture>`); status `blazon`, `gloss`, `violation-panel`, `tincture-explainer`; actions `check-availability`, `open-register`; results `availability-ok|duplicate|too-close|error`; register `register-dialog`, `register-name`, `register-email`, `register-discord`, `register-name-error|email-error|discord-error`, `register-error`, `public-info-button`, `public-info-popover`, `register-submit`, `register-success`, `share-link`, `copy-share-link`, `edit-link` (inside `edit-link-box`, with `copy-edit-link`, `reveal-edit-link`), `register-mail-status` (`data-outcome` sent|failed|disabled); registry `registry-search`, `filter-category|charge|posture|ordinary|division|field-tincture|tincture|charge-tincture`, `clear-filters`, `registry-refresh`, `registry-loading`, `registry-empty`, `registry-error`, `registry-retry`, `registry-show-sample`, `registry-more`, `result-card`, `entry-sheet`, `load-into-builder`, `print-nametag`, `entry-discord`, `copy-entry-discord`, `entry-recover-link`; owner `owner-name`, `owner-discord`, `owner-shape-<shape>`, `owner-save`, `owner-withdraw`, `withdraw-confirm`, `owner-stale`, `owner-denied`, `owner-edit-link`; recovery `header-recover-link`, `recover-view`, `recover-email`, `recover-email-error`, `recover-submit`, `recover-sent`, `recover-offline`, `redeem-view`, `redeem-new-link`, `redeem-withdraw`, `redeem-withdraw-confirm`, `redeem-recovered`, `redeem-edit-link`, `redeem-withdrawn`, `redeem-link-error` (`data-code`); nametag sheet `print-view`, `print-count`, `print-copies-one|fill`, `nametag`, `print-now`, `print-back`.

**Keyboard.** Tab order follows the page; radio-style option groups are one tab stop with arrow keys moving and selecting (blocked options can be focused and explain themselves on Enter/Space). Dialogs and sheets trap focus, Escape closes only the topmost layer (a popover inside a dialog closes first), and focus returns to the opener. Animations are off under `prefers-reduced-motion`.

## Fieldless badges

A badge is armory with no field (`kind: 'badge'`, `field: null`), blazoned "(Fieldless) A wolf argent." and glossed "No background: a white wolf.". It is chosen with the **Badge** tile
(`division-badge`, "No background (badge)") at the end of the Background step's tiles; the rest of the default flow is unchanged. Choosing it from a design with more than a picture leaves an Undo note under the tiles (`badge-notice`, `badge-undo`); a picture on a band becomes one picture of its own. Choosing it hides what has no meaning without a
field — the background colours and patterns, the Shape picker and the Band or shape step — so the Picture step is step 2. Choosing a background again (One colour or a division) brings
the picture back onto a background it stands out against.

SENA A3A2 and A3C are the rules (`structure.ts`, rule `badge`): a badge is one self-contained design, so it is one charge, or two long charges crossed, with the charges on it;
it has no band or border (a chief or bordure is defined by the edge of the field, and a central band would have to be couped, which is not drawn), no charge set in a place of
the field, and a form of armorial display (heart, roundel, billet, lozenge) must be plain: one tincture or fur but not plain ermine, with nothing on it and not divided or treated.
There is no field to contrast with (a main charge stands alone); a charge on a charge is judged against its host as on arms. Charges conjoined to the main one, something overall and
two main charges are gaps (`fieldless:conjoined`, `fieldless:overall`, `fieldless:co-primary`).

The charges are laid out as on a heater shield and drawn scaled to fill the picture (`badgeTransform` in `geometry.ts`, applied by `Shield`), with no shield outline, rim or clip;
the field shape the draft keeps is ignored. A badge's conflict key has a NULL partition (see Uniqueness); `signature` starts `badge|`; the search tag is `field:none`.

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
fess point and clipped to its outline. Field regions and ordinaries are closed contours (`contour.ts`): a division's
parts come from `partitionContours`, and `partIndexAt` says which part a point lies in. An ordinary's drawing comes from
`ordinaryGeometry(spec, frame)` (`ordinary-geometry.ts`): the spec is everything about the group that changes its drawing (type,
lines, treatments, count, cotises, fimbriation), the frame is where in the shape it is drawn; it gives the body, fill rule, centre,
box, the points the ordinary lies on, its trims (fimbriation and cotises, each a path with the points it lies on) and two straight
envelopes — `outer` holds the whole body, lines, fimbriation and cotises and all, and `inner` lies wholly inside the body. Render
layers carry an ordinary's parts in paint order: fimbriation, body, cotises. Layout contexts name the
ordinary they sit around or on by its spec: a plain ordinary keeps its hand-fitted rows, any other is laid out by the generic
engine, keeping charges between it clear of `outer` and charges on it inside `inner` (never fitted to the toothed body). Charge
slots for the banner, round and lozenge (`shape-slots.ts`) are the heater's tables spread, shifted and sized to fit each shape.

**Validity is shape-independent.** The rule of tincture is judged on the canonical heater layout
only, so every shape gives a design the same verdict, issues, fix suggestions and option locks.
`test/shape-verdict.test.ts` checks this for the sample registry, the validation examples, rule-
breaking designs and generated designs, and also that judging the drawing in each shape gives every
charge its canonical verdict. `test/geometry-fit.test.ts` checks, per shape, that every drawing in
every slot stays inside the outline (with margin), on or clear of its ordinary, and clear of its
neighbours, and that each slot lies on the same parts of a divided field as its heater slot (`npm test` checks a seeded
sample of the drawings and of the other shapes' layouts on each run; `SCA_FULL=1` all of them).

Old drafts (saved before shapes existed) and requests without a `shape` use the heater shield.

**Lines of partition** (`lines.ts`, `contour.ts`) are drawn by the library on the field's divisions and counted variations, and the builder offers them: every background with arms shows one closed **More divisions and edges…** (`field-shape-more`, `MoreShapes.tsx`; it opens by itself while the division is one behind it or a line is set) with a row of the lines the host takes
(`field-edge-<line>`, `field-edge-plain` is "Straight"; `EdgePicker.tsx`, `shape-options.ts`) and, for a quartered field with a line,
which of its two lines carry it (`field-edge-side-both|a|b`); chevronny's corners take none, and a line on the division or stripes of a band or
picture stays a gap (`line-of-partition:on-divided-charge`), as does a different line on each of a quartered field's two lines. The same row is under the band (**More shapes and edges…**, `ordinary-shape-more`, its controls shown once a band is chosen; `OrdinaryEdges.tsx`) and on the
top band, the border and each corner or edge shape (**Edge…**, `chief-shape-more`, `bordure-shape-more`, `peripheral-<i>-shape-more`): a line is offered as its blazon bares it (a fess embattled is its upper edge alone,
a fess wavy both, a chief engrailed its one edge), and a band with two edges and a line also shows `ordinary-edge-side-both|a|b` (a corner or edge shape's card `peripheral-<i>-edge-side-both|a|b`; "Both edges", "Top edge only" /
"Bottom edge only", "Left edge only" / "Right edge only" for a pale) so "embattled counter-embattled" and "wavy on the lower edge" are reachable. `setOrdinary` keeps the line
a new band takes. A line on a band lying across everything stays a gap (`line-of-partition:on-overall`).

**Treatments** that change an ordinary's outline are drawn by `ordinary-geometry.ts` from the spec's `mods` and offered in the same
**More shapes and edges…** disclosure above the edge row (`ShapeToggles.tsx`, `shape-options.ts`): toggles `ordinary-shape-inverted`
("Upside down": a chevron or pile reflected about a line 10 below the fess point, so a chevron inverted's limbs rise to the sides and a
pile inverted issues from the base), `ordinary-shape-couped` ("Shortened": a fess, pale, bend, bend sinister, chevron, cross or saltire cut
12 inside the shape on its middle line and both edges, its ends straight even when lined) and `ordinary-shape-throughout` ("Touching the
edges": a chevron's apex on the top, a pile's point on the base), pressed buttons (`aria-pressed`) that explain when blocked; and for a
fess, a bend (sinister) or a chevron `ordinary-position-enhanced|middle|abased` ("Raised · Middle · Lowered": moved 12 across the band). The
hosts are `MOD_HOSTS` (`ordinaries.ts`); a treatment on any other ordinary keeps the gap `ordinary-treatment:<mod>-on-<type>`, couped and
throughout, enhanced and abased, throughout and either, and a cross or saltire throughout don't resolve, a treated band lying across
everything is `ordinary-treatment:on-overall` and a couped band as a fieldless badge `fieldless:couped-ordinary`. A chevron inverted is its
own conflict key (SC against the chevron, A5E5c; a DC when not primary), a pile inverted a DC of orientation (A5G7), couping a DC folded
into the change of type (A5G4), enhanced, abased and throughout no difference; a charged chevron inverted abased is refused. Charges set
between or on a treated ordinary start from the plain one's places moved with it (Table 7's own row for a chevron inverted: one inside
the V, two below), then the generic engine sizes them against its envelope. `setOrdinary` keeps the treatments a new band takes. The
blazon writes "inverted" before the line and the others after it ("a chevron inverted embattled on the upper edge", "a saltire raguly
couped", "a chevron ployé throughout").

**Cotises, fimbriation and voiding** are drawn by the library and offered in the same disclosure. Cotises (`item.cotised`: one to three a side, a paint and a line, which follows the ordinary's `lines.a` unless given)
are thin bands beside each long edge, a quarter of the band wide and a cotise's width apart and from it, mitred where a chevron's, cross's,
saltire's or pile's edges meet; a doubly or triply cotised band is drawn narrower so that it and its cotises take the field a band cotised
once does (a cross's and a saltire's arms narrower still), and their line is laid on the band's periods. Fimbriation is the body grown 2
all round, following its line, drawn under it; voiding cuts the middle out of a cross, saltire or pall (`MOD_HOSTS.voided`), its straight edges 4 inside the
arms' (past what their line cuts in), filled evenodd. The rules (SENA A3C, structure rule `ordinary-treatment`): voided only a cross,
saltire or pall, fimbriated only a central ordinary, both only in the primary group, not fimbriated when enhanced or abased or voided, cotised only a
fess, pale, bend (sinister), chevron, pile, cross or saltire and never on a tertiary; cotises and fimbriation lie on the field and contrast
with it, the body within its fimbriation need not, but may not be the field's tincture; a charge overall over a fimbriated ordinary is a
step from core practice. For conflict the cotises are a secondary group of the ordinary's type (`liftCotises`: presence, number of pairs,
tincture and line each count), and a voided or fimbriated ordinary is read two ways and the least different reading counts (SENA A5C1:
voided = with one of the field's tincture on it, or of the field's tincture fimbriated; fimbriated = alone, or of the fimbriation's
tincture with the ordinary on it). Blazon: "a fess gules cotised Or", "a bend cotised azure" (a shared tincture said once), "a bend wavy
purpure cotised plain sable", "a pale endorsed", "a pale wavy sable fimbriated Or", "a chevron gules fimbriated between three lions argent",
"a cross voided Or".

**Peripherals beside the chief and bordure** — a base, a point pointed, a canton, a quarter and a gyron, and the canton, quarter and gyron
sinister (the mod `sinister`, mirrored about the shape's middle: an ordinary's own form, not a place of the field) — are drawn, ruled,
compared, blazoned and built (`MORE_ORDINARIES`). The band step's **More shapes and edges…** (`ordinary-shape-more`, closed, on every coat of arms)
holds a **More shapes** row of them (`ordinary-more-select`, tiles `ordinary-base|point|canton|quarter|gyron`; it opens by itself while one is the
band, and no tile of the main row is checked then) above the toggles, where `ordinary-shape-sinister` ("On the right") sets a canton, quarter or
gyron in the other corner (and turns a baton sinister). Alone, or with only a chief or bordure, one is the design's band (`places.ts`: the first in canonical order stands
before a chief, which stands before a bordure; this also ends the old crash on picking any non-central band). Beside a band any number more
are added as cards (**+ Add** → "A border shape: canton, base, point…", `add-layer-peripheral`): each a place of its own, `peripheral-0`,
`peripheral-1` … in canonical order (`PeripheralPlace`; `layersIn`, `removeLayer`), starting as the first type the shield has none of that
works there, one that leaves the band where it is first, in a tincture apart; the card (`step-layer-peripheral-<i>`, `remove-layer-peripheral-<i>`)
changes its type (`peripheral-<i>-item-select`: `peripheralItemChoices`, a type the shield has already blocked, `setPeripheralItem`), its tincture
(`peripheral-<i>-tincture`) and, under **Edge…** (`peripheral-<i>-shape-more`), its corner (`peripheral-<i>-shape-sinister`) and line
(`peripheral-<i>-edge-<line>`). A second of one type stays `multiple-groups:peripherals`, and charges on a base, point or gyron
`multiple-groups:tertiary-on-<type>` (no layout yet). The base is 28 tall on the
heater (taller in a shape with a taller chief) and takes a line on its upper edge; the point pointed rises from the box's lower corners to
80 on the heater with its sides bowed toward the base, and takes no line; the canton is a third of the box from its dexter chief corner
(the lozenge's 0.4, or its sloping edge leaves a sliver), the quarter a half; the gyron runs from that corner to the fess point and across
to the flank. A line on a canton, quarter or gyron is laid on both inner edges out from where they meet. Any number of them may stand
together, in `PERIPHERAL_ORDER` (paint and blazon order: base, mount, trimount, point, point dexter, point sinister, gyron, flaunches, gore, orle, tressure, chief, bordure, label, quarter, canton). Charges on the field, between
or on an ordinary, in chief or base and around the primary charges keep clear of them all: each layout context carries them as
`keepOut` (the specs, `[]` when there are none), whose envelopes the ground avoids; their hand-fitted rows then don't apply, and the
generic engine moves the charges up to 24 and draws them together a little where that lets them grow, on the heater and in each shape.
A base or point ends the free field for the other ordinaries (`ordinaryFrameOf`: the frame's `bottom`): they are drawn on under it,
but the points they lie on stop there. Rules: a chief and a base alike in tincture and line are refused (RULES-C §C.3); a canton or
quarter stays uncharged (SENA A6C1); nothing lies overall with one of them (App I4); a field per fess with a base needs a charge across the
line when the two lines could be one fess (A3D1c at the foot). Conflict: a quarter is a canton (one type, L9), a base and a point
pointed differ by a DC, and the canton sinister is a DC of position (A5G6). Blazon joins each by its majority joiner in the O&A
(`PERIPHERAL_JOINER`: "and a base", ", a point pointed", "and a canton", ", a quarter", "and a gyron"; the chief and bordure keep
", "): "Argent, a mullet sable and a base azure", "Quarterly azure and gules, a point pointed Or", "Argent, a canton sinister gules".

**The orle, tressure, flaunches and gore** join them (tiles `ordinary-orle|tressure|flaunches|gore` in the More shapes row and the cards'
lists). The orle is a ring following each shape's own inset (the bordure's inner edge moved in: 12 to 20 from the edge on the heater, the
orle and the field either side about as wide, RULES-C §C.3; the lozenge's 10 to 18), its outer edge line `a`, its inner `b` (a bare line is
both edges, L3; "an orle embattled on the outer edge"), the two edges in step. A tressure is a narrow orle, 3 wide: a single one is an orle
(canonical), a double or triple (`ORDINARY_COUNTS`, the group's count) has two or three rings 3 apart; its count row **Double · Triple**
(`ordinary-number-2|3`, `peripheral-<i>-number-2|3`; `ordinaryCountChoices`, `setOrdinaryCount`, builder `setOrdinaryNumber`) sits with the
shape toggles, and its tile sets a double tressure. Flaunches are two circular arcs from the top corners of the shape's box to its foot,
bulging a quarter of its width at mid-height, a line on both curves (mirrored); the gore is a curve from the dexter chief corner to the
fess point and another on to the foot below it, a line on both, and `ordinary-shape-sinister` turns it to the right ("a gore sinister").
Rings that moving an inset inward makes cross themselves at the heater's foot are cut out (`withoutLoops`). Charges keep inside an orle or
tressure (its envelope's `outer` is all of the field outside its innermost edge, one polygon) and out of flaunches and a gore; the generic
engine draws them together further for this (spreads down to 0.6 on the heater, 0.5 in the other shapes). Blazon: "Per bend argent and
vert, a heart within an orle gules", "Gules, a lion within a double tressure Or", "Sable, in pale three roundels between flaunches Or",
"Or, flaunches azure" (no article: `ORDINARY_ARTICLE` null), "Argent, a gore sinister azure" — joiners " within ", " between " and
" and " from the O&A counts, kept when the element before shares the tincture. Conflict: a tressure is an orle (one type: a double
tressure differs in number, A5G5), flaunches count as two (two DCs from a chief), the gore sinister is a DC of position (L16). Two gores,
a gore beside a gore sinister and an orle beside a tressure stay gaps (`multiple-groups:two-gores`, `multiple-groups:peripherals`), and
charges on a gore or flaunches `multiple-groups:tertiary-on-<type>`.

**The dexter and sinister points** (`REFUSED_ORDINARIES`: `point-dexter`, `point-sinister`) are drawn (the dexter base cut off by a
line from the dexter side of the box, 0.6 down, to its foot 0.7 across; the sinister mirrored), glossed and blazoned ("a point dexter")
so that a design with one shows itself, but the structure rule `side-point` always refuses them: "neither the dexter nor the sinister
point was used in period armory" (RULES-C §C.3, L21). The builder never offers them; the matcher reads "a dexter point" and files the
record as that refusal.

**The pall, fret, label, mount and trimount** (C10; tiles `ordinary-pall|label|fret|mount|trimount` in the More shapes row, and the label, mount
and trimount also in a card's list). The pall is three arms of a cross's width from the fess point — to the chief corners of the shape's box
and down — with a line on every edge, laid out from the centre like a saltire's; it may be voided and fimbriated, never cotised (L20: not
offered). The pall inverted is a type of its own (`pall-inverted`, the pall turned over about the fess point, so the arms still meet
there): the Upside down toggle of a pall changes its type (`TILE_OF`: the pall's tile is checked for both, `TURNED_ORDINARIES` are drawn
but have no tile) and a pall carrying the `inverted` mod canonicalises to it. Charges: three between a pall stand one in each section
(between the chief arms, either side of the foot — turned over for the inverted), one or three on it (one at the middle, or one on each arm,
turned to follow it). The fret (`ORDINARY_KIND` central here though SENA calls it a charge: alone it is the main picture) is a mascle
woven with a bendlet and a bendlet sinister running off the shape: pieces cut short where one member passes under another (convex,
disjoint, one body); it takes no line, voiding or fimbriation, and as a charge it can't be counterchanged over an ordinary or stripes
(CC-8, CC-3). The label (a bar across the chief with three tapering pendants, throughout), the mount and the trimount (one hill, three) are
`'other'` ordinaries that always stand as peripherals (role `peripheral`: beside a picture, or alone with the field as the main group, SENA
A5F) and keep charges out of them like a base; they take no line or treatment; the label is always drawn in chief (the plan's "alone, centred"
is not drawn). Joiners from the O&A: ", a label", " and a mount", " and a trimount". Conflict: a pall against a pall inverted is a
substantial change of type (A5E5c), a mount against a trimount one DC, a label of three points the only label drawn ("of five points",
`ordinary:label-points`, and a label overall, App I4, `placement:overall-label`, stay gaps).

**More divisions** (C12; RULES-C §E.1–E.2): per chevron inverted, per chevron throughout and gyronny, in `MORE_DIVISIONS` — the first row of **More divisions and edges…** (`field-more-division-select`, tiles `division-per-chevron-inverted|per-chevron-throughout|gyronny`; `setDivision` is the same function as for the first seven). Per chevron inverted is the per chevron limbs mirrored below the fess point (first part above); per chevron throughout puts the apex on the top edge, its limbs falling at 45° (the lozenge's steeper, so they meet its edge) — a different drawing of the same A5F1 category (`partition()` maps it to per chevron, no difference), and a bare one is also read as a pile inverted throughout (`asThroughoutOther`, a key-crossing reading: such a field keys `{ partition: null, primary: ANY_PRIMARY }` and a bare pile inverted throughout `partition: null`). A gyronny has `pieces` 6, 8 or 12 (`GYRONNY_PIECES`; `field-pieces-6|8|12`; `divisionPieces` makes eight the stored default, so "Gyronny" alone is eight and "of eight" is never blazoned; 10, 16 and the like parse as the gap `division:gyronny-pieces-<n>`), its sectors alternate, one line always fesswise (Prec 02/2003) and the first part the one just above it on the dexter side; its lines are laid from the centre, an **arrondi** one (`arrondi`: straight group, allowed on a gyronny only) an arc bowing a tenth of its length, every one the same way round. Conflict: gyronny is its own category, 6, 8 and 12 pieces alike (A5G1d: more than four are not told apart, so its tinctures may be swapped too), arrondi no different from straight; a gyronny's only counterchanged charge is a single one (a saltire or a cross is refused, RULES-C §E.2). The three are drawn on the field only: as the paint of a band or charge they stay `division:<d>-on-charge`; the layout's mapped-slot check (`PLAIN_DIVIDED_FIELDS`) stays on the first seven, so the pinned slots did not move.

**SENA corrections after the phase-C review** (findings R-1 … R-12; `test/review-rules.test.ts`): three charges on per chevron inverted stand one
and two (GoT Table 7); a charge alone where a per pall's three parts meet lies on all three alike (A3B4a's "Per pall inverted argent, gules, and
azure, a mullet sable" is refused); each cotise is judged on the part of the field it lies on — the cotises beside each run of the body's edges
between two ends (`OrdinaryTrim.pieces`: a band's either side, a chevron's above or below both limbs, a cross's or saltire's between two arms) —
not all of them as one ground; four charges in cross on quarterly, per saltire, gyronny (arrondi too) and per pall are judged about the fess
point on the lines drawn straight, though the cross is drawn a little low; the baton is dexter; a canton or quarter must be of a single tincture
or fur (A6C1, the sinister forms too); over gyronny one charge, or as many in annulo as there are gyrons, may be counterchanged (L33), never a
central ordinary; and a field in two parts may share a tincture when its main band lies over the line (A3B3a "unless the sections are separated
by an ordinary"; not quarterly or per saltire, A3B3c).

**Code fixes after the phase-C review** (findings K-1 … K-27; `test/review-code.test.ts`): a pall inverted with the inverted mod is the pall
(`canonicalOrdinary`); a point pointed leaves the bands across the field in place (`OrdinaryFrame.baseTop`: only a base ends the field
`bandPlace` centres them in); charges on a voided cross, saltire or pall are the gap `multiple-groups:tertiary-on-voided` (they would lie in the
voiding) and Hollow is blocked while the band carries them; lines laid out from where they meet (`Junction` in `geometry.ts`: a chevron's limbs
at its apex, gyronny's rays, per saltire's, per pall's and quarterly's arms) start their features far enough out to keep off the middle line
of each angle (their reach toward it over the tangent of half the angle, plus a gap), so they no longer cross at the point of per chevron
inverted or the centre of gyronny of twelve; new cotises take the band's line only where a cotise can (`cotiseLineFor`: plain on a chevron
rompu or bend bevilled); a fess under a chief is lowered until its lines and trim clear the chief (`fessReach`; on the lozenge, as far as
the shape stays wide); a per chevron throughout ↔ pile inverted throughout reading keeps the peripherals, and either is keyed to every
registry entry; changing a corner shape's type is refused when adding it would be.

**Drawing fixes after the phase-C review** (findings U-1 … U-9, K-22; `test/review-visual.test.ts`): bevilled is an antisymmetric single
profile (`LineProfile.symmetric` false): each half of the line leans a little from where it meets the shape to a short step at the middle, so
the half beyond the step is offset by it, and `laidSide` turns the step palewise on a bend and a bend sinister alike (a bend's two edges step
together, so its lower half moves). A chevron rompu is cut palewise across both limbs `ROMPU_BREAK` either side of the apex and the point
between the cuts raised by 0.4 of its thickness (PicDic: "its point sliced off and raised"); it is drawn straight-edged and not widened, its
cotises step with it. On a bordure, grady, potenty, nebuly, dovetailed and raguly are cut half its width deep, their periods as much shorter as
they are shallower (`bordureLine`). A canton's or quarter's lined edges stop short of where they leave the round or the lozenge at a slant, cut
no deeper for their few periods than 1.5 times as on a band (`Course.clearExit`, `exitClearance`). The line of a couped band or arm stops half
a depth inside its straight ends (`coupedEndClear`), so no riser or dovetail sticks out past them. A fine-grained line (six repeats or more
across the shield: indented, engrailed, invected, rayonny) shows three periods at least on each arm of a cross, saltire or pall, as much
shallower as they are shorter (`Course.minPeriods`). The shape picker says when the chosen shape can't draw a group's charges at a size that
reads though the heater can (`crampedInShape`, e.g. a fess between three roses and a base on the lozenge): the shape is display only and the
verdict stays the heater's (`test/shape-verdict.test.ts`). The edge chips of a division and of a band through the middle of the field picture
the middle of the field only (`Shield`'s `view`, `EdgePicker`'s `zoom`), and a gyronny's chips draw the line on a field per fess. Hollow shows,
blocked with SENA A3C's reason, on a fess, pale, bend or chevron; thin bands show their band's treatments they can't take, blocked ("Thin bands
can't be shortened: turn Thin off first."); and Thin is blocked while such a treatment is on, instead of dropping it.

**Convention fixes after the phase-C review** (findings K-12 … K-37, U-10, U-11; `test/review-conventions.test.ts`): the SCA tooling
builds the words it reads for the library's constructs from the library's tables (`test/sca/words.ts`), and the library keeps one table
for each thing — `MOD_HOSTS.voided` for what may be hollow, `LINE_LOOK` (plain-words) for how a line looks, from which the gloss's adjective
and the chip's label both come, `DRAWN_LINES` for the order of the lines (`COMMON_LINES`, its first seven after straight, before the edge
row's break), `partCount` for the pieces of a division in three, `ordinaryEdgeHost` for the edges of a band, `SHAPE_TOGGLES`,
`toggledOn` and `bandPositionOf` for the words of a band's shape in a step's summary. Whether adding a layer brings a new
rule-of-tincture problem is decided on what each problem is about (its rule, the place of its group, its charges), not on its wording.
The library's caches of drawn geometry share one bounded memo (`memo.ts`). The cotises of a couped band or arm are couped with it: its
straight ends are cut where its outermost cotise still lies inside the shape (they ran off the shield on a couped bend or saltire), and
Thin is blocked while the band has an outline ("Thin bands have no outline: set the outline to None first."). The outline row reads
None · Edged · Stripe each side · Two stripes each side · Three stripes each side, and the count row of thin bands "How many thin bands".
Every test file is type-checked (`tsconfig.test.json` takes `test/**/*.ts` but the Workers-runtime files, which `tsconfig.worker.json` lists).

**Fixes after the verify pass** (findings V-1 … V-8 and the K-7, K-13 residuals; in the four review tests): four charges in cross on a field
whose lines meet at the fess point are judged about it, on its lines, only while they are drawn within 6 units of it (`IN_CROSS_SLACK`; the
plain drawing sits 5 low) — a chief, a charge in base or an orle moves them further, and they are judged where they are drawn. A
rule-of-tincture issue names the part of its group it is about (`TincturePart`: body, fimbriation, cotises, or a semy's strewn charges), so a
new layer that gives a band's fimbriation or cotises a problem its body already had is refused again. Where the lozenge's free field is
too short for a fess under a chief (cotised on its own line, or enhanced), the fess is drawn at the lowest place it may take, raised no
further, and narrower until it clears the chief (`bandPlace`, down to a third of its width). A bordure's deep-cut lines (grady, potenty,
nebuly, dovetailed, raguly) are fitted to whole periods, overhangs and all, between the inset's corners, so no dovetail or lobe folds round a
corner; the round, with no corners, is unchanged. A baton sinister counterchanged over stripes is judged as a bend sinister (it runs along
bendy sinister, across bendy). Hollow and the other treatments of a charged band are blocked only by a gap they bring, not one its charges
already had (`onItProblem`); a chevron rompu couped and cotised is the gap `ordinary-treatment:cotised-couped-rompu` (its inner cotise
folds under the raised point), so the outline, toggle and line that would make it are blocked (`newItemGap`). The SCA normaliser reads
"<band> <line> inverted" for every band that takes inverted ("a pall wavy inverted"), and its number and cotise words come from the library.

**Divisions in three** (C13; RULES-C §E.1–E.2): per pall, per pall inverted, tierced in pale and tierced in fess join `MORE_DIVISIONS` (tiles `division-per-pall|per-pall-inverted|tierced-per-pale|tierced-per-fess`). A field so divided has three parts (`partCount`), in blazon order: per pall the chief part between the arms, then dexter and sinister; per pall inverted dexter, sinister, then the base part; tierced dexter to sinister, chief to base. The per pall's arms run from the fess point to the box's top corners (the inverted one's mirrored below it) and straight down (up); a tierced field's two lines bound a middle third of the box centred on the fess point. A line on one is drawn on every line ("per pall wavy"), laid out from the centre for a per pall. Words: "Per pall A, B and C" (no serial comma), "Tierced in pale A, B and C" (`DIVISION_NAME`; the ids keep `per`); `divisionGloss` takes every part's colour. Rules: no two parts share a tincture (A3B3a); per pall needs one part contrasting with both others (A3B3b); tierced needs its middle part to contrast with both outer ones (the strictest reading, L11), and with its outer parts alike it is refused as "a pale"/"a fess" (L24); App H holds across every pair of parts a complex line divides (`adjacentParts`, L12); a chief on a per pall lies on its chief part alone (A3B4a's example); Table 7 sets two charges on a per pall in fess and three one in each part (tierced: in fess / in pale). Counterchanging over three parts is the gap `division:counterchanged-over-three-parts` (the builder doesn't offer it), and as the paint of a band or charge they stay `division:<d>-on-charge`. Conflict: per pall and per pall inverted are each their own category; tierced in pale is in per pale's and tierced in fess in per fess's (L11), three pieces (A5G1d); a field in three changes tincture (A5G1a) only when at least half its area does, measured point by point on the heater (`divisionPartGrid`), so one part of three is no change and two swapped are. The builder's `setDivision` fills a third part that contrasts with the second (`partner`), and the Background shows a third picker (`setFieldTincture(d, 0 | 1 | 2, t)`, `fieldTinctureChoices` blocking what the other two parts have).

**Diminutives** (C11; RULES-C §C.2): bars, pallets, bendlets, bendlets sinister and chevronels two to four at a time (`THIN_ORDINARIES`,
`ORDINARY_COUNTS`), and the baton (a bendlet couped from dexter chief, its own type, "a baton sinister" with `ordinary-shape-sinister`; tile `ordinary-baton` in the More shapes row). A group is drawn
as its ordinary's outline narrowed (`DIMINUTIVE_WIDTH`: 10, a chevronel 9), set evenly across the ordinary's place — bars one above
another, pallets side by side, bendlets across the bend, chevronels nested and lifted a little (the heater's foot would hide the lowest) —
and moved or turned over as a whole (enhanced, abased; chevronels inverted); bars and chevronels under a chief start below it
(`OrdinaryFrame.top`). Lines are cut 0.3 of a diminutive deep. Charges between a group follow its ordinary's Table 7 row (`betweenHost`)
and keep clear of one envelope round the whole group; three or four bars or pallets leave little room (the capacity rule says so).
SCA armory uses no single diminutive as the main or overall band, so one bar, pallet, bendlet (sinister) or chevronel is canonicalised to its
ordinary, barrulets to bars and a saltorel to a saltire couped; a single one beside the main group (`ordinary:single-diminutive`), several
saltorels (`ordinary:saltorel-multiple`), outlined diminutives (`ordinary-treatment:outline-on-diminutives`), charges on them
(`multiple-groups:tertiary-on-diminutives`) and diminutives set around a picture (`multiple-groups:secondary-ordinary`) stay gaps. Words:
"three bars wavy argent", "two chevronels inverted", "two bendlets sinister" (`ORDINARY_PLURAL`). Conflict: a diminutive is its ordinary's
type (`familyOf`; a baton a bend couped, a baton sinister a bend sinister couped: `familyOfTreated`), the count is the number (a bend against two bendlets is substantial), and three or more
identical diminutives on a plain field, alone or beside peripherals, are also read as the variation (bars as barry, pallets paly, bendlets
bendy, chevronels chevronny; SENA A5C1), the least different reading taken — such a design keys `{ partition: null, primary: ANY_PRIMARY }`
so the registry lookup compares it with everything. Bendlets enhanced with other charges are a step from core practice (`coreSteps`). The
builder reaches them through the **Thin** toggle (`ordinary-shape-thin`) of a fess, pale, bend, bend sinister or chevron, which draws it as
two of its diminutive (blocked while the band has an outline, which thin bands can't keep, or a treatment they don't take: "Thin bands have no
outline: set the outline to None first."; picking another band keeps them thin), and the count row `ordinary-number-2|3|4` ("How many thin
bands": "Two · Three · Four"); the band's tile stays checked (`TILE_OF`). "Three chevronels braced" is not drawn (`arrangement:braced`, PLAN-C §6).

The builder reaches them from **More shapes and edges…** on a central band or shape (`OutlineControls.tsx`, `outline.ts`, `shape-options.ts`):
`ordinary-outline-none|fimbriated|cotised|doubly-cotised|triply-cotised` ("None · Edged · Stripe each side · Two stripes each side · Three stripes each side", the heraldic term in each one's accessible name and tooltip; one outline at a time, so
fimbriated and cotised together stays the gap `ordinary-treatment:fimbriated-and-cotised`), then `ordinary-outline-tincture` (swatches
`swatch-outline-<tincture>`, and `swatch-outline-counterchanged` for cotises on a divided or striped background; the other paints of a trim
are the gaps `ordinary-treatment:trim-<kind>`, `tincture:<stain>`, `proper:trim` and `ordinary-treatment:fimbriated-counterchanged`), and for
cotises their own edge row `ordinary-cotise-edge-<line>` (small strips drawn from the line's profile, not shields; `lineChoices` with the target
`{ k: 'cotises', path }`). `ordinary-shape-voided` ("Hollow") is a toggle of a cross, saltire or pall (`MOD_HOSTS`), blocked while charges lie on it. `outlineChoices` blocks an outline
only by a rule of the band itself (A3C: a raised or lowered band, or a hollow one, can't be edged; a cotised pile and the rest are hosts), `outlineTinctureChoices`
by the trim's own contrast with the field (`trimTinctureIssues`; a band's own tincture is judged apart, `groupBodyTinctureIssues`), and a violation's one-click
fix may change a trim's tincture. A new outline starts in the band's own tincture for cotises (an edging in another), the first that stands out where it
lies; `setOrdinaryLine` carries cotises that had followed the band's line, and `setOrdinary` keeps an outline the new band may have. An outlined band
lying across everything is the gap `ordinary-treatment:on-overall`.

`lines.ts` holds the
registry (the lines, their SENA App M2 groups and `lineDiffers`, the hosts each may go on, how many independent edges each host has,
what a bare line means on it, and the blazon words and spellings) and one periodic-edge generator: each line has an original
placeholder profile, one period that is fitted a whole number of times to the visible length of an edge (within SENA A2C1's repeat
bounds), centred on an anchor and drawn only over a span, straight beyond it. A band's two edges share the period and anchor, so
wavy, dancetty and counter-embattled edges run in phase and indented, bretessed and engrailed ones mirror. With + away from a band,
engrailed arcs bite into it and their points face out, invected arcs bulge out. `contour.ts` builds a closed
outline from straight, curved or lined edges; with every edge plain it gives exactly the polygon paths drawn today.
A line of the field is laid once along its whole length (`LaidLine`: one run, its period fitted to the chord the shape shows), and
each region edge on it draws its piece of that run, either way round (`runAlong`, `reversedRun`), so the parts meet exactly. Its
features face chief, or dexter on an upright line (RULES-C §A.2: per fess engrailed has its points up); a one-sided line (engrailed,
invected, indented, bretessed) is moved back half its depth so it straddles where the plain line runs; per chevron's limbs, per
saltire's lines and quarterly's lines break at a period's end where they meet. A barry, paly or bendy field draws every stripe
boundary with the same line in phase, so the stripes keep one width (the depth at most 0.8 of a stripe). With a complex line,
`partIndexAt` tests the drawn regions. Rules: a line its host can't take (dancetty on a division, enarched or ployé off their hosts)
and SENA App H (a complex line between sable and azure or sable and purpure; one between two colours or two metals with a charge over
it) are structure issues (`line`); per fess with a chief is refused (A3D1c) only when the two lines could be one fess
(`couldBeOneFess`); a change of style of half the partition lines is a distinct change (`field-line`, A5G1c). The blazon writes the
line after the division ("Per pale wavy argent and azure", "Quarterly per fess embattled Or and gules", "Barry wavy of eight …"), the
signature after the division or variation and its pieces (`per-pale~wavy(…)`, `quarterly~plain/embattled(…)`).

The library also draws **lines on the ten ordinaries** (`ordinary-geometry.ts`); `support.ts` still gaps them
(`line-of-partition:<line>`) until the builder offers them. Each lined edge is laid on a *course*: a band's two edges on its middle line,
centred on the chord the shape shows; each chevron limb, cross or saltire arm and pile side out from where they meet, its first period a
line depth (or what the angle needs) clear of the corner, so features never collide there. A band's `a` edge is its upper (a pale's
dexter) edge; mirrored profiles put their + side outside each edge (indented teeth and bretessed merlons stand out of both edges,
engrailed arcs bite in), the others put it toward chief on both edges so they run in phase (wavy, counter-embattled keep the band's
width); a pile's sides mirror each other. A band with a complex line (fess, pale, bends, chevron, cross and saltire arms) is drawn 20 %
wider; a line is cut at most 0.3 of the ordinary's width deep; enarched and ployé bow the band without widening it. The bordure's line
runs round its inset as one ring (`polylineEdgeCommands` on a closed polyline), a whole number of periods from the top middle, features
toward the field. Envelopes move each lined edge by how far its profile swings (`profileSwing`). Rules: two different lines on one
ordinary, a jagged line on one edge of a band alone, dancetty off a two-sided band and enarched/ployé off their hosts are `line` issues;
another line on one edge alone is a step from core practice (`coreSteps`), and two steps are refused (`core-practice`, SENA A2B, App G);
an ordinary with a complex line may not share a multiply divided field's tincture. A change of edge, compared edge by edge with
`lineDiffers`, is a change of type (A5G4: one DC with any other change of type, never an SC). Words: `lineWords` ("a fess embattled",
"a fess embattled counter-embattled", "a fess wavy on the lower edge", "on a pale wavy sable three roses argent"); signature
`o.fess~embattled/plain`.

**The lines tail** (C14; RULES-C §A.1, §A.5, F2): `triangular`, `rompu` and `bevilled` are lines of group `other` (each differs from every other line)
and *single* profiles, one feature across the whole edge like enarched and ployé. `lineAllowed` restricts them to one kind of host each:
triangular to a chief (its lower edge two straight lines meeting at a point toward base), rompu to a chevron (upright or upside down; `rompu`
is a model `Line`, one edge value; since the UI review the chevron's outline is broken — `broken` in `ordinary-geometry.ts` — not an edge
profile), bevilled to a bend, a bend sinister, per bend and per bend sinister (the line broken at its middle by a short palewise step, the
half beyond it offset). So the
edge row (`lineChoices`, which lists only the lines the host may carry) shows `ordinary-edge-triangular` (a chief card: `chief-edge-triangular`),
`ordinary-edge-rompu`, `ordinary-edge-bevilled` and `field-edge-bevilled` on those hosts and nowhere else; ployé is now also a pile's
(`ordinary-edge-ploye`). Rules (`structure.ts`): triangular and rompu take no further line, so a rompu chevron's cotises can't carry one
(`NO_FURTHER_LINE`); rompu and bevilled ordinaries are never fimbriated (a broken outline, A3C); a bend bevilled with charges set around it is a
step from core practice (`bevilled-with-charges`, App G); a field per bend bevilled is exempt from the App H dark pairs until a charge overlies
the line (the charge rule 7 still applies). Cotises that followed the band's line go plain when the band takes one of these. The SCA tooling
derives the tagger's line words from `LINE_SPELLINGS` (`LINES` in `gap-terms.ts`, apart from the words `gaps.ts` reads by context: potenty,
arrondi); "beviled" and "bevelled" are bevilled, "rompú" rompu.

**Polish of the phase-C controls** (C15): the default flow is unchanged (three steps; the Background and Band steps each gain one closed row,
**More divisions and edges…** / **More shapes and edges…**, `field-shape-more` / `ordinary-shape-more`, whose body, previews included, is drawn only
while it is open). The tile pictures are resolved once (`BuilderSteps.tsx` `tileIcon`, `EdgePicker.tsx` `lineIcon`) so a re-render never resolves
one again. The edge chips (`<testid>-edge-<line>`) come in the library's order of how often the O&A uses the lines (`DRAWN_LINES`), the common ones
(`COMMON_LINES`: plain, embattled, wavy, engrailed, indented, rayonny, invected, dovetailed) first, then a dashed break (`icon-grid-break`, no
nested disclosure) after those the host takes, and the rest. A collapsed step's summary says the
line, toggles (in the toggle row's order, from `SHAPE_TOGGLES` and `toggledOn`) and outline in words ("Diagonal band ↘, upside down, cotised in white, embattled, gold"). Every radio group has exactly one tab stop —
the checked option, else the first allowed one — and arrow keys move through them; toggles are `aria-pressed` buttons; a blocked option opens
the explainer instead of applying. `test/builder-edges.test.ts` is the reachability oracle for the edge row (every drawn line × every drawn
division, counted variation, ordinary, and a chief or bordure beside a fess: offered, allowed exactly when some tincture makes the design pass
`unsupportedIssues`, `structuralIssues` and `tinctureIssues`, and choosing it gives that design; edges survive a change of division or band; toggles,
outlines and counts held to the same oracle). The journey has the state `ordinary-embattled-cotised`.

**Bands under a chief, a wider charged bordure, a charge in the corner beside a bend** (C16; RULES-C §F.1–F.3): a fess (and bars), cross,
saltire or pall beside a chief or a base (not a point pointed, which leaves the field beside it free) is centred in the field they leave and drawn 0.8 as wide (`bandPlace` in
`ordinary-geometry.ts`: from the chief, or where the shape is first 60 wide, to the base, or where it narrows to less than 60 — on the heater a fess
under a chief lies at y 66 and is 24 wide), so three charges fit between a fess under a chief; pales, bends, piles and chevrons keep the fess point
(a chevron's apex already clears a chief). The frame is the same for drawing, the rule of tincture and layout (`frameBeside`); charges between or on
such a band are moved with it (`freeFieldOf`, `moveIn` in `layout.ts`), and a band so moved no longer lies on its division's line (a fess on per
fess under a chief is judged where it lies). A chief or base the builder adds is offered only when the band it moves still passes the rule of
tincture. A bordure that carries charges is drawn 15 wide (`OrdinarySpec.charged`, each shape's `chargedInset`; the peripherals
`charged-bordure` and `chief-charged-bordure` keep field charges inside it), so eight charges on it are about 10 on the heater (5 to 7 on a plain
one); charges on a chief within one are read against the chief and may be as small as 9. One charge set in chief or in base beside a bend (bendlets,
bend sinister, baton) stands in the corner the bend leaves free (`cornerBesideBend`): blazoned "and in sinister chief a rose" ("in dexter chief"
beside a bend sinister, "in dexter base" or "in sinister base" for one in base), glossed "in the top-right corner"; the design keeps `position:
'chief'`, and two or more stand along the top as before.

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

## Bands and pictures divided in two

Any band or picture may be painted as a party of two plain tinctures, divided by any drawn division (per pale, per fess, per
bend, per bend sinister, per chevron, per saltire, quarterly): `{ "k": "divided", "division": "per-pale", "parts": ["azure", "or"] }`
as a group's `paint`. "A heart per pale azure and Or", "a cross quarterly Or and gules", "three hearts each per pale gules and
sable"; "counterchanged Or and sable" on a divided field is the same party, divided as the field is.

- **Where it is cut.** A band is cut through its middle (the fess point; the middle of a chief's band), each charge through
  its own centre, in the charge's own frame, so a charge turned on a bend is cut along its own axes. A cut that misses a band
  (a pile per fess lies wholly below the line) is a structure issue, as is a long charge cut per chevron (RULES CC-11) and two
  parts of one tincture (SENA A3B3a).
- **The rule of tincture.** The class of a party is the class of its parts when they agree and neutral when a metal meets a colour
  (SENA A3B1); it shares both its tinctures. A neutral party stands out on anything it shares no tincture with, so "a heart per pale
  azure and Or" passes on gules and fails on azure. Where it lies across the parts of a divided field, each part may also be judged
  against the section under it (A3B4b): "Per pale sable and argent, a bordure per pale argent and azure" passes, cut per fess it
  does not. A charge on a divided band is judged against the band as a whole.
- **Text.** Blazon `per pale azure and Or` after the item (`each per pale …` for several charges); the gloss says how the colours
  are split; the signature has the division and both tinctures; both tinctures are tags (`charge-tincture:azure`, `ordinary-tincture:or`);
  a different division or different tinctures is a distinct change (A5G3).
- **The builder.** **Split in two** in every colour picker's More colours and patterns… (`PaintPicker`; test ids `<picker>-mode-split`, `<picker>-split`,
  `<picker>-division-<division>`, `<picker>-part-1|2`): a button splits the colour, then a division and a tincture for each part. A part is offered when
  some tincture for the other part makes the pair stand out, and the other part moves only when it would no longer do so
  (`splitGroup`, `partyDivisionChoices`, `partyTinctureChoices`, `setPartyTincture` in options.ts).

## Stripes and checks

The background, and any band or picture, may be varied in two plain tinctures: barry, paly, bendy, bendy sinister, chevronelly,
checky, lozengy, fusily, pily, barry bendy and paly bendy (`{ "k": "variation", "variation": "barry", "pieces": 8, "parts": ["argent", "azure"] }`;
`variation.test.ts`). The first tincture lies in the dexter chief corner. Barry, paly, bendy, bendy sinister and chevronelly are counted:
4, 6 or 8 stripes (an odd count is a set of ordinaries, not a field), six when none is given and not blazoned ("barry of six" is the same
design; "barry of eight argent and azure" says the count). The other patterns have no count. A variation as a *part* of a divided field
("per pale argent and barry sable and Or"), furs in the stripes, other counts and lines of partition are gaps in `support.ts`.

- **Drawing.** `variation-geometry.ts` lays the cells out over a box (the shape's for the field, the band's own bounding box for a
  band, the drawn box of each charge, turned with it) and gives the two region paths and the membership test the rule of tincture uses.
  Pily is the field with three piles cut out of it (drawn turning the other way), the second tincture filling them.
- **The rule of tincture.** A variation is judged as a whole (SENA A3B1): its class is that of its tinctures when they agree and
  neutral when a metal meets a colour, and it shares both. Its tinctures must be a metal and a colour (A3B3d). A band may share a tincture
  with the ground when exactly one of the two is in stripes or cells (A3B4b: "Lozengy Or and azure, a chief azure"; "Pily Or and sable,
  a bordure per fess sable and Or"); a charge may not. A counterchanged band is available over simple stripes when it runs across them
  (CC-2: "Paly sable and Or, a bend counterchanged"), a counterchanged chief or bordure over pily (CC-9); a counterchanged charge, or
  anything over a grid, is not (CC-3).
- **Conflict.** A variation is in the A5F1b category of the division it multiplies (barry with per fess, paly and pily with per pale,
  chevronelly with per chevron), the lattices (lozengy, fusily, barry bendy, paly bendy) together and checky on its own; within a
  category a different number of pieces (1 to 4 are each distinct, more are one) or a different lattice is a distinct change (`field-style`,
  A5G1d and A5G1b); the tinctures are compared as for any field, checky either way round (Prec #FIELDCheck).
- **The builder.** "Stripes and checks" in More colours and patterns… of the background and of every colour picker (`VariationPicker.tsx`): a chip per
  pattern, the count for the counted ones, the two tinctures (`setVariation`, `setVariationPieces`, `setVariationTincture` in
  builder.ts; `groupVariationChoices`, `setGroupVariation` … in options.ts for a band or picture, where a pattern or tincture is
  blocked when no partner makes the pair stand out on what it lies on).

## Treatments and natural colours

**Treatments** are a tincture with a pattern of lines in another: masoned (a brick wall), scaly and papellony (voided scales, papellony with
a smaller scale inside; `{ "k": "treated", "treatment": "masoned", "ground": "argent", "ink": "sable" }`; `treatment.test.ts`). They cover
the background, a part of a divided background, or any band or picture. Fretty (a charge), plumetty (fur-like), a treatment on a fur and a
counterchanged treatment are gaps in `support.ts`.

- **The rule of tincture.** The treatment is part of the tincture it lies on (GoT "Field Treatment"): the surface has the class and base
  tincture of its ground, and the ink must be a metal against a colour or the other way round (`StructureRule` `treatment`). A charge may not
  share the ground's tincture. A divided background's parts may not share a ground (A3B3a: "gules and gules masoned Or").
- **Conflict.** `Surface.variant` makes a treated tincture another tincture from its ground (A5F2: a change of tincture, so a substantial
  change between field-primary designs): the same treatment on the same tincture in another ink is no change, and papellony and scaly are one
  ("Argent papellony gules conflicts with Argent scaly sable"). Masoned and scaly are different treatments.
- **The builder.** "Brick or scales" in More colours and patterns… (`TreatmentPicker.tsx`): a chip per treatment and the lines' tincture; the colour
  picker above sets the tincture it is laid on and keeps the treatment, and "No brick or scales" takes it away (`treatment-options.ts`; the target is a `PaintTarget` shared with the fur picker).

**Natural colours** (`{ "k": "proper" }`, "a lion proper") are a paint of a picture, for the charges whose `ChargeMeta.proper` has a palette
(GoT Table 4): lion, boar, stag, hare, owl, bee, rose, tree, open book, sword and flame. Proper is no tincture: its surface takes the
class and the conflict tincture of its palette's "taken from" part (a lion is Or, a rose gules, a boar brown; brown is a tincture of its own),
so a rose proper is no different from a rose gules and a boar proper differs from a boar sable. Each palette is one flat fill (the
flame's two are split per fess); the hatching option leaves it unhatched. The builder offers "Natural colours" in the picture's More colours and patterns…
only when the charge has a palette (`proper-options.ts`). "Brown X proper", a proper ordinary and proper on part of a split picture are gaps.

## Semy


A **semy** (strewn charges) is a plain tincture with one charge strewn over it in another tincture
(`{ "k": "semy", "ground": "azure", "charge": { "charge": "mullet" }, "ink": "or" }`; `semy.test.ts`). It covers the background, a part of a divided
background, or a band (a bordure, a chief, a chevron: "a bordure argent mullety sable"); a field divided in two with the same charge on both parts is
"all semy of" it, in one tincture or counterchanged ("Per pale azure and argent all semy of roses counterchanged"). A semy on a picture, on a fur or
of a charge form is a gap in `support.ts`.


- **The drawing.** `semyPattern` (`patterns.ts`) is a square tile with the charge's drawing in it once; the tile is turned a quarter of a turn
  about the shield's middle and the charge is turned back upright, so the charges stand in staggered rows (about five across the background, eight
  or so round a bordure). Each part of a divided field is drawn with its own pattern, so a charge on the line is cut by it, as "counterchanged" has it.
- **The names.** `aliases.ts` holds the one table of names the widget words a semy with (`semy-de-lys`, `crusilly`, `billety`, `mullety`, `estencely`,
  `bezanty`, `platy`, `hurty`, `pellety`, `semy of torteaux`, `goutty de sang` …): a name that fixes the tincture states none. The matcher's
  normaliser (rule `semy-names`) reads every name and spelling as "semy of <charges> <tincture>", the tincture left unsaid being the next one stated.
- **The rule of tincture.** What lies on a semy lies on its ground (its surface is the ground's). The strewn charges must contrast with the tincture
  they are strewn on, a part's semy with that part alone (A3B4a: "Per pale gules and argent semy of billets gules"; D3 judges "all semy of" against
  each part); they may share the tincture of the main picture (Prec #SEMY). A field divided and strewn alike is judged on each of its parts.
- **Groups and conflict.** `strewn.ts`: a semy on the field is the primary group when no main picture stands in the middle and a secondary group when
  one does; a semy on a band is a tertiary group on it. `liftStrewn` states a design with its semys as such groups (six charges, the "6+" number)
  on plain grounds, which is what `differences` and `candidateKey` compare (A5E1–A5E3, A5G2–A5G5); `strewnIssues` adds the structure rules (A3D1a: the
  charge of a semy is not used again in another group on the field; App I3: one group of charges on a band).
- **The builder.** "Scatter" in More colours and patterns… of the background and of a band (`SemyPicker.tsx`, `semy-options.ts`): a picture to strew
  and the colour of the pictures; the colour picker above sets the colour it is strewn on and keeps the scatter, and "None" takes it away.


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
recursive paint (a tincture, a fur, a treated tincture, a tincture strewn with a charge, a division with its parts, or a variation of two tinctures). Each group carries an item (an
ordinary or a charge), a count, an arrangement and optional position, a paint and, in
`charged`, the groups sitting on it; its role (primary, secondary, peripheral, overall, tertiary)
and relation (between, about, position) say how it relates to the field and the other groups.
There is no cap on groups. A fieldless badge (`kind: 'badge'`, `field: null`; see Fieldless badges) is drawn, and so is a charge facing to sinister
(contourny: its drawing mirrored, its on-box with it) and two charges that face each other or stand back to back (a `pair` arrangement,
combattant for beasts and monsters rampant and respectant for the rest, laid out as two in fess, or around a pale); a charge's gaze (`gaze`:
guardant, regardant) is a field of its own, drawn from the drawing of its posture with the head turned (`rampant~guardant`; only the lion has them) and a gap elsewhere. A fish urinant is its haurient drawing turned upside down (generated, `art/procedural/derived.ts`). An `orientation` (fesswise, bendwise,
inverted, reversed, to center…) is drawn for the charges whose sidecar row allows it (`orient.allowed`: long charges and charges with a top every
way, lozenge-like shapes fesswise and bendwise, stars and roses inverted, the bee as an insect), by turning the art in its slot and fitting it
back within it (`pose.ts`); a crescent fesswise is worded "an increscent", fesswise reversed "a decrescent", inverted "pendant". The Turned row in the "Facing, turning and details…" disclosure (`orientationChoices`, `setOrientation`) sets one: as usual first (null: upright, or along the bend the charge is on), then the ways the charge takes, the rest blocked with a reason (a mullet "looks the same turned that way"), to center blocked for a single charge and every way for two crossed; a swap keeps the orientation where the new charge takes it. A mullet or estoile of 4 to 12 points (`of-points` with a `count`; five and six, as drawn, are left out), a pierced mullet (both generated, `art/procedural/stars.ts`), and a roundel, lozenge, delf, mullet, billet or triangle voided or fimbriated in a tincture are drawn: fimbriation and voiding are render effects of the charge's own art (a stroke under it, a mask of its band), not art of their own; SENA A3C allows them only on the primary charges, voided not in a badge, three at most, and conflict reads them two ways (A5C1). The nested Details disclosure inside "Facing, turning and details…" sets them (`pointsChoices`, `detailChoices`, `fimbriationTinctureChoices`, `setModifier` with a count or paint): a star's points 4 to 12 (the drawn number marked "usual"), then a toggle for each detail the charge's sidecar `details` holds (voided, fimbriated, pierced, a cross fitchy), blocked with SENA A3C's reason where it refuses one; a fimbriation is switched on in the first tincture that stands out where the charges lie, and its tincture picker blocks the others; a swap keeps the details the new charge takes. A head (`form: 'head'`) of the lion, wolf, boar, stag, unicorn or dragon is drawn from its own drawing, couped (its straight edge; a head always states its cut, couped when none is given) or erased (that edge torn into six tufts, generated: `art/procedural/derived.ts`), and a demi charge of the lion, wolf, goat, unicorn, dragon or eagle is the top of its rampant (or displayed) drawing cut off at its sidecar row's `demiCut` and fitted to the box again; both fill their box out to the cut, so they are drawn at the solid charges' optical scale (0.95, `opticalScale`) whatever their beast's; neither has a posture or carries charges, a head is worded "a wolf's head erased contourny", a demi charge "a demi-lion", and conflict reads each as a type of its own within its beast's class (a distinct change from the whole beast, a substantial one from another beast's head, the cut worth nothing, and a head or demi charge contourny a distinct change: SENA A3D1b, A5G7a). The Details disclosure holds the Shape row of such a charge (`formChoices`, `setForm`: whole, front half, head only) and, for a head, the Cut row (`cutChoices`, `setCut`: couped or erased); a whole charge goes back to the posture it is drawn in, and a swap keeps the form and the cut where the new charge is drawn so. Parts and details are drawn as pieces of art set at an anchor of the charge's drawing (`overlaidArt`, overlay-art.ts; the pieces of art batch A3 in `art/paths/pieces.ts`, not charges): a crown on the head of an animate charge or a head (crowned; a crowned mullet stays a gap, SENA M11), a band round the neck clipped to the outline (collared), the wing mirrored behind a beast or a pair of wings rising from a heart (winged), a stem with leaves under a rose (slipped, leaved), and flames round the outline (enflamed), each in a tincture of its own (flames also proper) and only where the drawing has the anchor (a lion sejant has no wings); wings, flames and slips lie under the charge, which is drawn smaller with them when they would leave its box, the collar and crown over it, so a crowned or collared charge keeps its on-box. Their words follow the charge's tincture ("a lion Or crowned gules", "a heart winged Or" when the wings are the heart's tincture, "three roses gules slipped and leaved vert"); wings, and a collar on a head, are a distinct change, the rest none, and none is held to the rule of tincture (herald question D9). The Details disclosure sets them (`detailChoices`, `partChoices`, `pieceTinctureChoices`, `setModifier`, `setPart`): a toggle each, blocked where the drawing has no place for the piece ("The lion sejant is not drawn with wings") and leaves without a stem, each switched on in a first paint (`firstPiecePaint`: wings the charge's tincture, flames proper, a stem and leaves green, a crown or collar gold, red on a gold charge) and then given any tincture by its colour picker; a change of posture or shape, or a swap, keeps a piece only where the new drawing has its place (`withDrawnPieces`), and a slip switched off takes its leaves. Stains,
proper on charges without a palette, the other field treatments, lines of partition and the other charge attributes (form, affronty, the
gaze without a drawing, the orientations a charge does not take, parts, holds) are not drawn yet: `resolve` accepts them and `support.ts`
reports each as an `unsupported` issue naming the gap (the SCA test files records under the same
tags). Lines read as blazon does (`lines.ts`): `{a}` alone is what the bare word means on its host ("a fess embattled" is its upper edge, "a fess wavy" both), `b` is a second edge only on bands, the orle and tressure and quarterly's per fess line, a host with one line must have `b = a`, and a point, label, fret or mount takes none. Furs (the ermine, vair and potent families, with `X ermined Y` and `vairy X and Y`) are drawn as small generated patterns (`patterns.ts`); the hatching option leaves them unhatched. Input may be loose (shorthand paints, defaults omitted): `resolve` fills every default
(SENA Table 7 arrangements, the SCA's default postures) and puts the groups in canonical order, so
equivalent inputs have one JSON form and one signature. The builder's own space is the
"simple space": one ordinary, one picture group (on the field, between the ordinary, or on it),
extra pictures on the ordinary, a chief and a bordure beside the ordinary, each with pictures of its own, a secondary group set in chief, in base or in canton beside the ordinary or the picture (SENA App I1: beside a central element such charges are secondary; with none they are the primary group), or a secondary group set "between" the picture when it is one group of one or two charges with no band (Table 7's "around any other charge(s)" layouts), a second primary group of charges that is laid out together with the picture (SENA App I1: two groups on the field with no band between are together the primary group; up to three charges between them, in the order they are written, with the one arrangement of all of them), and a tertiary group on the picture when it is the primary charges (Table 7's "on any other charge": one to four on each, each drawing's on-box in its charge's sidecar row (`art/meta`) saying where it carries them; the count is per host charge). `places.ts` names every group of such a design by a structural place (`ordinary`, `picture`, `co-primary`, `on-picture`, `around`, `in-chief`, `in-base`, `in-canton`, `on-ordinary`, `chief`, `on-chief`, `bordure`, `on-bordure`, `overall`) that doesn't change when groups are added or removed, and `layers.ts` adds and removes the layers on top of the band and the picture.

### Registry-keyed model

The data model is **registry-keyed**. Every entry belongs to one row of `registries`, and
uniqueness is enforced per registry. The URL selects a registry with `?registry=<id>`; with no
parameter, the API uses the default registry (`is_default = 1`, `default` today). Tables
(created by `migrations/`):

| table | contents |
|---|---|
| `registries` | `id`, `name`, `is_default`, `created_at`. Seeded with `('default', 'Default', 1, …)`. |
| `arms` | `id`, `registry_id`, `display_name`, `contact_discord` (nullable, CHECK-constrained to a valid Discord username), the normalised `design` JSON, `field_shape` (`heater` \| `banner` \| `round` \| `lozenge`, CHECK-constrained, default `heater`; display only), `signature`, `blazon`, `readability`, the conflict key `partition_key` (NULL for a fieldless badge) / `primary_key` (see Uniqueness), `search_text` (blazon + gloss + display name as lowercase words, a space at each end; never contact, email or shape), `edit_secret_hash`, `rev`, `created_at`, `updated_at`. |
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
  primary, which may share a type with any entry that has a primary, `**` (`ANY_PRIMARY`, with a NULL partition) when three or more
  diminutives are also read as stripes and may conflict with any entry at all: `keysMayConflict`), and the Worker loads just those candidates
  through the `arms_registry_primary_partition` index, in registration order, and reports the first entry
  that is too close. A fieldless badge has a NULL `partition_key`: with no field it differs from armory that has one by
  one distinct change only (A5G1e), so a NULL partition on either side matches any partition.
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
  `arms_registry_conflict_keys` index the too-close lookup uses (superseded by 0008). **Run `wrangler d1 migrations apply --remote` before deploying the Worker that needs it.**
- `0008_fieldless_keys.sql`: makes `partition_key` nullable (NULL = fieldless badge) and replaces the lookup index by
  `arms_registry_primary_partition` (`registry_id, primary_key, partition_key`). Like 0007 it drops and recreates `arms`,
  `arms_tags`, `owner_emails` and `owner_tokens` (every registered entry is discarded) and keeps `registries`. **Run `wrangler d1 migrations apply --remote` before deploying the Worker that needs it.**
- `0009_phase_d.sql`: discards every registered entry (`arms`, `arms_tags`, `owner_emails`, `owner_tokens`), keeping the schema
  and `registries`: the annulet joined the roundel's type class (its stored conflict key changed) and the cross crosslet moved
  to the Crosses category (its stored category tag changed), and the Worker has no path to recompute either. **Run `wrangler d1 migrations apply --remote` before deploying the Worker that needs it.**

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

# Typecheck the SPA, the Worker (incl. the lib and the Workers-runtime tests) and every other test file and the SCA tooling
# (tsconfig.test.json: test/**/*.ts, in Node as they run)
npm run typecheck

# Run all tests in three vitest projects (vitest.config.ts): `workers` (test/worker.test.ts and test/migrations.test.ts,
# the only files that use the D1 binding: vitest-pool-workers, local Miniflare D1), `library` (every other test file: the
# heraldry library and store seam, in plain Node, files in parallel) and `sca` (the SCA armorial test, plain Node;
# `npx vitest run --project sca` alone)
npm test

# Rewrite the SCA ignore list (test/fixtures/sca/ignored.json) after changing the widget or test/sca/. This is also the
# authoritative FULL sweep: every check on every record, nothing sampled (`npm test` samples the expensive ones, below)
npm run sca:ignore

# Regenerate public/favicon.ico from public/favicon.svg
npm run favicon
```

- `test/builder-edges.test.ts`: the edge-row reachability oracle (see "Polish of the phase-C controls").
- `test/ordinary-geometry.test.ts`: ordinaries and division regions built from contours draw exactly what phase B drew (body, fill rule, centre, box and samples of every ordinary in every shape, captured in `test/fixtures/ordinary-geometry.json`), an ordinary's envelopes (the body's rings when plain or bowed, widened and narrowed by how far its lines swing otherwise), `partIndexAt` agrees with the analytic test, a division's regions partition the field, and an ordinary layer with only a body renders the phase-B markup.
- `test/builder.test.ts` "lines on the band, the top band and the border" and `test/builder-steps.test.ts` "More shapes and edges…": the band's line and edge-side transitions, the lines each host offers, `setOrdinary` keeping a line, and the closed disclosures.
- `test/ordinary-lines.test.ts`: lines on ordinaries (the lines tail — triangular, rompu, bevilled, a pile ployé: geometry, hosts, rules, words, conflict — too) — widened bands whose two edges align; counter-embattled vs bretessed; one-edge lines; symmetric cross and saltire arms; the bordure's ring in every shape; every allowed line on every drawn ordinary within its envelopes; charges between and on lined ordinaries (counts 1–3; a rotating half of the heater's lines, a fifth elsewhere); the rules (one line per ordinary, jagged lines on both edges, dancetty, core-practice steps, A3D1c, A3B4b); A5G4 (RULES-C §B.7); words, gloss and signature.
- `test/builder.test.ts` "the outline of the band" and `test/builder-steps.test.ts`: the outline, its tincture and its cotise line, "Hollow", and the controls inside the closed disclosure.
- `test/ordinary-outlines.test.ts`: cotises, fimbriation and voiding — the geometry on every shape (cotises parallel at a quarter of the band and a cotise apart, one to three a side, their own line following the band's; fimbriation round the body under it; voiding evenodd), render and hatching of the parts, the rules (A3C hosts and roles, contrast of the trims, the field's tincture under fimbriation, the core-practice step), the conflict readings (cotises as a group, RULES-C §B.7, voided and fimbriated read two ways), words, gloss and signature.
- `test/divisions-three.test.ts`: per pall, per pall inverted and the tierced divisions tile every shape in three (plain, wavy, embattled) with `partIndexAt` following the regions, part order, the three-part tincture rules (A3B3b, tierced, "that is a pale", a chief on per pall, App H, counterchanging a gap), Table 7, words, gloss, signature, conflict by area and categories, the builder's three parts and their swatches.
- `test/divisions-more.test.ts`: per chevron inverted, per chevron throughout and gyronny (6, 8, 12, arrondi) tile every shape and `partIndexAt` follows the regions, a gyronny's wedges alternate from the dexter fess line, words and signatures, the builder's `setDivision`/`setDivisionPieces` and the lines kept, conflict (per chevron throughout = per chevron, the pile reading, pieces, arrondi), counterchange over gyronny.
- `test/review-rules.test.ts`: the SENA corrections after the phase-C review (R-1 … R-11), each read from a blazon by the SCA matcher.
- `test/review-visual.test.ts`: the drawing fixes after the phase-C review (U-1 … U-6, K-22) on every shape, and the shape picker's note (U-4).
- `test/review-conventions.test.ts`: the convention fixes after the phase-C review that show (the cotises of a couped band inside every shape, Thin blocked with an outline, the band summary, line labels, outline and count labels, the SCA tooling's words).
- `test/review-code.test.ts`: the code fixes after the phase-C review (K-1 … K-27); the meeting lines of the phase-C divisions are tiled and checked for self-crossing in `test/lines-field.test.ts`.
- `test/diminutives.test.ts`: bars, pallets, bendlets (sinister) and chevronels two to four at a time and the baton — evenly spaced and inside every shape, enhanced and turned groups, below a chief; a single one canonicalised to its ordinary (a saltorel a saltire couped), the gaps kept; words and signature; conflict (number, the ordinary's type, three or more read as the variation with the `ANY_PRIMARY` key, two never); bendlets enhanced with charges a step from core practice; charges between a group; the Thin toggle and count row.
- `test/central-and-edge-shapes.test.ts`: the pall, pall inverted, fret, label, mount and trimount — drawn inside every shape (lined, voided and fimbriated too), the pall's arms reaching the chief corners and the inverted one's the base, three between and one or three on a pall, the fret's woven pieces never overlapping, the roles, the rules (voided and fimbriated pall, a cotised pall and a fret refused, CC-8), conflict (pall against pall inverted, mount against trimount), the words and the toggle that turns a pall over.
- `test/peripherals.test.ts`: the base, point pointed, canton, quarter and gyron (and sinister forms), and (C9) the orle, double and triple tressure, flaunches, gore (and gore sinister) and the refused dexter and sinister points — each shape's own inset for the rings, mirrored forms, charges kept inside an orle and out of flaunches and a gore, the `side-point` rule, orle ≡ tressure, flaunches a pair, the words — drawn inside every shape, the sinister forms mirrored, the frame a base leaves the other ordinaries; charges on the field, between, in chief or base kept out of them (alone and several at once; heater exhaustive, other shapes in turn) and still legible beside them; the contexts filled from the design; the rules (field-primary, chief and base alike, A6C1, App I4, A3D1c at the foot), conflict (canton ≡ quarter, base vs point pointed, sinister a DC of position), blazon joiners, gloss and signature. The builder side (the More shapes row, `peripheral-<i>` places and cards) is in `places.test.ts`, `builder.test.ts`, `builder-steps.test.ts` and `builder-layers-reach.test.ts` (`generatedPeripheralDesigns`).
- `test/ordinary-treatments.test.ts`: inverted, couped, throughout, enhanced and abased — the geometry on every shape (reflection, couped ends inside the shape and straight on lined bands, throughout touching the edge, a band moved not widened), the conflict readings (A5E5c, A5G7, A5G4, none for position), the rules (contradictions, hosts, a charged chevron inverted abased), the layouts around and on them, the words, the toggles and `setOrdinary`.
- `test/lines-field.test.ts`: lines on the field — every partition line of every allowed pair is drawn with its profile and at least two periods inside each shape; the regions of every allowed line on every phase-B division and striped variation tile each shape (a rotating half on the heater, a sixth elsewhere) and `partIndexAt` follows them; one line where two regions meet; point direction and straddling; counterchanging on a wave; the verdict in every shape; App H, A3D1c and the hosts a line may go on; A5G1c (RULES-C §B.7); the gloss.
- `test/signature.test.ts`: the signature is unchanged for designs phase B could draw (pinned, `test/signature-cases.ts`), one-to-one over lined and generated designs, and every id ends in a letter.
- `test/lines.test.ts`: the line registry (SENA App M2 groups, the hosts each line may go on, the edges each host has and what a bare line means on it) and the periodic-edge generator and contours (whole periods within the repeat bounds on every shape, features inside their span, bands' edges in phase or opposed, plain contours byte-identical to the polygons the phase-B shapes draw, captured in `test/fixtures/straight-contours.json`).
- `test/art-lint.test.ts`: the house style of every charge drawing (path grammar, size and centring, holes, rings that do not
  overlap, bytes, anchors and necks), the drawing keys of each sidecar row against its postures and its paths, provenance, and
  that the rings it reads are the ones the art tests read. `test/art-onbox.test.ts`: each drawing's on-box lies on it.
- `test/model.test.ts`, `arrangement`, `layout` (including ordinaries that aren't plain: the generic engine keeps their charges clear of or inside the envelopes), `render`, `blazon`, `gloss`, `plain-words`, `tincture`, `counterchange`, `party-paint`, `fur`, `variation`, `treatment`, `semy`, `readability`, `tags`, `search*`, `validate`, `uniqueness`, `sample-registry`: the pure library, by topic. The validation examples (`test/validation-cases.ts`) are shared.
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
- `test/migrations.test.ts`: migrations apply from empty, `0001` matches the production schema (`test/fixtures/production-schema.sql`, the original `schema.sql`), re-running it is harmless, `0002`–`0006` carry rows across, and `0007`/`0008` empty the arms and owner tables, keeps the registries, checks the Discord username, cascades deletes to tags and owner tables, and serves the candidate lookup from its index.
- `test/contact.test.ts`: the shared Discord and email validators.
- `test/store.test.ts`: the store's offline mode (sample search/check, offline refusal of writes,
  owner checks and recovery) and its online result mapping (register with email and Discord,
  owner check, recovery, redeem remembering the new link, withdraw forgetting it), with `fetch`
  stubbed.
- `test/sca-armorial.test.ts`: the widget against every current armory record in the SCA Ordinary &
  Armorial (`test/fixtures/sca/oanda.db`, committed unmodified for tests only; it never reaches
  `dist/`). Each record either matches a design the widget blazons identically, would register,
  draws and lets the Design tab build, or is on the ignore list with the gaps that stop it. See
  `test/fixtures/sca/README.md`. To keep `npm test` fast as records start passing, it runs the cheap checks (match,
  assess, blazon) on every record but the expensive ones on a seeded, rotating sample (`test/sca/sample.ts`):
  the render check and the builder-click replay (`builderPath`, ~40 ms a design) on the simplest design with each feature
  (records are checked shortest blazon first, and a design with a feature no design before it has is always checked, so
  every ordinary, charge, division, line, treatment and layout is drawn and replayed on every run) plus ~120 designs picked by a hash
  of the UTC date (or `SCA_SAMPLE_SEED`), and the gap tagger's re-run on the ignored records (the ratchet's "still has the
  gap it is filed under") for the first record of each gap category plus one in twelve. "An ignored record that now passes"
  and "a new failure" are still checked on every record, by the match and the cheap checks. **`npm run sca:ignore` is the
  authoritative full sweep** (it never samples, and fails on any widget bug in any record); the final gate runs it, and
  `SCA_FULL=1 npx vitest run --project sca` makes the test do the same. Sampled failures print the seed to reproduce.
  The same seed (`SCA_SAMPLE_SEED`, else the date; `test/rotation.ts`) and `SCA_FULL=1` drive the other sampled sweeps of the library
  project and of this test — the slot golden (every heater combination, a sixth of each other
  shape's), the hatched render goldens of the generated designs and of the charge and diminutive cases (a
  third), geometry-fit's art sweeps (six fixed drawings and about eight rotating ones, whatever the number of drawings; the hosts of
  charges on charges are the sampled drawings that carry them; the compact few drawings in half the generic layouts on the heater) and
  its shapes other than the heater (a twelfth of the layouts),
  lines-field (half the cases on the heater, a sixth elsewhere), ordinary-lines (half of the heater's lines), the corner and edge
  shapes' keep-out sweeps (half on the heater), half of uniqueness's symmetry pairs, a third of builder-layers-reach's generated field-line and corner-shape designs and half of its rich ones,
  a twelfth of prefilter's edited entries per probe and a third of its generated pairs, and a third of the seeds of the two oldest
  generators in this test's round trip — and their failures print it too. A sampled golden test compares only the keys it worked out;
  `npm run golden:write` always works out every key.

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

- **Fieldless badges beyond one charge and what is on it**: charges conjoined to the main one ("within and conjoined to", "surmounted by"), something overall on a badge, two main charges, couped ordinaries, and the display-as-field reading of conflict (LoAR 5614). Each is a `fieldless:<detail>` gap.
- **Marshalling** (impalement, quartering of two coats): out of scope; the model is designed
  without it.
- **Stains**, **lines of partition** (wavy, indented, …),
  **field treatments** (fretty, plumetty, …), a **semy** on a picture, on a fur or of a charge form, **proper** for charges without a palette and charge attributes such as a head turned where that posture is not drawn so (guardant, regardant: their Head chips are blocked), facing out (affronty), holding or
  arming.
- **More than the supported group combinations**: more than three charges in two main groups, three or more main groups, a band and a picture as the main ones together, charges around, on or across two main pictures, two charge groups beside the main one, more than one charge
  overall (or a pile, chief or bordure overall), tertiary charges on a secondary or overall charge (or with charges around the primary), charges in chief beside pictures set around a band, charges
  around three or more primary charges or "about" them, and positions other than in chief, in base and
  in canton for a group beside the main one (the main charges can be set in a half or quarter of the field). A chief and
  a bordure beside a band, with pictures on them, pictures in chief, base or canton, and pictures
  around the picture, and pictures on the picture, and a band or picture across everything are built (the extra layer cards).
- **Art** is original placeholder drawing; traceable art is under discussion.
- **Moderation:** a moderator token, hidden status and a report link. An owner withdraws their
  own entry, with the edit link or a recovery email.
- **Changing the owner's email address.** It is set at registration; there is no edit route.
- **Registry creation via the API.** The owner adds registries with SQL (see above).

## Licence of charge art

All charge drawings (36 charges drawn by hand in 77 drawings, and the generated ones) in `src/lib/heraldry/art/`, and the shield, ordinary and
partition geometry, are **original work drawn for this widget**. They are licensed with this
repository. No artwork is taken from DrawShield, Armoria, Heraldicon, Wikimedia Commons or any
other source.

The art lives in a sidecar, one row per charge in two halves: `art/paths/<category>.ts` holds only the path strings
(`art/paths/core.ts` those of the charges in the main chunk, `CORE_ART_IDS`), and `art/meta/<category>.ts` everything else —
names, type, postures, the way the art is drawn (`orient`), per-drawing on-box, anchors and neck, and the charge's
**provenance** (who drew it, when and how; every row says `origin: 'original'`). `CHARGES` (`charges.ts`) is built
from the meta rows, and `charge-art.ts` picks the drawing a charge is drawn with.

How the art is drawn and shown:

- Each silhouette is one even-odd path of straight-line polygons (`M`/`L`/`Z` only, at most one decimal), centred
  in a 100×100 box with its long axis about 86 units (82–90). Animals face dexter (the viewer's left). Its rings never
  overlap or cross (an overlap would show as a hole), holes are at least 5 units across, and a drawing is at most 2,600
  bytes. `test/art-lint.test.ts` checks every drawing; three older ones break a rule and are listed as drawn
  (`LEGACY_ART_EXEMPT`).
- Features are at least about 8 units wide where the design allows, so limbs, antlers, rays and
  horns survive at registry-card and favicon sizes.
- Each charge has an optical `scale` in its sidecar row (0.88–1.15). Slender charges (sword, key,
  anchor) are drawn larger and solid ones (heart, rose) smaller, so they look the same size.
  `test/geometry-fit.test.ts` checks every drawing at its scale stays on the shield, on or off
  its ordinary, and clear of its neighbours, in every slot table (six fixed drawings and about eight more,
  a seeded rotating sample, per `npm test` run, so its cost does not grow with the art; `SCA_FULL=1` every drawing).
- The charge outline is a 0.75 px hairline, dropped entirely on shields under 40 px wide or
  when a charge is drawn under 24 px. With hatching on, a charge's hatch pitch follows its size,
  a solid band of its tincture is kept along its edge, and Sable hatches as a dark grey grid on
  black so it still reads dark.
