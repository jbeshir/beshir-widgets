// The fixed pin colour palette — 8 mutually-distinct, CVD-safe hues shared by the Worker (input
// validation) and the SPA (colour swatches). Never rely on colour alone to distinguish a pin: every
// pin also carries a label, and the legend is the primary accessibility aid (see README.md).
//
// Each hue's `light`/`dark` hex was chosen so both variants hold >=3:1 WCAG contrast against BOTH
// a warm-parchment light background (#fdf2e0) and a deep near-black dark background (#15100d) — the
// two base-map surfaces (see src/data/events.ts). That pins the relative luminance of every swatch
// into a narrow ~0.13–0.27 band; hues are spread 35°–60° apart (with `slate` desaturated as a
// neutral anchor) so the set stays distinguishable under protanopia/deuteranopia/tritanopia.
//
// This module has no DOM/runtime dependency so the Worker (worker/index.ts) can import it directly
// for validation; verify tsconfig.worker.json's `include` covers this path if it moves.

export interface PaletteColor {
  key: string;
  name: string;
  light: string; // hex, used on the light (warm-parchment) base map
  dark: string; // hex, used on the dark (near-black) base map
}

export const PALETTE: readonly PaletteColor[] = [
  { key: 'rose', name: 'Rose', light: '#be2c45', dark: '#da6276' },
  { key: 'gold', name: 'Gold', light: '#696919', dark: '#8d8e21' },
  { key: 'teal', name: 'Teal', light: '#1b725d', dark: '#249b7d' },
  { key: 'indigo', name: 'Indigo', light: '#5d51d6', dark: '#857de1' },
  { key: 'green', name: 'Green', light: '#31741b', dark: '#429c25' },
  { key: 'orange', name: 'Orange', light: '#995424', dark: '#cd7130' },
  { key: 'violet', name: 'Violet', light: '#a42cbb', dark: '#c55fd9' },
  { key: 'slate', name: 'Slate', light: '#426986', dark: '#5f8eb0' },
];

export const PALETTE_KEYS: string[] = PALETTE.map((c) => c.key);

export function isPaletteKey(k: unknown): k is string {
  return typeof k === 'string' && PALETTE_KEYS.includes(k);
}
