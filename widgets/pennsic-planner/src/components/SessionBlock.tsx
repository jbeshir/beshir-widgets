import type { JSX } from 'preact';
import type { Session } from '../types';
import { to12h } from '../lib/time.js';

interface Props {
  session: Session;
  inPlan: boolean;
  trackColor: { l: string; d: string };
  onToggle: () => void;
  conflict?: boolean;
}

export function SessionBlock({ session, inPlan, trackColor, onToggle, conflict }: Props) {
  const style: JSX.CSSProperties & Record<string, unknown> = {
    '--tc-l': trackColor.l,
    '--tc-d': trackColor.d,
  };

  const ariaLabel = `${inPlan ? 'Remove from plan' : 'Add to plan'}: ${session.title}, ${to12h(session.startTime)}–${to12h(session.endTime)}${session.location ? ', ' + session.location : ''}${session.instructor ? ', ' + session.instructor : ''}`;

  const cardClass = [
    'session-card',
    inPlan ? 'in-plan' : '',
    conflict && inPlan ? 'conflict' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      class={cardClass}
      style={style}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      aria-label={ariaLabel}
      aria-pressed={inPlan}
      title={`${session.title}\n${to12h(session.startTime)}–${to12h(session.endTime)}\n${session.location ?? ''}\n${session.instructor ?? ''}`}
    >
      <div class="session-card-title">{session.title}</div>
      <div class="session-card-time">
        {to12h(session.startTime)}–{to12h(session.endTime)} · {session.durationMin} min
      </div>
      {session.location && <div class="session-card-meta">{session.location}</div>}
      {session.instructor && <div class="session-card-meta session-card-instructor">{session.instructor}</div>}
      {(session.hasFee || session.adultOnly) && (
        <div class="session-card-badges">
          {session.hasFee && <span class="card-badge">$</span>}
          {session.adultOnly && <span class="card-badge">18+</span>}
        </div>
      )}
      {inPlan && <span class="plan-check" aria-hidden="true">✓</span>}
      {conflict && inPlan && <span class="conflict-badge" aria-hidden="true">conflict</span>}
    </div>
  );
}
