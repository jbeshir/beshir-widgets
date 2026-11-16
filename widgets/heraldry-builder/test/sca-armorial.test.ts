// The widget against every current armory record in the SCA Ordinary & Armorial
// (test/fixtures/sca/oanda.db, used by tests only). Each record either passes all five checks of
// test/sca/classify.ts or is on the ignore list (test/fixtures/sca/ignored.json) with the gaps that
// stop the widget expressing it. The list is a ratchet: a listed record that starts to pass, or
// that loses the gap it is filed under, fails the test until the list is regenerated
// (`npm run sca:ignore`).

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, DIVISION_NAME, DRAWN_DIVISIONS, DRAWN_TREATMENTS, FURS, FUR_NAME, SEMY_NAMES, UNSUPPORTED_GAP_CATEGORIES, VARIATIONS, VARIATION_NAME,
  blazon, canonicalJson, isCountedVariation, normalise,
} from '../src/lib/heraldry';
import { generatedDesign, generatedRichDesign } from './design-generator';
import { arms, charge, group, ordinary } from './helpers';
import entries from '../src/data/sample-registry.json';
import { checkBlazon, classify, failureLines, listing } from './sca/classify';
import { GAP_CATEGORIES, categoryOf } from './sca/gaps';
import { readIgnoreList } from './sca/ignore-list';
import { explainMatch } from './sca/match';
import { OANDA_SHA256, oandaSha256, readArmory, readCurrentArmory, type ArmoryRecord } from './sca/oanda';

describe('SCA O&A fixture', () => {
  it('is byte-identical to the download, with the sha256 the README states', () => {
    expect(oandaSha256()).toBe(OANDA_SHA256);
    expect(readFileSync(new URL('fixtures/sca/README.md', import.meta.url), 'utf8')).toContain(`\`${OANDA_SHA256}\``);
  });

  it('has unique keys', () => {
    const records = readArmory();
    expect(new Set(records.map((r) => r.key)).size).toBe(records.length);
  });
});

// A record passes when the widget finds a design that blazons as the SCA does, would register it,
// draws it and lets the Design tab build it. "Blazons as the SCA does" is text equality after
// normaliseBlazon(), applied to the SCA blazon and the widget's alike — the widget's house-style
// blazon, or its blazon of the same design with the College's defaults stated. The rules
// (NORMALISATION_RULES in test/sca/normalise.ts, each documented there) only bridge differences of
// convention: case, the final full stop, spelling, and three conventions the Glossary treats as
// equivalent (connectors, where placement words go, Table 5 default postures). None drops a
// tincture, count, charge or arrangement, so blazons of two different designs never compare equal.
describe('SCA armory the widget can express', () => {
  const entries = readIgnoreList().groups.flatMap((g) => Object.entries(g.records).map(([key, tags]) => [key, { primary: g.category, tags }] as const));
  /** Ignored record key → the category of the group it is filed under, and its tags. */
  const ignored = new Map(entries);
  let records: ArmoryRecord[];
  let byKey: Map<string, ArmoryRecord>;

  beforeAll(() => {
    records = readCurrentArmory();
    byKey = new Map(records.map((r) => [r.key, r]));
  });

  it('every record not on the ignore list passes all five checks', () => {
    const problems = records.filter((r) => !ignored.has(r.key)).flatMap((r) => failureLines(r, checkBlazon(r.blazon).failures));
    expect(problems.length, listing('Failing records not on the ignore list (a new gap: `npm run sca:ignore`; else fix the widget)', problems)).toBe(0);
  }, 120_000);

  it('the ignore list holds only current records, each tagged with known gap categories', () => {
    const categories = new Set<string>(GAP_CATEGORIES.map((c) => c.id));
    const problems = [...ignored].flatMap(([key, { primary, tags }]) => [
      ...(byKey.has(key) ? [] : [`${key}: not a current armory record`]),
      ...(tags.length ? [] : [`${key}: no gap tags`]),
      ...tags.filter((t) => !categories.has(categoryOf(t))).map((t) => `${key}: unknown gap category in "${t}"`),
      ...(tags.some((t) => categoryOf(t) === primary) ? [] : [`${key}: filed under ${primary}, which isn't among its tags`]),
    ]);
    expect(problems.length, listing('Bad ignore-list entries', problems)).toBe(0);
    expect(ignored.size, 'a record is listed in more than one group').toBe(entries.length);
  });

  // The ratchet. A listed record must still fail, and must still have the gap it is filed under.
  // Its other tags may drift as the tagger's term lists are tuned without failing the test: requiring
  // exact tags would force a full regeneration for every wording tweak. Holding the primary gap
  // keeps the to-do list honest: a record can't stay filed under a gap that no longer blocks it.
  it('every ignored record still fails, with the gap it is filed under', () => {
    const problems: string[] = [];
    for (const [key, { primary }] of ignored) {
      const record = byKey.get(key);
      if (!record) continue;
      const c = classify(record);
      if (c.status === 'passes') problems.push(`${key} "${record.blazon}" now passes: remove it from ignored.json (\`npm run sca:ignore\`)`);
      else if (c.status === 'fails') problems.push(...failureLines(record, c.failures));
      else if (!c.tags.some((t) => categoryOf(t) === primary)) {
        problems.push(`${key} "${record.blazon}" no longer has a ${primary} gap (now ${c.tags.join(', ')}): \`npm run sca:ignore\``);
      }
    }
    expect(problems.length, listing('Ignore-list entries out of date', problems)).toBe(0);
  }, 120_000);
});

