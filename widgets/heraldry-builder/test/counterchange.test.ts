// Counterchanged groups: on a divided field each charge or band (or each part of one crossing a partition
// line) takes the field's other tincture. SENA allows it where every touching edge has good contrast, so
// over a field of one metal and one colour only (A3B2). Covers the rule, its messages and the design text.

import { describe, expect, it } from 'vitest';
import {
  DRAWN_DIVISIONS, TINCTURES, TINCTURE_CLASS, blazon, buildSearchText, counterchangeUnavailable, deriveTags, filtersToTags, gloss, matchesWords,
  normalise, queryWords, readability, signature, tinctureIssues, type Division,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const chg = (id: string, paint: string, extra: object = {}) => group(charge(id), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);
const mullets = (field: unknown, count = 3) => nd(arms(field, chg('mullet', 'counterchanged', { count })));

describe('counterchanged and the rule of tincture', () => {
  it('is legal on every division exactly when one field tincture is a metal and the other a colour (celestine included)', () => {
    let legal = 0, illegal = 0;
    for (const division of DRAWN_DIVISIONS) {
      for (const t1 of TINCTURES) {
        for (const t2 of TINCTURES) {
          if (t1 === t2) continue;
          const expectLegal = TINCTURE_CLASS[t1] !== TINCTURE_CLASS[t2];
          const issues = tinctureIssues(mullets(div(division, t1, t2)));
          expect(issues.length === 0, `${division} ${t1}/${t2}`).toBe(expectLegal);
          if (expectLegal) legal++; else illegal++;
        }
      }
    }
    // 3 metals × 5 colours × 2 orders = 30 legal pairs per division; 3·2 + 5·4 = 26 same-class pairs.
    expect([legal, illegal]).toEqual([30 * DRAWN_DIVISIONS.length, 26 * DRAWN_DIVISIONS.length]);
  });

  it('explains a same-class field: still metal on metal, or colour on colour', () => {
    const hint = '(counterchanging needs a field of one metal and one colour)';
    expect(tinctureIssues(mullets(div('per-pale', 'or', 'argent'))).map((i) => i.message))
      .toEqual([`Counterchanged mullets on Or and Argent: metal on metal ${hint}`]);
    expect(tinctureIssues(mullets(div('quarterly', 'celestine', 'or'))).map((i) => i.message))
      .toEqual([`Counterchanged mullets on Celestine and Or: metal on metal ${hint}`]);
    expect(tinctureIssues(mullets(div('per-bend', 'azure', 'vert'), 1)).map((i) => i.message))
      .toEqual([`Counterchanged mullet on Azure and Vert: colour on colour ${hint}`]);
  });

  it('reports a failing group once, with every slot', () => {
    const issues = tinctureIssues(mullets(div('per-pale', 'or', 'argent')));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'tincture', at: { k: 'group', path: [0] }, slots: [0, 1, 2] });
  });

  it('is unavailable on a plain field and on a host, with a reason that can double as a blocked option', () => {
    const plain = nd(arms('vert', chg('mullet', 'counterchanged', { count: 2 })));
    expect(counterchangeUnavailable(plain, [0])).toBe("Counterchanged needs a divided field: each charge takes the field's other tincture, and a plain field has only one.");
    expect(tinctureIssues(plain).map((i) => i.message)).toEqual([counterchangeUnavailable(plain, [0])]);
    const band = nd(arms('vert', ord('fess', 'counterchanged')));
    expect(counterchangeUnavailable(band, [0])).toBe("Counterchanged needs a divided field: the fess takes the field's other tincture, and a plain field has only one.");
    const onBand = nd(arms(div('per-fess', 'or', 'azure'), ord('fess', 'gules', { charged: [chg('key', 'counterchanged', { count: 3 })] })));
    expect(counterchangeUnavailable(onBand, [0, 0]))
      .toBe("The keys lie on the fess, not on the field — counterchanged charges on a band or charge aren't available in this builder.");
    expect(counterchangeUnavailable(mullets(div('per-pale', 'or', 'azure')), [0])).toBeNull();
    expect(counterchangeUnavailable(nd(arms('vert', chg('mullet', 'or'))), [0])).toBeNull();
  });

  it('is unavailable for a group lying wholly in one part of the field, which it would simply show in the other tincture (SENA A5G3a)', () => {
    const inChief = nd(arms(div('per-fess', 'argent', 'gules'), chg('lion', 'counterchanged', { position: 'chief' })));
    expect(counterchangeUnavailable(inChief, [0]))
      .toBe('The lion lies wholly on the Argent part of the field, so counterchanged would simply make it Gules — choose Gules instead.');
    expect(tinctureIssues(inChief).map((i) => i.message)).toEqual([counterchangeUnavailable(inChief, [0])]);
    const chief = nd(arms(div('per-fess', 'argent', 'gules'), chg('lion', 'sable'), ord('chief', 'counterchanged')));
    expect(counterchangeUnavailable(chief, [1])).toBe('The chief lies wholly on the Argent part of the field, so counterchanged would simply make it Gules — choose Gules instead.');
    // One charge in each part is counterchanging proper.
    expect(counterchangeUnavailable(nd(arms(div('per-pale', 'argent', 'gules'), chg('mullet', 'counterchanged', { count: 2, arrangement: 'in-fess' }))), [0])).toBeNull();
  });

  it('allows bands: a counterchanged fess, and a counterchanged chief, on a metal-and-colour field', () => {
    expect(normalise(arms(div('per-pale', 'argent', 'gules'), ord('fess', 'counterchanged'))).ok).toBe(true);
    expect(normalise(arms(div('per-pale', 'argent', 'gules'), ord('chief', 'counterchanged'), chg('mullet', 'or'))).ok).toBe(true);
    expect(tinctureIssues(nd(arms(div('per-pale', 'or', 'argent'), ord('fess', 'counterchanged')))).map((i) => i.message))
      .toEqual(['Counterchanged fess on Or and Argent: metal on metal (counterchanging needs a field of one metal and one colour)']);
  });

  it('judges a tertiary on a counterchanged band against the tinctures it shows', () => {
    const on = (rose: string) => nd(arms(div('per-pale', 'argent', 'gules'), ord('fess', 'counterchanged', { charged: [chg('rose', rose)] })));
    // The fess shows gules over the argent half and argent over the gules half, so the rose lies across both.
    expect(tinctureIssues(on('sable'))).toEqual([]);
    expect(tinctureIssues(on('argent')).map((i) => i.message)).toEqual(['The Argent rose lies across the Gules and Argent parts of the fess: same tincture']);
  });
});

