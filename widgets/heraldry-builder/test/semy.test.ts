// Semy (strewn charges): what is drawn, how it is blazoned and judged and told apart from other designs, how the builder offers it,
// and that the SCA records it unlocks are built.


import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { SemyPicker } from '../src/components/design/SemyPicker';
import {
  CHARGE_IDS, SEMY_NAMES, STREWN_COUNT, blazon, candidateKey, clearSemy, deriveTags, differences, fieldRegions, fillCode, gloss, isFieldPrimary, liftStrewn, renderLayers, semyAt, semyChoices,
  semyColourChoices, semyPaint, semyPhrase, setSemy, setSemyColour, signature, strewnGroups, structuralIssues, surfaceOf, tinctureIssues, unsupportedIssues,
  type Design,
} from '../src/lib/heraldry';
import { setFieldTincture } from '../src/lib/builder';
import { builderPath } from './builder-path';
import { checkBlazon } from './sca/classify';
import { explainMatch } from './sca/match';
import { normaliseBlazon } from './sca/normalise';
import { arms, charge, group, nd, ordinary } from './helpers';
import { buildSearchText, matchesWords, queryWords } from '../src/lib/heraldry';


const semy = (ground: string, id: string, ink: string) => ({ k: 'semy', ground, charge: { charge: id }, ink });
const lion = (paint: unknown, extra: object = {}) => group(charge('lion'), paint, extra);
const pale = (a: unknown, b: unknown) => ({ k: 'divided', division: 'per-pale', parts: [a, b] });
const messages = (d: Design) => [...structuralIssues(d), ...tinctureIssues(d)].map((i) => i.message);
const gaps = (d: unknown) => unsupportedIssues(nd(d)).map((i) => `${i.gap.category}:${i.gap.detail}`);
const between = (a: unknown, b: unknown) => differences(nd(a), nd(b)).map((d) => `${d.attr}:${d.kind}:${d.rule}`);


describe('what is supported', () => {
  it('draws a semy on the field, on a part of it, on a band and over all of a divided field', () => {
    expect(gaps(arms(semy('azure', 'mullet', 'or')))).toEqual([]);
    expect(gaps(arms(pale('gules', semy('argent', 'billet', 'gules'))))).toEqual([]);
    expect(gaps(arms(pale(semy('azure', 'rose', 'argent'), semy('argent', 'rose', 'azure'))))).toEqual([]);
    expect(gaps(arms('sable', lion('or'), group(ordinary('bordure'), semy('argent', 'roundel', 'or'))))).toEqual([]);
    expect(gaps(arms('vert', group(ordinary('chevron'), semy('argent', 'roundel', 'sable'))))).toEqual([]);
  });


  it('leaves a semy on a picture, on a fur and of a charge form as gaps', () => {
    expect(gaps(arms('azure', lion(semy('or', 'mullet', 'gules'))))).toEqual(['count:semy']);
    expect(gaps(arms({ k: 'semy', ground: { k: 'fur', fur: 'ermine' }, charge: { charge: 'mullet' }, ink: 'or' }, lion('gules')))).toEqual(['field-treatment:semy-fur']);
    expect(gaps(arms({ k: 'semy', ground: 'azure', charge: { charge: 'lion', form: 'head' }, ink: 'or' }))).toEqual(['charge-modifier:head']);
    expect(gaps(arms('azure', group(ordinary('fess'), pale(semy('or', 'mullet', 'gules'), 'argent'))))).toEqual(['field-treatment:semy-party']);
  });


  it('strews any charge there is', () => {
    for (const id of CHARGE_IDS) expect(gaps(arms(semy('azure', id, 'argent'))), id).toEqual([]);
  });
});


