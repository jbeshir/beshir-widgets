// "Too close" scoring: a clear difference is 1 point, a minor one ½, and designs are different
// enough at 1. The table is every pair from the heraldic review of the uniqueness rule, with the
// verdict each now gets and the differences behind it.
import { describe, it, expect } from 'vitest';
import {
  TINCTURES, areDistinct, checkUnique, chargeGroup, chargesInGroup, differences, explainDifferences, pointsText,
  resolve, score, signature, tallyText, type NormDesign, type Verdict,
} from '../src/lib/heraldry';
import { plain, div, nd } from './helpers';

type Kind = Verdict['kind'];

const ord = (type: string, tincture: string) => ({ type, tincture });
const ch = (charge: string, tincture: string, extra: Record<string, unknown> = {}) =>
  ({ charge, count: 1, placement: 'field', tincture, ...extra });
const arms = (field: unknown, charges: unknown = null, ordinary: unknown = null) => nd({ v: 1, field, ordinary, charges });

const az = plain('azure');
const lion = (posture: string, tincture = 'or') => ch('lion', tincture, { posture });
const mullets = (count: number, arrangement: string | null = null) => ch('mullet', 'or', { count, arrangement });

function verdict(a: NormDesign, b: NormDesign): Kind {
  return checkUnique(a, signature(a), [{ id: 'existing', signature: signature(b), design: b }]).kind;
}

