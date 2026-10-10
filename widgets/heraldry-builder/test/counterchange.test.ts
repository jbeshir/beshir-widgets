// Counterchanged charges and the builder's dead-end guards: on a divided field each charge (or each
// part of one crossing a partition line) takes the field's other tincture. Covers the design text
// (blazon, gloss, signature, tags, search, difference, readability), the rule of tincture across
// every division and tincture pair, the per-slot paint regions in every shape, and the builder: no
// count, placement or arrangement it offers leaves the charges without a legal tincture, and a
// rule-of-tincture violation always has a one-click fix.

import { describe, expect, it } from 'vitest';
import {
  BETWEEN_COUNTS, COUNTS, DIVISIONS, FIELD_SHAPES, ORDINARY_TYPES, SHAPE_LAYOUT, TINCTURES, TINCTURE_CLASS,
  arrangementChoices, blazon, buildSearchText, chargePath, chargeSlotContacts, chargeTinctureChoices, counterchangedParts, countChoices,
  deriveTags, differences, drawnBox, explainDifferences, filtersToTags, gloss, areDistinct, inFirstPart, matchesWords,
  normalise, ordinaryTinctureChoices, placementChoices, queryWords, readability, resolve, shapedChargeSlots, signature,
  structuralIssues, suggestTinctureFix, tinctureIssues, validate,
  type ChargeId, type ChargeTincture, type Choice, type Division, type NormDesign, type Ordinary, type OrdinaryType,
  type Placement, type Posture, type Tincture,
} from '../src/lib/heraldry';
import { place, rings } from './art-geometry';
import { plain, div, nd, filters } from './helpers';


const mullets = (field: unknown, count = 3, tincture = 'counterchanged', arrangement?: string) =>
  nd({ v: 1, field, charges: { charge: 'mullet', count, placement: 'field', tincture, ...(arrangement ? { arrangement } : {}) } });

const allowed = <T>(cs: Choice<T>[]) => cs.filter((c) => c.allowed).map((c) => c.value);

// ── The design and its text ─────────────────────────────────────────────────

