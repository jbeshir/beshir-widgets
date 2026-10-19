// The widget against every current armory record in the SCA Ordinary & Armorial
// (test/fixtures/sca/oanda.db, used by tests only). Each record either passes all five checks of
// test/sca/classify.ts or is on the ignore list (test/fixtures/sca/ignored.json) with the gaps that
// stop the widget expressing it. The list is a ratchet: a listed record that starts to pass, or
// that loses the gap it is filed under, fails the test until the list is regenerated
// (`npm run sca:ignore`).
//
// Cost control: `npm test` runs the cheap checks (match, assess, blazon) on EVERY record but draws the design and replays
// the builder's clicks (the 'render' and 'builder' checks; the replay, ~40 ms a design, is most of this file's time) and
// re-runs the gap tagger on the ignored records for a seeded, rotating sample only (test/sca/sample.ts): so this file's cost
// stays roughly flat as records start passing. `npm run sca:ignore` is the authoritative full sweep over every record (the final gate runs it);
// `SCA_FULL=1 npx vitest run --project sca` makes this test do the same, `SCA_SAMPLE_SEED=<text>` picks the sample.

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, BUILDER_DIVISIONS, DIVISION_NAME, DRAWN_DIVISIONS, DRAWN_ORDINARIES, ORDINARY_NAME, DRAWN_LINES, DRAWN_TREATMENTS, LINED_VARIATIONS, LINE_WORD, FURS, FUR_NAME, SEMY_NAMES, lineAllowed, UNSUPPORTED_GAP_CATEGORIES, VARIATIONS, VARIATION_NAME,
  COTISED_HOSTS, GYRONNY_PIECES, MOD_HOSTS, ORDINARY_COUNTS, ORDINARY_KIND, ORDINARY_MODS, isDiminutive, type OrdinaryType,
  blazon, canonicalJson, isCountedVariation, normalise, ordinaryWithArticle, partCount, structuralIssues, type Division,
} from '../src/lib/heraldry';
import { generatedChargeAttributeDesigns, generatedDesign, generatedGeometryDesigns, generatedLinedOrdinaryDesigns, generatedRichDesign, generatedTreatedOrdinaryDesigns, generatedOutlinedOrdinaryDesigns, generatedPeripheralDesigns } from './design-generator';
import { arms, charge, div, group, nd, ordinary, plain } from './helpers';
import entries from '../src/data/sample-registry.json';
import { checkBlazon, classify, failureLines, listing } from './sca/classify';
import { GAP_CATEGORIES, categoryOf } from './sca/gaps';
import { readIgnoreList } from './sca/ignore-list';
import { explainMatch } from './sca/match';
import { createSampler, fullSweep, sampleSeed } from './sca/sample';
import { OANDA_SHA256, oandaSha256, readArmory, readCurrentArmory, type ArmoryRecord } from './sca/oanda';
import { rotatesIn } from './rotation';

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
  /** Which designs are drawn and get the builder replay, and which ignored records get the tagger re-run, in this run. */
  let sampler: ReturnType<typeof createSampler>;
  const options = () => ({
    drawAndBuild: (design: Parameters<typeof sampler.drawAndBuild>[0]) => sampler.drawAndBuild(design),
    tagger: (r: ArmoryRecord) => sampler.tagger(r, ignored.get(r.key)?.primary ?? ''),
  });

  beforeAll(() => {
    records = readCurrentArmory();
    byKey = new Map(records.map((r) => [r.key, r]));
    sampler = createSampler(sampleSeed(), records.length - ignored.size, fullSweep());
  });

  it('every record not on the ignore list passes all five checks', () => {
    // Shortest blazon first, so that the sampler's fixed stratum is the simplest design with each feature (test/sca/sample.ts).
    const passing = records.filter((r) => !ignored.has(r.key)).sort((a, b) => a.blazon.length - b.blazon.length);
    const problems = passing.flatMap((r) => failureLines(r, checkBlazon(r.blazon, options()).failures));
    expect(problems.length, listing(`Failing records not on the ignore list (a new gap: \`npm run sca:ignore\`; else fix the widget; sample seed ${sampleSeed()}, SCA_FULL=1 for the full sweep)`, problems)).toBe(0);
  }, 240_000);

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
      switch (c.status) {
        case 'passes': problems.push(`${key} "${record.blazon}" now passes: remove it from ignored.json (\`npm run sca:ignore\`)`); break;
        case 'fails': problems.push(...failureLines(record, c.failures)); break;
        case 'gap-unchecked': break;
        case 'gap':
          if (!c.tags.some((t) => categoryOf(t) === primary)) problems.push(`${key} "${record.blazon}" no longer has a ${primary} gap (now ${c.tags.join(', ')}): \`npm run sca:ignore\``);
          break;
        default: throw new Error(c.status satisfies never);
      }
    }
    expect(problems.length, listing(`Ignore-list entries out of date (the gap tagger is sampled: sample seed ${sampleSeed()}, SCA_FULL=1 for the full sweep)`, problems)).toBe(0);
  }, 120_000);
});

