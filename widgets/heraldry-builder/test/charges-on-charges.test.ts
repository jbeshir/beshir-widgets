// Charges on the primary charges ("on a heart argent a lion azure", "a unicorn argent charged with a fleur-de-lys",
// "three flames each charged with a heart"): the model, wording, layout, rule of tincture, structure and the builder.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, ON_CHARGE_COUNTS, addLayer, blazon, canonicalJson, chargeOnBox, contextSlots, deriveTags, drawnBox, gloss, groupSlots, hasRoom, isForced,
  layerChoices, layoutCandidates, layoutContext, layoutKey, layoutWords, normalise, pathOfPlace, pointInPolygon, removeLayer, setLayerCharge, statesLayout,
  structuralIssues, tableDefault, tinctureIssues, unsupportedIssues, CHARGES, CHARGE_ART,
  type Design,
} from '../src/lib/heraldry';
import { assess, setCharge, setModifier, setPosture } from '../src/lib/builder';
import { builderPath } from './builder-path';
import { rings } from './art-geometry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const DEFAULT = nd(arms('azure'));
const tertiary = (id: string, paint: string, extra: object = {}) => group(charge(id), paint, extra);
const on = (host: string, hostPaint: string, carried: object, extra: object = {}, attrs: object = {}) => group(charge(host, attrs), hostPaint, { charged: [carried], ...extra });

describe('charges on the primary charges: wording', () => {
  it('words one charge on an object or a plant "on …", and one on a beast "charged with"', () => {
    expect(blazon(nd(arms('azure', on('heart', 'argent', tertiary('lion', 'azure')))))).toBe('Azure, on a heart argent a lion azure.');
    expect(blazon(nd(arms('purpure', on('unicorn', 'argent', tertiary('fleur-de-lis', 'purpure')))))).toBe('Purpure, a unicorn argent charged with a fleur-de-lys purpure.');
    expect(blazon(nd(arms('gules', on('eagle', 'or', tertiary('mullet', 'gules')))))).toBe('Gules, an eagle Or charged with a mullet gules.');
  });

  it('words several hosts "each charged with"', () => {
    expect(blazon(nd(arms('vert', on('flame', 'argent', tertiary('heart', 'azure'), { count: 3 }))))).toBe('Vert, three flames argent each charged with a heart azure.');
  });

  it('states the layout of several charges on a host, which Table 7 leaves to the blazon', () => {
    const sun = nd(arms('or', on('sun', 'gules', tertiary('mullet', 'or', { count: 3, arrangement: 'rows-1-2' }))));
    expect(blazon(sun)).toBe('Or, on a sun gules three mullets one and two Or.');
    expect(blazon(sun, { stateDefaults: true })).toBe('Or, on a sun gules three mullets one and two Or.');
    expect(blazon(nd(arms('or', on('sun', 'gules', tertiary('mullet', 'or', { count: 2, arrangement: 'in-pale' })))))).toBe('Or, on a sun gules in pale two mullets Or.');
    expect(blazon(nd(arms('or', on('sun', 'gules', tertiary('mullet', 'or')))), { stateDefaults: true })).toBe('Or, on a sun gules a mullet Or.');
  });

  it('puts the charges on the picture before a chief, a bordure and the charges in base', () => {
    const d = nd(arms('azure', on('heart', 'argent', tertiary('lion', 'azure')), group(charge('mullet'), 'or', { count: 2, position: 'base' }), group(ordinary('bordure'), 'or')));
    expect(blazon(d)).toBe('Azure, on a heart argent a lion azure and in base two mullets and a bordure Or.');
  });

  it('glosses the charges on a picture in plain words', () => {
    expect(gloss(nd(arms('azure', on('heart', 'argent', tertiary('lion', 'azure')))))).toBe('A blue shield with a white heart, carrying a blue lion rearing up.');
    expect(gloss(nd(arms('vert', on('flame', 'argent', tertiary('heart', 'azure'), { count: 3 }))))).toMatch(/each carrying a blue heart\.$/);
  });

  it('tags and labels the group', () => {
    expect(deriveTags(nd(arms('azure', on('heart', 'argent', tertiary('lion', 'azure')))))).toContain('placement:on-charge');
  });
});

