# Maintenance scripts

Tools used to maintain the widget's bundled data. These are **not** part of the shipped SPA bundle
and are never imported by `src/`.

## `normalize.mjs`

Normalizes a [Thing](https://thing.pennsicuniversity.org) `calendars` CSV export into the bundled
`Session` schema used by `src/data/sessions-2026.json`.

The widget ships a fixed schedule snapshot; there is no in-app upload. To refresh the schedule:

1. Download a fresh `calendars` CSV export from the Thing.
2. Regenerate the bundled JSON, e.g.:
   ```sh
   node -e "import('./maintenance/normalize.mjs').then(async m => {
     const fs = await import('node:fs');
     const csv = fs.readFileSync(process.argv[1], 'utf8');
     fs.writeFileSync('src/data/sessions-2026.json', JSON.stringify(m.normalizeCsv(csv)));
   })" path/to/export.csv
   ```
3. Commit the regenerated `src/data/sessions-2026.json`.

`test/importer.test.mjs` exercises this normalizer against the committed fixture
(`test/fixtures/pennsic-2026-schedule.csv`) so the generator stays correct.

To add a **new event** (e.g. a future Pennsic), generate its schedule JSON the same way, then add an
entry to `src/data/events.ts` and seed a row in `schema.sql`.