// The matcher reads whatever the widget writes: every construct the widget draws, blazoned by the
// widget, comes back from explainMatch as the very design it was written from.
const field = { k: 'divided', division: 'per-pale', parts: ['or', 'gules'] };
const swords = { v: 2, field: 'azure', groups: [group(charge('sword'), 'or', { count: 2, arrangement: 'crossed' })] };
const sun = charge('sun', { mods: [{ id: 'in-splendour', count: null, paint: null }] });
const chiefOf = (...on: object[]) => group(ordinary('chief'), 'argent', { charged: on });
const mullets = (n: number, extra: object = {}) => group(charge('mullet'), 'gules', { count: n, ...extra });
const BLAZONED_DESIGNS: Array<[string, unknown]> = [
  ['a divided field with a charge', arms(field, group(charge('lion', { posture: 'passant' }), 'argent'))],
  ['rows', arms('azure', group(charge('rose'), 'argent', { count: 5, arrangement: 'rows-3-2' }))],
  ['counts seven to twelve', arms('azure', group(charge('mullet'), 'or', { count: 7 }))],
  ['a ring of twelve', arms('azure', group(charge('mullet'), 'or', { count: 12, arrangement: 'in-annulo' }))],
  ['two in annulo', arms('azure', group(charge('fish'), 'or', { count: 2, arrangement: 'in-annulo' }))],
  ['an orle of charges', arms('azure', group(charge('rose'), 'or', { count: 8, arrangement: 'in-orle' }))],
  ['four in cross', arms('azure', group(charge('rose'), 'or', { count: 4, arrangement: 'in-cross' }))],
  ['five in saltire', arms('azure', group(charge('rose'), 'or', { count: 5, arrangement: 'in-saltire' }))],
  ['crossed swords', swords],
  ['in pale', arms('azure', group(charge('key'), 'or', { count: 3, arrangement: 'in-pale' }))],
  ['in chief', arms('azure', group(charge('mullet'), 'or', { count: 3, arrangement: 'in-chief' }))],
  ['in base', arms('azure', group(charge('mullet'), 'or', { arrangement: 'in-base' }))],
  ['a sun in splendor', arms('azure', group(sun, 'or'))],
  ['cogwheels', arms('azure', group(charge('gear'), 'or', { count: 3 }))],
  ['a hare courant', arms('azure', group(charge('hare', { posture: 'courant' }), 'or'))],
  ['an ordinary', arms('azure', group(ordinary('fess'), 'or'))],
  ['an ordinary between charges', arms('azure', group(ordinary('chevron'), 'or'), group(charge('rose'), 'argent', { count: 3 }))],
  ['charges on an ordinary', arms('azure', group(ordinary('fess'), 'or', { charged: [mullets(3)] }))],
  ['charges on an ordinary between charges', arms('azure', group(ordinary('fess'), 'or', { charged: [mullets(3)] }), group(charge('rose'), 'argent', { count: 3 }))],
  ['charges on a cross', arms('azure', group(ordinary('cross'), 'or', { charged: [mullets(5)] }))],
  ['an ordinary and a chief', arms('azure', group(ordinary('fess'), 'or'), group(ordinary('chief'), 'argent'))],
  ['an ordinary and a bordure', arms('azure', group(ordinary('saltire'), 'or'), group(ordinary('bordure'), 'argent'))],
  ['a charge and a bordure', arms('azure', group(charge('lion'), 'or'), group(ordinary('bordure'), 'argent'))],
  ['a charge and a chief with charges', arms('azure', group(charge('lion'), 'or'), chiefOf(mullets(3)))],
  ['charges and a chief with charges', arms('azure', group(charge('mullet'), 'or', { count: 3 }), chiefOf(mullets(2)))],
  ['a chief with charges alone', arms('azure', chiefOf(mullets(3)))],
  ['an ordinary and a chief with charges', arms('azure', group(ordinary('fess'), 'or'), chiefOf(mullets(3)))],
  ['an ordinary between charges and a chief with charges', arms('azure', group(ordinary('chevron'), 'or'), group(charge('rose'), 'argent', { count: 3 }), chiefOf(mullets(3)))],
  ['a bordure with charges', arms('azure', group(ordinary('bordure'), 'or', { charged: [mullets(8)] }))],
  ['a charge and a bordure with charges', arms('azure', group(charge('lion'), 'or'), group(ordinary('bordure'), 'argent', { charged: [group(charge('mullet'), 'sable', { count: 8 })] }))],
  ['a chief with charges and a bordure with charges', arms('azure', chiefOf(mullets(3)), group(ordinary('bordure'), 'or', { charged: [mullets(8)] }))],
  ['an ordinary, a chief with charges and a bordure with charges', arms('azure', group(ordinary('pale'), 'or'), chiefOf(mullets(3)), group(ordinary('bordure'), 'or', { charged: [mullets(6)] }))],
  ['a chief and a bordure', arms('azure', group(ordinary('chief'), 'or'), group(ordinary('bordure'), 'argent'))],
  ['an ordinary, a chief and a bordure', arms('azure', group(ordinary('pale'), 'or'), group(ordinary('chief'), 'argent'), group(ordinary('bordure'), 'argent'))],
  ['charges between an ordinary, under a chief', arms('azure', group(ordinary('bend'), 'or'), group(charge('rose'), 'argent', { count: 2 }), group(ordinary('chief'), 'or'))],
  ['charges on an ordinary, within a bordure', arms('azure', group(ordinary('fess'), 'or', { charged: [mullets(3)] }), group(ordinary('bordure'), 'argent'))],
  ['a charge, a chief and a bordure', arms('azure', group(charge('lion'), 'or'), group(ordinary('chief'), 'argent'), group(ordinary('bordure'), 'or'))],
  ['a charge and charges in chief', arms('purpure', group(charge('bee'), 'or'), group(charge('mullet'), 'argent', { count: 3, position: 'chief' }))],
  ['an ordinary and a charge in base', arms('argent', group(ordinary('chevron'), 'sable'), group(charge('crescent'), 'sable', { position: 'base' }))],
  ['a charge and a charge in canton, within a bordure', arms('sable', group(charge('dragon'), 'argent'), group(charge('crescent'), 'argent', { position: 'canton' }), group(ordinary('bordure'), 'argent'))],
  ['charges in chief in rows', arms('sable', group(charge('anchor'), 'argent'), group(charge('mullet'), 'or', { count: 5, position: 'chief', arrangement: 'rows-3-2' }))],
  ['two crossed in base', arms('sable', group(ordinary('chevron'), 'or'), group(charge('sword'), 'or', { count: 2, position: 'base', arrangement: 'crossed' }))],
  ['charges on an ordinary and charges in chief', arms('azure', group(ordinary('fess'), 'or', { charged: [mullets(3)] }), group(charge('rose'), 'argent', { count: 2, position: 'chief' }))],
  ['a charge between charges', arms('azure', group(charge('lion'), 'or'), group(charge('rose'), 'argent', { count: 3, relation: 'between' }))],
  ['two crossed between four in saltire', arms('sable', group(charge('sword'), 'or', { count: 2, arrangement: 'crossed' }), group(charge('mullet'), 'argent', { count: 4, relation: 'between', arrangement: 'in-saltire' }))],
  ['a charge between two in fess, within a bordure', arms('vert', group(charge('tree'), 'or'), group(charge('crescent'), 'or', { count: 2, relation: 'between', arrangement: 'in-fess' }), group(ordinary('bordure'), 'argent'))],
  ['a charge between six in orle', arms('gules', group(charge('heart'), 'argent'), group(charge('mullet'), 'or', { count: 6, relation: 'between', arrangement: 'in-orle' }))],
  ['a charge between charges under a chief', arms('azure', group(charge('bee'), 'or'), group(charge('rose'), 'argent', { count: 3, relation: 'between' }), group(ordinary('chief'), 'argent'))],
  ['counterchanged charges', arms(field, group(charge('rose'), 'counterchanged', { count: 2 }))],
  ['two pictures together, in fess', arms('azure', group(charge('lion'), 'or', { arrangement: 'in-fess' }), group(charge('rose'), 'argent', { arrangement: 'in-fess' }))],
  ['two pictures together of one tincture, in pale', arms('azure', group(charge('lion'), 'or', { arrangement: 'in-pale' }), group(charge('rose'), 'or', { arrangement: 'in-pale' }))],
  ['two pictures together, one in each part', arms(field, group(charge('lion'), 'azure'), group(charge('rose'), 'argent'))],
  ['two and one pictures together', arms('azure', group(charge('lion'), 'or', { count: 2 }), group(charge('rose'), 'argent'))],
  ['two pictures together, counterchanged', arms({ k: 'divided', division: 'per-fess', parts: ['argent', 'sable'] }, group(charge('sun'), 'counterchanged'), group(charge('fleur-de-lis'), 'counterchanged'))],
  ['two pictures together within a bordure', arms('azure', group(charge('lion'), 'or', { arrangement: 'in-pale' }), group(charge('rose'), 'argent', { arrangement: 'in-pale' }), group(ordinary('bordure'), 'argent'))],
  ['a counterchanged ordinary', arms(field, group(ordinary('fess'), 'counterchanged'))],
];

