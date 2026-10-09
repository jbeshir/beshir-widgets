// The unsaved builder design, autosaved to localStorage so a refresh doesn't lose work in progress.
//
// Purely a convenience: the draft never leaves the device and is not a registration. It is stored
// raw and re-parsed by the store on load (an unreadable or stale draft is simply ignored). Only
// store.ts imports this module.

const KEY = 'heraldry-builder:draft:v1';

interface StoredDraft {
  v: 1;
  savedAt: string; // ISO-8601
  design: unknown;
}

export function readDraft(): unknown | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredDraft> | null;
    if (!v || typeof v !== 'object' || v.v !== 1 || !('design' in v)) return null;
    return v.design ?? null;
  } catch {
    return null;
  }
}

export function writeDraft(design: unknown): void {
  try {
    const draft: StoredDraft = { v: 1, savedAt: new Date().toISOString(), design };
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage may be unavailable (private mode / quota); drafts are optional, so degrade silently */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
