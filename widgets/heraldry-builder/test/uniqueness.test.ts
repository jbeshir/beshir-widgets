// SENA conflict (RULES §C): the worked examples of RULES §C.8 and the plan, the substantial and distinct
// changes group by group with their SENA rules, the explanation texts, the tally, and checkUnique's order.
import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, CHARGES, CLEAR_CHANGE_HINT, BUILDER_DIVISIONS, SENA_RULES, SENA_RULE_HINT, candidateKey, changeLabel, checkUnique, differences,
  explainDifferences, isChangeKind, isClear, isDiffAttr, isSenaRule, normalise, registrationOrder, reportUniqueness, signature, tallyText, walkGroups,
  blazon, checkResponse, type CheckableEntry,
  type Design, type Diff, type RegistryEntryLike, type Verdict,
} from '../src/lib/heraldry';
import { generatedDesigns, generatedRichDesigns } from './design-generator';
import { arms, charge, div, group, nd, ordinary } from './helpers';
import { rotatesIn, sampleSeed } from './rotation';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);

/** A registrable design (it normalises), from loose input. */
function design(...input: Parameters<typeof arms>): Design {
  const d = nd(arms(...input));
  const n = normalise(d);
  if (!n.ok) throw new Error(`not registrable: ${JSON.stringify(n)}`);
  return n.design;
}

const summary = (diffs: readonly Diff[]) => diffs.map((d) => `${d.attr}:${d.kind}:${d.rule}`);
const between = (a: Design, b: Design) => summary(differences(a, b));

describe('worked checks (RULES §C.8, plan §5.9)', () => {
  const lion = (paint = 'argent', attrs: object = {}) => chg('lion', paint, {}, attrs);

  it('a chief against a bordure is one distinct change of type: a conflict', () => {
    const a = design('sable', lion(), ord('chief', 'or'));
    const b = design('sable', lion(), ord('bordure', 'or'));
    expect(between(a, b)).toEqual(['type:dc:A5G4']);
    expect(isClear(differences(a, b))).toBe(false);
  });

  it('adding a chief and a bendlet-free secondary: a chief carrying roses is two added groups, so clear', () => {
    const plain = design('sable', lion());
    const charged = design('sable', lion(), ord('chief', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }));
    expect(between(charged, plain)).toEqual(['group-presence:dc:A5G2', 'group-presence:dc:A5G2']);
    expect(isClear(differences(charged, plain))).toBe(true);
    const bare = design('sable', lion(), ord('chief', 'or'));
    expect(between(bare, plain)).toEqual(['group-presence:dc:A5G2']);
  });

  it('a chief and a bordure beside a lion: each is a group of its own, so each added or removed is one distinct change', () => {
    const both = design('sable', lion(), ord('chief', 'or'), ord('bordure', 'or'));
    const chiefOnly = design('sable', lion(), ord('chief', 'or'));
    const bare = design('sable', lion());
    expect(between(both, chiefOnly)).toEqual(['group-presence:dc:A5G2']);
    expect(between(both, bare)).toEqual(['group-presence:dc:A5G2', 'group-presence:dc:A5G2']);
    expect(isClear(differences(both, bare))).toBe(true);
    expect(isClear(differences(both, chiefOnly))).toBe(false);
    // The signature lists the chief before the bordure, whichever order they were given in.
    expect(signature(design('sable', lion(), ord('bordure', 'or'), ord('chief', 'or')))).toBe(signature(both));
  });

  it('charges in chief against the same in base, or around the primary: one distinct change of arrangement (an unforced move, RB §5.2)', () => {
    const at = (position: string) => design('azure', ord('fess', 'or'), chg('mullet', 'argent', { count: 3, position }));
    expect(between(at('chief'), at('base'))).toEqual(['arrangement:dc:A5G6']);
    const around = design('azure', ord('fess', 'or'), chg('mullet', 'argent', { count: 3 }));
    expect(between(at('chief'), around)).toEqual(['arrangement:dc:A5G6']);
    expect(explainDifferences(at('chief'), around).map((n) => n.text)).toEqual(['arrangement of pictures in chief (in chief ↔ placed by the ordinary)']);
    // Charges in chief added beside a lion: one more group.
    expect(between(design('azure', lion('or'), chg('mullet', 'argent', { count: 3, position: 'chief' })), design('azure', lion('or')))).toEqual(['group-presence:dc:A5G2']);
  });

  it('charges around a primary charge: their layout is chosen (a DC when it changes), and adding them is one more group', () => {
    const around = (arrangement: string) => design('azure', lion('or'), chg('mullet', 'argent', { count: 4, relation: 'between', arrangement }));
    expect(between(around('in-saltire'), around('in-cross'))).toEqual(['arrangement:dc:A5G6']);
    expect(explainDifferences(around('in-saltire'), around('in-cross')).map((n) => n.text)).toEqual(['arrangement of pictures around the picture (in saltire ↔ in cross)']);
    expect(between(around('in-saltire'), design('azure', lion('or')))).toEqual(['group-presence:dc:A5G2']);
    // Around the lion or in chief beside it: the same secondary group in another place.
    expect(between(design('azure', lion('or'), chg('mullet', 'argent', { count: 3, relation: 'between' })), design('azure', lion('or'), chg('mullet', 'argent', { count: 3, position: 'chief' }))))
      .toEqual(['arrangement:dc:A5G6']);
  });

  it('one mullet against three: a substantial change of number', () => {
    expect(between(design('sable', chg('mullet', 'or')), design('sable', chg('mullet', 'or', { count: 3 })))).toEqual(['number:sc:A5E3']);
  });

  it('per pale against per fess: a substantial change of partition', () => {
    expect(between(design(div('per-pale', 'argent', 'gules')), design(div('per-fess', 'argent', 'gules')))).toEqual(['field-partition:sc:A5F1']);
  });

  it('per pale azure and gules against gules and azure: one distinct change', () => {
    const a = design(div('per-pale', 'azure', 'gules')), b = design(div('per-pale', 'gules', 'azure'));
    expect(between(a, b)).toEqual(['field-tincture:dc:A5G1a']);
    expect(isClear(differences(a, b))).toBe(false);
  });

  it('a hare courant against a hare sejant: a substantial change of posture', () => {
    const courant = design('gules', chg('hare', 'or', {}, { posture: 'courant' }));
    const sejant = design('gules', chg('hare', 'or', {}, { posture: 'sejant' }));
    expect(between(courant, sejant)).toEqual(['posture:sc:A5E5']);
  });

  it('four mullets two and two against four in cross: a substantial change of arrangement', () => {
    const rows = design('gules', chg('mullet', 'argent', { count: 4 }));
    const cross = design('gules', chg('mullet', 'argent', { count: 4, arrangement: 'in-cross' }));
    expect(between(rows, cross)).toEqual(['arrangement:sc:A5E4']);
  });

  it('the same design with another tincture of the primary only: one distinct change', () => {
    expect(between(design('sable', lion('argent')), design('sable', lion('or')))).toEqual(['tincture:dc:A5G3']);
  });

  it('four mullets against six: no substantial change of number (4+), but two and two against three, two and one is a substantial change of arrangement (A5E4)', () => {
    const four = design('azure', chg('mullet', 'or', { count: 4 })), six = design('azure', chg('mullet', 'or', { count: 6 }));
    expect(between(four, six)).toEqual(['arrangement:sc:A5E4', 'number:dc:A5G5']);
    // In one A5E4 group (two and two, in saltire) the counts alone give a distinct change.
    expect(between(four, design('azure', chg('mullet', 'or', { count: 5, arrangement: 'in-saltire' })))).toEqual(['number:dc:A5G5']);
  });

  it('six mullets three, two and one against eight in orle: a substantial change of arrangement across counts (the A5E4 example)', () => {
    const six = design('argent', chg('mullet', 'gules', { count: 6 })), eight = design('argent', chg('mullet', 'gules', { count: 8, arrangement: 'in-orle' }));
    expect(between(six, eight)).toEqual(['arrangement:sc:A5E4']);
    expect(isClear(differences(six, eight))).toBe(true);
  });

  it('a fish naiant against haurient is a substantial change of posture; a wolf passant against rampant too', () => {
    expect(between(design('azure', chg('fish', 'or', {}, { posture: 'naiant' })), design('azure', chg('fish', 'or', {}, { posture: 'haurient' })))).toEqual(['posture:sc:A5E5']);
    expect(between(design('azure', chg('wolf', 'or', {}, { posture: 'passant' })), design('azure', chg('wolf', 'or', {}, { posture: 'rampant' })))).toEqual(['posture:sc:A5E5']);
  });

  it('a lion passant against statant, and a sun in splendour against a sun, are the same', () => {
    expect(between(design('azure', lion('or', { posture: 'passant' })), design('azure', lion('or', { posture: 'statant' })))).toEqual([]);
    const splendour = design('azure', chg('sun', 'or', {}, { mods: [{ id: 'in-splendour' }] }));
    expect(between(splendour, design('azure', chg('sun', 'or')))).toEqual([]);
  });

  it('identical designs differ in nothing', () => {
    const d = design('sable', lion(), ord('chief', 'or'));
    expect(differences(d, d)).toEqual([]);
  });
});

