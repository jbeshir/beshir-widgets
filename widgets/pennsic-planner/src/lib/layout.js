// @ts-check
import { hmToMinutes } from './time.js';

/**
 * Lay out one day's sessions into side-by-side lanes so concurrent sessions never overlap visually.
 *
 * Algorithm: sort by start (then end). Walk a sweep line, accumulating a "cluster" of sessions
 * whose spans transitively overlap. Within each cluster, greedily assign each session to the
 * lowest-indexed lane that is free at its start. The cluster's lane count then sets the column
 * width (1 / lanes) for every block in that cluster, so a 50-wide afternoon cluster yields 50
 * equal columns while a quiet morning stays full-width.
 *
 * @param {import('../types').Session[]} sessions
 * @returns {import('../types').PlacedSession[]}
 */
export function assignLanes(sessions) {
  const items = sessions
    .map((s) => ({
      session: s,
      startMin: hmToMinutes(s.startTime),
      endMin: minutesEnd(s),
    }))
    .filter((it) => Number.isFinite(it.startMin) && Number.isFinite(it.endMin))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.session.id.localeCompare(b.session.id));

  /** @type {import('../types').PlacedSession[]} */
  const placed = [];
  let i = 0;
  while (i < items.length) {
    // Grow a cluster while the next item starts before the running max end of the cluster.
    let clusterEnd = items[i].endMin;
    let j = i + 1;
    while (j < items.length && items[j].startMin < clusterEnd) {
      if (items[j].endMin > clusterEnd) clusterEnd = items[j].endMin;
      j++;
    }
    const cluster = items.slice(i, j);

    // Greedy lane assignment within the cluster.
    /** @type {number[]} */
    const laneFreeAt = []; // laneFreeAt[lane] = minute the lane becomes free
    /** @type {{item: typeof cluster[number], lane: number}[]} */
    const assigned = [];
    for (const it of cluster) {
      let lane = laneFreeAt.findIndex((free) => free <= it.startMin);
      if (lane === -1) {
        lane = laneFreeAt.length;
        laneFreeAt.push(it.endMin);
      } else {
        laneFreeAt[lane] = it.endMin;
      }
      assigned.push({ item: it, lane });
    }
    const lanes = laneFreeAt.length;
    for (const a of assigned) {
      placed.push({
        session: a.item.session,
        startMin: a.item.startMin,
        endMin: a.item.endMin,
        lane: a.lane,
        lanes,
      });
    }
    i = j;
  }
  return placed;
}

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
