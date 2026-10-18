// Sidecar metadata of the monsters: everything about each charge but its path strings, which are in art/paths. CHARGES
// (charges.ts) adds the id and the default facing to each row.

import type { ChargeMetaRow } from '../types';
import { HAND_DRAWN } from './common';

export const META_MONSTER = {
  unicorn: {
    name: 'unicorn', plural: 'unicorns', article: 'a', category: 'monster',
    typeClass: 'unicorn', typeOf: null, typeToken: null, postureClass: 'quadruped', birdShape: null,
    postures: ['rampant', 'passant', 'sejant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', postureWording: {},
    faces: true, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'animate', allowed: [], wording: {} },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 1, detail: 2, proper: null,
    glossName: 'unicorn', glossPlural: 'unicorns', plain: null, search: ['horse'],
    headName: null, holdable: false,
    drawings: {
      rampant: { onBox: { x: 36, y: 36, w: 18, h: 24 }, anchors: {}, neck: null },
      passant: { onBox: { x: 29, y: 46, w: 38, h: 24 }, anchors: {}, neck: null },
      sejant: { onBox: { x: 28, y: 44, w: 20, h: 30 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  dragon: {
    name: 'dragon', plural: 'dragons', article: 'a', category: 'monster',
    typeClass: 'dragon', typeOf: null, typeToken: null, postureClass: 'quadruped', birdShape: null,
    postures: ['rampant', 'passant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', postureWording: { rampant: { term: 'segreant', gloss: 'rearing up' } },
    faces: true, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'animate', allowed: [], wording: {} },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 0.9, detail: 2, proper: null,
    glossName: 'dragon', glossPlural: 'dragons', plain: null, search: ['wyvern'],
    headName: null, holdable: false,
    drawings: {
      rampant: { onBox: { x: 34, y: 31, w: 38, h: 24 }, anchors: {}, neck: null },
      passant: { onBox: { x: 53, y: 21, w: 28, h: 40 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
} satisfies Record<string, ChargeMetaRow>;
