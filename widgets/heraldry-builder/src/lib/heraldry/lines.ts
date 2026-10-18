// Lines of partition: the registry (SENA App M2 groups, the hosts each line may go on, the edges a host has),
// their words, and the one periodic-edge generator every complex edge is drawn with. Pure — no DOM.
//
// A line's profile is one period on u ∈ [0,1] from (0,0) to (1,0); v is the displacement in units of half
// the depth, along the edge's + side normal (the left of a→b in SVG coordinates, y down). A band's two
// edges are drawn in contour order — the lower edge right to left — with the same period and an anchor
// measured from the same end, so a profile that is antisymmetric about u = ½ comes out in phase on both
// edges (`parallel`: wavy, dancetty, counter-embattled) and a symmetric one comes out opposed (`mirrored`:
// indented, bretessed, engrailed). A symmetric profile has its extremes at the period's ends, so its v
// runs one way from the line ([0,2] or [−2,0]); an antisymmetric one runs [−1,1].

import type { Division, Variation } from './divisions';
import { isCountedVariation } from './divisions';
import type { Lines } from './design';
import { r2, pointInPolygon, CURVE_STEPS, type Pt } from './geometry';
import type { OrdinaryType } from './ordinaries';

export const LINES = ['plain', 'embattled', 'wavy', 'engrailed', 'invected', 'indented', 'dancetty', 'nebuly', 'raguly', 'rayonny',
  'dovetailed', 'urdy', 'potenty', 'bretessed', 'grady', 'enarched', 'ploye', 'arrondi', 'triangular', 'rompu', 'bevilled'] as const;
export type Line = (typeof LINES)[number];
export type ComplexLine = Exclude<Line, 'plain'>;

/** The lines the edge rows offer, in order of how often the O&A uses them (RULES-C §I.1). */
export const DRAWN_LINES: readonly ComplexLine[] = ['embattled', 'wavy', 'engrailed', 'indented', 'rayonny', 'invected', 'dovetailed',
  'raguly', 'nebuly', 'potenty', 'bretessed', 'urdy', 'dancetty', 'enarched', 'ploye', 'grady', 'arrondi', 'triangular', 'rompu', 'bevilled'];

export function isLine(v: unknown): v is Line {
  return typeof v === 'string' && (LINES as readonly string[]).includes(v);
}

// ── Groups and conflict ─────────────────────────────────────────────────────

/** SENA App M2 groups. 'grady' is not in M2: its own group, no DC vs urdy or jagged lines (RULES-C L1). 'other' lines differ from each other. */
export type LineGroup = 'straight' | 'square' | 'wavy' | 'long' | 'jagged' | 'grady' | 'other';

export const LINE_GROUP: Record<Line, LineGroup> = {
  plain: 'straight', enarched: 'straight', ploye: 'straight', arrondi: 'straight',
  embattled: 'square', bretessed: 'square', dovetailed: 'square', raguly: 'square',
  wavy: 'wavy', nebuly: 'wavy', urdy: 'wavy',
  rayonny: 'long',
  indented: 'jagged', engrailed: 'jagged', invected: 'jagged', dancetty: 'jagged',
  grady: 'grady',
  potenty: 'other', triangular: 'other', rompu: 'other', bevilled: 'other',
};

/** Straight-group lines (plain, enarched, ployé) count as "plain" for App H, marshalling and A3D1c. */
export const isStraightLine = (l: Line): boolean => LINE_GROUP[l] === 'straight';

/**
 * Whether two lines are different enough for a DC (SENA App M2): their groups differ (grady differs from all but urdy and the
 * jagged lines), they are two different 'other' lines, or on a two-sided band one is dancetty and the other another jagged line.
 */
export function lineDiffers(x: Line, y: Line, twoSidedBand: boolean): boolean {
  if (x === y) return false;
  if (x === 'grady' || y === 'grady') {
    const other = x === 'grady' ? y : x;
    return !(other === 'urdy' || LINE_GROUP[other] === 'jagged');
  }
  const gx = LINE_GROUP[x], gy = LINE_GROUP[y];
  if (gx !== gy) return true;
  if (gx === 'other') return true;
  return twoSidedBand && gx === 'jagged' && (x === 'dancetty') !== (y === 'dancetty');
}

// ── Hosts and edges ─────────────────────────────────────────────────────────

/**
 * What carries a line. `inverted` matters for a chevron: its bare "embattled" is worded with the edge (RULES-C §0, L2). An ordinary's
 * cotises are a host of their own: one line on every cotise edge.
 */
export type EdgeHost =
  | { k: 'division'; division: Division }
  | { k: 'variation'; variation: Variation }
  | { k: 'ordinary'; type: OrdinaryType; inverted: boolean }
  | { k: 'cotises'; type: OrdinaryType };

/**
 * How many independent lines each ordinary has (RULES-C §0): 2 = upper/lower (dexter/sinister, outer/inner) edges of a band;
 * 1 = one line on every edge; 0 = takes no line.
 */
