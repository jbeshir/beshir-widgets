// The field shape is display only, so every shape must give a design the same verdict. The rule of
// tincture is judged on the canonical (heater) layout and the verdict functions take only the
// design; these tests pin that from both sides for the sample registry, the validation examples, a
// set of rule-breaking designs and a seeded batch of generated designs:
//   - carried as a draft in each shape (stored, read back, resolved), a design gets the same issues,
//     builder report, one-click fix and tincture locks as in every other shape;
//   - judged instead on what is actually drawn in each shape (its own slots and partition lines),
//     every charge gets the same per-slot verdict as the canonical one, so the picture never shows
//     a clash the verdict missed, nor hides one it reported.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, SHAPE_LAYOUT, chargeContext, chargeContrastFailure, chargeSlotContacts, chargeTinctureChoices,
  fieldTinctureChoices, inFirstPart, ordinaryTinctureChoices, probePoints, resolve, shapedChargeSlots,
  suggestTinctureFix, validate, type FieldShape, type NormDesign, type ShapedDesign, type Slot, type Tincture,
} from '../src/lib/heraldry';
import { assess } from '../src/lib/builder';
import sample from '../src/data/sample-registry.json';
import { generatedDesigns } from './design-generator';
import { V } from './validation-cases';

const plain = (tincture: string) => ({ kind: 'plain', tincture });
const div = (division: string, t1: string, t2: string) => ({ kind: 'divided', division, tinctures: [t1, t2] });
const group = (charge: string, count: number, tincture: string, arrangement?: string) =>
  ({ charge, count, placement: 'field', tincture, ...(arrangement ? { arrangement } : {}) });

/** Designs that break the rule of tincture on part of a divided field, in each kind of placement. */
const BROKEN: Array<[string, unknown]> = [
  ['per fess, 2-1 mullets', { v: 1, field: div('per-fess', 'azure', 'or'), charges: group('mullet', 3, 'gules') }],
  ['per pale, 2 roses in fess', { v: 1, field: div('per-pale', 'or', 'gules'), charges: group('rose', 2, 'azure', 'in-fess') }],
  ['per bend, 3 keys in bend', { v: 1, field: div('per-bend', 'or', 'argent'), charges: group('key', 3, 'argent', 'in-bend') }],
  ['per saltire, 5 in saltire', { v: 1, field: div('per-saltire', 'vert', 'or'), charges: group('heart', 5, 'gules') }],
  ['per chevron, 3 in fess', { v: 1, field: div('per-chevron', 'gules', 'argent'), charges: group('crown', 3, 'or', 'in-fess') }],
  ['quarterly, 4 two and two', { v: 1, field: div('quarterly', 'or', 'azure'), charges: group('anchor', 4, 'gules', 'two-and-two') }],
  ['quarterly, 5 in cross', { v: 1, field: div('quarterly', 'argent', 'or'), charges: group('anchor', 5, 'or', 'in-cross') }],
  ['per pale, 6 lions', { v: 1, field: div('per-pale', 'azure', 'argent'), charges: { ...group('lion', 6, 'or'), posture: 'rampant' } }],
  ['per fess, chief Or, 3 under', { v: 1, field: div('per-fess', 'argent', 'gules'), ordinary: { type: 'chief', tincture: 'azure' }, charges: group('mullet', 3, 'argent') }],
  ['per bend sinister, bordure, 2', { v: 1, field: div('per-bend-sinister', 'or', 'vert'), ordinary: { type: 'bordure', tincture: 'sable' }, charges: group('rose', 2, 'or', 'in-bend-sinister') }],
  ['per pale, fess between 3', { v: 1, field: div('per-pale', 'gules', 'or'), ordinary: { type: 'fess', tincture: 'argent' }, charges: group('sun', 3, 'azure') }],
  ['plain, colour on colour', { v: 1, field: plain('vert'), charges: group('wolf', 2, 'gules') }],
  ['on a pale, metal on metal', { v: 1, field: plain('azure'), ordinary: { type: 'pale', tincture: 'or' }, charges: { ...group('key', 3, 'argent'), placement: 'ordinary' } }],
  ['counterchanged on two metals', { v: 1, field: div('per-pale', 'or', 'argent'), charges: group('mullet', 3, 'counterchanged') }],
  ['counterchanged on two colours', { v: 1, field: div('quarterly', 'gules', 'azure'), charges: group('rose', 4, 'counterchanged') }],
  ['counterchanged on a plain field', { v: 1, field: plain('vert'), charges: group('mullet', 2, 'counterchanged') }],
  ['counterchanged on an ordinary', { v: 1, field: div('per-fess', 'or', 'azure'), ordinary: { type: 'fess', tincture: 'gules' }, charges: { ...group('key', 3, 'counterchanged'), placement: 'ordinary' } }],
];

