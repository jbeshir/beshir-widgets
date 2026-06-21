import { useMemo, useRef, useState, useEffect } from 'preact/hooks';
import type { Session } from '../types';
import { SessionBlock } from './SessionBlock';

interface Props {
  sessions: Session[];
  planIds: string[];
  conflicts: Set<string>;
  trackColors: Record<string, { l: string; d: string }>;
  onToggle: (id: string) => void;
  onOpenDetail: (id: string) => void;
  // Deep-link target from the detail lightbox: the instructor name to scroll to and highlight.
  focusInstructor: string | null;
  // Called once the focus request has been consumed, so the parent can clear it.
  onFocusHandled: () => void;
}

interface InstructorGroup {
  key: string; // '' marks the blank/unlisted group, which always sorts last.
  name: string;
  kingdom: string; // distinct kingdoms joined, '' when none recorded.
  sessions: Session[];
}

const UNLISTED_KEY = '';
const UNLISTED_LABEL = 'Unlisted instructor';

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function InstructorsView({
  sessions,
  planIds,
  conflicts,
  trackColors,
  onToggle,
  onOpenDetail,
  focusInstructor,
  onFocusHandled,
}: Props) {
  const [query, setQuery] = useState('');
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  const planSet = useMemo(() => new Set(planIds), [planIds]);

  // All sessions grouped by instructor, instructors alphabetical, blanks last.
  const groups = useMemo<InstructorGroup[]>(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const key = (s.instructor ?? '').trim();
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    const result: InstructorGroup[] = [];
    for (const [key, list] of map) {
      const kingdoms = [
        ...new Set(list.map((s) => (s.instructorKingdom ?? '').trim()).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b));
      const sorted = [...list].sort(
        (a, b) =>
          a.day.localeCompare(b.day) ||
          a.startTime.localeCompare(b.startTime) ||
          a.title.localeCompare(b.title)
      );
      result.push({
        key,
        name: key || UNLISTED_LABEL,
        kingdom: kingdoms.join(', '),
        sessions: sorted,
      });
    }
    result.sort((a, b) => {
      if (a.key === UNLISTED_KEY) return 1;
      if (b.key === UNLISTED_KEY) return -1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return result;
  }, [sessions]);

  // Filter by instructor name; class title is a secondary match so a remembered class still finds it.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.sessions.some((s) => s.title.toLowerCase().includes(q))
    );
  }, [groups, query]);

  // Deep link from the lightbox: clear any active search so the full list is shown, then (after the
  // list has painted) scroll the target section into view and briefly highlight it.
  useEffect(() => {
    if (!focusInstructor) return;
    const key = focusInstructor.trim();
    setQuery('');
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = sectionRefs.current.get(key);
        if (el) {
          el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
          setHighlightKey(key);
        }
        onFocusHandled();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusInstructor]);

  // Drop the highlight after its pulse so it doesn't linger on later interactions.
  useEffect(() => {
    if (!highlightKey) return;
    const t = setTimeout(() => setHighlightKey(null), 1800);
    return () => clearTimeout(t);
  }, [highlightKey]);

  const totalInstructors = groups.length;

  return (
    <div class="instructors-view">
      <div class="instructors-toolbar">
        <label class="sr-only" for="instructor-search">Search instructors</label>
        <input
          id="instructor-search"
          class="filter-input"
          type="search"
          placeholder="Search instructors…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <span class="filter-result-count">
          {query.trim()
            ? `${filtered.length} of ${totalInstructors} instructors`
            : `${totalInstructors} instructors`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div class="empty-state">
          <h3>No instructors match</h3>
          <p>Try a different name, or clear the search to see everyone.</p>
        </div>
      ) : (
        <div class="instructors-list">
          {filtered.map((g) => {
            const count = g.sessions.length;
            return (
              <section
                key={g.key || UNLISTED_LABEL}
                class={`instructor-section${highlightKey === g.key ? ' is-highlighted' : ''}`}
                aria-label={`${g.name}, ${count} ${count === 1 ? 'class' : 'classes'}`}
                ref={(el: HTMLElement | null) => {
                  if (el) sectionRefs.current.set(g.key, el);
                  else sectionRefs.current.delete(g.key);
                }}
              >
                <header class="instructor-head">
                  <h3 class="instructor-name">{g.name}</h3>
                  <span class="instructor-meta">
                    {g.kingdom && <span class="instructor-kingdom">{g.kingdom}</span>}
                    <span class="instructor-count">{count} {count === 1 ? 'class' : 'classes'}</span>
                  </span>
                </header>
                <div class="instructor-sessions">
                  {g.sessions.map((s) => (
                    <SessionBlock
                      key={s.id}
                      session={s}
                      inPlan={planSet.has(s.id)}
                      trackColor={trackColors[s.track] ?? { l: 'hsl(220,55%,37%)', d: 'hsl(220,51%,49%)' }}
                      onToggle={() => onToggle(s.id)}
                      onOpenDetail={() => onOpenDetail(s.id)}
                      conflict={conflicts.has(s.id)}
                      showDay
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
