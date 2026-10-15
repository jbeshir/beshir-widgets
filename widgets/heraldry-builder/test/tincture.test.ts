// The SENA rule of tincture as a ground walker: the contrast predicate, what each kind of group lies on,
// the integrator's registered records, and the messages. Counterchanging has its own file.

import { describe, expect, it } from 'vitest';
import {
  GROUND_CLASS_SHARE, TINCTURES, contrastFailure, groundContacts, groundFailure, groundShares, groupTinctureIssues, normalise, signature,
  TINCTURE_CLASS, sameSurface, sharesTincture, surfaceOf, tinctureIssues, tinctureSurface, validate, type Design, type Surface, type Tincture,
} from '../src/lib/heraldry';
import { walkGroups } from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';
import { generatedDesigns } from './design-generator';
import { V } from './validation-cases';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);
const splendour = { mods: [{ id: 'in-splendour' }] };

/** A share of a ground held by a plain tincture. */
const share = (t: Tincture, s: number) => ({ surface: tinctureSurface(t), share: s });
const failure = (top: Tincture, ground: ReturnType<typeof share>[]) => groundFailure(tinctureSurface(top), ground);

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

describe('neutral surfaces (RB 1.2)', () => {
  const neutral: Surface = { cls: 'neutral', bases: ['argent', 'sable'], variant: null };
  const pieces = (...grounds: Array<[Surface, number]>) => grounds.map(([surface, s]) => ({ surface, share: s }));

  it('a neutral top is never alike to a ground, but still may not share a tincture with it', () => {
    expect(groundFailure(neutral, pieces([tinctureSurface('gules'), 1]))).toBeNull();
    expect(groundFailure(neutral, pieces([tinctureSurface('argent'), 1]))).toBe('same');
    expect(groundFailure(neutral, pieces([tinctureSurface('azure'), 0.5], [tinctureSurface('vert'), 0.5]))).toBeNull();
  });

  it('a neutral top on a neutral ground is judged by shared tinctures alone (A3B2 "may have good contrast"; registered: 140924, 117175)', () => {
    const varied = (variation: string, a: string, b: string) => ({ k: 'variation', variation, pieces: null, parts: [a, b] });
    expect(messages(arms(varied('bendy-sinister', 'argent', 'sable'), chg('flame', 'proper')))).toEqual([]);
    expect(messages(arms(varied('barry', 'or', 'gules'), group(charge('lion'), { k: 'fur', fur: 'vair', colours: null })))).toEqual([]);
    expect(messages(arms(varied('barry', 'or', 'gules'), chg('flame', 'proper')))).toEqual(['Proper flame on Barry Or and Gules field: same tincture']);
  });

  it('a neutral part of a ground counts toward neither class', () => {
    expect(groundFailure(tinctureSurface('gules'), pieces([neutral, 1]))).toBeNull();
    expect(groundFailure(tinctureSurface('gules'), pieces([neutral, 0.5], [tinctureSurface('azure'), 0.5]))).toBeNull();
    expect(groundFailure(tinctureSurface('gules'), pieces([neutral, 0.2], [tinctureSurface('azure'), 0.8]))).toBe('colour-on-colour');
    expect(groundFailure(tinctureSurface('or'), pieces([neutral, 0.2], [tinctureSurface('celestine'), 0.8]))).toBe('metal-on-metal');
  });

  it('shares a tincture when any base is in common, and is the same only when class and bases match', () => {
    expect(sharesTincture(neutral, tinctureSurface('sable'))).toBe(true);
    expect(sharesTincture(neutral, tinctureSurface('or'))).toBe(false);
    expect(sameSurface(tinctureSurface('or'), tinctureSurface('or'))).toBe(true);
    expect(sameSurface(neutral, { cls: 'neutral', bases: ['argent', 'sable'], variant: null })).toBe(true);
    expect(sameSurface(neutral, { cls: 'neutral', bases: ['sable', 'argent'], variant: null })).toBe(false);
    expect(sameSurface(tinctureSurface('or'), tinctureSurface('argent'))).toBe(false);
  });

  it('a plain tincture is its own class', () => {
    expect(TINCTURES.map((t) => tinctureSurface(t).cls)).toEqual(TINCTURES.map((t) => TINCTURE_CLASS[t]));
    expect(surfaceOf({ k: 'tincture', t: 'vert' }, null)).toBe(tinctureSurface('vert'));
    expect(() => surfaceOf({ k: 'proper' }, null)).toThrow('Not supported yet: proper:field');
  });
});

