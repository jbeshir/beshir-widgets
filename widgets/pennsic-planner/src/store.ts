// PlanStore — the single persistence seam for the planner.
//
// A "plan" is no longer device-local: it is a named calendar of selected session ids that belongs to
// one event and lives in Cloudflare D1, reached by a capability URL. This store is remote-first. It
// owns the in-memory snapshot of the *active* calendar and talks to the Worker over fetch():
//
//   open(id, secret)   GET  /api/calendar/:id     — load an existing calendar (edit or read-only)
//   create(name, ids)  POST /api/calendar         — make a new calendar, return its id + edit secret
//   togglePlan(id)     PUT  /api/calendar/:id      — debounced, optimistic-concurrency edit
//
// Edits update the snapshot immediately and are flushed to D1 on a short debounce with If-Match on
// the current revision. A 409 (someone else edited the same calendar) is surfaced — never silently
// dropped — by reloading the server's copy and telling the UI the last change may not have saved.
//
// The bundled event schedules are the only datasets (see data/events.ts); there is no user-provided
// dataset, so this store carries none. localStorage is used ONLY by lib/deviceCalendars.ts for a
// non-authoritative "calendars on this device" shortcut list — never for a plan.

import { rememberDeviceCalendar } from './lib/deviceCalendars';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface ActiveCalendar {
  id: string;
  secret: string | null; // present ⇒ editable; null ⇒ read-only view
  eventId: string;
  name: string;
  rev: number;
  sessionIds: string[];
  updatedAt: string | null;
}

export type PlanChange =
  | { type: 'active'; calendar: ActiveCalendar | null }
  | { type: 'sync'; status: SyncStatus; message?: string };

export type OpenResult =
  | { ok: true; calendar: ActiveCalendar }
  | { ok: false; reason: 'notfound' | 'error' };

export interface PlanStore {
  getActive(): ActiveCalendar | null;
  getPlan(): string[];
  open(id: string, secret: string | null): Promise<OpenResult>;
  create(name: string, sessionIds: string[]): Promise<{ id: string; secret: string; eventId: string } | null>;
  togglePlan(id: string): void;
  setName(name: string): void;
  clear(): void;
  flush(): Promise<void>;
  subscribe(listener: (change: PlanChange) => void): () => void;
}

const API_BASE = '/api/calendar';
const WRITE_DEBOUNCE_MS = 700;
const CONFLICT_MESSAGE = 'Reloaded from the server — your last change may not have been saved.';

class RemotePlanStore implements PlanStore {
  private active: ActiveCalendar | null = null;
  private listeners = new Set<(change: PlanChange) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private writing = false;

  getActive(): ActiveCalendar | null {
    return this.active;
  }

  getPlan(): string[] {
    return this.active ? this.active.sessionIds : [];
  }