// The matcher reads whatever the widget writes: every construct the widget draws, blazoned by the
// widget, comes back from explainMatch as the very design it was written from.
const field = { k: 'divided', division: 'per-pale', parts: ['or', 'gules'] };
const swords = { v: 2, field: 'azure', groups: [group(charge('sword'), 'or', { count: 2, arrangement: 'crossed' })] };
const sun = charge('sun', { mods: [{ id: 'in-splendour', count: null, paint: null }] });
const fitchy = { id: 'fitchy', count: null, paint: null };
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
  ['a chief triangular', arms('argent', group(ordinary('chief', { lines: { a: 'triangular' } }), 'azure'))],
  ['a chevron rompu between charges', arms('or', group(ordinary('chevron', { lines: { a: 'rompu', b: 'rompu' } }), 'sable'), group(charge('mullet'), 'sable', { count: 3 }))],
  ['a bend bevilled', arms('argent', group(ordinary('bend', { lines: { a: 'bevilled', b: 'bevilled' } }), 'gules'))],
  ['a field per bend bevilled', arms({ k: 'divided', division: 'per-bend', lines: { a: 'bevilled' }, parts: ['argent', 'gules'] })],
  ['a pile ployé', arms('argent', group(ordinary('pile', { lines: { a: 'ploye', b: 'ploye' } }), 'azure'))],
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
  ['a charge in the corner beside a bend', arms('argent', group(ordinary('bend'), 'sable'), group(charge('rose'), 'gules', { position: 'chief' }))],
  ['a fess between charges under a chief', arms('azure', group(ordinary('fess'), 'or'), group(charge('rose'), 'or', { count: 3, relation: 'between' }), group(ordinary('chief'), 'or'))],
  // which way a charge faces, and two set to each other (SENA §1.1)
  ['a charge contourny', arms('azure', group(charge('lion', { facing: 'to-sinister' }), 'or'))],
  ['a charge in a posture contourny', arms('vert', group(charge('wolf', { posture: 'passant', facing: 'to-sinister' }), 'argent'))],
  ['two beasts combattant', arms('argent', group(charge('wolf', { posture: 'rampant' }), 'sable', { count: 2, arrangement: { k: 'pair', pair: 'combattant' } }))],
  ['two beasts passant respectant', arms('argent', group(charge('wolf'), 'sable', { count: 2, arrangement: { k: 'pair', pair: 'respectant' } }))],
  ['two beasts addorsed', arms('or', group(charge('lion'), 'gules', { count: 2, arrangement: { k: 'pair', pair: 'addorsed' } }))],
  ['two birds respectant', arms('azure', group(charge('eagle'), 'argent', { count: 2, arrangement: { k: 'pair', pair: 'respectant' } }))],
  ['a pale between two beasts combattant', arms('azure', group(ordinary('pale'), 'argent'), group(charge('lion'), 'or', { count: 2, relation: 'between', arrangement: { k: 'pair', pair: 'combattant' } }))],
  // which way a charge points (SENA §1.3): its orientation words, the crescent's nouns, and to center after the layout
  ['a charge fesswise', arms('azure', group(charge('sword', { orientation: 'fesswise' }), 'argent'))],
  ['a charge fesswise reversed', arms('azure', group(charge('sword', { orientation: 'fesswise-reversed' }), 'argent'))],
  ['a charge bendwise', arms('azure', group(charge('key', { orientation: 'bendwise' }), 'or'))],
  ['a charge bendwise sinister inverted', arms('azure', group(charge('sword', { orientation: 'bendwise-sinister-inverted' }), 'argent'))],
  ['a charge inverted', arms('azure', group(charge('mullet', { orientation: 'inverted' }), 'or'))],
  ['a charge reversed', arms('azure', group(charge('key', { orientation: 'reversed' }), 'or'))],
  ['a charge palewise', arms('azure', group(charge('sword', { orientation: 'palewise' }), 'argent'))],
  ['an increscent', arms('gules', group(charge('crescent', { orientation: 'fesswise' }), 'argent'))],
  ['three decrescents', arms('or', group(charge('crescent', { orientation: 'fesswise-reversed' }), 'azure', { count: 3 }))],
  ['a crescent pendant', arms('vert', group(charge('crescent', { orientation: 'inverted' }), 'or'))],
  ['three crescents to center', arms('vert', group(charge('crescent', { orientation: 'to-center' }), 'or', { count: 3, arrangement: 'in-annulo' }))],
  ['four charges in cross points to center', arms('azure', group(charge('sword', { orientation: 'to-center' }), 'argent', { count: 4, arrangement: 'in-cross' }))],
  // a star's points, voided, pierced and fimbriated charges (SENA §1.4): the points after the noun, the fimbriation after the tincture
  ['a star of six points', arms('azure', group(charge('mullet', { mods: [{ id: 'of-points', count: 6 }] }), 'or'))],
  ['three stars of eight rays', arms('gules', group(charge('estoile', { mods: [{ id: 'of-points', count: 8 }] }), 'or', { count: 3 }))],
  ['a star of six points pierced', arms('sable', group(charge('mullet', { mods: [{ id: 'of-points', count: 6 }, 'pierced'] }), 'argent'))],
  ['a star of six points voided', arms('sable', group(charge('mullet', { mods: ['voided', { id: 'of-points', count: 6 }] }), 'argent'))],
  ['a charge voided', arms('gules', group(charge('delf', { mods: ['voided'] }), 'argent'))],
  ['a charge fimbriated', arms('azure', group(charge('lozenge', { mods: [{ id: 'fimbriated', paint: 'argent' }] }), 'azure'))],
  ['three charges fimbriated and a bordure', arms('or', group(charge('roundel', { mods: [{ id: 'fimbriated', paint: 'sable' }] }), 'gules', { count: 3 }), group(ordinary('bordure'), 'azure'))],
  // postures in one word or two, and a head turned, before "contourny" when it looks out and after it when it looks back (SENA §1.1, §1.2)
  ['a beast couchant', arms('azure', group(charge('lion', { posture: 'couchant' }), 'or'))],
  ['a beast sejant erect', arms('azure', group(charge('lion', { posture: 'sejant-erect' }), 'or'))],
  ['two beasts sejant erect in pale', arms('azure', group(charge('lion', { posture: 'sejant-erect' }), 'or', { count: 2, arrangement: 'in-pale' }))],
  ['a beast passant guardant', arms('gules', group(charge('lion', { posture: 'passant', gaze: 'guardant' }), 'or'))],
  ['a beast guardant contourny', arms('gules', group(charge('lion', { gaze: 'guardant', facing: 'to-sinister' }), 'or'))],
  ['a beast contourny regardant', arms('vert', group(charge('lion', { gaze: 'regardant', facing: 'to-sinister' }), 'argent'))],
  ['three beasts passant guardant in pale', arms('gules', group(charge('lion', { posture: 'passant', gaze: 'guardant' }), 'or', { count: 3, arrangement: 'in-pale' }))],
  ['a stag lodged', arms('vert', group(charge('stag', { posture: 'couchant' }), 'or'))],
  ['three birds rising', arms('azure', group(charge('eagle', { posture: 'rising' }), 'argent', { count: 3 }))],
  // the pieces drawn with a charge (PLAN-D §0.3.5), after its tincture; a piece of the charge's tincture, or of what follows, leaves it unsaid
  ['a beast crowned', arms('azure', group(charge('lion', { parts: [{ part: 'crowned', paint: 'gules' }] }), 'or'))],
  ['a beast crowned of its own tincture', arms('gules', group(charge('lion', { parts: [{ part: 'crowned', paint: 'or' }] }), 'or'))],
  ['a beast crowned and collared', arms('azure', group(charge('lion', { parts: [{ part: 'crowned', paint: 'gules' }, { part: 'collared', paint: 'gules' }] }), 'argent'))],
  ['a beast crowned and collared each its own tincture', arms('azure', group(charge('lion', { parts: [{ part: 'crowned', paint: 'or' }, { part: 'collared', paint: 'gules' }] }), 'argent'))],
  ['a beast crowned of the next tincture', arms('or', group(charge('lion', { parts: [{ part: 'crowned', paint: 'gules' }] }), 'sable'), group(ordinary('bordure'), 'gules'))],
  ['a head collared', arms('vert', group(charge('wolf', { form: 'head', mods: ['couped'], parts: [{ part: 'collared', paint: 'or' }] }), 'argent'))],
  ['a bird crowned', arms('argent', group(charge('eagle', { parts: [{ part: 'crowned', paint: 'or' }] }), 'gules'))],
  ['a beast winged', arms('azure', group(charge('lion', { posture: 'passant', mods: [{ id: 'winged', paint: 'or' }] }), 'or'))],
  ['two hearts winged in pale', arms('argent', group(charge('heart', { mods: [{ id: 'winged', paint: 'or' }] }), 'gules', { count: 2, arrangement: 'in-pale' }))],
  ['a heart enflamed proper', arms('argent', group(charge('heart', { mods: [{ id: 'enflamed', paint: 'proper' }] }), 'gules'))],
  ['three charges enflamed', arms('azure', group(charge('sword', { mods: [{ id: 'enflamed', paint: 'gules' }] }), 'or', { count: 3 }))],
  ['three flowers slipped and leaved', arms('argent', group(charge('rose', { mods: [{ id: 'slipped', paint: 'vert' }, { id: 'leaved', paint: 'vert' }] }), 'gules', { count: 3 }))],
  ['flowers slipped and leaved on a chief', arms('azure', chiefOf(group(charge('rose', { mods: [{ id: 'slipped', paint: 'gules' }, { id: 'leaved', paint: 'gules' }] }), 'gules', { count: 3 })))],
  // what a main charge holds (PLAN-D §1.5), last; an item of the charge's tincture, or of what follows, leaves it unsaid
  ['a beast maintaining', arms('azure', group(charge('lion', { holds: [{ how: 'maintaining', item: charge('sword'), paint: 'argent' }] }), 'or'))],
  ['a beast maintaining of its own tincture', arms('azure', group(charge('lion', { holds: [{ how: 'maintaining', item: charge('sword'), paint: 'or' }] }), 'or'))],
  ['a beast sustaining, then a bordure of the held tincture', arms('vert', group(charge('lion', { holds: [{ how: 'sustaining', item: charge('key'), paint: 'or' }] }), 'argent'), group(ordinary('bordure'), 'or'))],
  ['a bird with a charge in its beak', arms('argent', group(charge('eagle', { holds: [{ how: 'in-beak', item: charge('key'), paint: 'gules' }] }), 'sable'))],
  ['a beast with a charge in its mouth', arms('or', group(charge('wolf', { holds: [{ how: 'in-mouth', item: charge('rose'), paint: 'gules' }] }), 'sable'))],
  ['a beast crowned and maintaining', arms('azure', group(charge('lion', { parts: [{ part: 'crowned', paint: 'gules' }], holds: [{ how: 'maintaining', item: charge('mullet'), paint: 'argent' }] }), 'or'))],
  ['two beasts combattant each maintaining', arms('azure', group(charge('lion', { holds: [{ how: 'maintaining', item: charge('sword'), paint: 'argent' }] }), 'or', { count: 2, arrangement: { k: 'pair', pair: 'combattant' } }))],
  ['three birds each with a charge in its beak', arms('argent', group(charge('eagle', { holds: [{ how: 'in-beak', item: charge('rose'), paint: 'gules' }] }), 'sable', { count: 3 }))],
  // a demi charge and a head, whose cut follows the noun ("a wolf's head erased")
  ['a demi charge', arms('azure', group(charge('lion', { form: 'demi' }), 'or'))],
  ['three demi charges', arms('azure', group(charge('eagle', { form: 'demi' }), 'argent', { count: 3 }))],
  ['a head couped', arms('azure', group(charge('wolf', { form: 'head', mods: ['couped'] }), 'argent'))],
  ['a head erased contourny', arms('azure', group(charge('lion', { form: 'head', facing: 'to-sinister', mods: ['erased'] }), 'or'))],
  ['three heads erased', arms('sable', group(charge('stag', { form: 'head', mods: ['erased'] }), 'or', { count: 3 }))],
  // every charge alone and in threes (the crosses in their plurals: "crosses formy"), and every charge that is drawn fitchy; a lone
  // cross couped is the ordinary of that name (App M1f), so the charge is read in threes only
  ...CHARGE_IDS.flatMap((id): Array<[string, unknown]> => [
    ...(id === 'cross-couped' ? [] : [[`a ${id}`, arms('azure', group(charge(id), 'or'))] as [string, unknown]]),
    [`three ${id}`, arms('azure', group(charge(id), 'or', { count: 3 }))],
    ...(CHARGES[id].details.includes('fitchy') ? [[`three ${id} fitchy`, arms('azure', group(charge(id, { mods: [fitchy] }), 'or', { count: 3 }))] as [string, unknown]] : []),
  ]),
  ['a cat', arms('azure', group(charge('cat', { posture: 'passant' }), 'argent'))],
  ['a bear', arms('or', group(charge('bear'), 'sable'))],
  ['a horse', arms('vert', group(charge('horse', { posture: 'courant' }), 'argent'))],
  ['a fox', arms('argent', group(charge('fox', { posture: 'sejant' }), 'gules'))],
  ['a squirrel', arms('azure', group(charge('squirrel'), 'or', { count: 3 }))],
  ['a griffin passant', arms('azure', group(charge('griffin', { posture: 'passant' }), 'or'))],
  ['griffins sejant', arms('gules', group(charge('griffin', { posture: 'sejant' }), 'argent', { count: 3 }))],
  ['a wyvern erect', arms('vert', group(charge('wyvern', { posture: 'erect' }), 'or'))],
  ['a pegasus passant', arms('azure', group(charge('pegasus', { posture: 'passant' }), 'argent'))],
  ['a sea-horse contourny', arms('argent', group(charge('seahorse', { facing: 'to-sinister' }), 'azure'))],
  ['a swan close', arms('azure', group(charge('swan', { posture: 'close' }), 'argent'))],
  ['a swan', arms('azure', group(charge('swan'), 'argent'))],
  ['a raven volant', arms('or', group(charge('raven', { posture: 'volant' }), 'sable'))],
  ['a falcon rising', arms('or', group(charge('falcon', { posture: 'rising' }), 'gules'))],
  ['three phoenixes', arms('argent', group(charge('phoenix'), 'gules', { count: 3 }))],
  ['a peacock', arms('azure', group(charge('peacock'), 'argent'))],
  ['an arrow', arms('azure', group(charge('arrow'), 'argent'))],
  ['three arrows fesswise', arms('gules', group(charge('arrow', { orientation: 'fesswise' }), 'or', { count: 3 }))],
  ['an axe reversed', arms('vert', group(charge('axe', { orientation: 'reversed' }), 'argent'))],
  ['a hammer', arms('sable', group(charge('hammer'), 'or'))],
  ['a harp', arms('azure', group(charge('harp'), 'or'))],
  ['a harp reversed', arms('azure', group(charge('harp', { orientation: 'reversed' }), 'argent'))],
  ['three pheons', arms('argent', group(charge('pheon'), 'gules', { count: 3 }))],
  ['a feather', arms('azure', group(charge('feather'), 'argent'))],
  ['a needle inverted', arms('or', group(charge('needle', { orientation: 'inverted' }), 'sable'))],
  ['an anvil', arms('gules', group(charge('anvil'), 'argent'))],
  ['a spear bendwise', arms('vert', group(charge('spear', { orientation: 'bendwise' }), 'or'))],
  ['a trident', arms('azure', group(charge('trident'), 'or'))],
  ['a thistle', arms('argent', group(charge('thistle'), 'proper'))],
  ['three laurel wreaths', arms('azure', group(charge('laurel-wreath'), 'or', { count: 3 }))],
  ['an oak leaf bendwise', arms('argent', group(charge('oak-leaf', { orientation: 'bendwise' }), 'vert'))],
  ['an acorn slipped and leaved', arms('azure', group(charge('acorn', { mods: [{ id: 'slipped', paint: 'vert' }, { id: 'leaved', paint: 'vert' }] }), 'or'))],
  ['a pomegranate', arms('argent', group(charge('pomegranate'), 'gules'))],
  ['a garb', arms('azure', group(charge('garb'), 'or'))],
  ['a lily', arms('azure', group(charge('lily'), 'argent'))],
  ['three escallops inverted', arms('gules', group(charge('escallop', { orientation: 'inverted' }), 'argent', { count: 3 }))],
  ['a dolphin haurient', arms('azure', group(charge('dolphin', { posture: 'haurient' }), 'argent'))],
  ['a dolphin contourny', arms('azure', group(charge('dolphin', { facing: 'to-sinister' }), 'or'))],
  ['a dragonfly bendwise', arms('sable', group(charge('dragonfly', { orientation: 'bendwise' }), 'argent'))],
  ['a butterfly', arms('azure', group(charge('butterfly'), 'or'))],
  ['a serpent glissant', arms('argent', group(charge('serpent', { posture: 'glissant' }), 'vert'))],
  ['a frog', arms('argent', group(charge('frog'), 'vert'))],
  ['a spider', arms('argent', group(charge('spider'), 'sable'))],
  ['a scorpion', arms('or', group(charge('scorpion'), 'sable'))],
  ['a horse\'s head and a bear\'s head', arms('azure', group(charge('horse', { form: 'head', mods: ['couped'] }), 'argent'), group(charge('bear', { form: 'head', mods: ['erased'] }), 'or'))],
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

  // The 1,500 seeds of each of the two oldest generators are a seeded rotating third (`rotatesIn`; SCA_FULL=1 for all); every other family whole.
  const seeds = (generator: string) => Array.from({ length: 1500 }, (_, seed) => seed).filter((seed) => rotatesIn(`${generator}|${seed}`, 1 / 3));

  it('reads the blazon of every generated design and every sample entry', () => {
    const designs = [
      ...generatedGeometryDesigns(1, 300),
      ...generatedLinedOrdinaryDesigns(1, 200),
      ...generatedTreatedOrdinaryDesigns(1, 120),
      ...generatedOutlinedOrdinaryDesigns(1, 120),
      ...generatedPeripheralDesigns(1, 120),
      ...generatedChargeAttributeDesigns(1, 200),
      ...seeds('level0').map(generatedDesign),
      ...seeds('rich').map(generatedRichDesign),
      ...entries.entries.map((e) => normalise(e.design).design),
    ].filter((d) => d !== null);
    expect(designs.length).toBeGreaterThan(400);
    const unread = designs.filter((d) => {
      const m = explainMatch(blazon(d));
      return !m.match || canonicalJson(m.match.design!) !== canonicalJson(d);
    });
    expect(unread.map((d) => blazon(d)), `sample seed ${sampleSeed()}`).toEqual([]);
  }, 30_000);
});

