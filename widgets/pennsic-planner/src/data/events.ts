// Events manifest — the SPA's map of event id → bundled schedule and metadata.
//
// Events are first-class: a calendar belongs to exactly one event, and the app resolves a calendar's
// schedule by looking its event_id up here. Schedules are bundled in the build (never in D1), so the
// widget renders fully offline. Adding a future Pennsic is a build-only change: import its schedule,
// add an entry below, and move `isDefault` (and DEFAULT_EVENT_ID) to it. Existing calendars and their
// capability URLs keep working because the event id is stable and never encoded in the URL.

import sessions2026 from './sessions-2026.json';
import type { Session } from '../types';

export interface EventDef {
  id: string;
  name: string;
  year: number;
  sessions: Session[];
  isDefault: boolean;
  defaultDay?: string;
}

// The default event new calendars attach to. Kept in sync with the Worker's DEFAULT_EVENT_ID and the
// seed row in schema.sql.
export const DEFAULT_EVENT_ID = 'pennsic-53';

export const EVENTS: Record<string, EventDef> = {
  'pennsic-53': {
    id: 'pennsic-53',
    name: 'Pennsic 53 (2026)',
    year: 2026,
    sessions: sessions2026 as Session[],
    isDefault: true,
    defaultDay: '2026-07-27',
  },
};

export function getEvent(id: string): EventDef | undefined {
  return EVENTS[id];
}

export const DEFAULT_EVENT = EVENTS[DEFAULT_EVENT_ID];
