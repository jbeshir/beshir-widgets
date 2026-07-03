// Events manifest — the SPA's map of event id → base-map art and metadata.
//
// Events are first-class: a map belongs to exactly one event, and the app resolves a map's base-map
// art by looking its event_id up here. Base-map art is bundled in the build (never in D1), so the
// widget renders fully offline. Adding a future Pennsic is a build-only change: add its base-map SVGs
// under src/assets/, add an entry below, and move `isDefault` (and DEFAULT_EVENT_ID) to it. Existing
// maps and their capability URLs keep working because the event id is stable and never encoded in the URL.
//
// `baseMapLight`/`baseMapDark` are the *relative import paths* to the base-map SVGs (src/assets/
// basemap-light.svg / basemap-dark.svg — phase02's UI). They are plain strings here, not `import`s: at
// scaffold time those files don't exist yet, and this module must typecheck standalone. The component
// that renders the map surface (App.tsx) is expected to `import` those same two files directly with a
// static `import ... from '../assets/basemap-<theme>.svg'` of its own — these strings exist only so
// this manifest documents which asset belongs to which event; they are not meant to be passed to
// `import()`.

export interface EventDef {
  id: string;
  name: string;
  year: number;
  isDefault: boolean;
  /** Documentation only — see the module comment. The real asset is statically imported by the UI. */
  baseMapLight: string;
  baseMapDark: string;
}

// The default event new maps attach to. Kept in sync with the Worker's DEFAULT_EVENT_ID and the seed
// row in schema.sql.
export const DEFAULT_EVENT_ID = 'pennsic-53';

export const EVENTS: Record<string, EventDef> = {
  'pennsic-53': {
    id: 'pennsic-53',
    name: 'Pennsic 53 (2026)',
    year: 2026,
    isDefault: true,
    baseMapLight: '../assets/basemap-light.svg',
    baseMapDark: '../assets/basemap-dark.svg',
  },
};

export function getEvent(id: string): EventDef | undefined {
  return EVENTS[id];
}

export const DEFAULT_EVENT = EVENTS[DEFAULT_EVENT_ID];