describe('a mixed ground is classed by area (SENA A3B1, A3B4a)', () => {
  const only = (input: unknown) => tinctureIssues(nd(input)).map((i) => i.message);

  it('a ground counts as one class from GROUND_CLASS_SHARE of it on, and as neutral below that', () => {
    expect(GROUND_CLASS_SHARE).toBe(2 / 3);
    expect(failure('or', [share('argent', 0.66), share('gules', 0.34)])).toBeNull();
    expect(failure('or', [share('argent', 0.67), share('gules', 0.33)])).toBe('metal-on-metal');
    // A shared tincture fails however little of it there is (A3B4b).
    expect(failure('gules', [share('argent', 0.95), share('gules', 0.05)])).toBe('same');
  });

  it('the shares of every ground add up to one', () => {
    for (const d of generatedDesigns(7, 60)) {
      for (const { path } of walkGroups(d)) {
        for (const ground of groundShares(d, path)) expect(ground.reduce((sum, g) => sum + g.share, 0)).toBeCloseTo(1, 9);
      }
    }
  });

  // REVIEW.md B1: one probe point touching the contrasting part no longer makes the ground neutral.
  it('an ordinary lying mostly on its own class fails', () => {
    expect(only(arms(div('quarterly', 'argent', 'gules'), ord('bend', 'or')))).toEqual(['Or bend lies mostly on Argent: metal on metal']);
    expect(only(arms(div('per-fess', 'argent', 'gules'), ord('pile', 'or')))).toEqual(['Or pile lies mostly on Argent: metal on metal']);
    expect(only(arms(div('per-bend', 'argent', 'gules'), ord('chief', 'or'), chg('mullet', 'sable')))).toEqual(['Or chief lies mostly on Argent: metal on metal']);
    expect(only(arms(div('per-saltire', 'argent', 'gules'), ord('pale', 'or')))).toEqual(['Or pale lies mostly on Argent: metal on metal']);
    expect(only(arms(div('per-fess', 'gules', 'argent'), ord('chevron', 'or')))).toEqual(['Or chevron lies mostly on Argent: metal on metal']);
  });

  it('a charge lying mostly on its own class fails, slot by slot', () => {
    expect(only(arms(div('per-chevron', 'argent', 'gules'), chg('mullet', 'or', { count: 2 })))).toEqual(['The upper Or mullet lies mostly on Argent: metal on metal']);
    expect(only(arms(div('per-fess', 'argent', 'gules'), chg('mullet', 'sable', { count: 5 })))).toEqual([
      'The two middle Sable mullets lie mostly on Gules: colour on colour',
      'The lower Sable mullet lies on Gules: colour on colour',
    ]);
  });

  it('an element set over the line stays neutral', () => {
    expect(only(arms(div('per-fess', 'argent', 'gules'), ord('fess', 'or')))).toEqual([]);
    expect(only(arms(div('per-pale', 'argent', 'gules'), chg('mullet', 'or', { count: 3, arrangement: 'in-pale' })))).toEqual([]);
    expect(only(arms(div('per-pale', 'argent', 'gules'), ord('bordure', 'or')))).toEqual([]);
  });

  it('a charge alone in the centre is judged at the fess point, wherever a chief pushes the drawing (regid:8075)', () => {
    const rose = nd(arms(div('per-bend', 'argent', 'sable'), chg('rose', 'gules'), ord('chief', 'gules')));
    expect(groundShares(rose, [0])[0].map((g) => g.surface.bases[0])).toEqual(['argent', 'sable']);
    expect(validate(rose)).toEqual([]);
  });

  // REVIEW.md M3: "Per chevron argent and sable, a chevron gules" has been registered at least twelve times.
  it('an ordinary on a field divided along its own line lies over the line, half on each part', () => {
    expect(groundShares(nd(arms(div('per-chevron', 'argent', 'sable'), ord('chevron', 'gules'))), [0]))
      .toEqual([[share('argent', 0.5), share('sable', 0.5)]]);
    expect(validate(nd(arms(div('per-chevron', 'argent', 'sable'), ord('chevron', 'gules'))))).toEqual([]);
    expect(only(arms(div('per-chevron', 'argent', 'sable'), ord('chevron', 'argent')))).toEqual(['Argent chevron lies on the Argent part of the field: same tincture']);
  });
});

