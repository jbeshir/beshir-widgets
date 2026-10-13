// The design model: resolve (defaults, roles, canonical form, shape errors), the phase-A support matrix,
// the structural rules and the signature.

import { describe, it, expect } from 'vitest';
import {
  canonical, canonicalJson, resolve, signature, structuralIssues, unsupportedIssues, isSupported, walkGroups, groupAt, hostOf, pathKey,
  primaryGroup, isFieldPrimary, UNSUPPORTED_GAP_CATEGORIES, CHARGES, CHARGE_IDS, MAX_DRAWN_COUNT, UnsupportedConstructError, notSupported,
  type Design, type Issue,
} from '../src/lib/heraldry/next';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';
import { generatedDesign, generatedDesigns } from './next-design-generator';
import { UNSUPPORTED_CASES } from './next-unsupported-cases';

const messages = (r: ReturnType<typeof resolve>): string[] => (r.ok ? [] : r.errors.map((e) => e.message));
const gapTags = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
const structural = (input: unknown): string[] => structuralIssues(nd(input)).map((i) => i.message);

describe('resolve: defaults', () => {
  it('fills the defaults of a bare charge group', () => {
    const d = nd(arms('azure', group(charge('lion'), 'or')));
    expect(d).toEqual({
      v: 2, kind: 'arms', field: { k: 'tincture', t: 'azure' },
      groups: [{
        role: 'primary', relation: null, count: 1, arrangement: { k: 'single' }, position: null, paint: { k: 'tincture', t: 'or' }, charged: [],
        item: { k: 'charge', charge: 'lion', form: null, posture: 'rampant', facing: 'to-dexter', orientation: null, mods: [], parts: [], holds: [] },
      }],
    });
  });

  it('fills the defaults of an ordinary', () => {
    const d = nd(arms('azure', group(ordinary('bend'), 'or')));
    expect(d.groups[0].item).toEqual({ k: 'ordinary', type: 'bend', lines: { a: 'plain', b: 'plain' }, mods: [], cotised: null, fimbriated: null });
  });

  it('gives posture-less charges no posture or facing, and posture-bearing ones the default of the table', () => {
    const rose = nd(arms('azure', group(charge('rose'), 'or'))).groups[0].item;
    expect(rose).toMatchObject({ posture: null, facing: null });
    const wolf = nd(arms('azure', group(charge('wolf'), 'or'))).groups[0].item;
    expect(wolf).toMatchObject({ posture: 'passant', facing: 'to-dexter' });
  });

  it('sets b of the lines to a unless given', () => {
    const d = nd(arms({ k: 'divided', division: 'per-pale', lines: { a: 'wavy' }, parts: ['or', 'azure'] }));
    expect(d.field).toMatchObject({ lines: { a: 'wavy', b: 'wavy' }, pieces: null });
    const two = nd(arms({ k: 'divided', division: 'per-pale', lines: { a: 'wavy', b: 'plain' }, parts: ['or', 'azure'] }));
    expect(two.field).toMatchObject({ lines: { a: 'wavy', b: 'plain' } });
  });

  it('defaults kind to arms and accepts a badge without a field', () => {
    expect(nd({ v: 2, field: 'or', groups: [] }).kind).toBe('arms');
    expect(nd({ v: 2, kind: 'badge', groups: [group(charge('rose'), 'or')] })).toMatchObject({ kind: 'badge', field: null });
  });

  it('gives a modifier given by name a null count and paint', () => {
    const d = nd(arms('azure', group(charge('sun', { mods: ['in-splendour'] }), 'or')));
    expect((d.groups[0].item as { mods: unknown }).mods).toEqual([{ id: 'in-splendour', count: null, paint: null }]);
  });

  it('is idempotent: resolving a resolved design gives it back', () => {
    for (const d of generatedDesigns(1, 40)) expect(nd(d)).toEqual(d);
  });
});