describe('the design text', () => {
  it('blazons a semy by its name where it has one and as "semy of" otherwise', () => {
    expect(blazon(nd(arms(semy('azure', 'fleur-de-lis', 'or'))))).toBe('Azure semy-de-lys Or.');
    expect(blazon(nd(arms(semy('azure', 'cross-crosslet', 'argent'), lion('or'))))).toBe('Azure crusilly argent, a lion Or.');
    expect(blazon(nd(arms(semy('sable', 'roundel', 'or'))))).toBe('Sable bezanty.');
    expect(blazon(nd(arms(semy('argent', 'goutte', 'gules'), lion('sable'))))).toBe('Argent goutty de sang, a lion sable.');
    expect(blazon(nd(arms(semy('argent', 'lion', 'gules'))))).toBe('Argent semy of lions gules.');
    expect(blazon(nd(arms(semy('gules', 'roundel', 'vert'))))).toBe('Gules semy of roundels vert.');
    expect(semyPhrase('roundel', 'gules')).toBe('semy of torteaux');
  });


  it('names every semy it has a name for, and a name of a fixed tincture only with that tincture', () => {
    for (const { word, charge: id, tincture } of SEMY_NAMES) {
      expect(semyPhrase(id, tincture ?? 'argent')).toBe(tincture === null ? `${word} argent` : word);
    }
    expect(semyPhrase('roundel', 'vert')).toBe('semy of roundels vert');
  });


  it('words a semy on a part of the field after that part, and one over all of a divided field with "all"', () => {
    expect(blazon(nd(arms(pale('gules', semy('argent', 'billet', 'gules')))))).toBe('Per pale gules and argent billety gules.');
    expect(blazon(nd(arms(pale(semy('azure', 'rose', 'argent'), semy('argent', 'rose', 'azure')))))).toBe('Per pale azure and argent all semy of roses counterchanged.');
    expect(blazon(nd(arms(pale(semy('gules', 'mullet', 'argent'), semy('azure', 'mullet', 'argent')), lion('or'))))).toBe('Per pale gules and azure all mullety argent, a lion Or.');
    // Two different semys are each said after their part.
    expect(blazon(nd(arms(pale(semy('gules', 'mullet', 'argent'), semy('azure', 'cross-crosslet', 'or')))))).toBe('Per pale gules mullety argent and azure crusilly Or.');
  });


  it('says the tincture of a semy on a band before what is strewn on it, and leaves a shared tincture to the next element only when nothing is strewn', () => {
    expect(blazon(nd(arms('vert', lion('or'), group(ordinary('bordure'), semy('argent', 'mullet', 'sable')))))).toBe('Vert, a lion Or, a bordure argent mullety sable.');
    expect(blazon(nd(arms('vert', lion('argent'), group(ordinary('bordure'), semy('argent', 'mullet', 'sable')))))).toBe('Vert, a lion and a bordure argent mullety sable.');
    expect(blazon(nd(arms('vert', lion('argent'), group(ordinary('bordure'), semy('argent', 'mullet', 'sable')))), { stateTinctures: true })).toBe('Vert, a lion argent, a bordure argent mullety sable.');
    expect(blazon(nd(arms('vert', group(ordinary('chevron'), semy('or', 'roundel', 'sable')), group(charge('rose'), 'or', { count: 3, relation: 'between' }))))).toBe('Vert, a chevron Or pellety between three roses Or.');
  });


  it('glosses it in plain words and tags it', () => {
    expect(gloss(nd(arms(semy('azure', 'mullet', 'or'))))).toBe('A shield of blue strewn with gold five-pointed stars.');
    expect(gloss(nd(arms('vert', group(ordinary('bordure'), semy('argent', 'roundel', 'sable'))))))
      .toBe('A green shield with a border around the edge in white, strewn with black discs.');
    expect(gloss(nd(arms(pale('gules', semy('argent', 'billet', 'gules')))))).toContain('red');
    const tags = deriveTags(nd(arms(semy('azure', 'mullet', 'or'), lion('gules'))));
    expect(tags).toEqual(expect.arrayContaining(['semy:mullet', 'charge:mullet', 'charge-category:geometric', 'field-tincture:azure', 'field-tincture:or', 'charge:lion']));
  });


  it('signs a semy by its ground, its charge and its tincture', () => {
    const sig = (g: string, id: string, ink: string) => signature(nd(arms(semy(g, id, ink), lion('gules'))));
    expect(sig('azure', 'mullet', 'or')).not.toBe(sig('azure', 'mullet', 'argent'));
    expect(sig('azure', 'mullet', 'or')).not.toBe(sig('azure', 'estoile', 'or'));
    expect(sig('azure', 'mullet', 'or')).not.toBe(sig('vert', 'mullet', 'or'));
    expect(sig('azure', 'mullet', 'or')).not.toBe(signature(nd(arms('azure', lion('gules')))));
  });
});


