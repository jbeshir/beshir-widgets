// Furs: ermine, vair and potent and their kin on the field, on a part of it, and on bands and pictures — what is drawn,
// how it is blazoned and judged, how the builder offers it, and that the SCA records it unlocks are built.

import { describe, expect, it } from 'vitest';
import {
  ERMINE_SPOT, FURS, FUR_KINDS, blazon, canonicalJson, deriveTags, differences, fillCode, furChoices, furColourChoices, gloss, normalise, renderLayers, setFur, setFurColour,
  addLayer, layerChoices, pathOfPlace, groupAt, signature, structuralIssues, tinctureIssues, unsupportedIssues, furPattern, type Design, type FurPaint, type FurTarget, fieldSurfaces, sameSurface, surfaceOf,
} from '../src/lib/heraldry';
import { builderPath } from './builder-path';
import { checkBlazon } from './sca/classify';
import { explainMatch } from './sca/match';
import { renderShieldSvg } from './sca/widget-checks';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const fur = (name: string, colours: [string, string] | null = null) => ({ k: 'fur', fur: name, colours });
const lion = (paint: unknown, extra: object = {}) => group(charge('lion'), paint, extra);
const messages = (d: Design) => [...structuralIssues(d), ...tinctureIssues(d)].map((i) => i.message);
const FIELD_0: FurTarget = { k: 'field', part: 0 };

describe('the canonical spelling of a fur', () => {
  const canon = (p: unknown) => (nd(arms(p, lion('gules'))).field as FurPaint);

  it('folds the ermine family into the named furs', () => {
    expect(canon(fur('ermine', ['argent', 'sable']))).toEqual(fur('ermine'));
    expect(canon(fur('ermine', ['or', 'sable']))).toEqual(fur('erminois'));
    expect(canon(fur('ermine', ['sable', 'argent']))).toEqual(fur('counter-ermine'));
    expect(canon(fur('pean', ['argent', 'gules']))).toEqual(fur('ermine', ['argent', 'gules']));
    expect(canon(fur('erminois', ['sable', 'or']))).toEqual(fur('pean'));
  });

  it('drops the usual argent and azure of vair and potent, and puts potent in order', () => {
    expect(canon(fur('vair', ['argent', 'azure']))).toEqual(fur('vair'));
    expect(canon(fur('vair', ['azure', 'argent']))).toEqual(fur('vair', ['azure', 'argent']));
    expect(canon(fur('potent', ['azure', 'argent']))).toEqual(fur('potent'));
    expect(canon(fur('potent', ['gules', 'or']))).toEqual(fur('potent', ['or', 'gules']));
  });
});

describe('what is supported', () => {
  it('draws every fur on the field, on a part of it, and on a band or picture', () => {
    for (const name of FURS) {
      expect(unsupportedIssues(nd(arms(fur(name), lion('gules'))))).toEqual([]);
      expect(unsupportedIssues(nd(arms({ k: 'divided', division: 'per-fess', parts: [fur(name), 'gules'] }, lion('or'))))).toEqual([]);
      expect(unsupportedIssues(nd(arms('or', lion(fur(name)))))).toEqual([]);
      expect(unsupportedIssues(nd(arms('azure', group(ordinary('fess'), fur(name)))))).toEqual([]);
    }
    expect(unsupportedIssues(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'gules'] }, lion('or'))))).toEqual([]);
  });

  it('leaves colours of their own on a counter or en pointe fur, and a fur on a split picture, as gaps', () => {
    const gaps = (d: unknown) => unsupportedIssues(nd(d)).map((i) => `${i.gap.category}:${i.gap.detail}`);
    expect(gaps(arms(fur('counter-vair', ['or', 'gules']), lion('sable')))).toEqual(['fur:counter-vair-colours']);
    expect(gaps(arms('gules', lion({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'or'] })))).toEqual(['fur:party']);
  });
});

