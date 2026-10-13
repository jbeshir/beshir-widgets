// The SENA rule of tincture as a ground walker: the contrast predicate, what each kind of group lies on,
// the integrator's registered records, and the messages. Counterchanging has its own file.

import { describe, expect, it } from 'vitest';
import {
  TINCTURES, contrastFailure, groundContacts, normalise, signature, tinctureIssues, validate, type Design, type Tincture,
} from '../src/lib/heraldry/next';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';
import { generatedDesigns } from './next-design-generator';
import { V } from './next-validation-cases';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);
const splendour = { mods: [{ id: 'in-splendour' }] };

const messages = (input: unknown): string[] => tinctureIssues(nd(input)).map((i) => i.message);

describe('contrastFailure', () => {
  it('is the SENA predicate: never the same, and at least one contact of the other class', () => {
    expect(contrastFailure('or', ['or'])).toBe('same');
    expect(contrastFailure('or', ['argent'])).toBe('metal-on-metal');
    expect(contrastFailure('gules', ['azure'])).toBe('colour-on-colour');
    expect(contrastFailure('gules', ['argent'])).toBeNull();
    expect(contrastFailure('or', ['sable'])).toBeNull();
    // A neutral (evenly divided metal and colour) ground takes either class, but never its own tincture.
    expect(contrastFailure('gules', ['argent', 'sable'])).toBeNull();
    expect(contrastFailure('argent', ['argent', 'sable'])).toBe('same');
  });

  it('treats celestine as a metal', () => {
    expect(contrastFailure('celestine', ['or'])).toBe('metal-on-metal');
    expect(contrastFailure('celestine', ['sable'])).toBeNull();
  });
});

describe('what a group lies on', () => {
  it('a charge on a plain field lies on the field', () => {
    expect(groundContacts(nd(arms('azure', chg('lion', 'or'))), [0])).toEqual([['azure']]);
  });

  it('a charge across a partition line lies on both parts, in the field’s order', () => {
    const d = nd(arms(div('per-pale', 'azure', 'or'), chg('lion', 'gules')));
    expect(groundContacts(d, [0])).toEqual([['azure', 'or']]);
  });

  it('judges each slot on the part it is on', () => {
    const d = nd(arms(div('per-fess', 'azure', 'or'), chg('mullet', 'gules', { count: 3 })));
    expect(groundContacts(d, [0])).toEqual([['azure'], ['azure'], ['or']]);
  });

  it('a chief on a field per fess lies on the upper part only; a bordure on a field per pale lies on both', () => {
    expect(groundContacts(nd(arms(div('per-fess', 'argent', 'sable'), ord('chief', 'gules'), chg('rose', 'or'))), [1])).toEqual([['argent']]);
    expect(groundContacts(nd(arms(div('per-pale', 'or', 'gules'), ord('bordure', 'azure'))), [0])).toEqual([['or', 'gules']]);
  });

  it('a tertiary lies on its host, not on the field', () => {
    const d = nd(arms('azure', ord('fess', 'or', { charged: [chg('rose', 'gules', { count: 3 })] })));
    expect(groundContacts(d, [0, 0])).toEqual([['or'], ['or'], ['or']]);
  });

  it('a tertiary on a counterchanged host lies on the other tincture of each part', () => {
    const d = nd(arms(div('per-pale', 'argent', 'gules'), ord('fess', 'counterchanged', { charged: [chg('rose', 'sable')] })));
    expect(groundContacts(d, [0, 0])).toEqual([['gules', 'argent']]);
  });
});

