// Every shield the golden pins, with hatching off and on, reduced to a short hash of its markup, so a refactor of how paint is drawn
// is provably neutral. The fixture is test/fixtures/render-golden.json; `GOLDEN_REASON="…" npm run golden:write` regenerates it.
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
import { arms, charge, div, group, nd, ordinary } from './helpers';
import type { SampleFile } from './sample-registry';

export interface GoldenShield { key: string; design: Design; shape: FieldShape }

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
  ['div-per-chevron-throughout', arms(div('per-chevron-throughout', 'argent', 'gules'))],
  ...[6, 8, 12].map((n): [string, unknown] => [`div-gyronny-${n}`, arms({ ...div('gyronny', 'or', 'purpure'), pieces: n })]),
  ['div-gyronny-arrondi', arms({ ...div('gyronny', 'argent', 'gules'), pieces: 8, lines: { a: 'arrondi' } })],
  ['line-embattled-per-chevron-inverted', arms(lined('per-chevron-inverted', 'embattled', 'argent', 'sable'))],
];

const band = (type: string, lines: object) => arms('azure', group(ordinary(type, { lines }), 'or'));

/** The lines of the ordinaries: every line a fess takes (a band's bare meaning of it), wavy on each other ordinary, both edges and the lower edge alone. */
const ORDINARY_LINE_CASES: ReadonlyArray<[string, unknown]> = [
  ...DRAWN_LINES.filter((l) => lineAllowed({ k: 'ordinary', type: 'fess', inverted: false }, l)).map((l): [string, unknown] => [`line-${l}-fess`, band('fess', l === 'embattled' ? { a: l } : { a: l, b: l })]),
  ...['pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'chief', 'bordure'].map((t): [string, unknown] => [`line-wavy-${t}`, band(t, { a: 'wavy', b: 'wavy' })]),
  ['line-embattled-counter-embattled-fess', band('fess', { a: 'embattled', b: 'embattled' })],
  ['line-bretessed-fess', band('fess', { a: 'bretessed', b: 'bretessed' })],
  ['line-embattled-lower-chevron', band('chevron', { a: 'plain', b: 'embattled' })],
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
  ['dim-bars-wavy-3', arms('azure', group(ordinary('bar', { lines: { a: 'wavy' } }), 'argent', { count: 3 }))],
];

export const PAINT_CASE_DESIGNS: ReadonlyArray<{ name: string; design: Design }> = [...PAINT_CASES, ...GEOMETRY_CASES, ...ORDINARY_LINE_CASES, ...TREATMENT_CASES, ...OUTLINE_CASES, ...PERIPHERAL_CASES, ...MORE_SHAPE_CASES, ...DIMINUTIVE_CASES].map(([name, input]) => ({ name, design: nd(input) }));

/** The generated designs, each keyed by its canonical JSON (the generators may yield one design twice: it is pinned once). */
function generated(kind: string, designs: readonly Design[]): GoldenShield[] {
  const byKey = new Map(designs.map((design) => [`${kind}-${hash(canonicalJson(design))}`, design]));
  return [...byKey].map(([key, design]) => ({ key, design, shape: shapeFor(key) }));
}

export function goldenShields(): GoldenShield[] {
  return [
    ...EXAMPLE_DESIGNS.map((p): GoldenShield => ({ key: `example-${p.id}`, design: p.design, shape: 'heater' })),
    ...(sample as unknown as SampleFile).entries.map((e): GoldenShield => ({ key: `sample-${e.id}`, design: e.design as Design, shape: e.shape })),
    ...PAINT_CASE_DESIGNS.map(({ name, design }): GoldenShield => ({ key: `case-${name}`, design, shape: shapeFor(name) })),
    ...generated('level0', generatedDesigns(1, 300)),
    ...generated('rich', generatedRichDesigns(1, 100)),
  ];
}

/** The markup with the per-instance id fragment and the attributes that only describe the fills to the SCA render check removed. */
const comparable = (svg: string) => svg.replace(/(hatch|hatch-tile|hatch-mask|region-clip|charge-clip|shield-clip|pattern)-s\d+/g, '$1-sN').replace(/ data-(?:paint|charge-tincture)="[^"]*"/g, '');

export const HATCHINGS = ['plain', 'hatched'] as const;

/** A shield's golden key: its own, then its shape and hatching. */
export const renderKey = (s: GoldenShield, hatching: (typeof HATCHINGS)[number]) => `${s.key}|${s.shape}|${hatching}`;

export function goldenRenders(shields: readonly GoldenShield[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of shields) {
    for (const hatching of HATCHINGS) {
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