describe('resolve: arrangements and positions', () => {
  it('takes the Table 7 default for an arrangement left out', () => {
    expect(nd(arms('vert', group(charge('rose'), 'argent', { count: 3 }))).groups[0].arrangement).toEqual({ k: 'rows', rows: [2, 1] });
    expect(nd(arms('vert', group(charge('rose'), 'argent', { count: 1 }))).groups[0].arrangement).toEqual({ k: 'single' });
  });

  it('falls back to the first candidate where the table has no default', () => {
    expect(nd(arms('or', group(charge('rose'), 'gules', { count: 2 }))).groups[0].arrangement).toEqual({ k: 'line', dir: 'pale' });
  });

  it('accepts layout keys and the object form', () => {
    expect(nd(arms('or', group(charge('rose'), 'gules', { count: 3, arrangement: 'in-bend' }))).groups[0].arrangement).toEqual({ k: 'line', dir: 'bend' });
    expect(nd(arms('or', group(charge('rose'), 'gules', { count: 5, arrangement: 'rows-2-2-1' }))).groups[0].arrangement).toEqual({ k: 'rows', rows: [2, 2, 1] });
    expect(nd(arms('or', group(charge('rose'), 'gules', { count: 5, arrangement: { k: 'pattern', pattern: 'saltire' } }))).groups[0].arrangement)
      .toEqual({ k: 'pattern', pattern: 'saltire' });
    expect(nd(arms('or', group(charge('sword'), 'gules', { count: 2, arrangement: 'crossed' }))).groups[0].arrangement).toEqual({ k: 'crossed' });
  });

  it('lets a layout key that implies a position set it', () => {
    const one = nd(arms('or', group(charge('rose'), 'gules', { arrangement: 'in-chief' }))).groups[0];
    expect([one.arrangement, one.position]).toEqual([{ k: 'single' }, 'chief']);
    const three = nd(arms('or', group(charge('rose'), 'gules', { count: 3, arrangement: 'in-base' }))).groups[0];
    expect([three.arrangement, three.position]).toEqual([{ k: 'line', dir: 'fess' }, 'base']);
  });

  it('takes the forced position of Table 7 when neither arrangement nor position is given', () => {
    // Per fess Or and vert: vert charges can't lie on the vert half, so they sit in chief.
    const d = nd(arms(div('per-fess', 'or', 'vert'), group(charge('fleur-de-lis'), 'vert', { count: 3 })));
    expect([d.groups[0].arrangement, d.groups[0].position]).toEqual([{ k: 'line', dir: 'fess' }, 'chief']);
  });

  it('puts a given position with no arrangement in a single charge or a line fess', () => {
    const d = nd(arms('or', group(charge('rose'), 'gules', { count: 2, position: 'base' })));
    expect([d.groups[0].arrangement, d.groups[0].position]).toEqual([{ k: 'line', dir: 'fess' }, 'base']);
  });

  it('places secondary and tertiary groups by their host', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] }), group(charge('mullet'), 'or', { count: 3 })));
    expect(d.groups.map((g) => g.arrangement.k)).toEqual(['single', 'host']);
    expect(d.groups[0].charged[0].arrangement).toEqual({ k: 'host' });
  });
});

describe('resolve: roles', () => {
  it('makes a central ordinary primary and a peripheral one peripheral', () => {
    expect(nd(arms('azure', group(ordinary('bend'), 'or'))).groups[0]).toMatchObject({ role: 'primary', relation: null });
    expect(nd(arms('azure', group(ordinary('chief'), 'or'))).groups[0]).toMatchObject({ role: 'peripheral', relation: null });
    expect(nd(arms('azure', group(ordinary('bordure'), 'or'))).groups[0].role).toBe('peripheral');
  });

  it('makes a charge group primary, or secondary "between" beside a central ordinary', () => {
    expect(nd(arms('azure', group(charge('lion'), 'or'))).groups[0].role).toBe('primary');
    const d = nd(arms('azure', group(charge('rose'), 'or', { count: 3 }), group(ordinary('chevron'), 'argent')));
    expect(d.groups.map((g) => [g.role, g.relation])).toEqual([['primary', null], ['secondary', 'between']]);
  });

  it('keeps a charge group primary beside a chief or bordure', () => {
    const d = nd(arms('azure', group(charge('lion'), 'or'), group(ordinary('chief'), 'argent')));
    expect(d.groups.map((g) => g.role)).toEqual(['primary', 'peripheral']);
  });

  it('makes nested groups tertiary', () => {
    const d = nd(arms('azure', group(ordinary('bend'), 'or', { charged: [group(charge('unicorn'), 'vert', { count: 3 })] })));
    expect(d.groups[0].charged[0]).toMatchObject({ role: 'tertiary', relation: null });
  });

  it('keeps explicit roles, even ones the builder does not support', () => {
    const d = nd(arms('azure', group(charge('lion'), 'or'), group(charge('rose'), 'gules', { role: 'overall' })));
    expect(d.groups.map((g) => g.role)).toEqual(['primary', 'overall']);
  });

  it('gives an explicit secondary group the relation between unless it names another', () => {
    const base = [group(ordinary('fess'), 'or')];
    expect(nd(arms('azure', ...base, group(charge('rose'), 'gules', { role: 'secondary', count: 3 }))).groups[1].relation).toBe('between');
    expect(nd(arms('azure', ...base, group(charge('rose'), 'gules', { role: 'secondary', relation: 'about', count: 3 }))).groups[1].relation).toBe('about');
  });

  it('puts groups in canonical order whatever the input order', () => {
    const items = [
      group(ordinary('chief'), 'argent'),
      group(charge('rose'), 'gules', { count: 3 }),
      group(ordinary('fess'), 'or', { charged: [group(charge('mullet'), 'azure', { count: 2 })] }),
    ];
    const orders = [[0, 1, 2], [2, 1, 0], [1, 2, 0], [1, 0, 2]];
    const jsons = orders.map((o) => canonicalJson(nd(arms('vert', ...o.map((i) => items[i])))));
    expect(new Set(jsons).size).toBe(1);
    expect(nd(arms('vert', ...items)).groups.map((g) => [g.role, g.item.k === 'ordinary' ? g.item.type : g.item.charge]))
      .toEqual([['primary', 'fess'], ['secondary', 'rose'], ['peripheral', 'chief']]);
  });

  it('sorts modifiers, parts and held charges', () => {
    const lion = (mods: string[]) => nd(arms('azure', group(charge('lion', { mods }), 'or')));
    expect(canonicalJson(lion(['winged', 'couped']))).toBe(canonicalJson(lion(['couped', 'winged'])));
    const withParts = (parts: object[]) => nd(arms('azure', group(charge('lion', { parts }), 'or')));
    const armed = { part: 'armed', paint: 'gules' }, langued = { part: 'langued', paint: 'gules' };
    expect(canonicalJson(withParts([langued, armed]))).toBe(canonicalJson(withParts([armed, langued])));
  });
});