describe('charges on the primary charges: layout', () => {
  const sunOf = (count: number, arrangement?: string) => nd(arms('or', on('sun', 'gules', tertiary('mullet', 'or', { count, ...(arrangement ? { arrangement } : {}) }))));

  it('has Table 7 layouts for one to four charges, the first of them the default, and none beyond', () => {
    expect(ON_CHARGE_COUNTS).toEqual([1, 2, 3, 4]);
    const keys = (count: number) => layoutCandidates(sunOf(1), [0, 0], count).map(layoutKey);
    expect(keys(1)).toEqual(['single']);
    expect(keys(2)).toEqual(['in-fess', 'in-pale']);
    expect(keys(3)).toEqual(['rows-2-1', 'rows-1-2', 'in-fess', 'in-pale']);
    expect(keys(4)).toEqual(['rows-2-2', 'in-cross']);
    expect(keys(5)).toEqual([]);
  });

  it('leaves every layout but the single charge to be stated, and does not force any', () => {
    const d = sunOf(3, 'rows-2-1');
    expect(tableDefault(d, [0, 0])).toBeNull();
    expect(statesLayout(d, [0, 0])).toBe(true);
    expect(statesLayout(sunOf(1), [0, 0])).toBe(false);
    expect(isForced(d, [0, 0])).toBe(false);
    expect(layoutContext(d, [0, 0]).k).toBe('on-charge');
  });

  it('puts the charges on every host in its drawing’s on-box, all at one size', () => {
    const d = nd(arms('vert', on('flame', 'argent', tertiary('heart', 'azure'), { count: 3 })));
    for (const shape of FIELD_SHAPES) {
      const hosts = groupSlots(d, [0], shape).map((s) => drawnBox(s, 'flame'));
      const slots = groupSlots(d, [0, 0], shape);
      expect(slots, shape).toHaveLength(3);
      expect(new Set(slots.map((s) => s.size)).size, shape).toBe(1);
      const art = chargeOnBox('flame', null)!;
      slots.forEach((s, i) => {
        const room = hosts.find((h) => {
          const x0 = h.x + ((art.x - 50) * h.size) / 100, y0 = h.y + ((art.y - 50) * h.size) / 100;
          const x1 = x0 + (art.w * h.size) / 100, y1 = y0 + (art.h * h.size) / 100;
          return s.x - s.size / 2 >= x0 - 0.01 && s.x + s.size / 2 <= x1 + 0.01 && s.y - s.size / 2 >= y0 - 0.01 && s.y + s.size / 2 <= y1 + 0.01;
        });
        expect(room, `${shape} slot ${i}`).toBeDefined();
      });
    }
  });

  it('draws every charge on its host’s drawing, in every shape', () => {
    for (const host of ['lion', 'heart', 'sun', 'rose', 'fish'] as const) {
      const d = nd(arms('azure', on(host, 'or', tertiary('mullet', 'gules', { count: 2, arrangement: 'in-fess' }))));
      for (const shape of FIELD_SHAPES) {
        const [hostSlot] = groupSlots(d, [0], shape);
        const drawing = rings(CHARGE_ART[host][CHARGES[host].defaultPosture ?? '_']!);
        const box = drawnBox(hostSlot, host);
        const at = (x: number, y: number) => [box.x + ((x - 50) * box.size) / 100, box.y + ((y - 50) * box.size) / 100] as const;
        const placed = drawing.map((r) => r.map(([x, y]) => at(x, y) as unknown as [number, number]));
        for (const s of groupSlots(d, [0, 0], shape)) {
          const inside = placed.filter((r) => pointInPolygon(s.x, s.y, r)).length % 2 === 1;
          expect(inside, `${host} ${shape}`).toBe(true);
        }
      }
    }
  });

  it('has no room for charges on many small hosts, and says so', () => {
    const d = nd(arms('azure', on('lion', 'or', tertiary('mullet', 'gules'), { count: 8 })));
    expect(hasRoom(d, [0, 0])).toBe(false);
    expect(structuralIssues(d).map((i) => i.message)).toEqual(["Mullets can't be set on each of the lions like this."]);
    const three = nd(arms('azure', on('lion', 'or', tertiary('mullet', 'gules', { count: 3, arrangement: 'in-fess' }))));
    expect(structuralIssues(three).map((i) => i.message)).toEqual(["There isn't room for three mullets on the lion — at most 1 fit."]);
  });

  it('names the layouts a count takes when another is asked for', () => {
    const d = nd(arms('azure', on('sun', 'or', tertiary('mullet', 'gules', { count: 2, arrangement: 'in-bend' }))));
    expect(structuralIssues(d).map((i) => i.message)).toEqual(['Two mullets on the sun can be set in fess or in pale in this builder — not in bend.']);
    expect(layoutWords({ arrangement: { k: 'rows', rows: [1, 2] }, position: null })).toBe('one and two');
  });

  it('shares slots between the hosts: contextSlots gives count × hosts', () => {
    const d = nd(arms('vert', on('flame', 'argent', tertiary('heart', 'azure', { count: 2, arrangement: 'in-fess' }), { count: 2 })));
    const ctx = layoutContext(d, [0, 0]);
    expect(contextSlots(ctx, 2, { arrangement: { k: 'line', dir: 'fess' }, position: null }, 'heater')).toHaveLength(4);
  });
});