  async open(id: string, secret: string | null): Promise<OpenResult> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    } catch {
      return { ok: false, reason: 'error' };
    }
    if (res.status === 404) return { ok: false, reason: 'notfound' };
    if (!res.ok) return { ok: false, reason: 'error' };

    let data: ServerCalendar;
    try {
      data = (await res.json()) as ServerCalendar;
    } catch {
      return { ok: false, reason: 'error' };
    }

    const calendar: ActiveCalendar = {
      id: data.id,
      secret,
      eventId: data.eventId,
      name: data.name,
      rev: data.rev,
      sessionIds: Array.isArray(data.sessionIds) ? data.sessionIds.slice() : [],
      updatedAt: data.updatedAt ?? null,
    };
    this.setActive(calendar);
    rememberDeviceCalendar({ id: calendar.id, secret, name: calendar.name, eventId: calendar.eventId });
    return { ok: true, calendar };
  }

  async create(
    name: string,
    sessionIds: string[]
  ): Promise<{ id: string; secret: string; eventId: string } | null> {
    this.emitSync('saving');
    let res: Response;
    try {
      res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sessionIds }),
      });
    } catch {
      this.emitSync('error', 'Could not reach the server to create the calendar.');
      return null;
    }
    if (!res.ok) {
      this.emitSync('error', 'The server rejected the new calendar.');
      return null;
    }
    const data = (await res.json()) as { id: string; editSecret: string; eventId: string };

    const calendar: ActiveCalendar = {
      id: data.id,
      secret: data.editSecret,
      eventId: data.eventId,
      name,
      rev: 1,
      sessionIds: dedupe(sessionIds),
      updatedAt: new Date().toISOString(),
    };
    this.setActive(calendar);
    this.emitSync('saved');
    rememberDeviceCalendar({ id: calendar.id, secret: data.editSecret, name, eventId: data.eventId });
    return { id: data.id, secret: data.editSecret, eventId: data.eventId };
  }

  togglePlan(id: string): void {
    if (!this.active || !this.active.secret) return; // editing requires an active editable calendar
    const has = this.active.sessionIds.includes(id);
    const sessionIds = has
      ? this.active.sessionIds.filter((x) => x !== id)
      : [...this.active.sessionIds, id];
    this.setActive({ ...this.active, sessionIds });
    this.markDirty();
  }

  setName(name: string): void {
    if (!this.active || !this.active.secret) return;
    if (name === this.active.name) return;
    this.setActive({ ...this.active, name });
    this.markDirty();
  }

  clear(): void {
    // Drop the active calendar (landing mode). Any pending write is flushed first so edits aren't lost.
    void this.flush();
    if (this.active !== null) this.setActive(null);
  }

  subscribe(listener: (change: PlanChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── internal ────────────────────────────────────────────────────────────────────────────────

  private setActive(calendar: ActiveCalendar | null): void {
    this.active = calendar;
    this.emit({ type: 'active', calendar });
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runWrite();
    }, WRITE_DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.runWrite(true);
  }

  private async runWrite(keepalive = false): Promise<void> {
    if (this.writing) return; // a write is in flight; it re-checks `dirty` when it finishes
    const cal = this.active;
    if (!cal || !cal.secret || !this.dirty) return;

    this.writing = true;
    this.dirty = false;
    const snapshotRev = cal.rev;
    this.emitSync('saving');

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(cal.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cal.secret}`,
          'If-Match': String(snapshotRev),
        },
        body: JSON.stringify({ name: cal.name, sessionIds: cal.sessionIds }),
        keepalive,
      });
    } catch {
      this.dirty = true; // network blip — let a later change or flush retry
      this.writing = false;
      this.emitSync('error', 'Offline — changes will retry.');
      return;
    }

    if (res.status === 409) {
      // Hold the write lock across the reload so a queued write can't race the refetch.
      await this.reloadAfterConflict();
      this.writing = false;
      return;
    }
    if (!res.ok) {
      this.writing = false;
      this.emitSync('error', 'Save failed.');
      return;
    }

    try {
      const data = (await res.json()) as ServerCalendar;
      // Only the rev/updatedAt are authoritative from the response; keep the user's latest local edits.
      if (this.active && this.active.id === cal.id) {
        this.setActive({ ...this.active, rev: data.rev, updatedAt: data.updatedAt ?? this.active.updatedAt });
      }
    } catch {
      /* response body optional for our purposes */
    }
    this.writing = false;
    this.emitSync('saved');

    if (this.dirty) void this.runWrite(); // more edits arrived mid-flight — flush them
  }

  private async reloadAfterConflict(): Promise<void> {
    const cur = this.active;
    if (!cur) return;
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(cur.id)}`, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = (await res.json()) as ServerCalendar;
        this.dirty = false;
        this.setActive({
          ...cur,
          name: data.name,
          rev: data.rev,
          sessionIds: Array.isArray(data.sessionIds) ? data.sessionIds.slice() : [],
          updatedAt: data.updatedAt ?? cur.updatedAt,
        });
      }
    } catch {
      /* leave the local snapshot in place if the reload itself fails */
    }
    this.emitSync('conflict', CONFLICT_MESSAGE);
  }

  private emitSync(status: SyncStatus, message?: string): void {
    this.emit({ type: 'sync', status, message });
  }

  private emit(change: PlanChange): void {
    for (const l of this.listeners) {
      try {
        l(change);
      } catch {
        /* a listener throwing must not break the others */
      }
    }
  }
}

interface ServerCalendar {
  id: string;
  name: string;
  sessionIds: string[];
  eventId: string;
  rev: number;
  updatedAt: string | null;
}

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

// Singleton — the app imports this one instance.
export const planStore: PlanStore = new RemotePlanStore();
