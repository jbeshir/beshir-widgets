// The field shape is display only, so every shape must give a design the same verdict. The rule of tincture
// is judged on the canonical (heater) layout and the verdict functions take only the design; these tests cover
// the validation examples, a set of rule-breaking designs and a seeded batch of generated designs:
//   - a design carried as a draft in each shape (stored, read back, resolved) comes back unchanged, so its
//     issues, readability and text are the same as in every other shape. The verdict functions never receive
//     the shape, so this guards the draft round trip and documents that signature, not the rule itself;
//   - judged instead on what is actually drawn in each shape (its own slots and partition lines), every
//     charge gets the same per-slot verdict as the canonical one, so the picture never shows a clash the
//     verdict missed, nor hides one it reported.
// The one-click fix and the tincture locks depend on the builder's option logic; their shape assertions are in
// the builder tests.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, blazon, contrastFailure, fieldTinctures, gloss, groundContacts, groupSlots, inFirstPart, probePoints, readability, resolve,
  shapeFrame, signature, validate, walkGroups, type Design, type FieldShape, type ShapedDesign, type Slot, type Tincture,
} from '../src/lib/heraldry/next';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';
import { generatedDesigns } from './next-design-generator';
import { V } from './next-validation-cases';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);

/** Designs that break the rule of tincture on part of a divided field, in each kind of placement. */
const BROKEN: Array<[string, unknown]> = [
  ['per fess, 2-1 mullets', arms(div('per-fess', 'azure', 'or'), chg('mullet', 'gules', { count: 3 }))],
  ['per pale, 2 roses in fess', arms(div('per-pale', 'or', 'gules'), chg('rose', 'azure', { count: 2, arrangement: 'in-fess' }))],
  ['per bend, 3 keys in bend', arms(div('per-bend', 'or', 'argent'), chg('key', 'argent', { count: 3, arrangement: 'in-bend' }))],
  ['per saltire, 5 hearts', arms(div('per-saltire', 'vert', 'or'), chg('heart', 'gules', { count: 5 }))],
  ['per chevron, 3 in fess', arms(div('per-chevron', 'gules', 'argent'), chg('crown', 'or', { count: 3, arrangement: 'in-fess' }))],
  ['quarterly, 4 two and two', arms(div('quarterly', 'or', 'azure'), chg('anchor', 'gules', { count: 4, arrangement: 'rows-2-2' }))],
  ['quarterly, 5 in cross', arms(div('quarterly', 'argent', 'or'), chg('anchor', 'or', { count: 5, arrangement: 'in-cross' }))],
  ['per pale, 6 lions', arms(div('per-pale', 'azure', 'argent'), chg('lion', 'or', { count: 6 }))],
  ['per fess, chief, 3 under', arms(div('per-fess', 'argent', 'gules'), ord('chief', 'azure'), chg('mullet', 'argent', { count: 3 }))],
  ['per bend sinister, bordure, 2', arms(div('per-bend-sinister', 'or', 'vert'), ord('bordure', 'sable'), chg('rose', 'or', { count: 2, arrangement: 'in-bend-sinister' }))],
  ['per pale, fess between 3', arms(div('per-pale', 'gules', 'or'), ord('fess', 'argent'), chg('sun', 'azure', { count: 3 }))],
  ['plain, colour on colour', arms('vert', chg('wolf', 'gules', { count: 2 }))],
  ['on a pale, metal on metal', arms('azure', ord('pale', 'or', { charged: [chg('key', 'argent', { count: 3 })] }))],
  ['counterchanged on two metals', arms(div('per-pale', 'or', 'argent'), chg('mullet', 'counterchanged', { count: 3 }))],
  ['counterchanged on two colours', arms(div('quarterly', 'gules', 'azure'), chg('rose', 'counterchanged', { count: 4 }))],
  ['counterchanged on a plain field', arms('vert', chg('mullet', 'counterchanged', { count: 2 }))],
  ['counterchanged on an ordinary', arms(div('per-fess', 'or', 'azure'), ord('fess', 'gules', { charged: [chg('key', 'counterchanged', { count: 3 })] }))],
  ['a chief with a rose across per bend', arms(div('per-bend', 'argent', 'sable'), chg('rose', 'gules'), ord('chief', 'gules'))],
  ['forced in chief on per chevron', arms(div('per-chevron', 'vert', 'or'), chg('sun', 'or', { count: 2 }))],
];

