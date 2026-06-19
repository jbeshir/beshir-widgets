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
 * Compute the padded end minute for a session, consistent with the lane-layout algorithm.
 * @param {import('../types').Session} s
 * @returns {number}
 */
export function sessionEndMin(s) { return minutesEnd(s); }

/**
 * Lay out one day's sessions into side-by-side lanes so concurrent sessions never overlap visually.
 * Sort by start; grow clusters of transitively-overlapping spans; greedily assign each the lowest
 * free lane; the cluster's lane count sets the column width (1/lanes) for every block in it.
 * @param {import('../types').Session[]} sessions
 * @returns {import('../types').PlacedSession[]}
 */
export function assignLanes(sessions) {
  const items = sessions
    .map((s) => ({ session: s, startMin: hmToMinutes(s.startTime), endMin: minutesEnd(s) }))
    .filter((it) => Number.isFinite(it.startMin) && Number.isFinite(it.endMin))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.session.id.localeCompare(b.session.id));
  /** @type {import('../types').PlacedSession[]} */
  const placed = [];
  let i = 0;
  while (i < items.length) {
    let clusterEnd = items[i].endMin;
    let j = i + 1;
    while (j < items.length && items[j].startMin < clusterEnd) {
      if (items[j].endMin > clusterEnd) clusterEnd = items[j].endMin;
      j++;
    }
    const cluster = items.slice(i, j);
    /** @type {number[]} */
    const laneFreeAt = [];
    /** @type {{item: typeof cluster[number], lane: number}[]} */
    const assigned = [];
    for (const it of cluster) {
      let lane = laneFreeAt.findIndex((free) => free <= it.startMin);
      if (lane === -1) { lane = laneFreeAt.length; laneFreeAt.push(it.endMin); }
      else { laneFreeAt[lane] = it.endMin; }
      assigned.push({ item: it, lane });
    }
    const lanes = laneFreeAt.length;
    for (const a of assigned) {
      placed.push({ session: a.item.session, startMin: a.item.startMin, endMin: a.item.endMin, lane: a.lane, lanes });
    }
    i = j;
  }
  return placed;
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
