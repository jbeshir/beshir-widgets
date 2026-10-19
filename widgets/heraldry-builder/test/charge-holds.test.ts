// Held items (PLAN-D §1.5 H1–H7; the hold, beak and mouth anchors of art batch A3): which charges hold and may be held, where and how large the
// held item is drawn, how the shield draws it (and the render check sees it), its words and signature, and how conflict, the rule of
// tincture and readability count it.

import { describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, bboxOf, blazon, chargePath, differences, explainDifferences, gloss, overlaidArt, pathRings, readability, signature, unsupportedIssues,
  validate, type Charge, type Design,
} from '../src/lib/heraldry';
import { arms, charge, group, nd, ordinary } from './helpers';
import { checkRendered, renderShieldSvg } from './sca/widget-checks';

const lone = (item: object, paint = 'or', field: unknown = 'azure', extra: object = {}) => nd(arms(field, group(item, paint, extra)));
const hold = (how: string, id: string, paint: string, extra: object = {}) => ({ how, item: charge(id, extra), paint });
const lion = (...holds: object[]) => charge('lion', { holds });
const gaps = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
const changes = (a: Design, b: Design) => differences(a, b).map((x) => `${x.attr}:${x.kind}:${x.rule}`);
const item = (d: Design): Charge => {
  const it = d.groups[0].item;
  if (it.k !== 'charge') throw new Error('not a charge');
  return it;
};
const box = (d: string) => bboxOf(pathRings(d).flat());
const inBox = (d: string) => { const b = box(d); return b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 100 && b.y1 <= 100; };

