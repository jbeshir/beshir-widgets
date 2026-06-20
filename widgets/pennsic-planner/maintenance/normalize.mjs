// @ts-check
// Maintenance normalizer for the Thing (thing.pennsicuniversity.org) `calendars` CSV export.
// This is a build-time / maintenance tool, NOT part of the shipped bundle: it produces the bundled
// src/data/sessions-2026.json from a downloaded Thing CSV. Schedule updates are made by re-running
// this against a fresh export and committing the regenerated JSON — there is no in-app import.
// Pure ESM JS, dependency-free; covered by the Node test test/importer.test.mjs.

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Tolerant RFC-4180-ish CSV parser. Handles quoted fields, embedded commas/newlines, and ""
 * escaped quotes. Returns an array of string[] rows. Tolerates CRLF and a trailing newline.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  // Strip a UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (c === '\r') {
      i++; // swallow; handled by \n
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else {
      field += c;
      i++;
    }
  }
  // Flush trailing field/row if any content remains.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Canonical column -> accepted header aliases (compared lowercased, non-alphanumerics stripped).
const COLUMN_ALIASES = {
  startTime: ['starttime', 'start', 'begins', 'begin', 'startdate'],
  endTime: ['endtime', 'end', 'ends', 'finish', 'enddate'],
  topic: ['topic', 'category', 'track'],
  location: ['sessionlocationname', 'location', 'locationname', 'room', 'site'],
  instructor: ['instructorname', 'instructor', 'teacher', 'presenter'],
  instructorKingdom: ['instructorkingdom', 'kingdom'],
  title: ['classtitle', 'title', 'name', 'class'],
  description: ['shortdescription', 'description', 'desc', 'summary'],
  materialFee: ['materialfee', 'materialscost', 'materialcost', 'materials'],
  handoutFee: ['handoutfee', 'handoutcost', 'handout'],
  adultReason: ['adultonlyreason', 'adultreason', 'adultonly', 'adult'],
};

function canon(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Build a map from canonical column name -> column index, tolerant of header variants.
 * @param {string[]} header
 */
function mapColumns(header) {
  const idx = {};
  const canonHeader = header.map(canon);
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    let found = -1;
    for (const alias of aliases) {
      const at = canonHeader.indexOf(alias);
      if (at !== -1) {
        found = at;
        break;
      }
    }
    idx[key] = found;
  }
  return idx;
}

/** Parse "Sat, Jul 25 04:00PM" into a calendar struct, inferring the year (default 2026). */
function parseThingDate(raw, defaultYear) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Optional leading weekday: "Sat, " — captured to disambiguate the year if needed.
  const m = /^(?:([A-Za-z]{3,}),?\s*)?([A-Za-z]{3,})\s+(\d{1,2})(?:,?\s*(\d{4}))?\s+(\d{1,2}):(\d{2})\s*([AaPp])[Mm]?$/.exec(s);
  if (!m) return null;
  const wdayName = m[1] ? m[1].slice(0, 3).toLowerCase() : null;
  const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!mo) return null;
  const d = Number(m[3]);
  let h = Number(m[5]);
  const min = Number(m[6]);
  const ap = m[7].toLowerCase();
  if (ap === 'p' && h !== 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;

  let year = m[4] ? Number(m[4]) : defaultYear;
  if (!m[4] && wdayName) {
    // Verify the default year's weekday; if it disagrees, search nearby years for a match.
    const wantWday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(wdayName);
    if (wantWday !== -1 && weekday(year, mo, d) !== wantWday) {
      for (let y = defaultYear - 3; y <= defaultYear + 3; y++) {
        if (weekday(y, mo, d) === wantWday) {
          year = y;
          break;
        }
      }
    }
  }
  return { year, mo, d, h, min };
}