describe('counterchanged in the design text', () => {
  const d = mullets(div('per-pale', 'or', 'azure'));

  it('parses as a charge tincture and is valid on a metal-and-colour field', () => {
    expect(d.charges!.tincture).toBe('counterchanged');
    expect(validate(d)).toEqual([]);
    const bad = resolve({ v: 1, field: div('per-pale', 'or', 'azure'), charges: { charge: 'mullet', count: 3, placement: 'field', tincture: 'counter' } });
    expect(!bad.ok && bad.errors.map((e) => e.message)).toEqual(['The charges need one of the eight tinctures, or counterchanged.']);
  });

  it('blazons as "counterchanged" in place of the tincture', () => {
    expect(blazon(d)).toBe('Per pale Or and Azure, three mullets counterchanged');
    expect(blazon(mullets(div('per-fess', 'or', 'azure'), 2, 'counterchanged', 'in-fess'))).toBe('Per fess Or and Azure, two mullets in fess counterchanged');
    expect(blazon(nd({ v: 1, field: div('per-fess', 'argent', 'gules'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'counterchanged' } })))
      .toBe('Per fess Argent and Gules, a lion rampant counterchanged');
    expect(blazon(nd({
      v: 1, field: div('per-pale', 'gules', 'or'), ordinary: { type: 'fess', tincture: 'argent' },
      charges: { charge: 'rose', count: 3, placement: 'field', tincture: 'counterchanged' },
    }))).toBe('Per pale Gules and Or, a fess Argent between three roses counterchanged');
  });

  it('glosses in plain English, naming the opposite colours', () => {
    expect(gloss(d)).toBe('A shield split vertically, gold on the left and blue on the right, with three five-pointed stars in the opposite colours of the field (blue on gold, gold on blue), two above one.');
    const lion = nd({ v: 1, field: div('per-fess', 'argent', 'gules'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'counterchanged' } });
    expect(gloss(lion)).toBe('A shield split horizontally, white on top and red below, with a lion rearing up in the opposite colours of the field (red on white, white on red).');
    const between = nd({
      v: 1, field: div('per-fess', 'or', 'vert'), ordinary: { type: 'pale', tincture: 'argent' },
      charges: { charge: 'rose', count: 2, placement: 'field', tincture: 'counterchanged' },
    });
    expect(gloss(between)).toBe('A shield split horizontally, gold on top and green below, with a white vertical band down the middle and a rose on each side, in the opposite colours of the field (green on gold, gold on green).');
  });

  it('has its own signature code, tag and search words', () => {
    expect(signature(d)).toBe('v1|F:per-pale:or:az|O:-|C:mullet:3:field:two-and-one:-:cc');
    const tags = deriveTags(d);
    expect(tags).toContain('charge-tincture:counterchanged');
    // The charges add no tincture of their own: they show the field's two.
    expect(tags.filter((t) => t.startsWith('tincture:'))).toEqual(['tincture:or', 'tincture:azure']);
    expect(filtersToTags(filters({ chargeTincture: 'counterchanged' }))).toEqual({ ok: true, tags: ['charge-tincture:counterchanged'] });
    expect(filtersToTags(filters({ tincture: 'counterchanged' })).ok).toBe(false);
    const text = buildSearchText({ displayName: 'Wren', blazon: blazon(d), design: d });
    for (const q of ['counterchanged', 'counterchange', 'counter-changed', 'opposite colours', 'stars counterchanged']) {
      expect(matchesWords(text, queryWords(q)), q).toBe(true);
    }
  });

  it('is a clear tincture difference from any single tincture, explained by name', () => {
    for (const t of TINCTURES) {
      const other = mullets(div('per-pale', 'or', 'azure'), 3, t);
      expect(differences(d, other), t).toEqual([{ attr: 'charge-tincture', weight: 'clear' }]);
      expect(areDistinct(d, other)).toBe(true);
    }
    expect(explainDifferences(d, mullets(div('per-pale', 'or', 'azure'), 3, 'argent')).map((n) => n.text)).toEqual(['picture colour (counterchanged ↔ Argent)']);
  });

  it('readability: no extra tincture, but charges split by the field line cost a point', () => {
    const split = readability(d).breakdown.find((b) => b.factor === 'split')!;
    expect(split.points).toBe(1);
    expect(readability(d).breakdown.find((b) => b.factor === 'tinctures')!.points).toBe(0);
    // Two mullets in pale on per fess: each lies wholly on one part, nothing is split.
    expect(readability(mullets(div('per-fess', 'or', 'azure'), 2)).breakdown.find((b) => b.factor === 'split')!.points).toBe(0);
    // The same layout in Argent adds a third tincture instead.
    expect(readability(mullets(div('per-pale', 'or', 'azure'), 3, 'argent')).breakdown.find((b) => b.factor === 'tinctures')!.points).toBe(1);
  });
});

// ── Rule of tincture ────────────────────────────────────────────────────────