describe('the design text', () => {
  it('blazons each fur as the College writes it', () => {
    const words: Array<[unknown, string]> = [
      [fur('ermine'), 'Ermine, a lion gules.'],
      [fur('erminois'), 'Erminois, a lion gules.'],
      [fur('counter-ermine'), 'Counter-ermine, a lion gules.'],
      [fur('pean'), 'Pean, a lion gules.'],
      [fur('ermine', ['vert', 'argent']), 'Vert ermined argent, a lion gules.'],
      [fur('vair'), 'Vair, a lion gules.'],
      [fur('vair', ['or', 'gules']), 'Vairy Or and gules, a lion gules.'],
      [fur('counter-vair'), 'Counter-vair, a lion gules.'],
      [fur('vair-en-pointe'), 'Vair en pointe, a lion gules.'],
      [fur('potent'), 'Potent, a lion gules.'],
      [fur('potent', ['or', 'sable']), 'Potenty Or and sable, a lion gules.'],
      [fur('counter-potent'), 'Counter-potent, a lion gules.'],
      [fur('potent-en-pointe'), 'Potent en pointe, a lion gules.'],
    ];
    for (const [paint, text] of words) expect(blazon(nd(arms(paint, lion('gules')))), text).toBe(text);
  });

  it('blazons a fur on a part of the field, a band and a picture', () => {
    expect(blazon(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'gules'] }, lion('or'))))).toBe('Per pale ermine and gules, a lion Or.');
    expect(blazon(nd(arms('gules', group(ordinary('fess'), fur('erminois')))))).toBe('Gules, a fess erminois.');
    expect(blazon(nd(arms('gules', lion(fur('ermine')))))).toBe('Gules, a lion ermine.');
  });

  it('glosses a fur in plain words', () => {
    expect(gloss(nd(arms(fur('ermine'), lion('gules'))))).toMatch(/^A shield covered in ermine \(white with black spots\), with a red lion/);
    expect(gloss(nd(arms('azure', lion(fur('vair')))))).toMatch(/^A blue shield with a vair \(rows of white and blue bells\) lion/);
  });

  it('is told apart in the signature, the tags and the differences', () => {
    const [a, b, c] = [nd(arms(fur('ermine'), lion('gules'))), nd(arms(fur('erminois'), lion('gules'))), nd(arms(fur('ermine', ['argent', 'gules']), lion('sable')))];
    expect(new Set([signature(a), signature(b), signature(c)]).size).toBe(3);
    expect(deriveTags(a)).toEqual(expect.arrayContaining(['fur:ermine', 'field-tincture:argent', 'field-tincture:sable', 'tincture:argent', 'tincture:sable']));
    expect(differences(a, b).map((x) => `${x.attr}:${x.kind}`)).toEqual(['field-tincture:dc']);
    expect(differences(a, a)).toEqual([]);
  });

  it('counts every layout of vair and potent as one kind (D10) but a change of colours as a change', () => {
    const [vair, counter, pointe, potent] = ['vair', 'counter-vair', 'vair-en-pointe', 'potent'].map((f) => nd(arms(fur(f), lion('gules'))));
    expect(differences(vair, counter)).toEqual([]);
    expect(differences(vair, pointe)).toEqual([]);
    expect(differences(vair, potent)).toEqual([]);
    expect(differences(vair, nd(arms(fur('vair', ['or', 'azure']), lion('gules')))).map((x) => x.attr)).toEqual(['field-tincture']);
  });
});

describe('the surface of a fur', () => {
  const surface = (p: unknown) => surfaceOf(nd(arms(p, lion('gules'))).field);

  it('is the class of the ground for the ermine family and neutral for vair and potent (RB §1.1)', () => {
    expect(surface(fur('ermine'))).toMatchObject({ cls: 'metal', bases: ['argent', 'sable'] });
    expect(surface(fur('erminois'))).toMatchObject({ cls: 'metal', bases: ['or', 'sable'] });
    expect(surface(fur('counter-ermine'))).toMatchObject({ cls: 'colour', bases: ['sable', 'argent'] });
    expect(surface(fur('pean'))).toMatchObject({ cls: 'colour', bases: ['sable', 'or'] });
    expect(surface(fur('ermine', ['vert', 'argent']))).toMatchObject({ cls: 'colour', bases: ['vert', 'argent'] });
    expect(surface(fur('vair'))).toMatchObject({ cls: 'neutral', bases: ['argent', 'azure'] });
    expect(surface(fur('potent', ['gules', 'or']))).toMatchObject({ cls: 'neutral', bases: ['or', 'gules'] });
  });

  it('is one object per surface, and the same for every layout of the family', () => {
    expect(surface(fur('vair'))).toBe(surface(fur('potent')));
    expect(sameSurface(surface(fur('vair')), surface(fur('counter-vair')))).toBe(true);
    expect(sameSurface(surface(fur('ermine')), surface(fur('erminois')))).toBe(false);
    expect(fieldSurfaces(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'gules'] }, lion('or'))))).toHaveLength(2);
  });
});

