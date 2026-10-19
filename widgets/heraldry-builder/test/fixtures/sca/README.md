# SCA Ordinary & Armorial fixture

`oanda.db` is the SCA Ordinary & Armorial bulk dump, committed **unmodified**, byte for byte as
downloaded. It is used **only by tests** (`test/sca-armorial.test.ts` and the tooling in `test/sca/`)
to check the widget against every real SCA armory blazon. Nothing in `src/` imports it, it is not
in `public/`, and it is **not shipped to users**: it never reaches `dist/` or the deploy.

| | |
|---|---|
| Source | https://oanda.sca.org/oanda.db (format: https://oanda.sca.org/data_format.html) |
| Version | LoARs thru 202607, last update 260915 (by Morsulus) |
| Size | 21,477,490 bytes, Latin-1 |
| sha256 | `964ceffe9ad3ef3d5d48a771b317ad94ceec35f1136506be758fb3aae3e5f707` |

The database is Copyright © 1995–2025 Society for Creative Anachronism, Inc. Its copyright notice
is embedded at the top of the file and reproduced verbatim in [`NOTICE.txt`](NOTICE.txt). The notice
permits redistribution only if the information content is unchanged, the distribution is not for
monetary or material gain, and the notice accompanies it. So:

- never edit, trim, re-encode or reformat `oanda.db` (`.gitattributes` marks it `binary` so git
  leaves its bytes alone); the SCA test checks its sha256 against `OANDA_SHA256` in
  `test/sca/oanda.ts`;
- keep `NOTICE.txt` beside it.

## Ignore list

`ignored.json` lists every current armory record the widget can't yet express, as record key
(`regid:N`) → gap categories (ids from `GAP_CATEGORIES` in `test/sca/gaps.ts`). It holds keys and
tags only, never blazon text: `oanda.db` stays the only carrier of record content. It is grouped by
primary gap, ordered by how many records fixing that gap alone would make expressible, so it reads
as a to-do list.

Regenerate it with `npm run sca:ignore` after changing the widget or the SCA tooling. It
reclassifies every current record through `test/sca/classify.ts`, the same code the test uses, and
rewrites the whole file. It is the authoritative full sweep: unlike `npm test`, which samples the expensive per-record checks (the render check and the builder replay, the gap tagger on ignored records; `test/sca/sample.ts`), it checks every record in full. The run fails, writing nothing, if a matched design the widget would
register can't be blazoned, drawn or built: that is a widget bug, and is never ignored.

The format is valid JSON, laid out for readable diffs:

```
{
  "$comment": "…",
  "groups": [
    {"category": "<id>", "description": "<its GAP_CATEGORIES description>", "singleGap": <n>, "records": {
      "regid:<N>": ["<category>", "<category>:<subtag>", …],
      …
    }},
    …
  ]
}
```

- A group's `category` is the primary gap of each of its records: the record's category that ranks
  highest by `singleGap`. `singleGap` counts the records whose only gap category is that one, i.e.
  the records that closing it alone would unlock. Groups are in that order.
- Each record is on its own line with its sorted gap tags. Records are in regid order.
- The armorial test fails when a listed record now passes (regenerate the list), a listed record no
  longer has its group's gap, a listed record fails a widget check (a bug: it is never a gap), an unlisted
  record fails, or an entry is malformed (an unknown gap category, a group not among its record's tags, a
  record listed twice). "Still has its gap" re-runs the gap tagger on a seeded sample of the listed records
  (`test/sca/sample.ts`; the classification is then `gap-unchecked`); `npm run sca:ignore` and `SCA_FULL=1` check every one.

## How a record is matched

`test/sca/match.ts` reads the normalised blazon with a small token grammar (`blazon := field [',' element (connector element)*]`;
elements are an ordinary with an optional "on" and tincture, "between", or a charge group with its position,
count, noun, posture, "in splendor", pattern or rows and tincture; a phrase without a tincture takes the next one
stated) and proposes the design input it describes, with arrangements left out unless the blazon words them. The
widget's own `blazon()` of that design, passed through the same normaliser, must equal the SCA text: the parser only
proposes, the comparison accepts. The outcome is one of:

