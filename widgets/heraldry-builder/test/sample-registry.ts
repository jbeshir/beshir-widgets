// The offline sample registry, as the writer regenerates it: every design resolved to its canonical
// form, every signature and blazon recomputed from the design. DOM- and node-free so the byte-exact
// test can run it in workerd; the file itself is written by test/sample-registry-write.ts.

import { blazon, normalise, signature, type FieldShape } from '../src/lib/heraldry/next';

export interface SampleEntry {
  id: string;
  displayName: string;
  contact: { discord: string | null };
  registeredAt: string;
  shape: FieldShape;
  /** Loose design input (as `resolve` reads it) or an already canonical design. */
  design: unknown;
  signature: string;
  blazon: string;
}

export interface SampleFile {
  schema: string;
  registry: { id: string; name: string };
  entries: SampleEntry[];
}

/** The file as it should be on disk; throws on an entry whose design can't be registered. */
export function renderSampleRegistry(raw: SampleFile): string {
  const entries = raw.entries.map((e): SampleEntry => {
    const n = normalise(e.design);
    if (!n.ok) throw new Error(`${e.id}: ${n.errors.map((i) => i.message).join('; ')}`);
    return { ...e, design: n.design, signature: signature(n.design), blazon: blazon(n.design) };
  });
  return `${JSON.stringify({ ...raw, entries }, null, 2)}\n`;
}
