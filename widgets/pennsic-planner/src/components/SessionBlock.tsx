import type { JSX } from 'preact';
import type { PlacedSession } from '../types';
import { to12h } from '../lib/time.js';

interface Props {
  placed: PlacedSession;
  dayStart: number;
  pxPerMin: number;
  inPlan: boolean;
  trackColor: { l: string; d: string };
  onToggle: () => void;
}

export function SessionBlock({ placed, dayStart, pxPerMin, inPlan, trackColor, onToggle }: Props) {
  const { session, startMin, endMin, lane, lanes } = placed;
  const top = (startMin - dayStart) * pxPerMin;
  const height = Math.max((endMin - startMin) * pxPerMin, 24);
  const left = (lane / lanes) * 100;
  const width = (1 / lanes) * 100;

  const style: JSX.CSSProperties & Record<string, unknown> = {
    top: `${top}px`,
    height: `${height}px`,
    left: `${left}%`,
    width: `${width}%`,
    '--tc-l': trackColor.l,
    '--tc-d': trackColor.d,
  };

  const showMeta = height >= 38;
  const showInstructor = height >= 58;
  const showBadges = height >= 32;

  return (
    <div
      class={`session-block${inPlan ? ' in-plan' : ''}`}
      style={style}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      aria-label={`${inPlan ? 'Remove from plan: ' : 'Add to plan: '}${session.title} at ${to12h(session.startTime)}`}
      aria-pressed={inPlan}
      title={`${session.title}\n${to12h(session.startTime)}–${to12h(session.endTime)}\n${session.location ?? ''}\n${session.instructor ?? ''}`}
    >
      {inPlan && <span class="plan-check" aria-hidden="true">✓</span>}
      <div class="session-block-title">{session.title}</div>
      {showMeta && (
        <div class="session-block-meta">
          {to12h(session.startTime)}–{to12h(session.endTime)}
          {session.location ? ` · ${session.location}` : ''}
        </div>
      )}
      {showInstructor && session.instructor && (
        <div class="session-block-meta session-block-instructor">{session.instructor}</div>
      )}
      {showBadges && (session.hasFee || session.adultOnly) && (
        <div class="session-block-badges">
          {session.hasFee && <span class="block-badge">$</span>}
          {session.adultOnly && <span class="block-badge">18+</span>}
        </div>
      )}
    </div>
  );
}