// The drawn crosses and shapes as the SCA spells them: each reads as the widget's own design.
describe('the matcher reads the drawn crosses and shapes in the College\'s spellings', () => {
  const read = (text: string) => explainMatch(text).match?.design ?? null;
  const same = (text: string, widget: string) => {
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!), text).toBe(canonicalJson(read(widget)!));
  };
  it.each([
    ['Azure, a cross fleury Or.', 'Azure, a cross flory Or.'],
    ['Azure, three crosses fleury Or.', 'Azure, three crosses flory Or.'],
    ['Azure, a cross fleurie Or.', 'Azure, a cross flory Or.'],
    ['Azure, a cross pattee Or.', 'Azure, a cross formy Or.'],
    ['Azure, a cross patty Or.', 'Azure, a cross formy Or.'],
    ['Azure, a cross paty Or.', 'Azure, a cross formy Or.'],
    ['Azure, a cross pattée Or.', 'Azure, a cross formy Or.'],
    ['Azure, three crosses formée Or.', 'Azure, three crosses formy Or.'],
    ['Azure, a cross botonny Or.', 'Azure, a cross bottony Or.'],
    ['Azure, three crosses bottonny Or.', 'Azure, three crosses bottony Or.'],
    ['Azure, a cross pattonce Or.', 'Azure, a cross patonce Or.'],
    ['Azure, a cross formy fitched Or.', 'Azure, a cross formy fitchy Or.'],
    ['Azure, a cross formy fitchée Or.', 'Azure, a cross formy fitchy Or.'],
    ['Azure, a cross formy fitchy at the foot Or.', 'Azure, a cross formy fitchy Or.'],
    ['Azure, three crosses fleury fitched Or.', 'Azure, three crosses flory fitchy Or.'],
    ['Azure, a cross crosslet fitched Or.', 'Azure, a cross crosslet fitchy Or.'],
    ['Azure, a crosslet fitchy Or.', 'Azure, a cross crosslet fitchy Or.'],
    ['Azure, a compass-star Or.', 'Azure, a compass star Or.'],
    ['Azure, three compass-stars Or.', 'Azure, three compass stars Or.'],
    ['Azure, three triquetrae Or.', 'Azure, three triquetras Or.'],
    ['Azure, a Maltese cross Or.', 'Azure, a maltese cross Or.'],
    ['Azure, three Latin crosses Or.', 'Azure, three latin crosses Or.'],
  ])('%s', (text, widget) => same(text, widget));


  it('reads "cross flory" and "cross fleury" as the one charge, and a cross couped with its article as the ordinary', () => {
    expect(read('Azure, a cross flory Or.')!.groups[0].item).toMatchObject({ k: 'charge', charge: 'cross-flory' });
    expect(read('Azure, a cross couped Or.')!.groups[0].item).toMatchObject({ k: 'ordinary', type: 'cross' });
  });


  it('leaves the ordinary cross fitchy, a cross fitchy at all points and the equal-armed Celtic cross unmatched, under their gaps', () => {
    for (const text of ['Azure, a cross fitchy Or.', 'Azure, a cross formy fitchy at all points Or.', 'Azure, an equal-armed Celtic cross Or.']) {
      expect(explainMatch(text).match, text).toBeNull();
    }
    const tags = (text: string) => classify({ key: 'regid:0', type: 'd', date: '', blazon: text, headings: [] }).tags;
    expect(tags('Azure, a cross formy fitchy at all points Or.')).toEqual(['charge-modifier:fitchy-at-all-points']);
    expect(tags('Azure, an equal-armed Celtic cross Or.')).toEqual(['charge-cross:equal-armed-celtic']);
  });


  // The Details disclosure sets a cross fitchy, so a matched design that needs one passes (D6b).
  it('passes a fitchy cross, which the builder draws by its Details toggle', () => {
    const c = classify({ key: 'regid:0', type: 'd', date: '', blazon: 'Azure, three crosses formy fitchy Or.', headings: [] });
    expect([c.status, c.failures]).toEqual(['passes', []]);
  });
});