describe('the field (A5F, A5G1)', () => {
  const withLion = (field: unknown) => design(field, chg('lion', 'or'));

  it('plain against divided is a substantial change, and so is each pair of drawn divisions', () => {
    expect(between(withLion('azure'), withLion(div('per-pale', 'azure', 'vert')))).toEqual(['field-partition:sc:A5F1']);
    for (const a of BUILDER_DIVISIONS) for (const b of BUILDER_DIVISIONS) {
      const expected = a === b ? [] : ['field-partition:sc:A5F1'];
      expect(between(design(div(a, 'azure', 'vert'), chg('mullet', 'argent')), design(div(b, 'azure', 'vert'), chg('mullet', 'argent'))), `${a} vs ${b}`).toEqual(expected);
    }
  });

  it('bend against bend sinister is a substantial change (SENA A5F1b), not a half', () => {
    expect(between(withLion(div('per-bend', 'azure', 'vert')), withLion(div('per-bend-sinister', 'azure', 'vert')))).toEqual(['field-partition:sc:A5F1']);
  });

  it('with a primary group a changed field tincture is one distinct change, however much it changes', () => {
    expect(between(withLion('azure'), withLion('vert'))).toEqual(['field-tincture:dc:A5G1a']);
    expect(between(withLion(div('per-pale', 'azure', 'gules')), withLion(div('per-pale', 'vert', 'sable')))).toEqual(['field-tincture:dc:A5G1a']);
  });

  it('field-primary armory: a plain field with nothing in common is a substantial change (A5F2)', () => {
    const a = design('azure', ord('chief', 'argent')), b = design('gules', ord('chief', 'argent'));
    expect(between(a, b)).toEqual(['field-tincture:sc:A5F2']);
  });

  it('field-primary armory, divided: every part changed and each side has a colour the other lacks (A5F2)', () => {
    const base = design(div('per-pale', 'azure', 'gules'), ord('chief', 'argent'));
    expect(between(base, design(div('per-pale', 'gules', 'vert'), ord('chief', 'argent')))).toEqual(['field-tincture:sc:A5F2']);
    expect(between(base, design(div('per-pale', 'vert', 'sable'), ord('chief', 'argent')))).toEqual(['field-tincture:sc:A5F2']);
    // a swap: every part changed, but neither side has a colour the other lacks
    expect(between(base, design(div('per-pale', 'gules', 'azure'), ord('chief', 'argent')))).toEqual(['field-tincture:dc:A5G1a']);
    // one part kept
    expect(between(base, design(div('per-pale', 'azure', 'vert'), ord('chief', 'argent')))).toEqual(['field-tincture:dc:A5G1a']);
  });

  it('a fielded design with only a partial change: per pale azure/argent against azure/vert is one distinct change', () => {
    expect(between(withLion(div('per-pale', 'azure', 'argent')), withLion(div('per-pale', 'azure', 'vert')))).toEqual(['field-tincture:dc:A5G1a']);
  });

  it('A5F2 needs both designs to be field-primary', () => {
    const fieldPrimary = design('azure', ord('chief', 'argent'));
    const withPrimary = design('gules', ord('fess', 'argent'), ord('chief', 'argent'));
    expect(between(fieldPrimary, withPrimary)).toContain('primary-presence:sc:A5E1');
    expect(between(fieldPrimary, withPrimary)).not.toContain('field-tincture:sc:A5F2');
  });
});

describe('counterchanged groups compare by the tinctures they show (A5G3a)', () => {
  const lion = (paint: string, extra: object = {}, attrs: object = {}) => chg('lion', paint, extra, attrs);

  it('X1: a lion counterchanged lying wholly in chief is not offered, and as the gules lion it shows it differs from a gules lion sejant by posture only', () => {
    const field = div('per-fess', 'argent', 'gules');
    const counterchanged = nd(arms(field, lion('counterchanged', { position: 'chief' })));
    expect(normalise(counterchanged).ok).toBe(false);
    const sejant = design(field, lion('gules', {}, { posture: 'sejant' }));
    expect(between(counterchanged, sejant)).toEqual(['posture:dc:A5G7']);
    expect(between(design(field, lion('gules')), sejant)).toEqual(['posture:dc:A5G7']);
  });

  it('X2: a chief counterchanged on a field per fess shows one tincture: against a gules chief only the lion differs', () => {
    const field = div('per-fess', 'argent', 'gules');
    const counterchanged = nd(arms(field, lion('sable'), ord('chief', 'counterchanged')));
    expect(normalise(counterchanged).ok).toBe(false);
    const gules = nd(arms(field, lion('azure'), ord('chief', 'gules')));
    expect(between(counterchanged, gules)).toEqual(['tincture:dc:A5G3']);
    expect(isClear(differences(counterchanged, gules))).toBe(false);
  });

  it('P22: changing the field under a counterchanged lion changes half the lion: a distinct change for each', () => {
    const a = design(div('per-pale', 'argent', 'gules'), lion('counterchanged'));
    const b = design(div('per-pale', 'or', 'gules'), lion('counterchanged'));
    expect(between(a, b)).toEqual(['field-tincture:dc:A5G1a', 'tincture:dc:A5G3']);
    expect(isClear(differences(a, b))).toBe(true);
  });

  it('P23: swapping the field, and so the counterchanged lion, is a distinct change for each', () => {
    const a = design(div('per-pale', 'argent', 'gules'), lion('counterchanged'));
    const b = design(div('per-pale', 'gules', 'argent'), lion('counterchanged'));
    expect(between(a, b)).toEqual(['field-tincture:dc:A5G1a', 'tincture:dc:A5G3']);
  });

  it('P38: a counterchanged fess on argent and gules against one on argent and vert', () => {
    const a = design(div('per-pale', 'argent', 'gules'), ord('fess', 'counterchanged'));
    const b = design(div('per-pale', 'argent', 'vert'), ord('fess', 'counterchanged'));
    expect(between(a, b)).toEqual(['field-tincture:dc:A5G1a', 'tincture:dc:A5G3']);
  });

  it('a counterchanged lion against a plain one differs over the half that changed, and not at all against itself', () => {
    const field = div('per-pale', 'argent', 'gules');
    const counterchanged = design(field, lion('counterchanged'));
    expect(between(counterchanged, nd(arms(field, lion('argent'))))).toEqual(['tincture:dc:A5G3']);
    expect(between(counterchanged, design(field, lion('counterchanged')))).toEqual([]);
  });
});

