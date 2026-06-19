// Proves the in-browser CSV importer (src/lib/normalize.js) reproduces the bundled normalization
// against the REAL Thing export. Run with: node test/importer.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { normalizeCsv } from '../src/lib/normalize.js';

const here = dirname(fileURLToPath(import.meta.url));

// Prefer the live mount; fall back to the committed fixture so the test is reproducible in /out.
const candidates = [
  '/workspace/pennsic-2026-schedule.csv',
  resolve(here, 'fixtures/pennsic-2026-schedule.csv'),
];
const csvPath = candidates.find((p) => existsSync(p));
if (!csvPath) {
  console.error('FAIL: no CSV found at', candidates.join(' or '));
  process.exit(1);
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('  ok  -', name);
  } else {
    failures++;
    console.error('  FAIL -', name, detail != null ? '::' + detail : '');
  }
}

console.log('importer.test: parsing', csvPath);
const text = readFileSync(csvPath, 'utf8');
const t0 = Date.now();
const records = normalizeCsv(text);
console.log(`  parsed ${records.length} records in ${Date.now() - t0}ms`);

// ~1,836 records (allow a small tolerance for blank-row trimming differences).
check('record count near 1836', records.length >= 1700 && records.length <= 1900, records.length);

// Every record has the required schema fields with correct types.
const REQUIRED = [
  ['id', 'string'], ['classId', 'string'], ['title', 'string'], ['track', 'string'],
  ['topic', 'string'], ['day', 'string'], ['start', 'string'], ['end', 'string'],
  ['startTime', 'string'], ['endTime', 'string'], ['durationMin', 'number'],
  ['adultOnly', 'boolean'], ['hasFee', 'boolean'], ['repeatCount', 'number'],
  ['timezone', 'string'], ['synthetic', 'boolean'],
];
let schemaBad = 0;
let badDetail = '';
for (const r of records) {
  for (const [key, typ] of REQUIRED) {
    if (typeof r[key] !== typ) {
      schemaBad++;
      if (!badDetail) badDetail = `${r.id}.${key} is ${typeof r[key]} (want ${typ})`;
      break;
    }
  }
}
check('all records match schema', schemaBad === 0, `${schemaBad} bad; first: ${badDetail}`);

// Sanity: day format, time format, durations positive, ids unique.
const dayOk = records.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day));
check('all days are YYYY-MM-DD', dayOk);
const timeOk = records.every((r) => /^\d{2}:\d{2}$/.test(r.startTime) && /^\d{2}:\d{2}$/.test(r.endTime));
check('all times are HH:MM', timeOk);
const durOk = records.every((r) => Number.isInteger(r.durationMin) && r.durationMin > 0);
check('all durations positive integers', durOk);
const ids = new Set(records.map((r) => r.id));
check('ids unique', ids.size === records.length, `${records.length - ids.size} dupes`);

// The known first row: "Sat, Jul 25 04:00PM" -> day 2026-07-25, 16:00–17:00, track "Meetings".
const first = records[0];
check('first row day 2026-07-25', first.day === '2026-07-25', first.day);
check('first row start 16:00', first.startTime === '16:00', first.startTime);
check('first row duration 60', first.durationMin === 60, first.durationMin);
check('first row track Meetings', first.track === 'Meetings', first.track);

// Track derivation: "Combat: Archery" -> track "Combat".
const colonTopic = records.find((r) => r.topic.includes(':'));
if (colonTopic) {
  check('track is text before first colon', colonTopic.track === colonTopic.topic.split(':')[0].trim(), `${colonTopic.track} / ${colonTopic.topic}`);
}

// Day coverage spans the 14-day event.
const days = [...new Set(records.map((r) => r.day))].sort();
check('covers >= 10 days', days.length >= 10, days.length);
check('first day 2026-07-25', days[0] === '2026-07-25', days[0]);

// "No Kingdom" mapped to null.
const noKingdomLeak = records.some((r) => r.instructorKingdom != null && /no kingdom/i.test(r.instructorKingdom));
check('no "No Kingdom" leaks into instructorKingdom', !noKingdomLeak);

// repeatCount consistency: a class appearing N times has repeatCount N on each occurrence.
const byKey = new Map();
for (const r of records) {
  const k = r.title + '||' + (r.instructor || '');
  byKey.set(k, (byKey.get(k) || 0) + 1);
}
const repeatOk = records.every((r) => r.repeatCount === byKey.get(r.title + '||' + (r.instructor || '')));
check('repeatCount matches occurrence count', repeatOk);

if (failures > 0) {
  console.error(`\nimporter.test: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nimporter.test: all checks passed');