// Which way a charge faces, and two set to each other, as the SCA writes them: each reads as the widget's own design (SENA §1.1).
describe('the matcher reads which way a charge faces in the College\'s words', () => {
  const read = (text: string) => explainMatch(text).match?.design ?? null;
  it.each([
    ['Azure, a lion rampant to sinister Or.', 'Azure, a lion contourny Or.'],
    ['Azure, a lion contourné Or.', 'Azure, a lion contourny Or.'],
    ['Azure, a lion contourney Or.', 'Azure, a lion contourny Or.'],
    ['Vert, a wolf passant facing to sinister argent.', 'Vert, a wolf passant contourny argent.'],
    ['Azure, an eagle displayed facing sinister Or.', 'Azure, an eagle contourny Or.'],
    ['Argent, two wolves combatant sable.', 'Argent, two wolves combattant sable.'],
    ['Argent, two wolves rampant respectant sable.', 'Argent, two wolves combattant sable.'],
    ['Argent, two wolves rampant combattant sable.', 'Argent, two wolves combattant sable.'],
    ['Or, two wolves passant combattant gules.', 'Or, two wolves passant respectant gules.'],
    ['Azure, two eagles combattant argent.', 'Azure, two eagles respectant argent.'],
    ['Or, two lions rampant endorsed gules.', 'Or, two lions addorsed gules.'],
    ['Azure, two lions combattant Or.', 'Azure, two lions combattant Or.'],
    ['Gules, a lion passant gardant Or.', 'Gules, a lion passant guardant Or.'],
    ['Gules, a lion rampant guardant Or.', 'Gules, a lion guardant Or.'],
    ['Gules, a lion rampant contourny guardant Or.', 'Gules, a lion guardant contourny Or.'],
    ['Vert, a lion regardant contourny argent.', 'Vert, a lion contourny regardant argent.'],
    ['Vert, a lion reguardant argent.', 'Vert, a lion regardant argent.'],
    ['Vert, a lion sejant erect to sinister argent.', 'Vert, a lion sejant erect contourny argent.'],
    ['Or, two lions rampant addorsed regardant gules.', 'Or, two lions regardant addorsed gules.'],
    ['Purpure, a stag salient argent.', 'Purpure, a stag springing argent.'],
    ['Vert, three stags passant Or.', 'Vert, three stags trippant Or.'],
  ])('%s', (text, widget) => {
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });

  it('reads a pale endorsed as its cotises, and leaves three beasts combattant, two keys addorsed and a head turned where it is not drawn to their gaps', () => {
    expect(read('Azure, a pale endorsed argent.')!.groups[0].item).toMatchObject({ k: 'ordinary', type: 'pale', cotised: { count: 1 } });
    const tags = (text: string) => classify({ key: 'regid:0', type: 'd', date: '', blazon: text, headings: [] }).tags;
    expect(tags('Azure, three lions combattant Or.')).toEqual(['posture:combattant']);
    expect(tags('Azure, two keys addorsed Or.')).toEqual(['posture:addorsed']);
    expect(tags('Azure, a lion couchant guardant Or.')).toEqual(['posture:guardant']);
    expect(tags('Azure, a wolf regardant Or.')).toEqual(['posture:regardant']);
    expect(tags('Azure, a lion statant erect Or.')).toEqual(['posture:statant-erect']);
    expect(tags('Azure, a lion\'s head guardant Or.')).toEqual(['posture:guardant']);
    expect(tags('Azure, a lion passant guardant Or.')).toEqual([]);
  });
});

// Which way a charge points, as the SCA writes it: each reads as the widget's own design (SENA §1.3); a charge that is not turned that way keeps its gap.
describe('the matcher reads which way a charge points in the College\'s words', () => {
  const read = (text: string) => explainMatch(text).match?.design ?? null;
  it.each([
    ['Azure, a sword fesswise argent.', 'Azure, a sword fesswise argent.'],
    ['Azure, a sword barwise argent.', 'Azure, a sword fesswise argent.'],
    ['Azure, a sword inverted bendwise argent.', 'Azure, a sword bendwise inverted argent.'],
    ['Azure, a sword bendwise sinister inverted argent.', 'Azure, a sword bendwise sinister inverted argent.'],
    ['Vert, a crescent inverted Or.', 'Vert, a crescent pendant Or.'],
    ['Gules, an increscent argent.', 'Gules, an increscent argent.'],
    ['Or, three decrescents azure.', 'Or, three decrescents azure.'],
    ['Azure, four swords in cross points to center argent.', 'Azure, four swords in cross points to center argent.'],
  ])('%s', (text, widget) => {
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });

  it('files a charge turned a way it is not, or a lion turned at all, under its orientation', () => {
    const tags = (text: string) => classify({ key: 'regid:0', type: 'd', date: '', blazon: text, headings: [] }).tags;
    expect(tags('Azure, a lion inverted Or.')).toEqual(['orientation:inverted']);
    expect(tags('Azure, a mullet fesswise Or.')).toEqual(['orientation:fesswise']);
    expect(tags('Azure, a sword saltirewise argent.')).toEqual(['orientation:saltirewise']);
  });
});