describe('the primary group (A5E)', () => {
  it('adding or removing it is a substantial change (A5E1), either way round', () => {
    const fieldPrimary = design('sable', ord('chief', 'or'));
    const withLion = design('sable', chg('lion', 'argent'), ord('chief', 'or'));
    expect(between(fieldPrimary, withLion)).toEqual(['primary-presence:sc:A5E1']);
    expect(between(withLion, fieldPrimary)).toEqual(['primary-presence:sc:A5E1']);
  });

  it('a change of type is substantial between unrelated shapes, and only a distinct change between charges of one class (A5E2, A5G4)', () => {
    const on = (id: string, attrs: object = {}) => design('azure', chg(id, 'or', {}, attrs));
    expect(between(on('lion'), on('rose'))).toEqual(['type:sc:A5E2']);
    // SENA A5E2: "four wolves two and two argent does not conflict with … semy of lions argent".
    expect(between(on('lion', { posture: 'rampant' }), on('wolf', { posture: 'rampant' }))).toEqual(['type:sc:A5E2']);
    expect(between(on('lion'), on('unicorn'))).toEqual(['type:sc:A5E2']);
    expect(between(on('lion'), on('dragon'))).toEqual(['type:sc:A5E2']);
    expect(between(on('stag', { posture: 'statant' }), on('boar', { posture: 'passant' }))).toEqual(['type:sc:A5E2']);
    expect(between(on('mullet'), on('sun'))).toEqual(['type:dc:A5G4']);
    // Anna Syveken 06/2020: a comet is a DC from a mullet; App M1g gives it its own token, so from the sun too.
    expect(between(on('comet'), on('mullet'))).toEqual(['type:dc:A5G4']);
    expect(between(on('comet'), on('sun'))).toEqual(['type:dc:A5G4']);
    // Art batch B7 (guesses, A5G4): a tower is a DC from a castle, a goblet from a chalice and from a tankard; unrelated classes are an SC.
    expect(between(on('tower'), on('castle'))).toEqual(['type:dc:A5G4']);
    expect(between(on('goblet'), on('chalice'))).toEqual(['type:dc:A5G4']);
    expect(between(on('goblet'), on('tankard'))).toEqual(['type:dc:A5G4']);
    expect(between(on('chalice'), on('tankard'))).toEqual(['type:dc:A5G4']);
    expect(between(on('tower'), on('goblet'))).toEqual(['type:sc:A5E2']);
    expect(between(on('bell'), on('hand'))).toEqual(['type:sc:A5E2']);
    expect(between(on('mullet'), on('rose'))).toEqual(['type:sc:A5E2']);
    expect(between(on('eagle'), on('owl'))).toEqual(['type:dc:A5G4']);
    // art batch B1: a cat is a feline like the lion, a fox a canine like the wolf (A5C3); the bear, horse and squirrel are types of their own
    expect(between(on('cat', { posture: 'rampant' }), on('lion', { posture: 'rampant' }))).toEqual([]);
    expect(between(on('fox', { posture: 'rampant' }), on('wolf', { posture: 'rampant' }))).toEqual([]);
    expect(between(on('cat'), on('fox'))).toEqual(['type:sc:A5E2']);
    expect(between(on('bear', { posture: 'rampant' }), on('wolf', { posture: 'rampant' }))).toEqual(['type:sc:A5E2']);
    expect(between(on('horse', { posture: 'passant' }), on('wolf', { posture: 'passant' }))).toEqual(['type:sc:A5E2']);
    expect(between(on('squirrel'), on('hare'))).toEqual(['type:sc:A5E2']);
    // art batch B2: the wyvern is a DC from the dragon (App M1e), the pegasus from the horse (Vagn Feilan 11/2014); the griffin and the sea-creatures are types of their own
    expect(between(on('wyvern', { posture: 'statant' }), on('dragon', { posture: 'passant' }))).toEqual(['type:dc:A5G4']);
    expect(between(on('pegasus', { posture: 'passant' }), on('horse', { posture: 'passant' }))).toEqual(['type:dc:A5G4']);
    expect(between(on('griffin', { posture: 'passant' }), on('lion', { posture: 'passant' }))).toEqual(['type:sc:A5E2']);
    expect(between(on('griffin', { posture: 'passant' }), on('dragon', { posture: 'passant' }))).toEqual(['type:sc:A5E2']);
    expect(between(on('sea-lion'), on('lion'))).toEqual(['type:sc:A5E2']);
    expect(between(on('seahorse'), on('horse', { posture: 'passant' }))).toEqual(['type:sc:A5E2']);
    expect(between(on('seahorse'), on('sea-lion'))).toEqual(['type:sc:A5E2']);
    // art batch B3: a falcon is a raven (Teodr' Viktorov 08/2023); the other birds are one class by shape (T6, below)
    expect(between(on('falcon', { posture: 'close' }), on('raven', { posture: 'close' }))).toEqual([]);
    expect(between(on('falcon', { posture: 'rising' }), on('raven', { posture: 'rising' }))).toEqual([]);
    expect(between(on('dove'), on('martlet'))).toEqual(['type:dc:A5G4']);
    expect(between(on('lion'), design('azure', ord('fess', 'or')))).toEqual(['type:sc:A5E2']);
  });

  it('compares charges of one class by their type tokens: stars, crosses, shapes, foils and roundels (§1.6 T2–T4)', () => {
    const on = (id: string, attrs: object = {}) => design('azure', chg(id, 'or', {}, attrs));
    // App M1g: a compass star is a mullet of eight points, and a star of eight points or more a sun too (herald question D11).
    expect(between(on('mullet'), on('compass-star'))).toEqual([]);
    expect(between(on('compass-star'), on('sun'))).toEqual([]);
    expect(between(on('mullet'), on('sun'))).toEqual(['type:dc:A5G4']);
    // App M1f: crosses of different families are substantially different, of one family a DC apart; Latin or equal-armed is nothing.
    expect(between(on('cross-formy'), on('cross-maltese'))).toEqual(['type:sc:A5E2']);
    expect(between(on('cross-flory'), on('cross-patonce'))).toEqual(['type:dc:A5G4']);
    expect(between(on('cross-crosslet'), on('cross-bottony'))).toEqual(['type:dc:A5G4']);
    expect(between(on('cross-couped'), on('cross-latin'))).toEqual([]);
    expect(between(on('cross-latin', { mods: ['fitchy'] }), on('cross-latin'))).toEqual([]);
    // A plain cross couped is the ordinary cross couped (herald questions D12, D22), and a DC from the cross throughout.
    const ordinaryCross = (mods: string[]) => design('azure', group(ordinary('cross', { mods }), 'or'));
    expect(between(on('cross-latin'), ordinaryCross(['couped']))).toEqual([]);
    expect(between(on('cross-couped'), ordinaryCross([]))).toEqual(['type:dc:A5G4']);
    expect(between(on('cross-formy'), ordinaryCross(['couped']))).toEqual(['type:sc:A5E2']);
    expect(between(on('mascle'), on('lozenge'))).toEqual(['type:dc:A5G4']);
    expect(between(on('delf'), on('billet'))).toEqual(['type:dc:A5G4']);
    // App M1i (01/2025 CL): foils are flowers of as many petals; four, five or six petals conflict, three against more is a DC.
    expect(between(on('cinquefoil'), on('rose'))).toEqual([]);
    expect(between(on('quatrefoil'), on('cinquefoil'))).toEqual([]);
    expect(between(on('trefoil'), on('quatrefoil'))).toEqual(['type:dc:A5G4']);
    expect(between(on('trefoil'), on('rose'))).toEqual(['type:dc:A5G4']);
    // Halawa bint Tariq 05/2023: an annulet is a DC from a roundel, not an SC (herald question D20).
    expect(between(on('annulet'), on('roundel'))).toEqual(['type:dc:A5G4']);
  });

  it('two ordinaries of different types are a substantial change, mirror images included', () => {
    const on = (type: string) => design('azure', ord(type, 'or'));
    expect(between(on('fess'), on('pale'))).toEqual(['type:sc:A5E2']);
    expect(between(on('bend'), on('bend-sinister'))).toEqual(['type:sc:A5E2']);
    expect(between(on('cross'), on('saltire'))).toEqual(['type:sc:A5E2']);
    expect(between(on('chevron'), on('pile'))).toEqual(['type:sc:A5E2']);
    expect(between(on('fess'), on('fess'))).toEqual([]);
  });

  it('number: 1 | 2 | 3 | 4+ are the substantial categories (A5E3)', () => {
    const n = (count: number) => design('azure', chg('mullet', 'or', { count }));
    for (const [x, y] of [[1, 2], [1, 3], [2, 3], [3, 4], [2, 5], [1, 6]] as const) {
      expect(between(n(x), n(y)), `${x} vs ${y}`).toContain('number:sc:A5E3');
    }
    expect(between(n(4), n(5))).toEqual(['number:dc:A5G5']);
    expect(between(n(5), n(6))).toEqual(['number:dc:A5G5']);
    expect(between(n(6), n(8))).toEqual([]);
  });

  it('arrangement: the substantial groups of A5E4, and none for the rest', () => {
    const three = (arrangement: string) => design('azure', chg('mullet', 'or', { count: 3, arrangement }));
    const keys = ['in-pale', 'in-fess', 'in-bend', 'in-bend-sinister'];
    for (const a of keys) for (const b of keys) expect(between(three(a), three(b)), `${a} vs ${b}`).toEqual(a === b ? [] : ['arrangement:sc:A5E4']);
    // "in chief" can't use the rule: a distinct change only
    expect(between(three('in-chief'), three('in-pale'))).toEqual(['arrangement:dc:A5G6']);
    // one and two is not in a group
    expect(between(three('rows-1-2'), three('rows-2-1'))).toEqual(['arrangement:dc:A5G6']);
    expect(between(three('in-annulo'), three('rows-2-1'))).toEqual(['arrangement:sc:A5E4']);
    const five = (arrangement: string) => design('azure', chg('mullet', 'or', { count: 5, arrangement }));
    expect(between(five('in-orle'), five('in-annulo'))).toEqual(['arrangement:dc:A5G6']); // one A5E4 group: no substantial change
    expect(between(five('in-saltire'), five('in-cross'))).toEqual(['arrangement:sc:A5E4']);
    expect(between(five('in-orle'), five('in-cross'))).toEqual(['arrangement:sc:A5E4']);
    const four = (arrangement: string | null) => design('azure', chg('mullet', 'or', { count: 4, ...(arrangement ? { arrangement } : {}) }));
    expect(between(four(null), four('in-saltire'))).toEqual(['arrangement:dc:A5G6']); // two and two is in the saltire group
    expect(between(four('in-saltire'), four('in-cross'))).toEqual(['arrangement:sc:A5E4']);
    const swords = (arrangement: string | null) => design('azure', chg('sword', 'or', { count: 2, ...(arrangement ? { arrangement } : {}) }));
    expect(between(swords('crossed'), swords('in-pale'))).toEqual(['arrangement:sc:A5E4']);
    expect(between(swords('crossed'), design('azure', chg('sword', 'or', { count: 4, arrangement: 'in-saltire' })))).toContain('number:sc:A5E3');
  });

  it('a layout forced by the field gives no arrangement change (A5E4, A5G6)', () => {
    const fourPart = (arrangement?: string) => design(div('quarterly', 'azure', 'argent'), chg('mullet', 'or', { count: 2, ...(arrangement ? { arrangement } : {}) }));
    // Or is a metal: contrasts Azure only, so on quarterly the table puts the pair in bend sinister and forces it
    expect(between(fourPart(), fourPart('in-pale'))).toEqual([]);
    expect(between(fourPart(), fourPart('in-fess'))).toEqual([]);
  });

  it('posture: the substantial groups of A5E5, the distinct lines of A5G7', () => {
    const on = (id: string, posture: string) => design('azure', chg(id, 'or', {}, { posture }));
    expect(between(on('lion', 'rampant'), on('lion', 'passant'))).toEqual(['posture:sc:A5E5']);
    expect(between(on('lion', 'rampant'), on('lion', 'sejant'))).toEqual(['posture:dc:A5G7']);
    expect(between(on('lion', 'sejant'), on('lion', 'passant'))).toEqual(['posture:sc:A5E5']);
    expect(between(on('lion', 'passant'), on('lion', 'statant'))).toEqual([]);
    expect(between(on('hare', 'sejant'), on('hare', 'courant'))).toEqual(['posture:sc:A5E5']);
    expect(between(on('stag', 'statant'), on('stag', 'passant'))).toEqual([]);
    expect(between(on('fish', 'naiant'), on('fish', 'haurient'))).toEqual(['posture:sc:A5E5']);
    // comparable across charges of one posture class (App M3), even when their types differ substantially
    expect(between(on('lion', 'rampant'), on('hare', 'courant'))).toEqual(['type:sc:A5E2', 'posture:sc:A5E5']);
    // never between an animate charge and one without a posture
    expect(between(on('lion', 'rampant'), design('azure', chg('rose', 'or')))).toEqual(['type:sc:A5E2']);
    expect(between(on('eagle', 'displayed'), design('azure', chg('owl', 'or')))).toEqual(['type:dc:A5G4']);
  });
});

