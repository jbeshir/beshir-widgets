// How each charge of a group is posed in its slot (PLAN-D §0.3.4): mirrored to face the other way, and turned to point the way its
// orientation says, scaled so that the turned drawing stays within the room its slot has.

import { CHARGES, type Orientation } from './charges';
import type { Arrangement, Charge } from './design';
import { mirroredSlots } from './arrangement';
import { opticalScale } from './charge-art';
import { r2, type ArtPose, type Slot } from './geometry';
import { reachOf, turnFit } from './art/geometry';

/**
 * Degrees clockwise from upright to the way each orientation points on the shield (§1.3): fesswise to dexter, bendwise to dexter chief.
 * Reversed is upright, mirrored; to center is worked out slot by slot (`orientationTurns`).
 */
export const ORIENTATION_ANGLE: Record<Exclude<Orientation, 'to-center'>, number> = {
  palewise: 0, inverted: 180, reversed: 0,
  fesswise: -90, 'fesswise-reversed': 90,
  bendwise: -45, 'bendwise-inverted': 135,
  'bendwise-sinister': 45, 'bendwise-sinister-inverted': -135,
};

/** An angle in degrees as (−180, 180]. */
function normalAngle(a: number): number {
  const r = ((a % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

/** The way (degrees clockwise from up) from a slot to the middle of its group's slots; upright for a slot at the middle. */
function towardCentre(slots: readonly Slot[], s: Slot): number {
  const dx = slots.reduce((n, o) => n + o.x, 0) / slots.length - s.x, dy = slots.reduce((n, o) => n + o.y, 0) / slots.length - s.y;
  return Math.hypot(dx, dy) < 0.5 ? 0 : r2((Math.atan2(dx, -dy) * 180) / Math.PI);
}

/**
 * The degrees each slot's art is turned within the slot for a charge drawn pointing `drawn` and set `orientation`: the way it points on the
 * shield less the way it is drawn and the slot's own turn (an explicit orientation on a bend overrides following it). None for no orientation.
 */
export function orientationTurns(orientation: Orientation | null, drawn: Exclude<Orientation, 'to-center'>, slots: readonly Slot[]): number[] {
  return slots.map((s) => {
    if (orientation === null) return 0;
    const way = orientation === 'to-center' ? towardCentre(slots, s) : ORIENTATION_ANGLE[orientation];
    return normalAngle(way - ORIENTATION_ANGLE[drawn] - s.rotation);
  });
}

/**
 * How far from the middle of its slot a charge turned off its axis may reach, in hundredths of the slot: the layouts keep a disc about this
 * big on its ground and clear of its neighbours, while upright art is fitted to them by hand (geometry-fit.test.ts checks every drawing
 * every way it turns at 45; at 46 a sword fesswise three in fess within a bordure leaves its ground). Upside down, art takes the room it
 * takes upright.
 */
const TURNED_REACH = 45;

/**
 * A pose of `art` (drawn at optical `scale`), mirrored or not, turned `turn` degrees and refitted: its bounding box keeps the long side it
 * has upright (`turnFit`), and turned off its axis it stays within `TURNED_REACH`.
 */
export function artPose(art: string, mirror: boolean, turn: number, scale: number): ArtPose {
  // the turned box of a mirrored drawing is the box of the drawing turned the other way, mirrored
  const boxFit = turnFit(art, mirror ? -turn : turn);
  return { mirror, turn, fit: turn % 180 === 0 ? boxFit : Math.min(boxFit, Math.floor((1000 * TURNED_REACH) / (reachOf(art) * scale)) / 1000) };
}

/** The poses of a group's charges in their slots: mirrored by facing and pair, or reversed; turned by orientation. */
export function chargePoses(item: Charge, arrangement: Arrangement, slots: readonly Slot[], art: string): ArtPose[] {
  const mirrored = mirroredSlots(item.facing, arrangement, slots.length);
  const turns = orientationTurns(item.orientation, CHARGES[item.charge].orient.drawn, slots);
  return slots.map((_, i) => artPose(art, mirrored[i] !== (item.orientation === 'reversed'), turns[i], opticalScale(item)));
}
