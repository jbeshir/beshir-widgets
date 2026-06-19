// PlanStore — the single persistence seam for the planner.
//
// Everything the UI persists (the set of selected session ids, and any user-imported dataset)
// goes through this one module. The signatures are intentionally **async** (Promise-returning) so
// the current localStorage implementation can later be swapped for a Cloudflare-KV-backed remote
// implementation — for a signed-in user, "my plan" would live in KV keyed by user id — without
// touching any caller. The UI never calls localStorage directly; it calls a PlanStore.
//
// To add a KV backend later: implement this same interface against `fetch('/api/plan', …)` talking
// to the Worker (which reads/writes KV), keep the in-memory cache + subscription model, and select
// the backend at startup. The async interface is the only seam that needs to exist for that swap.

import type { Session } from './types';

export type PlanChange =
  | { type: 'plan'; ids: string[] }
  | { type: 'dataset'; dataset: Session[] | null };

export interface PlanStore {
  getPlan(): Promise<string[]>;
  setPlan(ids: string[]): Promise<void>;
  togglePlan(id: string): Promise<string[]>;
  getDataset(): Promise<Session[] | null>;
  setDataset(dataset: Session[] | null): Promise<void>;
  subscribe(listener: (change: PlanChange) => void): () => void;
}

const PLAN_KEY = 'pennsic-planner:plan:v1';
const DATASET_KEY = 'pennsic-planner:dataset:v1';

/** localStorage-backed PlanStore. Reads are async to match the future remote backend. */
class LocalPlanStore implements PlanStore {
  private listeners = new Set<(change: PlanChange) => void>();

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be unavailable (private mode / quota); degrade to in-memory only */
    }
  }

  private emit(change: PlanChange): void {
    for (const l of this.listeners) {
      try {
        l(change);
      } catch {
        /* a listener throwing must not break others */
      }
    }
  }

  async getPlan(): Promise<string[]> {
    const ids = this.read<string[]>(PLAN_KEY, []);
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
  }

  async setPlan(ids: string[]): Promise<void> {
    const unique = Array.from(new Set(ids));
    this.write(PLAN_KEY, unique);
    this.emit({ type: 'plan', ids: unique });
  }

  async togglePlan(id: string): Promise<string[]> {
    const ids = await this.getPlan();
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    await this.setPlan(next);
    return next;
  }

  async getDataset(): Promise<Session[] | null> {
    return this.read<Session[] | null>(DATASET_KEY, null);
  }

  async setDataset(dataset: Session[] | null): Promise<void> {
    this.write(DATASET_KEY, dataset);
    this.emit({ type: 'dataset', dataset });
  }

  subscribe(listener: (change: PlanChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Singleton — the app imports this one instance.
export const planStore: PlanStore = new LocalPlanStore();