/** Counterchanged charges on a metal-and-colour field, in every division and kind of field placement. */
const COUNTERCHANGED: Array<[string, unknown]> = [
  ['per pale, 3 two and one', { v: 1, field: div('per-pale', 'or', 'azure'), charges: group('mullet', 3, 'counterchanged') }],
  ['per fess, 2 in bend', { v: 1, field: div('per-fess', 'gules', 'argent'), charges: group('rose', 2, 'counterchanged', 'in-bend') }],
  ['per bend, 3 in fess', { v: 1, field: div('per-bend', 'celestine', 'vert'), charges: group('key', 3, 'counterchanged', 'in-fess') }],
  ['per bend sinister, single', { v: 1, field: div('per-bend-sinister', 'sable', 'or'), charges: { ...group('lion', 1, 'counterchanged'), posture: 'rampant' } }],
  ['per saltire, 5 in cross', { v: 1, field: div('per-saltire', 'argent', 'purpure'), charges: group('heart', 5, 'counterchanged', 'in-cross') }],
  ['per chevron, 6', { v: 1, field: div('per-chevron', 'azure', 'or'), charges: group('crescent', 6, 'counterchanged') }],
  ['quarterly, 4 two and two', { v: 1, field: div('quarterly', 'or', 'gules'), charges: group('anchor', 4, 'counterchanged') }],
  ['per pale, chief, 3 under', { v: 1, field: div('per-pale', 'argent', 'vert'), ordinary: { type: 'chief', tincture: 'sable' }, charges: group('mullet', 3, 'counterchanged') }],
  ['per fess, bordure, 2', { v: 1, field: div('per-fess', 'or', 'sable'), ordinary: { type: 'bordure', tincture: 'gules' }, charges: group('sun', 2, 'counterchanged') }],
  ['per pale, pile between 2', { v: 1, field: div('per-pale', 'azure', 'argent'), ordinary: { type: 'pile', tincture: 'gules' }, charges: group('fish', 2, 'counterchanged') }],
];

const DESIGNS: Array<[string, NormDesign]> = [
  ...sample.entries.map((e): [string, unknown] => [e.id, e.design]),
  ...V.map((c): [string, unknown] => [c.id, c.design]),
  ...BROKEN,
  ...COUNTERCHANGED,
].flatMap(([name, raw]) => {
  const r = resolve(raw);
  return r.ok ? [[name, r.design] as [string, NormDesign]] : [];
}).concat(generatedDesigns(4242, 200).map((d, i): [string, NormDesign] => [`generated ${i}`, d]));

/** As the builder holds it: written as a draft in a shape, read back and re-resolved. */
function throughDraft(arms: ShapedDesign): NormDesign {
  const stored = JSON.parse(JSON.stringify(arms)) as { design: unknown };
  const r = resolve(stored.design);
  if (!r.ok) throw new Error('draft did not resolve');
  return r.design;
}

/** Everything the builder and the Worker decide about a design's validity. */
function verdict(nd: NormDesign) {
  const t1 = fieldTinctureChoices(nd, 0);
  return {
    issues: validate(nd),
    report: assess(nd),
    fix: suggestTinctureFix(nd),
    locks: [t1, nd.field.kind === 'divided' ? fieldTinctureChoices(nd, 1) : [], nd.ordinary ? ordinaryTinctureChoices(nd) : [], chargeTinctureChoices(nd)],
  };
}

/** Field tinctures a slot touches as drawn in a shape: the five-point probe against that shape's lines. */
function drawnContacts(nd: NormDesign, slot: Slot, shape: FieldShape): Tincture[] {
  const f = nd.field;
  if (f.kind === 'plain') return [f.tincture];
  const fess = SHAPE_LAYOUT[shape].fessPoint;
  const parts = new Set<number>(probePoints(slot).map(([x, y]) => (inFirstPart(f.division, fess, x, y) ? 0 : 1)));
  return f.tinctures.filter((_, i) => parts.has(i));
}

describe('every field shape gives the same verdict', () => {
  it('covers valid and rule-breaking designs', () => {
    const verdicts = DESIGNS.map(([, nd]) => verdict(nd).report.status);
    expect(verdicts.filter((s) => s === 'valid').length).toBeGreaterThan(100);
    const counterchanged = DESIGNS.filter(([, nd]) => nd.charges?.tincture === 'counterchanged').map(([, nd]) => verdict(nd).report.status);
    expect(counterchanged.filter((s) => s === 'valid').length).toBeGreaterThanOrEqual(COUNTERCHANGED.length + 3);
    expect(verdicts.filter((s) => s === 'violation').length).toBeGreaterThanOrEqual(BROKEN.length + 6);
  });

  for (const [name, nd] of DESIGNS) {
    it(`${name}: same issues, report, fix and locks in every shape`, () => {
      const canonical = verdict(nd);
      for (const shape of FIELD_SHAPES) expect(verdict(throughDraft({ design: nd, shape })), shape).toEqual(canonical);
    });

    if (nd.charges && chargeContext(nd.ordinary, nd.charges.placement) !== 'on') {
      it(`${name}: judged on the drawing in each shape, every charge gets its canonical verdict`, () => {
        const t = nd.charges!.tincture;
        const canonical = chargeSlotContacts(nd).map((cs) => chargeContrastFailure(t, nd.field, cs));
        for (const shape of FIELD_SHAPES) {
          const drawn = shapedChargeSlots(nd, shape).map((s) => chargeContrastFailure(t, nd.field, drawnContacts(nd, s, shape)));
          expect(drawn, shape).toEqual(canonical);
        }
      });
    }
  }

  it('the shape cannot be smuggled into the design itself', () => {
    const r = resolve({ v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' }, shape: 'round' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.map((e) => e.message)).toEqual(['Unknown design key "shape".']);
  });

  it('a chief stays above the per fess and per chevron lines in every shape (it touches only the upper part)', () => {
    for (const shape of FIELD_SHAPES) {
      const l = SHAPE_LAYOUT[shape];
      const chiefBase = Math.max(...l.ordinaries.chief.match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, i) => i % 2 === 1));
      expect(chiefBase, shape).toBeLessThan(l.fessPoint.y - 10);
    }
  });
});