describe('the surface of a semy', () => {
  it('is that of the tincture it is strewn on', () => {
    const surface = (p: unknown) => surfaceOf(nd(arms(p, lion('gules'))).field, null);
    expect(surface(semy('azure', 'mullet', 'or'))).toBe(surface('azure'));
  });
});


describe('the rule of tincture and structure', () => {
  it('judges a charge on a semy field as on its ground, and the strewn charges as on it (A3B4a)', () => {
    expect(messages(nd(arms(semy('azure', 'mullet', 'or'), lion('argent'))))).toEqual([]);
    expect(messages(nd(arms(semy('azure', 'mullet', 'or'), lion('sable'))))).toEqual(['Sable lion on Azure field: colour on colour']);
    expect(messages(nd(arms(semy('azure', 'mullet', 'gules'), lion('argent'))))).toEqual(['Mullets Gules strewn on Azure: colour on colour']);
    expect(messages(nd(arms(semy('argent', 'mullet', 'or'), lion('sable'))))).toEqual(['Mullets Or strewn on Argent: metal on metal']);
    expect(messages(nd(arms(semy('argent', 'mullet', 'argent'), lion('sable'))))).toEqual(['Mullets Argent strewn on Argent: same tincture']);
  });


  it('lets the strewn charges share the tincture of the main picture (Prec #SEMY)', () => {
    expect(messages(nd(arms(semy('azure', 'mullet', 'or'), lion('or'))))).toEqual([]);
  });


  it('judges a semy on one part of a divided field against that part alone', () => {
    expect(messages(nd(arms(pale('gules', semy('argent', 'billet', 'gules')))))).toEqual([]);
    expect(messages(nd(arms(pale('azure', semy('gules', 'billet', 'argent')))))).toEqual([]);
    expect(messages(nd(arms(pale('argent', semy('azure', 'billet', 'gules'))))))
      .toEqual(['Billets Gules strewn on Azure: colour on colour']);
  });


  it('judges a semy over all of a divided field against each part', () => {
    expect(messages(nd(arms(pale(semy('azure', 'rose', 'argent'), semy('argent', 'rose', 'azure')))))).toEqual([]);
    expect(messages(nd(arms(pale(semy('azure', 'rose', 'gules'), semy('argent', 'rose', 'gules'))))))
      .toEqual(['Roses Gules strewn on Azure: colour on colour']);
    // Two colours counterchanged would put each on the other: colour on colour.
    expect(messages(nd(arms(pale(semy('azure', 'rose', 'gules'), semy('gules', 'rose', 'azure'))))))
      .toEqual(['Roses Gules strewn on Azure: colour on colour', 'Roses Azure strewn on Gules: colour on colour']);
  });


  it('judges a charge sharing a tincture with a semy part by the tincture it is strewn on, forcing it where it contrasts (Table 7)', () => {
    const d = nd(arms(pale(semy('argent', 'roundel', 'sable'), 'purpure'), group(charge('rose'), 'argent', { count: 3 })));
    expect(unsupportedIssues(d)).toEqual([]);
    expect(messages(d)).toEqual([]);
    expect(blazon(d)).toBe('Per pale argent pellety and purpure, three roses argent.');
  });


  it('judges a band on a semy field as on its ground, and a semy on the band against the tincture it is strewn on', () => {
    expect(messages(nd(arms(semy('azure', 'mullet', 'or'), group(ordinary('fess'), 'gules'))))).toEqual(['Gules fess on Azure field: colour on colour']);
    expect(messages(nd(arms('vert', lion('or'), group(ordinary('bordure'), semy('argent', 'mullet', 'sable')))))).toEqual([]);
    expect(messages(nd(arms('vert', lion('or'), group(ordinary('bordure'), semy('argent', 'mullet', 'or'))))))
      .toEqual(['Mullets Or strewn on Argent: metal on metal']);
    // The band is judged on its own tincture against the field: a semy of colour on metal on a colour field.
    expect(messages(nd(arms('vert', group(ordinary('bordure'), semy('gules', 'mullet', 'argent')))))).toEqual(['Gules bordure on Vert field: colour on colour']);
  });


  it('is no plain field, and needs no other picture (a semy is a group, A3E3)', () => {
    expect(structuralIssues(nd(arms(semy('azure', 'mullet', 'or')))).map((i) => i.code)).toEqual([]);
    expect(structuralIssues(nd(arms('azure'))).map((i) => i.code)).toEqual(['generic']);
  });


  it('may not strew a charge that is used again in another group on the field (A3D1a)', () => {
    expect(messages(nd(arms(semy('azure', 'mullet', 'or'), group(charge('mullet'), 'argent', { count: 3 }))))[0])
      .toMatch(/^Mullets are strewn on the field, so they can't be used again in another group on it \(SENA A3D1a\)/);
    expect(messages(nd(arms(semy('azure', 'mullet', 'or'), group(charge('rose'), 'argent', { count: 3 }))))).toEqual([]);
    // On a band a charge may be used again: the groups are not on the field.
    expect(messages(nd(arms(semy('azure', 'mullet', 'or'), group(ordinary('fess'), 'argent', { charged: [group(charge('mullet'), 'gules', { count: 3 })] }))))).toEqual([]);
  });


  it('carries one group of charges on a band: the semy or others (App I3)', () => {
    const d = nd(arms('azure', group(ordinary('bordure'), semy('argent', 'mullet', 'sable'), { charged: [group(charge('rose'), 'gules', { count: 8 })] })));
    expect(messages(d).join(' ')).toMatch(/Only one group of charges can sit on the bordure \(SENA App I3\)/);
  });
});


describe('groups', () => {
  it('is the primary group when nothing stands in the middle, and a secondary group when something does', () => {
    expect(strewnGroups(nd(arms(semy('azure', 'mullet', 'or')))).map((s) => s.role)).toEqual(['primary']);
    expect(strewnGroups(nd(arms(semy('azure', 'mullet', 'or'), group(ordinary('chief'), 'argent')))).map((s) => s.role)).toEqual(['primary']);
    expect(strewnGroups(nd(arms(semy('azure', 'mullet', 'or'), lion('argent')))).map((s) => s.role)).toEqual(['secondary']);
    expect(strewnGroups(nd(arms('vert', lion('or'), group(ordinary('bordure'), semy('argent', 'mullet', 'sable'))))).map((s) => [s.role, s.host])).toEqual([['tertiary', [1]]]);
  });


  it('keeps the field from being the primary', () => {
    expect(isFieldPrimary(nd(arms(semy('azure', 'mullet', 'or'))))).toBe(false);
    expect(isFieldPrimary(nd(arms(semy('azure', 'mullet', 'or'), group(ordinary('chief'), 'argent'))))).toBe(false);
    expect(isFieldPrimary(nd(arms('azure', group(ordinary('chief'), 'argent'))))).toBe(true);
  });


  it('states a design with its semys as groups on plain grounds', () => {
    const lifted = liftStrewn(nd(arms(semy('azure', 'mullet', 'or'), lion('argent'))));
    expect(lifted.kind === 'arms' && lifted.field).toEqual({ k: 'tincture', t: 'azure' });
    expect(lifted.groups.map((g) => [g.role, g.item.k === 'charge' ? g.item.charge : '', g.count])).toEqual([['primary', 'lion', 1], ['secondary', 'mullet', STREWN_COUNT]]);
    const onBand = liftStrewn(nd(arms('vert', lion('or'), group(ordinary('bordure'), semy('argent', 'mullet', 'sable')))));
    expect(onBand.groups.at(-1)).toMatchObject({ paint: { k: 'tincture', t: 'argent' }, charged: [{ role: 'tertiary', count: STREWN_COUNT, paint: { k: 'tincture', t: 'sable' } }] });
    const plain = nd(arms('azure', lion('or')));
    expect(liftStrewn(plain)).toBe(plain);
  });


  it('is one group of charges, counterchanged, over a field divided and strewn in each other\'s tinctures', () => {
    const lifted = liftStrewn(nd(arms(pale(semy('azure', 'rose', 'argent'), semy('argent', 'rose', 'azure')))));
    expect(lifted.groups.map((g) => [g.role, g.paint.k])).toEqual([['primary', 'counterchanged']]);
    const alike = liftStrewn(nd(arms(pale(semy('gules', 'mullet', 'argent'), semy('azure', 'mullet', 'argent')))));
    expect(alike.groups.map((g) => [g.role, g.paint.k])).toEqual([['primary', 'tincture']]);
  });
});


describe('conflict', () => {
  it('counts the semy as a group: a different charge is a substantial change when it is the primary (A5E2), a different number too (A5E3)', () => {
    expect(between(arms(semy('argent', 'fleur-de-lis', 'azure')), arms(semy('argent', 'mullet', 'azure')))).toEqual(['type:sc:A5E2']);
    expect(between(arms(semy('argent', 'fleur-de-lis', 'azure')), arms('argent', group(charge('fleur-de-lis'), 'azure')))).toEqual(['number:sc:A5E3']);
    expect(between(arms(semy('argent', 'fleur-de-lis', 'azure')), arms('argent', group(charge('fleur-de-lis'), 'azure', { count: 4, arrangement: 'rows-2-2' })))).toEqual(['number:dc:A5G5']);
  });


  it('counts a semy added to a design with a main picture as one distinct change (A5G2), and its tincture as another (A5G3)', () => {
    expect(between(arms('azure', lion('or')), arms(semy('azure', 'mullet', 'or'), lion('or')))).toEqual(['group-presence:dc:A5G2']);
    expect(between(arms(semy('azure', 'mullet', 'or'), lion('argent')), arms(semy('azure', 'mullet', 'argent'), lion('or')))).toEqual(['tincture:dc:A5G3', 'tincture:dc:A5G3']);
  });


  it('puts a semy field and a plain one with nothing else a substantial change apart: the primary is added (A5E1)', () => {
    expect(between(arms(semy('azure', 'mullet', 'or')), arms('azure', group(ordinary('chief'), 'argent')))).toEqual(['primary-presence:sc:A5E1', 'group-presence:dc:A5G2']);
  });


  it('keys a semy field by its charge', () => {
    expect(candidateKey(nd(arms(semy('azure', 'mullet', 'or'))))).toEqual(candidateKey(nd(arms('azure', group(charge('mullet'), 'or', { count: 3 })))));
    expect(candidateKey(nd(arms(semy('azure', 'mullet', 'or'), lion('argent'))))).toEqual(candidateKey(nd(arms('azure', lion('argent')))));
  });
});


describe('the drawing', () => {
  it('paints the field with a pattern of the ground with the charge strewn on it, the charge\'s drawing in it once', () => {
    const [layer] = renderLayers(nd(arms(semy('azure', 'mullet', 'or'), lion('gules'))), 'heater');
    expect(layer.k === 'field' && layer.fill.k === 'pattern' && layer.fill.spec).toMatchObject({ ground: { k: 'tincture', t: 'azure' }, marks: [{ colour: { k: 'tincture', t: 'or' } }] });
    expect(layer.k === 'field' && fillCode(layer.fill)).toMatch(/^pattern:semy-mullet-/);
    const spec = layer.k === 'field' && layer.fill.k === 'pattern' ? layer.fill.spec : null;
    expect(spec?.marks).toHaveLength(1);
    expect(JSON.stringify(spec).length).toBeLessThan(1500);
  });


  it('paints a semy on a part of the field in that part, and each part of one over all of it', () => {
    const regions = fieldRegions(nd(arms(pale('gules', semy('argent', 'billet', 'gules')))).field, 'heater');
    expect(regions.map((r) => r.paint.k)).toEqual(['tincture', 'semy']);
  });


  it('paints a semy on a band with the same pattern', () => {
    const layers = renderLayers(nd(arms('vert', group(ordinary('bordure'), semy('argent', 'roundel', 'sable')))), 'heater');
    const bordure = layers.find((l) => l.k === 'ordinary');
    expect(bordure?.k === 'ordinary' && fillCode(bordure.fill)).toMatch(/^pattern:semy-roundel-/);
  });


  it('draws a counterchanged element over a semy part as the tincture it is strewn on', () => {
    const d = nd(arms(pale('gules', semy('argent', 'billet', 'gules')), group(ordinary('fess'), 'counterchanged')));
    const fess = renderLayers(d, 'heater').find((l) => l.k === 'ordinary');
    expect(fess?.k === 'ordinary' && fillCode(fess.fill)).toBe('split(ar,gu)');
  });
});


describe('the builder', () => {
  const field = (p: unknown) => nd(arms(p, lion('gules')));
  const target = { k: 'field', part: 0 } as const;


  it('offers every charge on a tincture, strews the one chosen and keeps the tincture, with charges of the other class', () => {
    const d = field('azure');
    expect(semyChoices(d, target).map((c) => c.value)).toEqual(CHARGE_IDS);
    const next = setSemy(d, target, 'mullet');
    expect(next.kind === 'arms' && next.field).toEqual(semyPaint('azure', 'mullet', 'or'));
    expect(semyAt(next, target)).toEqual(semyPaint('azure', 'mullet', 'or'));
  });


  it('blocks a charge that is used again in another group on the field, saying why', () => {
    const d = nd(arms('azure', group(charge('mullet'), 'or', { count: 3 })));
    const blocked = semyChoices(d, target).find((c) => c.value === 'mullet');
    expect(blocked && !blocked.allowed && blocked.reason).toMatch(/A3D1a/);
    expect(semyChoices(d, target).find((c) => c.value === 'rose')?.allowed).toBe(true);
  });


  it('blocks the tinctures that would not stand out, and moves the charges only when they would no longer contrast', () => {
    const d = setSemy(field('azure'), target, 'mullet');
    expect(semyColourChoices(d, target, 1).filter((c) => !c.allowed).map((c) => c.value)).toEqual(['gules', 'azure', 'vert', 'sable', 'purpure']);
    expect(semyAt(setSemyColour(d, target, 0, 'vert'), target)).toMatchObject({ ground: { t: 'vert' }, ink: { t: 'or' } });
    expect(semyAt(setSemyColour(d, target, 0, 'argent'), target)).toMatchObject({ ground: { t: 'argent' }, ink: { t: 'gules' } });
    expect(semyAt(setSemyColour(d, target, 1, 'argent'), target)).toMatchObject({ ground: { t: 'azure' }, ink: { t: 'argent' } });
  });


  it('offers it on a band and a part of the field, but not on a picture', () => {
    const d = nd(arms('vert', lion('or'), group(ordinary('bordure'), 'argent')));
    expect(semyChoices(d, { k: 'group', path: [1] }).length).toBe(CHARGE_IDS.length);
    expect(semyChoices(d, { k: 'group', path: [0] })).toEqual([]);
    expect(setSemy(d, { k: 'group', path: [1] }, 'roundel').groups[1].paint).toMatchObject({ k: 'semy', ground: { t: 'argent' }, charge: { charge: 'roundel' } });
  });


  it('drops the semy when a plain tincture is chosen for the background, or when it is cleared', () => {
    const d = setSemy(field('azure'), target, 'mullet');
    const plain = setFieldTincture(d, 0, 'or');
    expect(plain.kind === 'arms' && plain.field.k).toBe('tincture');
    const cleared = clearSemy(d, target);
    expect(cleared.kind === 'arms' && cleared.field).toEqual({ k: 'tincture', t: 'azure' });
  });
});


describe('the Scatter picker', () => {
  const picker = (d: Design, target: { k: 'field'; part: 0 | 1 } | { k: 'group'; path: number[] }) =>
    renderToString(h(SemyPicker, { design: d, target, group: 'field1', testid: 'field-1', legend: 'Background scatter', onChange: () => {} }));


  it('offers every picture in a menu, with the one blocked by the rule saying why, and the two colours once something is strewn', () => {
    const plain = picker(nd(arms('azure', group(charge('mullet'), 'or', { count: 3 }))), { k: 'field', part: 0 });
    expect(plain).toContain('data-testid="field-1-semy-select"');
    expect(plain).toMatch(/<option value="mullet" disabled title="[^"]*A3D1a[^"]*">Star · mullet \(not here\)<\/option>/);
    expect(plain).toMatch(/<option value="rose">Rose<\/option>/);
    expect(plain).not.toContain('field-1-semy-colour-1');
    const strewn = picker(nd(arms(semy('azure', 'rose', 'argent'))), { k: 'field', part: 0 });
    expect(strewn).toContain('field-1-semy-colour-1');
    expect(strewn).toContain('field-1-semy-colour-2');
    expect(strewn).toContain('Colour of the roses');
  });


  it('is not shown for a picture, which cannot be strewn', () => {
    expect(picker(nd(arms('azure', lion('or'))), { k: 'group', path: [0] })).toBe('');
  });
});


describe('search', () => {
  const found = (d: Design, query: string) => matchesWords(buildSearchText({ displayName: '', blazon: blazon(d), design: d }), queryWords(query));


  it('finds a semy by "semy", "strewn", the name of the semy and what it is strewn with', () => {
    const d = nd(arms(semy('azure', 'cross-crosslet', 'argent'), lion('or')));
    for (const query of ['semy', 'strewn', 'scattered', 'crusilly', 'strewn crosslets', 'blue strewn']) expect(found(d, query), query).toBe(true);
    expect(found(nd(arms('azure', lion('or'))), 'strewn')).toBe(false);
  });
});


describe('the names of a semy in an SCA blazon', () => {
  const normal = (text: string) => normaliseBlazon(text);


  it('reads every name and spelling as "semy of <charges> <tincture>", the tincture left unsaid being the next one stated', () => {
    expect(normal('Azure crusilly Or.')).toBe('azure semy of crosses crosslet or');
    expect(normal('Azure crusily Or, a lion argent.')).toBe('azure semy of crosses crosslet or, a lion argent');
    expect(normal('Argent semy-de-lis azure.')).toBe('argent semy of fleurs-de-lys azure');
    expect(normal('Argent semy-de-lys, a bend sinister azure.')).toBe('argent semy of fleurs-de-lys azure, a bend sinister azure');
    expect(normal('Azure, mulletty Or.')).toBe('azure semy of mullets or');
    expect(normal('Sable bezanty, a fess argent.')).toBe('sable semy of roundels or, a fess argent');
    expect(normal('Gules platy.')).toBe('gules semy of roundels argent');
    expect(normal('Argent goutty de sang, a rose sable.')).toBe('argent semy of gouttes gules, a rose sable');
    expect(normal("Vert goutty d'Or.")).toBe('vert semy of gouttes or');
    expect(normal('Azure estencely argent, a wolf Or.')).toBe('azure semy of sparks argent, a wolf or');
    expect(normal('Gules, a bordure argent semy of torteaux.')).toBe('gules, a bordure argent semy of roundels gules');
    expect(normal('Sable, semy of roses argent, a bend Or.')).toBe('sable semy of roses argent, a bend or');
  });


  it('reads a semy over all of a divided field, strewn alike or in each other\'s tinctures', () => {
    expect(normal('Per pale azure and argent all semy of roses counterchanged.')).toBe('per pale azure and argent all semy of roses counterchanged');
    expect(normal('Per pale gules and Or, all billety counterchanged.')).toBe('per pale gules and or all semy of billets counterchanged');
    expect(normal('Per bend sinister argent and vert mulletty counterchanged.')).toBe('per bend sinister argent and vert all semy of mullets counterchanged');
    expect(normal('Per pale azure and vert all semy of lozenges, a pale Or.')).toBe('per pale azure and vert all semy of lozenges or, a pale or');
    expect(normal("Per bend azure goutty d'Or and gules goutty d'Or.")).toBe('per bend azure and gules all semy of gouttes or');
    expect(normal('Per pale sable and argent semy of swords sable.')).toBe('per pale sable and argent semy of swords sable');
  });
});


describe('reaching it from the matcher', () => {
  const built = (text: string) => {
    expect(explainMatch(text).status, text).toBe('match');
    expect(checkBlazon(text).failures, text).toEqual([]);
  };


  it('builds the records written with a semy', () => {
    built('Azure, semy of hearts argent.');
    built('Argent semy-de-lys sable.');
    built('Azure crusilly argent, a lion Or.');
    built('Argent goutty de sang, a rose sable.');
    built('Argent estencely, a chevron gules.');
    built('Or, three swords sable, a bordure sable bezanty.');
    built('Azure, a lion Or within a bordure Or semy-de-lys azure.');
    built('Vert, an eagle Or and a bordure Or pellety.');
    built('Per pale gules and argent semy of billets gules.');
    built('Per pale azure and argent all semy of roses counterchanged.');
    built('Per pale gules and Or all billety counterchanged.');
    built('Per chevron argent and azure, semy-de-lys counterchanged.');
    built('Per pale azure and vert all semy of lozenges, a pale Or.');
    built('Quarterly sable and gules, all platy.');
  });


  it('takes the tincture of a semy left unsaid from the next one stated, through the field\'s tinctures', () => {
    built('Azure crusilly, a bordure argent.');
    built('Per bend gules billety and argent.');
    built('Argent semy-de-lys, a bend sinister azure.');
    expect(explainMatch('Per bend gules billety and argent.').match?.design?.kind === 'arms' && explainMatch('Per bend gules billety and argent.').match?.design?.field)
      .toMatchObject({ k: 'divided', parts: [{ k: 'semy', ground: { t: 'gules' }, charge: { charge: 'billet' }, ink: { t: 'argent' } }, { k: 'tincture', t: 'argent' }] });
  });


  it('builds a semy on a part of the field, a chief and a chevron', () => {
    built('Per fess azure mullety Or and purpure crusilly Or.');
    built('Purpure mullety, on a chief argent three crescents purpure.');
    built('Or, a chevron azure platy.');
  });


  it('states no tincture for a semy of a name that has one, and proposes none for a semy on a picture or of an unknown charge', () => {
    expect(explainMatch('Gules, a heart argent goutty de sang.').status).toBe('unsupported');
    expect(explainMatch('Or semy of leeches sable.').status).toBe('vocabulary');
  });
});
