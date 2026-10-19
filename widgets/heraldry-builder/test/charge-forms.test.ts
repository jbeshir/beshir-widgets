// Demi charges and heads (PLAN-D §1.4 M1–M4, §1.1 F5): which charges are drawn so, their canonical form (no posture; a head couped or
// erased, couped by default), their art (a head's own drawing, its neck torn when erased; a demi charge cut from its rampant drawing and
// fitted again), their words and signature, and how conflict compares them.

import { describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, ERASED_TEETH, bboxOf, blazon, chargePath, derivedPath, differences, gloss, pathRings, renderLayers, resolve, signature,
  unsupportedIssues, type ChargeId, type Design,
} from '../src/lib/heraldry';
import { arms, charge, group, nd } from './helpers';

const lone = (item: object, paint = 'or', extra: object = {}, field: unknown = 'azure') => nd(arms(field, group(item, paint, extra)));
const head = (id: string, extra: object = {}) => charge(id, { form: 'head', ...extra });
const demi = (id: string, extra: object = {}) => charge(id, { form: 'demi', ...extra });
const changes = (a: Design, b: Design) => differences(a, b).map((x) => `${x.attr}:${x.kind}:${x.rule}`);
const gaps = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
const drawn = (d: Design) => renderLayers(d, 'heater').flatMap((l) => (l.k === 'charges' ? [l.art] : []))[0];
const withForm = (form: 'head' | 'demi') => CHARGE_IDS.filter((id) => CHARGES[id].forms.includes(form));