| status | meaning |
|---|---|
| `vocabulary` | a word the widget does not blazon |
| `unparsed` | every word is known, but not in a shape the grammar proposes (or the proposal is malformed) |
| `unsupported` | proposed, but the widget does not draw part of it; the record is filed under the widget's own gaps (`multiple-groups:co-primary`, `posture:couchant`, `placement:between-cross-2`, …) |
| `near-miss` | proposed and drawable, but the widget words it differently |
| `match` | the blazons are identical |

A matched design the widget would not register is filed as a widget finding: `tincture-rule-differs` (SENA's
rule of tincture rejects it as well, being a registration from before the rule or a counterchange over two metals or two colours),
`widget-structure-rule` (a structure rule SENA does not have), `placement` (charges that cannot be drawn
legibly where they sit, e.g. six on a chevron), `arrangement:forced-into-one-part` (charges GoT Table 7 forces
into one part of a divided field where the library has no such layout; the library itself reports this gap as an
`unsupported` issue). A band with a chief or bordure, or with any number of corner and edge shapes (a base, point pointed, canton, quarter, gyron, and the
sinister corner forms), is reachable in the Design tab (the extra layer cards, the band step's More shapes row) and passes like any other matched
design; "a canton sinister" and "a sinister canton" are read alike (`corner-shapes`, for every form that takes "sinister": `MOD_HOSTS.sinister`, the gore and the baton too), and the tagger asks the library, on a stand-in design, whether
the ordinaries it read stand together (`drawnTogether`), so a second of one type stays `multiple-groups:peripherals`. The orle, the double
and triple tressure, flaunches and the gore (and gore sinister) are read too: "a double tressure" is the tressure drawn twice, flaunches
take no article, and "within" joins only an orle or tressure (the widget's words: "a heart within an orle gules", "between flaunches");
`peripheral-forms` reads "a tressure" as an orle (a single tressure is one, Prec Gwynaeth 04/2004), "two flaunches" and "a pair of
flaunches" as flaunches and "a dexter point" as "a point dexter", and the connectors rule
puts " within " before an orle or tressure and " between " before flaunches (O&A counts in `PERIPHERAL_JOINER`). A dexter or sinister
point matches and is filed as the widget's refusal (`widget-structure-rule`, RULES-C §C.3, L21), not as a gap. A matched design that
the widget registers but cannot blazon, draw or build is a widget bug (`fails`), never ignored.

The pall, pall inverted (read as one phrase), fret, label, mount and trimount are read too. `label-forms` drops "of three points" (the default) and
"in chief" before a label, "throughout" after a pall, fret or label is dropped as it is after a cross, and a label, mount or trimount takes the joiner
the O&A uses most (`PERIPHERAL_JOINER`). "a label of five points" is `ordinary:label-points`, a label overall `placement:overall-label`, a pall cotised
is read and filed as the widget's refusal (`widget-structure-rule`, L20), a fret between charges `placement:between-fret-<n>`.

Gyronny, per chevron inverted and per chevron throughout are drawn divisions (`DIVISION_WORDS` follows `DRAWN_DIVISIONS`; the tagger's `gyronny` entry, `DRAWN_DIVISION_FORMS` for "inverted", "throughout" and "arrondi" after the division): "gyronny [arrondi|arrondy] [of six|twelve]" is read with its count (`readPaint`), "gyronny of eight" is a near-miss like any stated default, other counts are `division:gyronny-pieces-<n>`, and a band or picture so divided `division:<d>-on-charge`.

Per pall, per pall inverted and tierced in pale/fess (C13) are read with three tinctures: the field runs to its own end, not the first comma (`proposeInputs` reads the paint over the whole text and wants a comma or the end after it), "A, B and C" (`readPaint`). The normaliser's `three-part-fields` rule writes "tierced per pale|fess" as "tierced in …", "tierced per pall" and "gyronny of three" as "per pall" (A5G1b), drops the serial comma and supplies a missing first comma; `fieldComma` finds the comma that closes such a field for the connector rules. The tagger joins "tierced per|in pale|fess" (its `tierced` entry) and "tierced per pall"; a bare "tierced" keeps `division:tierced`; a drawn-on-the-field-only division on a band or picture is `division:<d>-on-charge`.

Diminutives are read counted: a number word and a plural (`ORDINARY_PLURAL`: "three bars", "two bendlets sinister", "four pallets") is one
ordinary group of that count, any number of them (the widget files five bars as `ordinary:multiple` and several saltorels as
`ordinary:saltorel-multiple`); a central band read after "between" and a group before it ("a fleur-de-lys between two pallets") is a
secondary group, `multiple-groups:secondary-ordinary`. The normaliser rule `diminutives` folds the other spellings (`ORDINARY_SPELLINGS`:
scarpe → bendlet sinister, palet → pallet, chevronelle → chevronel) and barrulets into bars (no difference, RULES-C §G.2), and — SCA armory
using no single diminutive as the main band (RULES-C §C.2) — "a bar", "a pallet", "a bendlet (sinister)" and "a chevronel" into their
ordinary (not after "in chief/base/canton", nor "a bar gemel") and "a saltorel" into "a saltire couped" (§D.2), as the widget canonicalises
them. The tagger counts them the same way (`ORDINARY_COUNTS`), so a drawn group is never tagged `ordinary:multiple`.

One charge beside a bend (C16; RULES-C §F.3, App K) stands in the corner the bend leaves free, and the widget writes the corner ("Argent, a bend
sable and in sinister chief a rose gules"). The College writes it both ways — "in sinister chief" (about 40 records) and plain "in chief" (about
45) beside a bend, "in dexter chief" or "in chief" beside a bend sinister — so the normaliser's `corner-beside-bend` rule reads, after a bend,
bendlets or a baton, "in sinister chief a/an" as "in chief a/an" and "in dexter base a/an" as "in base a/an" (after a bend sinister, bendlets sinister or a
baton sinister, "in dexter chief" and "in sinister base"); two or more charges are not read so (they stand along the top). The tagger files such a charge
as set in chief or in base beside the bend (`cornerPosition` in `gaps.ts`, derived from the library's `cornerBesideBend`).

### Phase-C additions at a glance

What phase C added to the grammar, the normaliser and the tagger, with where each convention comes from (details in the paragraphs
above and below):

| addition | where | source |
|---|---|---|
| a line after a division, a counted variation or an ordinary's name, "on the <edge> edge", "embattled counter-embattled", "embattled grady" | `paint-grammar.ts` (`readDivisionLines`, `readOrdinaryLines`, `readVariation`) | RULES-C §0, §A.1 (`lineAllowed`, `bareLines`) |
| "arrondi" is read only on the gyronny: "quarterly arrondi", "per saltire arrondi", "a cross arrondi" stay their gaps (`readHostLine`) | `paint-grammar.ts` | PLAN-C §6 (per saltire / quarterly arrondi deferred) |
| `line-synonyms`: undy, crenellated, ployee, beviled/bevelled, rompú; a division, or a band or shape that takes indented but not dancetty (`lineAllowed`), dancetty is indented | `normalise.ts` | RULES §A.3, RULES-C §A.1 |
| `ordinary-treatments`: humetty = couped, reversed = inverted, inverted before the line and couped after it, a bendlet enhanced = a bend enhanced, throughout after a cross says nothing | `normalise.ts`, `readOrdinaryForm` | RULES-C §D.2, §D.6, §G.2; PLAN-C §4 (corpus order counts) |
| `ordinary-outlines`: cotissed/cottised, double/triple cotised, a pale's pair "endorsed", "between two cotises", no comma before the outline | `normalise.ts`, `readOutline` | RULES-C §D.5, §G.2 |
| `corner-shapes`, `peripheral-forms`, `label-forms`: a canton (gore, baton) sinister = a sinister canton (gore, baton), a tressure = an orle, two flaunches / a pair of flaunches = flaunches, a dexter point = a point dexter, "of three points" dropped; each peripheral's joiner | `normalise.ts` | RULES-C §C.3; Prec Gwynaeth 04/2004; O&A counts (`PERIPHERAL_JOINER`) |
| `diminutives`: scarpe, palet, chevronelle, barrulets = bars, a single diminutive = its ordinary, a saltorel = a saltire couped; counted plurals | `normalise.ts`, `readGroup` (counted plurals) | RULES-C §C.2, §D.2, §G.2 |
| per chevron inverted / throughout, gyronny [arrondi] of 6, 8 or 12 | `paint-grammar.ts`, tagger `DRAWN_DIVISION_FORMS` | RULES-C §E.1–§E.2 |
| `three-part-fields`: tierced per → in, tierced per pall / gyronny of three = per pall, serial comma dropped, missing first comma supplied | `normalise.ts`, `readPaint` | SENA A5G1b; corpus counts (C13) |
| `corner-beside-bend`: one charge "in sinister chief" beside a bend = "in chief" | `normalise.ts`, tagger `cornerPosition` | RULES-C §F.3, App K; corpus counts (C16) |
| tagger: lines read on the host they follow (`drawnOn`), a line on each edge ("embattled on the upper edge and embattled grady on the lower edge"), treatments and outlines on the hosts the library draws them on (`MOD_HOSTS`, `COTISED_HOSTS`), counted diminutives (`ORDINARY_COUNTS`) | `gaps.ts` | the library's own tables; guarded by "the tagger never files a record under a construct the widget supports" |

### Phase-D additions at a glance


What phase D has added so far to the matcher, the normaliser and the tagger (corpus counts are the raw occurrences in the current O&A):


| addition | where | source |
|---|---|---|
| the drawn crosses and shapes are read at once: the nouns come from `CHARGES` (lower-cased, so "Latin cross", "Maltese cross" and "Celtic cross" read) | `match.ts` (`NOUNS`), `normalise.ts` (`NOUN`) | D2a ids; the proper adjectives were the first miss |
| `cross-synonyms`: cross fleury/fleurie → flory (cross flory 84, cross fleury 80), formée/pattée/patée/patty/paty → formy, botonny/bottonny → bottony, pattonce/patoncy → patonce; fitched/fitchée and "fitchy at the foot" → fitchy; compass-star → compass star (66); triquetrae → triquetras (22) | `normalise.ts` | Glossary of Terms (spellings); corpus counts (D2b); "delph" and "formee" occur in no current record, so only "delves" (1) is left as a gap |
| a modifier after a noun: `fitchy` joins "in splendor" (`MODIFIER_WORDS` in the library's `blazon`, read by `readGroup` through `modifierAt`); a lone "a cross fitchy" stays the ordinary cross treated (a gap), as does "a cross couped" with its article (D2a) | `match.ts`, `blazon.ts` | App M1f; D2a |
| a matched design that needs a detail the Design tab has no control for yet (a cross fitchy) is filed under `charge-modifier:<detail>` instead of failing the builder check; delete `uncontrolledDetails` when D6b adds the Details disclosure | `classify.ts` | D6b |
| tagger: a cross word the widget draws (`DRAWN_CROSS_VARIANT`, derived from the cross ids) is the charge, not a `charge-cross` gap; "fitchy" after a cross that takes it is untagged, "fitchy at all points" is `charge-modifier:fitchy-at-all-points`; "equal-armed Celtic cross" (the widget's is Latin-proportioned) is `charge-cross:equal-armed-celtic`; "compass rose" stays a gap (`charge-celestial:compass-rose`) while "compass star" is the charge; the supported nouns (compass star, foils, mascle, rustre, fusil, delf, triangle, triquetra, ermine spot) are out of `GAP_CHARGES` | `gaps.ts`, `gap-terms.ts` | the library's own tables; guarded by "the tagger never files a record under a construct the widget supports" |
| records with a compass star and another step from core practice are matched but refused (`widget-structure-rule`, App G, S1) | `classify.ts` (`findingTags`) | PLAN-D §1.7 S1 |
| `facing-synonyms`: contourné/contourne/contournee/contourney → contourny (91); "(facing) to sinister" after a charge that faces and its posture or head words → contourny ("lion rampant to sinister" 47 …); "endorsed" after such a charge → addorsed (a pale's "endorsed" stays its cotises); combattant and respectant → the widget's word for the charge and posture (combattant for beasts and monsters rampant, which says the posture by itself (SENA A5E5a), respectant for the rest: "two wolves sejant respectant" 16, "two ravens respectant" 61); the matcher reads a beast combattant with no posture as rampant; "contourny guardant" → "guardant contourny", "regardant contourny" → "contourny regardant" | `normalise.ts` | GoT; CL 11/2012 (combattant = respectant); SENA §1.1 F6 |
| `readGroup` reads "contourny" after the posture (`facing: 'to-sinister'`) and, after two charges, combattant/respectant/addorsed as a pair (`pair-<word>`, laid out in fess or around a pale); `CONTOURNY` is the library's `FACING_WORD`, the pair words its `PAIRS` | `match.ts` | PLAN-D §3 D4b |
| tagger: contourny, and "to sinister", after a charge that faces, and combattant/respectant/addorsed after two of them, are not filed (`posture:*`, `orientation:to-sinister`); on other charges, or three, they still are | `gaps.ts` | guarded by "the tagger never files a record under a construct the widget supports" and the facing describe |
| `orientation-synonyms`: barwise → fesswise; "inverted bendwise (sinister)" → "bendwise (sinister) inverted" (127 against 177); crescent(s) inverted → crescent(s) pendant (96 against 133) | `normalise.ts` | SENA App G; corpus counts (D5a) |
| `readGroup` reads which way a charge points after contourny: one orientation word or phrase (`ORIENTATION_PHRASES`: the library's `ORIENTATION_WORDS` and each charge's own words, "pendant"), the crescent's nouns increscent and decrescent (`NOUNS` carry the orientation they say), and "points to center" / "horns to center" after the layout (`TO_CENTER_PHRASES`) | `match.ts` | PLAN-D §3 D5b |
| tagger: the orientation words a charge's sidecar row allows (`ORIENTATION_WORDS_OF`; "fesswise reversed" is two words) are not filed after that charge, the crescent's nouns are the charge; on other charges, or other ways, they still are (`orientation:*`) | `gaps.ts`, `gap-terms.ts` | the library's `orient.allowed`; the orientation describe |
| `points-synonyms`: "mullet(s) of five points" → "mullet(s)", "estoile(s) of six rays" → "estoile(s)" (the drawn stars, `canonical`); "estoile(s) of N points" → "of N rays" (40 records against 68); the charged-with and placement patterns (`CORE`) read every modifier word and "of N points/rays" | `normalise.ts` | SENA §1.4 M5; corpus counts (D6b) |
| `readGroup` reads a star's "of N points" (an estoile's "of N rays") and "voided", "pierced" after the noun (`MODIFIER_WORDS`, `pointsWord`), and "fimbriated" with its tincture after the charges' tincture, as a phrase of its own like an ordinary's fimbriation, so the backward tincture carry gives it the next tincture only when it states none | `match.ts` | PLAN-D §3 D6b |
| tagger: "of N points/rays" (4 to 12) after a mullet or estoile, and a detail after a charge whose sidecar `details` holds it (voided, fimbriated, pierced, fitchy), are not filed; other numbers ("of five greater and five lesser points") and other charges still are (`charge-modifier:*`) | `gaps.ts` | the library's `details`, `STAR_POINTS` |
| builder replay: the Details disclosure (points, voided, fimbriated and its tincture, pierced, fitchy) is replayed after the Turned row; the D2b stop-gap that failed a design with a detail without a replay (`uncontrolledDetails`) is gone | `test/builder-path.ts`, `classify.ts` | D6b |
| `form-words`: demi X → demi-X, a head with no cut → "… couped" (the widget always states it), "head contourny erased" → "head erased contourny"; `readGroup` reads "demi-<name>" and the heads' possessive nouns (`NOUNS` carry the form) and a head's cut after its noun; tagger: a drawn head ("a wolf's head"), its cut and a drawn demi charge are not filed (other charges' heads, a demi-boar, a cut on anything else still are) | `normalise.ts`, `match.ts`, `gaps.ts` | D7b |
| builder replay: the Shape row and a head's Cut row are replayed first in each group's sequence (`form`, `cut` actions); the attribute sweeps no longer filter out heads and demi charges | `test/builder-path.ts` | D7b |
| builder replay: a divided field whose parts share a tincture ("per fess argent and argent masoned sable") is set again after the band that separates them (SENA A3B3a) — found by the first D4b sweep (regid:23908) | `test/builder-path.ts` | D4b |
| postures in two words and heads turned: `readGroup` reads a posture in one word or two ("sejant erect", "statant erect": `POSTURE_PHRASES`, the library's `postureWords`) and a head turned (`GAZES`: guardant, regardant) before or after "contourny"; `facing-synonyms` also spells gardant → guardant and reguardant → regardant and puts the head before the pair word ("addorsed regardant" 25 against 8, "combattant guardant" 11 against 0); `posture-terms`: a posture in the charge's own term (`postureWording`): stag salient → springing (48 against 62), passant → trippant (16 against 94), couchant → lodged (2 against 41); `stated-default-postures` is derived from each charge's `scaDefaultPosture` (a posture word that begins a longer one stays: "statant" of "statant erect"); the normaliser's posture and placement patterns read both; tagger: "sejant erect"/"statant erect" are one word, a posture word is filed only when the charge just read lacks that drawing (`posture:<word>`: "a wolf couchant", "a lion statant erect"), a head turned only when the charge has no drawing of its posture with the head so turned ("a lion couchant guardant", "a wolf regardant", a head's head turned) | `match.ts`, `normalise.ts`, `gaps.ts`, `gap-terms.ts` | GoT Table 5; SENA §1.1, §1.2; corpus counts (D8b) |
| `piece-words`: "ducally crowned" and "crowned of (with) a (ducal) coronet" → crowned (12, 3), "gorged of (with) a (ducal) coronet" → collared (52), inflamed → enflamed, leafed → leaved; no comma before a piece or between a run of pieces and its tincture ("a rose, slipped and leaved, gules", 10); "<pieces> T and <piece>" → "<pieces> T <piece>"; a winged beast is the beast winged ("a winged lion passant Or" → "a lion passant winged Or": wings of its tincture, 365 records say "winged <beast>", 11 "<beast> … winged"; "three winged boars argent winged Or" → "three boars argent winged Or"); `CORE` reads a run of pieces | `normalise.ts` | SENA M13; GoT; corpus counts (D9b) |
| `readGroup` reads the trims after the charges' tincture, or straight after the charge when they share it: runs of "fimbriated" and the pieces (`PIECE_IDS`: crowned, collared, winged, enflamed, slipped, leaved) joined by "and", each run a phrase of its own for the tincture it states ("a lion Or crowned and collared gules", "a heart winged Or", "enflamed proper"); a run that states none takes the next tincture stated (Bruce), a charge that states none its first run's, and on a host a charge takes its trims' tincture but nothing crosses the host's edge ("on a chief Or three roses slipped and leaved gules") | `match.ts` | PLAN-D §3 D9b |
| tagger: crowned and collared after a charge whose sidecar `parts` hold them, "gorged of a (ducal) coronet" (collared) and "crowned with a coronet" there with the coronet, "winged" before a charge that takes wings ("a winged lion"), and "proper" after "enflamed" on a charge that takes flames, are not filed; on other charges they still are (`charge-modifier:*`), and a drawing without the place for a piece keeps the library's gap ("a winged lion sejant") | `gaps.ts` | the library's `details`, `parts`, anchors |
| builder replay: the Details disclosure's pieces (winged, enflamed, slipped, leaved with their paint; then the parts crowned and collared, `part` action) are replayed after the other details, before the charge's tincture; `unadorned()` is gone, so builder-layers-reach and the SCA round trip read every adorned design | `test/builder-path.ts` | D9b |
| `hold-words`: "holding", "grasping" and "supporting" a charge are maintaining it (holding 26, grasping 50, supporting 10 against maintaining 1,435); an item in a beak or mouth is "maintaining in its beak (mouth)" however it is held ("maintaining in its beak" 109, "holding" 11, the rest sustaining, bearing or grasping; his, her → its); no comma before "(each) maintaining/sustaining" (388 with, 1,616 without) | `normalise.ts` | SENA App I5, §1.5 H2; corpus counts (D9d) |
| `readGroup` reads what the charges hold after their trims: "maintaining", "sustaining", "maintaining in its beak (mouth)", after "each" for more than one charge (without it they hold one item between them), then a single charge as drawn with its tincture or the next one stated ("a lion maintaining a sword Or": the lion takes the item's); items joined by "and" with no tincture between them are held together ("a sword and a key argent": two items, which the library reports) | `match.ts` | PLAN-D §3 D9d |
| tagger: a hold the widget draws is not filed (`drawnHoldEnd`: a charge alone on the field that holds that way, "each" for more than one, a single holdable charge, then its tincture or what follows); other holds keep `charge-modifier:maintaining` | `gaps.ts` | the library's `holds`, `holdable` |
| builder replay: what a charge holds (`hold` action: the Holding select, the way, the colour) after its parts, before its tincture; `holdsNothing()` is gone, so builder-layers-reach and the SCA round trip read every holding design | `test/builder-path.ts` | D9d |


### Normalisation

`test/sca/normalise.ts` is applied to the SCA blazon and to the widget's alike. It only bridges spelling and
punctuation (`final-full-stop`, `case`, `spelling`) and five conventions that the Glossary, Bruce and the LoARs
treat as equivalent, which the widget's emitter has to pick one of (`equivalent-connectors`, which also gives each corner or edge shape the joiner the O&A uses most before it — "and a base", ", a point pointed", "and a canton", ", a quarter", "and a gyron": counts in `PERIPHERAL_JOINER` —,
`arrangement-placement`, `stated-default-postures` (each charge's `scaDefaultPosture`), `divided-groups`, and `corner-beside-bend`: one charge "in sinister chief" beside a bend is the widget's "in chief" there, above), the spellings of a line of partition (`line-synonyms`: "undy" is wavy, "crenellated" embattled, "ployee" ployé, "beviled" bevilled, "rompú" rompu; and the convention that a division has one line, so "per pale dancetty" is "per pale indented", RULES §A.3, as is every band or shape that takes indented but not dancetty, read from `lineAllowed`: a chief, bordure, base, canton, quarter, gyron, cross, saltire, pile, pall, orle, tressure, flaunches or gore dancetty is indented), the treatments of an ordinary (`ordinary-treatments`: "humetty" is couped and "chevron reversed" a chevron inverted, RULES-C §G.2; "inverted" stands before the line and "couped" after it, PLAN-C §4 from the corpus counts, so "a pile wavy inverted" (every band or shape that takes inverted, `MOD_HOSTS.inverted`: the pall and chevronels too) and "a fess couped embattled" are reordered; a bare "chevron inverted embattled" is its upper edge, which the widget names, PLAN-C §4 L2; "a bendlet enhanced" is a bend enhanced, RULES-C §D.6; "throughout" after a cross or saltire says nothing, RULES-C §D.2 — the matcher reads `[inverted] [line] [couped] [throughout|enhanced|abased]` after an ordinary's name, and the tagger reads one cross couped, humetty or voided with its article as the ordinary), the outline of a band (`ordinary-outlines`: "cotissed" and "cottised" are cotised, "double" and "triple cotised" doubly and triply cotised, a pale's single pair is "endorsed" in the widget's words, "between two cotises" is cotised, no comma stands before the outline, and "cotised couped" is "couped cotised" — the matcher reads `[T] ('fimbriated' [T] | ['doubly'|'triply'] ('cotised'|'endorsed') ['plain'|line] [T])` after an ordinary's form, a tincture stated once for a band and its cotises, or for its fimbriation and what follows, being the one the others share; the tagger leaves "cotised" and "fimbriated" untagged on the hosts the widget draws them on, "doubly/triply cotised" is joined to "cotised", and "endorsed" straight after an ordinary's name and tincture is its cotises, never the posture addorsed), and the names of a semy (`semy-names`: "crusilly argent",
"bezanty" and "semy of roses argent" are one thing, the tincture left unsaid being the next one stated). A stated Table 7 arrangement is
not dropped as text: the matcher also compares the SCA blazon with the widget's blazon of the same design with its defaults stated
(`blazon(design, { stateDefaults: true })`), and with the tincture of every element stated, not once for a run of elements that
share it ("a lion argent and a bordure argent mullety sable": `blazon(design, { stateTinctures: true })`). To see how many passing records depend on a rule, replace its
`apply` with the identity locally and count the records that stop passing (never commit the change).

The words the normaliser, matcher and tagger read for the library's constructs — division names and how a divided field starts, the
bands written with a line after their name, a band's edge names, the forms that take "sinister" or "inverted", a bend's family, the drawn division
forms, the number words and the cotise words — are built from the library's tables in `test/sca/words.ts` (and the library's `COUNTER_EMBATTLED_WORDS`, `SAME_ORDINARY`,
`THROUGHOUT_ALREADY`, `MODS_BEFORE_LINE` and `MODS_AFTER_LINE`), never typed out again, so a construct the library gains is read everywhere.

## Refreshing the database

1. Re-download https://oanda.sca.org/oanda.db verbatim (no decoding or line-ending changes) over
   `oanda.db`, and refresh `NOTICE.txt` from the notice at its head if that has changed.
2. Update `OANDA_SHA256` in `test/sca/oanda.ts` and the version, size and sha256 in this README.
3. Regenerate the ignore list (`npm run sca:ignore`) and run `npm test`.
