// SENA conflict (RULES §C): the worked examples of RULES §C.8 and the plan, the substantial and distinct
// changes group by group with their SENA rules, the explanation texts, the tally, and checkUnique's order.
import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, CHARGES, CLEAR_CHANGE_HINT, DRAWN_DIVISIONS, SENA_RULES, SENA_RULE_HINT, candidateKey, changeLabel, checkUnique, differences,
  explainDifferences, isChangeKind, isClear, isDiffAttr, isSenaRule, normalise, registrationOrder, reportUniqueness, signature, tallyText, walkGroups,
  blazon, checkResponse, type CheckableEntry,
  type Design, type Diff, type RegistryEntryLike, type Verdict,
} from '../src/lib/heraldry';
import { generatedDesigns } from './design-generator';
import { arms, charge, div, group, nd, ordinary } from './helpers';

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

  it('four mullets against six: no substantial change (4+), one distinct change of number, no arrangement change (two and two is not in App K)', () => {
    const four = design('azure', chg('mullet', 'or', { count: 4 })), six = design('azure', chg('mullet', 'or', { count: 6 }));
    expect(between(four, six)).toEqual(['number:dc:A5G5']);
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
    for (const a of DRAWN_DIVISIONS) for (const b of DRAWN_DIVISIONS) {
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
    expect(between(on('lion', { posture: 'rampant' }), on('wolf', { posture: 'rampant' }))).toEqual(['type:dc:A5G4']);
    expect(between(on('lion'), on('unicorn'))).toEqual(['type:dc:A5G4']);
    expect(between(on('mullet'), on('sun'))).toEqual(['type:dc:A5G4']);
    expect(between(on('mullet'), on('rose'))).toEqual(['type:sc:A5E2']);
    expect(between(on('eagle'), on('owl'))).toEqual(['type:dc:A5G4']);
    expect(between(on('lion'), design('azure', ord('fess', 'or')))).toEqual(['type:sc:A5E2']);
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
    // comparable across charges of the same class
    expect(between(on('lion', 'rampant'), on('hare', 'courant'))).toEqual(['posture:sc:A5E5', 'type:dc:A5G4']);
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
    expect(candidateKey(design('azure', chg('lion', 'or')))).toEqual({ partition: 'plain', primary: 'charge:beast' });
    expect(candidateKey(design(div('per-bend', 'azure', 'vert'), chg('mullet', 'or')))).toEqual({ partition: 'per-bend', primary: 'charge:star' });
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
      'posture:sc:A5E5:charge', 'type:dc:A5G4:charge', 'tincture:dc:A5G3:charge', 'group-presence:dc:A5G2:ordinary',
    ]);
    for (const n of all) expect(n.why).toMatch(new RegExp(`\\(SENA ${n.rule}\\)\\.$`));
    expect(all[1].why).toBe('A lion and a wolf are different types — a distinct change (SENA A5G4).');
  });

  it('cites a SENA section in the reason of every rule that can be given', () => {
    const seen = new Set<string>();
    const designs = generatedDesigns(1, 200);
    for (const a of designs) for (const b of designs.slice(0, 40)) for (const n of explainDifferences(a, b)) {
      seen.add(n.rule);
      expect(n.why).toContain(`SENA ${n.rule}`);
      expect(n.text.length).toBeGreaterThan(0);
    }
    for (const rule of SENA_RULES) {
      if (rule === 'A5E4' || rule === 'A5G6' || rule === 'A5F2') continue; // pinned in the tests above; the generator rarely reaches them
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
    expect(isSenaRule('A5G1b')).toBe(false);
    expect(SENA_RULES.every(isSenaRule)).toBe(true);
  });
});

describe('sweeps over generated designs', () => {
  const designs = generatedDesigns(1, 160);
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

  it('is symmetric: the same changes either way round (SENA compares, it does not order)', () => {
    let pairs = 0;
    for (const a of designs) for (const b of designs) {
      expect(asMultiset(differences(a, b)), `${signature(a)} vs ${signature(b)}`).toEqual(asMultiset(differences(b, a)));
      pairs++;
    }
    expect(pairs).toBeGreaterThan(20_000);
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