describe('secondary, peripheral and tertiary groups (A5C2, A5G)', () => {
  const rosesBetween = (count: number, id = 'rose', paint = 'argent') => design('vert', ord('chevron', 'or'), chg(id, paint, { count }));

  it('charges between the primary ordinary pair with each other, whatever they are (A5G4, A5G5, A5G3)', () => {
    expect(between(rosesBetween(3), rosesBetween(3, 'mullet'))).toEqual(['type:dc:A5G4']);
    expect(between(rosesBetween(3), rosesBetween(2))).toEqual(['number:dc:A5G5']);
    expect(between(rosesBetween(3), rosesBetween(3, 'rose', 'or'))).toEqual(['tincture:dc:A5G3']);
    expect(between(rosesBetween(3), rosesBetween(2, 'mullet'))).toEqual(['type:dc:A5G4', 'number:dc:A5G5']);
  });

  it('their arrangement is set by the ordinary, so it is never a change', () => {
    const fess = (count: number) => design('azure', ord('fess', 'argent'), chg('mullet', 'or', { count }));
    expect(between(fess(2), fess(6))).toEqual(['number:dc:A5G5']);
  });

  it('adding or removing the group between is one distinct change (A5G2)', () => {
    const bare = design('vert', ord('chevron', 'or'));
    expect(between(bare, rosesBetween(3))).toEqual(['group-presence:dc:A5G2']);
    expect(between(rosesBetween(3), bare)).toEqual(['group-presence:dc:A5G2']);
  });

  it('a chief and a charge between are both "secondary": a chief against a bordure is a type change, a missing one an added group', () => {
    const a = design('sable', chg('lion', 'argent'), ord('chief', 'or'));
    const b = design('sable', chg('lion', 'argent'), ord('bordure', 'or'));
    const c = design('sable', chg('lion', 'argent'));
    expect(between(a, b)).toEqual(['type:dc:A5G4']);
    expect(between(a, c)).toEqual(['group-presence:dc:A5G2']);
    expect(between(c, b)).toEqual(['group-presence:dc:A5G2']);
    expect(between(a, design('sable', chg('lion', 'argent'), ord('chief', 'argent')))).toEqual(['tincture:dc:A5G3']);
  });

  it('identical secondary items are paired first, so the rest are not read as swapped', () => {
    // A has chief + roses between; B has a bordure + roses between would be unsupported (one pool group each side only)
    const a = design('sable', ord('fess', 'argent'), chg('mullet', 'or', { count: 3 }));
    const b = design('sable', ord('fess', 'argent'), chg('mullet', 'or', { count: 3 }));
    expect(between(a, b)).toEqual([]);
  });

  it('tertiaries compare when their hosts are the same ordinary, one DC per attribute', () => {
    const onFess = (id: string, count: number, paint = 'gules') => design('azure', ord('fess', 'or', { charged: [chg(id, paint, { count })] }));
    expect(between(onFess('rose', 3), onFess('rose', 3))).toEqual([]);
    expect(between(onFess('rose', 3), onFess('mullet', 3))).toEqual(['type:dc:A5G4']);
    expect(between(onFess('rose', 3), onFess('rose', 2))).toEqual(['number:dc:A5G5']);
    expect(between(onFess('rose', 3), onFess('rose', 3, 'sable'))).toEqual(['tincture:dc:A5G3']);
    expect(between(onFess('rose', 3), design('azure', ord('fess', 'or')))).toEqual(['group-presence:dc:A5G2']);
  });

  it('charges on a chief compare against charges on the chief, and against none (A5C2c)', () => {
    const chiefWith = (count: number) => design('sable', chg('lion', 'argent'), ord('chief', 'or', { charged: [chg('rose', 'gules', { count })] }));
    const chiefBare = design('sable', chg('lion', 'argent'), ord('chief', 'or'));
    expect(between(chiefWith(3), chiefWith(2))).toEqual(['number:dc:A5G5']);
    expect(between(chiefWith(3), chiefBare)).toEqual(['group-presence:dc:A5G2']);
  });

  it('charges on a chief stay with the chief: against a bordure they are one type change and one removed group', () => {
    const onChief = design('sable', chg('lion', 'argent'), ord('chief', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }));
    const bordure = design('sable', chg('lion', 'argent'), ord('bordure', 'or'));
    expect(between(onChief, bordure)).toEqual(['type:dc:A5G4', 'group-presence:dc:A5G2']);
  });
});

describe('verdicts and the candidate key', () => {
  const entry = (id: string, d: Design): RegistryEntryLike => ({ id, signature: signature(d), design: d });
  const lion = (paint: string) => design('sable', chg('lion', paint));
  const verdict = (d: Design, registry: RegistryEntryLike[], excludeId?: string): Verdict => checkUnique(d, signature(d), registry, excludeId);

  it('is a duplicate when the signature matches, before anything else is compared', () => {
    const d = lion('argent');
    const near = entry('near', lion('or'));
    expect(verdict(d, [near, entry('same', d)])).toEqual({ kind: 'duplicate', of: 'same' });
  });

  it('is too close to the first entry it is not clear of, with the differences', () => {
    const d = lion('argent');
    const v = verdict(d, [entry('far', design('sable', chg('rose', 'argent'))), entry('close1', lion('or')), entry('close2', lion('or'))]);
    expect(v.kind).toBe('too-close');
    if (v.kind !== 'too-close') return;
    expect(v.of).toBe('close1');
    expect(summary(v.differences)).toEqual(['tincture:dc:A5G3']);
  });

  it('is ok against an empty registry, and with no near entry', () => {
    expect(verdict(lion('argent'), [])).toEqual({ kind: 'ok', closest: null });
    expect(verdict(lion('argent'), [entry('rose', design('azure', chg('rose', 'or')))])).toEqual({ kind: 'ok', closest: null });
  });

  it('is ok on two distinct changes, naming the first such entry as the closest', () => {
    const d = design('sable', chg('lion', 'argent'));
    const twoDcs = entry('two', design('azure', chg('lion', 'or')));         // field tincture + tincture
    const substantial = entry('sc', design('sable', chg('rose', 'argent')));
    const v = verdict(d, [substantial, twoDcs, entry('two-later', design('vert', chg('lion', 'or')))]);
    expect(v.kind).toBe('ok');
    if (v.kind !== 'ok') return;
    expect(v.closest?.of).toBe('two');
    expect(summary(v.closest!.differences)).toEqual(['field-tincture:dc:A5G1a', 'tincture:dc:A5G3']);
  });

  it('a later too-close entry still blocks even if an earlier one was a narrow pass', () => {
    const d = lion('argent');
    const v = verdict(d, [entry('two', design('azure', chg('lion', 'or'))), entry('close', lion('or'))]);
    expect(v).toMatchObject({ kind: 'too-close', of: 'close' });
  });

  it('skips the excluded entry (editing your own arms)', () => {
    const d = lion('argent');
    expect(verdict(d, [entry('mine', d)], 'mine')).toEqual({ kind: 'ok', closest: null });
    expect(verdict(d, [entry('mine', d), entry('other', lion('or'))], 'mine')).toMatchObject({ kind: 'too-close', of: 'other' });
  });

  it('isClear: a substantial change, or two distinct changes', () => {
    expect(isClear([])).toBe(false);
    expect(isClear([{ kind: 'dc' }])).toBe(false);
    expect(isClear([{ kind: 'dc' }, { kind: 'dc' }])).toBe(true);
    expect(isClear([{ kind: 'sc' }])).toBe(true);
  });

  it('candidateKey: the partition and the primary group’s conflict key', () => {
    expect(candidateKey(design('azure', chg('lion', 'or')))).toEqual({ partition: 'plain', primary: 'charge:feline' });
    expect(candidateKey(design(div('per-bend', 'azure', 'vert'), chg('mullet', 'or')))).toEqual({ partition: 'per-bend', primary: 'charge:mullet-or-sun' });
    expect(candidateKey(design('azure', ord('fess', 'or')))).toEqual({ partition: 'plain', primary: 'ordinary:fess' });
    expect(candidateKey(design('azure', ord('chief', 'or')))).toEqual({ partition: 'plain', primary: null });
  });
});

