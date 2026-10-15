// Treatments (masoned, scaly, papellony) and natural colours (proper): what is drawn, how it is blazoned and judged and told apart
// from other paints, how the builder offers it, and that the SCA records it unlocks are built.


import { describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, DRAWN_TREATMENTS, TINCTURES, TINCTURE_CLASS, blazon, deriveTags, differences, fieldRegions, fillCode, gloss, hasNaturalColours, properChoice, renderLayers, setProper, setTreatment, setTreatmentColour,
  signature, structuralIssues, surfaceOf, sameSurface, tinctureIssues, treatmentAt, treatmentChoices, treatmentColourChoices, treatmentPattern, treatedPaint, unsupportedIssues, candidateKey,
  type Design,
} from '../src/lib/heraldry';
import { setFieldTincture } from '../src/lib/builder';
import { checkBlazon } from './sca/classify';
import { explainMatch } from './sca/match';
import { arms, charge, group, nd, ordinary } from './helpers';


const treated = (treatment: string, ground: string, ink: string) => ({ k: 'treated', treatment, ground, ink });
const lion = (paint: unknown, extra: object = {}) => group(charge('lion'), paint, extra);
const messages = (d: Design) => [...structuralIssues(d), ...tinctureIssues(d)].map((i) => i.message);
const gaps = (d: unknown) => unsupportedIssues(nd(d)).map((i) => `${i.gap.category}:${i.gap.detail}`);
const between = (a: unknown, b: unknown) => differences(nd(a), nd(b)).map((d) => `${d.attr}:${d.kind}:${d.rule}`);
const surface = (p: unknown) => surfaceOf(nd(arms(p, lion('gules'))).field, null);


describe('what is supported', () => {
  it('draws the three treatments on the field, on a part of it, and on bands and pictures', () => {
    for (const t of DRAWN_TREATMENTS) {
      expect(gaps(arms(treated(t, 'argent', 'sable'), lion('gules')))).toEqual([]);
      expect(gaps(arms({ k: 'divided', division: 'per-pale', parts: ['azure', treated(t, 'argent', 'sable')] }, lion('gules')))).toEqual([]);
      expect(gaps(arms('vert', group(ordinary('fess'), treated(t, 'argent', 'sable'))))).toEqual([]);
      expect(gaps(arms('vert', group(charge('heart'), treated(t, 'argent', 'sable'))))).toEqual([]);
    }
  });

  it('leaves fretty, plumetty and a treatment on anything but a tincture as gaps', () => {
    expect(gaps(arms(treated('fretty', 'argent', 'sable'), lion('gules')))).toEqual(['field-treatment:fretty']);
    expect(gaps(arms(treated('plumetty', 'vert', 'argent'), lion('gules')))).toEqual(['field-treatment:plumetty']);
    expect(gaps(arms({ k: 'treated', treatment: 'scaly', ground: { k: 'fur', fur: 'ermine' }, ink: 'sable' }, lion('gules')))).toEqual(['field-treatment:scaly-fur']);
  });

  it('draws natural colours for the charges that have a palette, and files the others as gaps', () => {
    for (const id of CHARGE_IDS) {
      const expected = CHARGES[id].proper ? [] : [`proper:${id}`];
      expect(gaps(arms('azure', group(charge(id), 'proper'))).filter((g) => g.startsWith('proper'))).toEqual(expected);
    }
    expect(CHARGE_IDS.filter((id) => CHARGES[id].proper)).toEqual(['lion', 'boar', 'stag', 'hare', 'bee', 'owl', 'rose', 'tree', 'open-book', 'sword', 'flame']);
    expect(gaps(arms('azure', group(ordinary('bend'), 'proper')))).toEqual(['proper:bend']);
  });
});


