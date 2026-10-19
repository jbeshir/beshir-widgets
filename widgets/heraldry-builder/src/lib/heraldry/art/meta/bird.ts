// Sidecar metadata of the birds: everything about each charge but its path strings, which are in art/paths. CHARGES
// (charges.ts) adds the id and the default facing to each row.

import type { ChargeMetaRow } from '../types';
import { HAND_DRAWN, PROPER } from './common';

export const META_BIRD = {
  eagle: {
    name: 'eagle', plural: 'eagles', article: 'an', category: 'bird',
    typeClass: 'regular-bird', typeOf: null, typeToken: null, postureClass: 'bird', birdShape: 'regular',
    postures: ['displayed', 'close', 'rising', 'volant'], defaultPosture: 'displayed', scaDefaultPosture: 'displayed', postureWording: {},
    faces: true, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'animate', allowed: [], wording: {} },
    forms: ['demi'], mods: [], details: [], parts: [], holds: [],
    demiCut: 63, long: false, scale: 0.95, detail: 0, proper: null,
    glossName: 'eagle with spread wings', glossPlural: 'eagles with spread wings', plain: null, search: [],
    headName: null, holdable: false,
    drawings: {
      displayed: { onBox: { x: 35, y: 37, w: 28, h: 20 }, anchors: {}, neck: null },
      close: { onBox: { x: 29, y: 23, w: 30, h: 36 }, anchors: { beak: { x: 23.1, y: 13, size: 8.1, rotation: 0 }, crown: { x: 31.2, y: 3.6, size: 9.9, rotation: 0 }, hold: { x: 27.8, y: 85.7, size: 13, rotation: 0 } }, neck: null },
      rising: { onBox: { x: 33, y: 34, w: 31, h: 31 }, anchors: { beak: { x: 19.4, y: 36.4, size: 8.9, rotation: 0 }, crown: { x: 30, y: 27.7, size: 10.9, rotation: 0 }, hold: { x: 37.1, y: 85.8, size: 12.9, rotation: 0 } }, neck: null },
      volant: { onBox: { x: 31, y: 45, w: 35, h: 22 }, anchors: { beak: { x: 11.3, y: 55.7, size: 8.6, rotation: 0 }, crown: { x: 19.2, y: 45.1, size: 10.6, rotation: 0 }, hold: { x: 67.8, y: 75.5, size: 10.6, rotation: 0 } }, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  owl: {
    name: 'owl', plural: 'owls', article: 'an', category: 'bird',
    typeClass: 'regular-bird', typeOf: null, typeToken: null, postureClass: 'bird', birdShape: 'regular',
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'never',
    orient: { drawn: 'palewise', cls: 'animate', allowed: [], wording: {} },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 1, detail: 1, proper: PROPER.brown,
    glossName: 'owl', glossPlural: 'owls', plain: null, search: [],
    headName: null, holdable: false,
    drawings: {
      _: { onBox: { x: 39, y: 42, w: 22, h: 22 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
} satisfies Record<string, ChargeMetaRow>;