describe('counterchanged and the rule of tincture', () => {
  it('is legal on every division exactly when one field tincture is a metal and the other a colour (celestine included)', () => {
    let legal = 0, illegal = 0;
    for (const division of DIVISIONS) {
      for (const t1 of TINCTURES) {
        for (const t2 of TINCTURES) {
          if (t1 === t2) continue;
          const d = mullets(div(division, t1, t2));
          const issues = tinctureIssues(d);
          const expectLegal = TINCTURE_CLASS[t1] !== TINCTURE_CLASS[t2];
          expect(issues.length === 0, `${division} ${t1}/${t2}`).toBe(expectLegal);
          expect(allowed(chargeTinctureChoices(d)).includes('counterchanged'), `${division} ${t1}/${t2} swatch`).toBe(expectLegal);
          if (expectLegal) legal++; else illegal++;
        }
      }
    }
    // 3 metals × 5 colours × 2 orders = 30 legal pairs per division; 3·2 + 5·4 = 26 same-class pairs.
    expect([legal, illegal]).toEqual([30 * DIVISIONS.length, 26 * DIVISIONS.length]);
  });

  it('explains a same-class field: still metal on metal, or colour on colour', () => {
    expect(validate(mullets(div('per-pale', 'or', 'argent'))).map((i) => i.message))
      .toEqual(['Counterchanged mullets on Or and Argent: metal on metal (counterchanging needs a field of one metal and one colour)']);
    expect(validate(mullets(div('quarterly', 'celestine', 'or'))).map((i) => i.message))
      .toEqual(['Counterchanged mullets on Celestine and Or: metal on metal (counterchanging needs a field of one metal and one colour)']);
    expect(validate(mullets(div('per-saltire', 'gules', 'azure'))).map((i) => i.message))
      .toEqual(['Counterchanged mullets on Gules and Azure: colour on colour (counterchanging needs a field of one metal and one colour)']);
    expect(validate(mullets(div('per-bend', 'celestine', 'azure')))).toEqual([]);
    const reason = chargeTinctureChoices(mullets(div('per-pale', 'or', 'argent'))).find((c) => c.value === 'counterchanged')!.reason;
    expect(reason).toBe('Counterchanged on Or and Argent — both metals — would still be metal on metal. It needs a field of one metal and one colour.');
  });

  it('is only allowed for charges lying on a divided field', () => {
    const onPlain = mullets(plain('azure'));
    expect(validate(onPlain)).toEqual([{
      code: 'tincture', layer: 'charges', slots: [0, 1, 2],
      message: "Counterchanged needs a divided field: each charge takes the field's other tincture, and a plain field has only one.",
    }]);
    const onBend = nd({
      v: 1, field: div('per-pale', 'or', 'azure'), ordinary: { type: 'bend', tincture: 'gules' },
      charges: { charge: 'key', count: 3, placement: 'ordinary', tincture: 'counterchanged' },
    });
    expect(validate(onBend).map((i) => i.message))
      .toEqual(["The keys lie on the bend, not on the field, so they can't be counterchanged — only charges on a divided field can."]);
    expect(chargeTinctureChoices(onBend).find((c) => c.value === 'counterchanged')!.allowed).toBe(false);
    // A plain field doesn't offer it at all, unless the charges already are (then it shows, blocked).
    expect(chargeTinctureChoices(mullets(plain('azure'), 3, 'or')).map((c) => c.value)).not.toContain('counterchanged');
    expect(chargeTinctureChoices(onPlain).find((c) => c.value === 'counterchanged')).toMatchObject({ allowed: false });
    // Between an ordinary, under a chief and within a bordure the charges lie on the field: allowed.
    for (const type of ['fess', 'chief', 'bordure'] as const) {
      const d = nd({ v: 1, field: div('per-pale', 'or', 'azure'), ordinary: { type, tincture: 'gules' }, charges: { charge: 'rose', count: 3, placement: 'field', tincture: 'counterchanged' } });
      expect(validate(d), type).toEqual([]);
    }
  });
});

// ── Painting each slot ──────────────────────────────────────────────────────

