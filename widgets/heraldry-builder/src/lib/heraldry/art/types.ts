// The charge sidecar's types: what each charge's metadata row (art/meta) and path rows (art/paths) hold.

import type {
  ChargeCategory, ChargeForm, ChargeId, Facing, HoldHow, ModifierId, Orientation, PartId, Posture, PostureClass, TypeClass,
} from '../charges';
import type { BaseTincture, ContrastClass } from '../surface';

/** How a charge's orientation is read and turned: animate charges face, the rest point (their drawn way is `orient.drawn`). */
export type OrientClass = 'animate' | 'radial' | 'compact-top' | 'compact-axis' | 'long-ends' | 'long-plain';

/** The shape of a bird (SENA App M1d): birds of different shapes differ in type. */
export type BirdShape = 'regular' | 'swan' | 'poultry' | 'crane';

/** A drawing of a charge: '_' for a posture-less charge, a posture, a posture with the head turned, a head or a demi charge. */
export type ArtKey = '_' | Posture | `${Posture}~guardant` | `${Posture}~regardant` | 'head' | 'demi';

/** A place on a drawing where something is put: a held item, a crown, a collar… */
export type AnchorId = 'hold' | 'beak' | 'mouth' | 'crown' | 'collar' | 'wings' | 'slip';

/** A rectangle in a charge's 100×100 art box. */
export interface ArtBox { x: number; y: number; w: number; h: number }

/** A square in a drawing's 100×100 box: centre, side and turn (degrees clockwise). */
export interface ArtPlace { x: number; y: number; size: number; rotation: number }

/** The couped edge of a head: the outer ring's one edge on the line `y`, from `x0` to `x1`. */
export interface NeckEdge { y: number; x0: number; x1: number }

export interface DrawingMeta {
  /** Where the drawing carries a charge on it (a tertiary group), or null when it has no room for one. */
  onBox: ArtBox | null;
  anchors: Partial<Record<AnchorId, ArtPlace>>;
  /** Heads only. */
  neck: NeckEdge | null;
}

/** Where a charge's art came from: all of it is original work. */
export interface Provenance { origin: 'original'; author: string; date: string; method: string }

/** A charge-specific posture word: the blazon term and its plain-English gloss ("trippant", "walking"). */
export interface PostureWording { term: string; gloss: string }

/**
 * The natural colouring of a charge (SENA A3B1; GoT Table 4): what is painted, and what it is for contrast and conflict. Proper is
 * not a tincture: the class and the conflict tinctures come from the table row, which names the part they are taken from
 * (a lion is "considered Or", a tree takes its tincture from its leaves). Brown is a tincture in its own right.
 * One fill covers the charge; a second splits it in two, per fess (the flame's gules and Or).
 */
export interface ProperPalette {
  cls: ContrastClass;
  conflict: readonly BaseTincture[];
  fills: readonly [string] | readonly [string, string];
}

export interface ChargeMeta {
  id: ChargeId;
  /** Blazon name (singular / plural). */
  name: string;
  plural: string;
  /** Stored, never computed from the first letter ("an open book"). */
  article: 'a' | 'an';
  category: ChargeCategory;
  /** Charges of different classes are substantially different (SENA A5E2; see TYPE_CLASSES). */
  typeClass: TypeClass;
  /** A charge SENA treats as the same type as this one, or null. */
  typeOf: ChargeId | null;
  /** A type shared with other charges that names none of them, or null. */
  typeToken: string | null;
  postureClass: PostureClass | null;
  /** Birds only. */
  birdShape: BirdShape | null;
  /** Drawn postures, or null when posture-less. */
  postures: readonly Posture[] | null;
  /** The builder's (and resolve's) choice when none is given. */
  defaultPosture: Posture | null;
  /** The posture SCA practice assumes when none is blazoned (GoT Table 5): it is omitted from the blazon. */
  scaDefaultPosture: Posture | null;
  /** This charge's own words for a posture, overriding the posture id and POSTURE_GLOSS. */
  postureWording: Partial<Record<Posture, PostureWording>>;
  /** Whether it can face either way (its art is mirrored to face sinister). */
  faces: boolean;
  /** Whether its facing makes a difference for conflict: normally, never (the owl) or in every posture. */
  facingCounts: 'normal' | 'never' | 'always';
  /** 'to-dexter' for a charge that faces, else null. */
  defaultFacing: Facing | null;
  /** The way the art is drawn, how it turns, and the orientations it may be turned to. */
  orient: { drawn: Orientation; cls: OrientClass; allowed: readonly Orientation[] };
  /** Drawn forms (a head, a demi charge…). */
  forms: readonly ChargeForm[];
  /** Drawn modifiers chosen with the charge itself (the sun in splendour). */
  mods: readonly ModifierId[];
  /** Drawn modifiers chosen among its details. */
  details: readonly ModifierId[];
  /** Drawn parts and ways of holding. */
  parts: readonly PartId[];
  holds: readonly HoldHow[];
  /** Where a demi charge is cut off, as y in the default drawing's box; null for the usual 58. */
  demiCut: number | null;
  /** May be 'crossed' (two in saltire). */
  long: boolean;
  /**
   * Optical scale applied to the slot box when drawing, so charges of different ink weight look the
   * same size: slender charges (sword, key) are drawn larger, solid ones (heart, rose) smaller.
   */
  scale: number;
  /** How much fine detail the silhouette has: 0 = bold at a glance, 1 = detailed, 2 = intricate. Costs readability points. */
  detail: 0 | 1 | 2;
  /** Its natural colours, or null when SENA gives the charge none (monsters, shapes, things whose colour is the maker's choice). */
  proper: ProperPalette | null;
  /** Gloss names (singular / plural). */
  glossName: string;
  glossPlural: string;
  /** The everyday word, when the heraldic name isn't one ("star" for a mullet). */
  plain: { word: string; plural: string } | null;
  /** More everyday words that find it in the registry search. */
  search: readonly string[];
  /** Its head's name, when it has a head drawing ("lion's head"). */
  headName: { one: string; many: string } | null;
  /** May be held by another charge. */
  holdable: boolean;
  /** Its drawings: the same keys as its path row. */
  drawings: Partial<Record<ArtKey, DrawingMeta>>;
  provenance: Provenance;
}

/** What a sidecar row holds: CHARGES adds the derived fields. */
export type ChargeMetaRow = Omit<ChargeMeta, 'id' | 'defaultFacing'>;

/** Path strings by charge and drawing. */
export type ArtPaths = Partial<Record<ChargeId, Partial<Record<ArtKey, string>>>>;
