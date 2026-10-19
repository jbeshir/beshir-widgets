// How each charge of a group is posed in its slot (PLAN-D §0.3.4): mirrored to face the other way, and turned to point the way its
// orientation says, scaled so that the turned drawing stays within the room its slot has.

import { CHARGES, type Orientation } from './charges';
import type { Arrangement, Charge } from './design';
import { mirroredSlots } from './arrangement';
import { opticalScale } from './charge-art';
import { r2, type ArtPose, type Slot } from './geometry';
import type { ArtEnd, ChargeMeta } from './art/types';
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


/** Half a turn for a charge whose base is the end that goes the way named (`orient.point`, `orient.lead`: GoT Table 5), else none. */
const fromBase = (end: ArtEnd): number => (end === 'base' ? 180 : 0);

/**
 * The degrees clockwise from up a drawing is turned so that its `point` end points from a slot to the middle of its group's slots (half a turn
 * more for a point at the base, GoT Table 5: an arrow); upright for a slot at the middle.
 */
function towardCentre(slots: readonly Slot[], s: Slot, point: ArtEnd): number {
  const dx = slots.reduce((n, o) => n + o.x, 0) / slots.length - s.x, dy = slots.reduce((n, o) => n + o.y, 0) / slots.length - s.y;
  return Math.hypot(dx, dy) < 0.5 ? 0 : r2((Math.atan2(dx, -dy) * 180) / Math.PI) + fromBase(point);
}

/**
 * The degrees a charge's drawing is turned to lie `orientation` (not to center) on the shield, before its slot's own turn: the way the
 * orientation points less the way it is drawn, and half a turn more off the pale for a charge whose base leads (the feather fesswise lies
 * quill to dexter, an arrow fesswise point to sinister).
 */
export function drawingTurn(orientation: Exclude<Orientation, 'to-center'>, orient: ChargeMeta['orient']): number {
  const way = ORIENTATION_ANGLE[orientation];
  return normalAngle(way + (way % 180 === 0 ? 0 : fromBase(orient.lead)) - ORIENTATION_ANGLE[orient.drawn]);
}

/**
 * The degrees each slot's art is turned within the slot for a charge turned as `orient` says and set `orientation`: the way it points on
 * the shield less the way it is drawn and the slot's own turn (an explicit orientation on a bend overrides following it); to center, its
 * point (an arrow's base) toward the middle of the slots. None for no orientation.
 */
export function orientationTurns(orientation: Orientation | null, orient: ChargeMeta['orient'], slots: readonly Slot[]): number[] {
  return slots.map((s) => {
    if (orientation === null) return 0;
    const turn = orientation === 'to-center' ? towardCentre(slots, s, orient.point) - ORIENTATION_ANGLE[orient.drawn] : drawingTurn(orientation, orient);
    return normalAngle(turn - s.rotation);
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

/**
 * The poses of a group's charges in their slots: mirrored by facing and pair, or reversed; turned by orientation, and refitted by `outline`,
 * the art with what is drawn under it (its wings, flames or slip).
 */
export function chargePoses(item: Charge, arrangement: Arrangement, slots: readonly Slot[], outline: string): ArtPose[] {
  const mirrored = mirroredSlots(item.facing, arrangement, slots.length);
  const turns = orientationTurns(item.orientation, CHARGES[item.charge].orient, slots);
  return slots.map((_, i) => artPose(outline, mirrored[i] !== (item.orientation === 'reversed'), turns[i], opticalScale(item)));
}