function weekday(y, mo, d) {
  return new Date(Date.UTC(y, mo - 1, d, 12)).getUTCDay();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toMinutesUTC(dt) {
  // Minutes since an arbitrary epoch (UTC noon basis) for duration math; tz-agnostic since both
  // ends are treated identically as wall-clock.
  return Date.UTC(dt.year, dt.mo - 1, dt.d, dt.h, dt.min) / 60000;
}

function parseFee(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/[$,\s]/g, '').trim();
  if (s === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

// Strip surrounding markdown emphasis (*, **, ***) and collapse whitespace.
function cleanTitle(raw) {
  let s = String(raw == null ? '' : raw).trim();
  s = s.replace(/^\*+/, '').replace(/\*+$/, '').trim();
  return s.replace(/\s+/g, ' ');
}

// Small, stable, dependency-free string hash (FNV-1a, hex) for grouping repeats into a classId.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/**
 * Normalize a Thing `calendars` CSV export into the bundled Session schema.
 * @param {string} text - raw CSV text
 * @param {{defaultYear?: number}} [opts]
 * @returns {import('../src/types').Session[]}
 */
export function normalizeCsv(text, opts = {}) {
  const defaultYear = opts.defaultYear || 2026;
  const rows = parseCsv(text).filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
  if (rows.length < 2) return [];
  const header = rows[0];
  const col = mapColumns(header);
  if (col.startTime === -1 || col.endTime === -1 || col.title === -1) {
    throw new Error(
      'Unrecognized CSV: could not find start/end/title columns. Expected a Thing calendars export ' +
        '(start_time, end_time, topic, session_location_name, instructor_name, instructor_kingdom, ' +
        'class_title, short_description, material_fee, handout_fee, adult_only_reason).'
    );
  }

  const get = (row, key) => (col[key] === -1 ? '' : (row[col[key]] ?? '')).toString();

  // First pass: parse rows into draft records (collecting title|instructor for repeatCount).
  const drafts = [];
  /** @type {Map<string, number>} */
  const repeatKeyCount = new Map();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => String(c).trim() === '')) continue;
    const startDt = parseThingDate(get(row, 'startTime'), defaultYear);
    const endDtRaw = parseThingDate(get(row, 'endTime'), defaultYear);
    const title = cleanTitle(get(row, 'title'));
    if (!startDt || !title) continue; // need at least a start and a title

    // End may be missing/unparseable; fall back to start + 60 min.
    const endDt = endDtRaw || addMinutes(startDt, 60);
    let durationMin = Math.round(toMinutesUTC(endDt) - toMinutesUTC(startDt));
    if (!Number.isFinite(durationMin) || durationMin <= 0) durationMin = 60;

    const topicRaw = get(row, 'topic').trim();
    const topic = topicRaw || 'Other';
    const colonIdx = topic.indexOf(':');
    const track = (colonIdx > 0 ? topic.slice(0, colonIdx) : topic).trim() || 'Other';

    let instructor = get(row, 'instructor').trim();
    instructor = instructor === '' ? null : instructor;

    let kingdom = get(row, 'instructorKingdom').trim();
    if (kingdom === '' || /^no kingdom$/i.test(kingdom)) kingdom = null;

    let location = get(row, 'location').trim();
    location = location === '' ? null : location;

    const adultReasonRaw = get(row, 'adultReason').trim();
    const adultOnly = adultReasonRaw !== '';
    const adultReason = adultOnly ? adultReasonRaw : null;

    const materialFee = parseFee(get(row, 'materialFee'));
    const handoutFee = parseFee(get(row, 'handoutFee'));
    const hasFee = (materialFee != null && materialFee > 0) || (handoutFee != null && handoutFee > 0);

    const description = get(row, 'description').trim() || null;

    const day = `${startDt.year}-${pad(startDt.mo)}-${pad(startDt.d)}`;
    const startTime = `${pad(startDt.h)}:${pad(startDt.min)}`;
    const endTime = `${pad(endDt.h)}:${pad(endDt.min)}`;
    const start = `${day}T${startTime}:00`;
    const end = `${endDt.year}-${pad(endDt.mo)}-${pad(endDt.d)}T${endTime}:00`;

    const repeatKey = title + '||' + (instructor || '');
    repeatKeyCount.set(repeatKey, (repeatKeyCount.get(repeatKey) || 0) + 1);

    drafts.push({
      title, instructor, kingdom, track, topic, day, start, end, startTime, endTime,
      durationMin, location, description, adultOnly, adultReason, materialFee, handoutFee,
      hasFee, repeatKey,
    });
  }

  // Second pass: assign ids, classIds, repeatCounts.
  return drafts.map((d, i) => ({
    id: `imp-${String(i).padStart(5, '0')}`,
    classId: `imp-c${hash(d.repeatKey)}`,
    title: d.title,
    instructor: d.instructor,
    instructorKingdom: d.kingdom,
    track: d.track,
    topic: d.topic,
    culture: null,
    day: d.day,
    start: d.start,
    end: d.end,
    startTime: d.startTime,
    endTime: d.endTime,
    durationMin: d.durationMin,
    location: d.location,
    description: d.description,
    descriptionBook: d.description,
    adultOnly: d.adultOnly,
    adultReason: d.adultReason,
    handoutFee: d.handoutFee,
    materialFee: d.materialFee,
    feeItemization: null,
    hasFee: d.hasFee,
    repeatCount: repeatKeyCount.get(d.repeatKey) || 1,
    timezone: 'America/New_York',
    source: 'thing.pennsicuniversity.org calendars CSV (in-browser import)',
    synthetic: false,
  }));
}

function addMinutes(dt, mins) {
  const ms = Date.UTC(dt.year, dt.mo - 1, dt.d, dt.h, dt.min) + mins * 60000;
  const x = new Date(ms);
  return { year: x.getUTCFullYear(), mo: x.getUTCMonth() + 1, d: x.getUTCDate(), h: x.getUTCHours(), min: x.getUTCMinutes() };
}