const ORDINARY_EDGES: Record<OrdinaryType, 0 | 1 | 2> = {
  fess: 2, bar: 2, barrulet: 2, bend: 2, bendlet: 2, 'bend-sinister': 2, 'bendlet-sinister': 2, baton: 2, chevron: 2, chevronel: 2,
  pale: 2, pallet: 2, orle: 2, tressure: 2,
  cross: 1, saltire: 1, saltorel: 1, pall: 1, 'pall-inverted': 1, pile: 1, chief: 1, bordure: 1, base: 1, canton: 1, quarter: 1,
  gyron: 1, flaunches: 1, gore: 1,
  point: 0, 'point-dexter': 0, 'point-sinister': 0, label: 0, fret: 0, mount: 0, trimount: 0,
};

/** The two-sided bands: the ordinaries whose `b` is a second edge running the length of the band (fess-like, pale-like, bend-like, chevrons). */
const isTwoSidedBand = (type: OrdinaryType): boolean => ORDINARY_EDGES[type] === 2 && type !== 'orle' && type !== 'tressure';

/**
 * 2 = `b` is a second, independent edge (bands, orle and tressure; quarterly's per fess line); 1 = `b` is always `a` (canonical);
 * 0 = takes no line. A variation without a count (checky, lozengy, …) takes none.
 */
export function edgeCount(host: EdgeHost): 0 | 1 | 2 {
  switch (host.k) {
    case 'division': return host.division === 'quarterly' ? 2 : 1;
    case 'variation': return isCountedVariation(host.variation) ? 1 : 0;
    case 'ordinary': return ORDINARY_EDGES[host.type];
    case 'cotises': return 1;
    default: return host satisfies never;
  }
}

const ENARCHED_DIVISIONS: readonly Division[] = ['per-fess', 'per-bend', 'per-bend-sinister', 'per-chevron', 'per-chevron-inverted', 'per-chevron-throughout'];
const ENARCHED_ORDINARIES: readonly OrdinaryType[] = ['fess', 'bend', 'bend-sinister', 'chevron', 'chief'];
const PLOYE_DIVISIONS: readonly Division[] = ['per-chevron', 'per-chevron-inverted', 'per-chevron-throughout'];
const BEVILLED_DIVISIONS: readonly Division[] = ['per-bend', 'per-bend-sinister'];
const BEVILLED_ORDINARIES: readonly OrdinaryType[] = ['bend', 'bend-sinister'];

/**
 * Whether the host may carry the line at all (RULES-C §A.1, §A.5; PLAN-C §4): dancetty only on two-sided bands and counted
 * variations (and cotises, thin bands themselves: "a bend cotised dancetty", PicDic Clopton); enarched only on per fess, per bend
 * (sinister), per chevron, fess, bend (sinister), chevron and chief; ployé only on per chevron (inverted, throughout), chevron (inverted) and pile (inverted); arrondi only on gyronny; triangular only on a chief,
 * rompu only on a chevron (inverted) and bevilled only on per bend (sinister), bend and bend sinister (RULES-C §A.1, F2) — on
 * cotises as on their ordinary, except those three, which are never a cotise's; a host with no edge takes none. Not allowed is a structure issue, never a gap.
 */
export function lineAllowed(host: EdgeHost, line: Line): boolean {
  if (line === 'plain') return true;
  if (edgeCount(host) === 0) return false;
  switch (line) {
    case 'dancetty': return host.k === 'variation' || host.k === 'cotises' || (host.k === 'ordinary' && isTwoSidedBand(host.type));
    case 'enarched':
      return host.k === 'division' ? ENARCHED_DIVISIONS.includes(host.division)
        : host.k === 'cotises' ? ENARCHED_ORDINARIES.includes(host.type)
          : host.k === 'ordinary' && ENARCHED_ORDINARIES.includes(host.type) && !(host.type === 'chevron' && host.inverted);
    case 'ploye': return host.k === 'division' ? PLOYE_DIVISIONS.includes(host.division) : (host.k === 'ordinary' || host.k === 'cotises') && (host.type === 'chevron' || host.type === 'pile');
    case 'triangular': return host.k === 'ordinary' && host.type === 'chief';
    case 'rompu': return host.k === 'ordinary' && host.type === 'chevron';
    case 'bevilled': return host.k === 'division' ? BEVILLED_DIVISIONS.includes(host.division) : host.k === 'ordinary' && BEVILLED_ORDINARIES.includes(host.type);
    case 'arrondi': return host.k === 'division' && host.division === 'gyronny';
    case 'embattled': case 'wavy': case 'engrailed': case 'invected': case 'indented': case 'nebuly': case 'raguly': case 'rayonny':
    case 'dovetailed': case 'urdy': case 'potenty': case 'bretessed': case 'grady':
      return true;
    default: return line satisfies never;
  }
}

/** Which edge of a two-edge host its `a` and `b` lines are: a band's upper and lower (a pale's dexter and sinister, an orle's outer and inner) edges, or quarterly's per pale and per fess lines. */
export type EdgeName = 'upper' | 'lower' | 'dexter' | 'sinister' | 'outer' | 'inner' | 'pale-line' | 'fess-line';

/** The edges `a` and `b` name on a host with two (RULES-C §0); null on a host with one line or none. */
export function edgeNames(host: EdgeHost): { a: EdgeName; b: EdgeName } | null {
  if (edgeCount(host) !== 2) return null;
  switch (host.k) {
    case 'division': return { a: 'pale-line', b: 'fess-line' };
    case 'variation': case 'cotises': return null;
    case 'ordinary':
      return host.type === 'pale' || host.type === 'pallet' ? { a: 'dexter', b: 'sinister' }
        : host.type === 'orle' || host.type === 'tressure' ? { a: 'outer', b: 'inner' } : { a: 'upper', b: 'lower' };
    default: return host satisfies never;
  }
}

