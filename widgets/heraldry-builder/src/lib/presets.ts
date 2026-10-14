// Example arms for the Design tab: bold, rule-abiding and easy to spot, showing what a good design
// looks like. "Surprise me" picks another design of the same quality.

import {
  CHARGE_IDS, FIELD_SHAPES, TINCTURES, groupTinctureChoices, tincturePaint, postureChoices, readability, resolve,
  type ChargeId, type Design, type FieldShape, type ShapedDesign, type Tincture,
} from './heraldry';
import { assess, picturePath, setCharge, setGroupTincture, setPosture } from './builder';

interface ExampleDesign extends ShapedDesign {
  id: string;
  /** Plain-words caption: the example's accessible name and tooltip. */
  caption: string;
}

/** The design of a literal that is known to be good; a bad literal is a programming error. */
function example(id: string, caption: string, shape: FieldShape, input: unknown): ExampleDesign {
  const r = resolve(input);
  if (!r.ok) throw new Error(`example ${id} does not resolve: ${r.errors.map((e) => e.message).join('; ')}`);
  return { id, caption, shape, design: r.design };
}

/** Arms of one plain-coloured picture on a plain field. */
const single = (field: string, charge: string, tincture: string) => ({
  v: 2, field, groups: [{ item: { k: 'charge', charge }, paint: tincture }],
});

export const EXAMPLE_DESIGNS: readonly ExampleDesign[] = [
  example('gold-lion-on-blue', 'Gold lion on blue', 'heater', single('azure', 'lion', 'or')),
  example('white-star-on-red', 'White star on red', 'round', single('gules', 'mullet', 'argent')),
  example('gold-sun-on-black', 'Gold sun on black', 'lozenge', single('sable', 'sun', 'or')),
  example('gold-eagle-on-green', 'Gold eagle on green', 'banner', single('vert', 'eagle', 'or')),
  example('sky-blue-crescent-on-black', 'Sky-blue moon on black', 'heater', single('sable', 'crescent', 'celestine')),
  example('swapped-star-on-gold-and-blue', 'Star with swapped colours on a gold-and-blue split', 'heater', {
    v: 2, field: { k: 'divided', division: 'per-pale', parts: ['or', 'azure'] },
    groups: [{ item: { k: 'charge', charge: 'mullet' }, paint: 'counterchanged' }],
  }),
  example('white-anchor-on-blue-with-border', 'White anchor on blue with a white border', 'banner', {
    v: 2, field: 'azure',
    groups: [
      { item: { k: 'ordinary', type: 'bordure' }, paint: 'argent' },
      { item: { k: 'charge', charge: 'anchor' }, paint: 'argent' },
    ],
  }),
  example('gold-crown-on-purple', 'Gold crown on purple', 'round', single('purpure', 'crown', 'or')),
];

/**
 * A random single charge on a plain field that follows the rules and reads at a glance. `random`
 * returns numbers in [0, 1), so a seeded generator makes the result repeatable.
 */
export function surpriseDesign(random: () => number): ShapedDesign {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  for (let attempt = 0; attempt < 50; attempt++) {
    const blank: Design = { v: 2, kind: 'arms', field: tincturePaint(pick<Tincture>(TINCTURES)), groups: [] };
    const withCharge = setCharge(blank, 'picture', pick<ChargeId>(CHARGE_IDS));
    const path = picturePath(withCharge)!;
    const tinctures = groupTinctureChoices(withCharge, path).filter((c) => c.allowed && c.value !== 'counterchanged');
    const postures = postureChoices(withCharge, path).filter((c) => c.allowed);
    if (tinctures.length === 0) continue;
    const toned = setGroupTincture(withCharge, path, pick(tinctures).value);
    const design = postures.length > 1 ? setPosture(toned, path, pick(postures).value) : toned;
    if (assess(design).status === 'valid' && readability(design).band === 'bold') return { design, shape: pick(FIELD_SHAPES) };
  }
  return { design: EXAMPLE_DESIGNS[0].design, shape: EXAMPLE_DESIGNS[0].shape };
}