describe('explanations', () => {
  const notes = (a: Design, b: Design) => explainDifferences(a, b);
  const texts = (a: Design, b: Design) => notes(a, b).map((n) => n.text);

  it('words each attribute with a label and the two values', () => {
    const lion = (paint: string, field: unknown = 'sable', extra: object = {}, attrs: object = {}) => design(field, chg('lion', paint, extra, attrs));
    expect(texts(design(div('per-pale', 'azure', 'gules')), design(div('per-fess', 'azure', 'gules')))).toEqual(['background split (per pale ↔ per fess)']);
    expect(texts(lion('argent', 'azure'), lion('argent', div('per-fess', 'azure', 'vert')))).toEqual(['background split (plain ↔ per fess)']);
    expect(texts(lion('argent', 'azure'), lion('argent', 'vert'))).toEqual(['background colour (Azure ↔ Vert)']);
    expect(texts(lion('argent', div('per-pale', 'azure', 'gules')), lion('argent', div('per-pale', 'gules', 'azure')))).toEqual(['background colour (Azure/Gules ↔ Gules/Azure)']);
    expect(texts(lion('argent'), lion('or'))).toEqual(['colour of pictures (Argent ↔ Or)']);
    expect(texts(lion('argent'), design('sable', chg('wolf', 'argent', {}, { posture: 'rampant' })))).toEqual(['picture (lion ↔ wolf)']);
    expect(texts(lion('argent'), design('sable', ord('fess', 'argent')))).toEqual(['picture or band (lion ↔ fess)']);
    expect(texts(design('sable', ord('fess', 'argent')), design('sable', ord('pale', 'argent')))).toEqual(['band or shape (fess ↔ pale)']);
    expect(texts(lion('argent', 'sable', {}, { posture: 'passant' }), lion('argent', 'sable', {}, { posture: 'rampant' }))).toEqual(['pose of picture (passant ↔ rampant)']);
    expect(texts(design('sable', chg('mullet', 'or')), design('sable', chg('mullet', 'or', { count: 3 })))).toEqual(['number of pictures (1 ↔ 3)']);
    expect(texts(design('sable', chg('mullet', 'or', { count: 3, arrangement: 'in-pale' })), design('sable', chg('mullet', 'or', { count: 3, arrangement: 'in-fess' }))))
      .toEqual(['arrangement of pictures (in pale ↔ in fess)']);
  });

  it('labels groups by where they sit', () => {
    const a = design('sable', chg('lion', 'argent'), ord('chief', 'or'));
    expect(texts(a, design('sable', chg('lion', 'argent')))).toEqual(['top bar (chief ↔ none)']);
    expect(texts(design('sable', chg('lion', 'argent')), a)).toEqual(['top bar (none ↔ chief)']);
    expect(texts(a, design('sable', chg('lion', 'argent'), ord('bordure', 'or')))).toEqual(['band or shape (chief ↔ bordure)']);
    expect(texts(a, design('sable', chg('lion', 'argent'), ord('chief', 'argent')))).toEqual(['colour of top bar (Or ↔ Argent)']);
    const between = (count: number) => design('vert', ord('chevron', 'or'), chg('rose', 'argent', { count }));
    expect(texts(between(3), between(2))).toEqual(['number of pictures beside the band (3 ↔ 2)']);
    const onFess = (paint: string) => design('azure', ord('fess', 'or', { charged: [chg('rose', paint, { count: 3 })] }));
    expect(texts(onFess('gules'), onFess('sable'))).toEqual(['colour of pictures on the band (Gules ↔ Sable)']);
    const onChief = (count: number) => design('sable', chg('lion', 'argent'), ord('chief', 'or', { charged: [chg('rose', 'gules', { count })] }));
    expect(texts(onChief(3), onChief(2))).toEqual(['number of pictures on the top bar (3 ↔ 2)']);
  });

  it('gives each note its kind, rule, SENA reason and whether a band or a picture is meant', () => {
    const a = design('sable', chg('lion', 'argent', {}, { posture: 'rampant' }), ord('chief', 'or'));
    const b = design('sable', chg('wolf', 'or', {}, { posture: 'passant' }));
    const all = notes(a, b);
    expect(all.map((n) => `${n.attr}:${n.kind}:${n.rule}:${n.item}`)).toEqual([
      'type:sc:A5E2:charge', 'posture:sc:A5E5:charge', 'tincture:dc:A5G3:charge', 'group-presence:dc:A5G2:ordinary',
    ]);
    for (const n of all) expect(n.why).toMatch(new RegExp(`\\(SENA ${n.rule}\\)\\.$`));
    expect(all[0].why).toBe('Changing every main picture or band to something unrelated is a substantial change (SENA A5E2).');
    const [type] = notes(design('sable', chg('mullet', 'argent')), design('sable', chg('sun', 'argent')));
    expect(type.why).toBe('A mullet and a sun are different types — a distinct change (SENA A5G4).');
  });

  it('cites a SENA section in the reason of every rule that can be given', () => {
    const seen = new Set<string>();
    const designs = [...generatedDesigns(1, 200), ...generatedRichDesigns(1, 60)];
    for (const a of designs) for (const b of designs.slice(0, 40)) for (const n of explainDifferences(a, b)) {
      seen.add(n.rule);
      expect(n.why).toContain(`SENA ${n.rule}`);
      expect(n.text.length).toBeGreaterThan(0);
    }
    for (const rule of SENA_RULES) {
      if (rule === 'A5E4' || rule === 'A5G6' || rule === 'A5F2' || rule === 'A5G1b' || rule === 'A5G1d' || rule === 'A5G1e' || rule === 'A5G1c') continue; // pinned in the tests above, in variation.test.ts and (lines) lines-field.test.ts; the generator rarely reaches them
      expect(seen, `generated pairs give ${rule}`).toContain(rule);
    }
  }, 30_000);

  it('the field notes carry no item; the others say what they are about', () => {
    const [field] = notes(design(div('per-pale', 'azure', 'gules')), design(div('per-fess', 'azure', 'gules')));
    expect(field.item).toBeNull();
    const [presence] = notes(design('sable', ord('chief', 'or')), design('sable', chg('lion', 'or'), ord('chief', 'or')));
    expect(presence).toMatchObject({ attr: 'primary-presence', item: 'charge', kind: 'sc', rule: 'A5E1' });
    expect(presence.text).toBe('pictures (none ↔ lions)');
  });

  it('explains the differences of a pair when none are passed in', () => {
    const a = design('sable', chg('lion', 'argent')), b = design('sable', chg('lion', 'or'));
    expect(explainDifferences(a, b)).toEqual(explainDifferences(a, b, differences(a, b)));
  });
});

describe('tally and vocabulary', () => {
  it('words the running count', () => {
    expect(tallyText([])).toBe('no distinct changes — not enough (needs 2, or one substantial change)');
    expect(tallyText([{ kind: 'dc' }])).toBe('1 distinct change — not enough (needs 2, or one substantial change)');
    expect(tallyText([{ kind: 'dc' }, { kind: 'dc' }])).toBe('DC + DC = 2 distinct changes — different enough');
    expect(tallyText([{ kind: 'dc' }, { kind: 'dc' }, { kind: 'dc' }])).toBe('DC + DC + DC = 3 distinct changes — different enough');
    expect(tallyText([{ kind: 'sc' }])).toBe('a substantial change — different enough');
    expect(tallyText([{ kind: 'sc' }, { kind: 'dc' }])).toBe('a substantial change — different enough');
    expect(tallyText([{ kind: 'sc' }, { kind: 'sc' }])).toBe('2 substantial changes — different enough');
  });

  it('names the two kinds of change and explains them', () => {
    expect(changeLabel('sc')).toBe('substantial change');
    expect(changeLabel('dc')).toBe('distinct change');
    expect(CLEAR_CHANGE_HINT).toContain('background split');
    expect(CLEAR_CHANGE_HINT).toContain('1, 2, 3 or 4+');
    expect(SENA_RULE_HINT.split('. ')).toHaveLength(3);
  });

  it('guards the wire vocabulary', () => {
    expect(isDiffAttr('posture')).toBe(true);
    expect(isDiffAttr('charge-type')).toBe(false);
    expect(isChangeKind('dc')).toBe(true);
    expect(isChangeKind('half')).toBe(false);
    expect(isSenaRule('A5G1a')).toBe(true);
    expect(isSenaRule('A5G1f')).toBe(false);
    expect(SENA_RULES.every(isSenaRule)).toBe(true);
  });
});

describe('sweeps over generated designs', () => {
  const designs = [...generatedDesigns(1, 160), ...generatedRichDesigns(1, 60)];
  const asMultiset = (diffs: readonly Diff[]) => summary(diffs).sort();

  it('a design differs from itself in nothing, and every difference names a group that exists', () => {
    for (const a of designs) {
      expect(differences(a, a), signature(a)).toEqual([]);
      for (const b of designs.slice(0, 20)) {
        for (const diff of differences(a, b)) {
          if (!diff.group) continue;
          expect(diff.group.a === null && diff.group.b === null).toBe(false);
          const paths = (d: Design) => walkGroups(d).map((w) => w.path.join('.'));
          if (diff.group.a) expect(paths(a)).toContain(diff.group.a.join('.'));
          if (diff.group.b) expect(paths(b)).toContain(diff.group.b.join('.'));
        }
      }
    }
  }, 30_000);

  // Seeded sampling: a rotating half of the pairs (`rotatesIn`; SCA_FULL=1 for all).
  it('is symmetric: the same changes either way round (SENA compares, it does not order)', () => {
    let pairs = 0;
    for (const [i, a] of designs.entries()) for (const [j, b] of designs.entries()) {
      if (!rotatesIn(`symmetric|${i}|${j}`, 1 / 2)) continue;
      expect(asMultiset(differences(a, b)), `${signature(a)} vs ${signature(b)}`).toEqual(asMultiset(differences(b, a)));
      pairs++;
    }
    expect(pairs, `sample seed ${sampleSeed()}`).toBeGreaterThan(20_000);
  }, 60_000);

  it('gives at most one distinct change per attribute and group, and no distinct change for an attribute that is substantial', () => {
    for (const a of designs) for (const b of designs.slice(0, 60)) {
      const diffs = differences(a, b);
      const keys = diffs.map((d) => `${d.attr}:${d.group?.a?.join('.') ?? '-'}:${d.group?.b?.join('.') ?? '-'}`);
      expect(new Set(keys).size, `${signature(a)} vs ${signature(b)}`).toBe(keys.length);
    }
  }, 30_000);

  it('covers the vocabulary: every charge and every drawn ordinary compares against itself', () => {
    for (const id of CHARGE_IDS) {
      const d = design('azure', chg(id, 'or', {}, CHARGES[id].defaultPosture ? { posture: CHARGES[id].defaultPosture } : {}));
      expect(differences(d, d), id).toEqual([]);
    }
  });
});

