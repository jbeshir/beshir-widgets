// The correctness fixes of the phase-C code review (findings K-1 … K-27, /workspace/pc/review/findings-code.md): a pall inverted inverted,
// bands beside a point pointed, charges on a voided ordinary, lines where a chevron's limbs or a gyronny's rays meet (lines-field.test.ts
// tiles the shapes), cotises on a band whose line they can't take, a lined or cotised fess under a chief, the per chevron throughout ↔ pile
// reading with peripherals and its registry key, the normaliser's potenty and dancetty hosts, and changing a corner shape's type.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, LINES, bandPlace, blazon, candidateKey, differences, frameBeside, gloss, groupSlots, keysMayConflict, lineAllowed, ordinaryGeometry,
  outlineChoices, pathRings, peripheralItemChoices, plainSpec, setPeripheralItem, shapeFrame, signature, structuralIssues, tinctureIssues,
  toggleChoices, unsupportedIssues, validate, type Design, type OrdinarySpec,
} from '../src/lib/heraldry';
import { normaliseBlazon } from './sca/normalise';
import { arms, charge, div, group, nd, ordinary } from './helpers';
import { rotatesIn } from './rotation';

const tags = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);

describe('a pall inverted with the inverted mod is the pall (K-1)', () => {
  it('reads, draws, glosses and signs as the pall', () => {
    const turned = nd(arms('argent', group(ordinary('pall-inverted', { mods: ['inverted'] }), 'gules')));
    const pall = nd(arms('argent', group(ordinary('pall'), 'gules')));
    expect(turned).toEqual(pall);
    expect(signature(turned)).toBe(signature(pall));
    expect(blazon(turned)).toBe('Argent, a pall gules.');
    expect(gloss(turned)).toContain('Y-shaped band');
  });
});

describe('a point pointed leaves the bands across the field in place (K-2)', () => {
  it('keeps a fess, bars, a cross and a saltire at the fess point and full width beside a point, but not beside a base', () => {
    for (const shape of FIELD_SHAPES) {
      const point = frameBeside(shape, false, [plainSpec('point')]), base = frameBeside(shape, false, [plainSpec('base')]);
      for (const type of ['fess', 'bar', 'cross', 'saltire'] as const) {
        expect(bandPlace({ ...plainSpec(type), count: type === 'bar' ? 2 : 1 }, point)).toEqual({ centre: shapeFrame(shape).fessPoint, scale: 1 });
        expect(bandPlace(plainSpec(type), base).scale).toBeLessThan(1);
      }
    }
  });

  it('has room for two bars or a fess embattled between three roses beside a point (refused for room after C16)', () => {
    for (const band of [group(ordinary('bar'), 'or', { count: 2 }), group(ordinary('fess', { lines: { a: 'embattled' } }), 'or')]) {
      const d = nd(arms('vert', band, group(charge('rose'), 'argent', { count: 3 }), group(ordinary('point'), 'argent')));
      expect(validate(d)).toEqual([]);
      expect(groupSlots(d, [1], 'heater')[0].size).toBeGreaterThanOrEqual(15);
    }
  });
});

describe('charges on a voided cross, saltire or pall are not drawn (K-3)', () => {
  it('is a gap, and Hollow is blocked on a band with charges on it', () => {
    for (const type of ['cross', 'saltire', 'pall']) {
      const d = nd(arms('argent', group(ordinary(type, { mods: ['voided'] }), 'gules', { charged: [group(charge('roundel'), 'or', { count: type === 'pall' ? 3 : 1 })] })));
      expect(tags(d)).toEqual(['multiple-groups:tertiary-on-voided']);
    }
    const charged = nd(arms('argent', group(ordinary('cross'), 'gules', { charged: [group(charge('roundel'), 'or', { count: 5 })] })));
    expect(toggleChoices(charged, [0]).find((c) => c.value === 'voided')).toMatchObject({ allowed: false });
    expect(toggleChoices(nd(arms('argent', group(ordinary('cross'), 'gules'))), [0]).find((c) => c.value === 'voided')).toMatchObject({ allowed: true });
  });

  it('blocks only on a gap the treatment brings, not one the charges on it already have (verify V-7)', () => {
    const d = nd(arms('argent', group(ordinary('cross'), 'gules', { charged: [group(charge('roundel'), 'or', { count: 3 })] })));
    expect(tags(d)).toEqual(['placement:on-cross-3']);
    const choices = toggleChoices(d, [0]);
    expect(choices.find((c) => c.value === 'couped')).toMatchObject({ allowed: true });
    expect(choices.find((c) => c.value === 'voided')).toMatchObject({ allowed: false });
  });
});

describe('cotises on a band whose line they can\'t take are plain (K-6)', () => {
  it('offers cotised on a chevron rompu and a bend bevilled, with plain cotises', () => {
    for (const [type, line] of [['chevron', 'rompu'], ['bend', 'bevilled']] as const) {
      const d = nd(arms('argent', group(ordinary(type, { lines: { a: line } }), 'gules')));
      const choices = outlineChoices(d, [0]);
      for (const outline of ['cotised', 'doubly-cotised', 'triply-cotised'] as const) expect(choices.find((c) => c.value === outline)).toMatchObject({ allowed: true });
    }
  });
});