/** Bands whose bare "embattled" is the upper edge alone (SENA A3D1c: "fesses are embattled to chief default"). */
const EMBATTLED_UPPER: readonly OrdinaryType[] = ['fess', 'bar', 'barrulet', 'bend', 'bendlet', 'bend-sinister', 'bendlet-sinister', 'baton', 'chevron', 'chevronel'];

/** What a bare "<host> <line>" means (RULES-C §0): embattled on a fess-, bend- or chevron-like band (upright or inverted) is its upper edge; anything else is every edge. */
export function bareLines(host: EdgeHost, line: Line): Lines {
  return host.k === 'ordinary' && line === 'embattled' && EMBATTLED_UPPER.includes(host.type) ? { a: 'embattled', b: 'plain' } : { a: line, b: line };
}

// ── Words ───────────────────────────────────────────────────────────────────

/** Blazon words, lower case: what the emitter writes for each line. */
export const LINE_WORD: Record<ComplexLine, string> = {
  embattled: 'embattled', wavy: 'wavy', engrailed: 'engrailed', invected: 'invected', indented: 'indented', dancetty: 'dancetty',
  nebuly: 'nebuly', raguly: 'raguly', rayonny: 'rayonny', dovetailed: 'dovetailed', urdy: 'urdy', potenty: 'potenty',
  bretessed: 'bretessed', grady: 'embattled grady', enarched: 'enarched', ploye: 'ployé', arrondi: 'arrondi', triangular: 'triangular', rompu: 'rompu',
  bevilled: 'bevilled',
};

/** Where an edge named alone is said to carry its line: "wavy on the lower edge"; quarterly's lines are named before theirs ("per fess embattled"). */
const EDGE_WORDS: Record<EdgeName, string> = {
  upper: 'on the upper edge', lower: 'on the lower edge', dexter: 'on the dexter edge', sinister: 'on the sinister edge', outer: 'on the outer edge',
  inner: 'on the inner edge', 'pale-line': 'per pale', 'fess-line': 'per fess',
};

/**
 * The words of a host's lines, after its name (RULES-C §0, §G.1): nothing for plain; the line's word when the host's bare meaning of it is
 * what is drawn ("a fess embattled" — its upper edge — "a pale wavy", "a bordure engrailed"); both edges of a band embattled are
 * "embattled counter-embattled"; one edge alone, or two different lines, name their edges ("wavy on the lower edge"; a chevron inverted
 * always does: "embattled on the upper edge"); quarterly names the one line drawn when only one is ("per fess embattled").
 */
export function lineWords(host: EdgeHost, lines: Lines): string {
  const { a, b } = lines;
  const word = (l: Line) => (l === 'plain' ? '' : LINE_WORD[l]);
  const names = edgeNames(host);
  if (names === null) return word(a);
  if (host.k === 'division') {
    if (a === b) return word(a);
    return [a !== 'plain' ? `${EDGE_WORDS[names.a]} ${word(a)}` : '', b !== 'plain' ? `${EDGE_WORDS[names.b]} ${word(b)}` : ''].filter(Boolean).join(' and ');
  }
  const bare = (l: Line) => { const m = bareLines(host, l); return m.a === a && m.b === b; };
  if (a === 'embattled' && b === 'embattled' && !bare('embattled')) return 'embattled counter-embattled';
  if (a !== 'plain' && bare(a) && !(host.k === 'ordinary' && host.inverted && a !== b)) return word(a);
  const on = (l: Line, name: EdgeName) => `${word(l)} ${EDGE_WORDS[name]}`;
  return [a !== 'plain' ? on(a, names.a) : '', b !== 'plain' ? on(b, names.b) : ''].filter(Boolean).join(' and ');
}

/** What a written line word reads as: a line (its bare meaning depends on the host: `bareLines`), or both edges of a band embattled. */
export type LineReading = ComplexLine | 'counter-embattled';

/**
 * Every spelling of a line the College writes (lower case), each to the line it spells: the ids, the emitted words and the other
 * spellings — never a different line ("indented grady" is not folded into grady: no source equates them).
 */
export const LINE_SPELLINGS: Readonly<Record<string, LineReading>> = {
  ...Object.fromEntries(LINES.filter((l): l is ComplexLine => l !== 'plain').flatMap((l) => [[l, l], [LINE_WORD[l], l]])),
  undy: 'wavy', undee: 'wavy', arrondy: 'arrondi', beviled: 'bevilled', bevelled: 'bevilled',
  crenellated: 'embattled', crenelated: 'embattled', crenelly: 'embattled', battled: 'embattled',
  invecked: 'invected',
  bretesse: 'bretessed', 'bretessé': 'bretessed', bretassy: 'bretessed',
  ragully: 'raguly',
  'rayonné': 'rayonny', 'rompú': 'rompu',
  'dove-tailed': 'dovetailed',
  'urdée': 'urdy',
  nebulee: 'nebuly', 'nebulé': 'nebuly',
  dancette: 'dancetty', 'dancetté': 'dancetty',
  engrailled: 'engrailed',
  'embattled-grady': 'grady',
  ployee: 'ploye',
  arched: 'enarched',
  'counter-embattled': 'counter-embattled', counterembattled: 'counter-embattled',
  'embattled counter-embattled': 'counter-embattled', 'embattled-counter-embattled': 'counter-embattled',
};