// A star's points and a charge's details, as the SCA writes them: each reads as the widget's own design (SENA §1.4); a charge that does
// not take a detail, or a number of points the widget doesn't draw, keeps its gap.
describe('the matcher reads demi charges and heads in the College\'s words', () => {
  const read = (text: string) => explainMatch(text).match?.design ?? null;
  it.each([
    ['Azure, a demi-lion Or.', 'Azure, a demi-lion Or.'],
    ['Azure, a demi lion rampant Or.', 'Azure, a demi-lion Or.'],
    ['Gules, three demi-eagles displayed argent.', 'Gules, three demi-eagles argent.'],
    ['Vert, a wolf\'s head erased argent.', 'Vert, a wolf\'s head erased argent.'],
    ['Vert, a wolf\'s head argent.', 'Vert, a wolf\'s head couped argent.'],
    ['Sable, three stags\' heads couped Or.', 'Sable, three stags\' heads couped Or.'],
    ['Sable, a lion\'s head contourny erased Or.', 'Sable, a lion\'s head erased contourny Or.'],
    ['Sable, two lions\' heads erased respectant Or.', 'Sable, two lions\' heads erased respectant Or.'],
  ])('%s', (text, widget) => {
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });

  it('files what the widget does not draw of them under their gaps', () => {
    const tags = (text: string) => classify({ key: 'regid:0', type: 'd', date: '', blazon: text, headings: [] }).tags;
    expect(tags('Azure, a demi-boar Or.')).toEqual(['charge-modifier:demi']);
    expect(tags('Azure, a goat\'s head erased Or.')).toEqual(['charge-beast:goat-head', 'charge-modifier:erased']);
    expect(tags('Azure, a lion erased Or.')).toEqual(['charge-modifier:erased']);
    expect(tags('Azure, a demi-lion erased Or.')).toEqual(['charge-modifier:erased']);
  });
});

describe('the matcher reads a star\'s points and a charge\'s details in the College\'s words', () => {
  const read = (text: string) => explainMatch(text).match?.design ?? null;
  it.each([
    ['Azure, a mullet of six points Or.', 'Azure, a mullet of six points Or.'],
    ['Azure, a mullet of five points Or.', 'Azure, a mullet Or.'],
    ['Azure, three mullets of five points Or.', 'Azure, three mullets Or.'],
    ['Gules, an estoile of six rays Or.', 'Gules, an estoile Or.'],
    ['Gules, an estoile of eight points Or.', 'Gules, an estoile of eight rays Or.'],
    ['Sable, a mullet of six points voided argent.', 'Sable, a mullet of six points voided argent.'],
    ['Sable, a mullet of six points pierced argent.', 'Sable, a mullet of six points pierced argent.'],
    ['Azure, a mullet pierced Or.', 'Azure, a mullet pierced Or.'],
    ['Azure, a triangle voided Or.', 'Azure, a triangle voided Or.'],
    ['Azure, a lozenge azure fimbriated argent.', 'Azure, a lozenge azure fimbriated argent.'],
    ['Or, a roundel gules fimbriated sable, a bordure azure.', 'Or, a roundel gules fimbriated sable, a bordure azure.'],
  ])('%s', (text, widget) => {
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });

  it('keeps the fimbriation\'s tincture its own: the charge\'s is not carried into it, nor it into the charge', () => {
    const item = (text: string) => read(text)!.groups[0].item;
    expect(item('Azure, a roundel gules fimbriated Or.')).toMatchObject({ mods: [{ id: 'fimbriated', paint: { k: 'tincture', t: 'or' } }] });
    expect(read('Azure, a roundel gules fimbriated Or.')!.groups[0].paint).toEqual({ k: 'tincture', t: 'gules' });
  });

  it('files points the widget does not draw, and a detail on a charge that does not take it, under their gaps', () => {
    const tags = (text: string) => classify({ key: 'regid:0', type: 'd', date: '', blazon: text, headings: [] }).tags;
    expect(tags('Azure, a mullet of five greater and five lesser points Or.')).toEqual(['charge-modifier:points']);
    expect(tags('Azure, a rose voided Or.')).toEqual(['charge-modifier:voided']);
    expect(tags('Azure, a lion pierced Or.')).toEqual(['charge-modifier:pierced']);
    expect(tags('Azure, a heart gules fimbriated Or.')).toEqual(['charge-modifier:fimbriated']);
  });
});

// A line on the field is read from the College's spellings; a division draws one line, so "per pale dancetty" is indented (RULES §A.3).
// The pieces drawn with a charge (PLAN-D §0.3.5), as the SCA writes them: crowned, collared (a ducal coronet about the neck), winged (a
// winged beast), enflamed, slipped and leaved; each run of them takes the tincture it states, else the next one stated.
describe('the matcher reads the pieces drawn with a charge in the College\'s words', () => {
  const read = (text: string) => explainMatch(text).match?.design ?? null;
  it.each([
    ['Gules, a lion rampant crowned Or.', 'Gules, a lion crowned Or.'],
    ['Azure, a lion Or ducally crowned gules.', 'Azure, a lion Or crowned gules.'],
    ['Azure, a lion Or crowned with a ducal coronet gules.', 'Azure, a lion Or crowned gules.'],
    ['Vert, a wolf rampant argent gorged of a ducal coronet Or.', 'Vert, a wolf rampant argent collared Or.'],
    ['Azure, a lion argent crowned Or and collared gules.', 'Azure, a lion argent crowned Or collared gules.'],
    ['Azure, a winged lion passant Or.', 'Azure, a lion passant winged Or.'],
    ['Azure, a winged lion passant argent winged Or.', 'Azure, a lion passant argent winged Or.'],
    ['Sable, a winged heart Or.', 'Sable, a heart winged Or.'],
    ['Argent, a heart gules inflamed proper.', 'Argent, a heart gules enflamed proper.'],
    ['Or, a rose, slipped and leaved, gules.', 'Or, a rose slipped and leaved gules.'],
    ['Ermine, a rose gules, slipped and leaved vert.', 'Ermine, a rose gules slipped and leaved vert.'],
    ['Azure, on a chief Or three roses slipped and leaved gules.', 'Azure, on a chief Or three roses slipped and leaved gules.'],
  ])('%s', (text, widget) => {
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });

  it('gives a piece the tincture it states, else the next one stated, and the charge the piece\'s when it states none', () => {
    const first = (text: string) => read(text)!.groups[0];
    const or = { k: 'tincture', t: 'or' }, gules = { k: 'tincture', t: 'gules' }, vert = { k: 'tincture', t: 'vert' };
    expect(first('Azure, a lion Or crowned gules.')).toMatchObject({ paint: or, item: { parts: [{ part: 'crowned', paint: gules }] } });
    expect(first('Azure, a lion crowned Or.')).toMatchObject({ paint: or, item: { parts: [{ part: 'crowned', paint: or }] } });
    expect(first('Argent, a rose gules slipped and leaved, a chief vert.')).toMatchObject({ paint: gules, item: { mods: [{ id: 'slipped', paint: vert }, { id: 'leaved', paint: vert }] } });
  });

  it('files a piece on a charge or drawing that has no place for it under its gap', () => {
    const tags = (text: string) => classify({ key: 'regid:0', type: 'd', date: '', blazon: text, headings: [] }).tags;
    expect(tags('Azure, a winged lion sejant Or.')).toEqual(['charge-modifier:winged']);
    expect(tags('Azure, a mullet crowned Or.')).toEqual(['charge-modifier:crowned']);
    expect(tags('Azure, a demi-lion crowned Or.')).toEqual(['charge-modifier:crowned']);
  });
});

