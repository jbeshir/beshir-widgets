// The widget against every current armory record in the SCA Ordinary & Armorial
// (test/fixtures/sca/oanda.db, used by tests only). Each record either passes all five checks of
// test/sca/classify.ts or is on the ignore list (test/fixtures/sca/ignored.json) with the gaps that
// stop the widget expressing it. The list is a ratchet: a listed record that starts to pass, or
// that loses the gap it is filed under, fails the test until the list is regenerated
// (`npm run sca:ignore`).
//
// Cost control: `npm test` runs the cheap checks (match, assess, blazon, render) on EVERY record but replays the
// builder's clicks (the 'builder' check, ~11 ms a design, most of this file's time) and re-runs the gap tagger on the
// ignored records for a seeded, rotating sample only (test/sca/sample.ts): so this file's cost stays roughly flat as
// records start passing. `npm run sca:ignore` is the authoritative full sweep over every record (the final gate runs it);
// `SCA_FULL=1 npx vitest run --project sca` makes this test do the same, `SCA_SAMPLE_SEED=<text>` picks the sample.

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, BUILDER_DIVISIONS, DIVISION_NAME, DRAWN_DIVISIONS, DRAWN_ORDINARIES, ORDINARY_NAME, DRAWN_LINES, DRAWN_TREATMENTS, LINED_VARIATIONS, LINE_WORD, FURS, FUR_NAME, SEMY_NAMES, lineAllowed, UNSUPPORTED_GAP_CATEGORIES, VARIATIONS, VARIATION_NAME,
  blazon, canonicalJson, isCountedVariation, normalise, ordinaryWithArticle, structuralIssues,
} from '../src/lib/heraldry';
import { generatedDesign, generatedGeometryDesigns, generatedLinedOrdinaryDesigns, generatedRichDesign, generatedTreatedOrdinaryDesigns, generatedOutlinedOrdinaryDesigns, generatedPeripheralDesigns } from './design-generator';
import { arms, charge, div, group, ordinary } from './helpers';
import entries from '../src/data/sample-registry.json';
import { checkBlazon, classify, failureLines, listing } from './sca/classify';
import { GAP_CATEGORIES, categoryOf } from './sca/gaps';
import { readIgnoreList } from './sca/ignore-list';
import { explainMatch } from './sca/match';
import { createSampler, fullSweep, sampleSeed } from './sca/sample';
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
  /** Which designs get the builder replay and which ignored records get the tagger re-run in this run. */
  let sampler: ReturnType<typeof createSampler>;
  const options = () => ({
    builder: (design: Parameters<typeof sampler.builder>[0]) => sampler.builder(design),
    tagger: (r: ArmoryRecord) => sampler.tagger(r, ignored.get(r.key)?.primary ?? ''),
  });

  beforeAll(() => {
    records = readCurrentArmory();
    byKey = new Map(records.map((r) => [r.key, r]));
    sampler = createSampler(sampleSeed(), records.length - ignored.size, fullSweep());
  });

  it('every record not on the ignore list passes all five checks', () => {
    const problems = records.filter((r) => !ignored.has(r.key)).flatMap((r) => failureLines(r, checkBlazon(r.blazon, options()).failures));
    expect(problems.length, listing(`Failing records not on the ignore list (a new gap: \`npm run sca:ignore\`; else fix the widget; sample seed ${sampleSeed()}, SCA_FULL=1 for the full sweep)`, problems)).toBe(0);
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
      const c = classify(record, options());
      if (c.status === 'passes') problems.push(`${key} "${record.blazon}" now passes: remove it from ignored.json (\`npm run sca:ignore\`)`);
      else if (c.status === 'fails') problems.push(...failureLines(record, c.failures));
      else if (c.tagsSkipped) continue;
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
  ['a wavy division', arms({ k: 'divided', division: 'per-pale', lines: { a: 'wavy' }, parts: ['argent', 'azure'] }, group(charge('mullet'), 'or'))],
  ['an embattled division with a counterchanged charge', arms({ k: 'divided', division: 'per-fess', lines: { a: 'embattled' }, parts: ['or', 'gules'] }, group(charge('mullet'), 'counterchanged'))],
  ['barry wavy', arms({ k: 'variation', variation: 'barry', pieces: 8, lines: { a: 'wavy' }, parts: ['argent', 'azure'] }, group(charge('lion'), 'or'))],
  ['quarterly with the line across only', arms({ k: 'divided', division: 'quarterly', lines: { a: 'plain', b: 'embattled' }, parts: ['or', 'gules'] }, group(charge('mullet'), 'argent'))],
  ['quarterly with the line up and down only', arms({ k: 'divided', division: 'quarterly', lines: { a: 'indented', b: 'plain' }, parts: ['or', 'gules'] }, group(charge('mullet'), 'argent'))],
  ['a bowed per chevron', arms({ k: 'divided', division: 'per-chevron', lines: { a: 'ploye' }, parts: ['or', 'gules'] }, group(charge('mullet'), 'counterchanged'))],
  ['a fess embattled (its upper edge)', arms('azure', group(ordinary('fess', { lines: { a: 'embattled' } }), 'or'))],
  ['a bend embattled counter-embattled', arms('azure', group(ordinary('bend', { lines: { a: 'embattled', b: 'embattled' } }), 'or'))],
  ['a chevron wavy on the lower edge', arms('gules', group(ordinary('chevron', { lines: { a: 'plain', b: 'wavy' } }), 'argent'))],
  ['a pale engrailed with charges on it', arms('azure', group(ordinary('pale', { lines: { a: 'engrailed', b: 'engrailed' } }), 'or', { charged: [group(charge('mullet'), 'gules', { count: 3 })] }))],
  ['a chief indented and a bordure engrailed', arms('sable', group(ordinary('fess'), 'or'), group(ordinary('chief', { lines: { a: 'indented' } }), 'argent'), group(ordinary('bordure', { lines: { a: 'engrailed' } }), 'argent'))],
  ['a cross embattled grady', arms('vert', group(ordinary('cross', { lines: { a: 'grady' } }), 'or'))],
  ['an embattled grady division', arms({ k: 'divided', division: 'per-bend', lines: { a: 'grady' }, parts: ['argent', 'gules'] }, group(charge('mullet'), 'or'))],
  ['a bend cotised in its own tincture', arms('azure', group(ordinary('bend', { cotised: { count: 1, paint: 'argent' } }), 'argent'))],
  ['a bend cotised in another tincture', arms('azure', group(ordinary('bend', { cotised: { count: 1, paint: 'argent' } }), 'or'))],
  ['a chevron cotised between charges', arms('azure', group(ordinary('chevron', { cotised: { count: 1, paint: 'argent' } }), 'argent'), group(charge('mullet'), 'argent', { count: 3 }))],
  ['a pale endorsed with charges on it', arms('or', group(ordinary('pale', { cotised: { count: 1, paint: 'azure' } }), 'azure', { charged: [group(charge('sun'), 'argent')] }))],
  ['a fess doubly cotised wavy', arms('azure', group(ordinary('fess', { cotised: { count: 2, paint: 'argent', line: 'wavy' } }), 'or'))],
  ['a wavy bend cotised plain', arms('argent', group(ordinary('bend', { lines: { a: 'wavy', b: 'wavy' }, cotised: { count: 1, paint: 'sable', line: 'plain' } }), 'purpure'))],
  ['a saltire triply cotised, hollow', arms('azure', group(ordinary('saltire', { mods: ['voided'], cotised: { count: 3, paint: 'argent' } }), 'or'))],
  ['a bend cotised counterchanged', arms(field, group(ordinary('bend', { cotised: { count: 1, paint: 'counterchanged' } }), 'sable'))],
  ['a pale fimbriated', arms('azure', group(ordinary('pale', { fimbriated: 'argent' }), 'sable'))],
  ['a chevron fimbriated between charges', arms('sable', group(ordinary('chevron', { fimbriated: 'argent' }), 'gules'), group(charge('lion'), 'argent', { count: 3 }))],
  ['a cross voided', arms('gules', group(ordinary('cross', { mods: ['voided'] }), 'or'))],
  ['a saltire voided and couped', arms('gules', group(ordinary('saltire', { mods: ['couped', 'voided'] }), 'or'))],
  ['a charge and a base', arms('argent', group(charge('mullet'), 'sable'), group(ordinary('base'), 'azure'))],
  ['a canton alone', arms('azure', group(ordinary('canton'), 'or'))],
  ['a canton sinister', arms('gules', group(ordinary('canton', { mods: ['sinister'] }), 'argent'))],
  ['a point pointed', arms('azure', group(ordinary('point'), 'or'))],
  ['a quarter beside a charge', arms('gules', group(charge('lion'), 'or'), group(ordinary('quarter'), 'argent'))],
  ['a gyron sinister wavy', arms('azure', group(ordinary('gyron', { mods: ['sinister'], lines: { a: 'wavy' } }), 'or'))],
  ['a band and a canton', arms('azure', group(ordinary('bend'), 'or'), group(ordinary('canton'), 'argent'))],
  ['a base wavy beside a chief', arms('azure', group(ordinary('chief'), 'or'), group(ordinary('base', { lines: { a: 'wavy' } }), 'argent'))],
  ['a band, a chief, a base and a canton', arms('azure', group(ordinary('fess'), 'or'), group(ordinary('chief'), 'argent'), group(ordinary('base'), 'or'), group(ordinary('canton'), 'argent'))],
  ['a charge within an orle', arms(div('per-bend', 'argent', 'vert'), group(charge('heart'), 'gules'), group(ordinary('orle'), 'gules'))],
  ['an orle alone', arms('gules', group(ordinary('orle'), 'argent'))],
  ['an orle embattled on its outer edge', arms('azure', group(ordinary('orle', { lines: { a: 'embattled', b: 'plain' } }), 'or'))],
  ['an orle wavy and a chief', arms('argent', group(charge('lion'), 'gules'), group(ordinary('orle', { lines: { a: 'wavy' } }), 'azure'), group(ordinary('chief'), 'gules'))],
  ['a charge within a double tressure', arms('gules', group(charge('lion'), 'or'), group(ordinary('tressure'), 'or', { count: 2 }))],
  ['a triple tressure', arms('gules', group(ordinary('tressure'), 'or', { count: 3 }))],
  ['flaunches alone', arms('or', group(ordinary('flaunches'), 'azure'))],
  ['charges between flaunches', arms('sable', group(charge('roundel'), 'or', { count: 3, arrangement: 'in-pale' }), group(ordinary('flaunches'), 'or'))],
  ['flaunches engrailed', arms('argent', group(ordinary('flaunches', { lines: { a: 'engrailed' } }), 'vert'))],
  ['a gore sinister', arms('argent', group(ordinary('gore', { mods: ['sinister'] }), 'azure'))],
  ['a charge and a gore', arms('gules', group(charge('dragon'), 'argent'), group(ordinary('gore'), 'or'))],
  ['a pall', arms('azure', group(ordinary('pall'), 'or'))],
  ['a pall inverted bretessed', arms('azure', group(ordinary('pall-inverted', { lines: { a: 'bretessed' } }), 'argent'))],
  ['a pall voided', arms('argent', group(ordinary('pall', { mods: ['voided'] }), 'sable'))],
  ['a pall inverted fimbriated', arms('azure', group(ordinary('pall-inverted', { fimbriated: 'argent' }), 'gules'))],
  ['three charges between a pall', arms('argent', group(ordinary('pall'), 'gules'), group(charge('roundel'), 'azure', { count: 3, relation: 'between' }))],
  ['three charges on a pall inverted', arms('argent', { ...group(ordinary('pall-inverted'), 'azure'), charged: [group(charge('mullet'), 'or', { count: 3 })] })],
  ['a fret counterchanged', arms(div('per-pale', 'gules', 'or'), group(ordinary('fret'), { k: 'counterchanged' }))],
  ['a charge and a label', arms('azure', group(charge('lion'), 'or'), group(ordinary('label'), 'argent'))],
  ['a trimount alone', arms('vert', group(ordinary('trimount'), 'or'))],
  ['a charge and a mount', arms('or', group(charge('lion'), 'gules'), group(ordinary('mount'), 'vert'))],
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
      ...generatedGeometryDesigns(1, 300),
      ...generatedLinedOrdinaryDesigns(1, 200),
      ...generatedTreatedOrdinaryDesigns(1, 120),
      ...generatedOutlinedOrdinaryDesigns(1, 120),
      ...generatedPeripheralDesigns(1, 120),
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

// A line on the field is read from the College's spellings; a division draws one line, so "per pale dancetty" is indented (RULES §A.3).
describe('the matcher reads the lines of the field', () => {
  it.each([
    ['Per pale undy argent and azure, a mullet Or.', 'Per pale wavy argent and azure, a mullet Or.'],
    ['Per fess crenellated Or and gules, a mullet argent.', 'Per fess embattled Or and gules, a mullet argent.'],
    ['Per pale dancetty Or and gules, a mullet argent.', 'Per pale indented Or and gules, a mullet argent.'],
    ['Per chevron ployé argent and gules, a mullet Or.', 'Per chevron ployé argent and gules, a mullet Or.'],
    ['Per chevron ployee argent and gules, a mullet Or.', 'Per chevron ployé argent and gules, a mullet Or.'],
    ['Per bend embattled-grady argent and gules, a mullet Or.', 'Per bend embattled grady argent and gules, a mullet Or.'],
    ['Quarterly per fess indented Or and gules, a mullet argent.', 'Quarterly per fess indented Or and gules, a mullet argent.'],
    ['Barry wavy of eight argent and azure, a chief Or.', 'Barry wavy of eight argent and azure, a chief Or.'],
    ['Barry wavy of six argent and azure, a chief Or.', 'Barry wavy argent and azure, a chief Or.'],
    ['Paly dancetty argent and azure, a chief Or.', 'Paly dancetty argent and azure, a chief Or.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('files a line on the division of a band or on chevronny as the gap the widget names', () => {
    expect(explainMatch('Azure, a heart per pale wavy argent and gules.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'line-of-partition', detail: 'on-divided-charge' }] });
    expect(explainMatch('Chevronny wavy argent and azure, a chief Or.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'line-of-partition', detail: 'wavy-on-chevronny' }] });
  });
});

// The treatments of an ordinary, in the College's orders and spellings (normaliser rule 'ordinary-treatments').
describe('the matcher reads the treatments of an ordinary', () => {
  it.each([
    ['Argent, a chevron inverted sable.', 'Argent, a chevron inverted sable.'],
    ['Argent, a chevron reversed sable.', 'Argent, a chevron inverted sable.'],
    ['Azure, a chevron inverted embattled Or.', 'Azure, a chevron inverted embattled on the upper edge Or.'],
    ['Azure, a pile wavy inverted Or.', 'Azure, a pile inverted wavy Or.'],
    ['Gules, a cross couped argent.', 'Gules, a cross couped argent.'],
    ['Gules, a cross humetty argent.', 'Gules, a cross couped argent.'],
    ['Vert, a saltire couped raguly Or.', 'Vert, a saltire raguly couped Or.'],
    ['Azure, a fess couped between three roses Or.', 'Azure, a fess couped between three roses Or.'],
    ['Gules, a chevron ployé throughout argent.', 'Gules, a chevron ployé throughout argent.'],
    ['Gules, a cross throughout argent.', 'Gules, a cross argent.'],
    ['Azure, a fess enhanced Or.', 'Azure, a fess enhanced Or.'],
    ['Azure, a bendlet enhanced Or.', 'Azure, a bend enhanced Or.'],
    ['Azure, a bend sinister abased argent.', 'Azure, a bend sinister abased argent.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('files a treatment on an ordinary it is not drawn on as the gap the widget names', () => {
    expect(explainMatch('Azure, a fess inverted Or.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'ordinary-treatment', detail: 'inverted-on-fess' }] });
  });
});

describe('the matcher reads corner and edge shapes, with the joiner the widget writes before each', () => {
  it.each([
    ['Argent, a mullet sable, a base azure.', 'Argent, a mullet sable and a base azure.'],
    ['Azure, a bend Or, a canton argent.', 'Azure, a bend Or and a canton argent.'],
    ['Gules, a lion Or and a quarter argent.', 'Gules, a lion Or, a quarter argent.'],
    ['Gules, a sinister canton argent.', 'Gules, a canton sinister argent.'],
    ['Gules, a dexter canton argent.', 'Gules, a canton argent.'],
    ['Argent, a base sable.', 'Argent, a base sable.'],
    ['Azure, a fess Or, a base Or, a chief argent, a canton argent.', 'Azure, a fess and a base Or, a chief and a canton argent.'],
    ['Quarterly azure and gules, a point pointed Or.', 'Quarterly azure and gules, a point pointed Or.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('files charges on a base under their gap', () => {
    expect(explainMatch('Azure, a lion Or, on a base argent a rose gules.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'multiple-groups', detail: 'tertiary-on-base' }] });
  });
});

// A stated default is a wording of the same design, accepted at design level; never as dropped text.
describe('the matcher reads the pall, fret, label, mount and trimount, written either way', () => {
  it.each([
    ['Azure, a pall Or.', 'Azure, a pall Or.'],
    ['Azure, a pall throughout Or.', 'Azure, a pall Or.'],
    ['Lozengy argent and azure, a pall Or.', 'Lozengy argent and azure, a pall Or.'],
    ['Argent, a pall inverted bretessed sable.', 'Argent, a pall inverted bretessed sable.'],
    ['Argent, a pall voided sable.', 'Argent, a pall voided sable.'],
    ['Argent, a pall gules between three roses Or.', 'Argent, a pall gules between three roses Or.'],
    ['Azure, a fret Or.', 'Azure, a fret Or.'],
    ['Azure, a fret throughout Or.', 'Azure, a fret Or.'],
    ['Azure, a lion Or and a label argent.', 'Azure, a lion Or, a label argent.'],
    ['Azure, a lion Or, a label of three points argent.', 'Azure, a lion Or, a label argent.'],
    ['Azure, a lion Or and in chief a label argent.', 'Azure, a lion Or, a label argent.'],
    ['Per pale pean and erminois, in chief a label gules.', 'Per pale pean and erminois, a label gules.'],
    ['Vert, a trimount Or.', 'Vert, a trimount Or.'],
    ['Or, a lion gules, a mount vert.', 'Or, a lion gules and a mount vert.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('files a label of five points, a label overall, charges on a mount and a pall cotised under their own gaps or rules', () => {
    expect(explainMatch('Azure, a lion Or, a label of five points argent.').status).not.toBe('match');
    expect(classify({ key: 'regid:0', type: 'd', date: '', blazon: 'Azure, a lion Or, a label of five points argent.', headings: [] }).tags).toContain('ordinary:label-points');
    expect(explainMatch('Gules, a fleur-de-lys Or, overall a label sable.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'placement', detail: 'overall-label' }] });
    expect(explainMatch('Argent, a pall azure cotised vert.').match?.design).toBeDefined();
  });
});

describe('the matcher reads the orle, tressure, flaunches, gore and the dexter and sinister points, written either way', () => {
  it.each([
    ['Per bend argent and vert, a heart within an orle gules.', 'Per bend argent and vert, a heart within an orle gules.'],
    ['Vert, a sun and an orle Or.', 'Vert, a sun within an orle Or.'],
    ['Vert, a sun, an orle Or.', 'Vert, a sun within an orle Or.'],
    ['Gules, a rose all within an orle Or.', 'Gules, a rose within an orle Or.'],
    ['Gules, an orle argent.', 'Gules, an orle argent.'],
    ['Sable, a sheaf of arrows within a orle Or.', null],
    ['Gules, a lion within a tressure Or.', 'Gules, a lion within an orle Or.'],
    ['Gules, a lion within a double tressure Or.', 'Gules, a lion within a double tressure Or.'],
    ['Gules, a triple tressure Or.', 'Gules, a triple tressure Or.'],
    ['Sable, three bezants in pale between two flaunches Or.', 'Sable, in pale three roundels between flaunches Or.'],
    ['Argent, in pale three roses gules between a pair of flaunches sable.', 'Argent, in pale three roses gules between flaunches sable.'],
    ['Or, flaunches azure.', 'Or, flaunches azure.'],
    ['Argent, a sinister gore azure.', 'Argent, a gore sinister azure.'],
    ['Gules, a dragon argent, a gore Or.', 'Gules, a dragon argent and a gore Or.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    if (house === null) {
      expect(m.status).not.toBe('match');
      return;
    }
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('reads a dexter and a sinister point, and the widget refuses them by their own rule (RULES-C §C.3, L21)', () => {
    const m = explainMatch('Azure, a mullet, a dexter point and a sinister point argent.');
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe('Azure, a mullet and a point dexter and a point sinister argent.');
    expect(structuralIssues(m.match!.design!).map((i) => (i.code === 'structure' ? i.rule : i.code))).toEqual(['side-point', 'side-point']);
  });

  it('files charges on a gore and on flaunches, and two gores, under their gaps', () => {
    expect(explainMatch('Erminois, on a gore sinister gules a lion Or.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'multiple-groups', detail: 'tertiary-on-gore' }] });
    expect(explainMatch('Or, two gores sable.').status).not.toBe('match');
  });
});

describe('the matcher reads diminutives, counted and spelt either way', () => {
  it.each([
    ['Gules, three bars Or.', 'Gules, three bars Or.'],
    ['Azure, two chevronels ermine.', 'Azure, two chevronels ermine.'],
    ['Purpure, three bendlets argent.', 'Purpure, three bendlets argent.'],
    ['Or, four palets gules.', 'Or, four pallets gules.'],
    ['Sable, two scarpes Or.', 'Sable, two bendlets sinister Or.'],
    ['Sable, two chevronelles inverted Or.', 'Sable, two chevronels inverted Or.'],
    ['Azure, three barrulets Or.', 'Azure, three bars Or.'],
    ['Gules, a baton argent.', 'Gules, a baton argent.'],
    ['Azure, three bars wavy argent.', 'Azure, three bars wavy argent.'],
    ['Purpure, three bendlets enhanced argent.', 'Purpure, three bendlets enhanced argent.'],
    ['Gules, two chevronels between three roses Or.', 'Gules, two chevronels between three roses Or.'],
    ['Or, two pallets purpure and a bordure gules.', 'Or, two pallets purpure, a bordure gules.'],
    ['Gules, a bar Or.', 'Gules, a fess Or.'],
    ['Azure, a bendlet enhanced Or.', 'Azure, a bend enhanced Or.'],
    ['Argent, a saltorel gules.', 'Argent, a saltire couped gules.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('files several saltorels, five bars, a single one in chief and bands set between a charge under their gaps', () => {
    expect(explainMatch('Argent, three saltorels gules.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'ordinary', detail: 'saltorel-multiple' }] });
    expect(explainMatch('Argent, five bars gules.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'ordinary', detail: 'multiple' }] });
    expect(explainMatch('Or, a fleur-de-lys vert between two pallets azure.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'multiple-groups', detail: 'secondary-ordinary' }] });
    expect(explainMatch('Azure, on two bendlets Or six mullets azure.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'multiple-groups', detail: 'tertiary-on-diminutives' }] });
    expect(classify({ key: 'regid:0', type: 'd', date: '', blazon: 'Argent, a futatsutomoe, in chief a bar sable.', headings: [] }).status).toBe('gap');
  });
});

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

// Cotises, fimbriation and voiding, in the College's spellings and orders (normaliser rule 'ordinary-outlines').
describe('the matcher reads the outline of an ordinary', () => {
  it.each([
    ['Azure, a bend cotised argent.', 'Azure, a bend cotised argent.'],
    ['Azure, a bend cotissed argent.', 'Azure, a bend cotised argent.'],
    ['Azure, a bend double cotised argent.', 'Azure, a bend doubly cotised argent.'],
    ['Azure, a bend triple-cotised argent.', 'Azure, a bend triply cotised argent.'],
    ['Azure, a bend Or cotised argent.', 'Azure, a bend Or cotised argent.'],
    ['Azure, a bend, cotised Or.', 'Azure, a bend cotised Or.'],
    ['Azure, a pale cotised Or.', 'Azure, a pale endorsed Or.'],
    ['Azure, a pale Or cotised argent.', 'Azure, a pale Or endorsed argent.'],
    ['Azure, a pale doubly cotised Or.', 'Azure, a pale doubly cotised Or.'],
    ['Azure, a bend wavy cotised Or.', 'Azure, a bend wavy cotised Or.'],
    ['Azure, a bend wavy cotised plain Or.', 'Azure, a bend wavy cotised plain Or.'],
    ['Azure, a bend cotised wavy Or.', 'Azure, a bend cotised wavy Or.'],
    ['Azure, a bend between two cotises Or.', 'Azure, a bend cotised Or.'],
    ['Azure, a chevron cotised throughout argent.', 'Azure, a chevron throughout cotised argent.'],
    ['Azure, a chevron cotised between three mullets argent.', 'Azure, a chevron cotised between three mullets argent.'],
    ['Azure, a chevron Or cotised between three mullets argent.', 'Azure, a chevron Or cotised between three mullets argent.'],
    ['Sable, a chevron gules fimbriated between three lions argent.', 'Sable, a chevron gules fimbriated between three lions argent.'],
    ['Sable, a chevron gules, fimbriated, and a bordure Or.', 'Sable, a chevron gules fimbriated and a bordure Or.'],
    ['Gules, a cross voided Or.', 'Gules, a cross voided Or.'],
    ['Gules, a saltire voided throughout Or.', 'Gules, a saltire voided Or.'],
    ['Gules, a cross couped voided Or.', 'Gules, a cross couped voided Or.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('files what the widget can not draw of an outline as the gap the library names', () => {
    expect(explainMatch('Azure, a bend Or fimbriated and cotised argent.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'ordinary-treatment', detail: 'fimbriated-and-cotised' }] });
    expect(explainMatch('Azure, a bend cotised ermine.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'ordinary-treatment', detail: 'trim-fur' }] });
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
    ...BUILDER_DIVISIONS.flatMap((d) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'division', division: d }, l)).map((l): [string, string] => [`${DIVISION_NAME[d]} ${l} field`, `${DIVISION_NAME[d]} ${LINE_WORD[l]} Or and gules`])),
    ...LINED_VARIATIONS.flatMap((v) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'variation', variation: v }, l)).map((l): [string, string] => [`${VARIATION_NAME[v]} ${l} field`, `${VARIATION_NAME[v]} ${LINE_WORD[l]} Or and gules`])),
    ['per pale dancetty field', 'per pale dancetty Or and gules'],
    ['quarterly per fess embattled field', 'quarterly per fess embattled Or and gules'],
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
    ['a chevron inverted', 'azure, a chevron inverted Or'],
    ['a cross couped', 'azure, a cross couped Or'],
    ['a cross humetty', 'azure, a cross humetty Or'],
    ['a fess enhanced', 'azure, a fess enhanced Or'],
    ['a bend abased', 'azure, a bend abased Or'],
    ['a pile throughout', 'azure, a pile throughout Or'],
    ['a pile inverted', 'azure, a pile inverted Or'],
    ['a bend cotised', 'azure, a bend cotised argent'],
    ['a bend doubly cotised', 'azure, a bend doubly cotised argent'],
    ['a pale endorsed', 'azure, a pale endorsed argent'],
    ['a chevron fimbriated', 'azure, a chevron Or fimbriated argent'],
    ['a cross voided', 'azure, a cross voided Or'],
    ...DRAWN_ORDINARIES.flatMap((t) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'ordinary', type: t, inverted: false }, l)).map((l): [string, string] => [`a ${ORDINARY_NAME[t]} ${l}`, `azure, ${ordinaryWithArticle(t)} ${LINE_WORD[l]} Or`])),
    ['a chief and a bordure', 'azure, a chief and a bordure Or'],
    ['a band and a canton', 'azure, a bend Or and a canton argent'],
    ['a sinister canton', 'azure, a sinister canton argent'],
    ['a point pointed', 'azure, a point pointed Or'],
    ['several corner and edge shapes', 'azure, a fess Or, a chief argent, a base Or and a canton argent'],
    ['a charge and a quarter', 'azure, a lion Or and a quarter argent'],
    ['an orle', 'azure, a lion argent within an orle Or'],
    ['an orle of the arrangement', 'azure, a lion argent and an orle Or'],
    ['a double tressure', 'azure, a lion argent within a double tressure Or'],
    ['two flaunches', 'azure, a lion argent between two flaunches Or'],
    ['a pair of flaunches', 'azure, a pair of flaunches Or'],
    ['a sinister gore', 'azure, a sinister gore Or'],
    ['a dexter point', 'azure, a dexter point Or'],
    ['bars', 'azure, three bars Or'],
    ['bendlets sinister', 'azure, two bendlets sinister Or'],
    ['scarpes', 'azure, two scarpes Or'],
    ['palets', 'azure, four palets Or'],
    ['chevronels inverted', 'azure, two chevronels inverted Or'],
    ['barrulets', 'azure, three barrulets Or'],
    ['a baton', 'azure, a baton Or'],
    ['diminutives and a bordure', 'azure, two chevronels and a bordure Or'],
    ['diminutives between charges', 'azure, two bars between three roses Or'],
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