/** [pair, A, B, verdict before half points, verdict now, the differences now as attr:points]. */
const PAIRS: Array<[string, NormDesign, NormDesign, Kind, Kind, string[]]> = [
  ['lion vs unicorn rampant', arms(az, lion('rampant')), arms(az, ch('unicorn', 'or', { posture: 'rampant' })), 'ok', 'too-close', ['charge-type:½']],
  ['lion vs dragon rampant', arms(az, lion('rampant')), arms(az, ch('dragon', 'or', { posture: 'rampant' })), 'ok', 'ok', ['charge-type:1']],
  ['unicorn vs goat rampant', arms(az, ch('unicorn', 'or', { posture: 'rampant' })), arms(az, ch('goat', 'or', { posture: 'rampant' })), 'ok', 'too-close', ['charge-type:½']],
  ['lion vs wolf rampant', arms(az, lion('rampant')), arms(az, ch('wolf', 'or', { posture: 'rampant' })), 'ok', 'too-close', ['charge-type:½']],
  ['wolf vs boar passant', arms(az, ch('wolf', 'or', { posture: 'passant' })), arms(az, ch('boar', 'or', { posture: 'passant' })), 'ok', 'ok', ['charge-type:1']],
  ['wolf vs lion passant', arms(az, ch('wolf', 'or', { posture: 'passant' })), arms(az, lion('passant')), 'ok', 'too-close', ['charge-type:½']],
  ['wolf vs goat statant', arms(az, ch('wolf', 'or', { posture: 'statant' })), arms(az, ch('goat', 'or', { posture: 'statant' })), 'ok', 'too-close', ['charge-type:½']],
  ['stag vs goat statant', arms(az, ch('stag', 'or', { posture: 'statant' })), arms(az, ch('goat', 'or', { posture: 'statant' })), 'ok', 'ok', ['charge-type:1']],
  ['mullet vs sun', arms(az, ch('mullet', 'or')), arms(az, ch('sun', 'or')), 'ok', 'ok', ['charge-type:1']],
  ['sun vs gear', arms(az, ch('sun', 'or')), arms(az, ch('gear', 'or')), 'ok', 'too-close', ['charge-type:½']],
  ['rose vs sun', arms(az, ch('rose', 'or')), arms(az, ch('sun', 'or')), 'ok', 'too-close', ['charge-type:½']],
  ['flame vs tree', arms(az, ch('flame', 'or')), arms(az, ch('tree', 'or')), 'ok', 'ok', ['charge-type:1']],
  ['eagle vs owl', arms(az, ch('eagle', 'or')), arms(az, ch('owl', 'or')), 'ok', 'ok', ['charge-type:1']],
  ['Or lion vs Argent lion on Sable', arms(plain('sable'), lion('rampant')), arms(plain('sable'), lion('rampant', 'argent')), 'ok', 'ok', ['charge-tincture:1']],
  ['Azure vs Purpure field', arms(az, lion('rampant')), arms(plain('purpure'), lion('rampant')), 'ok', 'ok', ['field-tincture:1']],
  ['Sable vs Azure field', arms(plain('sable'), lion('rampant')), arms(az, lion('rampant')), 'ok', 'ok', ['field-tincture:1']],
  ['3 vs 4 mullets', arms(az, mullets(3)), arms(az, mullets(4)), 'ok', 'ok', ['charge-count:1', 'charge-arrangement:½']],
  ['4 vs 6 mullets (two and two vs three, two and one)', arms(az, mullets(4)), arms(az, mullets(6)), 'too-close', 'ok', ['charge-count:½', 'charge-arrangement:½']],
  ['4 in cross vs 5 in saltire', arms(az, mullets(4, 'in-cross')), arms(az, mullets(5)), 'too-close', 'ok', ['charge-count:½', 'charge-arrangement:½']],
  ['5 in cross vs 5 in saltire', arms(az, mullets(5, 'in-cross')), arms(az, mullets(5)), 'ok', 'ok', ['charge-arrangement:1']],
  ['4 two and two vs 4 in cross', arms(az, mullets(4)), arms(az, mullets(4, 'in-cross')), 'ok', 'ok', ['charge-arrangement:1']],
  ['3 in pale vs 3 in fess', arms(az, mullets(3, 'in-pale')), arms(az, mullets(3, 'in-fess')), 'ok', 'ok', ['charge-arrangement:1']],
  ['3 in bend vs 3 in bend sinister', arms(az, mullets(3, 'in-bend')), arms(az, mullets(3, 'in-bend-sinister')), 'ok', 'too-close', ['charge-arrangement:½']],
  ['2 in pale vs 2 in fess', arms(az, mullets(2)), arms(az, mullets(2, 'in-fess')), 'ok', 'ok', ['charge-arrangement:1']],
  ['wolf passant vs statant', arms(az, ch('wolf', 'or', { posture: 'passant' })), arms(az, ch('wolf', 'or', { posture: 'statant' })), 'too-close', 'too-close', ['charge-posture:½']],
  ['lion rampant vs sejant', arms(az, lion('rampant')), arms(az, lion('sejant')), 'ok', 'ok', ['charge-posture:1']],
  ['fish naiant vs haurient', arms(az, ch('fish', 'or', { posture: 'naiant' })), arms(az, ch('fish', 'or', { posture: 'haurient' })), 'ok', 'ok', ['charge-posture:1']],
  ['stag statant vs trippant', arms(az, ch('stag', 'or', { posture: 'statant' })), arms(az, ch('stag', 'or', { posture: 'passant' })), 'too-close', 'too-close', ['charge-posture:½']],
  ['hare sejant vs courant', arms(az, ch('hare', 'or', { posture: 'sejant' })), arms(az, ch('hare', 'or', { posture: 'passant' })), 'ok', 'ok', ['charge-posture:1']],
  ['per pale Or/Azure vs Azure/Or (lion Gules)', arms(div('per-pale', 'or', 'azure'), lion('rampant', 'gules')), arms(div('per-pale', 'azure', 'or'), lion('rampant', 'gules')), 'ok', 'too-close', ['field-tincture:½']],
  ['per bend vs per bend sinister (same tinctures)', arms(div('per-bend', 'or', 'azure'), lion('rampant', 'gules')), arms(div('per-bend-sinister', 'or', 'azure'), lion('rampant', 'gules')), 'ok', 'too-close', ['field-division:½']],
  ['bend vs bend sinister', arms(az, null, ord('bend', 'or')), arms(az, null, ord('bend-sinister', 'or')), 'ok', 'too-close', ['ordinary-type:½']],
  ['quarterly Or/Azure vs Azure/Or', arms(div('quarterly', 'or', 'azure')), arms(div('quarterly', 'azure', 'or')), 'ok', 'too-close', ['field-tincture:½']],
  ['per saltire vs quarterly', arms(div('per-saltire', 'or', 'azure')), arms(div('quarterly', 'or', 'azure')), 'ok', 'ok', ['field-division:1']],
  ['bordure vs none', arms(plain('sable'), ch('wolf', 'or', { posture: 'passant' })), arms(plain('sable'), ch('wolf', 'or', { posture: 'passant' }), ord('bordure', 'argent')), 'ok', 'ok', ['ordinary-presence:1']],
  ['bordure Argent vs bordure Or', arms(plain('sable'), ch('wolf', 'or', { posture: 'passant' }), ord('bordure', 'argent')), arms(plain('sable'), ch('wolf', 'or', { posture: 'passant' }), ord('bordure', 'or')), 'ok', 'ok', ['ordinary-tincture:1']],
  ['chief vs no chief', arms(plain('gules'), mullets(3)), arms(plain('gules'), mullets(3), ord('chief', 'or')), 'ok', 'ok', ['ordinary-presence:1']],
  ['on a fess vs between (same tinctures)', arms(plain('vert'), ch('rose', 'argent', { count: 3, placement: 'ordinary' }), ord('fess', 'or')), arms(plain('vert'), ch('rose', 'argent', { count: 3 }), ord('fess', 'or')), 'ok', 'ok', ['charge-placement:1']],
  ['fess vs pale', arms(az, null, ord('fess', 'or')), arms(az, null, ord('pale', 'or')), 'ok', 'ok', ['ordinary-type:1']],
  ['cross vs saltire', arms(az, null, ord('cross', 'or')), arms(az, null, ord('saltire', 'or')), 'ok', 'ok', ['ordinary-type:1']],
  ['chevron vs pile', arms(az, null, ord('chevron', 'or')), arms(az, null, ord('pile', 'or')), 'ok', 'ok', ['ordinary-type:1']],
  ['plain Azure vs per pale Azure and Vert (lion Or)', arms(az, lion('rampant')), arms(div('per-pale', 'azure', 'vert'), lion('rampant')), 'ok', 'ok', ['field-division:1']],
  ['per pale Azure/Purpure vs Azure/Sable (lion Or)', arms(div('per-pale', 'azure', 'purpure'), lion('rampant')), arms(div('per-pale', 'azure', 'sable'), lion('rampant')), 'ok', 'ok', ['field-tincture:1']],
  ['crescent with vs without a chief', arms(plain('sable'), ch('crescent', 'argent'), ord('chief', 'purpure')), arms(plain('sable'), ch('crescent', 'argent')), 'ok', 'ok', ['ordinary-presence:1']],
  // From the review's summary rather than its table.
  ['lion vs unicorn sejant', arms(az, lion('sejant')), arms(az, ch('unicorn', 'or', { posture: 'sejant' })), 'ok', 'too-close', ['charge-type:½']],
  ['rose vs gear', arms(az, ch('rose', 'or')), arms(az, ch('gear', 'or')), 'ok', 'too-close', ['charge-type:½']],
];