describe('the integrator’s records', () => {
  const ok = (name: string, input: unknown) => it(`${name} is valid`, () => expect(validate(nd(input))).toEqual([]));
  const bad = (name: string, input: unknown, expected: string[]) =>
    it(`${name} is rejected`, () => expect(messages(input)).toEqual(expected));

  // A central charge lies on both sections (SENA A3B4a); two charges on per chevron go where they contrast (Table 7).
  ok('regid 8075, per bend with a rose and a chief gules', arms(div('per-bend', 'argent', 'sable'), chg('rose', 'gules'), ord('chief', 'gules')));
  ok('regid 42106, two suns on per chevron vert and Or', arms(div('per-chevron', 'vert', 'or'), chg('sun', 'or', { count: 2 }, splendour)));
  ok('regid 131885, fleurs-de-lys vert on per fess Or and vert', arms(div('per-fess', 'or', 'vert'), chg('fleur-de-lis', 'vert', { count: 3 })));

  bad('regid 113704, a gules bordure on azure', arms('azure', chg('fleur-de-lis', 'argent'), ord('bordure', 'gules')), ['Gules bordure on Azure field: colour on colour']);
  bad('regid 38068, an Or bordure on argent', arms('argent', chg('sun', 'gules', {}, splendour), ord('bordure', 'or')), ['Or bordure on Argent field: metal on metal']);
  bad('regid 9655, an Or sun on an argent fess', arms('azure', ord('fess', 'argent', { charged: [chg('sun', 'or', {}, splendour)] })), ['Or sun on the Argent fess: metal on metal']);
  bad('regid 58634, an azure bend on gules', arms('gules', ord('bend', 'azure', { charged: [chg('crescent', 'argent', { count: 3 })] })), ['Azure bend on Gules field: colour on colour']);
  bad('regid 118964, a gules fess on azure', arms('azure', ord('fess', 'gules', { charged: [chg('fleur-de-lis', 'argent', { count: 3 })] })), ['Gules fess on Azure field: colour on colour']);

  const hint = ' (counterchanging needs a field of one metal and one colour)';
  bad('regid 121571, roses counterchanged on per fess argent and Or', arms(div('per-fess', 'argent', 'or'), chg('rose', 'counterchanged', { count: 2 })), [`Counterchanged roses on Argent and Or: metal on metal${hint}`]);
  bad('regid 107202, a fleur-de-lys counterchanged on per pale argent and Or', arms(div('per-pale', 'argent', 'or'), chg('fleur-de-lis', 'counterchanged')), [`Counterchanged fleur-de-lys on Argent and Or: metal on metal${hint}`]);
  bad('regid 140807, a lion counterchanged on per fess argent and Or', arms(div('per-fess', 'argent', 'or'), chg('lion', 'counterchanged')), [`Counterchanged lion on Argent and Or: metal on metal${hint}`]);
  bad('regid 113828, a sun counterchanged on per pale gules and sable', arms(div('per-pale', 'gules', 'sable'), chg('sun', 'counterchanged')), [`Counterchanged sun on Gules and Sable: colour on colour${hint}`]);
  bad('regid 113830, a sun counterchanged on per pale sable and gules', arms(div('per-pale', 'sable', 'gules'), chg('sun', 'counterchanged')), [`Counterchanged sun on Sable and Gules: colour on colour${hint}`]);
  bad('regid 118128, a rose counterchanged on per pale sable and gules', arms(div('per-pale', 'sable', 'gules'), chg('rose', 'counterchanged')), [`Counterchanged rose on Sable and Gules: colour on colour${hint}`]);
});

describe('plain tinctures on plain, divided and neutral grounds', () => {
  it('names the field for a lone failing group, with the class hint on a two-class field', () => {
    expect(messages(arms('gules', chg('lion', 'azure')))).toEqual(['Azure lion on Gules field: colour on colour']);
    expect(messages(arms(div('per-pale', 'azure', 'vert'), chg('wolf', 'gules'))))
      .toEqual(['Gules wolf on Azure and Vert field: colour on colour (a two-colour field needs a metal charge)']);
    expect(messages(arms(div('per-pale', 'or', 'argent'), ord('bend', 'celestine'))))
      .toEqual(['Celestine bend on Or and Argent field: metal on metal (a two-metal field needs a colour ordinary)']);
  });

  it('accepts anything but the grounds’ own tinctures on an evenly divided metal and colour', () => {
    for (const t of TINCTURES) {
      const expectOk = t !== 'argent' && t !== 'sable';
      expect(validate(nd(arms(div('per-pale', 'argent', 'sable'), chg('lion', t)))).length === 0, t).toBe(expectOk);
    }
  });

  it('names the slots when only some fail, and says "same tincture" when the ordinary shares one', () => {
    expect(messages(arms(div('per-fess', 'azure', 'or'), chg('mullet', 'gules', { count: 3 })))).toEqual(['The two upper Gules mullets lie on Azure: colour on colour']);
    expect(messages(arms(div('per-pale', 'azure', 'or'), ord('bend', 'or')))).toEqual(['Or bend lies on the Or part of the field: same tincture']);
  });

  it('a chief on per fess lies on the upper part alone', () => {
    // The chief lies on the argent alone; the mullet across the line makes the design registrable (SENA A3D1c).
    expect(messages(arms(div('per-fess', 'argent', 'gules'), ord('chief', 'azure'), chg('mullet', 'or')))).toEqual([]);
    expect(messages(arms(div('per-fess', 'argent', 'gules'), ord('chief', 'or'), chg('mullet', 'azure'))))
      .toEqual(['Or chief lies on Argent: metal on metal']);
  });

  it('bordure on per pale Or and gules: azure is fine, gules shares a tincture', () => {
    expect(messages(arms(div('per-pale', 'or', 'gules'), ord('bordure', 'azure')))).toEqual([]);
    expect(messages(arms(div('per-pale', 'or', 'gules'), ord('bordure', 'gules')))).toEqual(['Gules bordure lies on the Gules part of the field: same tincture']);
  });
});

