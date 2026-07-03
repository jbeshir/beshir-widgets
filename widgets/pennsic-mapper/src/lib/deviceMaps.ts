// "Your maps on this device" — a non-authoritative convenience list in localStorage.
//
// The durable store is D1 (see store.ts); this list is ONLY a quick-access shortcut so a returning
// visitor can reopen maps they made or edited here without digging through bookmarks. Clearing it
// loses nothing but the shortcuts — every map still lives at its capability URL. It records the
// edit secret so the shortcut links straight into edit mode; treat it as device-local and
// disposable, never as the source of truth for a map.

export interface DeviceMap {
  id: string;
  secret: string | null; // null when only ever opened read-only on this device
  name: string;
  eventId: string;
  savedAt: string; // ISO-8601
}

const KEY = 'pennsic-mapper:device-maps:v1';
const MAX = 50;

function readAll(): DeviceMap[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (e): e is DeviceMap =>
        e && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.eventId === 'string'
    );
  } catch {
    return [];
  }
}

function writeAll(list: DeviceMap[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage may be unavailable (private mode / quota); the list is optional, so degrade silently */
  }
}

export function listDeviceMaps(): DeviceMap[] {
  // Most-recently-saved first.
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Record (or refresh) a map shortcut. A later entry with a real secret upgrades a read-only one. */
export function rememberDeviceMap(entry: Omit<DeviceMap, 'savedAt'>): void {
  const list = readAll();
  const existing = list.find((e) => e.id === entry.id);
  const savedAt = new Date().toISOString();
  if (existing) {
    existing.name = entry.name;
    existing.eventId = entry.eventId;
    if (entry.secret) existing.secret = entry.secret; // never downgrade a known secret to null
    existing.savedAt = savedAt;
  } else {
    list.push({ ...entry, savedAt });
  }
  writeAll(list);
}

export function forgetDeviceMap(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
}

export function clearDeviceMaps(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
