// Sidecar metadata of the modern charges: everything about each charge but its path strings, which are in art/paths. CHARGES
// (charges.ts) adds the id and the default facing to each row.

import type { ChargeMetaRow } from '../types';
import { HAND_DRAWN, PROPER } from './common';

export const META_MODERN = {
  'musical-note': {
    name: 'musical note', plural: 'musical notes', article: 'a', category: 'modern',
    typeClass: 'musical-note', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'compact-top', allowed: [] },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 1.15, detail: 1, proper: null,
    glossName: 'musical note', glossPlural: 'musical notes', plain: null, search: ['music', 'note'],
    headName: null, holdable: false,
    drawings: {
      _: { onBox: null, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  flame: {
    name: 'flame', plural: 'flames', article: 'a', category: 'modern',
    typeClass: 'flame', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'compact-top', allowed: [] },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 0.95, detail: 0, proper: PROPER.fire,
    glossName: 'flame', glossPlural: 'flames', plain: null, search: ['fire'],
    headName: null, holdable: false,
    drawings: {
      _: { onBox: { x: 58, y: 37, w: 24, h: 38 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  gear: {
    name: 'cogwheel', plural: 'cogwheels', article: 'a', category: 'modern',
    typeClass: 'cogwheel', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'radial', allowed: [] },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 0.9, detail: 0, proper: null,
    glossName: 'gear', glossPlural: 'gears', plain: null, search: ['cog', 'gear', 'gearwheel'],
    headName: null, holdable: false,
    drawings: {
      _: { onBox: null, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  lightbulb: {
    name: 'lightbulb', plural: 'lightbulbs', article: 'a', category: 'modern',
    typeClass: 'lightbulb', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'compact-top', allowed: [] },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 1.1, detail: 1, proper: null,
    glossName: 'lightbulb', glossPlural: 'lightbulbs', plain: null, search: ['light bulb', 'lamp'],
    headName: null, holdable: false,
    drawings: {
      _: { onBox: { x: 29, y: 17, w: 42, h: 30 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
} satisfies Record<string, ChargeMetaRow>;