// ── Profiles ────────────────────────────────────────────────────────────────

/** One step of a profile: a straight line or a cubic to `to`, in (u, v). */
export type ProfileStep = { k: 'L'; to: Pt } | { k: 'C'; c1: Pt; c2: Pt; to: Pt };

export interface LineProfile {
  /** 'single': one feature across the whole chord (enarched, ployé); 'periodic': whole periods fitted to the chord. */
  readonly kind: 'periodic' | 'single';
  /** One period from (0,0) to (1,0); for 'single', the one feature. */
  readonly period: readonly ProfileStep[];
  /** Repeats across a 100-unit chord (SENA A2C1; RULES-C §A.4); single: all 1. */
  readonly repeats: { target: number; min: number; max: number };
  /** Peak to valley on the field, units: v spans 2. */
  readonly depth: number;
  /** How a band's second edge relates to its first at the same place along it (see the header): antisymmetric profiles are parallel, symmetric ones mirrored. */
  readonly pairing: 'parallel' | 'mirrored';
}

const L = (u: number, v: number): ProfileStep => ({ k: 'L', to: [u, v] });
const C = (c1u: number, c1v: number, c2u: number, c2v: number, u: number, v: number): ProfileStep => ({ k: 'C', c1: [c1u, c1v], c2: [c2u, c2v], to: [u, v] });
const steps = (...points: Pt[]): ProfileStep[] => points.map(([u, v]) => L(u, v));
const periodic = (target: number, min: number, max: number, depth: number, pairing: LineProfile['pairing'], period: ProfileStep[]): LineProfile =>
  ({ kind: 'periodic', period, repeats: { target, min, max }, depth, pairing });
const single = (depth: number, period: ProfileStep[]): LineProfile =>
  ({ kind: 'single', period, repeats: { target: 1, min: 1, max: 1 }, depth, pairing: 'parallel' });

/** A cubic's control height for a peak of 1: a cubic with both controls at height h peaks at ¾h. */
const PEAK = 4 / 3;

/**
 * Steps from (0,0) to (½,0) followed by their antisymmetric twin from (½,0) to (1,0) — v(1−u) = −v(u) — so a feature drawn up in the
 * first half comes back down in the second (the shape of the parallel profiles).
 */
function antisymmetric(half: ProfileStep[]): ProfileStep[] {
  const turn = ([u, v]: Pt): Pt => [1 - u, -v];
  const starts: Pt[] = [[0, 0], ...half.map((s) => s.to)];
  const back = half.map((s, i): ProfileStep => (s.k === 'L' ? { k: 'L', to: turn(starts[i]) } : { k: 'C', c1: turn(s.c2), c2: turn(s.c1), to: turn(starts[i]) }));
  return [...half, ...back.reverse()];
}

/** How far an arrondi line bows, as a share of its length (the sagitta of its arc). */
export const ARRONDI_SAGITTA = 0.1;