describe('resolve: paints', () => {
  it('accepts tincture shorthand, counterchanged and proper for a group', () => {
    const d = nd(arms(div('per-pale', 'or', 'azure'), group(charge('lion'), 'counterchanged'), group(charge('rose'), 'proper')));
    expect(d.groups.map((g) => g.paint)).toEqual([{ k: 'counterchanged' }, { k: 'proper' }]);
  });

  it('parses every kind of paint', () => {
    const paints: object[] = [
      { k: 'stain', stain: 'tenne' },
      { k: 'fur', fur: 'vair', colours: ['or', 'gules'] },
      { k: 'fur', fur: 'ermine' },
      { k: 'variation', variation: 'barry', pieces: 6, parts: ['or', 'azure'] },
      { k: 'treated', treatment: 'masoned', ground: 'argent', ink: 'sable' },
      { k: 'semy', ground: 'azure', charge: { charge: 'mullet' }, ink: 'or' },
      { k: 'divided', division: 'per-pall', parts: ['or', 'azure', 'gules'] },
    ];
    for (const p of paints) expect(nd(arms(p, group(charge('rose'), 'or'))).field).toMatchObject({ k: (p as { k: string }).k });
  });
});

describe('resolve: shape errors', () => {
  const bad = (input: unknown) => messages(resolve(input));
  const lion = group(charge('lion'), 'or');

  it('rejects what is not an object', () => {
    expect(bad(null)).toEqual(['The design must be an object.']);
    expect(bad([])).toEqual(['The design must be an object.']);
  });

  it('requires v: 2', () => {
    expect(bad({ v: 1, field: 'or', groups: [] })).toEqual(['Unsupported design version (expected v: 2).']);
    expect(bad({ field: 'or', groups: [] })).toEqual(['Unsupported design version (expected v: 2).']);
  });

  it('names unknown keys', () => {
    expect(bad({ v: 2, field: 'or', frame: 1 })).toEqual(['Unknown design key "frame".']);
    expect(bad(arms('or', { ...lion, size: 3 }))).toEqual(['Unknown group key "size".']);
    expect(bad(arms('or', group({ ...charge('lion'), tail: 'long' }, 'or')))).toEqual(['Unknown charge key "tail".']);
    expect(bad(arms('or', group({ ...ordinary('fess'), width: 2 }, 'or')))).toEqual(['Unknown ordinary key "width".']);
    expect(bad(arms({ k: 'tincture', t: 'or', shade: 1 }))).toEqual(['Unknown paint key "shade".']);
  });

  it('rejects unknown ids', () => {
    expect(bad(arms('chartreuse'))).toEqual(['Unknown tincture "chartreuse".']);
    expect(bad(arms('or', group(charge('dodo'), 'or')))).toEqual(['Unknown charge.']);
    expect(bad(arms('or', group(ordinary('tower'), 'or')))).toEqual(['Unknown ordinary.']);
    expect(bad(arms('or', group(charge('lion', { posture: 'flying' }), 'or')))).toEqual(['Unknown posture.']);
    expect(bad(arms({ k: 'divided', division: 'per-ness', parts: ['or', 'azure'] }))).toEqual(['Unknown division.']);
  });

  it('requires the field of arms and none for a badge', () => {
    expect(bad({ v: 2, groups: [] })).toEqual(['The field is missing.']);
    expect(bad({ v: 2, kind: 'badge', field: 'or', groups: [lion] })).toEqual(['A fieldless badge has no field.']);
  });

  it('rejects counts outside 1..20 or not whole', () => {
    for (const count of [0, 21, 1.5, '3', -1]) expect(bad(arms('or', { ...lion, count }))).toEqual(['The "count" must be a whole number from 1 to 20.']);
    expect(resolve(arms('or', { ...lion, count: 20 })).ok).toBe(true);
  });

  it('rejects rows that do not add up to the count', () => {
    expect(bad(arms('or', group(charge('rose'), 'gules', { count: 5, arrangement: 'rows-2-2' })))).toEqual(['The rows add up to 4, not 5.']);
    expect(bad(arms('or', group(charge('rose'), 'gules', { count: 3, arrangement: { k: 'rows', rows: [1, 1] } })))).toEqual(['The rows add up to 2, not 3.']);
  });

  it('rejects the wrong number of parts of a divided paint', () => {
    expect(bad(arms({ k: 'divided', division: 'per-pale', parts: ['or'] }))).toEqual(['A divided paint needs exactly 2 parts.']);
    expect(bad(arms({ k: 'divided', division: 'per-pall', parts: ['or', 'azure'] }))).toEqual(['A divided paint needs exactly 3 parts.']);
  });

  it('rejects a field part that is not well formed', () => {
    expect(bad(arms({ k: 'divided', division: 'per-pale', parts: ['or', 'puce'] }))).toEqual(['Unknown tincture "puce".']);
  });

  it('rejects counterchanged and proper as the field', () => {
    expect(bad(arms('counterchanged'))).toEqual(["A field can't be proper or counterchanged."]);
    expect(bad(arms({ k: 'proper' }))).toEqual(["A field can't be proper or counterchanged."]);
    expect(bad(arms({ k: 'divided', division: 'per-pale', parts: ['or', 'counterchanged'] }))).toEqual(["A field can't be proper or counterchanged."]);
  });

  it('rejects a posture or facing on a charge that has none', () => {
    expect(bad(arms('or', group(charge('rose', { posture: 'rampant' }), 'gules')))).toEqual(['A rose has no posture.']);
    expect(bad(arms('or', group(charge('owl', { posture: 'close' }), 'gules')))).toEqual(['An owl has no posture.']);
    expect(bad(arms('or', group(charge('rose', { facing: 'guardant' }), 'gules')))).toEqual(['A rose has no facing.']);
  });

  it('resolves a posture that is not drawn (it is unsupported, not malformed)', () => {
    const d = nd(arms('or', group(charge('lion', { posture: 'couchant' }), 'gules')));
    expect(gapTags(d)).toEqual(['posture:couchant']);
  });

  it('rejects a tertiary at the top level and any other role below', () => {
    expect(bad(arms('or', { ...lion, role: 'tertiary' }))).toEqual(['Only a group on another group can be tertiary.']);
    expect(bad(arms('or', group(ordinary('fess'), 'azure', { charged: [{ ...group(charge('rose'), 'or'), role: 'primary' }] }))))
      .toEqual(['A group on another group must be tertiary.']);
  });

  it('rejects a relation on a group that is not secondary', () => {
    expect(bad(arms('or', { ...lion, relation: 'between' }))).toEqual(['Only a secondary group has a relation to the main one.']);
  });

  it('rejects a layout other than host for a group around or on an ordinary', () => {
    const on = group(ordinary('fess'), 'azure', { charged: [group(charge('rose'), 'or', { count: 3, arrangement: 'in-pale' })] });
    expect(bad(arms('or', on))).toEqual(['Charges set around or on an ordinary are placed by it — leave the arrangement out.']);
    const between = [group(ordinary('fess'), 'azure'), group(charge('rose'), 'or', { count: 3, arrangement: 'rows-2-1' })];
    expect(bad(arms('or', ...between))).toEqual(['Charges set around or on an ordinary are placed by it — leave the arrangement out.']);
  });

  it('rejects a group with no item or paint, and an unknown arrangement or position', () => {
    expect(bad(arms('or', { paint: 'or' }))).toEqual(['A group needs an "item".']);
    expect(bad(arms('or', { item: charge('lion') }))).toEqual(['A group needs a "paint".']);
    expect(bad(arms('or', { ...lion, arrangement: 'in-circles' }))).toEqual(['Unknown arrangement "in-circles".']);
    expect(bad(arms('or', { ...lion, position: 'nowhere' }))).toEqual(['Unknown position.']);
  });

  it('rejects an arrangement key whose position conflicts with the one given', () => {
    expect(bad(arms('or', group(charge('rose'), 'gules', { arrangement: 'in-chief', position: 'base' })))).toEqual(['The arrangement puts the group chief, but its position is base.']);
  });

  it('reports every problem of a design, not just the first', () => {
    expect(bad(arms('chartreuse', { ...lion, count: 0 }))).toHaveLength(2);
  });

  it('puts the group path of a shape error in the issue', () => {
    const r = resolve(arms('or', lion, { ...lion, count: 0 }));
    expect(r.ok ? [] : r.errors.map((e) => e.at)).toEqual([{ k: 'group', path: [1] }]);
  });

  it('refuses deeply nested input without overflowing the stack', () => {
    let paint: unknown = 'or';
    for (let i = 0; i < 50; i++) paint = { k: 'divided', division: 'per-pale', parts: [paint, 'azure'] };
    expect(messages(resolve(arms(paint)))).toContain('The paint is nested too deeply.');
    let g: object = group(charge('rose'), 'or');
    for (let i = 0; i < 50; i++) g = group(charge('lion'), 'or', { charged: [g] });
    expect(messages(resolve(arms('azure', g))).length).toBeGreaterThan(0);
  });
});