describe('the availability check', () => {
  const entryOf = (id: string, d: Design, createdAt = '2026-01-01T00:00:00Z'): CheckableEntry & { createdAt: string } =>
    ({ id, displayName: `Name ${id}`, blazon: blazon(d), signature: signature(d), design: d, shape: 'heater', createdAt });
  const lion = (paint: string, field = 'sable') => design(field, chg('lion', paint));

  it('orders by registration time, then id', () => {
    const rows = [{ createdAt: 'b', id: 'a' }, { createdAt: 'a', id: 'z' }, { createdAt: 'a', id: 'b' }];
    expect(rows.sort(registrationOrder).map((r) => `${r.createdAt}${r.id}`)).toEqual(['ab', 'az', 'ba']);
  });

  it('reports a duplicate with the entry it duplicates', () => {
    const d = lion('argent');
    const r = reportUniqueness(d, signature(d), [entryOf('one', d)]);
    expect(r).toMatchObject({ verdict: 'duplicate', conflict: { id: 'one', displayName: 'Name one', blazon: 'Sable, a lion argent.', shape: 'heater' } });
  });

  it('reports too close with the differences in words', () => {
    const d = lion('argent');
    const r = reportUniqueness(d, signature(d), [entryOf('one', lion('or'))]);
    expect(r.verdict).toBe('too-close');
    if (r.verdict !== 'too-close') return;
    expect(r.conflict.id).toBe('one');
    expect(r.differences).toEqual(explainDifferences(d, lion('or')));
    expect(r.differences.map((n) => n.text)).toEqual(['colour of pictures (Argent ↔ Or)']);
  });

  it('reports ok, with the entry it only just cleared', () => {
    const d = lion('argent');
    const narrow = reportUniqueness(d, signature(d), [entryOf('one', lion('or', 'azure'))]);
    expect(narrow.verdict).toBe('ok');
    if (narrow.verdict !== 'ok') return;
    expect(narrow.closest?.conflict.id).toBe('one');
    expect(narrow.closest?.differences.map((n) => n.rule)).toEqual(['A5G1a', 'A5G3']);
    expect(reportUniqueness(d, signature(d), [])).toEqual({ verdict: 'ok', closest: null });
  });

  it('the response carries the registry, blazon, signature and readability band of the design', () => {
    const d = lion('argent');
    const r = checkResponse(d, { id: 'reg', name: 'Registry' }, []);
    expect(r).toMatchObject({ verdict: 'ok', registry: { id: 'reg', name: 'Registry' }, blazon: 'Sable, a lion argent.', signature: signature(d), readability: 'bold' });
  });

  it('skips the entry being edited', () => {
    const d = lion('argent');
    expect(reportUniqueness(d, signature(d), [entryOf('mine', d)], 'mine')).toEqual({ verdict: 'ok', closest: null });
  });
});

describe('fieldless badges (A5G1e)', () => {
  /** A badge built directly: badges are not registrable until they are drawn, but they are compared. */
  const badge = (...groups: ReturnType<typeof group>[]): Design => ({ ...nd(arms('azure', ...groups)), kind: 'badge', field: null }) as Design;
  const mullet = (paint: string, extra: object = {}) => chg('mullet', paint, extra);

  it('two badges count the fieldless distinct change against each other too, then their groups', () => {
    expect(between(badge(mullet('purpure')), badge(mullet('purpure')))).toEqual(['fieldless:dc:A5G1e']);
    expect(between(badge(mullet('purpure')), badge(mullet('gules')))).toEqual(['fieldless:dc:A5G1e', 'tincture:dc:A5G3']);
    expect(isClear(differences(badge(mullet('purpure')), badge(mullet('gules'))))).toBe(true);
    expect(between(badge(mullet('purpure', { count: 5 })), badge(mullet('purpure', { count: 6 })))).toEqual(['fieldless:dc:A5G1e', 'number:dc:A5G5']);
  });

  it('a mullet and a sun badge are clear: the fieldless DC and a type DC (SENA A5G1e "even against another fieldless badge")', () => {
    const [a, b] = [badge(mullet('purpure')), badge(chg('sun', 'purpure'))];
    expect(between(a, b)).toEqual(['fieldless:dc:A5G1e', 'type:dc:A5G4']);
    expect(isClear(differences(a, b))).toBe(true);
    expect(candidateKey(a)).toEqual(candidateKey(b));
  });

  it('a badge against armory with a field is one distinct change however the field looks, plus the groups', () => {
    const badgeOf = badge(mullet('purpure'));
    for (const field of ['azure', div('per-pale', 'or', 'azure'), { k: 'variation', variation: 'barry', parts: ['or', 'azure'] }]) {
      const fielded = nd(arms(field, mullet('purpure')));
      expect(between(badgeOf, fielded), JSON.stringify(field)).toEqual(['fieldless:dc:A5G1e']);
      expect(between(fielded, badgeOf)).toEqual(['fieldless:dc:A5G1e']);
      expect(isClear(differences(badgeOf, fielded))).toBe(false);
    }
    const recoloured = nd(arms('azure', mullet('gules')));
    expect(between(badgeOf, recoloured)).toEqual(['fieldless:dc:A5G1e', 'tincture:dc:A5G3']);
    expect(isClear(differences(badgeOf, recoloured))).toBe(true);
  });

  it('does not count placement on the field against a badge (LoAR 08/2006, Havre de Glace)', () => {
    const badgeOf = badge(mullet('purpure'));
    expect(between(badgeOf, nd(arms('azure', mullet('purpure', { position: 'chief' }))))).toEqual(['fieldless:dc:A5G1e']);
    expect(between(nd(arms('azure', mullet('purpure', { count: 3, position: 'chief' }))), badge(mullet('purpure', { count: 3 })))).toEqual(['fieldless:dc:A5G1e']);
    expect(between(badge(mullet('purpure', { count: 3 })), nd(arms('azure', mullet('purpure', { count: 3, arrangement: 'in-pale' }))))).toEqual(['fieldless:dc:A5G1e', 'arrangement:sc:A5E4']);
  });

  it('a badge always has a primary group, so against field-primary armory it differs substantially (A5E1)', () => {
    const fieldPrimary = nd(arms(div('per-pale', 'or', 'azure'), ord('chief', 'argent')));
    expect(between(badge(mullet('purpure')), fieldPrimary)).toContain('primary-presence:sc:A5E1');
    expect(candidateKey(badge(mullet('purpure'))).primary).not.toBe(candidateKey(fieldPrimary).primary);
  });

  it('the signature tells a badge from armory and equal badges apart from different ones', () => {
    expect(signature(badge(mullet('purpure')))).toBe(signature(badge(mullet('purpure'))));
    expect(signature(badge(mullet('purpure')))).not.toBe(signature(nd(arms('azure', mullet('purpure')))));
    expect(signature(badge(mullet('purpure')))).not.toBe(signature(badge(mullet('gules'))));
  });

  it('a duplicate badge is found, and a badge is too close to the same picture on a field', () => {
    const badgeOf = badge(mullet('purpure'));
    const fielded = nd(arms('azure', mullet('purpure')));
    const registry: RegistryEntryLike[] = [{ id: 'f', signature: signature(fielded), design: fielded }];
    expect(checkUnique(badgeOf, signature(badgeOf), registry)).toMatchObject({ kind: 'too-close', of: 'f' });
    registry.push({ id: 'b', signature: signature(badgeOf), design: badgeOf });
    expect(checkUnique(badgeOf, signature(badgeOf), registry)).toEqual({ kind: 'duplicate', of: 'b' });
  });

  it('explains the missing background in words', () => {
    const notes = explainDifferences(badge(mullet('purpure')), nd(arms('azure', mullet('purpure'))));
    expect(notes).toEqual([{
      attr: 'fieldless', kind: 'dc', rule: 'A5G1e', item: null,
      text: 'background (none ↔ plain)',
      why: 'No background counts as one distinct change (SENA A5G1e).',
    }]);
    expect(explainDifferences(badge(mullet('purpure')), badge(mullet('purpure')))[0]).toMatchObject({
      text: 'background (none ↔ none)',
      why: 'A design with no background always counts one distinct change, even against another with none (SENA A5G1e).',
    });
  });
});

describe('counterchanged and the same tinctures written out (A5G3a)', () => {
  const field = div('per-pale', 'argent', 'azure');
  const lion = (paint: unknown) => group(charge('lion'), paint);

  it('are one design: "a lion counterchanged" is shorthand for "a lion per pale azure and argent"', () => {
    expect(between(nd(arms(field, lion('counterchanged'))), nd(arms(field, lion(div('per-pale', 'azure', 'argent')))))).toEqual([]);
    expect(between(nd(arms(field, lion('counterchanged'), ord('chief', 'or'))), nd(arms(field, lion(div('per-pale', 'azure', 'argent')), ord('chief', 'gules'))))).toEqual(['tincture:dc:A5G3']);
  });

  it('but several charges counterchanged lie each in one part, unlike several charges each divided', () => {
    const three = (paint: unknown) => nd(arms(div('per-pale', 'argent', 'azure'), group(charge('lion'), paint, { count: 3 })));
    expect(between(three('counterchanged'), three(div('per-pale', 'azure', 'argent')))).toEqual(['tincture:dc:A5G3']);
  });
});