describe('the rule of tincture for furs', () => {
  it('judges an ermine-family fur by its class, the ground it is seen against (RULES A.10)', () => {
    expect(messages(nd(arms(fur('ermine'), lion('gules'))))).toEqual([]);
    // A metal and a colour contrast whatever they are made of: the College registers "Sable, a lion sejant ermine" (O&A 43441),
    // "Counter-ermine, a dragon segreant ermine" (82207) and "Ermine, a bend sinister sable" (27061).
    expect(messages(nd(arms(fur('ermine'), lion('sable'))))).toEqual([]);
    expect(messages(nd(arms(fur('ermine'), lion(fur('counter-ermine')))))).toEqual([]);
    expect(messages(nd(arms('sable', lion(fur('ermine')))))).toEqual([]);
    expect(messages(nd(arms(fur('ermine'), lion('argent'))))).toEqual(['Argent lion on Ermine field: same tincture']);
    expect(messages(nd(arms(fur('ermine'), lion('or'))))).toEqual(['Or lion on Ermine field: metal on metal']);
    expect(messages(nd(arms(fur('counter-ermine'), lion('azure'))))).toEqual(['Azure lion on Counter-ermine field: colour on colour']);
  });

  it('judges a neutral fur against metals and colours alike, as long as no tincture is shared', () => {
    expect(messages(nd(arms(fur('vair'), lion('gules'))))).toEqual([]);
    expect(messages(nd(arms(fur('vair'), lion('or'))))).toEqual([]);
    expect(messages(nd(arms(fur('vair'), lion('azure'))))).toEqual(['Azure lion on Vair field: same tincture']);
    expect(messages(nd(arms('gules', lion(fur('potent')))))).toEqual([]);
    expect(messages(nd(arms('azure', lion(fur('vair')))))).toEqual(['Vair lion on Azure field: same tincture']);
    // A neutral fur may not share a tincture with what it lies on, even where the classes differ (A3B4b).
    expect(messages(nd(arms(fur('ermine'), lion(fur('vair')))))).toEqual(['Vair lion on Ermine field: same tincture']);
  });

  it('judges a fur charge by its class and the tinctures it shares', () => {
    expect(messages(nd(arms('gules', lion(fur('ermine')))))).toEqual([]);
    expect(messages(nd(arms('argent', lion(fur('ermine')))))).toEqual(['Ermine lion on Argent field: same tincture']);
    expect(messages(nd(arms('or', lion(fur('ermine')))))).toEqual(['Ermine lion on Or field: metal on metal']);
  });

  it('judges a band on a fur and on a part of it', () => {
    expect(messages(nd(arms(fur('ermine'), group(ordinary('fess'), 'gules'))))).toEqual([]);
    expect(messages(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'gules'] }, group(ordinary('chief'), 'azure'))))).toEqual([]);
    expect(messages(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'gules'] }, group(ordinary('chief'), 'sable'))))).toEqual([]);
    expect(messages(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'gules'] }, group(ordinary('chief'), 'argent'))))).toEqual(['Argent chief lies on the Ermine part of the field: same tincture']);
  });

  it('keeps the parts of a divided field from sharing a tincture, and a fur in colours of its own to a metal and a colour', () => {
    expect(messages(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'argent'] }, lion('gules')))))
      .toEqual(["A divided field's parts can't share a tincture — Ermine and Argent both use Argent."]);
    expect(messages(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('ermine'), 'gules'] }, lion('or'))))).toEqual([]);
    // Only the ground counts for the ermine family: its spots are small (Prec #FUR), so these are registered.
    expect(messages(nd(arms({ k: 'divided', division: 'per-fess', parts: [fur('ermine'), 'sable'] }, lion('gules'))))).toEqual([]);
    expect(messages(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('pean'), fur('erminois')] }, group(ordinary('bordure'), 'gules'))))).toEqual([]);
    expect(messages(nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('vair'), 'azure'] }, lion('gules'))))).toEqual(["A divided field's parts can't share a tincture — Vair and Azure both use Azure."]);
    expect(messages(nd(arms(fur('vair', ['gules', 'azure']), lion('or'))))).toEqual(['Vairy gules and azure needs a metal and a colour — both are colours.']);
    expect(messages(nd(arms('azure', lion(fur('ermine', ['or', 'argent'])))))).toEqual(['Or ermined argent needs a metal and a colour — both are metals.']);
  });

  it('calls a fur alone on the shield too generic to register', () => {
    expect(structuralIssues(nd(arms(fur('ermine')))).map((i) => i.code)).toEqual(['generic']);
    expect(structuralIssues(nd(arms(fur('ermine'), lion('gules')))).map((i) => i.code)).toEqual([]);
  });
});

