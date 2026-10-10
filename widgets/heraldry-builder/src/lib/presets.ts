// Starting designs for the Design tab's gallery: bold, rule-abiding and easy to spot, so a first-time
// visitor has something good to start from. "Surprise me" picks another design of the same quality.

import {
  CHARGE_IDS, FIELD_SHAPES, TINCTURES, chargeTinctureChoices, postureChoices, readability,
  type ChargeId, type NormDesign, type ShapedDesign, type Tincture,
} from './heraldry';
import { DEFAULT_DESIGN, assess, setCharge, setChargeTincture, setPosture } from './builder';

interface StartingDesign extends ShapedDesign {
  id: string;
  /** Plain-words caption shown under the picture. */
  caption: string;
}

const plain = (tincture: Tincture) => ({ kind: 'plain', tincture }) as const;

export const STARTING_DESIGNS: readonly StartingDesign[] = [
  {
    id: 'gold-lion-on-blue', caption: 'Gold lion on blue', shape: 'heater',
    design: { v: 1, field: plain('azure'), ordinary: null, charges: { charge: 'lion', count: 1, placement: 'field', arrangement: 'single', posture: 'rampant', tincture: 'or' } },
  },
  {
    id: 'white-star-on-red', caption: 'White star on red', shape: 'round',
    design: { v: 1, field: plain('gules'), ordinary: null, charges: { charge: 'mullet', count: 1, placement: 'field', arrangement: 'single', posture: null, tincture: 'argent' } },
  },
  {
    id: 'gold-sun-on-black', caption: 'Gold sun on black', shape: 'lozenge',
    design: { v: 1, field: plain('sable'), ordinary: null, charges: { charge: 'sun', count: 1, placement: 'field', arrangement: 'single', posture: null, tincture: 'or' } },
  },
  {
    id: 'gold-eagle-on-green', caption: 'Gold eagle on green', shape: 'banner',
    design: { v: 1, field: plain('vert'), ordinary: null, charges: { charge: 'eagle', count: 1, placement: 'field', arrangement: 'single', posture: 'displayed', tincture: 'or' } },
  },
  {
    id: 'sky-blue-crescent-on-black', caption: 'Sky-blue moon on black', shape: 'heater',
    design: { v: 1, field: plain('sable'), ordinary: null, charges: { charge: 'crescent', count: 1, placement: 'field', arrangement: 'single', posture: null, tincture: 'celestine' } },
  },
  {
    id: 'swapped-star-on-gold-and-blue', caption: 'Star with swapped colours on a gold-and-blue split', shape: 'heater',
    design: {
      v: 1, field: { kind: 'divided', division: 'per-pale', tinctures: ['or', 'azure'] }, ordinary: null,
      charges: { charge: 'mullet', count: 1, placement: 'field', arrangement: 'single', posture: null, tincture: 'counterchanged' },
    },
  },
  {
    id: 'white-anchor-on-blue-with-border', caption: 'White anchor on blue with a white border', shape: 'banner',
    design: {
      v: 1, field: plain('azure'), ordinary: { type: 'bordure', tincture: 'argent' },
      charges: { charge: 'anchor', count: 1, placement: 'field', arrangement: 'single', posture: null, tincture: 'argent' },
    },
  },
  {
    id: 'gold-crown-on-purple', caption: 'Gold crown on purple', shape: 'round',
    design: { v: 1, field: plain('purpure'), ordinary: null, charges: { charge: 'crown', count: 1, placement: 'field', arrangement: 'single', posture: null, tincture: 'or' } },
  },
];

/**
 * A random single charge on a plain field that follows the rules and reads at a glance. `random`
 * returns numbers in [0, 1), so a seeded generator makes the result repeatable.
 */
export function surpriseDesign(random: () => number): ShapedDesign {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  for (let attempt = 0; attempt < 50; attempt++) {
    const blank: NormDesign = { ...DEFAULT_DESIGN, field: { kind: 'plain', tincture: pick(TINCTURES) } };
    const withCharge = setCharge(blank, pick<ChargeId>(CHARGE_IDS));
    const tinctures = chargeTinctureChoices(withCharge).filter((c) => c.allowed && c.value !== 'counterchanged');
    const postures = postureChoices(withCharge).filter((c) => c.allowed);
    if (tinctures.length === 0) continue;
    const toned = setChargeTincture(withCharge, pick(tinctures).value);
    const design = postures.length > 1 ? setPosture(toned, pick(postures).value) : toned;
    if (assess(design).status === 'valid' && readability(design).band === 'bold') return { design, shape: pick(FIELD_SHAPES) };
  }
  return { design: STARTING_DESIGNS[0].design, shape: STARTING_DESIGNS[0].shape };
}
