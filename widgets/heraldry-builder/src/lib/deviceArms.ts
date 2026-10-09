// "Your arms on this device" — a non-authoritative convenience list in localStorage.
//
// The durable store is D1 (see store.ts); this list is ONLY a quick-access shortcut so a returning
// visitor can reopen arms they registered here without digging out the edit link. Clearing it
// loses nothing but the shortcuts — every entry still lives at its capability URL. It records the
// edit secret so the shortcut links straight into the owner view; treat it as device-local and
// disposable, never as the source of truth. Only store.ts imports this module.

export interface DeviceArms {
  id: string;
  registry: string; // registry id the entry belongs to
  displayName: string;
  blazon: string;
  secret: string | null; // null when only ever viewed on this device
  savedAt: string; // ISO-8601
}

const KEY = 'heraldry-builder:device-arms:v1';
const MAX = 50;

function readAll(): DeviceArms[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (e): e is DeviceArms =>
        e &&
        typeof e.id === 'string' &&
        typeof e.registry === 'string' &&
        typeof e.displayName === 'string' &&
        typeof e.blazon === 'string' &&
        (e.secret === null || typeof e.secret === 'string') &&
        typeof e.savedAt === 'string'
    );
  } catch {
    return [];
  }
}

function writeAll(list: DeviceArms[]): void {
  try {
    // Keep the most recent MAX shortcuts.
    const sorted = list.slice().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    localStorage.setItem(KEY, JSON.stringify(sorted.slice(0, MAX)));
  } catch {
    /* storage may be unavailable (private mode / quota); the list is optional, so degrade silently */
  }
}

export function listDeviceArms(): DeviceArms[] {
  // Most-recently-saved first.
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Record (or refresh) a shortcut. A later entry with a real secret upgrades a view-only one. */
export function rememberDeviceArms(entry: Omit<DeviceArms, 'savedAt'>): void {
  const list = readAll();
  const existing = list.find((e) => e.id === entry.id);
  const savedAt = new Date().toISOString();
  if (existing) {
    existing.registry = entry.registry;
    existing.displayName = entry.displayName;
    existing.blazon = entry.blazon;
    if (entry.secret) existing.secret = entry.secret; // never downgrade a known secret to null
    existing.savedAt = savedAt;
  } else {
    list.push({ ...entry, savedAt });
  }
  writeAll(list);
}

export function forgetDeviceArms(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
}

export function clearDeviceArms(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
