// The widget against every current armory record in the SCA Ordinary & Armorial
// (test/fixtures/sca/oanda.db, used by tests only). Each record either passes all five checks of
// test/sca/classify.ts or is on the ignore list (test/fixtures/sca/ignored.json) with the gaps that
// stop the widget expressing it. The list is a ratchet: a listed record that starts to pass, or
// that loses the gap it is filed under, fails the test until the list is regenerated
// (`npm run sca:ignore`).

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkBlazon, classify, failureLines, listing } from './sca/classify';
import { GAP_CATEGORIES, categoryOf } from './sca/gaps';
import { readIgnoreList } from './sca/ignore-list';
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
// normaliseBlazon(), applied to the SCA blazon and the widget's alike. Its rules
// (NORMALISATION_RULES in test/sca/normalise.ts, each documented there) only bridge differences of
// convention: case, the final full stop, joining words, and the SCA's implied tinctures and
// default postures written out. None drops a tincture, count, charge, posture or arrangement, so
// blazons of two different designs never compare equal.
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
  }, 30_000);

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
  }, 30_000);
});
