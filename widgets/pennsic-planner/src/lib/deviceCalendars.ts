// "Your calendars on this device" — a non-authoritative convenience list in localStorage.
//
// The durable store is D1 (see store.ts); this list is ONLY a quick-access shortcut so a returning
// visitor can reopen calendars they made or edited here without digging through bookmarks. Clearing
// it loses nothing but the shortcuts — every calendar still lives at its capability URL. It records
// the edit secret so the shortcut links straight into edit mode; treat it as device-local and
// disposable, never as the source of truth for a plan.

export interface DeviceCalendar {
  id: string;
  secret: string | null; // null when only ever opened read-only on this device
  name: string;
  eventId: string;
  savedAt: string; // ISO-8601
}

const KEY = 'pennsic-planner:device-calendars:v1';
const MAX = 50;

function readAll(): DeviceCalendar[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (e): e is DeviceCalendar =>
        e && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.eventId === 'string'
    );
  } catch {
    return [];
  }
}

function writeAll(list: DeviceCalendar[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage may be unavailable (private mode / quota); the list is optional, so degrade silently */
  }
}

export function listDeviceCalendars(): DeviceCalendar[] {
  // Most-recently-saved first.
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Record (or refresh) a calendar shortcut. A later entry with a real secret upgrades a read-only one. */
export function rememberDeviceCalendar(entry: Omit<DeviceCalendar, 'savedAt'>): void {
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

export function forgetDeviceCalendar(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
}

export function clearDeviceCalendars(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
