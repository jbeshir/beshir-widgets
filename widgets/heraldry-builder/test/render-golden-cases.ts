// Every shield the golden pins, with hatching off and on, reduced to a short hash of its markup, so a refactor of how paint is drawn
// is provably neutral. The fixture is test/fixtures/render-golden.json; `GOLDEN_REASON="…" npm run golden:write` regenerates it
// from every key; `npm test` works out a seeded rotating sample of the hatched renders that pin shapes rather than paint (`inRenderSample`).
//
// Keys never depend on which designs the library accepts: the examples and sample entries by their ids, the generated designs by the
// hash of their canonical JSON (a rule that drops or adds a generated design drops or adds its key, and changes no other), and a fixed
// list of paint and charge cases by name. A generated design's shape comes from its hash, a case's from its name.
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { Shield } from '../src/components/Shield';
import sample from '../src/data/sample-registry.json';
import {
  CHARGES, CHARGE_IDS, DRAWN_LINES, DRAWN_TREATMENTS, FIELD_SHAPES, FURS, SEMY_NAMES, VARIATIONS, blazon, canonicalJson, isCountedVariation, lineAllowed, type Design, type FieldShape,
} from '../src/lib/heraldry';
import { EXAMPLE_DESIGNS } from '../src/lib/presets';
import { generatedDesigns, generatedRichDesigns } from './design-generator';
import { hash } from './golden';
import { rotatesIn } from './rotation';
import { arms, charge, div, group, nd, ordinary } from './helpers';
import type { SampleFile } from './sample-registry';

export const HATCHINGS = ['plain', 'hatched'] as const;
type Hatching = (typeof HATCHINGS)[number];

/** A pinned shield and the hatchings it is rendered in. */
export interface GoldenShield { key: string; design: Design; shape: FieldShape; hatchings: readonly Hatching[] }

/** A shape chosen by a key's hash, so the four shapes share the shields evenly whatever else is pinned. */
const shapeFor = (key: string): FieldShape => FIELD_SHAPES[parseInt(hash(key), 16) % FIELD_SHAPES.length];

const fur = (name: string, colours: [string, string] | null = null) => ({ k: 'fur', fur: name, colours });
const varied = (variation: string, a: string, b: string, pieces: number | null = null) => ({ k: 'variation', variation, pieces, parts: [a, b] });
const treated = (treatment: string, ground: string, ink: string) => ({ k: 'treated', treatment, ground, ink });
const semy = (ground: string, id: string, ink: string) => ({ k: 'semy', ground, charge: { charge: id }, ink });

/** A metal ground's colour charge and a colour ground's metal one. */
const onFur = (name: string) => (['counter-ermine', 'pean'].includes(name) ? 'or' : 'gules');

/**
 * One shield for every fur, variation, treatment and named semy, for natural colours on every charge that has them, for a split
 * band and picture and the counterchanged forms, and one for every charge in its default drawing: what paint-render.ts, patterns.ts
 * and the charge art draw, each named for what it pins.
 */
const PAINT_CASES: ReadonlyArray<[string, unknown]> = [
  ...FURS.map((f): [string, unknown] => [`fur-${f}`, arms(fur(f), group(charge('lion'), onFur(f)))]),
  ['fur-ermined', arms(fur('ermine', ['argent', 'gules']), group(charge('lion'), 'azure'))],
  ['fur-vairy', arms(fur('vair', ['or', 'gules']), group(ordinary('chief'), 'azure'))],
  ['fur-potenty', arms(fur('potent', ['argent', 'sable']), group(ordinary('bordure'), 'gules'))],
  ['fur-on-charge', arms('azure', group(charge('lion'), fur('ermine')))],
  ['fur-on-band', arms('gules', group(ordinary('chevron'), fur('vair')))],
  ...VARIATIONS.map((v): [string, unknown] => [`variation-${v}`, arms(varied(v, 'or', 'azure'))]),
  ...VARIATIONS.filter(isCountedVariation).map((v): [string, unknown] => [`variation-${v}-8`, arms(varied(v, 'argent', 'gules', 8))]),
  ['variation-on-band', arms('argent', group(ordinary('fess'), varied('checky', 'or', 'azure')))],
  ['variation-on-charge', arms('vert', group(charge('heart'), varied('barry', 'argent', 'gules')))],
  ...DRAWN_TREATMENTS.map((t): [string, unknown] => [`treatment-${t}`, arms(treated(t, 'argent', 'sable'), group(charge('lion'), 'gules'))]),
  ['treatment-on-band', arms('azure', group(ordinary('bend'), treated('masoned', 'or', 'sable')))],
  ['treatment-on-charge', arms('vert', group(charge('heart'), treated('scaly', 'or', 'gules')))],
  ...SEMY_NAMES.map((n): [string, unknown] => [`semy-${n.word}`, arms(semy(n.tincture && n.tincture !== 'or' && n.tincture !== 'argent' ? 'or' : 'vert', n.charge, n.tincture ?? 'argent'))]),
  ['semy-on-bordure', arms('vert', group(charge('lion'), 'or'), group(ordinary('bordure'), semy('argent', 'mullet', 'sable')))],
  ['semy-all-counterchanged', arms({ k: 'divided', division: 'per-pale', parts: [semy('azure', 'rose', 'argent'), semy('argent', 'rose', 'azure')] })],
  ...CHARGE_IDS.filter((id) => CHARGES[id].proper).map((id): [string, unknown] => [`proper-${id}`, arms(CHARGES[id].proper!.cls === 'metal' ? 'azure' : 'argent', group(charge(id), 'proper'))]),
  ['party-band', arms('argent', group(ordinary('pale'), div('per-fess', 'gules', 'azure')))],
  ['party-charge', arms('argent', group(charge('heart'), div('per-pale', 'azure', 'gules')))],
  ['counterchanged-band', arms(div('per-pale', 'or', 'azure'), group(ordinary('bend'), 'counterchanged'))],
  ['counterchanged-charges', arms(div('per-fess', 'argent', 'gules'), group(charge('mullet'), 'counterchanged', { count: 3 }))],
  ...CHARGE_IDS.map((id): [string, unknown] => [`charge-${id}`, arms('azure', group(charge(id), 'or'))]),
];

