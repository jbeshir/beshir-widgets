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
rewrites the whole file. The run fails, writing nothing, if a matched design the widget would
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

## Refreshing the database

1. Re-download https://oanda.sca.org/oanda.db verbatim (no decoding or line-ending changes) over
   `oanda.db`, and refresh `NOTICE.txt` from the notice at its head if that has changed.
2. Update `OANDA_SHA256` in `test/sca/oanda.ts` and the version, size and sha256 in this README.
3. Regenerate the ignore list (`npm run sca:ignore`) and run `npm test`.