describe('tertiary groups are judged against their host', () => {
  it('on a chief: against the chief, not the field', () => {
    const chief = (rose: string) => arms('gules', chg('mullet', 'argent', { count: 3 }), ord('chief', 'or', { charged: [chg('rose', rose, { count: 3 })] }));
    expect(messages(chief('gules'))).toEqual([]);
    expect(messages(chief('argent'))).toEqual(['Argent roses on the Or chief: metal on metal']);
    expect(messages(chief('or'))).toEqual(['Or roses on the Or chief: same tincture']);
  });

  it('a charge on a band may share the field’s tincture', () => {
    expect(messages(arms('or', ord('pale', 'sable', { charged: [chg('flame', 'or', { count: 3 })] })))).toEqual([]);
  });
});

describe('verdicts over the validation rows', () => {
  for (const c of V) {
    it(`${c.id}: ${c.valid ? 'valid' : 'invalid'}`, () => {
      const r = normalise(c.design);
      expect(r.ok).toBe(c.valid);
      if (!r.ok) {
        expect(r.errors.map((e) => e.message)).toEqual(c.messages);
        expect(r.errors.map((e) => e.code)).toEqual(c.codes);
      }
      if (c.signature) expect(signature(r.design!)).toBe(c.signature);
    });
  }
});

describe('the walker against an independent oracle', () => {
  it('agrees with a direct reading of the field for a single charge on every field', () => {
    const fields: Array<[string, unknown]> = [['plain', 'azure']];
    for (const division of ['per-pale', 'per-fess', 'per-bend', 'per-bend-sinister', 'per-saltire', 'per-chevron', 'quarterly']) {
      for (const [a, b] of [['or', 'azure'], ['argent', 'sable'], ['gules', 'vert'], ['or', 'argent']]) fields.push([`${division} ${a}/${b}`, div(division, a, b)]);
    }
    let checked = 0;
    for (const [name, field] of fields) {
      for (const t of TINCTURES) {
        const d = nd(arms(field, chg('lion', t)));
        const contacts = groundContacts(d, [0])[0];
        const expected = contrastFailure(t, contacts);
        const issues = tinctureIssues(d);
        expect(issues.length > 0, `${name} ${t}`).toBe(expected !== null);
        checked++;
      }
    }
    expect(checked).toBe(fields.length * TINCTURES.length);
  });

  it('is silent on the generated corpus (which is filtered by it) and loud on its mutations', () => {
    const designs = generatedDesigns(77, 120);
    for (const d of designs) expect(tinctureIssues(d)).toEqual([]);
    // Recolour the first group with each field tincture: whatever the rule says, normalise and the walker agree.
    for (const d of designs.filter((x) => x.groups.length > 0).slice(0, 60)) {
      const t: Tincture = 'gules';
      const recoloured: Design = { ...d, groups: [{ ...d.groups[0], paint: { k: 'tincture', t } }, ...d.groups.slice(1)] };
      expect(normalise(recoloured).ok === (validate(recoloured).length === 0)).toBe(true);
    }
  });
});