describe('counterchanged parts per slot, in every shape', () => {
  /** Every structurally legal layout of charges lying on the field. */
  const LAYOUTS: Array<{ ordinary: Ordinary | null; count: number; arrangement?: string }> = [
    ...COUNTS.flatMap((count) => [null, { type: 'bordure', tincture: 'gules' } as Ordinary, { type: 'chief', tincture: 'gules' } as Ordinary].flatMap((ordinary) => {
      const probe = nd({ v: 1, field: plain('azure'), ordinary, charges: { charge: 'mullet', count, placement: 'field', tincture: 'or' } });
      return structuralIssues(probe).length ? [] : (arrangementChoices(probe).mode === 'choose'
        ? allowed(arrangementChoices(probe).choices).map((arrangement) => ({ ordinary, count, arrangement }))
        : [{ ordinary, count }]);
    })),
    ...(Object.entries(BETWEEN_COUNTS) as Array<[OrdinaryType, readonly number[]]>).flatMap(([type, counts]) =>
      counts.map((count) => ({ ordinary: { type, tincture: 'gules' } as Ordinary, count }))),
  ];
  const ART: Array<{ id: ChargeId; posture: Posture | null }> = [
    { id: 'mullet', posture: null }, { id: 'lion', posture: 'rampant' }, { id: 'sword', posture: null }, { id: 'fish', posture: 'naiant' },
  ];

  it('covers every layout', () => expect(LAYOUTS.length).toBe(15 + 15 + 4 + 9));

  for (const division of DIVISIONS) {
    it(`${division}: each part takes the other tincture of its region, and covers every point of the art`, () => {
      const [t1, t2]: Tincture[] = ['or', 'azure'];
      for (const shape of FIELD_SHAPES) {
        const l = SHAPE_LAYOUT[shape];
        for (const layout of LAYOUTS) {
          for (const art of ART) {
            const d = nd({
              v: 1, field: div(division, t1, t2), ordinary: layout.ordinary,
              charges: { charge: art.id, count: layout.count, placement: 'field', posture: art.posture, arrangement: layout.arrangement, tincture: 'counterchanged' },
            });
            const parts = counterchangedParts(d, shape);
            const slots = shapedChargeSlots(d, shape);
            expect(parts, `${shape} ${blazon(d)}`).toHaveLength(slots.length);
            slots.forEach((s, i) => {
              const where = `${shape} ${blazon(d)} slot ${i + 1}`;
              for (const p of parts[i]) {
                expect(p.d, where).toBe(l.regions[division][p.region]);
                expect(p.tincture, where).toBe(p.region === 0 ? t2 : t1);
              }
              const regions = new Set(parts[i].map((p) => p.region));
              const drawn = place(rings(chargePath(art.id, art.posture)), drawnBox(s, art.id)).flat();
              const uncovered = drawn.find(([x, y]) => !regions.has(inFirstPart(division, l.fessPoint, x, y) ? 0 : 1));
              expect(uncovered, `${where} leaves art unpainted at ${uncovered}`).toBeUndefined();
            });
            // In the canonical layout a slot is painted in two parts exactly when the rule probe sees it straddle.
            if (shape === 'heater') {
              const straddles = chargeSlotContacts(d).map((cs) => cs.length > 1);
              parts.forEach((ps, i) => { if (straddles[i]) expect(ps, `${blazon(d)} slot ${i + 1}`).toHaveLength(2); });
            }
          }
        }
      }
    });
  }

  it('paints nothing for charges that are not counterchanged or not on a divided field', () => {
    expect(counterchangedParts(mullets(div('per-pale', 'or', 'azure'), 3, 'gules'), 'heater')).toEqual([]);
    expect(counterchangedParts(mullets(plain('azure')), 'round')).toEqual([]);
  });

  it('a single charge on per pale is split down the middle: Azure over the Or half, Or over the Azure half', () => {
    const d = nd({ v: 1, field: div('per-pale', 'or', 'azure'), charges: { charge: 'rose', count: 1, placement: 'field', tincture: 'counterchanged' } });
    for (const shape of FIELD_SHAPES) {
      expect(counterchangedParts(d, shape)[0].map((p) => [p.region, p.tincture]), shape).toEqual([[0, 'azure'], [1, 'or']]);
    }
  });
});

// ── Builder dead ends ───────────────────────────────────────────────────────

/** Fields: every division with every ordered pair of different tinctures. */
const DIVIDED_FIELDS = DIVISIONS.flatMap((division: Division) =>
  TINCTURES.flatMap((t1) => TINCTURES.filter((t2) => t2 !== t1).map((t2) => div(division, t1, t2))));

/** A design with no rule-of-tincture or structural problem, using the given charge tincture. */
const clean = (d: NormDesign, t: ChargeTincture) => validate({ ...d, charges: { ...d.charges!, tincture: t } }).length === 0;