describe('counterchanged in the design text', () => {
  const d = mullets(div('per-pale', 'or', 'azure'));

  it('blazons as "counterchanged" in place of the tincture, and factors like any tincture', () => {
    expect(blazon(d)).toBe('Per pale Or and azure, three mullets counterchanged.');
    expect(blazon(nd(arms(div('per-fess', 'or', 'azure'), chg('mullet', 'counterchanged', { count: 2, arrangement: 'in-fess' }))))).toBe('Per fess Or and azure, in fess two mullets counterchanged.');
    expect(blazon(nd(arms(div('per-fess', 'argent', 'gules'), group(charge('lion', { posture: 'passant' }), 'counterchanged')))))
      .toBe('Per fess argent and gules, a lion passant counterchanged.');
    expect(blazon(nd(arms(div('per-pale', 'gules', 'or'), ord('fess', 'argent'), chg('rose', 'counterchanged', { count: 3 }))))).toBe('Per pale gules and Or, a fess argent between three roses counterchanged.');
    expect(blazon(nd(arms(div('per-pale', 'argent', 'gules'), chg('lion', 'counterchanged'), ord('chief', 'counterchanged')))))
      .toBe('Per pale argent and gules, a lion and a chief counterchanged.');
  });

  it('glosses in plain English, naming the opposite colours', () => {
    expect(gloss(d)).toBe('A shield split vertically, gold on the left and blue on the right, with three five-pointed stars in the opposite colours of the field (blue on gold, gold on blue), two above one.');
    const lion = nd(arms(div('per-fess', 'argent', 'gules'), group(charge('lion', { posture: 'rampant' }), 'counterchanged')));
    expect(gloss(lion)).toBe('A shield split horizontally, white on top and red below, with a lion rearing up in the opposite colours of the field (red on white, white on red).');
    const between = nd(arms(div('per-fess', 'or', 'azure'), ord('pale', 'argent'), chg('rose', 'counterchanged', { count: 2 })));
    expect(gloss(between)).toBe('A shield split horizontally, gold on top and blue below, with a white vertical band down the middle and a rose on each side, in the opposite colours of the field (blue on gold, gold on blue).');
  });

  it('has its own signature code, tag and search words', () => {
    expect(signature(d)).toBe('arms|per-pale(or,az)|P:c.mullet:3:rows-2-1:cc');
    const tags = deriveTags(d);
    expect(tags).toContain('charge-tincture:counterchanged');
    // The charges add no tincture of their own: they show the field's two.
    expect(tags.filter((t) => t.startsWith('tincture:'))).toEqual(['tincture:or', 'tincture:azure']);
    expect(filtersToTags({ ...NO, chargeTincture: 'counterchanged' })).toEqual({ ok: true, tags: ['charge-tincture:counterchanged'] });
    expect(filtersToTags({ ...NO, tincture: 'counterchanged' }).ok).toBe(false);
    const text = buildSearchText({ displayName: 'Wren', blazon: blazon(d), design: d });
    for (const q of ['counterchanged', 'counterchange', 'counter-changed', 'opposite colours', 'stars counterchanged']) {
      expect(matchesWords(text, queryWords(q)), q).toBe(true);
    }
  });

  it('readability: no extra tincture, but charges split by the field line cost a point', () => {
    const factor = (x: ReturnType<typeof readability>, f: string) => x.breakdown.find((b) => b.factor === f)!.points;
    expect(factor(readability(d), 'split')).toBe(1);
    expect(factor(readability(d), 'tinctures')).toBe(0);
    // Two mullets in pale on per fess: each lies wholly on one part, nothing is split.
    expect(factor(readability(mullets(div('per-fess', 'or', 'azure'), 2)), 'split')).toBe(0);
    // The same layout in argent adds a third tincture instead.
    expect(factor(readability(nd(arms(div('per-pale', 'or', 'azure'), chg('mullet', 'argent', { count: 3 })))), 'tinctures')).toBe(1);
  });
});

const NO = { tincture: '', fieldTincture: '', chargeTincture: '', charge: '', category: '', posture: '', ordinary: '', division: '' };

describe('counterchanged charges in every placement', () => {
  const placements: Array<[string, (division: Division) => unknown]> = [
    ['alone', (division) => arms(div(division, 'or', 'azure'), chg('lion', 'counterchanged'))],
    ['three', (division) => arms(div(division, 'or', 'azure'), chg('mullet', 'counterchanged', { count: 3 }))],
    ['between a fess', (division) => arms(div(division, 'or', 'azure'), ord('fess', 'gules'), chg('rose', 'counterchanged', { count: 3 }))],
    ['under a chief', (division) => arms(div(division, 'or', 'azure'), chg('mullet', 'counterchanged', { count: 2 }), ord('chief', 'gules'))],
  ];
  for (const [name, make] of placements) {
    it(`${name}: the rule depends on the field alone`, () => {
      for (const division of DRAWN_DIVISIONS) {
        const issues = tinctureIssues(nd(make(division))).filter((i) => i.at.k === 'group' && i.at.path.length === 1 && i.code === 'tincture' && i.reason === 'counterchange-unavailable');
        expect(issues, division).toEqual([]);
      }
    });
  }
});
