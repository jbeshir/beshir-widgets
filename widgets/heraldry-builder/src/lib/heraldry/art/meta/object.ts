// Sidecar metadata of the objects: everything about each charge but its path strings, which are in art/paths. CHARGES
// (charges.ts) adds the id and the default facing to each row.

import type { ChargeMetaRow } from '../types';
import { EVERY_WAY, HAND_DRAWN, PROPER } from './common';

export const META_OBJECT = {
  key: {
    name: 'key', plural: 'keys', article: 'a', category: 'object',
    typeClass: 'key', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'long-ends', allowed: [...EVERY_WAY, 'reversed'], wording: {} },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: true, scale: 1.15, detail: 1, proper: null,
    glossName: 'key', glossPlural: 'keys', plain: null, search: [],
    headName: null, holdable: false, pairedWings: false,
    drawings: {
      _: { onBox: null, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  'open-book': {
    name: 'open book', plural: 'open books', article: 'an', category: 'object',
    typeClass: 'book', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'compact-top', allowed: EVERY_WAY, wording: {} },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 0.9, detail: 1, proper: PROPER.pages,
    glossName: 'open book', glossPlural: 'open books', plain: null, search: ['book'],
    headName: null, holdable: false, pairedWings: false,
    drawings: {
      _: { onBox: { x: 14, y: 52, w: 34, h: 22 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  sword: {
    name: 'sword', plural: 'swords', article: 'a', category: 'object',
    typeClass: 'sword', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'long-ends', allowed: [...EVERY_WAY, 'to-center'], wording: {} },
    forms: [], mods: [], details: ['enflamed'], parts: [], holds: [],
    demiCut: null, long: true, scale: 1.15, detail: 1, proper: PROPER.steel,
    glossName: 'sword', glossPlural: 'swords', plain: null, search: [],
    headName: null, holdable: false, pairedWings: false,
    drawings: {
      _: { onBox: null, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  crown: {
    name: 'crown', plural: 'crowns', article: 'a', category: 'object',
    typeClass: 'crown', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'compact-top', allowed: EVERY_WAY, wording: {} },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: false, scale: 0.95, detail: 0, proper: null,
    glossName: 'crown', glossPlural: 'crowns', plain: null, search: [],
    headName: null, holdable: false, pairedWings: false,
    drawings: {
      _: { onBox: { x: 24, y: 47, w: 42, h: 26 }, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
  anchor: {
    name: 'anchor', plural: 'anchors', article: 'an', category: 'object',
    typeClass: 'anchor', typeOf: null, typeToken: null, postureClass: null, birdShape: null,
    postures: null, defaultPosture: null, scaDefaultPosture: null, postureWording: {},
    faces: false, facingCounts: 'normal',
    orient: { drawn: 'palewise', cls: 'long-ends', allowed: EVERY_WAY, wording: {} },
    forms: [], mods: [], details: [], parts: [], holds: [],
    demiCut: null, long: true, scale: 1.15, detail: 0, proper: null,
    glossName: 'anchor', glossPlural: 'anchors', plain: null, search: [],
    headName: null, holdable: false, pairedWings: false,
    drawings: {
      _: { onBox: null, anchors: {}, neck: null },
    },
    provenance: HAND_DRAWN,
  },
} satisfies Record<string, ChargeMetaRow>;