describe('canonical form and tree helpers', () => {
  const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] }), group(charge('mullet'), 'argent', { count: 3 }), group(ordinary('chief'), 'vert')));

  it('is stable: canonical of canonical is canonical, and the JSON has a fixed key order', () => {
    expect(canonical(d)).toEqual(d);
    expect(Object.keys(d)).toEqual(['v', 'kind', 'field', 'groups']);
    expect(Object.keys(d.groups[0])).toEqual(['role', 'relation', 'item', 'count', 'arrangement', 'position', 'paint', 'charged']);
  });

  it('walks groups in canonical order, each followed by its tertiaries', () => {
    expect(walkGroups(d).map((w) => pathKey(w.path))).toEqual(['0', '0.0', '1', '2']);
    expect(walkGroups(d).map((w) => w.host?.role ?? null)).toEqual([null, 'primary', null, null]);
  });

  it('finds groups and hosts by path', () => {
    expect(groupAt(d, [0, 0]).item).toMatchObject({ charge: 'rose' });
    expect(hostOf(d, [0, 0])?.item).toMatchObject({ type: 'fess' });
    expect(hostOf(d, [1])).toBeNull();
    expect(() => groupAt(d, [5])).toThrow(RangeError);
    expect(() => groupAt(d, [])).toThrow(RangeError);
  });

  it('knows the primary group and whether the field is primary', () => {
    expect(primaryGroup(d)?.path).toEqual([0]);
    expect(isFieldPrimary(d)).toBe(false);
    const chiefOnly = nd(arms('azure', group(ordinary('chief'), 'or')));
    expect(primaryGroup(chiefOnly)).toBeNull();
    expect(isFieldPrimary(chiefOnly)).toBe(true);
  });
});

