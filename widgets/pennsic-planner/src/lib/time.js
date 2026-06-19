// @ts-check
// Time helpers. All Pennsic times are Eastern wall-clock; we work in minutes-of-day and never
// convert to UTC for layout. The .ics builder (ics.js) emits a VTIMEZONE so calendars zone them.

/** "HH:MM" -> minutes since midnight. Returns NaN on malformed input. */
export function hmToMinutes(hm) {
  if (typeof hm !== 'string') return NaN;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** minutes since midnight -> "HH:MM" (24h, zero-padded). */
export function minutesToHm(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

/** "16:00" -> "4:00 PM" (US 12h, friendly). */
export function to12h(hm) {
  const min = hmToMinutes(hm);
  if (Number.isNaN(min)) return hm;
  let h = Math.floor(min / 60);
  const mm = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return h + ':' + String(mm).padStart(2, '0') + ' ' + ampm;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse a "YYYY-MM-DD" day string into {y,m,d} (no timezone math). */
function parseDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day));
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

/** Day-of-week index (0=Sun) for a "YYYY-MM-DD" using the proleptic Gregorian calendar (UTC-safe). */
export function dayOfWeek(day) {
  const p = parseDay(day);
  if (!p) return -1;
  // Construct at UTC noon to avoid any local-tz date rollover.
  return new Date(Date.UTC(p.y, p.mo - 1, p.d, 12)).getUTCDay();
}

/** "2026-07-25" -> "Sat, Jul 25". */
export function shortDayLabel(day) {
  const p = parseDay(day);
  if (!p) return day;
  return WEEKDAY[dayOfWeek(day)] + ', ' + MONTH[p.mo - 1] + ' ' + p.d;
}

/** "2026-07-25" -> "Saturday, July 25". */
export function longDayLabel(day) {
  const p = parseDay(day);
  if (!p) return day;
  const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return WEEKDAY_LONG[dayOfWeek(day)] + ', ' + MONTH_LONG[p.mo - 1] + ' ' + p.d;
}