describe('what is drawn', () => {
  it('fills a fur field with a pattern named for the fur, and draws it in the markup', () => {
    const d = nd(arms(fur('ermine'), lion('gules')));
    const [field] = renderLayers(d, 'heater');
    expect(field.k === 'field' && fillCode(field.fill)).toMatch(/^pattern:ermine-ar-sa-500$/);
    const svg = renderShieldSvg(d);
    expect(svg).toContain('<pattern');
    expect(svg).toContain('data-paint="pattern:ermine-ar-sa-500"');
  });

  it('draws a divided field with a fur part: the pattern within its region, the tincture within the other', () => {
    const d = nd(arms({ k: 'divided', division: 'per-pale', parts: [fur('vair'), 'gules'] }, lion('or')));
    const [field] = renderLayers(d, 'heater');
    expect(field.k === 'field' && fillCode(field.fill)).toBe('split(pattern:vair-ar-az-500,gu)');
  });

  it('scales the motifs on a charge to the charge', () => {
    const d = nd(arms('azure', lion(fur('ermine')), group(charge('rose'), 'gules', { count: 3, arrangement: 'in-chief' })));
    const layer = renderLayers(d, 'heater').find((l) => l.k === 'charges');
    expect(layer && fillCode(layer.fills[0].fill)).toMatch(/^pattern:ermine-ar-sa-\d+$/);
    expect(layer && fillCode(layer.fills[0].fill)).not.toBe('pattern:ermine-ar-sa-500');
  });

  it('keeps each fur pattern small: under a kilobyte, with the ermine spot under 300 bytes', () => {
    expect(ERMINE_SPOT.length).toBeLessThan(300);
    for (const name of FURS) {
      const spec = furPattern({ k: 'fur', fur: name, colours: null }, 0.5);
      expect(JSON.stringify(spec).length, name).toBeLessThan(1000);
    }
  });

  it('names every pattern by its fur, colours and scale', () => {
    const ids = new Set(FURS.map((name) => furPattern({ k: 'fur', fur: name, colours: null }, 0.5).id));
    expect(ids.size).toBe(FURS.length);
    expect(furPattern({ k: 'fur', fur: 'vair', colours: ['or', 'gules'] }, 0.35).id).toBe('vair-or-gu-350');
  });
});