describe('the design text', () => {
  it('blazons a treatment as the College writes it', () => {
    expect(blazon(nd(arms(treated('masoned', 'argent', 'sable'), lion('gules'))))).toBe('Argent masoned sable, a lion gules.');
    expect(blazon(nd(arms('vert', group(ordinary('fess'), treated('scaly', 'or', 'azure')))))).toBe('Vert, a fess Or scaly azure.');
    expect(blazon(nd(arms({ k: 'divided', division: 'per-pale', parts: ['azure', treated('papellony', 'argent', 'sable')] }, lion('gules'))))).toBe('Per pale azure and argent papellony sable, a lion gules.');
  });

  it('blazons natural colours as proper', () => {
    expect(blazon(nd(arms('vert', group(charge('bee'), 'proper'))))).toBe('Vert, a bee proper.');
    expect(blazon(nd(arms('azure', group(charge('lion'), 'proper', { count: 3 }))))).toBe('Azure, three lions proper.');
  });

  it('glosses them in plain words and tags them', () => {
    expect(gloss(nd(arms(treated('masoned', 'argent', 'sable'), lion('gules'))))).toContain('brick-wall lines');
    expect(gloss(nd(arms('vert', group(charge('bee'), 'proper'))))).toContain('in its natural colours');
    expect(deriveTags(nd(arms(treated('scaly', 'argent', 'sable'), lion('gules'))))).toContain('treatment:scaly');
    expect(deriveTags(nd(arms('vert', group(charge('bee'), 'proper'))))).toContain('charge-tincture:proper');
  });

  it('signs a treatment and its ink, and told apart from the plain tincture', () => {
    const sig = (p: unknown) => signature(nd(arms(p, lion('gules'))));
    expect(sig(treated('masoned', 'argent', 'sable'))).not.toBe(sig(treated('masoned', 'argent', 'gules')));
    expect(sig(treated('masoned', 'argent', 'sable'))).not.toBe(sig('argent'));
  });
});


describe('the surface of a treated tincture', () => {
  it('has the class and tincture of its ground, told apart by the treatment and not by the ink (A5F2)', () => {
    expect(surface(treated('masoned', 'argent', 'sable'))).toMatchObject({ cls: 'metal', bases: ['argent'], variant: 'masoned' });
    expect(sameSurface(surface(treated('masoned', 'argent', 'sable')), surface(treated('masoned', 'argent', 'gules')))).toBe(true);
    expect(sameSurface(surface(treated('masoned', 'argent', 'sable')), surface(treated('scaly', 'argent', 'sable')))).toBe(false);
    expect(sameSurface(surface(treated('papellony', 'argent', 'gules')), surface(treated('scaly', 'argent', 'sable')))).toBe(true);
    expect(sameSurface(surface(treated('masoned', 'argent', 'sable')), surface('argent'))).toBe(false);
  });
});