/** Original placeholder profiles (procedural; no third-party drawing consulted). Numbers within RULES-C §A.4's bounds. */
export const LINE_PROFILE: Record<ComplexLine, LineProfile> = {
  // merlon then crenel: a square wave
  embattled: periodic(5, 4, 6, 8, 'parallel', steps([0, 1], [0.5, 1], [0.5, -1], [1, -1], [1, 0])),
  // one merlon out of the crenel floor, opposite its twin on a band's other edge
  bretessed: periodic(5, 4, 6, 8, 'mirrored', steps([0.25, 0], [0.25, 2], [0.75, 2], [0.75, 0], [1, 0])),
  // trapezoid merlons, wider at their free end
  dovetailed: periodic(5, 4, 6, 8, 'parallel', steps([-0.1, 1], [0.6, 1], [0.4, -1], [1.1, -1], [1, 0])),
  // leaning merlons (parallelograms)
  raguly: periodic(5, 4, 6, 8, 'parallel', steps([0.1, 1], [0.6, 1], [0.4, -1], [0.9, -1], [1, 0])),
  // T-headed merlons up, then down
  potenty: periodic(5, 4, 6, 9, 'parallel', steps(
    [0.17, 0], [0.17, 0.4], [0.02, 0.4], [0.02, 1], [0.48, 1], [0.48, 0.4], [0.33, 0.4], [0.33, 0],
    [0.67, 0], [0.67, -0.4], [0.52, -0.4], [0.52, -1], [0.98, -1], [0.98, -0.4], [0.83, -0.4], [0.83, 0], [1, 0],
  )),
  // a crest then a trough
  wavy: periodic(3, 3, 4, 9, 'parallel', [C(0.15, PEAK, 0.35, PEAK, 0.5, 0), C(0.65, -PEAK, 0.85, -PEAK, 1, 0)]),
  // round cloud lobes, one up and one down: each a pinched neck under an oval head that overhangs it on both sides
  nebuly: periodic(4, 4, 5, 10, 'parallel', antisymmetric([
    C(0.07, 0.05, 0.13, 0.15, 0.1, 0.25), C(0.06, 0.35, -0.02, 0.42, -0.02, 0.6), C(-0.02, 0.85, 0.1, 1, 0.25, 1),
    C(0.4, 1, 0.52, 0.85, 0.52, 0.6), C(0.52, 0.42, 0.44, 0.35, 0.4, 0.25), C(0.37, 0.15, 0.43, 0.05, 0.5, 0),
  ])),
  // pales pointed at both ends
  urdy: periodic(5, 4, 6, 9, 'parallel', steps([0, 0.5], [0.25, 1], [0.5, 0.5], [0.5, -0.5], [0.75, -1], [1, -0.5], [1, 0])),
  // flames, alternately up and down: each ray's flanks are S-curves meeting in a sharp tip that leans along the line
  rayonny: periodic(6, 5, 8, 12, 'parallel', antisymmetric([C(0.25, 0.05, 0.05, 0.75, 0.3, 1), C(0.45, 0.75, 0.25, 0.25, 0.5, 0)])),
  // engrailed: round arcs biting into the carrier (v ≤ 0 with + away from it), so the cusps between them, on the line, point away
  // from it; invected is the same turned over: the arcs bulge out and the cusps point in
  engrailed: periodic(6, 5, 8, 4, 'mirrored', [C(0.25, -2 * PEAK, 0.75, -2 * PEAK, 1, 0)]),
  invected: periodic(6, 5, 8, 4, 'mirrored', [C(0.25, 2 * PEAK, 0.75, 2 * PEAK, 1, 0)]),
  // teeth out of the line
  indented: periodic(7, 6, 9, 8, 'mirrored', steps([0.5, 2], [1, 0])),
  // a large zig-zag
  dancetty: periodic(3, 3, 3, 16, 'parallel', steps([0.25, 1], [0.75, -1], [1, 0])),
  // stepped merlons: two steps up, two down
  grady: periodic(3, 3, 4, 10, 'parallel', steps(
    [0, 0.5], [0.125, 0.5], [0.125, 1], [0.375, 1], [0.375, 0.5], [0.5, 0.5],
    [0.5, -0.5], [0.625, -0.5], [0.625, -1], [0.875, -1], [0.875, -0.5], [1, -0.5], [1, 0],
  )),
  // one arch rising 12.5 toward chief (the builder puts + toward chief on every edge)
  enarched: single(12.5, [C(0.3, 2 * PEAK, 0.7, 2 * PEAK, 1, 0)]),
  // each limb bowed 6 toward base
  ploye: single(6, [C(0.3, -2 * PEAK, 0.7, -2 * PEAK, 1, 0)]),
  // every gyronny line an arc, all curving the same rotational way; its depth is laid at a tenth of the line (`layOn`)
  arrondi: single(10, [C(0.3, 2 * PEAK, 0.7, 2 * PEAK, 1, 0)]),
  // two straight lines meeting in a point toward base, midway along the chord (a chief's lower edge)
  triangular: single(12, steps([0.5, -2], [1, 0])),
  // a limb broken midway, a piece of it raised toward chief by a step (symmetric, like every single feature) (a model Line, drawn as one feature along a chevron's limb)
  rompu: single(8, steps([0.35, 0], [0.35, 2], [0.65, 2], [0.65, 0], [1, 0])),
  // the line broken at its middle by a short step (a bend's edge, or the line of a field per bend)
  bevilled: single(6, steps([0.45, 0], [0.45, 2], [0.55, 2], [0.55, 0], [1, 0])),
};

// ── The periodic-edge generator ─────────────────────────────────────────────

/** One complex edge: straight outside `span`, a whole number of periods inside it, a period centred on `anchor`. */
export interface EdgeRun {
  readonly line: ComplexLine;
  /** +1: features toward the left of a→b in SVG coordinates (y down); −1: toward the right. */
  readonly side: 1 | -1;
  /** Peak to valley, units (the profile's, or scaled to a band's width). */
  readonly depth: number;
  /** From fitPeriod; shared by both edges of a band so they align. */
  readonly period: number;
  /** Distance from a at which a period is centred (a band's edges measure it from the same end). */
  readonly anchor: number;
  /** Distances from a to draw over: the visible chord ± one period. */
  readonly span: readonly [number, number];
}

/**
 * The period for a chord of this length: chord / clamp(round(chord / pitch), max(2, round(min × chord/100)), max(2, round(max × chord/100)))
 * with pitch = 100 / repeats.target × scale; a single feature spans the chord.
 */
export function fitPeriod(line: ComplexLine, chord: number, scale: number): number {
  const p = LINE_PROFILE[line];
  if (p.kind === 'single') return chord;
  const pitch = (100 / p.repeats.target) * scale;
  const lo = Math.max(2, Math.round((p.repeats.min * chord) / 100));
  const hi = Math.max(2, Math.round((p.repeats.max * chord) / 100));
  return chord / Math.min(hi, Math.max(lo, Math.round(chord / pitch)));
}