describe('a lined or trimmed fess under a chief keeps below it (K-7)', () => {
  const top = (d: string | undefined) => (d ? Math.min(...pathRings(d).flat().map(([, y]) => y)) : Infinity);
  it('clears the chief in every shape, cotised on its own line and enhanced too (on the lozenge drawn narrower; verify K-7)', () => {
    const lines = LINES.filter((l) => lineAllowed({ k: 'ordinary', type: 'fess', inverted: false }, l));
    for (const shape of FIELD_SHAPES) {
      const frame = frameBeside(shape, true, [plainSpec('chief')]);
      for (const line of lines) for (const mods of [[], ['enhanced']] as const) for (const trim of ['none', 'fimbriated', 'cotised', 'cotised-lined', 'triply-lined'] as const) {
        // the lozenge, whose free field is shortest, and the heater in full; a rotating quarter of the banner's and the round's
        if (shape !== 'lozenge' && shape !== 'heater' && !rotatesIn(`${shape}|${line}|${mods}|${trim}`, 1 / 4)) continue;
        // the builder's default: cotises on the band's line where they take it
        const cotiseLine = trim.endsWith('lined') && lineAllowed({ k: 'cotises', type: 'fess' }, line) ? line : 'plain';
        const spec: OrdinarySpec = {
          ...plainSpec('fess'), mods: [...mods], lines: { a: line, b: line }, fimbriated: trim === 'fimbriated',
          cotised: trim === 'none' || trim === 'fimbriated' ? null : { count: trim === 'triply-lined' ? 3 : 1, line: cotiseLine },
        };
        const g = ordinaryGeometry(spec, frame);
        const highest = Math.min(top(g.body), top(g.cotises?.d), top(g.fimbriation?.d));
        expect(highest, `${shape} ${line} ${mods} ${trim}`).toBeGreaterThanOrEqual(frame.top);
      }
    }
  });
});

describe('a pile inverted throughout is per chevron throughout, peripherals and all (K-8, K-9)', () => {
  const pile = (...more: object[]) => nd(arms('argent', group(ordinary('pile', { mods: ['inverted', 'throughout'] }), 'gules'), ...more));
  const field = (division: string, ...more: object[]) => nd(arms(div(division, 'argent', 'gules'), ...more));
  const bordure = group(ordinary('bordure'), 'sable');

  it('is no different with the same bordure on both', () => {
    expect(differences(pile(bordure), field('per-chevron-throughout', bordure))).toEqual([]);
    expect(differences(pile(bordure), field('per-chevron', bordure))).toEqual([]);
  });

  it('is looked up against per chevron fields with a peripheral and against phase-B bare per chevron rows', () => {
    const chief = field('per-chevron', group(ordinary('chief'), 'sable'));
    expect(differences(pile(), chief).map((x) => x.kind)).toEqual(['dc']);
    expect(keysMayConflict(candidateKey(pile()), candidateKey(chief))).toBe(true);
    expect(candidateKey(field('per-chevron'))).toEqual({ partition: 'per-chevron', primary: null });
    expect(keysMayConflict(candidateKey(pile()), { partition: 'per-chevron', primary: null })).toBe(true);
  });
});

describe('the SCA normaliser reads potenty and dancetty after the phase-C divisions and ordinaries (K-10, K-11)', () => {
  it('keeps the tinctures of a potenty line in their order', () => {
    for (const text of ['Gyronny potenty gules and Or.', 'Per chevron inverted potenty gules and Or.', 'Per chevron throughout potenty vert and argent.', 'Gyronny potenty argent and azure.']) {
      expect(normaliseBlazon(text)).toBe(text.toLowerCase().replace(/\.$/, ''));
    }
  });

  it('reads dancetty as indented on every band or shape that takes indented but not dancetty', () => {
    expect(normaliseBlazon('Argent, a pall dancetty gules.')).toBe('argent, a pall indented gules');
    expect(normaliseBlazon('Argent, flaunches dancetty gules.')).toBe('argent, flaunches indented gules');
    expect(normaliseBlazon('Argent, a gore dancetty gules.')).toBe('argent, a gore indented gules');
    expect(normaliseBlazon('Argent, a fess dancetty gules.')).toBe('argent, a fess dancetty gules');
  });
});

describe('changing a corner shape\'s type is refused as adding it would be (K-19)', () => {
  it('blocks a base that would move the fess onto a tincture breaking the rule', () => {
    const d = nd(arms(div('per-fess', 'argent', 'azure'), group(ordinary('fess'), 'or'), group(ordinary('canton'), 'azure')));
    expect([...structuralIssues(d), ...tinctureIssues(d)]).toEqual([]);
    expect(tinctureIssues(setPeripheralItem(d, 'peripheral-0', 'base')).length).toBeGreaterThan(0);
    expect(peripheralItemChoices(d, 'peripheral-0').find((c) => c.value === 'base')).toMatchObject({ allowed: false });
  });
});

describe('words', () => {
  it('glosses bevilled as an adjective (K-27)', () => {
    expect(gloss(nd(arms('argent', group(ordinary('bend', { lines: { a: 'bevilled' } }), 'gules'))))).toContain('step-broken');
  });
});