describe('charges on the primary charges: support', () => {
  const gaps = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);

  it('draws charges on a primary charge in any count Table 7 has a layout for', () => {
    for (const count of [1, 2, 3, 4]) expect(gaps(nd(arms('azure', on('sun', 'or', tertiary('mullet', 'gules', { count }))))), String(count)).toEqual([]);
  });

  it('files the rest under precise gaps', () => {
    expect(gaps(nd(arms('azure', on('sun', 'or', tertiary('mullet', 'gules', { count: 5 })))))).toEqual(['placement:on-charge-5']);
    expect(gaps(nd(arms('azure', on('key', 'or', tertiary('mullet', 'gules')))))).toEqual(['placement:on-key']);
    expect(gaps(nd(arms('azure', on('sun', 'or', tertiary('mullet', 'gules'), {}, { mods: ['in-splendour'] }))))).toEqual(['multiple-groups:tertiary-on-modifier']);
    expect(gaps(nd(arms('azure', group(ordinary('bend'), 'or'), on('mullet', 'argent', tertiary('rose', 'gules'), { count: 2 }))))).toEqual(['multiple-groups:tertiary-on-secondary']);
    expect(gaps(nd(arms('azure', on('lion', 'or', tertiary('rose', 'gules')), group(charge('mullet'), 'argent', { count: 3, relation: 'between' }))))).toEqual(['multiple-groups:tertiary-on-charge-around']);
  });

  it('does not allow charges on the charges on a charge (SENA App I3)', () => {
    const d = nd(arms('azure', on('sun', 'or', group(charge('heart'), 'gules', { charged: [tertiary('mullet', 'argent')] }))));
    expect(structuralIssues(d).map((i) => i.message)).toEqual(["Charges can't sit on charges that are already on something (SENA App I3)."]);
  });

  it('allows a charge to be charged with a charge of its own type (SENA A3D1a)', () => {
    expect(structuralIssues(nd(arms('azure', on('mullet', 'or', tertiary('mullet', 'gules')))))).toEqual([]);
  });
});

describe('charges on the primary charges: the rule of tincture', () => {
  const tinctured = (hostPaint: string, paint: string, field = 'azure') => nd(arms(field, on('heart', hostPaint, tertiary('lion', paint))));

  it('judges the charges against the charge they are on, not the field', () => {
    expect(tinctureIssues(tinctured('argent', 'azure'))).toEqual([]);
    // The heart fails against the field; the lion, on the heart, does not.
    expect(tinctureIssues(tinctured('argent', 'azure', 'argent')).map((i) => i.message)).toEqual(['Argent heart on Argent field: same tincture']);
  });

  it('fails a metal on a metal host and a colour on a colour host', () => {
    expect(tinctureIssues(tinctured('argent', 'or')).map((i) => i.message)).toEqual(['Or lion on the Argent heart: metal on metal']);
    expect(tinctureIssues(tinctured('gules', 'azure', 'argent')).map((i) => i.message)).toEqual(['Azure lion on the Gules heart: colour on colour']);
  });

  it('keeps the field’s other tincture out of it: the charge may match the field', () => {
    expect(assess(tinctured('argent', 'azure', 'azure')).status).toBe('valid');
  });

  it('blocks counterchanged on a host, which lies on a charge and not on the field', () => {
    const cc = nd(arms(div('per-pale', 'argent', 'sable'), on('sun', 'counterchanged', tertiary('mullet', 'counterchanged'))));
    expect(tinctureIssues(cc).map((i) => i.reason)).toEqual(['counterchange-unavailable']);
  });
});

