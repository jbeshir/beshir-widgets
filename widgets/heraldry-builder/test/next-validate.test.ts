// The normalisation pipeline: shape, then support, then structure and tincture together.

import { describe, expect, it } from 'vitest';
import { blazon, deriveTags, gloss, normalise, readability, signature, unsupportedIssues, validate } from '../src/lib/heraldry/next';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';
import { UNSUPPORTED_CASES } from './next-unsupported-cases';
import { generatedDesigns } from './next-design-generator';

describe('normalise', () => {
  it('returns the canonical design when nothing is wrong', () => {
    const r = normalise(arms('azure', group(ordinary('bend'), 'or')));
    expect(r.ok).toBe(true);
    expect(r.ok && r.design.groups[0].role).toBe('primary');
  });

  it('stops at shape errors with no design', () => {
    const r = normalise({ v: 2, field: 'azure', groups: [], extra: 1 });
    expect(r).toMatchObject({ ok: false, design: null });
    expect(!r.ok && r.errors.every((e) => e.code === 'shape')).toBe(true);
    expect(normalise('azure')).toMatchObject({ ok: false, design: null });
  });

  for (const [label, input, tag] of UNSUPPORTED_CASES) {
    it(`${label}: no design, and exactly one unsupported issue (${tag})`, () => {
      const r = normalise(input);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.design).toBeNull();
      expect(r.errors).toHaveLength(1);
      const [issue] = r.errors;
      expect(issue.code).toBe('unsupported');
      expect(issue.code === 'unsupported' && `${issue.gap.category}:${issue.gap.detail}`).toBe(tag);
    });
  }

  it('returns a rule-breaking design along with its issues, so it can still be drawn', () => {
    const r = normalise(arms('gules', group(charge('lion'), 'azure')));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.design).not.toBeNull();
    expect(!r.ok && r.errors.map((e) => e.code)).toEqual(['tincture']);
  });

  it('reports structure and tincture issues together, structure first', () => {
    const r = normalise(arms(div('per-pale', 'azure', 'azure'), group(charge('lion'), 'azure')));
    expect(!r.ok && r.errors.map((e) => e.code)).toEqual(['structure', 'tincture']);
  });

  it('does not judge the tinctures of charges that have no layout, and does not throw', () => {
    // Charges "between" with no central ordinary: the structure rule says so; there is nothing to probe.
    const r = normalise({ v: 2, field: 'azure', groups: [{ item: charge('rose'), paint: 'or', role: 'secondary', relation: 'between', count: 3 }] });
    expect(!r.ok && r.errors.map((e) => e.message)).toEqual(['Charges can only be set between a central band or shape.']);
  });

  it('agrees with validate on resolved designs, and passes everything the generator makes', () => {
    for (const d of generatedDesigns(5, 80)) {
      expect(validate(d)).toEqual([]);
      expect(unsupportedIssues(d)).toEqual([]);
      expect(normalise(d)).toEqual({ ok: true, design: d });
    }
  });
});

describe('every stage over layouts good and bad', () => {
  const KEYS = [undefined, 'single', 'in-pale', 'in-fess', 'in-bend', 'rows-1-1', 'rows-2-1', 'rows-2-2', 'rows-3-2-1', 'in-cross', 'in-saltire', 'in-orle', 'in-annulo', 'crossed', 'host', 'in-chief', 'in-base'];

  it('never throws, and everything normalise accepts can be blazoned, glossed, scored, tagged and signed', () => {
    let accepted = 0, total = 0;
    for (const field of ['azure', div('per-pale', 'argent', 'sable'), div('quarterly', 'or', 'gules')]) {
      for (const type of [null, 'fess', 'chevron', 'chief', 'bordure']) {
        for (const placement of ['field', 'on'] as const) {
          if (placement === 'on' && (type === null || type === 'bordure')) continue;
          for (let count = 1; count <= 12; count++) {
            for (const key of KEYS) {
              const picture = group(charge('mullet'), 'counterchanged', { count, ...(key ? { arrangement: key } : {}) });
              const input = type === null ? arms(field, picture)
                : placement === 'on' ? arms(field, group(ordinary(type), 'gules', { charged: [picture] }))
                  : arms(field, group(ordinary(type), 'gules'), picture);
              const r = normalise(input);
              total++;
              if (!r.ok) continue;
              accepted++;
              expect(blazon(r.design)).toMatch(/\.$/);
              expect(gloss(r.design)).toMatch(/\.$/);
              expect(readability(r.design).breakdown).toHaveLength(9);
              expect(deriveTags(r.design).length).toBeGreaterThan(4);
              expect(signature(r.design)).toMatch(/^arms\|/);
            }
          }
        }
      }
    }
    expect(accepted).toBeGreaterThan(50);
    expect(total).toBeGreaterThan(2000);
  }, 60_000);
});
