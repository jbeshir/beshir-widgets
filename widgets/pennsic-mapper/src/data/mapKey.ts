// The map's baked-in legend, hoisted into real UI.
//
// The official Pennsic LIII land map prints several information blocks directly on the raster — a
// Royal Encampments list, an icon/fill legend, a Town Square area key, a Bus Routes key, and a
// credit line — all in fixed-size type that is only legible when zoomed in tight. This module is the
// hand-transcribed, verbatim source for those blocks, rendered as accessible HTML by MapKey.tsx and
// RoyalEncampments.tsx so nobody has to squint at the print. It is bundled data, never fetched and
// never scraped from the image at runtime.
//
// The normalized [0,1] coordinates on each royal encampment are approximate centroids estimated by
// eye from the bundled image (there is no per-block geometry to derive them from); they only need to
// be good enough to pan/zoom the map to "roughly here", which RoyalEncampments uses for its
// click-to-jump. They are NOT authoritative geodata.

// ── Royal Encampments (kingdom → block code) ──────────────────────────────────────────────────────

export interface RoyalEncampment {
  kingdom: string;
  /** Block code as printed on the map, e.g. "N04", "E06-2". */
  block: string;
  /** Approximate normalized [0,1] centroid of the block on the base-map image (see module note). */
  x: number;
  y: number;
}

// Alphabetical by kingdom, matching the order printed on the map.
export const ROYAL_ENCAMPMENTS: readonly RoyalEncampment[] = [
  { kingdom: 'Æthelmearc', block: 'N04', x: 0.738, y: 0.495 },
  { kingdom: 'An Tir', block: 'E06-2', x: 0.741, y: 0.599 },
  { kingdom: 'Ansteorra', block: 'N06', x: 0.775, y: 0.474 },
  { kingdom: 'Artemisia', block: 'N08', x: 0.775, y: 0.455 },
  { kingdom: 'Atenveldt', block: 'N10', x: 0.741, y: 0.437 },
  { kingdom: 'Atlantia', block: 'N40-1', x: 0.704, y: 0.310 },
  { kingdom: 'Avacal', block: 'N40-2', x: 0.732, y: 0.316 },
  { kingdom: 'Caid', block: 'N30', x: 0.723, y: 0.332 },
  { kingdom: 'Calontir', block: 'N05', x: 0.849, y: 0.474 },
  { kingdom: 'Drachenwald', block: 'N13', x: 0.762, y: 0.416 },
  { kingdom: 'Ealdormere', block: 'W17-1', x: 0.528, y: 0.756 },
  { kingdom: 'East', block: 'E06-1', x: 0.701, y: 0.576 },
  { kingdom: 'Gleann Abhann', block: 'N12', x: 0.849, y: 0.415 },
  { kingdom: 'Lochac', block: 'X01', x: 0.503, y: 0.542 },
  { kingdom: 'Meridies', block: 'N03', x: 0.849, y: 0.494 },
  { kingdom: 'Middle', block: 'W01', x: 0.541, y: 0.607 },
  { kingdom: 'Northshield', block: 'E02', x: 0.808, y: 0.555 },
  { kingdom: 'Outlands', block: 'W03-1', x: 0.473, y: 0.590 },
  { kingdom: 'Trimaris', block: 'W17-2', x: 0.516, y: 0.779 },
  { kingdom: 'West', block: 'W03-2', x: 0.473, y: 0.604 },
];

// ── Icon / fill legend ────────────────────────────────────────────────────────────────────────────

// Each entry names a glyph that MapKey.tsx renders as a real swatch/icon (see KeyGlyph). `kind`
// selects the visual: a filled area colour, a small pictographic icon, or a sample line stroke.
export type KeyGlyph =
  | 'ems'
  | 'access-assist'
  | 'access-camp'
  | 'water-src'
  | 'transfer'
  | 'fill-noncamp'
  | 'fill-parking'
  | 'fill-royal'
  | 'fill-xblock'
  | 'fill-water'
  | 'line-oneway'
  | 'line-footpath'
  | 'line-mainloop'
  | 'line-westloop';

export interface LegendItem {
  glyph: KeyGlyph;
  label: string;
}

// Icons + fills, as printed in the map's legend column (top group = icons, then the area fills, then
// the two line strokes).
export const ICON_FILL_LEGEND: readonly LegendItem[] = [
  { glyph: 'ems', label: 'EMS' },
  { glyph: 'access-assist', label: 'Accessibility Assistance' },
  { glyph: 'access-camp', label: 'Accessible Camping' },
  { glyph: 'fill-noncamp', label: 'Non-camping areas' },
  { glyph: 'fill-parking', label: 'Parking' },
  { glyph: 'fill-royal', label: 'Royal encampments' },
  { glyph: 'fill-xblock', label: 'X blocks' },
  { glyph: 'fill-water', label: 'Water' },
  { glyph: 'water-src', label: 'Public Filtered Water Src.' },
  { glyph: 'line-oneway', label: 'One-Way Roads' },
  { glyph: 'line-footpath', label: 'Foot Paths' },
];

// ── Town Square Area Key (numbered 1–5) ─────────────────────────────────────────────────────────────

export interface AreaKeyItem {
  n: number;
  label: string;
  /** Optional supporting detail printed under/after the label on the map. */
  detail?: string;
}

export const TOWN_SQUARE_KEY: readonly AreaKeyItem[] = [
  { n: 1, label: 'Town Hall', detail: 'Information Point · Lost & Found · Accessibility Assistance (across from Cooper’s Store)' },
  { n: 2, label: 'Playground' },
  { n: 3, label: 'Pennsic-U Downtown Campus' },
  { n: 4, label: 'Herald’s Point' },
  { n: 5, label: 'Showers & Laundry' },
];

// ── Bus Routes ──────────────────────────────────────────────────────────────────────────────────────

export const BUS_ROUTES: readonly LegendItem[] = [
  { glyph: 'transfer', label: 'Transfer Point' },
  { glyph: 'line-mainloop', label: 'Main Loop' },
  { glyph: 'line-westloop', label: 'West Loop' },
];

// ── Credit / source ───────────────────────────────────────────────────────────────────────────────

export const MAP_CREDIT = {
  createdBy: 'Map created by Aakin. Updated by Genoveva, Marit, Tananda.',
  lastEdit: '2026-Jun-5',
  sourceUrl: 'https://land.pennsicwar.org/maps/53/pennsic_L.png',
  sourceLabel: 'Official Pennsic War land map',
} as const;