const summary = (a: NormDesign, b: NormDesign) => differences(a, b).map((d) => `${d.attr}:${pointsText(d.weight === 'clear' ? 1 : 0.5)}`);

describe('the reviewed uniqueness pairs', () => {
  for (const [name, a, b, , now, diffs] of PAIRS) {
    it(`${name}: ${now}`, () => {
      expect(summary(a, b)).toEqual(diffs);
      expect(verdict(a, b)).toBe(now);
      // Symmetric: it doesn't matter which of the two was registered first.
      expect(verdict(b, a)).toBe(now);
    });
  }

  it('turns every false pass into too close and every false conflict into a pass', () => {
    const changed = PAIRS.filter(([, , , before, now]) => before !== now).map(([name, , , before, now]) => `${before} → ${now}: ${name}`);
    expect(changed).toEqual([
      'ok → too-close: lion vs unicorn rampant',
      'ok → too-close: unicorn vs goat rampant',
      'ok → too-close: lion vs wolf rampant',
      'ok → too-close: wolf vs lion passant',
      'ok → too-close: wolf vs goat statant',
      'ok → too-close: sun vs gear',
      'ok → too-close: rose vs sun',
      'too-close → ok: 4 vs 6 mullets (two and two vs three, two and one)',
      'too-close → ok: 4 in cross vs 5 in saltire',
      'ok → too-close: 3 in bend vs 3 in bend sinister',
      'ok → too-close: per pale Or/Azure vs Azure/Or (lion Gules)',
      'ok → too-close: per bend vs per bend sinister (same tinctures)',
      'ok → too-close: bend vs bend sinister',
      'ok → too-close: quarterly Or/Azure vs Azure/Or',
      'ok → too-close: lion vs unicorn sejant',
      'ok → too-close: rose vs gear',
    ]);
  });
});

