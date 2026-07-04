// MapStore — the single persistence seam for the mapper.
//
// A "map" is a named set of coloured, labelled pins that belongs to one event and lives in Cloudflare
// D1, reached by a capability URL. This store is remote-first once a server id exists, but map
// creation and every pin edit are **local-first**: the in-memory snapshot updates immediately and a
// short-debounced write flushes it to D1. This lets `empty` and `populated` states (see
// data-widget-state in README.md) be reached with zero network calls, which the offline render/journey
// gates require.
//
//   startLocalDraft(name)      — begin a brand-new map purely in memory (id `local-draft`), then (if
//                                 online) kick off a background POST /api/map to mint the real id/secret
//   addPin/updatePin/movePin/  — mutate the active map's pins locally, then debounce a write
//   removePin/setName
//   open(id, secret)    GET  /api/map/:id  — load an existing map (edit or read-only)
//   flush()                    — force any pending debounced write out immediately (e.g. before unload)
//
// Edits update the snapshot immediately and are flushed to D1 on a short debounce with If-Match on the
// current revision. A 409 (someone else edited the same map) is surfaced — never silently dropped — by
// reloading the server's copy and telling the UI the last change may not have saved.
//
// *** Offline-safe networking ***
// The render + journey gates run under `file://` with zero network (`egress: none`), and the journey
// harness treats any Chromium console error — including a failed `fetch()` — as a cell failure. Every
// network call in this store is therefore guarded behind `remoteEnabled()`, which is false under
// `file://`. `open()` returns an `error` result WITHOUT fetching; `startLocalDraft()`'s background
// create and the debounced write both skip the fetch entirely, keep the draft purely local, and emit a
// non-blocking `'local'` sync status instead. Never throw, never block the UI.

import { rememberDeviceMap } from './lib/deviceMaps';
import { editHash } from './lib/route';
import { DEFAULT_EVENT_ID } from './data/events';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'local';

export interface Pin {
  id: string;
  x: number; // normalized [0,1] over the base-map image, 0 = left
  y: number; // normalized [0,1] over the base-map image, 0 = top
  color: string; // a palette key (see lib/palette.ts)
  label: string;
}

export interface ActiveMap {
  id: string;
  secret: string | null; // present ⇒ editable; null ⇒ read-only view
  eventId: string;
  name: string;
  rev: number;
  pins: Pin[];
  updatedAt: string | null;
}

export type MapChange =
  | { type: 'active'; map: ActiveMap | null }
  | { type: 'sync'; status: SyncStatus; message?: string };

export type OpenResult =
  | { ok: true; map: ActiveMap }
  | { ok: false; reason: 'notfound' | 'error' };

export interface MapStore {
  getActive(): ActiveMap | null;
  getPins(): Pin[];
  open(id: string, secret: string | null): Promise<OpenResult>;
  startLocalDraft(name: string): ActiveMap;
  addPin(pin: Pin): void;
  updatePin(id: string, patch: Partial<Pick<Pin, 'x' | 'y' | 'color' | 'label'>>): void;
  movePin(id: string, x: number, y: number): void;
  removePin(id: string): void;
  setName(name: string): void;
  clear(): void;
  flush(): Promise<void>;
  subscribe(listener: (change: MapChange) => void): () => void;
}

const API_BASE = '/api/map';
const WRITE_DEBOUNCE_MS = 700;
const CONFLICT_MESSAGE = 'Reloaded from the server — your last change may not have been saved.';
const OFFLINE_MESSAGE = 'Offline — not saved.';

// Sentinel id/secret for a map that only exists in memory, before the background create() (if any)
// has resolved to a real server id. Never sent over the network.
const LOCAL_DRAFT_ID = 'local-draft';
const LOCAL_DRAFT_SECRET = 'local-draft';

