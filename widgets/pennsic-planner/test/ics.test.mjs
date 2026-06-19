// Proves the .ics exporter (src/lib/ics.js) emits well-formed, zoned iCalendar.
// Run with: node test/ics.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildIcs, escapeText, foldLine } from '../src/lib/ics.js';

const here = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(here, '../src/data/sample-2026.json'), 'utf8'));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  ok  -', name);
  else {
    failures++;
    console.error('  FAIL -', name, detail != null ? '::' + detail : '');
  }
}

// Use a deterministic DTSTAMP so the assertions are stable.
const selection = sample.slice(0, 12);
const ics = buildIcs(selection, { dtstamp: '20260617T000000Z' });

check('starts with BEGIN:VCALENDAR', ics.startsWith('BEGIN:VCALENDAR'));
check('ends with END:VCALENDAR', ics.trimEnd().endsWith('END:VCALENDAR'));
check('has VERSION:2.0', ics.includes('VERSION:2.0'));
check('has PRODID', /PRODID:.+/.test(ics));
check('uses CRLF line endings', ics.includes('\r\n') && !/[^\r]\n/.test(ics));

// Exactly one VTIMEZONE for America/New_York.
check('one VTIMEZONE', (ics.match(/BEGIN:VTIMEZONE/g) || []).length === 1);
check('VTIMEZONE is America/New_York', ics.includes('TZID:America/New_York'));
check('has DAYLIGHT + STANDARD', ics.includes('BEGIN:DAYLIGHT') && ics.includes('BEGIN:STANDARD'));

// One VEVENT per selected session, balanced BEGIN/END.
const begins = (ics.match(/BEGIN:VEVENT/g) || []).length;
const ends = (ics.match(/END:VEVENT/g) || []).length;
check('VEVENT count == selection', begins === selection.length, `${begins} vs ${selection.length}`);
check('VEVENT begin/end balanced', begins === ends, `${begins}/${ends}`);

// Every event has zoned DTSTART/DTEND (TZID, not floating or Z).
const dtstarts = ics.match(/DTSTART;TZID=America\/New_York:\d{8}T\d{6}/g) || [];
check('all event DTSTART zoned with TZID', dtstarts.length === selection.length, dtstarts.length);
// Within VEVENT blocks specifically, no floating/naive DTSTART (VTIMEZONE observances may be floating).
const eventBlocks = ics.split('BEGIN:VEVENT').slice(1);
const floatingInEvent = eventBlocks.some((b) => /DTSTART:\d{8}T\d{6}/.test(b.split('END:VEVENT')[0]));
check('no floating DTSTART inside any VEVENT', !floatingInEvent);
const dtends = ics.match(/DTEND;TZID=America\/New_York:\d{8}T\d{6}/g) || [];
check('all DTEND zoned with TZID', dtends.length === selection.length, dtends.length);

// UIDs stable + unique + correct domain.
const uids = ics.match(/UID:[^\r\n]+/g) || [];
check('one UID per event', uids.length === selection.length, uids.length);
check('UIDs use widget domain', uids.every((u) => u.endsWith('@pennsic-planner.widgets.beshir.org')));
check('UIDs unique', new Set(uids).size === uids.length);

// Required per-event props.
check('every event STATUS:CONFIRMED', (ics.match(/STATUS:CONFIRMED/g) || []).length === selection.length);
check('every event DTSTAMP', (ics.match(/DTSTAMP:20260617T000000Z/g) || []).length === selection.length);
check('every event SUMMARY', (ics.match(/SUMMARY:/g) || []).length === selection.length);

// Line folding: no content line exceeds 75 octets.
const enc = new TextEncoder();
const tooLong = ics.split('\r\n').filter((l) => enc.encode(l).length > 75);
check('no line exceeds 75 octets', tooLong.length === 0, tooLong[0]);

// Escaping unit checks.
check('escapes comma', escapeText('a,b') === 'a\\,b');
check('escapes semicolon', escapeText('a;b') === 'a\\;b');
check('escapes backslash', escapeText('a\\b') === 'a\\\\b');
check('escapes newline', escapeText('a\nb') === 'a\\nb');

// Fold round-trip: unfolding (\r\n + space -> '') restores the original.
const long = 'X'.repeat(200);
const folded = foldLine('DESCRIPTION:' + long);
const unfolded = folded.replace(/\r\n /g, '');
check('fold then unfold restores content', unfolded === 'DESCRIPTION:' + long);

if (failures > 0) {
  console.error(`\nics.test: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nics.test: all checks passed');