describe('the builder', () => {
  it('offers every fur on the background and blocks one that would share a tincture with the other part', () => {
    const d = nd(arms({ k: 'divided', division: 'per-pale', parts: ['argent', 'gules'] }, lion('or')));
    const choices = furChoices(d, { k: 'field', part: 1 });
    expect(choices.map((c) => c.value)).toEqual(FUR_KINDS);
    expect(choices.find((c) => c.value === 'ermine')).toMatchObject({ allowed: false });
    expect(choices.find((c) => c.value === 'pean')).toMatchObject({ allowed: true });
    expect(choices.find((c) => c.value === 'vairy')).toMatchObject({ allowed: true });
  });

  it('blocks a fur that would make the picture on it clash, with the rule of tincture saying why', () => {
    const d = nd(arms('azure', lion('gules')));
    const choices = furChoices(d, { k: 'group', path: [0] });
    expect(choices.find((c) => c.value === 'vair')).toMatchObject({ allowed: false, reason: 'Vair lion on Azure field: same tincture' });
    expect(choices.find((c) => c.value === 'ermine')).toMatchObject({ allowed: true });
  });

  it('sets a fur, then its colours, moving the other colour only when it must', () => {
    const d = nd(arms('azure', lion('gules')));
    const ermine = setFur(d, FIELD_0, 'ermine');
    expect(canonicalJson(ermine)).toBe(canonicalJson(nd(arms(fur('ermine'), lion('gules')))));
    const green = setFurColour(ermine, FIELD_0, 0, 'vert');
    // Sable spots would be colour on colour with the new ground: the spots become the first metal.
    expect(green).toMatchObject({ field: fur('ermine', ['vert', 'or']) });
    expect(setFurColour(ermine, FIELD_0, 1, 'sable')).toEqual(ermine);
    expect(furColourChoices(nd(arms(fur('counter-vair'), lion('gules'))), FIELD_0, 0)).toEqual([]);
  });

  it('builds a fur field, a fur on a part, a fur band and a fur picture from the starting design by allowed clicks', () => {
    const designs = [
      arms(fur('ermine'), lion('gules')),
      arms(fur('ermine', ['vert', 'argent']), lion('or')),
      arms(fur('potent', ['or', 'gules']), group(ordinary('fess'), 'sable')),
      arms({ k: 'divided', division: 'per-pale', parts: [fur('vair'), 'gules'] }, lion('or')),
      arms({ k: 'divided', division: 'per-fess', parts: ['argent', fur('pean')] }, lion('gules')),
      arms('gules', group(ordinary('fess'), fur('erminois'))),
      arms('gules', lion(fur('counter-vair'))),
    ];
    for (const input of designs) {
      const goal = nd(input);
      const path = builderPath(goal);
      expect(path.problems, blazon(goal)).toEqual([]);
      expect(canonicalJson(path.design)).toBe(canonicalJson(goal));
    }
  });
});

describe('the SCA armory', () => {
  it('reads a fur in any of its spellings as the one design', () => {
    const same = (a: string, b: string) => expect(canonicalJson(explainMatch(a).match!.design!)).toBe(canonicalJson(explainMatch(b).match!.design!));
    same('Ermine, a lion gules.', 'Argent ermined sable, a lion gules.');
    same('Counter-ermine, a lion Or.', 'Ermines, a lion Or.');
    same('Vair, a lion gules.', 'Vairy argent and azure, a lion gules.');
    same('Potent, a lion gules.', 'Potenty azure and argent, a lion gules.');
    same('Per pale ermine and gules, a lion Or.', 'Per pale argent ermined sable and gules, a lion Or.');
  });

  it('matches and builds records with furs on the field, a part of it, a band and a picture', () => {
    for (const text of [
      'Ermine, a lion gules.',
      'Erminois, a lion gules.',
      'Vert ermined argent, a lion Or.',
      'Vairy Or and gules, a lion sable.',
      'Per pale ermine and gules, a lion Or.',
      'Gules, a fess ermine.',
      'Gules, a lion erminois.',
      'Gules, three roses Or and a chief ermine.',
    ]) {
      const { failures } = checkBlazon(text);
      expect(failures, text).toEqual([]);
    }
  });
});

describe('pictures around the picture on a field of metal and colour alike', () => {
  // On quarterly gules and ermine no tincture works for three, two and one; two set another way do (O&A 37557).
  it('starts with two, set the way that works', () => {
    const d = nd(arms({ k: 'divided', division: 'quarterly', parts: ['gules', fur('ermine')] }, lion('sable')));
    expect(layerChoices(d).find((c) => c.value === 'around')).toMatchObject({ allowed: true });
    const added = addLayer(d, 'around');
    expect(groupAt(added, pathOfPlace(added, 'around')!).count).toBe(2);
    expect(messages(added)).toEqual([]);
  });
});
