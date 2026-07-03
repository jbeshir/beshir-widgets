# Maintenance

Notes for maintaining the widget's bundled base-map image. This directory is **not** part of the
shipped SPA bundle and is never imported by `src/`.

## The bundled base map

The widget ships the **official Pennsic War land map** as a single static image,
`src/assets/pennsic-53-official-map.png` (1648×2551 PNG, ~570 KB, portrait). It is bundled at build
time and served offline — the widget never fetches a map at runtime, so pins and the whole map work
with zero network. There is no in-app upload or map picker.

Source: <https://land.pennsicwar.org/maps/53/pennsic_L.png> — the official Pennsic War land-map site
(captured 2026-07-03). In-image attribution: *Map Created by Aakin, Updated by Genoveva, Marit,
Tananda*.

Pins are stored as normalized `[0,1]` coordinates over the image (`{ x, y }` in each pin), so they
are resolution-independent: replacing the PNG with a different-resolution export of the **same map**
does not move existing pins. Replacing it with a **differently-framed** map (different crop/margins)
*will* shift where existing pins land, since the normalized frame changes — see below.

## Refreshing the map for a future Pennsic

Adding a future Pennsic is a build-only change (existing maps and their capability URLs keep working,
because the event id is stable and never encoded in the URL):

1. Fetch the new year's official land map, e.g. `land.pennsicwar.org/maps/<N>/pennsic_L.png` for
   Pennsic `<N>`.
2. Drop it into `src/assets/` (e.g. `pennsic-54-official-map.png`).
3. Add an entry to `src/data/events.ts` (`EVENTS`) with the new event id, name, year, its `baseMap`
   path, and `isDefault: true`; clear `isDefault` on the previous event and update
   `DEFAULT_EVENT_ID`. Update the static `import` in `src/components/MapSurface.tsx` to point at the
   new asset (or make it resolve per-event if more than one event ever ships at once).
4. Insert an `events` row with `is_default = 1` (and clear the old default) in `schema.sql` and the
   production D1, and update `DEFAULT_EVENT_ID` in `worker/index.ts` to match.
5. Update `widget.json → dataSources` and `README.md` to cite the new source and attribution.

If the new map is a different shape (aspect ratio), also update the map surface's `aspect-ratio` in
`src/styles.css` (`.map-surface`) so it displays without letterboxing or distortion — the pin
coordinate math derives normalized positions from the surface box, which is kept equal to the image
frame.