// REVIEW.md M4: GoT Table 7 forces charges with no contrast into the part they contrast with; where the builder
// doesn't draw that, the design is a gap ("unsupported"), not a violation.
describe('charges Table 7 forces into one part of the field', () => {
  it('are an arrangement gap where the builder has no forced layout: more than three in a half', () => {
    const d = nd(arms(div('per-pale', 'argent', 'azure'), chg('mullet', 'azure', { count: 4 })));
    expect(tinctureIssues(d)).toEqual([{
      code: 'unsupported', at: { k: 'group', path: [0] }, gap: { category: 'arrangement', detail: 'forced-into-one-part' }, limit: null,
      message: 'All four Azure mullets would have to sit only on the Argent part of the field, which isn\'t available in this builder yet.',
    }]);
    expect(normalise(d)).toMatchObject({ ok: false, errors: [{ code: 'unsupported' }] });
  });

  it('are a violation, not a gap, for charges set in chief, base or canton: the blazon puts them there', () => {
    const d = nd(arms(div('per-pale', 'argent', 'azure'), chg('lion', 'gules'), chg('mullet', 'argent', { position: 'canton' })));
    expect(tinctureIssues(d).map((i) => [i.code, i.at])).toEqual([['tincture', { k: 'group', path: [1] }]]);
    // In canton on per chevron Or and sable the mullet lies on the Or part only.
    expect(tinctureIssues(nd(arms(div('per-chevron', 'or', 'sable'), chg('sun', 'counterchanged'), chg('mullet', 'sable', { position: 'canton' }))))).toEqual([]);
  });

  it('are a violation, not a gap, for charges set around the primary charges: they are judged on the parts they lie on', () => {
    const around = (paint: string) => nd(arms(div('per-pale', 'argent', 'azure'), chg('lion', 'gules'), chg('mullet', paint, { count: 3, relation: 'between' })));
    expect(tinctureIssues(around('argent')).map((i) => [i.code, i.at])).toEqual([['tincture', { k: 'group', path: [1] }], ['tincture', { k: 'group', path: [1] }]]);
    expect(tinctureIssues(around('counterchanged'))).toEqual([]);
  });

  it('are drawn where the builder knows the forced layout, and a real violation stays one', () => {
    expect(validate(nd(arms(div('per-fess', 'or', 'vert'), chg('mullet', 'vert', { count: 3 }))))).toEqual([]);
    // Colour on colour on the other part: nothing to force into.
    expect(tinctureIssues(nd(arms(div('per-pale', 'gules', 'azure'), chg('mullet', 'gules')))).map((i) => i.code)).toEqual(['tincture']);
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
      expect(validate(nd(arms(div('per-saltire', 'argent', 'sable'), chg('lion', t)))).length === 0, t).toBe(expectOk);
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

  it('a chief and a bordure each lie on the field, whatever stands beside them (SENA A3B)', () => {
    expect(messages(arms('azure', ord('fess', 'or'), ord('chief', 'argent'), ord('bordure', 'or')))).toEqual([]);
    // Each is judged on the field alone, whatever is beside it.
    expect(messages(arms('gules', ord('fess', 'or'), ord('chief', 'argent'), ord('bordure', 'gules')))).toEqual(['Gules bordure on Gules field: same tincture']);
    expect(messages(arms('azure', ord('fess', 'or'), ord('chief', 'gules'), ord('bordure', 'argent')))).toEqual(['Gules chief on Azure field: colour on colour']);
    // Charges set between the band, beside a chief and a bordure, lie on the field too.
    expect(messages(arms('azure', ord('pale', 'or'), chg('rose', 'argent', { count: 2 }), ord('chief', 'argent'), ord('bordure', 'argent')))).toEqual([]);
    expect(messages(arms('azure', ord('pale', 'or'), chg('rose', 'gules', { count: 2 }), ord('chief', 'argent'), ord('bordure', 'argent')))).toEqual(['Gules roses on Azure field: colour on colour']);
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

describe('groupTinctureIssues', () => {
  it('is the slice of tinctureIssues that belongs to one group', () => {
    const d = nd(arms(div('per-pale', 'or', 'gules'), group(ordinary('fess'), 'argent'), group(charge('lion'), 'or', { count: 2 })));
    expect(tinctureIssues(d).length).toBeGreaterThan(0);
    const paths = walkGroups(d).map((w) => w.path);
    expect(paths.flatMap((p) => groupTinctureIssues(d, p))).toEqual(tinctureIssues(d));
    expect(groupTinctureIssues(d, paths[0])).toEqual([]);
  });
});

describe('a charge may share a tincture with the field when only one of the two is multiply divided (A3B4b(2))', () => {
  const varied = (variation: string, a: string, b: string) => ({ k: 'variation', variation, pieces: null, parts: [a, b] });
  const vair = { k: 'fur', fur: 'vair', colours: null };

  it("allows SENA's own examples: an ordinary or a simple geometric charge over vair, stripes or cells", () => {
    expect(messages(arms(vair, ord('chief', 'argent')))).toEqual([]);
    expect(messages(arms(vair, ord('bordure', 'argent')))).toEqual([]);
    expect(messages(arms(varied('checky', 'or', 'vert'), chg('lozenge', 'vert')))).toEqual([]);
    expect(messages(arms(varied('barry', 'argent', 'azure'), chg('roundel', 'argent')))).toEqual([]);
    expect(messages(arms({ k: 'fur', fur: 'vair', colours: ['sable', 'or'] }, ord('chief', 'or')))).toEqual([]);
  });

  it('not a charge of another kind, nor when both are multiply divided, nor a bend on lozengy (Prec [Juliana of Avon, 03/2006])', () => {
    expect(messages(arms(vair, chg('lion', 'argent')))).toEqual(['Argent lion on Vair field: same tincture']);
    expect(messages(arms(varied('checky', 'argent', 'azure'), group(ordinary('bordure'), div('quarterly', 'argent', 'azure'))))).toEqual(['Quarterly Argent and Azure bordure on Checky Argent and Azure field: same tincture']);
    expect(messages(arms(varied('lozengy', 'argent', 'azure'), ord('bend', 'argent')))).toEqual(['Argent bend on Lozengy Argent and Azure field: same tincture']);
    expect(messages(arms(varied('lozengy', 'argent', 'azure'), ord('chief', 'argent')))).toEqual([]);
  });
});
