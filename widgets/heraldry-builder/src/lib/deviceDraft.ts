// The unsaved builder design and the shape it is previewed in, autosaved to localStorage so a
// refresh doesn't lose work in progress.
//
// Purely a convenience: the draft never leaves the device and is not a registration. It is stored
// raw and re-parsed by the store on load (an unreadable or stale draft is simply ignored). Drafts
// saved before field shapes existed (v: 1) have no shape; the store shows them as heater shields.
// Only store.ts imports this module.

import type { FieldShape } from './heraldry';

const KEY = 'heraldry-builder:draft:v1';

interface StoredDraft {
  v: 2;
  savedAt: string; // ISO-8601
  design: unknown;
  shape: FieldShape;
}

/** The stored draft as written; `shape` is undefined for a draft saved before field shapes. */
export interface RawDraft {
  design: unknown;
  shape: unknown;
}

export function readDraft(): RawDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { v?: unknown; design?: unknown; shape?: unknown } | null;
    if (!v || typeof v !== 'object' || (v.v !== 1 && v.v !== 2) || v.design == null) return null;
    return { design: v.design, shape: v.v === 2 ? v.shape : undefined };
  } catch {
    return null;
  }
}

export function writeDraft(design: unknown, shape: FieldShape): void {
  try {
    const draft: StoredDraft = { v: 2, savedAt: new Date().toISOString(), design, shape };
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
