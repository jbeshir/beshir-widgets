// The house style of the charge art (README "Licence of charge art"), checked on every drawing in the sidecar: the rules the
// art tools' lint applies to new drawings before they are imported, so the tool and the repo agree.

import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, CHARGES, CORE_ART_IDS, MODIFIER_ART, OVERLAY_PIECES, OVERLAY_PIECE_PROVENANCE, PIECE_IDS, PIERCED_MULLETS, overlaidArt, POINTED_STARS, bboxOf, derivedPath, isTurnedPosture, pathRings, ringDepths, ringProblems,
  type ArtKey, type Charge, type ChargeId, type DrawingMeta, type PieceId,
} from '../src/lib/heraldry';
import { arms, charge, group, nd } from './helpers';
import { chargeArt, rings } from './art-geometry';

type Rule = 'grammar' | 'points' | 'size' | 'centre' | 'hole' | 'rings' | 'bytes' | 'anchors' | 'neck';
interface Problem { id: ChargeId; key: string; rule: Rule }

/**
 * Drawings of phases B and C that break a rule drawn later: the unicorn rampant's eye and the open book's clasp are holes under 5
 * units across, and the rose's seed is an island in its hole. They are kept as drawn.
 */
const LEGACY_ART_EXEMPT: readonly Problem[] = [
  { id: 'unicorn', key: 'rampant', rule: 'hole' },
  { id: 'rose', key: '_', rule: 'rings' },
  { id: 'open-book', key: '_', rule: 'hole' },
];

/** Absolute M/L/Z polygons with coordinates of at most one decimal, every subpath closed. */
const NUMBER = '(?:100|\\d{1,2})(?:\\.\\d)?';
const PAIR = `${NUMBER} ${NUMBER}`;
const PATH_GRAMMAR = new RegExp(`^(?:M${PAIR}L${PAIR}(?: ${PAIR})*Z)+$`);
const MAX_DRAWING_BYTES = 2600;
/** Raised from 9,000 by the orchestrator after art batch A2a (lions of ten drawings); a drawing keeps its own budget. */
const MAX_CHARGE_BYTES = 30000;
/** A drawing's long side (target 86) and how far its middle may be from the box's. */
const LONG_SIDE = [82, 90] as const;
const CENTRE_SLACK = 6;
const MIN_HOLE = 5;

function drawingProblems(d: string, meta: DrawingMeta): Rule[] {
  if (!PATH_GRAMMAR.test(d)) return ['grammar'];
  const rs = pathRings(d);
  const problems: Rule[] = [];
  if (rs.some((r) => new Set(r.map((p) => p.join())).size < 3)) problems.push('points');
  const box = bboxOf(rs.flat());
  if (Math.max(box.x1 - box.x0, box.y1 - box.y0) < LONG_SIDE[0] || Math.max(box.x1 - box.x0, box.y1 - box.y0) > LONG_SIDE[1]) problems.push('size');
  if (Math.abs((box.x0 + box.x1) / 2 - 50) > CENTRE_SLACK || Math.abs((box.y0 + box.y1) / 2 - 50) > CENTRE_SLACK) problems.push('centre');
  const depths = ringDepths(rs);
  const holes = rs.filter((_, i) => depths[i] === 1).map(bboxOf);
  if (holes.some((h) => Math.min(h.x1 - h.x0, h.y1 - h.y0) < MIN_HOLE)) problems.push('hole');
  if (ringProblems(rs).length > 0) problems.push('rings');
  if (d.length > MAX_DRAWING_BYTES) problems.push('bytes');
  if (Object.values(meta.anchors).some((a) => [a!.x, a!.y].some((v) => v < 0 || v > 100) || a!.size <= 0)) problems.push('anchors');
  const { neck } = meta;
  if (neck) {
    const outer = rs[0];
    const cuts = outer.filter((p, i) => {
      const q = outer[(i + 1) % outer.length];
      return p[1] === neck.y && q[1] === neck.y && Math.min(p[0], q[0]) === neck.x0 && Math.max(p[0], q[0]) === neck.x1;
    });
    if (cuts.length !== 1) problems.push('neck');
  }
  return problems;
}

/** The drawing keys a charge may have: one per drawn posture (with its head turned too), or '_' for one without; a head and a demi charge. */
function allowedKeys(id: ChargeId): ArtKey[] {
  const postures = CHARGES[id].postures;
  return [...(postures ? postures.flatMap((p): ArtKey[] => [p, `${p}~guardant`, `${p}~regardant`]) : ['_' as const]), 'head', 'demi'];
}

const drawingKeys = (id: ChargeId) => Object.keys(chargeArt(id)) as ArtKey[];

/** A charge drawn with each piece (and a rose slipped with its leaves), as the shield draws it. */
const PIECED: Record<PieceId, Charge> = Object.fromEntries(PIECE_IDS.map((piece) => {
  const item = {
    winged: charge('heart', { mods: [{ id: 'winged', paint: 'or' }] }),
    enflamed: charge('heart', { mods: [{ id: 'enflamed', paint: 'proper' }] }),
    slipped: charge('rose', { mods: [{ id: 'slipped', paint: 'vert' }] }),
    leaved: charge('rose', { mods: [{ id: 'slipped', paint: 'vert' }, { id: 'leaved', paint: 'vert' }] }),
    crowned: charge('lion', { parts: [{ part: 'crowned', paint: 'or' }] }),
    collared: charge('wolf', { parts: [{ part: 'collared', paint: 'or' }] }),
  }[piece];
  const d = nd(arms('azure', group(item, 'gules')));
  return [piece, d.groups[0].item as Charge];
})) as Record<PieceId, Charge>;

