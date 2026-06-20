import { cleanTranslation } from './translate-shared';

export interface TranslateRequest { base: string; features: string[]; form: string }

const memCache = new Map<string, string>();
const LS_PREFIX = 'vt-translate:';

function lsGet(key: string): string | null {
  try { return localStorage.getItem(LS_PREFIX + key); } catch { return null; }
}

function lsSet(key: string, val: string): void {
  try { localStorage.setItem(LS_PREFIX + key, val); } catch { /* sandboxed iframe */ }
}

export async function fetchTranslation(req: TranslateRequest, signal?: AbortSignal): Promise<string | null> {
  const key = `${req.base} ${req.form}`;

  if (memCache.has(key)) return memCache.get(key)!;

  const stored = lsGet(key);
  if (stored !== null) { memCache.set(key, stored); return stored; }

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ form: req.form, base: req.base, features: req.features }),
      signal,
    });

    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) {
      return null;
    }

    const data = await res.json() as { translation?: unknown };
    const t = cleanTranslation(typeof data.translation === 'string' ? data.translation : '');
    memCache.set(key, t);
    lsSet(key, t);
    return t;
  } catch {
    return null;
  }
}

export function peekTranslation(req: { base: string; form: string }): string | null {
  const key = `${req.base} ${req.form}`;
  if (memCache.has(key)) return memCache.get(key)!;
  const stored = lsGet(key);
  if (stored !== null) { memCache.set(key, stored); return stored; }
  return null;
}