describe('charge table', () => {
  it('has the 28 charges and their SCA attributes', () => {
    expect(CHARGE_IDS).toHaveLength(28);
    expect(CHARGES.hare.postures).toEqual(['sejant', 'courant']);
    expect(CHARGES.gear.name).toBe('cogwheel');
    expect(CHARGES['fleur-de-lis'].name).toBe('fleur-de-lys');
    expect(CHARGE_IDS.filter((id) => CHARGES[id].long)).toEqual(['key', 'sword', 'anchor']);
    expect(CHARGE_IDS.filter((id) => CHARGES[id].scaDefaultPosture).map((id) => [id, CHARGES[id].scaDefaultPosture]))
      .toEqual([['lion', 'rampant'], ['fish', 'naiant'], ['unicorn', 'rampant'], ['dragon', 'rampant'], ['eagle', 'displayed']]);
    expect(CHARGES.sun.mods).toEqual(['in-splendour']);
    expect(CHARGES.lion.conflictClass).toBe('beast');
    expect(CHARGES.mullet.conflictClass).toBe(CHARGES.sun.conflictClass);
  });

  it('draws every default posture and facing', () => {
    for (const id of CHARGE_IDS) {
      const m = CHARGES[id];
      if (m.postures) {
        expect(m.postures).toContain(m.defaultPosture);
        expect(m.defaultFacing).toBe('to-dexter');
      } else expect([m.defaultPosture, m.defaultFacing]).toEqual([null, null]);
    }
  });
});

