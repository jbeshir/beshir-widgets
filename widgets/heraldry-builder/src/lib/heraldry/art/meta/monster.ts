// Sidecar metadata of the monsters: everything about each charge but its path strings, which are in art/paths. CHARGES
// (charges.ts) adds the id and the default facing to each row.

import type { ChargeMetaRow } from '../types';
import { HAND_DRAWN, WINGED } from './common';

export const META_MONSTER = {
  unicorn: {
    name: 'unicorn', plural: 'unicorns', article: 'a', category: 'monster',
    typeClass: 'unicorn', typeOf: null, typeToken: null, postureClass: 'quadruped', birdShape: null,
    postures: ['rampant', 'passant', 'sejant', 'courant', 'couchant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', postureWording: {},
    faces: true, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'animate', allowed: [], wording: {} },
    forms: ['demi', 'head'], mods: [], details: WINGED, parts: ['crowned', 'collared'], holds: ['maintaining', 'sustaining'],
    demiCut: 63, long: false, scale: 1, detail: 2, proper: null,
    glossName: 'unicorn', glossPlural: 'unicorns', plain: null, search: ['horse'],
    headName: { one: 'unicorn\'s head', many: 'unicorns\' heads' }, holdable: false, pairedWings: false,
    drawings: {
      rampant: { onBox: { x: 36, y: 36, w: 18, h: 24 }, anchors: { hold: { x: 26, y: 48, size: 18, rotation: -20 }, crown: { x: 31, y: 15, size: 18, rotation: 0 }, collar: { x: 44, y: 38, size: 14, rotation: 20 }, wings: { x: 73, y: 28, size: 42, rotation: 20 } }, neck: null },
      passant: { onBox: { x: 29, y: 46, w: 38, h: 24 }, anchors: { hold: { x: 22, y: 72, size: 18, rotation: 0 }, crown: { x: 31, y: 24, size: 18, rotation: 0 }, collar: { x: 37, y: 38, size: 18, rotation: -40 } }, neck: null },
      sejant: { onBox: { x: 28, y: 44, w: 20, h: 30 }, anchors: { hold: { x: 24, y: 88, size: 16, rotation: 0 }, crown: { x: 34, y: 19, size: 18, rotation: 0 }, collar: { x: 40, y: 40, size: 18, rotation: -35 } }, neck: null },
      head: { onBox: null, anchors: { collar: { x: 63.3, y: 82, size: 32, rotation: 0 }, crown: { x: 59, y: 19, size: 16, rotation: 0 } }, neck: { y: 93, x0: 49, x1: 87 } },
      courant: { onBox: { x: 27, y: 47, w: 35, h: 22 }, anchors: { hold: { x: 9.3, y: 67, size: 16, rotation: 0 }, crown: { x: 23.5, y: 26.2, size: 12.4, rotation: 0 }, collar: { x: 30.6, y: 42.1, size: 14.2, rotation: 30 } }, neck: null },
      couchant: { onBox: { x: 34, y: 52, w: 36, h: 29 }, anchors: { hold: { x: 14.7, y: 78.5, size: 16.3, rotation: 0 }, crown: { x: 25.9, y: 29.7, size: 14.2, rotation: 0 }, collar: { x: 34, y: 48, size: 16.3, rotation: 30 } }, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  dragon: {
    name: 'dragon', plural: 'dragons', article: 'a', category: 'monster',
    typeClass: 'dragon', typeOf: null, typeToken: null, postureClass: 'quadruped', birdShape: null,
    postures: ['rampant', 'passant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', postureWording: { rampant: { term: 'segreant', gloss: 'rearing up' } },
    faces: true, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'animate', allowed: [], wording: {} },
    forms: ['demi', 'head'], mods: [], details: [], parts: ['crowned', 'collared'], holds: ['maintaining', 'sustaining', 'in-mouth'],
    demiCut: 66, long: false, scale: 0.9, detail: 2, proper: null,
    glossName: 'dragon', glossPlural: 'dragons', plain: null, search: ['wyvern'],
    headName: { one: 'dragon\'s head', many: 'dragons\' heads' }, holdable: false, pairedWings: false,
    drawings: {
      rampant: { onBox: { x: 34, y: 31, w: 38, h: 24 }, anchors: { hold: { x: 16, y: 46, size: 18, rotation: 0 }, mouth: { x: 30, y: 12, size: 12, rotation: 0 }, crown: { x: 40, y: 10, size: 20, rotation: 0 }, collar: { x: 43, y: 29, size: 13, rotation: 30 } }, neck: null },
      passant: { onBox: { x: 53, y: 21, w: 28, h: 40 }, anchors: { hold: { x: 14, y: 64, size: 18, rotation: 0 }, mouth: { x: 14, y: 30, size: 12, rotation: 0 }, crown: { x: 27, y: 24, size: 20, rotation: 0 }, collar: { x: 40, y: 40, size: 14, rotation: 20 } }, neck: null },
      head: { onBox: null, anchors: { collar: { x: 66, y: 87, size: 33, rotation: 0 }, crown: { x: 38.9, y: 17.6, size: 15.5, rotation: 0 }, mouth: { x: 17.6, y: 48.6, size: 19.3, rotation: 0 } }, neck: { y: 92, x0: 50.5, x1: 81.4 } },
    },
    provenance: HAND_DRAWN,
  },
} satisfies Record<string, ChargeMetaRow>;