// The beasts of art batch B1 in the College's words: "domestic cat" is the cat.
describe('the matcher reads the College\'s names for the beasts of art batch B1', () => {
  it.each([
    ['Azure, a domestic cat passant argent.', 'Azure, a cat passant argent.'],
    ['Argent, two domestic cats sejant respectant sable.', 'Argent, two cats sejant respectant sable.'],
  ])('%s', (text, widget) => {
    const read = (b: string) => explainMatch(b).match?.design ?? null;
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });
});


// The monsters and birds of art batches B2 and B3 in the College's words: the spellings they use, and the swan rising is rousant (60 records
// against 11 for "rising"; the posture is its default, so it is left unsaid).
describe('the matcher reads the College\'s names for the monsters and birds of art batches B2 and B3', () => {
  it.each([
    ['Azure, a gryphon passant Or.', 'Azure, a griffin passant Or.'],
    ['Gules, three griffons sejant argent.', 'Gules, three griffins sejant argent.'],
    ['Vert, a wivern erect Or.', 'Vert, a wyvern erect Or.'],
    ['Sable, a phenix Or.', 'Sable, a phoenix Or.'],
    ['Argent, a sea horse azure.', 'Argent, a sea-horse azure.'],
    ['Argent, three seahorses azure.', 'Argent, three sea-horses azure.'],
    ['Or, a sea lion gules.', 'Or, a sea-lion gules.'],
    ['Azure, a swan rousant argent.', 'Azure, a swan argent.'],
    ['Azure, a swan rising argent.', 'Azure, a swan argent.'],
    ['Azure, a swan close argent.', 'Azure, a swan close argent.'],
  ])('%s', (text, widget) => {
    const read = (b: string) => explainMatch(b).match?.design ?? null;
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });
});

// The tools and weapons of art batch B4 in the College's words: "ax" is the axe (18 records) and a broad arrow the pheon (105).
describe('the matcher reads the College\'s names for the tools and weapons of art batch B4', () => {
  it.each([
    ['Gules, an ax argent.', 'Gules, an axe argent.'],
    ['Azure, three broad arrows Or.', 'Azure, three pheons Or.'],
    ['Azure, a broadarrow Or.', 'Azure, a pheon Or.'],
    ['Azure, a broad-arrow Or.', 'Azure, a pheon Or.'],
  ])('%s', (text, widget) => {
    const read = (b: string) => explainMatch(b).match?.design ?? null;
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });
});


// The sea creatures of art batch B6 in the College's words: a scallop (shell) is the escallop (Table 5), a dolphin's embowing is not blazoned.
describe('the matcher reads the College\'s names for the escallop and the dolphin of art batch B6', () => {
  it.each([
    ['Gules, three scallop shells argent.', 'Gules, three escallops argent.'],
    ['Gules, a scallop argent.', 'Gules, an escallop argent.'],
    ['Azure, a dolphin embowed argent.', 'Azure, a dolphin argent.'],
    ['Azure, a dolphin naiant embowed argent.', 'Azure, a dolphin argent.'],
    ['Azure, a dolphin hauriant argent.', 'Azure, a dolphin haurient argent.'],
  ])('%s', (text, widget) => {
    const read = (b: string) => explainMatch(b).match?.design ?? null;
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });
});


// What a main charge holds (PLAN-D §1.5), as the SCA writes it: maintaining or sustaining (holding, grasping, supporting), or in its beak or
// mouth however it is held; "each" for more than one charge; the item's tincture as stated, else the next one stated.
describe('the matcher reads what a charge holds in the College\'s words', () => {
  const read = (text: string) => explainMatch(text).match?.design ?? null;
  it.each([
    ['Azure, a lion rampant Or maintaining a sword argent.', 'Azure, a lion Or maintaining a sword argent.'],
    ['Azure, a lion Or, maintaining a sword argent.', 'Azure, a lion Or maintaining a sword argent.'],
    ['Azure, a lion Or holding a sword argent.', 'Azure, a lion Or maintaining a sword argent.'],
    ['Azure, a lion Or grasping a key argent.', 'Azure, a lion Or maintaining a key argent.'],
    ['Argent, an eagle sable holding in its beak a key gules.', 'Argent, an eagle sable maintaining in its beak a key gules.'],
    ['Argent, an eagle sable bearing in his beak a key gules.', 'Argent, an eagle sable maintaining in its beak a key gules.'],
    ['Or, a wolf rampant sable sustaining in its mouth a rose gules.', 'Or, a wolf rampant sable maintaining in its mouth a rose gules.'],
    ['Azure, two lions combattant Or each maintaining a sword argent.', 'Azure, two lions combattant Or each maintaining a sword argent.'],
  ])('%s', (text, widget) => {
    expect(read(text), text).not.toBeNull();
    expect(canonicalJson(read(text)!)).toBe(canonicalJson(read(widget)!));
  });

  it('gives the held item the tincture it states, else the next one stated, and the charge the item\'s when it states none', () => {
    const first = (text: string) => read(text)!.groups[0];
    const or = { k: 'tincture', t: 'or' }, argent = { k: 'tincture', t: 'argent' };
    expect(first('Azure, a lion maintaining a sword Or.')).toMatchObject({ paint: or, item: { holds: [{ how: 'maintaining', item: { charge: 'sword' }, paint: or }] } });
    expect(first('Vert, a lion argent sustaining a key, a bordure Or.')).toMatchObject({ paint: argent, item: { holds: [{ how: 'sustaining', paint: or }] } });
  });

  it('leaves unread what the widget doesn\'t draw: two items, an item turned, an item between two charges, a held charge of a secondary group', () => {
    for (const text of [
      'Azure, a lion Or maintaining a sword and a key argent.', 'Azure, a lion Or maintaining a sword fesswise argent.',
      'Azure, two lions combattant Or maintaining a sword argent.', 'Azure, a fess argent between three lions Or each maintaining a sword argent.',
    ]) expect(read(text), text).toBeNull();
  });

  it('files a hold the widget doesn\'t draw under its gap, and one it draws under none', () => {
    const tags = (text: string) => classify({ key: 'regid:0', type: 'd', date: '', blazon: text, headings: [] }).tags;
    expect(tags('Azure, a lion Or maintaining a sword and a key argent.')).toEqual(['charge-modifier:maintaining']);
    expect(tags('Azure, a boar Or maintaining a sword argent.')).toEqual(['charge-modifier:maintaining']);
    expect(tags('Azure, a demi-lion Or maintaining a sword argent.')).toEqual(['charge-modifier:maintaining']);
    expect(tags('Azure, a lion Or maintaining a rose gules, slipped and leaved vert.')).toEqual(['charge-modifier:maintaining']);
  });
});