describe('postures (PLAN-D §1.2 P1–P3, P7)', () => {
  const on = (id: string, posture: string, attrs: object = {}) => design('azure', chg(id, 'or', {}, { posture, ...attrs }));
  /** A posture compared whether or not it is drawn (statant erect, an eagle naiant: conflict does not need the art). */
  const undrawn = (id: string, posture: string, ...before: object[]) => nd(arms('azure', ...before, chg(id, 'or', before.length ? { count: 3, relation: 'between' } : {}, { posture })));

  it('P1: the four-legged lines — passant against couchant a DC, couchant against dormant and rampant against salient none, rampant against sejant a DC', () => {
    expect(between(on('lion', 'passant'), on('lion', 'couchant'))).toEqual(['posture:dc:A5G7']);
    expect(between(on('lion', 'couchant'), on('lion', 'dormant'))).toEqual([]);
    expect(between(on('lion', 'rampant'), on('lion', 'salient'))).toEqual([]);
    expect(between(on('lion', 'courant'), on('lion', 'passant'))).toEqual([]);
    // herald question D2: rampant and sejant share A5E5a's line but not App L1a's
    expect(between(on('lion', 'rampant'), on('lion', 'sejant'))).toEqual(['posture:dc:A5G7']);
    expect(between(on('lion', 'sejant-erect'), on('lion', 'rampant'))).toEqual([]);
    expect(between(on('lion', 'sejant-erect'), on('lion', 'sejant'))).toEqual([]);
    expect(between(on('lion', 'couchant'), on('lion', 'rampant'))).toEqual(['posture:sc:A5E5']);
    expect(between(on('stag', 'couchant'), on('stag', 'statant'))).toEqual(['posture:dc:A5G7']);
  });

  it('P1: statant erect joins the rampant line, so against passant it is a substantial change as the primary, against rampant none', () => {
    expect(between(undrawn('lion', 'statant-erect'), undrawn('lion', 'passant'))).toEqual(['posture:sc:A5E5']);
    expect(between(undrawn('lion', 'statant-erect'), undrawn('lion', 'rampant'))).toEqual([]);
    // beside a fess, as a secondary group, it is a distinct change only
    const fess = ord('fess', 'argent');
    expect(between(undrawn('lion', 'statant-erect', fess), undrawn('lion', 'passant', fess))).toEqual(['posture:dc:A5G7']);
  });

  it('P2: birds — close against rising a substantial change as the primary, close against naiant none, displayed against volant a DC', () => {
    expect(between(on('eagle', 'close'), on('eagle', 'rising'))).toEqual(['posture:sc:A5E5']);
    expect(between(on('eagle', 'close'), undrawn('eagle', 'naiant'))).toEqual([]);
    expect(between(on('eagle', 'displayed'), on('eagle', 'volant'))).toEqual(['posture:dc:A5G7']);
    expect(between(on('eagle', 'displayed'), on('eagle', 'close'))).toEqual(['posture:sc:A5E5']);
  });

  it('T6: birds of different shapes are a substantial change apart in the postures the period drew (close, rising, a swan naiant), a distinct change otherwise', () => {
    expect(between(on('swan', 'close'), on('raven', 'close'))).toEqual(['type:sc:A5E2']);
    expect(between(on('peacock', 'close'), on('eagle', 'close'))).toEqual(['type:sc:A5E2']);
    expect(between(on('swan', 'rising'), on('raven', 'close'))).toEqual(['type:sc:A5E2', 'posture:sc:A5E5']);
    expect(between(undrawn('swan', 'naiant'), on('raven', 'close'))).toEqual(['type:sc:A5E2']);
    expect(between(on('swan', 'rising'), nd(arms('azure', chg('owl', 'or'))))).toEqual(['type:sc:A5E2']);
    // "There is not an SC between birds displayed" (CL 04/2024): a DC, and none from the postures either
    expect(between(undrawn('swan', 'displayed'), on('eagle', 'displayed'))).toEqual(['type:dc:A5G4']);
    expect(between(undrawn('peacock', 'volant'), on('eagle', 'volant'))).toEqual(['type:dc:A5G4']);
    expect(between(undrawn('raven', 'naiant'), undrawn('swan', 'naiant'))).toEqual(['type:dc:A5G4']);
    expect(between(on('swan', 'close'), on('eagle', 'displayed'))).toEqual(['type:dc:A5G4', 'posture:dc:A5G7']);
    // birds of one shape: the posture lines decide as before
    expect(between(on('raven', 'close'), on('eagle', 'displayed'))).toEqual(['posture:sc:A5E5', 'type:dc:A5G4']);
    expect(between(on('raven', 'close'), on('raven', 'rising'))).toEqual(['posture:sc:A5E5']);
  });

  it('P3: a fish haurient against urinant is no difference; P7: a beast and a bird are not compared by posture', () => {
    expect(between(on('fish', 'haurient'), on('fish', 'urinant'))).toEqual([]);
    expect(between(on('fish', 'naiant'), on('fish', 'urinant'))).toEqual(['posture:sc:A5E5']);
    expect(between(on('lion', 'couchant'), on('eagle', 'close'))).toEqual(['type:sc:A5E2']);
  });

  it('F4: a lion guardant or regardant against one looking ahead is no difference, whatever its posture', () => {
    expect(between(on('lion', 'passant', { gaze: 'guardant' }), on('lion', 'passant'))).toEqual([]);
    expect(between(on('lion', 'rampant', { gaze: 'regardant' }), on('lion', 'rampant', { gaze: 'guardant' }))).toEqual([]);
    expect(between(on('lion', 'passant', { gaze: 'guardant' }), on('lion', 'rampant'))).toEqual(['posture:sc:A5E5']);
  });
});

describe('facing, gaze and pairs (PLAN-D §1.1 F1–F10)', () => {
  const lion = (attrs: object = {}, extra: object = {}) => chg('lion', 'or', extra, attrs);
  const pair = (id: string, word: string) => chg(id, 'or', { count: 2, arrangement: { k: 'pair', pair: word } });
  const contourny = { facing: 'to-sinister' };

  it('F1: a lion, an eagle or a fish naiant against the same facing to sinister is a distinct change, never substantial', () => {
    expect(between(design('azure', lion()), design('azure', lion(contourny)))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', chg('eagle', 'or')), design('azure', chg('eagle', 'or', {}, contourny)))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', chg('fish', 'or')), design('azure', chg('fish', 'or', {}, contourny)))).toEqual(['posture:dc:A5G7']);
    // so a facing and one more change clear it
    expect(isClear(differences(design('azure', lion()), design('gules', lion(contourny))))).toBe(true);
  });

  it('F2: no difference for the facing of an owl, of a fish haurient, or of charges in annulo', () => {
    const owl = design('azure', chg('owl', 'or'));
    const owlTurned = { ...owl, groups: [{ ...owl.groups[0], item: { ...owl.groups[0].item, facing: 'to-sinister' } }] } as Design;
    expect(between(owl, owlTurned)).toEqual([]);
    const haurient = { posture: 'haurient' };
    expect(between(design('azure', chg('fish', 'or', {}, haurient)), design('azure', chg('fish', 'or', {}, { ...haurient, ...contourny })))).toEqual([]);
    const annulo = { count: 3, arrangement: 'in-annulo' };
    expect(between(nd(arms('azure', lion({}, annulo))), nd(arms('azure', lion(contourny, annulo))))).toEqual([]);
  });

  it('F3: a dolphin\'s facing counts in every posture, and the dolphin is a type of its own among the fish', () => {
    const dolphin = (attrs: object = {}) => chg('dolphin', 'or', {}, attrs);
    expect(between(design('azure', dolphin()), design('azure', dolphin(contourny)))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', dolphin({ posture: 'haurient' })), design('azure', dolphin({ posture: 'haurient', ...contourny })))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', dolphin()), design('azure', dolphin({ posture: 'haurient' })))).toEqual(['posture:sc:A5E5']);
    expect(between(design('azure', dolphin()), design('azure', chg('fish', 'or')))).toEqual(['type:dc:A5G4']);
  });


  it('F4: the gaze of a whole beast makes no difference', () => {
    expect(between(nd(arms('azure', lion())), nd(arms('azure', lion({ gaze: 'guardant' }))))).toEqual([]);
    expect(between(nd(arms('azure', lion({ gaze: 'regardant' }))), nd(arms('azure', lion({ gaze: 'guardant' }))))).toEqual([]);
  });

  it('F6: two charges facing each other, back to back and the same way are each a distinct change apart, whatever their types', () => {
    expect(between(design('azure', pair('lion', 'combattant')), design('azure', pair('lion', 'addorsed')))).toEqual(['posture:dc:A5G7']);
    // F8: the pair is the arrangement in fess, so against two lions in fess only the pose changes (herald question D19)
    expect(between(design('azure', pair('lion', 'combattant')), design('azure', lion({}, { count: 2, arrangement: 'in-fess' })))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', pair('lion', 'combattant')), design('azure', pair('lion', 'respectant')))).toEqual([]);
    expect(between(design('azure', pair('lion', 'combattant')), design('azure', pair('eagle', 'addorsed')))).toEqual(['type:sc:A5E2', 'posture:dc:A5G7']);
    expect(between(design('azure', pair('lion', 'addorsed')), design('azure', pair('eagle', 'addorsed')))).toEqual(['type:sc:A5E2']);
  });

  it('F6, F8 around a pale: the pair keeps the place the pale gives, and its pose is a distinct change', () => {
    const pale = (word: string | null) => design('azure', ord('pale', 'argent'), word ? pair('lion', word) : chg('lion', 'or', { count: 2 }));
    expect(between(pale('combattant'), pale(null))).toEqual(['posture:dc:A5G7']);
    expect(between(pale('combattant'), pale('addorsed'))).toEqual(['posture:dc:A5G7']);
  });

  it('F9: a posture and a facing changed together on one group are one distinct change', () => {
    expect(between(nd(arms('azure', lion())), nd(arms('azure', lion({ posture: 'sejant', ...contourny }))))).toEqual(['posture:dc:A5G7']);
    expect(between(nd(arms('azure', lion())), nd(arms('azure', lion({ posture: 'sejant' }))))).toEqual(['posture:dc:A5G7']);
  });

  it('F10: a beast affronty against one in profile is a substantial change as the primary', () => {
    expect(between(nd(arms('azure', lion())), nd(arms('azure', lion({ facing: 'affronty' }))))).toEqual(['posture:sc:A5E5']);
  });

  it('explains a facing and a pair in words', () => {
    const [facing] = explainDifferences(design('azure', lion(contourny)), design('azure', lion()));
    expect(facing.text).toBe('pose of picture (rampant contourny ↔ rampant)');
    expect(facing.why).toBe('Turning a lion to face the other way is a distinct change (SENA A5G7).');
    const [paired] = explainDifferences(design('azure', pair('lion', 'combattant')), design('azure', lion({}, { count: 2, arrangement: 'in-fess' })));
    expect(paired.text).toBe('pose of picture (rampant combattant ↔ rampant)');
    expect(paired.why).toBe('Turning the two lions to face each other, back to back or the same way is a distinct change (SENA A5G7).');
  });
});