describe('the rule of tincture and structure', () => {
  it('judges a charge on a treated field as on its ground', () => {
    expect(messages(nd(arms(treated('masoned', 'argent', 'sable'), lion('gules'))))).toEqual([]);
    expect(messages(nd(arms(treated('masoned', 'argent', 'sable'), lion('argent'))))).toEqual(['Argent lion on Argent masoned sable field: same tincture']);
    expect(messages(nd(arms(treated('scaly', 'vert', 'argent'), lion('sable'))))).toEqual(['Sable lion on Vert scaly argent field: colour on colour']);
  });

  it('needs lines that stand out against the tincture (GoT "Field Treatment")', () => {
    expect(messages(nd(arms(treated('masoned', 'argent', 'or'), lion('gules'))))).toEqual(['Argent masoned Or needs a metal and a colour — both are metals.']);
    expect(messages(nd(arms('azure', group(ordinary('fess'), treated('scaly', 'gules', 'vert')))))).toContain('Gules scaly vert needs a metal and a colour — both are colours.');
  });

  it('is not too generic on its own (A3E3), and a divided field may not repeat its ground (A3B3a)', () => {
    expect(structuralIssues(nd(arms(treated('scaly', 'gules', 'argent')))).map((i) => i.code)).toEqual([]);
    expect(messages(nd(arms({ k: 'divided', division: 'per-pale', parts: ['gules', treated('masoned', 'gules', 'or')] }, lion('argent'))))[0]).toMatch(/can't share a tincture/);
  });

  it('judges natural colours by the palette: a bee proper is a metal, a rose proper is gules (Table 4)', () => {
    expect(messages(nd(arms('vert', group(charge('bee'), 'proper'), group(ordinary('chief'), 'or'))))).toEqual([]);
    expect(messages(nd(arms('or', group(charge('bee'), 'proper'))))[0]).toMatch(/same tincture/);
    expect(messages(nd(arms('gules', group(charge('rose'), 'proper'))))[0]).toMatch(/same tincture/);
    expect(messages(nd(arms('azure', group(charge('boar'), 'proper'))))[0]).toMatch(/colour on colour/);
    expect(messages(nd(arms('sable', group(charge('boar'), 'proper'))))).toEqual(['Proper boar on Sable field: colour on colour']);
  });
});


describe('conflict', () => {
  it('counts a treatment as a change of tincture, and the same treatment on the same tincture as none (A5F2)', () => {
    const field = (p: unknown) => arms(p);
    expect(between(field(treated('masoned', 'argent', 'sable')), field(treated('masoned', 'argent', 'azure')))).toEqual([]);
    expect(between(field(treated('masoned', 'argent', 'sable')), field(treated('scaly', 'argent', 'sable')))).toEqual(['field-tincture:sc:A5F2']);
    expect(between(field(treated('papellony', 'argent', 'sable')), field(treated('scaly', 'argent', 'gules')))).toEqual([]);
    expect(between(field(treated('masoned', 'argent', 'sable')), field('argent'))).toEqual(['field-tincture:sc:A5F2']);
    // With a main picture, the field alone is only a distinct change.
    expect(between(arms(treated('masoned', 'argent', 'sable'), lion('gules')), arms(treated('scaly', 'argent', 'sable'), lion('gules')))).toEqual(['field-tincture:dc:A5G1a']);
  });

  it('puts a treated charge a distinct change from the plain and furred charge (A5G3)', () => {
    const a = arms('vert', group(charge('heart'), 'argent'));
    expect(between(a, arms('vert', group(charge('heart'), treated('masoned', 'argent', 'sable'))))).toEqual(['tincture:dc:A5G3']);
  });

  it('gives a rose proper no tincture change from a rose gules, and a boar proper one from a boar sable', () => {
    expect(between(arms('argent', group(charge('rose'), 'proper')), arms('argent', group(charge('rose'), 'gules')))).toEqual([]);
    expect(between(arms('argent', group(charge('boar'), 'proper')), arms('argent', group(charge('boar'), 'sable')))).toEqual(['tincture:dc:A5G3']);
    expect(candidateKey(nd(arms('argent', group(charge('rose'), 'proper'))))).toBeDefined();
  });
});


describe('the drawing', () => {
  it('lays a treatment as a pattern in the ground and the ink, each tile under two kilobytes', () => {
    for (const t of DRAWN_TREATMENTS) {
      const spec = treatmentPattern(treatedPaint(t, 'argent', 'sable'), 0.5);
      expect(spec.ground).toEqual({ k: 'tincture', t: 'argent' });
      expect(spec.marks.length).toBeGreaterThan(0);
      expect(JSON.stringify(spec).length).toBeLessThan(2000);
    }
  });

  it('paints the field and a band with the treatment pattern, and a divided field with one per part', () => {
    const [layer] = renderLayers(nd(arms(treated('masoned', 'argent', 'sable'), lion('gules'))), 'heater');
    expect(layer.k === 'field' && fillCode(layer.fill)).toMatch(/^pattern:masoned-/);
    const regions = fieldRegions(nd(arms({ k: 'divided', division: 'per-pale', parts: ['azure', treated('scaly', 'argent', 'sable')] }, lion('gules'))).field, 'heater');
    expect(regions.map((r) => r.paint.k)).toEqual(['tincture', 'treated']);
  });

  it('paints natural colours with the palette: one fill, or the flame split per fess', () => {
    const fills = (id: string) => {
      const layer = renderLayers(nd(arms('azure', group(charge(id), 'proper'))), 'heater').find((l) => l.k === 'charges');
      return layer?.k === 'charges' ? layer.fills.map((f) => fillCode(f.fill)) : [];
    };
    expect(fills('rose')).toEqual(['proper:#c62d35']);
    expect(fills('flame')[0]).toMatch(/^split\(proper:#f2a21b,proper:#d3302b\)$/);
  });
});


describe('the builder', () => {
  const field = (p: unknown) => nd(arms(p, lion('gules')));
  const target = { k: 'field', part: 0 } as const;

  it('offers each treatment on a tincture and keeps the tincture, with lines of the other class', () => {
    const d = field('argent');
    const choices = treatmentChoices(d, target);
    expect(choices.map((c) => [c.value, c.allowed])).toEqual(DRAWN_TREATMENTS.map((t) => [t, true]));
    const next = setTreatment(d, target, 'scaly');
    expect(next.kind === 'arms' && next.field).toEqual({ k: 'treated', treatment: 'scaly', ground: { k: 'tincture', t: 'argent' }, ink: 'gules' });
  });

  it('blocks lines of the tincture\'s own class, and moves the lines only when they would no longer contrast', () => {
    const d = setTreatment(field('argent'), target, 'masoned');
    const blocked = treatmentColourChoices(d, target, 1).filter((c) => !c.allowed).map((c) => c.value);
    expect(blocked).toEqual(TINCTURES.filter((t) => TINCTURE_CLASS[t] === 'metal'));
    // Another colour for the ground keeps the lines when they still contrast, and takes new ones when they do not.
    expect(treatmentAt(setTreatmentColour(d, target, 0, 'azure'), target)!.ink).toBe('or');
    expect(treatmentAt(setTreatmentColour(setTreatmentColour(d, target, 1, 'azure'), target, 0, 'argent'), target)).toMatchObject({ ground: { t: 'argent' }, ink: 'azure' });
    expect(treatmentAt(setTreatmentColour(setTreatmentColour(d, target, 1, 'azure'), target, 0, 'sable'), target)).toMatchObject({ ground: { t: 'sable' } });
    const ground = setTreatmentColour(setTreatmentColour(d, target, 1, 'azure'), target, 0, 'or');
    expect(treatmentAt(ground, target)).toMatchObject({ ground: { t: 'or' }, ink: 'azure' });
  });

  it('lays the treatment on a band or picture through the same helpers', () => {
    const d = nd(arms('vert', group(ordinary('fess'), 'argent')));
    const fess = { k: 'group', path: [0] } as const;
    const next = setTreatment(d, fess, 'masoned');
    expect(next.groups[0].paint).toMatchObject({ k: 'treated', treatment: 'masoned', ground: { t: 'argent' } });
  });

  it('drops the treatment when a plain tincture is chosen for the background', () => {
    const d = setTreatment(field('argent'), target, 'masoned');
    expect(setFieldTincture(d, 0, 'or').kind === 'arms' && (setFieldTincture(d, 0, 'or') as { field: { k: string } }).field.k).toBe('tincture');
  });

  it('paints a picture in its natural colours when it has them, and says why not when the rule of tincture forbids it', () => {
    const d = nd(arms('vert', group(charge('bee'), 'or')));
    expect(hasNaturalColours(d, [0])).toBe(true);
    expect(properChoice(d, [0])).toEqual({ value: 'proper', allowed: true });
    expect(setProper(d, [0]).groups[0].paint).toEqual({ k: 'proper' });
    const gold = nd(arms('or', group(charge('bee'), 'sable')));
    const blocked = properChoice(gold, [0]);
    expect(blocked && !blocked.allowed && blocked.reason).toMatch(/same tincture/);
    expect(properChoice(nd(arms('azure', group(charge('wolf'), 'or'))), [0])).toBeNull();
  });
});


describe('reaching it from the matcher', () => {
  const built = (text: string) => {
    expect(explainMatch(text).status, text).toBe('match');
    expect(checkBlazon(text).failures, text).toEqual([]);
  };

  it('builds the records written with a treatment or natural colours', () => {
    built('Argent masoned sable, a lion gules.');
    built('Vert scaly Or, a bend argent.');
    built('Per pale azure and argent papellony sable, a heart gules.');
    built('Gules, a fess Or masoned sable.');
    built('Vert, a bee proper and a chief Or.');
    built('Argent, three roses proper.');
    built('Argent, a tree proper.');
  });

  it('spells papelonny as papellony', () => {
    built('Argent papelonny sable, a lion gules.');
  });
});