/** The visible part of segment a→b inside the shape's outline polygon, as distances from a; null when it misses the shape. */
export function visibleSpan(a: Pt, b: Pt, outline: readonly Pt[]): readonly [number, number] | null {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ts = [0, 1];
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [px, py] = outline[j], ex = outline[i][0] - px, ey = outline[i][1] - py;
    const den = dx * ey - dy * ex;
    if (den === 0) continue;
    const t = ((px - a[0]) * ey - (py - a[1]) * ex) / den;
    const s = ((px - a[0]) * dy - (py - a[1]) * dx) / den;
    if (t > 0 && t < 1 && s >= 0 && s <= 1) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  let first = -1, last = -1;
  for (let i = 1; i < ts.length; i++) {
    const m = (ts[i - 1] + ts[i]) / 2;
    if (ts[i] - ts[i - 1] > 1e-12 && pointInPolygon(a[0] + dx * m, a[1] + dy * m, outline)) {
      if (first < 0) first = ts[i - 1];
      last = ts[i];
    }
  }
  return first < 0 ? null : [first * len, last * len];
}

/** A drawn piece of an edge in absolute coordinates. */
type Segment = { k: 'L'; to: Pt } | { k: 'C'; c1: Pt; c2: Pt; to: Pt };

/** Below this, two distances along an edge are the same. */
const EPS = 1e-9;

/** How far along u each profile reaches, overhangs included (dovetails and nebuly bulbs reach past their period). */
export const PROFILE_REACH = Object.fromEntries(Object.entries(LINE_PROFILE).map(([line, p]) => {
  const us = p.period.flatMap((s) => (s.k === 'L' ? [s.to[0]] : [s.c1[0], s.c2[0], s.to[0]]));
  return [line, [Math.min(0, ...us), Math.max(1, ...us)]];
})) as Record<ComplexLine, [number, number]>;

/** The periods drawn: their start distances, a whole number of them inside the span, overhangs included (one, centred on the anchor, for a single feature). */
export function periodStarts(run: EdgeRun, length: number): number[] {
  const { period: p, anchor } = run;
  if (!(p > 0)) return [];
  const lo = Math.max(0, run.span[0]), hi = Math.min(length, run.span[1]);
  const [u0, u1] = PROFILE_REACH[run.line];
  const fits = (start: number) => start + u0 * p >= lo - EPS && start + u1 * p <= hi + EPS;
  if (LINE_PROFILE[run.line].kind === 'single') return fits(anchor - p / 2) ? [anchor - p / 2] : [];
  const first = Math.ceil((lo - anchor) / p + 0.5 - u0 - EPS), last = Math.floor((hi - anchor) / p + 0.5 - u1 + EPS);
  const starts: number[] = [];
  for (let k = first; k <= last; k++) starts.push(anchor + (k - 0.5) * p);
  return starts;
}

/** A frame along an edge: where distance `s` along it, displaced `v` (in half-depths) to its + side, lies. */
type Frame = (s: number, v: number) => Pt;

/** The edge as segments in a frame: straight to each period, the period's steps, straight to the end. */
function runSegments(run: EdgeRun, length: number, at: Frame, straight: (from: number, to: number) => Segment[]): Segment[] {
  const out: Segment[] = [];
  const profile = LINE_PROFILE[run.line];
  const map = ([u, v]: Pt, start: number): Pt => at(start + u * run.period, v);
  let done = 0;
  for (const start of periodStarts(run, length)) {
    if (start > done + EPS) out.push(...straight(done, start));
    for (const s of profile.period) {
      out.push(s.k === 'L' ? { k: 'L', to: map(s.to, start) } : { k: 'C', c1: map(s.c1, start), c2: map(s.c2, start), to: map(s.to, start) });
    }
    done = start + run.period;
  }
  if (done < length - EPS) out.push(...straight(done, length));
  return out;
}

const commands = (segments: readonly Segment[]): string => segments.map((s) => s.k === 'L'
  ? `L${r2(s.to[0])} ${r2(s.to[1])}`
  : `C${r2(s.c1[0])} ${r2(s.c1[1])} ${r2(s.c2[0])} ${r2(s.c2[1])} ${r2(s.to[0])} ${r2(s.to[1])}`).join('');