describe('orientation (PLAN-D §1.3 O1–O10)', () => {
  const turned = (id: string, orientation: string | null, extra: object = {}, paint = 'or') => chg(id, paint, extra, orientation ? { orientation } : {});

  it('O1: long primary charges along different axes are a substantial change; to center against an axis only a distinct one (O7)', () => {
    expect(between(design('azure', turned('sword', 'fesswise')), design('azure', turned('sword', 'bendwise-inverted')))).toEqual(['posture:sc:A5E5']);
    expect(between(design('azure', turned('sword', null)), design('azure', turned('sword', 'fesswise')))).toEqual(['posture:sc:A5E5']);
    const four = { count: 4, arrangement: 'in-cross' };
    expect(between(design('azure', turned('sword', 'to-center', four)), design('azure', turned('sword', 'palewise', four)))).toEqual(['posture:dc:A5G7']);
  });

  it('O2: long charges of any types along different axes are a distinct change as secondaries', () => {
    const around = (id: string, orientation: string) => design('azure', ord('fess', 'argent'), turned(id, orientation, { count: 2 }));
    expect(between(around('key', 'palewise'), around('sword', 'fesswise'))).toEqual(['type:dc:A5G4', 'posture:dc:A5G7']);
    expect(between(around('sword', 'palewise'), around('sword', 'bendwise'))).toEqual(['posture:dc:A5G7']);
  });

  it('O3: a long charge with ends turned the other way along one axis is a distinct change, never substantial; across types nothing', () => {
    expect(between(design('azure', turned('sword', null)), design('azure', turned('sword', 'inverted')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('sword', 'fesswise')), design('azure', turned('sword', 'fesswise-reversed')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('key', 'inverted')), design('azure', turned('sword', null)))).toEqual(['type:sc:A5E2']);
  });

  it('O5: a crescent, an increscent and a decrescent are a distinct change apart; charges of different types are not (O6)', () => {
    expect(between(design('azure', turned('crescent', null)), design('azure', turned('crescent', 'fesswise')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('crescent', 'fesswise')), design('azure', turned('crescent', 'fesswise-reversed')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('crescent', null)), design('azure', turned('heart', 'inverted')))).toEqual(['type:sc:A5E2']);
  });

  it('art batch B4: arrow palewise against sword fesswise (O2), axe fesswise against fesswise reversed (O3), pheon (O5) and harp (O5d, O9)', () => {
    const around = (id: string, orientation: string) => design('azure', ord('fess', 'argent'), turned(id, orientation, { count: 2 }));
    expect(between(around('arrow', 'palewise'), around('sword', 'fesswise'))).toEqual(['type:dc:A5G4', 'posture:dc:A5G7']);
    expect(between(design('azure', turned('axe', 'fesswise')), design('azure', turned('axe', 'fesswise-reversed')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('arrow', null)), design('azure', turned('arrow', 'inverted')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('pheon', null)), design('azure', turned('pheon', 'inverted')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('pheon', 'bendwise')), design('azure', turned('crescent', 'bendwise')))).toEqual(['type:sc:A5E2']);
    expect(between(design('azure', turned('harp', null)), design('azure', turned('harp', 'reversed')))).toEqual([]);
    expect(between(design('azure', turned('arrow', null)), design('azure', turned('spear', null)))).toEqual(['type:sc:A5E2']);
    expect(between(design('azure', turned('spear', null)), design('azure', turned('trident', null)))).toEqual(['type:sc:A5E2']);
  });


  it('art batch B5 and B6: an oak leaf by its axis only (O5b, O5c), an escallop by its direction (O5), a dragonfly like a long tergiant insect (P4), flowers none (O6)', () => {
    const oak = (o: string | null) => design('argent', turned('oak-leaf', o, {}, 'vert'));
    expect(between(oak(null), oak('bendwise'))).toEqual(['posture:dc:A5G7']);
    expect(between(oak(null), oak('fesswise'))).toEqual(['posture:dc:A5G7']);
    expect(between(oak(null), oak('inverted'))).toEqual([]);
    expect(between(oak('fesswise'), oak('fesswise-reversed'))).toEqual([]);
    expect(between(design('azure', turned('escallop', null)), design('azure', turned('escallop', 'inverted')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('acorn', null)), design('azure', turned('acorn', 'inverted')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('dragonfly', null)), design('azure', turned('dragonfly', 'inverted')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('dragonfly', null)), design('azure', turned('dragonfly', 'fesswise')))).toEqual(['posture:sc:A5E5']);
    expect(between(design('azure', turned('butterfly', null)), design('azure', turned('butterfly', 'bendwise')))).toEqual([]);
    expect(between(design('azure', turned('thistle', null)), design('azure', turned('thistle', 'inverted')))).toEqual([]);
    expect(between(design('azure', turned('acorn', null)), design('azure', turned('oak-leaf', null)))).toEqual(['type:sc:A5E2']);
    expect(between(design('azure', turned('lily', null)), design('azure', turned('rose', null)))).toEqual(['type:sc:A5E2']);
  });


  it('art batch B7: the compact-top towers, cups, bell, hand, pawprint and comet by direction (O5), the reversed hand and tankard none (O9)', () => {
    for (const id of ['tower', 'castle', 'goblet', 'chalice', 'tankard', 'bell', 'hand', 'pawprint', 'comet']) {
      expect(between(design('azure', turned(id, null)), design('azure', turned(id, 'inverted'))), id).toEqual(['posture:dc:A5G7']);
    }
    expect(between(design('azure', turned('tower', null)), design('azure', turned('tower', 'fesswise')))).toEqual(['posture:dc:A5G7']);
    expect(between(design('azure', turned('hand', null)), design('azure', turned('hand', 'reversed')))).toEqual([]);
    expect(between(design('azure', turned('tankard', null)), design('azure', turned('tankard', 'reversed')))).toEqual([]);
    expect(between(design('azure', turned('tower', 'inverted')), design('azure', turned('castle', 'inverted')))).toEqual(['type:dc:A5G4']);
  });


  it('O6, O9, O10: no difference for turning a radial charge, for reversing, or for an insect', () => {
    expect(between(design('azure', turned('mullet', null)), design('azure', turned('mullet', 'inverted')))).toEqual([]);
    expect(between(design('azure', turned('billet', null)), design('azure', turned('billet', 'fesswise')))).toEqual([]);
    expect(between(design('azure', turned('key', null)), design('azure', turned('key', 'reversed')))).toEqual([]);
    expect(between(design('azure', turned('bee', null)), design('azure', turned('bee', 'bendwise')))).toEqual([]);
  });

  it('O7: long charges to center against the same palewise are a distinct change', () => {
    const four = (orientation: string | null) => design('azure', ord('fess', 'argent'), turned('sword', orientation, { count: 4 }));
    expect(between(four('to-center'), four(null))).toEqual(['posture:dc:A5G7']);
  });

  it('charges on a bend lie along it: set bendwise there they are as they were, set palewise they are turned', () => {
    const onBend = (orientation: string | null) => design('azure', group(ordinary('bend'), 'argent', { charged: [turned('sword', orientation, { count: 3 }, 'gules')] }));
    expect(between(onBend(null), onBend('bendwise'))).toEqual([]);
    expect(between(onBend(null), onBend('palewise'))).toEqual(['posture:dc:A5G7']);
  });

  it('F9: a change of axis and of direction together on one group are one distinct change', () => {
    const around = (orientation: string | null) => design('azure', ord('fess', 'argent'), turned('sword', orientation, { count: 2 }));
    expect(between(around('inverted'), around('fesswise-reversed'))).toEqual(['posture:dc:A5G7']);
  });

  it('explains an orientation in words', () => {
    const [note] = explainDifferences(design('azure', turned('crescent', 'fesswise')), design('azure', turned('crescent', null)));
    expect(note.text).toBe('pose of picture (increscent ↔ none)');
    expect(note.why).toBe('Pointing the crescents another way is a distinct change (SENA A5G7).');
  });
});
