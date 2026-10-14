// The bundled sample registry as searchable entries, built the way the offline store builds them.
import sample from '../src/data/sample-registry.json';
import { blazon, buildSearchText, resolve, type Design, type SearchableEntry } from '../src/lib/heraldry';

export interface SampleSearchEntry extends SearchableEntry {
  displayName: string;
  blazon: string;
}

export function designOf(input: unknown): Design {
  const r = resolve(input);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.design;
}

export function searchEntryOf(e: { id: string; displayName: string; registeredAt: string; design: unknown }): SampleSearchEntry {
  const design = designOf(e.design);
  const text = blazon(design);
  return {
    id: e.id,
    displayName: e.displayName,
    blazon: text,
    design,
    createdAt: e.registeredAt,
    searchText: buildSearchText({ displayName: e.displayName, blazon: text, design }),
  };
}

export const sampleSearchEntries: SampleSearchEntry[] = sample.entries.map(searchEntryOf);
