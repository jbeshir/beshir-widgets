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
  selectedInstructor: string | null;
  onSelectInstructor: (key: string | null) => void;
}

interface InstructorGroup {
  key: string; // '' marks the blank/unlisted group, which always sorts last.
  name: string;
  kingdom: string; // distinct kingdoms joined, '' when none recorded.
  sessions: Session[];
}

const UNLISTED_KEY = '';
const UNLISTED_LABEL = 'Unlisted instructor';

export function InstructorsView({
  sessions,
  planIds,
  conflicts,
  trackColors,
  onToggle,
  onOpenDetail,
  selectedInstructor,
  onSelectInstructor,
}: Props) {
  const [query, setQuery] = useState('');

  const backRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const prevKeyRef = useRef<string | null>(null);
  const savedScrollRef = useRef(0);

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

  useEffect(() => {
    if (selectedInstructor !== null) {
      backRef.current?.focus();
      prevKeyRef.current = selectedInstructor;
    } else if (prevKeyRef.current !== null) {
      window.scrollTo({ top: savedScrollRef.current, behavior: 'instant' });
      const rowEl = rowRefs.current.get(prevKeyRef.current);
      if (rowEl) rowEl.focus();
      else searchRef.current?.focus();
      prevKeyRef.current = null;
    }
  }, [selectedInstructor]);

  function handleSelectGroup(g: InstructorGroup) {
    savedScrollRef.current = window.scrollY;
    onSelectInstructor(g.key);
  }

  function handleBack() {
    onSelectInstructor(null);
  }

  const drillGroup = selectedInstructor !== null
    ? (groups.find((g) => g.key === selectedInstructor) ?? null)
    : null;

  const totalInstructors = groups.length;

  if (drillGroup !== null) {
    const count = drillGroup.sessions.length;
    return (
      <div class="instructors-view">
        <div class="instructor-detail">
          <button class="instructor-back-link" type="button" ref={backRef} onClick={handleBack}>
            ‹ All instructors
          </button>
          <div class="instructor-detail-header">
            <h2 class="instructor-name">{drillGroup.name}</h2>
            {drillGroup.kingdom && <span class="instructor-kingdom">{drillGroup.kingdom}</span>}
            <span class="instructor-count">{count} {count === 1 ? 'class' : 'classes'}</span>
          </div>
          <div class="instructor-sessions">
            {drillGroup.sessions.map((s) => (
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
        </div>
      </div>
    );
  }

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
          ref={searchRef}
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
        <div class="instructor-index">
          {filtered.map((g) => {
            const count = g.sessions.length;
            return (
              <button
                key={g.key || UNLISTED_LABEL}
                class="instructor-row"
                type="button"
                ref={(el: HTMLButtonElement | null) => {
                  if (el) rowRefs.current.set(g.key, el);
                  else rowRefs.current.delete(g.key);
                }}
                aria-label={`${g.name}${g.kingdom ? `, ${g.kingdom}` : ''}, ${count} ${count === 1 ? 'class' : 'classes'}`}
                onClick={() => handleSelectGroup(g)}
              >
                <span class="instructor-row-name">{g.name}</span>
                {g.kingdom && <span class="instructor-row-kingdom">{g.kingdom}</span>}
                <span class="instructor-row-count">{count} {count === 1 ? 'class' : 'classes'}</span>
                <span class="instructor-row-chevron" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