describe('the builder never offers a count, placement or arrangement without a legal tincture', () => {
  it('every enabled option on every divided field has a legal charge tincture; every blocked one says why', () => {
    let offered = 0, deadEnds = 0;
    for (const field of DIVIDED_FIELDS) {
      const base = nd({ v: 1, field });
      for (const type of [null, ...ORDINARY_TYPES]) {
        const ordinary = type ? { type, tincture: allowed(ordinaryTinctureChoices(base, type))[0] } : null;
        for (const placement of ['field', 'ordinary'] as Placement[]) {
          const start = nd({ v: 1, field, ordinary, charges: { charge: 'mullet', count: 1, placement, tincture: 'or' } });
          if (structuralIssues(start).length) continue;
          for (const c of [...countChoices(start), ...placementChoices(start)]) {
            if (!c.allowed) expect(c.reason, `${blazon(start)}: ${c.value}`).toMatch(/\S/);
          }
          for (const count of countChoices(start)) {
            if (!count.allowed) continue;
            const counted = nd({ v: 1, field, ordinary, charges: { charge: 'mullet', count: count.value, placement, tincture: 'or' } });
            const arr = arrangementChoices(counted);
            const designs = arr.mode === 'choose'
              ? arr.choices.flatMap((a) => {
                if (!a.allowed) {
                  expect(a.reason, `${blazon(counted)}: ${a.value}`).toMatch(/\S/);
                  return [];
                }
                return [{ ...counted, charges: { ...counted.charges!, arrangement: a.value } }];
              })
              : [counted];
            for (const d of designs) {
              offered++;
              const legal = allowed(chargeTinctureChoices(d));
              if (!legal.length) deadEnds++;
              expect(legal.length, blazon(d)).toBeGreaterThan(0);
              for (const t of legal) expect(clean(d, t), `${blazon(d)} ${t}`).toBe(true);
            }
          }
        }
      }
    }
    expect(deadEnds).toBe(0);
    expect(offered).toBeGreaterThan(20000);
  });

  it('the plain tinctures alone still leave dead ends on metal-and-colour fields, which counterchanged resolves', () => {
    let withoutCounterchange = 0;
    for (const field of DIVIDED_FIELDS) {
      for (const count of COUNTS) {
        const d = mullets(field, count, 'or');
        for (const a of arrangementChoices(d).mode === 'choose' ? allowed(arrangementChoices(d).choices) : [d.charges!.arrangement]) {
          const da = { ...d, charges: { ...d.charges!, arrangement: a } };
          const legal = allowed(chargeTinctureChoices(da));
          if (!legal.some((t) => t !== 'counterchanged')) {
            withoutCounterchange++;
            expect(legal, blazon(da)).toEqual(['counterchanged']);
          }
        }
      }
    }
    // Every one of these layouts on a metal-and-colour field was a dead end before counterchanged.
    expect(withoutCounterchange).toBe(1950);
  });
});

describe('suggestTinctureFix always finds a way out of a rule-of-tincture violation', () => {
  const FIELDS = [
    ...TINCTURES.map(plain),
    ...(['per-pale', 'per-saltire', 'per-chevron'] as const).flatMap((d) =>
      [['or', 'azure'], ['azure', 'or'], ['or', 'argent'], ['gules', 'azure'], ['celestine', 'vert']].map(([a, b]) => div(d, a, b))),
  ];
  const ORDINARIES = [null, ...(['fess', 'chief', 'bordure', 'bend', 'cross'] as const).flatMap((type) => TINCTURES.map((tincture) => ({ type, tincture })))];
  const GROUPS = (['counterchanged', ...TINCTURES] as const).flatMap((tincture) => [
    { charge: 'mullet', count: 3, placement: 'field', tincture },
    { charge: 'lion', count: 1, placement: 'ordinary', tincture },
  ]);

  it('for every broken combination of field, ordinary and charges', () => {
    let broken = 0;
    for (const field of FIELDS) {
      for (const ordinary of ORDINARIES) {
        for (const charges of [null, ...GROUPS]) {
          const r = normalise({ v: 1, field, ordinary, charges });
          if (r.ok || !r.design || structuralIssues(r.design).length) continue;
          broken++;
          const fix = suggestTinctureFix(r.design);
          expect(fix, blazon(r.design)).not.toBeNull();
          expect(validate(fix!.design), `${blazon(r.design)} → ${fix!.label}`).toEqual([]);
          // Only tinctures change.
          expect({ ...fix!.design, ordinary: fix!.design.ordinary && { ...fix!.design.ordinary, tincture: null }, charges: fix!.design.charges && { ...fix!.design.charges, tincture: null } })
            .toEqual({ ...r.design, ordinary: r.design.ordinary && { ...r.design.ordinary, tincture: null }, charges: r.design.charges && { ...r.design.charges, tincture: null } });
        }
      }
    }
    expect(broken).toBeGreaterThan(1000);
  });

  it('suggests counterchanged when no single tincture fits, and both layers when one layer cannot', () => {
    const dead = mullets(div('per-pale', 'or', 'azure'), 3, 'argent');
    expect(suggestTinctureFix(dead)).toMatchObject({ layer: 'charges', tincture: 'counterchanged', alternatives: ['counterchanged'], label: 'Counterchange the mullets' });
    // Azure, a bend Azure charged with a lion Or: the bend must become a metal, then the lion a colour.
    const both = nd({ v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'azure' }, charges: { charge: 'lion', count: 1, placement: 'ordinary', tincture: 'or' } });
    expect(suggestTinctureFix(both)).toMatchObject({
      layer: 'ordinary-and-charges', ordinary: 'or', charges: 'gules', label: 'Switch the bend to Or and switch the lion to Gules',
    });
  });
});
