// The bundled sample registry: byte-exact with the writer's output, every entry canonical and registrable,
// all pairs clear of each other under the SENA conflict rules, and the tag searches it is used to show.
import { describe, expect, it } from 'vitest';
import sample from '../src/data/sample-registry.json';
import sampleRaw from '../src/data/sample-registry.json?raw';
import {
  checkUnique, cleanDiscord, differences, filtersToTags, isClear, isFieldShape, matchesTags, normalise, signature, blazon,
  type SearchFilters,
} from '../src/lib/heraldry';
import { renderSampleRegistry, type SampleFile } from './sample-registry';
import { filters, nd } from './helpers';

describe('sample registry fixture', () => {
  it('uses the sample registry identity', () => {
    expect(sample.schema).toBe('heraldry-builder/registry-sample@2');
    expect(sample.registry).toEqual({ id: 'sample', name: 'Sample armorial (offline demo)' });
    expect(sample.entries).toHaveLength(20);
  });

  for (const e of sample.entries) {
    it(`${e.id} normalises to itself, follows the rules and matches signature + blazon`, () => {
      const r = normalise(e.design);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(JSON.stringify(r.design)).toBe(JSON.stringify(e.design));
      expect(signature(r.design)).toBe(e.signature);
      expect(blazon(r.design)).toBe(e.blazon);
      expect(e.displayName.length).toBeGreaterThanOrEqual(1);
      expect(e.displayName.length).toBeLessThanOrEqual(60);
      expect(cleanDiscord(e.contact.discord)).toEqual({ ok: true, value: e.contact.discord });
      expect(isFieldShape(e.shape)).toBe(true);
    });
  }

  it('is byte-exact with the writer output', () => {
    expect(renderSampleRegistry(JSON.parse(sampleRaw) as SampleFile)).toBe(sampleRaw);
  });

  it('is in registration order with unique ids and signatures', () => {
    const times = sample.entries.map((e) => e.registeredAt);
    expect([...times].sort()).toEqual(times);
    expect(new Set(sample.entries.map((e) => e.id)).size).toBe(20);
    expect(new Set(sample.entries.map((e) => e.signature)).size).toBe(20);
  });

  it('shows the new constructs: crossed keys, bees in chief, roses on a chief', () => {
    const blazons = new Map(sample.entries.map((e) => [e.id, e.blazon]));
    expect(blazons.get('demo-009')).toBe('Argent, two keys in saltire sable.');
    expect(blazons.get('demo-016')).toBe('Vert, in chief three bees Or.');
    expect(blazons.get('demo-005')).toBe('Gules, three mullets argent, on a chief Or three roses gules.');
  });

  it('all 190 pairs are different enough', () => {
    const ds = sample.entries.map((e) => nd(e.design));
    let pairs = 0;
    for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
      pairs++;
      expect(isClear(differences(ds[i], ds[j])), `${sample.entries[i].id} vs ${sample.entries[j].id}`).toBe(true);
    }
    expect(pairs).toBe(190);
  });

  it('each entry is unique against all the others', () => {
    const reg = sample.entries.map((e) => ({ id: e.id, signature: e.signature, design: nd(e.design) }));
    for (const e of reg) expect(checkUnique(e.design, e.signature, reg, e.id).kind).toBe('ok');
  });

  it('search sanity checks', () => {
    const search = (args: Partial<SearchFilters>) => {
      const t = filtersToTags(filters(args));
      if (!t.ok) throw new Error(t.message);
      return sample.entries.filter((e) => matchesTags(nd(e.design), t.tags)).map((e) => e.id);
    };
    expect(search({ ordinary: 'bordure' })).toEqual(['demo-004', 'demo-014', 'demo-020']);
    expect(search({ chargeTincture: 'counterchanged' })).toEqual(['demo-018', 'demo-019', 'demo-020']);
    expect(search({ chargeTincture: 'azure' })).toEqual(['demo-013', 'demo-014']);
    expect(search({ charge: 'wolf', posture: 'passant' })).toEqual(['demo-003', 'demo-004']);
    expect(search({ ordinary: 'bend' })).toEqual(['demo-001', 'demo-002']);
    expect(search({ division: 'plain', ordinary: 'bend' })).toEqual(['demo-001', 'demo-002']);
    expect(search({ division: 'quarterly' })).toEqual(['demo-007']);
    expect(search({ charge: 'dragon', ordinary: 'bordure' })).toEqual([]);
    const modern = sample.entries.filter((e) => matchesTags(nd(e.design), ['charge-category:modern'])).map((e) => e.id);
    expect(modern).toEqual(['demo-012', 'demo-013', 'demo-015']);
  });
});