describe('charges on the primary charges: the builder', () => {
  const lion = nd(arms('azure', group(charge('lion'), 'or')));
  const heart = nd(arms('azure', group(charge('heart'), 'argent')));

  it('offers pictures on the picture once there is a picture on the background, with a colour that works', () => {
    const blocked = layerChoices(nd(arms('azure', group(ordinary('fess'), 'or'))));
    expect(blocked.find((c) => c.value === 'on-picture')).toMatchObject({ allowed: false });
    const choice = layerChoices(heart).find((c) => c.value === 'on-picture');
    expect(choice).toEqual({ value: 'on-picture', allowed: true });
    const added = addLayer(heart, 'on-picture');
    expect(blazon(added)).toBe('Azure, on a heart argent a mullet gules.');
    expect(assess(added).status).toBe('valid');
    expect(pathOfPlace(added, 'on-picture')).toEqual([0, 0]);
  });

  it('says why charges cannot go on a picture', () => {
    const key = setCharge(DEFAULT, 'picture', 'key');
    expect(layerChoices(key).find((c) => c.value === 'on-picture')).toMatchObject({ allowed: false, reason: expect.stringMatching(/key/) });
    expect(layerChoices(DEFAULT).find((c) => c.value === 'on-picture')).toMatchObject({ allowed: false });
    const around = addLayer(lion, 'around');
    expect(layerChoices(around).find((c) => c.value === 'on-picture')).toMatchObject({ allowed: false, reason: expect.stringMatching(/around/) });
    expect(layerChoices(addLayer(lion, 'on-picture')).find((c) => c.value === 'around')).toMatchObject({ allowed: false });
  });

  it('swaps the pictures on the picture, removes them, and moves them with the picture', () => {
    const added = addLayer(heart, 'on-picture');
    expect(blazon(setLayerCharge(added, 'on-picture', 'rose'))).toBe('Azure, on a heart argent a rose gules.');
    expect(removeLayer(added, 'on-picture')).toEqual(heart);
    expect(blazon(setCharge(added, 'picture', 'lion'))).toBe('Azure, a lion argent charged with a mullet gules.');
    expect(blazon(setCharge(added, 'picture', 'sun'))).toMatch(/^Azure, on a sun/);
  });

  it('drops them when the new picture has no room for them, or is drawn in splendour', () => {
    const added = addLayer(heart, 'on-picture');
    expect(pathOfPlace(setCharge(added, 'picture', 'key'), 'on-picture')).toBeNull();
    const sun = setCharge(added, 'picture', 'sun');
    expect(pathOfPlace(sun, 'on-picture')).not.toBeNull();
    expect(pathOfPlace(setModifier(sun, [0], 'in-splendour', true), 'on-picture')).toBeNull();
  });

  it('refits them to the room the picture’s posture leaves', () => {
    const three = nd(arms('azure', on('lion', 'or', tertiary('mullet', 'argent', { count: 2, arrangement: 'in-pale' }), {}, { posture: 'rampant' })));
    expect(structuralIssues(three)).toEqual([]);
    const moved = setPosture(three, [0], 'passant');
    expect(structuralIssues(moved)).toEqual([]);
  });

  it('is built by clicks the builder allows: the corpus examples', () => {
    for (const [label, input] of [
      ['7862', arms('azure', on('heart', 'argent', tertiary('lion', 'azure')))],
      ['122365', arms('or', on('sun', 'gules', tertiary('mullet', 'or', { count: 3, arrangement: 'rows-2-1' })))],
      ['5904', arms('purpure', on('unicorn', 'argent', tertiary('fleur-de-lis', 'purpure')))],
      ['2045', arms('vert', on('flame', 'argent', tertiary('heart', 'azure'), { count: 3 }))],
      ['two on a lion in pale', arms('gules', on('lion', 'or', tertiary('crescent', 'azure', { count: 2, arrangement: 'in-pale' })))],
      ['a chief beside', arms('azure', on('heart', 'argent', tertiary('lion', 'azure')), group(ordinary('chief'), 'or'))],
      ['a bordure beside', arms('gules', on('sun', 'or', tertiary('rose', 'gules', { count: 3, arrangement: 'rows-1-2' })), group(ordinary('bordure'), 'argent'))],
    ] as const) {
      const r = normalise(input);
      if (!r.design || !r.ok) throw new Error(`${label}: not a valid design: ${JSON.stringify(r)}`);
      const path = builderPath(r.design);
      expect(path.problems, label).toEqual([]);
      expect(canonicalJson(path.design), label).toBe(canonicalJson(r.design));
    }
  });
});