/** NEVER fetch under `file://` — see the offline-safe networking note above. */
function remoteEnabled(): boolean {
  return typeof location !== 'undefined' && location.protocol !== 'file:';
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

class RemoteMapStore implements MapStore {
  private active: ActiveMap | null = null;
  private listeners = new Set<(change: MapChange) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private writing = false;

  getActive(): ActiveMap | null {
    return this.active;
  }

  getPins(): Pin[] {
    return this.active ? this.active.pins : [];
  }

  async open(id: string, secret: string | null): Promise<OpenResult> {
    if (!remoteEnabled()) return { ok: false, reason: 'error' };

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    } catch {
      return { ok: false, reason: 'error' };
    }
    if (res.status === 404) return { ok: false, reason: 'notfound' };
    if (!res.ok) return { ok: false, reason: 'error' };

    let data: ServerMap;
    try {
      data = (await res.json()) as ServerMap;
    } catch {
      return { ok: false, reason: 'error' };
    }

    const map: ActiveMap = {
      id: data.id,
      secret,
      eventId: data.eventId,
      name: data.name,
      rev: data.rev,
      pins: Array.isArray(data.pins) ? data.pins.slice() : [],
      updatedAt: data.updatedAt ?? null,
    };
    this.setActive(map);
    rememberDeviceMap({ id: map.id, secret, name: map.name, eventId: map.eventId });
    return { ok: true, map };
  }

  startLocalDraft(name: string): ActiveMap {
    const draft: ActiveMap = {
      id: LOCAL_DRAFT_ID,
      secret: LOCAL_DRAFT_SECRET,
      eventId: DEFAULT_EVENT_ID,
      name: name.trim() || 'Untitled map',
      rev: 0,
      pins: [],
      updatedAt: null,
    };
    this.setActive(draft);
    if (remoteEnabled()) {
      void this.backgroundCreate();
    } else {
      this.emitSync('local', OFFLINE_MESSAGE);
    }
    return draft;
  }

  addPin(pin: Pin): void {
    if (!this.active || !this.active.secret) return;
    if (this.active.pins.some((p) => p.id === pin.id)) return; // ids are caller-generated; a collision is a caller bug
    this.setActive({ ...this.active, pins: [...this.active.pins, { ...pin, x: clamp01(pin.x), y: clamp01(pin.y) }] });
    this.markDirty();
  }

  updatePin(id: string, patch: Partial<Pick<Pin, 'x' | 'y' | 'color' | 'label'>>): void {
    if (!this.active || !this.active.secret) return;
    const idx = this.active.pins.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const next = { ...this.active.pins[idx], ...patch };
    if ('x' in patch) next.x = clamp01(next.x);
    if ('y' in patch) next.y = clamp01(next.y);
    const pins = this.active.pins.slice();
    pins[idx] = next;
    this.setActive({ ...this.active, pins });
    this.markDirty();
  }

  movePin(id: string, x: number, y: number): void {
    this.updatePin(id, { x, y });
  }

  removePin(id: string): void {
    if (!this.active || !this.active.secret) return;
    if (!this.active.pins.some((p) => p.id === id)) return;
    this.setActive({ ...this.active, pins: this.active.pins.filter((p) => p.id !== id) });
    this.markDirty();
  }

  setName(name: string): void {
    if (!this.active || !this.active.secret) return;
    if (name === this.active.name) return;
    this.setActive({ ...this.active, name });
    this.markDirty();
  }

  clear(): void {
    // Drop the active map (landing mode). Any pending write is flushed first so edits aren't lost.
    void this.flush();
    if (this.active !== null) this.setActive(null);
  }

  subscribe(listener: (change: MapChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.runWrite(true);
  }

  // ── internal ────────────────────────────────────────────────────────────────────────────────

  private setActive(map: ActiveMap | null): void {
    this.active = map;
    this.emit({ type: 'active', map });
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runWrite();
    }, WRITE_DEBOUNCE_MS);
  }

  /** Mint a real id/secret for a local-only draft. Never drops edits made while the request is in flight. */
  private async backgroundCreate(): Promise<void> {
    const draft = this.active;
    if (!draft || draft.id !== LOCAL_DRAFT_ID) return;

    this.emitSync('saving');
    let res: Response;
    try {
      res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name, pins: draft.pins }),
      });
    } catch {
      this.emitSync('error', 'Could not reach the server to save this map.');
      return;
    }
    if (!res.ok) {
      this.emitSync('error', 'The server rejected the new map.');
      return;
    }
    let data: { id: string; editSecret: string; eventId: string };
    try {
      data = (await res.json()) as { id: string; editSecret: string; eventId: string };
    } catch {
      this.emitSync('error', 'The server returned an unexpected response.');
      return;
    }

    const cur = this.active;
    if (!cur || cur.id !== LOCAL_DRAFT_ID) return; // the user navigated away while this was in flight

    // Swap the local draft for the real id/secret, keeping whatever the user has edited since the
    // POST was sent — that snapshot is what's carried over, not the one the POST body was built from.
    const swapped: ActiveMap = {
      ...cur,
      id: data.id,
      secret: data.editSecret,
      eventId: data.eventId,
      rev: 1,
      updatedAt: new Date().toISOString(),
    };
    this.setActive(swapped);
    rememberDeviceMap({ id: swapped.id, secret: swapped.secret, name: swapped.name, eventId: swapped.eventId });
    if (typeof location !== 'undefined') location.hash = editHash(swapped.id, data.editSecret);
    this.emitSync('saved');

    if (this.dirty) void this.runWrite(); // pins/name changed while the create() was in flight
  }

  private async runWrite(keepalive = false): Promise<void> {
    if (this.writing) return; // a write is in flight; it re-checks `dirty` when it finishes
    const map = this.active;
    if (!map || !map.secret || !this.dirty) return;

    if (map.id === LOCAL_DRAFT_ID) {
      // No real id yet: either backgroundCreate() is still in flight (it will call runWrite() itself
      // once it swaps in a real id/secret) or we're offline and no create was ever attempted.
      if (!remoteEnabled()) {
        this.dirty = false;
        this.emitSync('local', OFFLINE_MESSAGE);
      }
      return;
    }

    if (!remoteEnabled()) {
      this.dirty = false;
      this.emitSync('local', OFFLINE_MESSAGE);
      return;
    }

    this.writing = true;
    this.dirty = false;
    const snapshotRev = map.rev;
    this.emitSync('saving');

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(map.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${map.secret}`,
          'If-Match': String(snapshotRev),
        },
        body: JSON.stringify({ name: map.name, pins: map.pins }),
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
      // A server-side (5xx) failure is transient: keep the edit dirty so flush()/a later change
      // retries it. A 4xx is our bug or a rejected body — don't loop on it.
      if (res.status >= 500) this.dirty = true;
      this.emitSync('error', res.status >= 500 ? 'Save failed — will retry.' : 'Save failed.');
      return;
    }

    try {
      const data = (await res.json()) as ServerMap;
      // Only the rev/updatedAt are authoritative from the response; keep the user's latest local edits.
      if (this.active && this.active.id === map.id) {
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
        const data = (await res.json()) as ServerMap;
        this.dirty = false;
        this.setActive({
          ...cur,
          name: data.name,
          rev: data.rev,
          pins: Array.isArray(data.pins) ? data.pins.slice() : [],
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

  private emit(change: MapChange): void {
    for (const l of this.listeners) {
      try {
        l(change);
      } catch {
        /* a listener throwing must not break the others */
      }
    }
  }
}

interface ServerMap {
  id: string;
  name: string;
  pins: Pin[];
  eventId: string;
  rev: number;
  updatedAt: string | null;
}

// Singleton — the app imports this one instance.
export const mapStore: MapStore = new RemoteMapStore();