/** The points of segments drawn from `from`, cubics flattened as `pathRings` flattens them. */
function flatten(from: Pt, segments: readonly Segment[]): Pt[] {
  const out: Pt[] = [from];
  let p0 = from;
  for (const s of segments) {
    if (s.k === 'C') {
      for (let i = 1; i <= CURVE_STEPS; i++) {
        const t = i / CURVE_STEPS, u = 1 - t;
        out.push([
          u * u * u * p0[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.to[0],
          u * u * u * p0[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.to[1],
        ]);
      }
    } else out.push(s.to);
    p0 = s.to;
  }
  return out;
}

interface DrawnEdge { readonly commands: string; readonly points: Pt[] }

const edgeCache = new Map<string, DrawnEdge>();
const EDGE_CACHE_MAX = 20_000;

function memo(key: string, draw: () => DrawnEdge): DrawnEdge {
  let e = edgeCache.get(key);
  if (!e) {
    if (edgeCache.size >= EDGE_CACHE_MAX) edgeCache.clear();
    e = draw();
    edgeCache.set(key, e);
  }
  return e;
}

const runKey = (run: EdgeRun): unknown[] => [run.line, run.side, run.depth, run.period, run.anchor, run.span];

function drawnEdge(a: Pt, b: Pt, run: EdgeRun): DrawnEdge {
  return memo(JSON.stringify([...runKey(run), a, b]), () => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    const ux = length ? dx / length : 0, uy = length ? dy / length : 0;
    const h = (run.side * run.depth) / 2;
    const at: Frame = (s, v) => [a[0] + ux * s + uy * v * h, a[1] + uy * s - ux * v * h];
    const segments = runSegments(run, length, at, (_, to) => [{ k: 'L', to: to >= length - EPS ? b : at(to, 0) }]);
    if (segments.length === 0) segments.push({ k: 'L', to: b });
    return { commands: commands(segments), points: flatten(a, segments) };
  });
}

/** SVG commands drawing a→b (the current point is a): only L and C, numbers rounded with r2. */
export function edgeCommands(a: Pt, b: Pt, run: EdgeRun): string {
  return drawnEdge(a, b, run).commands;
}

/** The same edge flattened to points from a to b (cubics in CURVE_STEPS, as `pathRings` reads them) — envelopes, tests. */
export function edgePoints(a: Pt, b: Pt, run: EdgeRun): Pt[] {
  return drawnEdge(a, b, run).points;
}

/** Longest straight piece of a profile mapped onto a curved polyline: longer steps are split so they follow the curve. */
const POLYLINE_STEP = 2;

/**
 * The periods laid all the way round a ring this long: from the anchor's period on, while a whole one fits (with a period that divides
 * the length, they tile it). Overhangs may cross the start: distances wrap round a ring.
 */
function ringStarts(run: EdgeRun, length: number): number[] {
  const p = run.period;
  if (!(p > 0)) return [];
  const first = (((run.anchor - p / 2) % p) + p) % p;
  const starts: number[] = [];
  for (let s = first < p - EPS ? first : 0; s + p <= length + EPS; s += p) starts.push(s);
  return starts;
}

/**
 * The same along a polyline (curved base lines): u runs by arc length, so periods stay even round curves and corners. Only L commands.
 * A closed polyline (its last point its first) is a ring — a bordure's inner edge: distances wrap round it, and periods are laid all the
 * way round from the anchor (`span` is not used).
 */
export function polylineEdgeCommands(points: readonly Pt[], run: EdgeRun): string {
  return memo(JSON.stringify([...runKey(run), points]), () => {
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const length = cum[cum.length - 1];
    const last = points[points.length - 1];
    const ring = points.length > 2 && last[0] === points[0][0] && last[1] === points[0][1];
    const segNormal = (i: number): Pt => {
      const d = cum[i + 1] - cum[i] || 1;
      return [(points[i + 1][1] - points[i][1]) / d, -(points[i + 1][0] - points[i][0]) / d];
    };
    // vertex normals: the mean of the two segments' left normals, so the displaced line turns smoothly round a corner
    const normals = points.map((_, i): Pt => {
      const n0 = segNormal(Math.max(0, i - 1)), n1 = segNormal(Math.min(points.length - 2, i));
      const nx = n0[0] + n1[0], ny = n0[1] + n1[1], d = Math.hypot(nx, ny) || 1;
      return [nx / d, ny / d];
    });
    const segmentAt = (s: number) => {
      let i = 0;
      while (i < points.length - 2 && cum[i + 1] < s) i++;
      return i;
    };
    const h = (run.side * run.depth) / 2;
    const at: Frame = (along, v) => {
      const s = ring ? ((along % length) + length) % length : along;
      const i = segmentAt(s);
      const len = cum[i + 1] - cum[i] || 1;
      const t = Math.min(1, Math.max(0, (s - cum[i]) / len));
      // the segment's own normal, turning to the vertex normal within POLYLINE_STEP of either end
      const blend = Math.min(POLYLINE_STEP, len / 2), own = segNormal(i);
      const [end, w] = t * len < blend ? [normals[i], 1 - (t * len) / blend] : (1 - t) * len < blend ? [normals[i + 1], 1 - ((1 - t) * len) / blend] : [own, 0];
      const nx = own[0] + (end[0] - own[0]) * w, ny = own[1] + (end[1] - own[1]) * w;
      const d = Math.hypot(nx, ny) || 1;
      const x = points[i][0] + (points[i + 1][0] - points[i][0]) * t, y = points[i][1] + (points[i + 1][1] - points[i][1]) * t;
      return [x + (nx / d) * v * h, y + (ny / d) * v * h];
    };
    // straight runs follow the polyline's own vertices
    const straight = (from: number, to: number): Segment[] => [
      ...points.filter((_, i) => cum[i] > from + EPS && cum[i] < to - EPS).map((p): Segment => ({ k: 'L', to: p })),
      { k: 'L', to: to >= length - EPS ? points[points.length - 1] : at(to, 0) },
    ];
    const profile = LINE_PROFILE[run.line];
    const out: Segment[] = [];
    let done = 0;
    for (const start of ring ? ringStarts(run, length) : periodStarts(run, length)) {
      if (start > done + EPS) out.push(...straight(done, start));
      // the period in (u, v): cubics flattened and long straight steps split, so every piece follows the curve
      let prev: Pt = [0, 0];
      for (const s of profile.period) {
        const pieces = Math.max(1, Math.ceil((Math.abs(s.to[0] - prev[0]) * run.period) / POLYLINE_STEP));
        const local = s.k === 'L'
          ? Array.from({ length: pieces }, (_, k): Pt => [prev[0] + ((s.to[0] - prev[0]) * (k + 1)) / pieces, prev[1] + ((s.to[1] - prev[1]) * (k + 1)) / pieces])
          : flatten(prev, [s]).slice(1);
        for (const [u, v] of local) out.push({ k: 'L', to: at(start + u * run.period, v) });
        prev = s.to;
      }
      done = start + run.period;
    }
    if (done < length - EPS) out.push(...straight(done, length));
    return { commands: commands(out), points: flatten(points[0], out) };
  }).commands;
}

// ── Lines laid across the field ─────────────────────────────────────────────

/** Whether a profile is symmetric about u = ½ (the mirrored and the single profiles); the parallel ones are antisymmetric, v(1−u) = −v(u). */
const isSymmetric = (line: ComplexLine): boolean => LINE_PROFILE[line].pairing === 'mirrored' || LINE_PROFILE[line].kind === 'single';

/**
 * The run that draws the same edge from b back to a (an edge two regions share, each drawing it its own way round): anchor and span
 * measured from the other end; a symmetric profile turns to the other side of travel and an antisymmetric one stays, so the drawn line
 * is the same.
 */
export function reversedRun(run: EdgeRun, length: number): EdgeRun {
  const side: 1 | -1 = isSymmetric(run.line) ? (run.side === 1 ? -1 : 1) : run.side;
  return { ...run, side, anchor: length - run.anchor, span: [length - run.span[1], length - run.span[0]] };
}

/** A complex line laid along a straight line through the field: one run, measured from `origin` along the unit `dir`, that every edge lying on the line draws a piece of, so the regions either side of it meet. */
export interface LaidLine { readonly origin: Pt; readonly dir: Pt; readonly run: EdgeRun }

/** The run drawing the part a→b of a laid line (a and b on it, either way round). */
export function runAlong(laid: LaidLine, a: Pt, b: Pt): EdgeRun {
  const at = ([x, y]: Pt) => (x - laid.origin[0]) * laid.dir[0] + (y - laid.origin[1]) * laid.dir[1];
  const sa = at(a), sb = at(b);
  const from = Math.min(sa, sb);
  const forward: EdgeRun = { ...laid.run, anchor: laid.run.anchor - from, span: [laid.run.span[0] - from, laid.run.span[1] - from] };
  return sb >= sa ? forward : reversedRun(forward, sa - sb);
}

/** The side a line of the field puts its features on (RULES-C §A.2): toward chief, or toward dexter on an upright line. `dir` is the way it is drawn. */
export function fieldSide([dx, dy]: Pt): 1 | -1 {
  return Math.abs(dx) > EPS ? (dx > 0 ? 1 : -1) : dy < 0 ? 1 : -1;
}

let swings: Record<ComplexLine, number> | null = null;

/**
 * The furthest a line's drawn points stray from it, in depths: ½ for the antisymmetric profiles (they swing either way), 1 for the
 * one-sided ones and the single features (enarched, ployé). Lazily computed — module-cycle safe.
 */
export function profileSwing(line: ComplexLine): number {
  swings ??= Object.fromEntries(LINES.filter((l): l is ComplexLine => l !== 'plain').map((l) => [l, Math.max(...flatten([0, 0], LINE_PROFILE[l].period).map(([, v]) => Math.abs(v))) / 2])) as Record<ComplexLine, number>;
  return swings[line];
}

let sideReaches: Record<ComplexLine, readonly [number, number]> | null = null;

/**
 * How far a line's drawn points stray to its − side and to its + side, in depths: [0, 1] for the one-sided profiles, [½, ½] for the
 * antisymmetric ones. Lazily computed — module-cycle safe.
 */
export function profileSides(line: ComplexLine): readonly [number, number] {
  sideReaches ??= Object.fromEntries(LINES.filter((l): l is ComplexLine => l !== 'plain').map((l): [ComplexLine, readonly [number, number]] => {
    const vs = flatten([0, 0], LINE_PROFILE[l].period).map(([, v]) => v);
    return [l, [Math.max(0, -Math.min(...vs)) / 2, Math.max(0, ...vs) / 2]];
  })) as Record<ComplexLine, readonly [number, number]>;
  return sideReaches[line];
}

let featureMiddles: Record<ComplexLine, number> | null = null;

/**
 * Where a periodic line's features lie across it, in depths along its + side: midway between its peaks and its valleys. 0 for the
 * antisymmetric profiles, which straddle their line already; ±½ for the one-sided ones (engrailed, invected, indented, bretessed), which
 * a line of the field is moved back by so that it straddles its nominal line too. 0 for a single feature, which starts and ends on it.
 */
export function featureMiddle(line: ComplexLine): number {
  featureMiddles ??= Object.fromEntries(LINES.filter((l): l is ComplexLine => l !== 'plain').map((l) => {
    const p = LINE_PROFILE[l];
    if (p.kind === 'single') return [l, 0];
    const vs = flatten([0, 0], p.period).map(([, v]) => v);
    return [l, (Math.min(...vs) + Math.max(...vs)) / 4];
  })) as Record<ComplexLine, number>;
  return featureMiddles[line];
}
