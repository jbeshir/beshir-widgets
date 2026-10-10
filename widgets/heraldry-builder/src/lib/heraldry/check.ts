// The availability check shared by the Worker (POST /api/arms/check, and the checks before a write) and
// the offline sample in the SPA, so both build the same answer from the same entries.

import type { NormDesign } from './design';
import { checkUnique, explainDifferences, type Comparison, type DifferenceNote } from './difference';
import { readability, type ReadabilityBand } from './readability';
import type { FieldShape } from './shape';
import { signature } from './signature';
import { blazon } from './blazon';

export interface RegistryRef {
  id: string;
  name: string;
}

/** A registry entry as the check sees it. */
export interface CheckableEntry {
  id: string;
  displayName: string;
  blazon: string;
  signature: string;
  design: NormDesign;
  shape: FieldShape;
}

/** The public face of the entry a design clashes with. */
export interface ConflictSummary {
  id: string;
  displayName: string;
  blazon: string;
  design: NormDesign;
  shape: FieldShape;
}

/** An entry and the differences from it, in words. */
export interface ComparedEntry {
  conflict: ConflictSummary;
  differences: DifferenceNote[];
}

export type UniquenessReport =
  /** `closest`: the first entry the design is different enough from only by adding up minor differences. */
  | { verdict: 'ok'; closest: ComparedEntry | null }
  | { verdict: 'duplicate'; conflict: ConflictSummary }
  | { verdict: 'too-close'; conflict: ConflictSummary; differences: DifferenceNote[] };

/** A verdict that blocks a registration. */
export type TakenReport = Exclude<UniquenessReport, { verdict: 'ok' }>;

/** Registration order: oldest first, ties by id. */
export function registrationOrder(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function conflictOf(e: CheckableEntry): ConflictSummary {
  return { id: e.id, displayName: e.displayName, blazon: e.blazon, design: e.design, shape: e.shape };
}

/** How `nd` fares against `entries` (in registration order); `excludeId` skips the entry being edited. */
export function reportUniqueness(nd: NormDesign, sig: string, entries: readonly CheckableEntry[], excludeId?: string): UniquenessReport {
  const entry = (id: string) => entries.find((e) => e.id === id)!;
  const compared = (c: Comparison) => {
    const e = entry(c.of);
    return { conflict: conflictOf(e), differences: explainDifferences(nd, e.design, c.differences) };
  };
  const v = checkUnique(nd, sig, entries, excludeId);
  if (v.kind === 'ok') return { verdict: 'ok', closest: v.closest && compared(v.closest) };
  if (v.kind === 'duplicate') return { verdict: 'duplicate', conflict: conflictOf(entry(v.of)) };
  return { verdict: 'too-close', ...compared(v) };
}

/** The answer to an availability check: the verdict plus what the design is, derived from the design alone. */
export type CheckResponse = UniquenessReport & {
  registry: RegistryRef;
  blazon: string;
  signature: string;
  readability: ReadabilityBand;
};

export function checkResponse(nd: NormDesign, registry: RegistryRef, entries: readonly CheckableEntry[]): CheckResponse {
  const sig = signature(nd);
  return { ...reportUniqueness(nd, sig, entries), registry, blazon: blazon(nd), signature: sig, readability: readability(nd).band };
}