const lined = (division: string, line: string, a = 'or', b = 'azure') => ({ k: 'divided', division, lines: { a: line }, parts: [a, b] });
const stripes = (variation: string, line: string, pieces: number) => ({ k: 'variation', variation, pieces, lines: { a: line }, parts: ['argent', 'gules'] });

/** The lines of partition on the field: every line a per pale division takes, the lines only some divisions take, wavy on each other division and on the stripes, and the one-sided line of a quartered field. */
const GEOMETRY_CASES: ReadonlyArray<[string, unknown]> = [
  ...DRAWN_LINES.filter((l) => lineAllowed({ k: 'division', division: 'per-pale' }, l)).map((l): [string, unknown] => [`line-${l}-per-pale`, arms(lined('per-pale', l))]),
  ['line-enarched-per-fess', arms(lined('per-fess', 'enarched', 'argent', 'sable'))],
  ['line-ploye-per-chevron', arms(lined('per-chevron', 'ploye', 'argent', 'gules'))],
  ...['per-fess', 'per-bend', 'per-bend-sinister', 'per-chevron', 'per-saltire', 'quarterly'].map((d): [string, unknown] => [`line-wavy-${d}`, arms(lined(d, 'wavy'))]),
  ['line-wavy-barry', arms(stripes('barry', 'wavy', 8))],
  ['line-indented-paly', arms(stripes('paly', 'indented', 6))],
  ['line-embattled-quarterly-fess', arms({ k: 'divided', division: 'quarterly', lines: { a: 'plain', b: 'embattled' }, parts: ['or', 'gules'] })],
  // the divisions behind "More divisions": the two chevron forms, gyronny of six, eight and twelve, and a gyronny arrondi
  ['div-per-chevron-inverted', arms(div('per-chevron-inverted', 'purpure', 'argent'))],
  // three charges on it stand one and two (GoT Table 7; review R-1)
  ['div-per-chevron-inverted-three', arms(div('per-chevron-inverted', 'purpure', 'vert'), group(charge('rose'), 'or', { count: 3 }))],
  ['div-per-chevron-throughout', arms(div('per-chevron-throughout', 'argent', 'gules'))],
  ...[6, 8, 12].map((n): [string, unknown] => [`div-gyronny-${n}`, arms({ ...div('gyronny', 'or', 'purpure'), pieces: n })]),
  ['div-gyronny-arrondi', arms({ ...div('gyronny', 'argent', 'gules'), pieces: 8, lines: { a: 'arrondi' } })],
  ['line-embattled-per-chevron-inverted', arms(lined('per-chevron-inverted', 'embattled', 'argent', 'sable'))],
  // the divisions in three: per pall (one of its parts a fur), per pall inverted, tierced in pale and in fess, and a wavy per pall
  ['div-per-pall', arms(div('per-pall', 'or', 'sable', 'purpure'))],
  ['div-per-pall-inverted', arms(div('per-pall-inverted', 'argent', 'sable', 'gules'))],
  ['div-tierced-per-pale', arms(div('tierced-per-pale', 'azure', 'argent', 'gules'))],
  ['div-tierced-per-fess', arms(div('tierced-per-fess', 'gules', 'argent', 'vert'))],
  ['line-bevilled-per-bend', arms(lined('per-bend', 'bevilled', 'argent', 'gules'))],
  ['line-wavy-per-pall', arms({ k: 'divided', division: 'per-pall', lines: { a: 'wavy' }, parts: [{ k: 'fur', fur: 'ermine', colours: null }, 'azure', 'gules'] })],
];

const band = (type: string, lines: object) => arms('azure', group(ordinary(type, { lines }), 'or'));

