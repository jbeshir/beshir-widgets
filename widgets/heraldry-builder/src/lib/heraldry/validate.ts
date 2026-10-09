// The full normalisation pipeline (FINDINGS §4.1 steps 1–5), applied identically on client and
// Worker: parse + defaults (design.ts resolve), structural tables, then the rule of tincture.
// Kept apart from design.ts so the module graph stays acyclic (tincture-rule depends on design).

import { resolve, structuralIssues, type Issue, type NormDesign } from './design';
import { tinctureIssues } from './tincture-rule';

export type NormaliseResult =
  | { ok: true; design: NormDesign }
  /** `design` is the resolved design when the input was well-formed (so it can still be drawn). */
  | { ok: false; errors: Issue[]; design: NormDesign | null };

/** Structural + tincture issues of a resolved design (empty = registrable). */
export function validate(nd: NormDesign): Issue[] {
  return [...structuralIssues(nd), ...tinctureIssues(nd)];
}

export function normalise(input: unknown): NormaliseResult {
  const r = resolve(input);
  if (!r.ok) return { ok: false, errors: r.errors, design: null };
  const errors = validate(r.design);
  return errors.length ? { ok: false, errors, design: r.design } : { ok: true, design: r.design };
}
