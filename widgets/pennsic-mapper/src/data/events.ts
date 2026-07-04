// Events manifest — the SPA's map of event id → base-map art and metadata.
//
// Events are first-class: a map belongs to exactly one event, and the app resolves a map's base-map
// art by looking its event_id up here. Base-map art is bundled in the build (never in D1), so the
// widget renders fully offline. Adding a future Pennsic is a build-only change: drop its official
// land-map PNG under src/assets/, add an entry below, and move `isDefault` (and DEFAULT_EVENT_ID) to
// it. Existing maps and their capability URLs keep working because the event id is stable and never
// encoded in the URL. See `maintenance/README.md` for the refresh procedure.
//
// `baseMap` is the *relative import path* to the bundled land-map image (src/assets/
// pennsic-53-official-map.png). It is a plain string here, not an `import`: this module must
// typecheck standalone and is imported by the Worker for validation, which has no bundler asset
// pipeline. The component that renders the map surface (MapSurface.tsx) is expected to `import` that
// same file directly with a static `import ... from '../assets/pennsic-53-official-map.png'` of its
// own — this string exists only so this manifest documents which asset belongs to which event; it is
// not meant to be passed to `import()`.

export interface EventDef {
  id: string;
  name: string;
  year: number;
  isDefault: boolean;
  /** Documentation only — see the module comment. The real asset is statically imported by the UI. */
  baseMap: string;
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
    baseMap: '../assets/pennsic-53-official-map.png',
  },
};

export function getEvent(id: string): EventDef | undefined {
  return EVENTS[id];
}

export const DEFAULT_EVENT = EVENTS[DEFAULT_EVENT_ID];
