// Sidecar metadata of the plants: everything about each charge but its path strings, which are in art/paths. CHARGES
// (charges.ts) adds the id and the default facing to each row.

import type { ChargeMetaRow } from '../types';
import { HAND_DRAWN, PROPER } from './common';

export const META_PLANT = {
  rose: {
    name: 'rose', plural: 'roses', article: 'a', category: 'plant',
    typeClass: 'rose', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'radial', allowed: [] },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 0.88, detail: 0, proper: PROPER.rose,
    glossName: 'rose', glossPlural: 'roses', plain: null, search: [],
    headName: null, holdable: false,
    drawings: {
      _: { onBox: { x: 20, y: 21, w: 60, h: 56 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  tree: {
    name: 'tree', plural: 'trees', article: 'a', category: 'plant',
    typeClass: 'tree', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'compact-top', allowed: [] },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 0.95, detail: 2, proper: PROPER.foliage,
    glossName: 'tree', glossPlural: 'trees', plain: null, search: [],
    headName: null, holdable: false,
    drawings: {
      _: { onBox: { x: 21, y: 18, w: 58, h: 38 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  'fleur-de-lis': {
    name: 'fleur-de-lys', plural: 'fleurs-de-lys', article: 'a', category: 'plant',
    typeClass: 'fleur-de-lys', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'compact-top', allowed: [] },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 1, detail: 0, proper: null,
    glossName: 'lily (fleur-de-lis)', glossPlural: 'lilies (fleurs-de-lis)', plain: { word: 'lily', plural: 'lilies' }, search: ['lily', 'lilies', 'fleur'],
    headName: null, holdable: false,
    drawings: {
      _: { onBox: { x: 36, y: 28, w: 28, h: 42 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
} satisfies Record<string, ChargeMetaRow>;