describe('demi charges and heads (PLAN-D §1.4)', () => {
  it('are drawn for the beasts that have them: heads of the six of art batch A1, demi charges of those drawn rampant and the eagle', () => {
    expect(withForm('head')).toEqual(['lion', 'wolf', 'boar', 'stag', 'unicorn', 'dragon', 'bear', 'horse']);
    expect(withForm('demi')).toEqual(['lion', 'wolf', 'goat', 'unicorn', 'dragon', 'eagle']);
    for (const id of withForm('head')) expect(CHARGES[id].headName, id).not.toBeNull();
    expect(gaps(lone(head('wolf', { mods: ['erased'] })))).toEqual([]);
    expect(gaps(lone(demi('eagle', { facing: 'to-sinister' })))).toEqual([]);
    // a cut is a head's: a whole or demi charge couped or erased is a gap, and a head is not both
    expect(gaps(lone(charge('lion', { mods: ['erased'] })))).toEqual(['charge-modifier:erased']);
    expect(gaps(lone(demi('lion', { mods: ['couped'] })))).toEqual(['charge-modifier:couped']);
    expect(resolve({ v: 2, field: 'azure', groups: [group(head('lion', { mods: ['couped', 'erased'] }), 'or')] }).ok).toBe(false);
  });

  it('have no posture, and a head is couped unless erased', () => {
    expect(lone(head('lion', { posture: 'passant' }))).toEqual(lone(head('lion', { mods: ['couped'] })));
    expect(lone(demi('wolf'))).toEqual(lone(demi('wolf', { posture: 'statant' })));
    expect(signature(lone(head('wolf')))).toBe('arms|az|P:c.wolf+couped~form-head:1:single:or');
    expect(signature(lone(head('wolf', { mods: ['erased'], facing: 'to-sinister' })))).toBe('arms|az|P:c.wolf+erased~form-head~facing-to-sinister:1:single:or');
    expect(signature(lone(demi('lion')))).toBe('arms|az|P:c.lion~form-demi:1:single:or');
  });

  it('draw a head from its own drawing, erased with its neck torn into tufts inside the box, whatever the posture', () => {
    for (const id of withForm('head')) {
      expect(drawn(lone(head(id, { posture: 'rampant' }))), id).toBe(chargePath({ charge: id, form: 'head', posture: null, gaze: null, mods: [] }));
      const erased = derivedPath(id, 'erased-head')!;
      expect(drawn(lone(head(id, { mods: ['erased'] }))), id).toBe(erased);
      const { y } = CHARGES[id].drawings.head!.neck!;
      const outer = pathRings(erased)[0];
      // the tips below the neck's line, each between two points above it
      const tips = outer.filter(([, py], i) => py > y && outer[(i + outer.length - 1) % outer.length][1] < py && outer[(i + 1) % outer.length][1] < py);
      expect(tips.length, id).toBeGreaterThanOrEqual(ERASED_TEETH);
      const box = bboxOf(outer);
      expect([box.x0, box.y0, 100 - box.x1, 100 - box.y1].every((v) => v >= 0), id).toBe(true);
    }
  });

  it('cut a demi charge from its rampant (or default) drawing and fit it to the box again: long side 82–90, centred', () => {
    for (const id of withForm('demi')) {
      const d = derivedPath(id, 'demi')!;
      expect(drawn(lone(demi(id))), id).toBe(d);
      const box = bboxOf(pathRings(d).flat());
      expect(Math.max(box.x1 - box.x0, box.y1 - box.y0), id).toBeGreaterThanOrEqual(82);
      expect(Math.max(box.x1 - box.x0, box.y1 - box.y0), id).toBeLessThanOrEqual(90);
      expect(Math.abs((box.y0 + box.y1) / 2 - 50), id).toBeLessThanOrEqual(6);
    }
  });

  it('are worded with a head\'s name and its cut before the facing, a demi charge with its prefix and no posture', () => {
    expect(blazon(lone(head('wolf', { mods: ['erased'] })))).toBe('Azure, a wolf\'s head erased Or.');
    expect(blazon(lone(head('stag'), 'argent', { count: 3 }, 'vert'))).toBe('Vert, three stags\' heads couped argent.');
    expect(blazon(lone(head('lion', { mods: ['erased'], facing: 'to-sinister' })))).toBe('Azure, a lion\'s head erased contourny Or.');
    expect(blazon(lone(demi('lion')))).toBe('Azure, a demi-lion Or.');
    expect(blazon(lone(head('lion'), 'or', { count: 2, arrangement: { k: 'pair', pair: 'combattant' } }))).toBe('Azure, two lions\' heads couped respectant Or.');
    expect(blazon(lone(demi('dragon'), 'or', { count: 2 }, 'gules'))).toBe('Gules, in pale two demi-dragons Or.');
    expect(gloss(lone(head('wolf', { mods: ['erased'] })))).toBe('A blue shield with the head and neck of a gold wolf, cut off with a ragged edge.');
    expect(gloss(lone(demi('lion'), 'or', { count: 3 }))).toMatch(/^A blue shield with the front halves of three gold lions, /);
  });

  it('a demi charge differs from the whole beast by a distinct change of type, a head substantially, as from another beast\'s head; the cut is worth nothing (M1–M4)', () => {
    const on = (item: object) => lone(item);
    expect(changes(on(demi('lion')), on(charge('lion')))).toEqual(['type:dc:A5G4']);
    expect(changes(on(head('lion')), on(charge('lion')))).toEqual(['type:sc:A5E2']);
    expect(changes(on(head('lion')), on(demi('lion')))).toEqual(['type:sc:A5E2']);
    expect(changes(on(head('wolf')), on(head('lion')))).toEqual(['type:sc:A5E2']);
    // William Ulfsson 08/2014: wolves' heads against horses' heads are more than a DC
    expect(changes(on(head('wolf')), on(head('horse')))).toEqual(['type:sc:A5E2']);
    expect(changes(on(head('bear')), on(head('horse')))).toEqual(['type:sc:A5E2']);
    expect(changes(on(head('wolf', { mods: ['erased'] })), on(head('wolf')))).toEqual([]);
  });

  it('a head or a demi charge contourny is a distinct change from one to dexter (§1.1 F5)', () => {
    const turned = (item: (id: string, extra?: object) => object, id: ChargeId) => changes(lone(item(id, { facing: 'to-sinister' })), lone(item(id)));
    expect(turned(head, 'wolf')).toEqual(['posture:dc:A5G7']);
    expect(turned(demi, 'lion')).toEqual(['posture:dc:A5G7']);
  });
});
