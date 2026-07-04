// MapStore — the single persistence seam for the mapper.
//
// A "map" is a named set of coloured, labelled pins that belongs to one event and lives in Cloudflare
// D1, reached by a capability URL. The store is **remote-first with an explicit creation gate**: a D1
// row exists ONLY after the user asks for one. Nothing is ever kept "in memory but not yet persisted".
//
//   create(name, pins)  POST /api/map — mint a real id/secret up front; the returned map is already
//                        persisted (rev 1). This is the ONLY way a map comes into existence, and it is
//                        always a deliberate, user-initiated action (the "Create shared map" button, or
//                        "Duplicate to edit" on a shared map). No row is ever created as a side effect
//                        of an edit.
//   open(id, secret)    GET /api/map/:id — load an existing map (edit or read-only).
//   addPin/updatePin/   mutate the active (already-created) map's pins locally, then debounce a PUT.
//   movePin/removePin/  These are only ever reachable once a row exists, so they always have a real
//   setName             id + secret to write against.
//   flush()             force any pending debounced write out immediately (e.g. before unload).
//
// Edits update the snapshot immediately and are flushed to D1 on a short debounce with If-Match on the
// current revision. A 409 (someone else edited the same map) is surfaced — never silently dropped — by
// reloading the server's copy and telling the UI the last change may not have saved.
//
// *** Offline-safe networking ***
// The render + journey gates run under `file://` with zero network (`egress: none`), and the journey
// harness treats any Chromium console error — including a failed `fetch()` — as a cell failure. Every
// network call in this store is therefore guarded behind `remoteEnabled()`, which is false under
// `file://`. `open()` and `create()` return a failure result WITHOUT fetching, so the offline harness
// can drive the create→failure→retry path deterministically (it produces the `error` state with no
// network access). Never throw, never block the UI.

import { rememberDeviceMap } from './lib/deviceMaps';
import { DEFAULT_EVENT_ID } from './data/events';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

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

export type CreateResult =
  | { ok: true; map: ActiveMap }
  | { ok: false; message: string };

export interface MapStore {
  getActive(): ActiveMap | null;
  getPins(): Pin[];
  open(id: string, secret: string | null): Promise<OpenResult>;
  create(name?: string, pins?: Pin[]): Promise<CreateResult>;
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
const DEFAULT_MAP_NAME = 'Untitled map';
// Shown when a create is attempted with no network (offline, or the offline render/journey gate). It is
// the user-facing text for the deterministic offline failure path behind the "Create shared map" button.
const OFFLINE_CREATE_MESSAGE = "You're offline — connect to the internet to create a shared map.";

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

  /**
   * Mint a brand-new map on the server and make it the active, editable map. This is the creation gate:
   * a D1 row is only ever born here, in response to an explicit user action. Returns a failure result —
   * never throws — so the caller can show an inline retry affordance. Offline (including under the
   * file:// render/journey gate) it fails immediately WITHOUT touching the network.
   */
  async create(name: string = DEFAULT_MAP_NAME, pins: Pin[] = []): Promise<CreateResult> {
    if (!remoteEnabled()) {
      return { ok: false, message: OFFLINE_CREATE_MESSAGE };
    }

    const cleanName = name.trim() || DEFAULT_MAP_NAME;
    const cleanPins = pins.map((p) => ({ ...p, x: clamp01(p.x), y: clamp01(p.y) }));

    this.emitSync('saving');
    let res: Response;
    try {
      res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, pins: cleanPins }),
      });
    } catch {
      this.emitSync('error');
      return { ok: false, message: 'Could not reach the server — check your connection and try again.' };
    }
    if (!res.ok) {
      this.emitSync('error');
      return { ok: false, message: 'The server rejected the new map — please try again.' };
    }
    let data: { id: string; editSecret: string; eventId: string };
    try {
      data = (await res.json()) as { id: string; editSecret: string; eventId: string };
    } catch {
      this.emitSync('error');
      return { ok: false, message: 'The server returned an unexpected response — please try again.' };
    }

    const map: ActiveMap = {
      id: data.id,
      secret: data.editSecret,
      eventId: data.eventId,
      name: cleanName,
      rev: 1,
      pins: cleanPins,
      updatedAt: new Date().toISOString(),
    };
    this.setActive(map);
    rememberDeviceMap({ id: map.id, secret: map.secret, name: map.name, eventId: map.eventId });
    this.emitSync('saved');
    return { ok: true, map };
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
    // Drop the active map (return to the locked preview). Any pending write is flushed first so edits
    // aren't lost.
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

  private async runWrite(keepalive = false): Promise<void> {
    if (this.writing) return; // a write is in flight; it re-checks `dirty` when it finishes
    const map = this.active;
    // Every editable map here has a real server id (creation is gated), so there is no "no id yet" case.
    if (!map || !map.secret || !this.dirty) return;
    if (!remoteEnabled()) return; // defensive: never fetch under file:// (unreachable in practice — an editable map implies a prior successful create/open)

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