describe('the charge art', () => {
  it('keeps the house style: path grammar, size, centring, holes, rings that do not overlap, bytes, anchors and necks', () => {
    const problems: Problem[] = CHARGE_IDS.flatMap((id) => drawingKeys(id).flatMap((key) =>
      drawingProblems(chargeArt(id)[key]!, CHARGES[id].drawings[key]!).map((rule) => ({ id, key, rule }))));
    expect(problems).toEqual(LEGACY_ART_EXEMPT);
  });

  it('keeps it in the art drawn for a modifier too: the sun in splendour, the crosses fitchy, the stars of other points, the pierced mullets', () => {
    const problems = Object.entries(MODIFIER_ART).flatMap(([id, byModifier]) => Object.entries(byModifier!).flatMap(([modifier, d]) =>
      drawingProblems(d!, CHARGES[id as ChargeId].drawings._!).map((rule) => `${id} ${modifier} ${rule}`)));
    const stars = [...Object.entries(POINTED_STARS.mullet).map(([n, d]) => [`mullet of ${n}`, d]), ...Object.entries(POINTED_STARS.estoile).map(([n, d]) => [`estoile of ${n}`, d]),
      ...Object.entries(PIERCED_MULLETS).map(([n, d]) => [`mullet of ${n} pierced`, d])];
    const starProblems = stars.flatMap(([name, d]) => drawingProblems(d, CHARGES.mullet.drawings._!).map((rule) => `${name} ${rule}`));
    expect([...problems, ...starProblems]).toEqual([]);
  });

  it('keeps it in the drawings derived from others: every head erased, every demi charge, every posture turned from another (PLAN-D §2.6)', () => {
    const derived = CHARGE_IDS.flatMap((id) => [
      ...(CHARGES[id].forms.includes('head') ? [[id, 'erased-head', derivedPath(id, 'erased-head')!] as const] : []),
      ...(CHARGES[id].forms.includes('demi') ? [[id, 'demi', derivedPath(id, 'demi')!] as const] : []),
      ...(CHARGES[id].postures ?? []).filter(isTurnedPosture).map((p) => [id, p, derivedPath(id, p)!] as const),
    ]);
    expect(derived).toHaveLength(15);
    expect(derived.flatMap(([id, key, d]) => drawingProblems(d, { onBox: null, anchors: {}, neck: null }).map((rule) => `${id} ${key} ${rule}`))).toEqual([]);
  });

  it('keeps it in the overlay pieces (art batch A3), each drawn in its own box: all but the size and centring of a whole charge', () => {
    const problems = Object.entries(OVERLAY_PIECES).flatMap(([piece, d]) =>
      drawingProblems(d, { onBox: null, anchors: {}, neck: null }).filter((rule) => rule !== 'size' && rule !== 'centre').map((rule) => `${piece} ${rule}`));
    expect(problems).toEqual([]);
  });

  // made as the shield is drawn, never shipped: the byte budget is the shipped art's
  it('keeps it in the pieces made when a charge is drawn (wings, flames, a collar band, and the pieces above placed): all but size, centring and bytes', () => {
    const problems = PIECE_IDS.flatMap((piece) => overlaidArt(PIECED[piece]).overlays.flatMap((o) =>
      drawingProblems(o.d, { onBox: null, anchors: {}, neck: null }).filter((rule) => rule !== 'size' && rule !== 'centre' && rule !== 'bytes').map((rule) => `${piece} ${o.part} ${rule}`)));
    expect(PIECE_IDS.map((piece) => overlaidArt(PIECED[piece]).overlays.length)).toEqual(PIECE_IDS.map((piece) => (piece === 'leaved' ? 2 : 1)));
    expect(problems).toEqual([]);
  });

  it('stays within the byte budget of a charge', () => {
    for (const id of CHARGE_IDS) expect(drawingKeys(id).reduce((n, key) => n + chargeArt(id)[key]!.length, 0), id).toBeLessThanOrEqual(MAX_CHARGE_BYTES);
  });

  it('reads the same rings as the art tests do', () => {
    for (const id of CHARGE_IDS) for (const key of drawingKeys(id)) expect(pathRings(chargeArt(id)[key]!), `${id} ${key}`).toEqual(rings(chargeArt(id)[key]!));
  });

  it('has a drawing for every drawn posture but one turned from another (urinant), or one posture-less drawing, and no other', () => {
    for (const id of CHARGE_IDS) {
      const keys = drawingKeys(id);
      expect(keys.every((k) => allowedKeys(id).includes(k)), `${id}: ${keys}`).toBe(true);
      expect(keys, id).toEqual(expect.arrayContaining([...(CHARGES[id].postures?.filter((p) => !isTurnedPosture(p)) ?? ['_'])]));
    }
  });

  it('has the same drawings in its metadata as in its paths', () => {
    for (const id of CHARGE_IDS) expect(Object.keys(CHARGES[id].drawings).sort(), id).toEqual(drawingKeys(id).sort());
  });

  it('says where every charge came from, and every overlay piece', () => {
    for (const id of CHARGE_IDS) {
      const { origin, author, date, method } = CHARGES[id].provenance;
      expect([origin, author, date, method].every((s) => s.length > 0), id).toBe(true);
    }
    expect(Object.keys(OVERLAY_PIECE_PROVENANCE).sort()).toEqual(Object.keys(OVERLAY_PIECES).sort());
    for (const [piece, { origin, author, date, method }] of Object.entries(OVERLAY_PIECE_PROVENANCE)) {
      expect([origin, author, date, method].every((s) => s.length > 0), piece).toBe(true);
    }
  });

  it('draws the main chunk\'s charges from the charge table', () => {
    expect(CORE_ART_IDS.every((id) => (CHARGE_IDS as readonly string[]).includes(id))).toBe(true);
  });
});
