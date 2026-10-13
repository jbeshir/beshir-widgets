// The normalisation pipeline, applied identically on client and Worker: parse and fill defaults (resolve),
// stop at anything the builder doesn't draw (support), then the structural rules and the rule of tincture.
// Kept apart from design.ts so the module graph stays acyclic.

import type { Design, Issue } from './design';
import { resolve } from './resolve';
import { structuralIssues } from './structure';
import { unsupportedIssues } from './support';
import { tinctureIssues } from './tincture-rule';

export type NormaliseResult =
  | { ok: true; design: Design }
  /** `design` is the resolved design when the input is well-formed and drawable, so a rule-breaking design can still be shown; null otherwise. */
  | { ok: false; errors: Issue[]; design: Design | null };

/** Structure and tincture issues of a resolved, supported design (empty = registrable). */
export function validate(d: Design): Issue[] {
  return [...structuralIssues(d), ...tinctureIssues(d)];
}

export function normalise(input: unknown): NormaliseResult {
  const r = resolve(input);
  if (!r.ok) return { ok: false, errors: r.errors, design: null };
  const unsupported = unsupportedIssues(r.design);
  if (unsupported.length > 0) return { ok: false, errors: unsupported, design: null };
  const errors = validate(r.design);
  return errors.length ? { ok: false, errors, design: r.design } : { ok: true, design: r.design };
}