/** Counterchanged charges on a metal-and-colour field, in every division and kind of field placement. */
const COUNTERCHANGED: Array<[string, unknown]> = [
  ['per pale, 3 two and one', arms(div('per-pale', 'or', 'azure'), chg('mullet', 'counterchanged', { count: 3 }))],
  ['per fess, 2 in bend', arms(div('per-fess', 'gules', 'argent'), chg('rose', 'counterchanged', { count: 2, arrangement: 'in-bend' }))],
  ['per bend, 3 in fess', arms(div('per-bend', 'celestine', 'vert'), chg('key', 'counterchanged', { count: 3, arrangement: 'in-fess' }))],
  ['per bend sinister, single', arms(div('per-bend-sinister', 'sable', 'or'), chg('lion', 'counterchanged'))],
  ['per saltire, 5 in cross', arms(div('per-saltire', 'argent', 'purpure'), chg('heart', 'counterchanged', { count: 5, arrangement: 'in-cross' }))],
  ['per chevron, 6', arms(div('per-chevron', 'azure', 'or'), chg('crescent', 'counterchanged', { count: 6 }))],
  ['quarterly, 4 two and two', arms(div('quarterly', 'or', 'gules'), chg('anchor', 'counterchanged', { count: 4 }))],
  ['per pale, chief, 3 under', arms(div('per-pale', 'argent', 'vert'), ord('chief', 'sable'), chg('mullet', 'counterchanged', { count: 3 }))],
  ['per fess, bordure, 2', arms(div('per-fess', 'or', 'sable'), ord('bordure', 'gules'), chg('sun', 'counterchanged', { count: 2 }))],
  ['per pale, fess counterchanged', arms(div('per-pale', 'argent', 'gules'), ord('fess', 'counterchanged'))],
  ['per pale, chief counterchanged', arms(div('per-pale', 'argent', 'gules'), ord('chief', 'counterchanged'), chg('mullet', 'or'))],
];

const DESIGNS: Array<[string, Design]> = [
  ...V.map((c): [string, unknown] => [c.id, c.design]),
  ...BROKEN,
  ...COUNTERCHANGED,
].flatMap(([name, raw]) => {
  const r = resolve(raw);
  return r.ok ? [[name, r.design] as [string, Design]] : [];
}).concat(generatedDesigns(4242, 200).map((d, i): [string, Design] => [`generated ${i}`, d]));

/** As the builder holds it: written as a draft in a shape, read back and re-resolved. */
function throughDraft(shaped: ShapedDesign): Design {
  const stored = JSON.parse(JSON.stringify(shaped)) as { design: unknown };
  const r = resolve(stored.design);
  if (!r.ok) throw new Error('draft did not resolve');
  return r.design;
}

/** Everything that is decided about a design's validity and text. */
function verdict(d: Design) {
  return { issues: validate(d), readability: readability(d), blazon: blazon(d), gloss: gloss(d), signature: signature(d) };
}

/** Field tinctures a slot touches as drawn in a shape: the five-point probe against that shape's lines. */
function drawnContacts(d: Design, slot: Slot, shape: FieldShape): Tincture[] {
  const parts = fieldTinctures(d);
  if (d.kind !== 'arms' || d.field.k !== 'divided') return parts;
  const division = d.field.division;
  const fess = shapeFrame(shape).fessPoint;
  const seen = new Set<number>(probePoints(slot).map(([x, y]) => (inFirstPart(division, fess, x, y) ? 0 : 1)));
  return parts.filter((_, i) => seen.has(i));
}

describe('field shapes and the verdict', () => {
  it('covers valid and rule-breaking designs', () => {
    const verdicts = DESIGNS.map(([, d]) => validate(d).length === 0);
    expect(verdicts.filter(Boolean).length).toBeGreaterThan(100);
    expect(verdicts.filter((ok) => !ok).length).toBeGreaterThanOrEqual(BROKEN.length + 6);
    const counterchanged = DESIGNS.filter(([, d]) => walkGroups(d).some(({ group: g }) => g.paint.k === 'counterchanged')).map(([, d]) => validate(d).length === 0);
    expect(counterchanged.filter(Boolean).length).toBeGreaterThanOrEqual(COUNTERCHANGED.length);
  });

  for (const [name, d] of DESIGNS) {
    it(`${name}: a draft in any shape reads back with the same verdict and text`, () => {
      const canonical = verdict(d);
      for (const shape of FIELD_SHAPES) expect(verdict(throughDraft({ design: d, shape })), shape).toEqual(canonical);
    });

    // Charges on the field (primary, or between a band): the slots drawn in each shape get the canonical verdict.
    // (Where a probe lands within a hair of a partition line the parts may differ; the verdict may not.)
    const onField = walkGroups(d).filter(({ group: g, host, path }) => g.item.k === 'charge' && host === null && groupSlots(d, path, 'heater').length > 0);
    if (onField.length > 0) {
      it(`${name}: judged on the drawing in each shape, every charge gets its canonical verdict`, () => {
        for (const { path, group: g } of onField) {
          const judge = (contacts: Tincture[]) => (g.paint.k === 'tincture' ? contrastFailure(g.paint.t, contacts) : null);
          const canonical = groundContacts(d, path).map(judge);
          for (const shape of FIELD_SHAPES) {
            expect(groupSlots(d, path, shape).map((s) => judge(drawnContacts(d, s, shape))), shape).toEqual(canonical);
          }
        }
      });
    }
  }

  it('the shape cannot be smuggled into the design itself', () => {
    const r = resolve({ ...arms('azure', ord('bend', 'or')), shape: 'round' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.map((e) => e.message)).toEqual(['Unknown design key "shape".']);
  });

  it('a chief stays above the per fess and per chevron lines in every shape (it touches only the upper part)', () => {
    for (const shape of FIELD_SHAPES) {
      const l = shapeFrame(shape);
      expect(l.chiefBase, shape).toBeLessThan(l.fessPoint.y - 10);
    }
  });

  it('a design built on the sample of the validation cases is the same design whatever shape it is read in', () => {
    const d = nd(V[1].design);
    for (const shape of FIELD_SHAPES) expect(throughDraft({ design: d, shape })).toEqual(d);
  });
});