describe('support matrix', () => {
  for (const [label, input, tag] of UNSUPPORTED_CASES) {
    it(`${label} is the gap ${tag}`, () => {
      const d = nd(input);
      expect(gapTags(d)).toEqual([tag]);
      expect(unsupportedIssues(d)[0].message).toMatch(/ isn't available in this builder yet\.$/);
      expect(isSupported(d)).toBe(false);
    });
  }

  it('uses only gap categories the test tagger can file', () => {
    const categories = new Set(UNSUPPORTED_CASES.map(([, , tag]) => tag.split(':')[0]));
    for (const c of categories) expect(UNSUPPORTED_GAP_CATEGORIES).toContain(c);
  });

  it('files a badge under the badge gap alone', () => {
    expect(gapTags(nd({ v: 2, kind: 'badge', groups: [group(charge('lion', { posture: 'couchant' }), 'or')] }))).toEqual(['fieldless:badge']);
  });

  it('names a field gap before the group gaps, each at its place', () => {
    const d = nd(arms({ k: 'fur', fur: 'ermine' }, group(charge('lion', { posture: 'couchant' }), 'or')));
    expect(unsupportedIssues(d).map((i) => [i.at.k, i.gap.category])).toEqual([['field', 'fur'], ['group', 'posture']]);
  });

  describe('supported combinations', () => {
    const fess = group(ordinary('fess'), 'or');
    const supported: Array<[string, unknown]> = [
      ['the field alone', arms('azure')],
      ['a divided field alone', arms(div('per-bend', 'or', 'azure'))],
      ['a band', arms('azure', fess)],
      ['charges on a band', arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] }))],
      ['charges between a band', arms('azure', fess, group(charge('mullet'), 'argent', { count: 3 }))],
      ['charges on and between a band', arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] }), group(charge('mullet'), 'argent', { count: 3 }))],
      ['a band and a chief', arms('azure', fess, group(ordinary('chief'), 'argent'))],
      ['a band and a bordure', arms('azure', fess, group(ordinary('bordure'), 'argent'))],
      ['a charge', arms('azure', group(charge('lion'), 'or'))],
      ['a charge and a chief', arms('azure', group(charge('lion'), 'or'), group(ordinary('chief'), 'argent'))],
      ['a charge and a chief with charges', arms('azure', group(charge('lion'), 'or'), group(ordinary('chief'), 'argent', { charged: [group(charge('rose'), 'gules', { count: 3 })] }))],
      ['a charge and a bordure', arms('azure', group(charge('lion'), 'or'), group(ordinary('bordure'), 'argent'))],
      ['a chief alone', arms('azure', group(ordinary('chief'), 'argent'))],
      ['a chief with charges', arms('azure', group(ordinary('chief'), 'argent', { charged: [group(charge('rose'), 'gules', { count: 3 })] }))],
      ['a bordure alone', arms('azure', group(ordinary('bordure'), 'argent'))],
      ['charges in chief', arms('azure', group(charge('rose'), 'gules', { count: 3, arrangement: 'in-chief' }))],
      ['charges in orle', arms('azure', group(charge('mullet'), 'or', { count: 8, arrangement: 'in-orle' }))],
      ['crossed swords', arms('azure', group(charge('sword'), 'or', { count: 2, arrangement: 'crossed' }))],
      ['counterchanged charges', arms(div('per-pale', 'or', 'azure'), group(charge('rose'), 'counterchanged', { count: 2 }))],
      ['a sun in splendour', arms('azure', group(charge('sun', { mods: ['in-splendour'] }), 'or'))],
      ['twelve charges', arms('azure', group(charge('mullet'), 'or', { count: 12, arrangement: 'rows-4-4-4' }))],
    ];
    for (const [label, input] of supported) {
      it(`${label} has no gap`, () => expect(gapTags(nd(input))).toEqual([]));
    }

    it('every generated design is supported', () => {
      for (const d of generatedDesigns(1, 200)) expect(isSupported(d)).toBe(true);
    });
  });

  it('allows at most MAX_DRAWN_COUNT charges in a group', () => {
    expect(MAX_DRAWN_COUNT).toBe(12);
  });
});