describe('the matcher reads the lines of the field', () => {
  it.each([
    ['Per pale undy argent and azure, a mullet Or.', 'Per pale wavy argent and azure, a mullet Or.'],
    ['Per fess crenellated Or and gules, a mullet argent.', 'Per fess embattled Or and gules, a mullet argent.'],
    ['Per pale dancetty Or and gules, a mullet argent.', 'Per pale indented Or and gules, a mullet argent.'],
    ['Per chevron ployé argent and gules, a mullet Or.', 'Per chevron ployé argent and gules, a mullet Or.'],
    ['Per chevron ployee argent and gules, a mullet Or.', 'Per chevron ployé argent and gules, a mullet Or.'],
    ['Per bend beviled argent and gules.', 'Per bend bevilled argent and gules.'],
    ['Per bend sinister bevelled argent and gules, a mullet Or.', 'Per bend sinister bevilled argent and gules, a mullet Or.'],
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
    ['Argent, a chief triangular azure.', 'Argent, a chief triangular azure.'],
    ['Or, a chevron rompú sable between three mullets argent.', 'Or, a chevron rompu sable between three mullets argent.'],
    ['Sable, a chevron rompu inverted Or.', 'Sable, a chevron inverted rompu Or.'],
    ['Argent, a bend bevilled gules.', 'Argent, a bend bevilled gules.'],
    ['Argent, a bend sinister bevilled gules.', 'Argent, a bend sinister bevilled gules.'],
    ['Azure, a pile ployé argent.', 'Azure, a pile ployé argent.'],
    ['Gules, a cross throughout argent.', 'Gules, a cross argent.'],
    ['Azure, a fess enhanced Or.', 'Azure, a fess enhanced Or.'],
    ['Azure, a bendlet enhanced Or.', 'Azure, a bend enhanced Or.'],
    ['Azure, a bend sinister abased argent.', 'Azure, a bend sinister abased argent.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('reads rompu, triangular and bevilled off their hosts and leaves the host rule to refuse them; a second line on them is not read', () => {
    const refused = (text: string) => { const m = explainMatch(text); return m.status === 'match' ? structuralIssues(m.match!.design!).filter((i) => i.code === 'structure' && i.rule === 'line').length : -1; };
    expect([refused('Azure, a fess triangular Or.'), refused('Azure, a chief rompu Or.'), refused('Azure, a fess bevilled Or.'), refused('Azure, a chief triangular Or.')]).toEqual([1, 1, 1, 0]);
    expect(explainMatch('Azure, a chief triangular embattled Or.').status).not.toBe('match');
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

// The divisions behind "More divisions": per chevron inverted and throughout, gyronny with its count and arrondi line.
describe('the matcher reads per chevron inverted, per chevron throughout and gyronny', () => {
  it.each([
    ['Per chevron inverted purpure and argent.', 'Per chevron inverted purpure and argent.'],
    ['Per chevron reversed argent and sable.', 'Per chevron inverted argent and sable.'],
    ['Per chevron inverted embattled argent and sable, a rose gules.', 'Per chevron inverted embattled argent and sable, a rose gules.'],
    ['Per chevron inverted dancetty argent and sable.', 'Per chevron inverted indented argent and sable.'],
    ['Per chevron throughout argent and gules, an eagle counterchanged.', 'Per chevron throughout argent and gules, an eagle counterchanged.'],
    ['Gyronny Or and purpure, a wolf statant vert.', 'Gyronny Or and purpure, a wolf statant vert.'],
    ['Gyronny of six argent and gules.', 'Gyronny of six argent and gules.'],
    ['Gyronny of twelve sable and argent.', 'Gyronny of twelve sable and argent.'],
    ['Gyronny arrondi argent and gules, a lion Or.', 'Gyronny arrondi argent and gules, a lion Or.'],
    ['Gyronny arrondy of six gules and argent.', 'Gyronny arrondi of six gules and argent.'],
    ['Gyronny wavy ermine and azure.', 'Gyronny wavy ermine and azure.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('reads a gyronny of eight as the default it is, and files other counts, and a band or picture so divided, under their gaps', () => {
    expect(explainMatch('Gyronny of eight Or and sable.').status).toBe('near-miss');
    expect(explainMatch('Gyronny of ten Or and sable.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'division', detail: 'gyronny-pieces-10' }] });
    expect(explainMatch('Azure, a lion per chevron inverted argent and gules.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'division', detail: 'per-chevron-inverted-on-charge' }] });
    // arrondi is drawn on a gyronny only: elsewhere it is not read, and the tagger files it under its division
    expect(explainMatch('Per saltire arrondi argent and gules.').status).toBe('unparsed');
    expect(classify({ key: 'regid:0', type: 'd', date: '', blazon: 'Per saltire arrondi argent and gules.', headings: [] })).toMatchObject({ status: 'gap', tags: ['division:per-saltire-arrondi'] });
    expect(explainMatch('Azure, a bend gyronny Or and sable.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'division', detail: 'gyronny-on-charge' }] });
  });
});

// The divisions in three: the field reads "A, B and C" up to its own end (not the first comma), with the serial comma or without.
describe('the matcher reads per pall, per pall inverted and the tierced divisions', () => {
  it.each([
    ['Per pall ermine, sable and gules.', 'Per pall ermine, sable and gules.'],
    ['Per pall argent, sable, and gules, a cross crosslet sable and two crosses crosslet Or.', 'Per pall argent, sable and gules, a cross crosslet sable and two crosses crosslet Or.'],
    ['Per pall Or, sable and purpure, a chief vert.', 'Per pall Or, sable and purpure, a chief vert.'],
    ['Per pall inverted argent, azure and sable.', 'Per pall inverted argent, azure and sable.'],
    ['Per pall inverted azure vert and Or.', 'Per pall inverted azure, vert and Or.'],
    ['Tierced per pale azure, argent and gules.', 'Tierced in pale azure, argent and gules.'],
    ['Tierced in fess gules, argent, and vert, a bordure Or.', 'Tierced in fess gules, argent and vert, a bordure Or.'],
    ['Tierced per pall azure, Or, and argent, a bordure sable.', 'Per pall azure, Or and argent, a bordure sable.'],
    ['Gyronny of three argent, sable and gules.', 'Per pall argent, sable and gules.'],
    ['Per pall wavy Or, gules and argent, a base vert.', 'Per pall wavy Or, gules and argent, a base vert.'],
  ])('%s', (text, house) => {
    const m = explainMatch(text);
    expect(m.status).toBe('match');
    expect(blazon(m.match!.design!)).toBe(house);
  });

  it('files counterchanging over three parts, and a band or picture so divided, under their gaps', () => {
    expect(explainMatch('Per pall inverted argent, sable and gules, in pale a sun counterchanged and a heart argent.')).toMatchObject({ status: 'unsupported', gaps: [{ category: 'division', detail: 'counterchanged-over-three-parts' }] });
    expect(explainMatch('Azure, a lion per pall argent, gules and Or.').status).not.toBe('match');
    expect(classify({ key: 'regid:0', type: 'd', date: '', blazon: 'Azure, a lion per pall argent, gules and Or.', headings: [] }).tags).toContain('division:per-pall-on-charge');
    expect(classify({ key: 'regid:0', type: 'd', date: '', blazon: 'Tierced argent, gules and Or.', headings: [] }).tags).toContain('division:tierced');
  });
});

describe('the matcher reads one charge beside a bend in its corner, written either way', () => {
  it('reads "in sinister chief" and "in chief" beside a bend as the one design, and not two or more', () => {
    const corner = (text: string) => explainMatch(text).match?.design?.groups.find((g) => g.role === 'secondary')?.position;
    expect(corner('Argent, a bend sable and in sinister chief a rose gules.')).toBe('chief');
    expect(corner('Argent, a bend sable and in chief a rose gules.')).toBe('chief');
    expect(corner('Argent, a bend sable, in sinister chief a rose gules.')).toBe('chief');
    expect(corner('Vert, a bend sinister Or and in dexter chief a mullet argent.')).toBe('chief');
    expect(corner('Argent, a bend sable and in dexter base a rose gules.')).toBe('base');
    expect(explainMatch('Argent, a bend sable and in dexter chief a rose gules.').status).not.toBe('match');
    expect(explainMatch('Argent, a bend sable and in sinister chief two roses gules.').status).not.toBe('match');
  });

  it('files a lone charge in the free corner beside a bend as set in chief, not in a quarter', () => {
    const tags = classify({ key: 'regid:0', type: 'd', date: '', blazon: 'Azure, a bend invected Or and in sinister chief a Latin cross bottony argent.', headings: [] }).tags;
    expect(tags.some((t) => t.startsWith('placement:in-sinister-chief'))).toBe(false);
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
    ['Azure, a wolf couchant Or.', ['posture:couchant']],
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
  /** A division's tinctures as a blazon names them: two, or three for per pall and the tierced divisions. */
  const partTinctures = (d: Division) => (partCount(d) === 3 ? 'Or, gules and argent' : 'Or and gules');
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
    ...DRAWN_DIVISIONS.map((d): [string, string] => [`${DIVISION_NAME[d]} field`, `${DIVISION_NAME[d]} ${partTinctures(d)}`]),
    ...DRAWN_DIVISIONS.flatMap((d) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'division', division: d }, l)).map((l): [string, string] => [`${DIVISION_NAME[d]} ${l} field`, `${DIVISION_NAME[d]} ${LINE_WORD[l]} ${partTinctures(d)}`])),
    ['tierced per pale field', 'tierced per pale azure, argent and gules'],
    ['tierced per fess field', 'tierced per fesse azure, argent and gules'],
    ['per pall with a serial comma', 'per pall argent, sable, and gules'],
    ['gyronny of three', 'gyronny of three argent, sable and gules'],
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
    ['a charge contourny', 'azure, a lion contourny Or'],
    ['a demi charge', 'azure, a demi-lion Or'],
    ['a head erased', "azure, a wolf's head erased Or"],
    ['heads respectant', "azure, two lions' heads couped respectant Or"],
    ['a charge fesswise', 'azure, a sword fesswise argent'],
    ['a charge fesswise reversed', 'azure, a sword fesswise reversed argent'],
    ['a charge bendwise sinister inverted', 'azure, a sword bendwise sinister inverted argent'],
    ['a charge inverted', 'azure, a mullet inverted Or'],
    ['a charge palewise', 'azure, a sword palewise argent'],
    ['a crescent pendant', 'azure, a crescent pendant Or'],
    ['an increscent', 'gules, an increscent argent'],
    ['decrescents', 'or, three decrescents azure'],
    ['charges to center', 'azure, four swords in cross points to center argent'],
    ['a charge to sinister', 'azure, a wolf passant to sinister Or'],
    ['a charge facing sinister', 'azure, an eagle displayed facing sinister Or'],
    ['a charge contourné', 'azure, a lion contourné Or'],
    ['two charges combatant', 'argent, two wolves combatant sable'],
    ['two charges respectant', 'azure, two eagles respectant argent'],
    ['two charges endorsed', 'or, two lions rampant endorsed gules'],
    ['a chevron fimbriated', 'azure, a chevron Or fimbriated argent'],
    ['a cross voided', 'azure, a cross voided Or'],
    // every charge the widget draws, and the spellings and details of the drawn crosses and shapes
    ...CHARGE_IDS.map((id): [string, string] => [`a ${id}`, `azure, ${CHARGES[id].article} ${CHARGES[id].name} Or`]),
    ...CHARGE_IDS.filter((id) => CHARGES[id].details.includes('fitchy')).map((id): [string, string] => [`${id} fitchy`, `azure, three ${CHARGES[id].plural} fitchy Or`]),
    ['crosses fleury', 'azure, three crosses fleury Or'],
    ['crosses pattee fitched', 'azure, three crosses pattee fitched Or'],
    ['a cross botonny', 'azure, a cross botonny Or'],
    ['crosses couped', 'azure, three crosses couped Or'],
    ['compass stars', 'azure, three compass-stars Or'],
    ['a crosslet fitchy', 'azure, a crosslet fitchy Or'],
    ['a mullet of six points', 'azure, a mullet of six points Or'],
    ['estoiles of eight rays', 'azure, three estoiles of eight rays Or'],
    ['an estoile of eight points', 'azure, an estoile of eight points Or'],
    ['a mullet of six points pierced', 'azure, a mullet of six points pierced Or'],
    ['a mullet voided', 'azure, a mullet voided Or'],
    ['a delf voided', 'azure, a delf voided Or'],
    ['a lozenge fimbriated', 'azure, a lozenge azure fimbriated argent'],
    ['a lion crowned', 'azure, a lion rampant crowned Or'],
    ['a lion ducally crowned', 'azure, a lion Or ducally crowned gules'],
    ['a wolf gorged of a ducal coronet', 'azure, a wolf argent gorged of a ducal coronet Or'],
    ['a wolf\'s head collared', 'azure, a wolf\'s head argent collared Or'],
    ['a winged lion', 'azure, a winged lion passant Or'],
    ['a heart winged', 'azure, a heart gules winged Or'],
    ['a heart enflamed proper', 'azure, a heart gules enflamed proper'],
    ['a rose slipped and leaved', 'azure, a rose gules slipped and leaved vert'],
    ['a lion maintaining a sword', 'azure, a lion rampant Or maintaining a sword argent'],
    ['a lion holding a key', 'azure, a lion Or, holding a key argent'],
    ['two lions each maintaining a sword', 'azure, two lions combattant Or each maintaining a sword argent'],
    ['an eagle with a key in its beak', 'argent, an eagle sable maintaining in its beak a key gules'],
    ['a wolf with a rose in its mouth', 'or, a wolf rampant sable holding in its mouth a rose gules'],
    ['triquetrae', 'azure, three triquetrae Or'],
    ['ermine spots', 'azure, three ermine spots Or'],
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
  // The phase-C constructs as the widget itself writes them (`blazon`), from the library's tables: every ordinary at each count it is drawn
  // with; every treatment on each ordinary it is drawn on; cotised once, twice and thrice, and with each line a cotise takes; fimbriated; a
  // band with a line on one edge or two different lines; gyronny of each count and arrondi.
  const written = (input: object): string => blazon(nd(input)).replace(/\.$/, '');
  const on = (item: object, count = 1) => arms(plain('azure'), group(item, plain('or'), { count }));
  const firstCount = (t: OrdinaryType) => ORDINARY_COUNTS[t]?.[0] ?? 1;
  const cotisedLines = COTISED_HOSTS.flatMap((t) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'cotises', type: t }, l)).map((line) => [t, line] as const));
  const constructs: Array<[string, object]> = [
    ...DRAWN_ORDINARIES.flatMap((t) => (ORDINARY_COUNTS[t] ?? [1]).map((n): [string, object] => [`${n} ${t}`, on(ordinary(t), n)])),
    ...ORDINARY_MODS.flatMap((m) => MOD_HOSTS[m].map((t): [string, object] => [`${t} ${m}`, on(ordinary(t, { mods: [m] }), firstCount(t))])),
    ...COTISED_HOSTS.flatMap((t) => ([1, 2, 3] as const).map((count): [string, object] => [`${t} cotised ${count}`, on(ordinary(t, { cotised: { count, paint: plain('argent'), line: 'plain' } }))])),
    // each line a cotise takes once, on the hosts in turn (every pair would cost a classify each for little more)
    ...DRAWN_LINES.flatMap((line, i) => cotisedLines.filter(([, l]) => l === line).filter((_, j, xs) => j === i % xs.length))
      .map(([t, line]): [string, object] => [`${t} cotised ${line}`, on(ordinary(t, { lines: { a: line }, cotised: { count: 1, paint: plain('argent'), line } }))]),
    ...DRAWN_ORDINARIES.filter((t) => ORDINARY_KIND[t] === 'central' && t !== 'fret' && !isDiminutive(t))
      .map((t): [string, object] => [`${t} fimbriated`, on(ordinary(t, { fimbriated: plain('argent') }))]),
    ...(['fess', 'pale', 'bend', 'chevron', 'orle'] as const).flatMap((t): Array<[string, object]> => [
      [`${t} embattled below`, on(ordinary(t, { lines: { a: 'plain', b: 'embattled' } }))],
      [`${t} wavy above`, on(ordinary(t, { lines: { a: 'wavy', b: 'plain' } }))],
      [`${t} counter-embattled`, on(ordinary(t, { lines: { a: 'embattled', b: 'embattled' } }))],
      [`${t} embattled grady`, on(ordinary(t, { lines: { a: 'embattled', b: 'grady' } }))],
    ]),
    ...GYRONNY_PIECES.map((pieces): [string, object] => [`gyronny of ${pieces}`, arms({ ...div('gyronny', 'or', 'gules'), pieces })]),
    ['gyronny arrondi', arms({ ...div('gyronny', 'or', 'gules'), lines: { a: 'arrondi' } })],
  ];
  const cases = [
    ...fields.map(([name, field]): [string, string] => [name, upper(field)]), ...designs,
    ...constructs.map(([name, input]): [string, string] => [`as written: ${name}`, written(input)]),
  ];

  it.each(cases)('%s', (_, text) => {
    const c = classify({ key: 'regid:0', type: 'd', date: '', blazon: `${upper(text)}, a frobnitz Or.`, headings: [] });
    expect(c.status).toBe('gap');
    expect(c.tags.filter((t) => categoryOf(t) !== 'other')).toEqual([]);
  });
});
