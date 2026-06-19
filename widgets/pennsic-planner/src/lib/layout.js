// @ts-check
import { hmToMinutes } from './time.js';

function minutesEnd(s) {
  let end = hmToMinutes(s.endTime);
  const start = hmToMinutes(s.startTime);
  // Guard against malformed/zero-length: ensure a visible minimum and handle end<=start.
  if (!Number.isFinite(end) || end <= start) {
    end = Number.isFinite(start) ? start + (s.durationMin || 30) : end;
  }
  return end;
}

/**
 * Detect time conflicts among a set of sessions (used by the My Plan view).
 * Two sessions conflict if they share any minute on the same day.
 * @param {import('../types').Session[]} sessions
 * @returns {Set<string>} ids of sessions that overlap at least one other selected session
 */
export function findConflicts(sessions) {
  const conflicting = new Set();
  const byDay = new Map();
  for (const s of sessions) {
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day).push(s);
  }
  for (const list of byDay.values()) {
    const spans = list
      .map((s) => ({ id: s.id, a: hmToMinutes(s.startTime), b: minutesEnd(s) }))
      .filter((x) => Number.isFinite(x.a) && Number.isFinite(x.b))
      .sort((x, y) => x.a - y.a);
    for (let i = 0; i < spans.length; i++) {
      for (let k = i + 1; k < spans.length; k++) {
        if (spans[k].a >= spans[i].b) break; // sorted by start; no further overlap with i
        conflicting.add(spans[i].id);
        conflicting.add(spans[k].id);
      }
    }
  }
  return conflicting;
}