describe('held items (PLAN-D §1.5)', () => {
  it('are held by the charges with a paw, beak or mouth anchor and are the charges that may be held', () => {
    expect(CHARGE_IDS.filter((id) => CHARGES[id].holdable)).toEqual(['rose', 'fleur-de-lis', 'mullet', 'key', 'sword', 'anchor', 'cross-crosslet', 'arrow', 'hammer', 'axe', 'feather', 'needle', 'spear', 'trident']);
    expect(Object.fromEntries(CHARGE_IDS.filter((id) => CHARGES[id].holds.length > 0).map((id) => [id, CHARGES[id].holds]))).toEqual({
      lion: ['maintaining', 'sustaining', 'in-mouth'], wolf: ['maintaining', 'sustaining', 'in-mouth'], boar: ['in-mouth'], goat: ['maintaining', 'sustaining'],
      hare: ['maintaining', 'sustaining'], fish: ['in-mouth'], unicorn: ['maintaining', 'sustaining'], dragon: ['maintaining', 'sustaining', 'in-mouth'],
      eagle: ['maintaining', 'sustaining', 'in-beak'], owl: ['maintaining', 'sustaining', 'in-beak'],
      // the horse and the bear are drawn with a mouth on their heads only
      cat: ['maintaining', 'sustaining'], bear: ['maintaining', 'sustaining', 'in-mouth'], horse: ['in-mouth'], fox: ['maintaining', 'sustaining'], squirrel: ['maintaining', 'sustaining'],
      // the birds are drawn with a beak; the griffin and the wyvern with a paw; the swan, peacock and the sea-creatures with neither
      raven: ['in-beak'], griffin: ['maintaining', 'sustaining'], phoenix: ['in-beak'], wyvern: ['maintaining', 'sustaining'], falcon: ['in-beak'], martlet: ['in-beak'], dove: ['in-beak'],
    });
    // a crown is worn, not held (H4)
    expect(CHARGES.crown.holdable).toBe(false);
  });

  it('are drawn for one plain holdable item in a tincture, held by a primary charge whose drawing has the anchor; anything else is a gap (H3)', () => {
    for (const d of [
      lone(lion(hold('maintaining', 'sword', 'argent'))), lone(lion(hold('sustaining', 'rose', 'gules')), 'argent'),
      lone(charge('eagle', { holds: [hold('in-beak', 'key', 'or')] }), 'sable', 'argent'), lone(charge('wolf', { holds: [hold('in-mouth', 'key', 'or')] }), 'argent', 'gules'),
      lone(lion(hold('maintaining', 'sword', 'argent')), 'or', 'azure', { count: 2, arrangement: { k: 'pair', pair: 'combattant' } }),
      lone(charge('lion', { facing: 'to-sinister', posture: 'passant', holds: [hold('maintaining', 'mullet', 'argent')] }), 'or', 'gules'),
      lone(charge('lion', { form: 'head', holds: [hold('in-mouth', 'rose', 'gules')] }), 'or'),
    ]) expect(gaps(d), blazon(d)).toEqual([]);
    expect(gaps(lone(lion(hold('maintaining', 'wolf', 'argent'))))).toEqual(['charge-modifier:maintaining']);
    expect(gaps(lone(lion(hold('maintaining', 'sword', 'proper'))))).toEqual(['charge-modifier:maintaining']);
    expect(gaps(lone(lion(hold('maintaining', 'sword', 'argent', { orientation: 'fesswise' }))))).toEqual(['charge-modifier:maintaining']);
    expect(gaps(lone(lion(hold('maintaining', 'sword', 'argent'), hold('maintaining', 'key', 'argent'))))).toEqual(['charge-modifier:maintaining']);
    expect(gaps(lone(lion(hold('wearing', 'sword', 'argent'))))).toEqual(['charge-modifier:wearing']);
    expect(gaps(lone(lion(hold('in-beak', 'sword', 'argent'))))).toEqual(['charge-modifier:in-beak']);
    // the lion couchant's mouth has no anchor, the boar has no paw
    expect(gaps(lone(charge('lion', { posture: 'couchant', holds: [hold('in-mouth', 'rose', 'gules')] })))).toEqual(['charge-modifier:in-mouth']);
    expect(gaps(lone(charge('boar', { holds: [hold('maintaining', 'sword', 'argent')] })))).toEqual(['charge-modifier:maintaining']);
    expect(gaps(nd(arms('azure', group(ordinary('fess'), 'argent'), group(lion(hold('maintaining', 'sword', 'argent')), 'or', { count: 3, relation: 'between' })))))
      .toEqual(['charge-modifier:maintaining']);
    // a charge drawn smaller to hold its item carries nothing on it
    expect(gaps(nd(arms('azure', group(lion(hold('maintaining', 'sword', 'argent')), 'or', { charged: [group(charge('mullet'), 'gules')] })))))
      .toEqual(['multiple-groups:tertiary-on-modifier']);
  });

  it('are drawn over the charge at their anchor, gripped near the foot, the charge drawn smaller where the item reaches out of its box; sustained half as large again (H7)', () => {
    const maintained = overlaidArt(item(lone(lion(hold('maintaining', 'sword', 'argent')))));
    expect(maintained.overlays.map((o) => `${o.part}${o.under ? ' under' : ' over'}`)).toEqual(['held over']);
    const crowned = overlaidArt(item(lone(charge('lion', { parts: [{ part: 'crowned', paint: 'gules' }], holds: [hold('maintaining', 'sword', 'argent')] }))));
    expect(crowned.overlays.map((o) => o.part)).toEqual(['crown', 'held']);
    const sustained = overlaidArt(item(lone(lion(hold('sustaining', 'sword', 'argent')))));
    const length = (o: { overlays: Array<{ d: string }> }) => { const b = box(o.overlays[0].d); return Math.hypot(b.x1 - b.x0, b.y1 - b.y0); };
    expect(length(sustained) / length(maintained)).toBeGreaterThan(1.2);
    for (const drawn of [maintained, sustained, overlaidArt(item(lone(charge('eagle', { holds: [hold('in-beak', 'key', 'or')] }), 'sable', 'argent')))]) {
      for (const d of [drawn.art, ...drawn.overlays.map((o) => o.d)]) expect(inBox(d)).toBe(true);
    }
    expect(maintained.art).not.toBe(chargePath(item(lone(lion()))));
    // a held item the drawing has no anchor for is not drawn
    expect(overlaidArt(item(lone(charge('lion', { posture: 'couchant', holds: [hold('in-mouth', 'rose', 'gules')] })))).overlays).toEqual([]);
  });

  it('are drawn by the shield and seen by the render check, which refuses a held item left out', () => {
    const designs = [
      lone(lion(hold('maintaining', 'sword', 'argent'))), lone(charge('eagle', { holds: [hold('in-beak', 'key', 'gules')] }), 'sable', 'argent', { count: 3 }),
      lone(lion(hold('sustaining', 'rose', 'gules')), 'azure', 'or', { count: 2, arrangement: { k: 'pair', pair: 'combattant' } }),
      nd(arms({ k: 'divided', division: 'per-pale', parts: ['argent', 'gules'] }, group(lion(hold('maintaining', 'sword', 'or')), 'counterchanged'))),
    ];
    for (const d of designs) for (const hatching of [false, true]) expect(checkRendered(d, renderShieldSvg(d, { hatching })), blazon(d)).toEqual([]);
    expect(renderShieldSvg(designs[0])).toMatch(/data-overlay="held"/);
    expect(checkRendered(designs[0], renderShieldSvg(lone(lion())))).toEqual(expect.arrayContaining([expect.stringMatching(/pieces of the charges at 0 are drawn nowhere, expected held/)]));
  });

  it('are worded after everything else, "each" for more than one holder; glossed as they look; signed', () => {
    expect(blazon(lone(lion(hold('maintaining', 'sword', 'argent'))))).toBe('Azure, a lion Or maintaining a sword argent.');
    expect(blazon(lone(lion(hold('maintaining', 'sword', 'or'))))).toBe('Azure, a lion maintaining a sword Or.');
    expect(blazon(lone(charge('lion', { parts: [{ part: 'crowned', paint: 'gules' }], holds: [hold('sustaining', 'key', 'argent')] })))).toBe('Azure, a lion Or crowned gules sustaining a key argent.');
    expect(blazon(lone(charge('eagle', { holds: [hold('in-beak', 'key', 'gules')] }), 'sable', 'argent', { count: 3 }))).toBe('Argent, three eagles sable each maintaining in its beak a key gules.');
    expect(blazon(lone(charge('wolf', { holds: [hold('in-mouth', 'rose', 'gules')] }), 'argent', 'vert'))).toBe('Vert, a wolf passant argent maintaining in its mouth a rose gules.');
    expect(blazon(nd(arms('azure', group(lion(hold('maintaining', 'sword', 'argent')), 'or'), group(charge('mullet'), 'argent', { count: 3, relation: 'between' })))))
      .toBe('Azure, a lion Or maintaining a sword between three mullets argent.');
    expect(gloss(lone(lion(hold('maintaining', 'sword', 'argent'))))).toMatch(/gold lion rearing up, holding a white sword/);
    expect(gloss(lone(charge('eagle', { holds: [hold('in-beak', 'key', 'gules')] }), 'sable', 'argent', { count: 3 }))).toMatch(/each with a red key in its beak/);
    expect(signature(lone(lion(hold('maintaining', 'sword', 'argent'))))).toBe('arms|az|P:c.lion.rampant~hold-maintaining(c.sword/ar):1:single:or');
    const factor = (d: Design, f: string) => readability(d).breakdown.find((b) => b.factor === f)!.points;
    const plain = lone(lion()), holding = lone(lion(hold('maintaining', 'sword', 'gules')));
    // H6: the held item is one group more, and its tincture one more
    expect([factor(holding, 'count') - factor(plain, 'count'), factor(holding, 'tinctures') - factor(plain, 'tinctures'), factor(holding, 'detail') - factor(plain, 'detail')]).toEqual([1, 1, 0]);
  });

  it('are a secondary group for conflict: adding one, or changing its type or tincture, is a distinct change each (H1); how, where and which way it is held count nothing (H2)', () => {
    const plain = lone(lion()), sword = lone(lion(hold('maintaining', 'sword', 'argent')));
    expect(changes(plain, sword)).toEqual(['group-presence:dc:A5G2']);
    expect(changes(sword, lone(lion(hold('maintaining', 'key', 'argent'))))).toEqual(['type:dc:A5G4']);
    expect(changes(sword, lone(lion(hold('maintaining', 'sword', 'gules'))))).toEqual(['tincture:dc:A5G3']);
    // three changes of the held item (type, tincture, the way it is held) are one distinct change of each kind that counts
    expect(changes(sword, lone(lion(hold('sustaining', 'rose', 'gules'))))).toEqual(['type:dc:A5G4', 'tincture:dc:A5G3']);
    expect(changes(sword, lone(lion(hold('sustaining', 'sword', 'argent'))))).toEqual([]);
    expect(changes(sword, lone(lion(hold('maintaining', 'sword', 'argent', { orientation: 'fesswise' }))))).toEqual([]);
    expect(changes(lone(charge('eagle', { holds: [hold('in-beak', 'key', 'or')] })), lone(charge('eagle', { holds: [hold('maintaining', 'key', 'or')] })))).toEqual([]);
    // it changes nothing about the holder: a lion against a wolf, each with a sword, is still a substantial change of type
    expect(changes(sword, lone(charge('wolf', { posture: 'rampant', holds: [hold('maintaining', 'sword', 'argent')] })))).toEqual(['type:sc:A5E2']);
    expect(explainDifferences(sword, plain).map((n) => `${n.text} | ${n.why}`)).toEqual([
      'what the lion holds (sword ↔ none) | Adding or taking away the sword the lion holds is one distinct change: a held item is a group of its own (SENA A5G2).',
    ]);
    expect(explainDifferences(sword, lone(lion(hold('maintaining', 'key', 'gules')))).map((n) => n.text)).toEqual([
      'what the lion holds (sword ↔ key)', 'colour of the sword the lion holds (Argent ↔ Gules)',
    ]);
  });

  it('contrast with the field, not with their holder (H5)', () => {
    const issues = (d: Design) => validate(d).filter((i) => i.code === 'tincture').map((i) => (i.code === 'tincture' ? `${i.part}: ${i.message}` : ''));
    expect(issues(lone(charge('lion', { holds: [hold('maintaining', 'sword', 'or')] }), 'gules', 'or'))).toEqual([
      'held: The sword the lion holds (Or) lies on Or: same tincture',
    ]);
    expect(issues(lone(charge('lion', { holds: [hold('maintaining', 'sword', 'gules')] }), 'gules', 'argent'))).toEqual([]);
    expect(issues(lone(charge('lion', { holds: [hold('maintaining', 'sword', 'or')] }), 'or', 'azure'))).toEqual([]);
  });
});