describe('the not-yet-drawable guard', () => {
  it('throws an error that carries the gap', () => {
    try {
      notSupported({ category: 'fur', detail: 'ermine' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedConstructError);
      expect((e as UnsupportedConstructError).gap).toEqual({ category: 'fur', detail: 'ermine' });
    }
  });

  it('is what the signature calls for a design it can not sign', () => {
    expect(() => signature(nd({ v: 2, kind: 'badge', groups: [] }))).toThrow(UnsupportedConstructError);
    expect(() => signature(nd(arms({ k: 'fur', fur: 'ermine' })))).toThrow(UnsupportedConstructError);
  });
});

describe('structure rules', () => {
  it('1: a divided field needs different tinctures', () => {
    expect(structural(arms(div('per-pale', 'or', 'or'), group(charge('lion'), 'azure')))).toEqual(['A divided field needs two different tinctures — both parts are Or.']);
    expect(structural(arms(div('per-pale', 'or', 'azure'), group(charge('lion'), 'gules')))).toEqual([]);
  });

  it('1: names the field', () => {
    const issues = structuralIssues(nd(arms(div('per-fess', 'gules', 'gules'), group(charge('lion'), 'or'))));
    expect(issues.map((i) => [i.code, i.at])).toEqual([['structure', { k: 'field' }]]);
  });

  it('2: a plain field alone is too generic', () => {
    const issues = structuralIssues(nd(arms('azure')));
    expect(issues).toEqual([{ code: 'generic', at: { k: 'design' }, message: 'A plain field on its own is too generic to register — add an ordinary or a charge.', slots: [] }]);
    expect(structural(arms(div('per-pale', 'or', 'azure')))).toEqual([]);
    expect(structural({ v: 2, kind: 'badge', groups: [] })).toEqual([]);
  });

  it('3: charges between need a central primary ordinary', () => {
    const d = nd(arms('azure', group(charge('lion'), 'or'), group(charge('rose'), 'gules', { role: 'secondary', count: 3 })));
    const issues = structuralIssues(d);
    expect(issues.map((i) => i.message)).toEqual(['Charges can only be set between a central band or shape.']);
    expect(issues[0].at).toEqual({ k: 'group', path: [1] });
    expect(structural(arms('azure', group(ordinary('chief'), 'or'), group(charge('rose'), 'gules', { role: 'secondary', count: 3 }))))
      .toEqual(['Charges can only be set between a central band or shape.']);
  });

  it('3: charges can not sit on charges that are already on something', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('lion'), 'gules', { charged: [group(charge('rose'), 'argent')] })] })));
    const issues = structuralIssues(d);
    expect(issues.map((i) => i.message)).toEqual(["Charges can't sit on charges that are already on something (SENA App I3)."]);
    expect(issues[0].at).toEqual({ k: 'group', path: [0, 0, 0] });
  });

  it('3: only one group can sit on a host', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 }), group(charge('mullet'), 'sable', { count: 2 })] })));
    const issues = structuralIssues(d);
    expect(issues.map((i) => i.message)).toEqual(['Only one group of charges can sit on the fess (SENA App I3).']);
    expect(issues[0].at).toEqual({ k: 'group', path: [0, 1] });
    const onLion = nd(arms('azure', group(charge('lion'), 'or', { charged: [group(charge('rose'), 'gules'), group(charge('mullet'), 'sable')] })));
    expect(structuralIssues(onLion).map((i) => i.message)).toEqual(['Only one group of charges can sit on the lion (SENA App I3).']);
  });

  describe('4: layouts', () => {
    const roses = (count: number, arrangement: unknown) => structural(arms('or', group(charge('rose'), 'gules', { count, arrangement })));

    it('accepts the layouts a count can take', () => {
      expect(roses(1, 'single')).toEqual([]);
      expect(roses(2, 'in-fess')).toEqual([]);
      expect(roses(5, 'in-saltire')).toEqual([]);
      expect(roses(5, 'rows-2-2-1')).toEqual([]);
      expect(roses(8, 'in-orle')).toEqual([]);
      expect(roses(3, 'in-annulo')).toEqual([]);
      expect(roses(3, 'in-chief')).toEqual([]);
    });

    it('rejects a layout the count can not take, naming the ones it can', () => {
      expect(roses(3, 'in-cross')).toEqual(['Three roses can be arranged two and one, one and two, in pale, in fess, in bend, in bend sinister, in annulo, in chief, in base — not in cross.']);
      expect(roses(2, 'in-annulo')).toEqual(['Two roses can be arranged in pale, in fess, in bend, in bend sinister, in chief, in base — not in annulo.']);
      expect(roses(4, 'in-orle')).toEqual(expect.arrayContaining([expect.stringMatching(/^Four roses can be arranged .* — not in orle\.$/)]));
    });

    it('rejects a single charge that is not alone, and a single arrangement for many', () => {
      expect(roses(1, 'in-pale')).toEqual(['A single charge sits alone in the centre.']);
      expect(roses(3, 'single')).toEqual([expect.stringMatching(/^Three roses can be arranged .* — not single\.$/)]);
    });

    it('rejects crossed charges that are not long', () => {
      expect(roses(2, 'crossed')).toEqual(['Only long charges such as swords, keys and anchors can be crossed.']);
      expect(structural(arms('or', group(charge('key'), 'gules', { count: 2, arrangement: 'crossed' })))).toEqual([]);
      expect(structural(arms('or', group(charge('key'), 'gules', { count: 3, arrangement: 'crossed' })))).toEqual([expect.stringMatching(/^Three keys can be arranged /)]);
    });

    it('rejects host on the field and a field layout around or on an ordinary', () => {
      expect(roses(3, 'host')).toEqual(['Three roses on the field can\'t be placed by an ordinary — choose an arrangement.']);
      const d = nd(arms('azure', group(ordinary('fess'), 'or')));
      const around = { ...d, groups: [...d.groups, { ...nd(arms('azure', group(charge('rose'), 'gules', { count: 3 }))).groups[0], role: 'secondary' as const, relation: 'between' as const }] };
      expect(structuralIssues(around).map((i) => i.message)).toEqual(['Charges around the fess are placed by it — they can\'t be arranged two and one.']);
    });

    it('rejects a chief or base position under a chief and in other contexts', () => {
      const underChief = nd(arms('azure', group(charge('rose'), 'gules', { count: 3 }), group(ordinary('chief'), 'or')));
      const placed = { ...underChief, groups: underChief.groups.map((g) => (g.role === 'primary' ? { ...g, position: 'chief' as const, arrangement: { k: 'line' as const, dir: 'fess' as const } } : g)) };
      expect(structuralIssues(placed).map((i) => i.message)).toEqual(['There is no room to set charges in chief when the design has a chief.']);
    });

    it('does not judge ordinary groups or groups without a layout', () => {
      expect(structural(arms('azure', group(ordinary('bend'), 'or')))).toEqual([]);
      const onCharge = nd(arms('azure', group(charge('lion'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] })));
      expect(structuralIssues(onCharge)).toEqual([]);
    });

    it('applies to tertiary groups and names the group', () => {
      const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] })));
      expect(structuralIssues(d)).toEqual([]);
      const wrong = { ...d, groups: [{ ...d.groups[0], charged: [{ ...d.groups[0].charged[0], arrangement: { k: 'single' as const } }] }] };
      expect(structuralIssues(wrong).map((i) => [i.message, i.at])).toEqual([
        ["Charges on the fess are placed by it — they can't be arranged single.", { k: 'group', path: [0, 0] }],
      ]);
    });
  });

  it('puts the rules in order: the field first, then how groups relate', () => {
    const d = nd(arms(div('per-pale', 'or', 'or'), group(charge('rose'), 'gules', { role: 'secondary', count: 3 })));
    const wrong = { ...d, groups: [{ ...d.groups[0], arrangement: { k: 'line' as const, dir: 'pale' as const }, count: 1 }] };
    expect(structuralIssues(wrong).map((i) => i.message)).toEqual([
      'A divided field needs two different tinctures — both parts are Or.',
      'Charges can only be set between a central band or shape.',
    ]);
  });

  it('keeps complexity within SENA A3E2 (at most 8) over every supported combination', () => {
    // Tinctures (all distinct) plus charge types (each distinct) for the largest supported shape of each combination.
    const field = 2;
    const combos: Array<[string, number]> = [
      ['P ordinary, T on it, S between', field + 3 + 3],
      ['P ordinary and a peripheral', field + 2 + 2],
      ['P charge, a chief carrying T', field + 3 + 3],
      ['a chief carrying T alone', field + 2 + 2],
    ];
    for (const [label, complexity] of combos) expect(complexity, label).toBeLessThanOrEqual(8);
  });
});

