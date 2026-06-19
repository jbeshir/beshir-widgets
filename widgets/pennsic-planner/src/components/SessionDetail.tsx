import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Session } from '../types';
import { to12h, longDayLabel } from '../lib/time.js';

interface Props {
  session: Session;
  allSessions: Session[];
  planSet: Set<string>;
  conflicts: Set<string>;
  trackColor: { l: string; d: string };
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function SessionDetail({
  session,
  allSessions,
  planSet,
  conflicts,
  trackColor,
  onToggle,
  onNavigate,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const style: JSX.CSSProperties & Record<string, unknown> = {
    '--tc-l': trackColor.l,
    '--tc-d': trackColor.d,
  };

  // Capture trigger, lock scroll, focus close button on mount; restore on unmount.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      const t = triggerRef.current;
      if (t && document.body.contains(t as Node)) {
        (t as HTMLElement).focus?.();
      }
    };
  }, []);

  // Esc closes; Tab wraps focus within dialog.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const inPlan = planSet.has(session.id);
  const hasConflict = conflicts.has(session.id);

  const others =
    session.repeatCount > 1
      ? allSessions
          .filter((s) => s.classId === session.classId && s.id !== session.id)
          .sort((a, b) => a.start.localeCompare(b.start))
      : [];

  // Strip the "Track: " prefix from topic so it isn't shown twice after the chip.
  const topicDisplay = (() => {
    if (!session.topic || session.topic === session.track) return null;
    const prefix = session.track + ': ';
    return session.topic.startsWith(prefix) ? session.topic.slice(prefix.length) : session.topic;
  })();

  return (
    <div
      class="lightbox-overlay"
      style={style}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        class="lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lightbox-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div class="lightbox-header">
          <h2 id="lightbox-title" class="lightbox-title">{session.title}</h2>
          <button
            class="lightbox-close"
            aria-label="Close details"
            onClick={onClose}
            ref={closeRef}
          >
            ×
          </button>
        </div>

        <div class="lightbox-body">
          <div class="lightbox-meta lightbox-meta-track">
            <span class="lightbox-chip">{session.track}</span>
            {topicDisplay && <span class="lightbox-topic">{topicDisplay}</span>}
          </div>

          <div class="lightbox-meta">
            {longDayLabel(session.day)} · {to12h(session.startTime)}–{to12h(session.endTime)} · {session.durationMin} min
          </div>

          {session.location && (
            <div class="lightbox-meta">{session.location}</div>
          )}

          {session.instructor && (
            <div class="lightbox-meta">
              {session.instructor}
              {session.instructorKingdom ? ` · ${session.instructorKingdom}` : ''}
            </div>
          )}

          {session.materialFee != null && session.materialFee > 0 && (
            <div class="lightbox-fee">Materials: ${session.materialFee}</div>
          )}
          {session.handoutFee != null && session.handoutFee > 0 && (
            <div class="lightbox-fee">Handout: ${session.handoutFee}</div>
          )}

          {session.adultOnly && (
            <div class="lightbox-adult">
              <strong>18+ only</strong>
              {session.adultReason ? ` — ${session.adultReason}` : ''}
            </div>
          )}

          {hasConflict && (
            <div class="lightbox-conflict-note">
              ⚠ This planned session conflicts with another in your plan.
            </div>
          )}

          <div class="lightbox-section">
            <h3 class="lightbox-section-heading">Description</h3>
            <p class="lightbox-desc">
              {session.description || 'No description provided.'}
            </p>
          </div>

          {others.length > 0 && (
            <div class="lightbox-section">
              <h3 class="lightbox-section-heading">Also offered at</h3>
              <div class="lightbox-also">
                {others.map((occ) => {
                  const occInPlan = planSet.has(occ.id);
                  return (
                    <div
                      key={occ.id}
                      class={`lightbox-occurrence${occInPlan ? ' in-plan' : ''}`}
                    >
                      <button
                        class="lightbox-occ-nav"
                        onClick={() => onNavigate(occ.id)}
                      >
                        {longDayLabel(occ.day)} · {to12h(occ.startTime)}–{to12h(occ.endTime)}
                        {occ.location ? ` · ${occ.location}` : ''}
                      </button>
                      <button
                        class="star-toggle lightbox-occ-star"
                        aria-pressed={occInPlan}
                        aria-label={occInPlan ? `Remove ${occ.title} from plan` : `Add ${occ.title} to plan`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle(occ.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
                        }}
                      >
                        {occInPlan ? '★' : '☆'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            class={`lightbox-primary${inPlan ? ' in-plan' : ''}`}
            onClick={() => onToggle(session.id)}
          >
            {inPlan ? 'Remove from plan' : 'Add to plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