describe('similarity groups', () => {
  it('group the four-legged beasts and the round charges, and nothing else', () => {
    expect(chargesInGroup('quadruped')).toEqual(['lion', 'wolf', 'goat', 'unicorn']);
    expect(chargesInGroup('round')).toEqual(['rose', 'sun', 'gear']);
    expect(chargeGroup('stag')).toBe('stag');
    expect(chargeGroup('boar')).toBe('boar');
  });

  it('make every rampant swap among lion, wolf, unicorn and goat too close', () => {
    const beasts = chargesInGroup('quadruped');
    for (const x of beasts) for (const y of beasts) {
      if (x === y) continue;
      expect(verdict(arms(az, ch(x, 'or', { posture: 'rampant' })), arms(az, ch(y, 'or', { posture: 'rampant' }))), `${x} vs ${y}`).toBe('too-close');
    }
  });

  it('compare postures across the charges of a group', () => {
    // Type ½ + posture group 1: different enough.
    expect(verdict(arms(az, ch('wolf', 'or', { posture: 'passant' })), arms(az, lion('rampant')))).toBe('ok');
    // Type ½ + passant ↔ statant ½: different enough, only just.
    const wolf = arms(az, ch('wolf', 'or', { posture: 'statant' })), lionPassant = arms(az, lion('passant'));
    expect(summary(wolf, lionPassant)).toEqual(['charge-type:½', 'charge-posture:½']);
    expect(verdict(wolf, lionPassant)).toBe('ok');
  });
});

describe('scoring', () => {
  it('½ + ½ is different enough', () => {
    const a = arms(div('per-bend', 'or', 'azure'), lion('rampant', 'gules'));
    const b = arms(div('per-bend-sinister', 'azure', 'or'), lion('rampant', 'gules'));
    expect(summary(a, b)).toEqual(['field-division:½', 'field-tincture:½']);
    expect(score(differences(a, b))).toBe(1);
    expect(areDistinct(a, b)).toBe(true);
    const v = checkUnique(a, signature(a), [{ id: 'x', signature: signature(b), design: b }]);
    expect(v).toEqual({
      kind: 'ok',
      closest: { of: 'x', differences: [
        { attr: 'field-division', weight: 'minor', reason: 'mirrored' },
        { attr: 'field-tincture', weight: 'minor', reason: 'swapped-tinctures' },
      ] },
    });
  });

  it('a single ½ is too close', () => {
    const a = arms(az, lion('rampant')), b = arms(az, ch('goat', 'or', { posture: 'rampant' }));
    expect(score(differences(a, b))).toBe(0.5);
    expect(areDistinct(a, b)).toBe(false);
  });

  it('an ok verdict names no closest entry when every entry has a clear difference', () => {
    const a = arms(az, lion('rampant')), b = arms(az, lion('rampant', 'argent'));
    expect(checkUnique(a, signature(a), [{ id: 'x', signature: signature(b), design: b }])).toEqual({ kind: 'ok', closest: null });
  });

  it('keeps every change of tincture clear: Or ↔ Argent, and Celestine ↔ Azure or Argent', () => {
    for (const x of TINCTURES) for (const y of TINCTURES) {
      if (x === y) continue;
      const charge = (t: string) => arms(plain('gules'), lion('rampant', t));
      expect(summary(charge(x), charge(y)), `${x} vs ${y}`).toEqual(['charge-tincture:1']);
    }
    expect(summary(arms(plain('celestine'), lion('rampant', 'gules')), arms(az, lion('rampant', 'gules')))).toEqual(['field-tincture:1']);
    expect(summary(arms(plain('celestine'), lion('rampant', 'gules')), arms(plain('argent'), lion('rampant', 'gules')))).toEqual(['field-tincture:1']);
  });

  it('keeps counterchanged a clear charge tincture change on a divided field', () => {
    const field = div('per-pale', 'or', 'azure');
    expect(summary(arms(field, ch('mullet', 'counterchanged', { count: 3 })), arms(field, ch('mullet', 'gules', { count: 3 })))).toEqual(['charge-tincture:1']);
  });

  it('a mirrored arrangement with a different count is still only half', () => {
    expect(summary(arms(az, mullets(2, 'in-bend')), arms(az, mullets(3, 'in-bend-sinister')))).toEqual(['charge-count:1', 'charge-arrangement:½']);
  });

  it('four and five in cross, and four two and two and five in saltire, are one pattern', () => {
    expect(verdict(arms(az, mullets(4, 'in-cross')), arms(az, mullets(5, 'in-cross')))).toBe('too-close');
    expect(verdict(arms(az, mullets(4)), arms(az, mullets(5)))).toBe('too-close');
    expect(verdict(arms(az, mullets(5)), arms(az, mullets(6)))).toBe('ok');
  });
});