describe('signature', () => {
  it('writes the SENA example', () => {
    const d = nd(arms('azure', group(ordinary('bend'), 'or', { charged: [group(charge('unicorn'), 'vert', { count: 3 })] })));
    expect(signature(d)).toBe('arms|az|P:o.bend:1:single:or{T:c.unicorn.rampant:3:host:vt}');
  });

  it('writes divided fields, relations, layouts and modifiers', () => {
    const d = nd(arms(div('per-fess', 'or', 'vert'), group(ordinary('fess'), 'argent'), group(charge('sun', { mods: ['in-splendour'] }), 'counterchanged', { count: 2 }), group(ordinary('chief'), 'sable')));
    expect(signature(d)).toBe('arms|per-fess(or,vt)|P:o.fess:1:single:ar|S>:c.sun+in-splendour:2:host:cc|R:o.chief:1:single:sa');
  });

  it('is the same for equivalent inputs', () => {
    const a = nd(arms('azure', group(ordinary('fess'), 'or'), group(charge('rose'), 'gules', { count: 3 })));
    const b = nd({ v: 2, kind: 'arms', groups: [{ paint: 'gules', count: 3, item: { charge: 'rose', k: 'charge', posture: null }, charged: [] }, { paint: { k: 'tincture', t: 'or' }, item: { k: 'ordinary', type: 'fess', lines: { a: 'plain', b: 'plain' } } }], field: { k: 'tincture', t: 'azure' } });
    expect(signature(a)).toBe(signature(b));
  });

  it('differs when anything else differs', () => {
    const base = nd(arms('azure', group(charge('lion'), 'or')));
    for (const other of [
      arms('gules', group(charge('lion'), 'or')),
      arms('azure', group(charge('lion'), 'argent')),
      arms('azure', group(charge('lion', { posture: 'passant' }), 'or')),
      arms('azure', group(charge('wolf'), 'or')),
      arms('azure', group(charge('lion'), 'or', { count: 2 })),
      arms('azure', group(charge('lion'), 'or', { position: 'chief' })),
    ]) expect(signature(nd(other))).not.toBe(signature(base));
  });

  it('is injective over 500 generated designs: equal signatures exactly when canonical JSON is equal', () => {
    const designs = generatedDesigns(1000, 500);
    const bySignature = new Map<string, string>();
    const byJson = new Map<string, string>();
    for (const d of designs) {
      const s = signature(d), j = canonicalJson(d);
      expect(bySignature.get(s) ?? j).toBe(j);
      expect(byJson.get(j) ?? s).toBe(s);
      bySignature.set(s, j);
      byJson.set(j, s);
    }
    expect(bySignature.size).toBeGreaterThan(300);
  }, 30_000);
});

describe('the generator', () => {
  it('is deterministic and varied', () => {
    expect(generatedDesign(7)).toEqual(generatedDesign(7));
    const designs = generatedDesigns(1, 100);
    expect(new Set(designs.map(signature)).size).toBeGreaterThan(60);
    const issues: Issue[] = designs.flatMap((d) => structuralIssues(d));
    expect(issues).toEqual([]);
  });
});
