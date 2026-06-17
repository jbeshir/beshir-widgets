// @ts-check
// RFC-5545 iCalendar export. One timed VEVENT per selected session, zoned to America/New_York via
// a bundled VTIMEZONE so calendars place events at the correct Eastern wall-clock time (never
// floating/naive). Pure ESM JS, dependency-free; shared by the app and test/ics.test.mjs.

const DOMAIN = 'pennsic-planner.widgets.beshir.org';

// A self-contained VTIMEZONE for America/New_York covering the modern US DST rule (2nd Sun Mar /
// 1st Sun Nov). Pennsic is late Jul–early Aug, firmly in EDT (-0400), but we ship both observances
// so any UID/date a user imports resolves correctly.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'X-LIC-LOCATION:America/New_York',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** RFC-5545 TEXT escaping: backslash, semicolon, comma, and newlines. */
export function escapeText(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Fold a content line to <=75 octets per line, continuation lines start with a single space. */
export function foldLine(line) {
  // Work in UTF-8 octets so multibyte characters don't get split across the 75-octet boundary.
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Avoid splitting a multibyte sequence: back off while the next byte is a UTF-8 continuation.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((start === 0 ? '' : ' ') + dec.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74; // subsequent lines reserve one octet for the leading space
  }
  return out.join('\r\n');
}

/** "2026-07-25" + "16:00" -> "20260725T160000" (local, used with TZID). */
function toIcsLocal(day, hm) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day));
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(hm));
  if (!dm || !tm) return null;
  return `${dm[1]}${dm[2]}${dm[3]}T${tm[1].padStart(2, '0')}${tm[2]}00`;
}

/** End datetime from a session's end ISO ("YYYY-MM-DDTHH:MM:SS") -> "YYYYMMDDTHHMMSS". */
function endStamp(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s.end || ''));
  if (m) return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00`;
  return toIcsLocal(s.day, s.endTime);
}

/**
 * Build a complete iCalendar document for the given sessions.
 * @param {import('../types').Session[]} sessions
 * @param {{dtstamp?: string}} [opts] - dtstamp override (UTC "YYYYMMDDTHHMMSSZ") for deterministic tests
 * @returns {string} CRLF-joined .ics text
 */
export function buildIcs(sessions, opts = {}) {
  const dtstamp = opts.dtstamp || utcStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//beshir.org//Pennsic Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE,
  ];

  for (const s of sessions) {
    const dtStart = toIcsLocal(s.day, s.startTime);
    const dtEnd = endStamp(s);
    if (!dtStart || !dtEnd) continue;
    const descParts = [];
    if (s.topic) descParts.push(s.topic);
    if (s.instructor) descParts.push('Instructor: ' + s.instructor + (s.instructorKingdom ? ' (' + s.instructorKingdom + ')' : ''));
    if (s.description) descParts.push(s.description);
    if (s.hasFee) {
      const fees = [];
      if (s.materialFee) fees.push('material $' + s.materialFee);
      if (s.handoutFee) fees.push('handout $' + s.handoutFee);
      if (fees.length) descParts.push('Fees: ' + fees.join(', '));
    }
    if (s.adultOnly) descParts.push('Adult only' + (s.adultReason ? ': ' + s.adultReason : ''));

    const ev = [
      'BEGIN:VEVENT',
      `UID:${s.id}@${DOMAIN}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=America/New_York:${dtStart}`,
      `DTEND;TZID=America/New_York:${dtEnd}`,
      `SUMMARY:${escapeText(s.title)}`,
    ];
    if (s.location) ev.push(`LOCATION:${escapeText(s.location)}`);
    if (descParts.length) ev.push(`DESCRIPTION:${escapeText(descParts.join('\n'))}`);
    if (s.track) ev.push(`CATEGORIES:${escapeText(s.track)}`);
    ev.push('STATUS:CONFIRMED');
    ev.push('END:VEVENT');
    lines.push(...ev);
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function utcStamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    p(date.getUTCMonth() + 1) +
    p(date.getUTCDate()) +
    'T' +
    p(date.getUTCHours()) +
    p(date.getUTCMinutes()) +
    p(date.getUTCSeconds()) +
    'Z'
  );
}
