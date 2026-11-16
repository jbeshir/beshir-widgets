// Example arms for the Design tab: bold, rule-abiding and easy to spot, showing what a good design
// looks like. "Surprise me" picks another design of the same quality.

import {
  CORE_ART_IDS, FIELD_SHAPES, TINCTURES, groupTinctureChoices, tincturePaint, postureChoices, readability, resolve,
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
const single = (field: string, charge: string, tincture: string, extra: object = {}) => ({
  v: 2, field, groups: [{ item: { k: 'charge', charge, ...extra }, paint: tincture }],
});

// Modelled on common patterns in the SCA Ordinary & Armorial (a beast in a common posture, three of a
// charge, an ordinary between three, a charge and a chief, a divided field with a counterchanged
// charge, a charge within a bordure), but none is a registered blazon: real arms belong to real people.
export const EXAMPLE_DESIGNS: readonly ExampleDesign[] = [
  example('white-wolf-on-blue', 'White wolf on blue', 'heater', single('azure', 'wolf', 'argent', { posture: 'rampant' })),
  example('white-tower-on-red-with-border', 'White tower on red with a white border', 'banner', {
    v: 2, field: 'gules',
    groups: [
      { item: { k: 'charge', charge: 'tower' }, paint: 'argent' },
      { item: { k: 'ordinary', type: 'bordure' }, paint: 'argent' },
    ],
  }),
  example('three-gold-acorns-on-green', 'Three gold acorns on green', 'round', {
    v: 2, field: 'vert', groups: [{ item: { k: 'charge', charge: 'acorn' }, count: 3, paint: 'or' }],
  }),
  example('blue-dolphin-on-white', 'Blue dolphin on white', 'lozenge', single('argent', 'dolphin', 'azure')),
  example('swapped-crescent-on-blue-and-white', 'Crescent with swapped colours on a blue-and-white diagonal split', 'heater', {
    v: 2, field: { k: 'divided', division: 'per-bend', parts: ['azure', 'argent'] },
    groups: [{ item: { k: 'charge', charge: 'crescent' }, paint: 'counterchanged' }],
  }),
  example('white-peaked-band-between-three-stars-on-black', 'White peaked band between three stars on black', 'banner', {
    v: 2, field: 'sable',
    groups: [
      { item: { k: 'ordinary', type: 'chevron' }, paint: 'argent' },
      { item: { k: 'charge', charge: 'mullet' }, count: 3, relation: 'between', paint: 'argent' },
    ],
  }),
  example('gold-rose-on-purple-with-top-bar', 'Gold rose on purple with a gold top bar', 'round', {
    v: 2, field: 'purpure',
    groups: [
      { item: { k: 'charge', charge: 'rose' }, paint: 'or' },
      { item: { k: 'ordinary', type: 'chief' }, paint: 'or' },
    ],
  }),
];

/**
 * A random single charge on a plain field that follows the rules and reads at a glance. `random`
 * returns numbers in [0, 1), so a seeded generator makes the result repeatable.
 */
export function surpriseDesign(random: () => number): ShapedDesign {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  for (let attempt = 0; attempt < 50; attempt++) {
    const blank: Design = { v: 2, kind: 'arms', field: tincturePaint(pick<Tincture>(TINCTURES)), groups: [] };
    // only charges whose art is in the main chunk, so a surprise is drawn at once
    const withCharge = setCharge(blank, 'picture', pick<ChargeId>(CORE_ART_IDS));
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
