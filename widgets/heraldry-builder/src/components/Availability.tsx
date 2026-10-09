// Inline result of "Check availability" (PLAN §6 item 6), also used by the Register dialog when the
// server answers 409 duplicate / too_close, so both places show the same UI. The testids
// availability-ok / -duplicate / -too-close / -error are the journey contract.

import type { ConflictSummary, Result, CheckResult } from '../store';
import { entryHash } from '../lib/route';
import { CLEAR_CHANGE_HINT } from '../lib/heraldry';
import { Shield } from './Shield';

export type CheckOutcome = Result<{ result: CheckResult }>;

interface TakenProps {
  verdict: 'duplicate' | 'too-close';
  conflict?: ConflictSummary | null;
  differences?: string[];
  registryName?: string | null;
  /** Called when "View" is pressed (the link also works on its own via the hash route). */
  onView?: () => void;
  /** Jump to the builder control that would clear the conflict (inline results only). */
  onJump?: (target: JumpTarget) => void;
}

export type JumpTarget = 'field' | 'ordinary' | 'charge' | 'count' | 'arrangement' | 'posture' | 'tincture';

const JUMP_LABEL: Record<JumpTarget, string> = {
  field: 'Change the field', ordinary: 'Change the ordinary', charge: 'Change the charge', count: 'Change the count',
  arrangement: 'Change the arrangement', posture: 'Change the posture', tincture: 'Change a tincture',
};

/** Which controls the listed differences point at (falls back to the three step sections). */
function jumpTargets(differences?: string[]): JumpTarget[] {
  const text = (differences ?? []).join(' ').toLowerCase();
  const hit = (['posture', 'arrangement', 'count', 'tincture'] as const).filter((k) => text.includes(k));
  return hit.length ? hit : ['field', 'ordinary', 'charge'];
}

/** The sentence announced through the page's live region when a check finishes. */
export function outcomeMessage(outcome: CheckOutcome): string {
  if (!outcome.ok) return `Couldn't check right now. ${outcome.message}`;
  const r = outcome.result;
  if (r.verdict === 'ok') return `Available in ${r.registry.name}.`;
  const who = r.conflict ? ` ${r.verdict === 'duplicate' ? 'by' : 'to'} ${r.conflict.displayName}` : '';
  return r.verdict === 'duplicate' ? `Already registered${who}.` : `Too close${who}.`;
}

/** Duplicate / too-close panel: conflicting mini shield, name, blazon, what differs and what to change. */
export function TakenPanel({ verdict, conflict: c, differences, registryName, onView, onJump }: TakenProps) {
  const where = registryName ? ` in ${registryName}` : '';
  const card = c && (
    <div class="conflict">
      {c.design && <Shield design={c.design} size={48} label={null} />}
      <div class="conflict-text">
        <p class="conflict-name">{c.displayName}</p>
        <p class="conflict-blazon">{c.blazon}</p>
        <a class="text-link" href={entryHash(c.id)} onClick={onView}>View these arms</a>
      </div>
    </div>
  );
  const jumps = onJump && (
    <div class="jump-row" data-testid="availability-jumps">
      {jumpTargets(verdict === 'duplicate' ? undefined : differences).map((t) => (
        <button key={t} type="button" class="button-secondary button-small" data-testid={`jump-${t}`} onClick={() => onJump(t)}>{JUMP_LABEL[t]}</button>
      ))}
    </div>
  );
  if (verdict === 'duplicate') {
    return (
      <div class="availability availability-taken" data-testid="availability-duplicate">
        <p><strong>Already registered</strong>{where}.</p>
        <p class="availability-help">These arms are taken. Change at least one of: {CLEAR_CHANGE_HINT}.</p>
        {jumps}
        {card}
      </div>
    );
  }
  return (
    <div class="availability availability-taken" data-testid="availability-too-close">
      <p><strong>Too close to existing arms</strong>{where}.</p>
      {differences?.length ? (
        <div>
          <p class="availability-help">It only differs by:</p>
          <ul class="differences" data-testid="availability-differences">
            {differences.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      ) : null}
      <p class="availability-help">Change at least one of: {CLEAR_CHANGE_HINT}.</p>
      {jumps}
      {card}
    </div>
  );
}

export function Availability({ outcome, onJump }: { outcome: CheckOutcome; onJump?: (t: JumpTarget) => void }) {
  if (!outcome.ok) {
    return (
      <div class="availability availability-error" data-testid="availability-error">
        <p><strong>Couldn't check right now.</strong> {outcome.message}</p>
      </div>
    );
  }
  const r = outcome.result;
  if (r.verdict === 'ok') {
    return (
      <div class="availability availability-ok" data-testid="availability-ok">
        <p><strong>Available</strong> in {r.registry.name}.{r.sample ? ' (Checked against the offline sample.)' : ''}</p>
      </div>
    );
  }
  return <TakenPanel verdict={r.verdict} conflict={r.conflict} differences={r.differences} registryName={r.registry.name} onJump={onJump} />;
}