describe('explanations', () => {
  it('say in plain English why a difference counts half', () => {
    const notes = explainDifferences(arms(az, lion('rampant')), arms(az, ch('wolf', 'or', { posture: 'rampant' })));
    expect(notes).toEqual([{
      attr: 'charge-type', weight: 'minor', text: 'charge type (lion ↔ wolf)',
      why: "Lion and wolf count as the same shape at nametag size — that's only half a difference.",
    }]);
  });

  it('cover every kind of half difference', () => {
    const why = (a: NormDesign, b: NormDesign) => explainDifferences(a, b).map((n) => (n.weight === 'minor' ? n.why : n.text));
    expect(why(arms(div('per-bend', 'or', 'azure'), lion('rampant', 'gules')), arms(div('per-bend-sinister', 'or', 'azure'), lion('rampant', 'gules')))).toEqual([
      "Per bend and per bend sinister are mirror images; people remember the slant, not which way it runs — that's only half a difference.",
    ]);
    expect(why(arms(az, null, ord('bend', 'or')), arms(az, null, ord('bend-sinister', 'or')))).toEqual([
      "A bend and a bend sinister are mirror images; people remember the slant, not which way it runs — that's only half a difference.",
    ]);
    expect(why(arms(az, mullets(3, 'in-bend')), arms(az, mullets(3, 'in-bend-sinister')))).toEqual([
      "In bend and in bend sinister are mirror images; people remember the slant, not which way it runs — that's only half a difference.",
    ]);
    expect(why(arms(div('per-pale', 'or', 'azure'), lion('rampant', 'gules')), arms(div('per-pale', 'azure', 'or'), lion('rampant', 'gules')))).toEqual([
      "The same two colours with the sides swapped; people remember the colours, not which side was which — that's only half a difference.",
    ]);
    expect(why(arms(az, mullets(4, 'in-cross')), arms(az, mullets(5)))).toEqual([
      'Four or more charges all read as "lots" at nametag size, so a different number of them is only half a difference.',
      "The pattern changes as well as the number — that's another half a difference.",
    ]);
    expect(why(arms(az, ch('stag', 'or', { posture: 'passant' })), arms(az, ch('stag', 'or', { posture: 'statant' })))).toEqual([
      "Walking (trippant) and standing (statant) look almost the same — that's only half a difference.",
    ]);
  });

  it('tally the points', () => {
    expect(tallyText([{ weight: 'minor' }, { weight: 'minor' }])).toBe('½ + ½ = 1 — different enough');
    expect(tallyText([{ weight: 'minor' }])).toBe('½ — not enough (needs 1)');
    expect(tallyText([{ weight: 'clear' }, { weight: 'minor' }])).toBe('1 + ½ = 1½ — different enough');
    expect(tallyText([])).toBe('0 — not enough (needs 1)');
  });
});
