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
rewrites the whole file. It is the authoritative full sweep: unlike `npm test`, which samples the expensive per-record checks (the builder replay, the gap tagger on ignored records; `test/sca/sample.ts`), it checks every record in full. The run fails, writing nothing, if a matched design the widget would
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
- The armorial test fails in three cases: a listed record now passes (regenerate the list), a listed
  record no longer has its group's gap, or an unlisted record fails.

## How a record is matched

`test/sca/match.ts` reads the normalised blazon with a small token grammar (`blazon := field [',' element (connector element)*]`;
elements are an ordinary with an optional "on" and tincture, "between", or a charge group with its position,
count, noun, posture, "in splendor", pattern or rows and tincture; a phrase without a tincture takes the next one
stated) and proposes the design input it describes, with arrangements left out unless the blazon words them. The
widget's own `blazon()` of that design, passed through the same normaliser, must equal the SCA text: the parser only
proposes, the comparison accepts. The outcome is one of:

| status | meaning |
|---|---|
| `fieldless` | "(Fieldless) …": the widget always has a field |
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
design; "a canton sinister" and "a sinister canton" are read alike (`corner-shapes`), and the tagger asks the library, on a stand-in design, whether
the ordinaries it read stand together (`drawnTogether`), so a second of one type stays `multiple-groups:peripherals`. The orle, the double
and triple tressure, flaunches and the gore (and gore sinister) are read too: "a double tressure" is the tressure drawn twice, flaunches
take no article, and "within" joins only an orle or tressure (the widget's words: "a heart within an orle gules", "between flaunches");
`peripheral-forms` reads "a tressure" as an orle (a single tressure is one, Prec Gwynaeth 04/2004), "two flaunches" and "a pair of
flaunches" as flaunches, "a sinister gore" as "a gore sinister" and "a dexter point" as "a point dexter", and the connectors rule
puts " within " before an orle or tressure and " between " before flaunches (O&A counts in `PERIPHERAL_JOINER`). A dexter or sinister
point matches and is filed as the widget's refusal (`widget-structure-rule`, RULES-C §C.3, L21), not as a gap. A matched design that
the widget registers but cannot blazon, draw or build is a widget bug (`fails`), never ignored.

### Normalisation

`test/sca/normalise.ts` is applied to the SCA blazon and to the widget's alike. It only bridges spelling and
punctuation (`final-full-stop`, `case`, `spelling`) and three conventions that the Glossary, Bruce and the LoARs
treat as equivalent, which the widget's emitter has to pick one of (`equivalent-connectors`, which also gives each corner or edge shape the joiner the O&A uses most before it — "and a base", ", a point pointed", "and a canton", ", a quarter", "and a gyron": counts in `PERIPHERAL_JOINER` —,
`arrangement-placement`, `stated-default-postures`, `divided-groups`), the spellings of a line of partition (`line-synonyms`: "undy" is wavy, "crenellated" embattled, "ployee" ployé; and the convention that a division has one line, so "per pale dancetty" is "per pale indented", RULES §A.3, as is a one-edged band: a chief, bordure, base, canton, quarter or gyron dancetty is indented), the treatments of an ordinary (`ordinary-treatments`: "humetty" is couped and "chevron reversed" a chevron inverted, RULES-C §G.2; "inverted" stands before the line and "couped" after it, PLAN-C §4 from the corpus counts, so "a pile wavy inverted" and "a fess couped embattled" are reordered; a bare "chevron inverted embattled" is its upper edge, which the widget names, PLAN-C §4 L2; "a bendlet enhanced" is a bend enhanced, RULES-C §D.6; "throughout" after a cross or saltire says nothing, RULES-C §D.2 — the matcher reads `[inverted] [line] [couped] [throughout|enhanced|abased]` after an ordinary's name, and the tagger reads one cross couped, humetty or voided with its article as the ordinary), the outline of a band (`ordinary-outlines`: "cotissed" and "cottised" are cotised, "double" and "triple cotised" doubly and triply cotised, a pale's single pair is "endorsed" in the widget's words, "between two cotises" is cotised, no comma stands before the outline, and "cotised couped" is "couped cotised" — the matcher reads `[T] ('fimbriated' [T] | ['doubly'|'triply'] ('cotised'|'endorsed') ['plain'|line] [T])` after an ordinary's form, a tincture stated once for a band and its cotises, or for its fimbriation and what follows, being the one the others share; the tagger leaves "cotised" and "fimbriated" untagged on the hosts the widget draws them on, and "doubly/triply cotised" and "pale endorsed" are joined to "cotised"), and the names of a semy (`semy-names`: "crusilly argent",
"bezanty" and "semy of roses argent" are one thing, the tincture left unsaid being the next one stated). A stated Table 7 arrangement is
not dropped as text: the matcher also compares the SCA blazon with the widget's blazon of the same design with its defaults stated
(`blazon(design, { stateDefaults: true })`), and with the tincture of every element stated, not once for a run of elements that
share it ("a lion argent and a bordure argent mullety sable": `blazon(design, { stateTinctures: true })`). To see how many passing records depend on a rule, replace its
`apply` with the identity locally and count the records that stop passing (never commit the change).

## Refreshing the database

1. Re-download https://oanda.sca.org/oanda.db verbatim (no decoding or line-ending changes) over
   `oanda.db`, and refresh `NOTICE.txt` from the notice at its head if that has changed.
2. Update `OANDA_SHA256` in `test/sca/oanda.ts` and the version, size and sha256 in this README.
3. Regenerate the ignore list (`npm run sca:ignore`) and run `npm test`.
