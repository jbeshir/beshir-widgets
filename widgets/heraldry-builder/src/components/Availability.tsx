// Inline result of "Check availability", also used by the Register dialog when the
// server answers 409 duplicate / too-close, so both places show the same UI. The testids
// availability-ok / -duplicate / -too-close / -error are the journey contract.

import type { Result, CheckResult } from '../store';
import { entryHash } from '../lib/route';
import {
  CLEAR_CHANGE_HINT, HALF_DIFFERENCE_HINT, POINTS, pointsLabel, tallyText, type ComparedEntry, type DiffAttr, type DifferenceNote, type TakenReport,
} from '../lib/heraldry';
import { Shield } from './Shield';

export type CheckOutcome = Result<{ result: CheckResult }>;

interface TakenProps {
  report: TakenReport;
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

/** The builder control behind each kind of difference. */
const JUMP_FOR: Record<DiffAttr, JumpTarget> = {
  'field-division': 'field', 'field-tincture': 'tincture',
  'ordinary-presence': 'ordinary', 'ordinary-type': 'ordinary', 'ordinary-tincture': 'tincture',
  'charges-presence': 'charge', 'charge-type': 'charge', 'charge-tincture': 'tincture', 'charge-placement': 'charge',
  'charge-count': 'count', 'charge-arrangement': 'arrangement', 'charge-posture': 'posture',
};

/** Which controls the listed differences point at (falls back to the three step sections). */
function jumpTargets(differences: readonly DifferenceNote[]): JumpTarget[] {
  const hit = [...new Set(differences.map((d) => JUMP_FOR[d.attr]))];
  return hit.length ? hit : ['field', 'ordinary', 'charge'];
}

/** Each difference with its points, why a minor one counts half, and the tally. */
function DifferenceList({ differences }: { differences: readonly DifferenceNote[] }) {
  return (
    <>
      <ul class="differences" data-testid="availability-differences">
        {differences.map((d) => (
          <li key={d.attr}>
            {d.text} — <strong>{pointsLabel(POINTS[d.weight])}</strong>
            {d.weight === 'minor' && <span class="difference-why">{d.why}</span>}
          </li>
        ))}
      </ul>
      <p class="difference-tally" data-testid="availability-tally">{tallyText(differences)}</p>
    </>
  );
}

/** The sentence announced through the page's live region when a check finishes. */
export function outcomeMessage(outcome: CheckOutcome): string {
  if (!outcome.ok) return `Couldn't check right now. ${outcome.message}`;
  const r = outcome.result;
  if (r.verdict === 'ok') return 'Available.';
  return r.verdict === 'duplicate' ? `Already registered by ${r.conflict.displayName}.` : `Too close to ${r.conflict.displayName}.`;
}

/** Duplicate / too-close panel: conflicting mini shield, name, blazon, what differs and what to change. */
export function TakenPanel({ report, onView, onJump }: TakenProps) {
  const c = report.conflict;
  const card = (
    <div class="conflict">
      <Shield design={c.design} shape={c.shape} size={48} label={null} />
      <div class="conflict-text">
        <p class="conflict-name">{c.displayName}</p>
        <p class="conflict-blazon">{c.blazon}</p>
        <a class="text-link" href={entryHash(c.id)} onClick={onView}>View these arms</a>
      </div>
    </div>
  );
  const jumps = onJump && (
    <div class="jump-row" data-testid="availability-jumps">
      {jumpTargets(report.verdict === 'duplicate' ? [] : report.differences).map((t) => (
        <button key={t} type="button" class="button-secondary button-small" data-testid={`jump-${t}`} onClick={() => onJump(t)}>{JUMP_LABEL[t]}</button>
      ))}
    </div>
  );
  if (report.verdict === 'duplicate') {
    return (
      <div class="availability availability-taken" data-testid="availability-duplicate">
        <p class="taken-verdict"><strong>Already registered — change at least one thing.</strong></p>
        <p class="availability-help">Change one of: {CLEAR_CHANGE_HINT}.</p>
        {jumps}
        {card}
      </div>
    );
  }
  return (
    <div class="availability availability-taken" data-testid="availability-too-close">
      <p class="taken-verdict"><strong>Too similar to {c.displayName}’s arms — change one more thing.</strong></p>
      {report.differences.length > 0 && (
        <div>
          <p class="availability-help">What is different so far (you need 1 point):</p>
          <DifferenceList differences={report.differences} />
        </div>
      )}
      <p class="availability-help">To clear it, change one of: {CLEAR_CHANGE_HINT}.</p>
      {jumps}
      <details class="half-rule" data-testid="availability-half-rule">
        <summary>Why do some changes only count as half a point?</summary>
        <p class="availability-help">{HALF_DIFFERENCE_HINT}</p>
      </details>
      {card}
    </div>
  );
}

/** An available design that only passed an entry by adding up half differences. */
function ClosestEntry({ closest }: { closest: ComparedEntry }) {
  return (
    <div data-testid="availability-closest">
      <p class="availability-help">
        Closest: the arms of {closest.conflict.displayName} ({closest.conflict.blazon}). It differs only by:
      </p>
      <DifferenceList differences={closest.differences} />
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
        <p><strong>Available.</strong>{r.sample ? ' (Checked against the offline sample.)' : ''}</p>
        {r.closest && <ClosestEntry closest={r.closest} />}
      </div>
    );
  }
  return <TakenPanel report={r} onJump={onJump} />;
}