describe('the matcher reads what the widget writes', () => {
  it.each(BLAZONED_DESIGNS)('%s', (_, input) => {
    const n = normalise(input);
    expect(n.ok).toBe(true);
    const design = n.design!;
    const m = explainMatch(blazon(design));
    expect(m.status).toBe('match');
    expect(canonicalJson(m.match!.design!)).toBe(canonicalJson(design));
  });

  it('reads the blazon of every generated design and every sample entry', () => {
    const designs = [
      ...Array.from({ length: 1500 }, (_, seed) => generatedDesign(seed)),
      ...Array.from({ length: 1500 }, (_, seed) => generatedRichDesign(seed)),
      ...entries.entries.map((e) => normalise(e.design).design),
    ].filter((d) => d !== null);
    expect(designs.length).toBeGreaterThan(400);
    const unread = designs.filter((d) => {
      const m = explainMatch(blazon(d));
      return !m.match || canonicalJson(m.match.design!) !== canonicalJson(d);
    });
    expect(unread.map((d) => blazon(d))).toEqual([]);
  }, 30_000);
});

// A stated default is a wording of the same design, accepted at design level; never as dropped text.
describe('the matcher accepts stated defaults only for the design that has them', () => {
  it.each([
    ['Quarterly Or and gules, in bend two roses sable.', 'Quarterly Or and gules, two roses sable.'],
    ['Per chevron argent and gules, in base a fleur-de-lys argent.', 'Per chevron argent and gules, a fleur-de-lys argent.'],
    ['Argent, three mullets two and one gules.', 'Argent, three mullets gules.'],
    ['Or, five roses two, two and one gules.', 'Or, five roses gules.'],
  ])('%s', (stated, house) => {
    const m = explainMatch(stated);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  // REVIEW.md M5: the old text rule dropped "two and one" anywhere and matched these to other designs.
  it.each([
    'Argent, on a chief gules three mullets two and one Or.',
    'Or, in chief three mullets two and one gules.',
    'Argent, on a bend gules three mullets two and one Or.',
    'Argent, on a cross gules five mullets two, two and one Or.',
  ])('%s is no match', (text) => {
    expect(explainMatch(text).status).not.toBe('match');
  });
});

// A construct the matcher parses but the widget doesn't draw is filed under the widget's own gap.
describe('the matcher files what the widget does not draw under its gap', () => {
  it.each([
    ['Azure, a lion couchant Or.', ['posture:couchant']],
    ['Azure, two wolves Or and two roses argent.', ['multiple-groups:co-primary-count']],
    ['Azure, a wolf Or, a rose argent and a heart gules.', ['multiple-groups:co-primary-3']],
    ['Azure, three lions Or between three roses argent.', ['placement:around-primary-3']],
    ['Azure, a lion Or between ten roses argent.', ['placement:around-10']],
    ['Azure, a chevron between three mullets and a rose argent.', ['multiple-groups:secondary', 'placement:between-chevron-1']],
    ['Azure, on a key Or a rose gules.', ['placement:on-key']],
    ['Azure, a cross Or between two roses argent.', ['placement:between-cross-2']],
    // With no comma, the charges "between" are on the host too: one tertiary group of two types (SENA A3D2a).
    ['Vert, on a cross argent a rose sable between four roses gules.', ['multiple-groups:tertiary-two-types']],
    ['Sable, on a chief argent a rose purpure between two roses sable.', ['multiple-groups:tertiary-two-types']],
  ])('%s', (text, tags) => {
    const m = explainMatch(text);
    expect(m.status).toBe('unsupported');
    expect(m.gaps!.map((g) => `${g.category}:${g.detail}`)).toEqual(tags);
  });

  it('only ever uses gap categories the ignore list knows', () => {
    const known = new Set<string>(GAP_CATEGORIES.map((c) => c.id));
    expect(UNSUPPORTED_GAP_CATEGORIES.filter((c) => !known.has(c))).toEqual([]);
  });
});

// Charges on charges: "on <a charge> <group>", "<a host> charged with <group>" (the same design), and "each charged with".
describe('the matcher reads charges on the primary charges', () => {
  it.each([
    'Azure, on a heart argent a lion rampant azure.',
    'Azure, on a heart argent, a lion rampant azure.',
    'Purpure, a unicorn argent charged with a fleur-de-lys purpure.',
    'Purpure, on a unicorn argent a fleur-de-lys purpure.',
    'Vert, three flames argent each charged with a heart azure.',
    'Or, on a sun gules three mullets one and two Or.',
    'Or, on a sun gules a mullet Or, a bordure argent.',
    'Gules, a bend Or charged with three roses argent.',
  ])('%s is a match', (text) => {
    expect(explainMatch(text).status).toBe('match');
  });

  it('words a charge on a beast "charged with" and any other host "on", and reads both', () => {
    expect(blazon(explainMatch('Purpure, on a unicorn argent a fleur-de-lis purpure.').match!.design!)).toBe('Purpure, a unicorn argent charged with a fleur-de-lys purpure.');
    expect(blazon(explainMatch('Azure, a heart argent charged with a lion azure.').match!.design!)).toBe('Azure, on a heart argent a lion azure.');
  });

  it('is a near-miss when the College leaves a layout the widget must state', () => {
    expect(explainMatch('Azure, on a heart argent three mullets gules.')).toMatchObject({ status: 'near-miss', nearMiss: 'arrangement-wording' });
  });
});

// A record the widget draws except for one word it can't read has that word as its gap and nothing else: the tagger
// must not file it under a construct the widget does draw (a fur, a pattern, a semy, a second group, a badge …).
// Each case is a minimal blazon of one drawn construct, taken from the library's own tables where it has them, plus a
// noun no lexicon holds; the classifier files it under `other` alone.
describe('the tagger never files a record under a construct the widget supports', () => {
  const upper = (text: string) => text.replace(/^./, (c) => c.toUpperCase());
  const fields: Array<[string, string]> = [
    ...VARIATIONS.map((v): [string, string] => [`${VARIATION_NAME[v]} field`, `${VARIATION_NAME[v]}${isCountedVariation(v) ? ' of eight' : ''} argent and gules`]),
    ...FURS.map((f): [string, string] => [`${FUR_NAME[f]} field`, FUR_NAME[f]]),
    ['ermined colours', 'argent ermined gules'],
    ['vairy colours', 'vairy Or and gules'],
    ['potenty colours', 'potenty argent and sable'],
    ...DRAWN_TREATMENTS.map((t): [string, string] => [`${t} field`, `argent ${t} sable`]),
    ...SEMY_NAMES.map((n): [string, string] => [`${n.word} field`, `azure ${n.word}${n.tincture === null ? ' Or' : ''}`]),
    ['semy of charges', 'azure semy of mullets Or'],
    ['semy on a part', 'per pale gules and argent semy of billets gules'],
    ...DRAWN_DIVISIONS.map((d): [string, string] => [`${DIVISION_NAME[d]} field`, `${DIVISION_NAME[d]} Or and gules`]),
  ];
  const designs: Array<[string, string]> = [
    ['a fur on a band', 'azure, a bend ermine'],
    ['a fur on a picture', 'azure, a mullet vair'],
    ['a pattern on a band', 'azure, a fess checky Or and sable'],
    ['a treatment on a band', 'azure, a chief argent masoned sable'],
    ['a semy on a band', 'azure, a chief gules semy of billets Or'],
    ['a party picture', 'azure, a heart per pale argent and gules'],
    ...CHARGE_IDS.filter((id) => CHARGES[id].proper).map((id): [string, string] => [`a ${id} proper`, `azure, a ${CHARGES[id].name} proper`]),
    ['a counterchanged band', 'per pale Or and gules, a bend counterchanged'],
    ['a counterchanged picture', 'per pale Or and gules, a heart counterchanged'],
    ['two groups beside each other', 'azure, a lion and a rose argent'],
    ['a charge between charges', 'azure, a lion Or between three roses argent'],
    ['charges around a charge', 'azure, a lion Or between four roses argent in saltire'],
    ['a band and a chief', 'azure, a fess and a chief argent'],
    ['a chief and a bordure', 'azure, a chief and a bordure Or'],
    ['charges in chief', 'azure, a bend Or, in chief three roses argent'],
    ['charges in a corner', 'azure, a bend Or and in dexter chief a rose argent'],
    ['overall', 'azure, a fess Or and overall a lion argent'],
    ['charges on a band', 'azure, on a fess Or three roses gules'],
    ['charges on a bordure', 'azure, on a bordure Or eight mullets gules'],
    ['a band between charges', 'azure, a chevron between three roses Or'],
    ['a charge on a charge', 'azure, on a heart argent a lion azure'],
    ['charged with', 'azure, a unicorn argent charged with a rose gules'],
    ['co-primaries', 'azure, two roses and a lion argent'],
    ['a roundel', 'azure, a bezant'],
    ['a goutte', 'azure, a goutte de sang'],
    ['a badge', '(Fieldless) A lion Or'],
    ['a charged badge', '(Fieldless) A rose argent charged with a heart gules'],
    ['a badge of crossed charges', '(Fieldless) Two swords in saltire argent'],
  ];
  const cases = [...fields.map(([name, field]): [string, string] => [name, upper(field)]), ...designs];

  it.each(cases)('%s', (_, text) => {
    const c = classify({ key: 'regid:0', type: 'd', date: '', blazon: `${upper(text)}, a frobnitz Or.`, headings: [] });
    expect(c.status).toBe('gap');
    expect(c.tags.filter((t) => categoryOf(t) !== 'other')).toEqual([]);
  });
});