/** The lines of the ordinaries: every line a fess takes (a band's bare meaning of it), wavy on each other ordinary, both edges and the lower edge alone. */
const ORDINARY_LINE_CASES: ReadonlyArray<[string, unknown]> = [
  ...DRAWN_LINES.filter((l) => lineAllowed({ k: 'ordinary', type: 'fess', inverted: false }, l)).map((l): [string, unknown] => [`line-${l}-fess`, band('fess', l === 'embattled' ? { a: l } : { a: l, b: l })]),
  ...['pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'chief', 'bordure'].map((t): [string, unknown] => [`line-wavy-${t}`, band(t, { a: 'wavy', b: 'wavy' })]),
  ['line-embattled-counter-embattled-fess', band('fess', { a: 'embattled', b: 'embattled' })],
  ['line-bretessed-fess', band('fess', { a: 'bretessed', b: 'bretessed' })],
  ['line-embattled-lower-chevron', band('chevron', { a: 'plain', b: 'embattled' })],
  // the lines tail: each on the one host kind that carries it, and a bowed pile
  ['line-triangular-chief', band('chief', { a: 'triangular', b: 'triangular' })],
  ['line-rompu-chevron', band('chevron', { a: 'rompu', b: 'rompu' })],
  ['line-bevilled-bend', band('bend', { a: 'bevilled', b: 'bevilled' })],
  ['line-ploye-pile', band('pile', { a: 'ploye', b: 'ploye' })],
];

const treatedBand = (type: string, mods: string[], extra: object = {}) => arms('azure', group(ordinary(type, { mods, ...extra }), 'or'));

/** The treatments of the ordinaries: each on every host it is drawn on once at least, a line with one, charges around a chevron inverted. */
const TREATMENT_CASES: ReadonlyArray<[string, unknown]> = [
  ['treat-inverted-chevron', treatedBand('chevron', ['inverted'])],
  ['treat-inverted-embattled-chevron', treatedBand('chevron', ['inverted'], { lines: { a: 'embattled' } })],
  ['treat-inverted-pile', treatedBand('pile', ['inverted'])],
  ['treat-inverted-chevron-between', arms('gules', group(ordinary('chevron', { mods: ['inverted'] }), 'or'), group(charge('roundel'), 'argent', { count: 3 }))],
  ...['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire'].map((t): [string, unknown] => [`treat-couped-${t}`, treatedBand(t, ['couped'])]),
  ['treat-couped-raguly-saltire', treatedBand('saltire', ['couped'], { lines: { a: 'raguly' } })],
  ['treat-throughout-chevron', treatedBand('chevron', ['throughout'])],
  ['treat-throughout-pile', treatedBand('pile', ['throughout'])],
  ['treat-enhanced-fess', treatedBand('fess', ['enhanced'])],
  ['treat-abased-bend', treatedBand('bend', ['abased'])],
  ['treat-enhanced-chevron', treatedBand('chevron', ['enhanced'])],
];

const outlinedBand = (type: string, extra: object, paint = 'or') => arms('azure', group(ordinary(type, extra), paint));
const cotised = (count: 1 | 2 | 3, line?: string) => ({ cotised: { count, paint: 'argent', ...(line ? { line } : {}) } });

/** The outlines of the central ordinaries: cotised on each host, doubly and triply, with lines, counterchanged; edged on each host that takes it; hollow. */
const OUTLINE_CASES: ReadonlyArray<[string, unknown]> = [
  ...['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile'].map((t): [string, unknown] => [`outline-cotised-${t}`, outlinedBand(t, cotised(1))]),
  ['outline-doubly-cotised-fess', outlinedBand('fess', cotised(2))],
  ['outline-triply-cotised-bend', outlinedBand('bend', cotised(3))],
  ['outline-cotised-wavy-bend', outlinedBand('bend', { lines: { a: 'wavy', b: 'wavy' }, ...cotised(1, 'wavy') })],
  ['outline-cotised-plain-on-wavy-fess', outlinedBand('fess', { lines: { a: 'wavy', b: 'wavy' }, ...cotised(1, 'plain') })],
  ['outline-cotised-chevron-between', arms('azure', group(ordinary('chevron', cotised(1)), 'or'), group(charge('roundel'), 'argent', { count: 3 }))],
  ['outline-cotised-counterchanged-bend', arms({ k: 'divided', division: 'per-pale', parts: ['argent', 'azure'] }, group(ordinary('bend', { cotised: { count: 1, paint: 'counterchanged' } }), 'sable'))],
  ...['fess', 'pale', 'bend', 'chevron', 'cross', 'saltire'].map((t): [string, unknown] => [`outline-fimbriated-${t}`, outlinedBand(t, { fimbriated: 'argent' })]),
  ['outline-fimbriated-embattled-fess', outlinedBand('fess', { lines: { a: 'embattled', b: 'embattled' }, fimbriated: 'argent' })],
  ['outline-voided-cross', outlinedBand('cross', { mods: ['voided'] })],
  ['outline-voided-saltire', outlinedBand('saltire', { mods: ['voided'] })],
  ['outline-voided-wavy-cross', outlinedBand('cross', { mods: ['voided'], lines: { a: 'wavy', b: 'wavy' } })],
  ['outline-voided-cotised-saltire', outlinedBand('saltire', { mods: ['voided'], ...cotised(1) })],
];

/** The corner and edge shapes: each alone, the sinister canton, a wavy base, several beside a band and a picture; the orle, double tressure, flaunches and gore (and gore sinister) with what they hold, and an orle embattled on its outer edge. */
const PERIPHERAL_CASES: ReadonlyArray<[string, unknown]> = [
  ...['base', 'point', 'canton', 'quarter', 'gyron'].map((t): [string, unknown] => [`periph-${t}`, arms('azure', group(ordinary(t), 'or'))]),
  ['periph-canton-sinister', arms('gules', group(ordinary('canton', { mods: ['sinister'] }), 'argent'))],
  ['line-wavy-base', arms('argent', group(charge('mullet'), 'sable'), group(ordinary('base', { lines: { a: 'wavy' } }), 'azure'))],
  ['periph-bend-chief-base-canton', arms('azure', group(ordinary('bend'), 'or'), group(ordinary('chief'), 'argent'), group(ordinary('base'), 'or'), group(ordinary('canton'), 'argent'))],
  ['periph-orle', arms(div('per-bend', 'argent', 'vert'), group(charge('heart'), 'gules'), group(ordinary('orle'), 'gules'))],
  ['periph-tressure-2', arms('gules', group(charge('lion'), 'or'), group(ordinary('tressure'), 'or', { count: 2 }))],
  ['periph-flaunches', arms('sable', group(charge('roundel'), 'or', { count: 3, arrangement: 'in-pale' }), group(ordinary('flaunches'), 'or'))],
  ['periph-gore', arms('gules', group(charge('dragon'), 'argent'), group(ordinary('gore'), 'or'))],
  ['periph-gore-sinister', arms('argent', group(ordinary('gore', { mods: ['sinister'] }), 'azure'))],
  ['line-embattled-outer-orle', arms('azure', group(ordinary('orle', { lines: { a: 'embattled', b: 'plain' } }), 'or'))],
];

/** The pall (and inverted, hollow, lined), the fret, the label across the chief, the mount and the trimount, alone and with what they hold or keep clear of. */
const MORE_SHAPE_CASES: ReadonlyArray<[string, unknown]> = [
  ...['pall', 'pall-inverted', 'label', 'fret', 'mount', 'trimount'].map((t): [string, unknown] => [`ord-${t}`, arms('azure', group(ordinary(t), t === 'label' ? 'argent' : 'or'))]),
  ['outline-voided-pall', outlinedBand('pall', { mods: ['voided'] })],
  ['line-wavy-pall-inverted', arms('argent', group(ordinary('pall-inverted', { lines: { a: 'wavy', b: 'wavy' } }), 'gules'))],
  ['ord-pall-between', arms('argent', group(ordinary('pall'), 'gules'), group(charge('roundel'), 'azure', { count: 3, relation: 'between' }))],
  ['ord-pall-charged', arms('argent', { ...group(ordinary('pall'), 'azure'), charged: [group(charge('mullet'), 'or', { count: 3 })] })],
  ['ord-label-lion', arms('azure', group(charge('lion'), 'or'), group(ordinary('label'), 'argent'))],
];

/** Diminutives two to four at a time, lined, raised, turned over, with charges between, under a chief; the baton. */
const DIMINUTIVE_CASES: ReadonlyArray<[string, unknown]> = [
  ['dim-bar-2', arms('gules', group(ordinary('bar'), 'or', { count: 2 }))],
  ['dim-bar-3', arms('gules', group(ordinary('bar'), 'or', { count: 3 }))],
  ['dim-bar-4', arms('azure', group(ordinary('bar'), 'argent', { count: 4 }))],
  ['dim-pallet-2', arms('or', group(ordinary('pallet'), 'gules', { count: 2 }))],
  ['dim-pallet-4', arms('or', group(ordinary('pallet'), 'gules', { count: 4 }))],
  ['dim-bendlet-3', arms('purpure', group(ordinary('bendlet'), 'argent', { count: 3 }))],
  ['dim-bendlet-3-enhanced', arms('purpure', group(ordinary('bendlet', { mods: ['enhanced'] }), 'argent', { count: 3 }))],
  ['dim-bendlet-sinister-2', arms('azure', group(ordinary('bendlet-sinister'), 'or', { count: 2 }))],
  ['dim-chevronel-2', arms('azure', group(ordinary('chevronel'), 'or', { count: 2 }))],
  ['dim-chevronel-3', arms('vert', group(ordinary('chevronel'), 'argent', { count: 3 }))],
  ['dim-chevronel-2-inverted', arms('sable', group(ordinary('chevronel', { mods: ['inverted'] }), 'or', { count: 2 }))],
  ['dim-chevronel-2-between', arms('gules', group(ordinary('chevronel'), 'or', { count: 2 }), group(charge('rose'), 'argent', { count: 3, relation: 'between' }))],
  ['dim-bar-3-chief', arms('argent', group(ordinary('bar'), 'azure', { count: 3 }), group(ordinary('chief'), 'gules'))],
  ['dim-baton', arms('gules', group(ordinary('baton'), 'argent'))],
  ['dim-baton-sinister', arms('gules', group(ordinary('baton', { mods: ['sinister'] }), 'argent'))],
  ['dim-bars-wavy-3', arms('azure', group(ordinary('bar', { lines: { a: 'wavy' } }), 'argent', { count: 3 }))],
];

const contourny = { facing: 'to-sinister' };
const pair = (word: string) => ({ count: 2, arrangement: { k: 'pair', pair: word } });

/**
 * The phase-D charge attributes (PLAN-D §0.3.9), plain and hatched: facing to sinister alone, proper, divided, counterchanged and carrying a
 * charge (its on-box mirrored with it); the pairs on the field and around a pale.
 */
const CHARGE_ATTRIBUTE_CASES: ReadonlyArray<[string, unknown]> = [
  ['attr-lion-contourny', arms('azure', group(charge('lion', contourny), 'or'))],
  ['attr-lions-combattant', arms('azure', group(charge('lion'), 'or', pair('combattant')))],
  ['attr-wolves-addorsed', arms('argent', group(charge('wolf'), 'sable', pair('addorsed')))],
  ['attr-eagles-respectant', arms('gules', group(charge('eagle'), 'argent', pair('respectant')))],
  ['attr-lion-contourny-proper', arms('vert', group(charge('lion', contourny), 'proper'))],
  ['attr-lion-contourny-per-bend', arms('azure', group(charge('lion', contourny), div('per-bend', 'or', 'argent')))],
  ['attr-lion-contourny-counterchanged', arms(div('per-pale', 'argent', 'gules'), group(charge('lion', contourny), 'counterchanged'))],
  ['attr-lion-contourny-charged', arms('azure', group(charge('lion', contourny), 'or', { charged: [group(charge('mullet'), 'gules')] }))],
  ['attr-pale-between-lions-combattant', arms('azure', group(ordinary('pale'), 'argent'), group(charge('lion'), 'or', pair('combattant')))],
  ['attr-sword-fesswise', arms('azure', group(charge('sword', { orientation: 'fesswise' }), 'argent'))],
  ['attr-swords-palewise-on-bend', arms('azure', group(ordinary('bend'), 'or', { charged: [group(charge('sword', { orientation: 'palewise' }), 'gules', { count: 3 })] }))],
  ['attr-increscent', arms('gules', group(charge('crescent', { orientation: 'fesswise' }), 'argent'))],
  ['attr-decrescents', arms('or', group(charge('crescent', { orientation: 'fesswise-reversed' }), 'azure', { count: 3 }))],
  ['attr-mullet-inverted', arms('azure', group(charge('mullet', { orientation: 'inverted' }), 'or'))],
  ['attr-bee-bendwise', arms('or', group(charge('bee', { orientation: 'bendwise' }), 'sable'))],
  ['attr-swords-to-center', arms('azure', group(charge('sword', { orientation: 'to-center' }), 'argent', { count: 4, arrangement: 'in-cross' }))],
  ['attr-sword-bendwise-sinister', arms('azure', group(charge('sword', { orientation: 'bendwise-sinister' }), 'or'))],
  ['attr-billet-fesswise', arms('vert', group(charge('billet', { orientation: 'fesswise' }), 'argent'))],
  ['attr-mullet-of-six', arms('azure', group(charge('mullet', { mods: [{ id: 'of-points', count: 6 }] }), 'or'))],
  ['attr-estoile-of-eight', arms('gules', group(charge('estoile', { mods: [{ id: 'of-points', count: 8 }] }), 'or'))],
  ['attr-mullet-voided', arms('azure', group(charge('mullet', { mods: ['voided'] }), 'or'))],
  ['attr-lozenge-fimbriated', arms('azure', group(charge('lozenge', { mods: [{ id: 'fimbriated', paint: 'argent' }] }), 'azure'))],
  ['attr-mullet-of-six-pierced', arms('sable', group(charge('mullet', { mods: [{ id: 'of-points', count: 6 }, 'pierced'] }), 'argent'))],
  ['attr-mullets-voided-per-pale', arms(div('per-pale', 'azure', 'gules'), group(charge('mullet', { mods: ['voided'] }), 'or', { count: 3 }))],
  ['attr-demi-lion', arms('azure', group(charge('lion', { form: 'demi' }), 'or'))],
  ['attr-wolf-head-erased', arms('argent', group(charge('wolf', { form: 'head', mods: ['erased'] }), 'sable'))],
  ['attr-stags-heads-couped', arms('vert', group(charge('stag', { form: 'head', mods: ['couped'] }), 'or', { count: 3 }))],
  ['attr-lion-head-contourny', arms('gules', group(charge('lion', { form: 'head', facing: 'to-sinister' }), 'or'))],
  ['attr-demi-dragon', arms('sable', group(charge('dragon', { form: 'demi' }), 'argent'))],
  ['attr-lion-couchant', arms('azure', group(charge('lion', { posture: 'couchant' }), 'or'))],
  ['attr-lion-passant-guardant', arms('gules', group(charge('lion', { posture: 'passant', gaze: 'guardant' }), 'or'))],
  ['attr-lion-rampant-regardant', arms('or', group(charge('lion', { gaze: 'regardant' }), 'gules'))],
  ['attr-eagle-close', arms('azure', group(charge('eagle', { posture: 'close' }), 'argent'))],
  ['attr-eagles-rising', arms('vert', group(charge('eagle', { posture: 'rising' }), 'or', { count: 3 }))],
  ['attr-stag-lodged', arms('vert', group(charge('stag', { posture: 'couchant' }), 'or'))],
  ['attr-fish-urinant', arms('azure', group(charge('fish', { posture: 'urinant' }), 'argent'))],
  ['attr-lion-crowned', arms('azure', group(charge('lion', { parts: [{ part: 'crowned', paint: 'gules' }] }), 'or'))],
  ['attr-wolf-head-collared', arms('vert', group(charge('wolf', { form: 'head', parts: [{ part: 'collared', paint: 'or' }] }), 'argent'))],
  ['attr-lions-combattant-winged', arms('azure', group(charge('lion', { mods: [{ id: 'winged', paint: 'argent' }] }), 'or', pair('combattant')))],
  ['attr-heart-winged', arms('argent', group(charge('heart', { mods: [{ id: 'winged', paint: 'or' }] }), 'gules'))],
  ['attr-roundel-enflamed', arms('argent', group(charge('roundel', { mods: [{ id: 'enflamed', paint: 'proper' }] }), 'azure'))],
  ['attr-roses-slipped-leaved', arms('argent', group(charge('rose', { mods: [{ id: 'slipped', paint: 'vert' }, { id: 'leaved', paint: 'vert' }] }), 'gules', { count: 3 }))],
  ['attr-lion-maintaining-sword', arms('azure', group(charge('lion', { holds: [{ how: 'maintaining', item: charge('sword'), paint: 'argent' }] }), 'or'))],
  ['attr-eagles-key-in-beak', arms('argent', group(charge('eagle', { holds: [{ how: 'in-beak', item: charge('key'), paint: 'gules' }] }), 'sable', { count: 3 }))],
  ['attr-lions-combattant-sustaining-roses', arms('or', group(charge('lion', { holds: [{ how: 'sustaining', item: charge('rose'), paint: 'gules' }] }), 'azure', pair('combattant')))],
  ['attr-bear-contourny', arms('or', group(charge('bear', contourny), 'sable'))],
  ['attr-cat-couchant', arms('gules', group(charge('cat', { posture: 'couchant' }), 'argent'))],
  ['attr-horses-courant', arms('vert', group(charge('horse', { posture: 'courant' }), 'argent', { count: 3 }))],
  ['attr-fox-sejant', arms('argent', group(charge('fox', { posture: 'sejant' }), 'gules'))],
  ['attr-squirrels-addorsed', arms('azure', group(charge('squirrel'), 'or', pair('addorsed')))],
  ['attr-horse-head-couped', arms('azure', group(charge('horse', { form: 'head', mods: ['couped'] }), 'argent'))],
  ['attr-bear-head-collared', arms('or', group(charge('bear', { form: 'head', parts: [{ part: 'collared', paint: 'gules' }] }), 'sable'))],
  ['attr-griffin-passant-crowned', arms('azure', group(charge('griffin', { posture: 'passant', parts: [{ part: 'crowned', paint: 'gules' }] }), 'or'))],
  ['attr-griffins-sejant-contourny', arms('gules', group(charge('griffin', { posture: 'sejant', ...contourny }), 'argent', { count: 3 }))],
  ['attr-wyvern-erect-maintaining-sword', arms('vert', group(charge('wyvern', { posture: 'erect', holds: [{ how: 'maintaining', item: charge('sword'), paint: 'argent' }] }), 'or'))],
  ['attr-phoenix-contourny', arms('sable', group(charge('phoenix', contourny), 'or'))],
  ['attr-pegasus-passant', arms('azure', group(charge('pegasus', { posture: 'passant' }), 'argent'))],
  ['attr-seahorses-contourny', arms('argent', group(charge('seahorse', contourny), 'azure', { count: 3 }))],
  ['attr-sea-lion-erect', arms('or', group(charge('sea-lion'), 'gules'))],
  ['attr-raven-volant', arms('or', group(charge('raven', { posture: 'volant' }), 'sable'))],
  ['attr-ravens-key-in-beak', arms('argent', group(charge('raven', { holds: [{ how: 'in-beak', item: charge('key'), paint: 'or' }] }), 'sable', { count: 3 }))],
  ['attr-falcon-rising-contourny', arms('vert', group(charge('falcon', { posture: 'rising', ...contourny }), 'argent'))],
  ['attr-swan-close-collared', arms('azure', group(charge('swan', { posture: 'close', parts: [{ part: 'collared', paint: 'or' }] }), 'argent'))],
  ['attr-peacock-contourny', arms('azure', group(charge('peacock', contourny), 'argent'))],
  ['attr-martlets-addorsed', arms('gules', group(charge('martlet'), 'argent', pair('addorsed')))],
  ['attr-doves-respectant', arms('azure', group(charge('dove'), 'argent', pair('respectant')))],
  ['attr-arrows-fesswise', arms('vert', group(charge('arrow', { orientation: 'fesswise' }), 'argent', { count: 3 }))],
  ['attr-axe-reversed', arms('gules', group(charge('axe', { orientation: 'reversed' }), 'argent'))],
  ['attr-harp-reversed', arms('azure', group(charge('harp', { orientation: 'reversed' }), 'or'))],
  ['attr-pheons-to-center', arms('argent', group(charge('pheon', { orientation: 'to-center' }), 'sable', { count: 4, arrangement: 'in-cross' }))],
  ['attr-trident-inverted', arms('azure', group(charge('trident', { orientation: 'inverted' }), 'or'))],
  ['attr-spears-bendwise', arms('vert', group(charge('spear', { orientation: 'bendwise' }), 'or', { count: 2 }))],
  ['attr-acorns-slipped-leaved', arms('argent', group(charge('acorn', { mods: [{ id: 'slipped', paint: 'vert' }, { id: 'leaved', paint: 'vert' }] }), 'or', { count: 3 }))],
  ['attr-acorn-inverted-slipped', arms('azure', group(charge('acorn', { orientation: 'inverted', mods: [{ id: 'slipped', paint: 'vert' }] }), 'or'))],
  ['attr-oak-leaf-bendwise-slipped-leaved', arms('argent', group(charge('oak-leaf', { orientation: 'bendwise', mods: [{ id: 'slipped', paint: 'vert' }, { id: 'leaved', paint: 'vert' }] }), 'vert'))],
  ['attr-escallops-inverted', arms('gules', group(charge('escallop', { orientation: 'inverted' }), 'argent', { count: 3 }))],
  ['attr-dolphin-contourny', arms('azure', group(charge('dolphin', contourny), 'argent'))],
  ['attr-dolphin-haurient', arms('azure', group(charge('dolphin', { posture: 'haurient' }), 'or'))],
  ['attr-dolphins-respectant', arms('azure', group(charge('dolphin'), 'or', pair('respectant')))],
  ['attr-serpent-glissant', arms('argent', group(charge('serpent', { posture: 'glissant' }), 'vert'))],
  ['attr-serpent-erect-contourny', arms('argent', group(charge('serpent', { posture: 'erect', ...contourny }), 'vert'))],
  ['attr-dragonfly-bendwise', arms('sable', group(charge('dragonfly', { orientation: 'bendwise' }), 'argent'))],
  ['attr-towers-inverted', arms('azure', group(charge('tower', { orientation: 'inverted' }), 'argent', { count: 3 }))],
  ['attr-hand-reversed', arms('argent', group(charge('hand', { orientation: 'reversed' }), 'gules'))],
  ['attr-bell-bendwise', arms('vert', group(charge('bell', { orientation: 'bendwise' }), 'or'))],
  ['attr-hawk-rising', arms('sable', group(charge('hawk', { posture: 'rising' }), 'or'))],
  ['attr-rapiers-saltire', arms('azure', group(charge('rapier'), 'argent', { count: 2, arrangement: 'crossed' }))],
  ['attr-vols-three', arms('gules', group(charge('vol'), 'argent', { count: 3 }))],
  ['attr-lion-maintaining-goblet', arms('azure', group(charge('lion', { posture: 'rampant', holds: [{ how: 'maintaining', item: charge('goblet'), paint: 'or' }] }), 'argent'))],
  ['attr-lion-maintaining-sword-proper', arms('azure', group(charge('lion', { holds: [{ how: 'maintaining', item: charge('sword'), paint: 'proper' }] }), 'or'))],
  ['attr-eagle-maintaining-latin-cross', arms('vert', group(charge('eagle', { holds: [{ how: 'maintaining', item: charge('cross-latin'), paint: 'or' }] }), 'argent'))],
  ['attr-raven-roundel-in-beak', arms('argent', group(charge('raven', { holds: [{ how: 'in-beak', item: charge('roundel'), paint: 'gules' }] }), 'sable'))],
  ['attr-lion-maintaining-thistle', arms('gules', group(charge('lion', { posture: 'rampant', holds: [{ how: 'maintaining', item: charge('thistle'), paint: 'or' }] }), 'argent'))],
];

export const PAINT_CASE_DESIGNS: ReadonlyArray<{ name: string; design: Design }> = [...PAINT_CASES, ...GEOMETRY_CASES, ...ORDINARY_LINE_CASES, ...TREATMENT_CASES, ...OUTLINE_CASES, ...PERIPHERAL_CASES, ...MORE_SHAPE_CASES, ...DIMINUTIVE_CASES, ...CHARGE_ATTRIBUTE_CASES].map(([name, input]) => ({ name, design: nd(input) }));

/** The drawings the reviews fixed (U-3, U-5, U-6, K-22; the cotises of a couped band couped with it), each pinned in the shape it was worst in. */
const REVIEW_VISUAL_CASES: ReadonlyArray<[string, unknown, FieldShape]> = [
  ['review-grady-bordure', band('bordure', { a: 'grady' }), 'heater'],
  ['review-potenty-bordure', band('bordure', { a: 'potenty' }), 'round'],
  ['review-indented-canton', arms('or', group(ordinary('canton', { lines: { a: 'indented' } }), 'azure')), 'lozenge'],
  ['review-embattled-canton', arms('argent', group(ordinary('canton', { lines: { a: 'embattled' } }), 'azure')), 'round'],
  ['review-indented-cross', band('cross', { a: 'indented', b: 'indented' }), 'banner'],
  ['review-couped-dovetailed-saltire', treatedBand('saltire', ['couped'], { lines: { a: 'dovetailed' } }), 'heater'],
  ['review-couped-doubly-cotised-bend', treatedBand('bend', ['couped'], cotised(2)), 'heater'],
  ['review-couped-cotised-wavy-saltire', treatedBand('saltire', ['couped'], cotised(1, 'wavy')), 'round'],
];

/** The generated designs, each keyed by its canonical JSON (the generators may yield one design twice: it is pinned once). */
function generated(kind: string, designs: readonly Design[]): GoldenShield[] {
  const byKey = new Map(designs.map((design) => [`${kind}-${hash(canonicalJson(design))}`, design]));
  return [...byKey].map(([key, design]) => ({ key, design, shape: shapeFor(key), hatchings: HATCHINGS }));
}

/** The charge cases of the charges after the first 36 (phase D on), pinned plain only: their hatching is the one the 36 already pin. */
const PLAIN_ONLY_CASES: ReadonlySet<string> = new Set(CHARGE_IDS.slice(36).map((id) => `charge-${id}`));

export function goldenShields(): GoldenShield[] {
  return [
    ...EXAMPLE_DESIGNS.map((p): GoldenShield => ({ key: `example-${p.id}`, design: p.design, shape: 'heater', hatchings: HATCHINGS })),
    ...(sample as unknown as SampleFile).entries.map((e): GoldenShield => ({ key: `sample-${e.id}`, design: e.design as Design, shape: e.shape, hatchings: HATCHINGS })),
    ...PAINT_CASE_DESIGNS.map(({ name, design }): GoldenShield => ({ key: `case-${name}`, design, shape: shapeFor(name), hatchings: PLAIN_ONLY_CASES.has(name) ? ['plain'] : HATCHINGS })),
    ...REVIEW_VISUAL_CASES.map(([name, input, shape]): GoldenShield => ({ key: `case-${name}`, design: nd(input), shape, hatchings: HATCHINGS })),
    ...generated('level0', generatedDesigns(1, 300)),
    ...generated('rich', generatedRichDesigns(1, 100)),
  ];
}

/** The markup with the per-instance id fragment and the attributes that only describe the fills to the SCA render check removed. */
const comparable = (svg: string) => svg.replace(/(hatch|hatch-tile|hatch-mask|region-clip|charge-clip|void-mask|art-clip|shield-clip|pattern)-s\d+/g, '$1-sN').replace(/ data-(?:paint|charge-tincture)="[^"]*"/g, '');

/** A shield's golden key: its own, then its shape and hatching. */
export const renderKey = (s: GoldenShield, hatching: Hatching) => `${s.key}|${s.shape}|${hatching}`;

/** The shields whose hatched render pins their shapes more than their paint: the generated designs and the charge and diminutive cases. */
const SHAPE_PINS = /^(level0-|rich-|case-charge-|case-dim-)/;

/** Whether `npm test` works out a golden key this run: every plain render and every other hatched one, a rotating third of these hatched (SCA_FULL=1: all). */
export const inRenderSample = (key: string): boolean => !(key.endsWith('|hatched') && SHAPE_PINS.test(key)) || rotatesIn(key, 1 / 3);

export function goldenRenders(shields: readonly GoldenShield[], inSample: (key: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of shields) {
    for (const hatching of s.hatchings) {
      if (!inSample(renderKey(s, hatching))) continue;
      out[renderKey(s, hatching)] = hash(comparable(renderToString(h(Shield, { design: s.design, shape: s.shape, hatching: hatching === 'hatched', size: 200 }))));
    }
  }
  return out;
}

/** What a key draws, for a report: its blazon. */
export function describeRender(shields: readonly GoldenShield[]): (key: string) => string {
  const byKey = new Map(shields.map((s) => [s.key, s]));
  return (key) => {
    const s = byKey.get(key.split('|')[0]);
    return s ? blazon(s.design) : '(no longer pinned)';
  };
}
