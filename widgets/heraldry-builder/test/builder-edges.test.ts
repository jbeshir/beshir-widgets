// Brief item 5, reachability of the edge controls: from a valid level-0 design, for every drawn line on every drawn division, counted variation,
// ordinary, and a chief or bordure beside a band, the edge row offers the line, allows it exactly when some tincture makes the design pass the
// library's own legality (supported, the structure rules, the rule of tincture — the oracle never reads the option helpers), and choosing it
// gives that design. The edge survives a change of division or band that takes it; the shape toggles, outlines and counts of each band
// are held to the same oracle. The heater is exhaustive, every other shape takes a rotating quarter of the pairs (and draws the result).

import { describe, expect, it } from 'vitest';
import {
  DRAWN_DIVISIONS, DRAWN_LINES, DRAWN_ORDINARIES, ORDINARY_COUNTS, REFUSED_ORDINARIES, isCountedVariation, FIELD_SHAPES, LINED_VARIATIONS, VARIATION_PIECES, addLayer, groupAt, lineAllowed, lineChoices, outlineChoices,
  ordinaryCountChoices, partCount, pathOfPlace, renderLayers, resolve, structuralIssues, tinctureIssues, toggleChoices, unsupportedIssues,
  type Design, type FieldShape, type GroupPath, type Line, type Outline, type ShapeToggle,
} from '../src/lib/heraldry';
import { ordinaryPath, setDivision, setFieldLine, setOrdinary, setOrdinaryLine, setOrdinaryNumber, setOrdinaryOutline, setOrdinaryToggle } from '../src/lib/builder';
import { log, nd } from './helpers';

// ── The oracle ──────────────────────────────────────────────────────────────

/** The tinctures tried for "some tincture": a metal and a colour in both orders, then the rest against azure. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['azure', 'or'], ['or', 'azure'], ['gules', 'argent'], ['argent', 'gules'], ['sable', 'or'], ['vert', 'argent'], ['purpure', 'or'],
];

const legal = (d: Design) => unsupportedIssues(d).length === 0 && structuralIssues(d).length === 0 && tinctureIssues(d).length === 0;
const sound = (d: Design) => unsupportedIssues(d).length === 0 && structuralIssues(d).length === 0;

/** A loose design: `field` takes the pair's first tincture or the tinctures themselves, the `band` the second. */
type Make = (pair: readonly [string, string], lines: { a: Line; b: Line }) => unknown;

/** The ways a line can sit on a host's edges: as a blazon bares it, on both, on the other edge. */
const arrangements = (line: Line) => [{ a: line, b: 'plain' as const }, { a: line, b: line }, { a: 'plain' as const, b: line }];

interface Host {
  name: string;
  /** The loose design with these tinctures and lines. */
  make: Make;
  /** Where the edge controls are read: the field, or the group. */
  at: (d: Design) => { k: 'field' } | { k: 'group'; path: GroupPath };
  set: (d: Design, line: Line) => Design;
  /** The lines the design at hand carries. */
  linesOf: (d: Design) => { a: Line; b: Line };
}

const band = (type: string, extra: object = {}, count = 1): Make => ([f, p], lines) => ({
  v: 2, field: f, groups: [{ item: { k: 'ordinary', type, lines, ...extra }, paint: p, ...(count > 1 ? { count } : {}) }],
});

/** A plain fess with a chief or bordure beside it, the layer carrying the lines. */
const beside = (type: 'chief' | 'bordure'): Make => ([f, p], lines) => ({
  v: 2, field: f, groups: [{ item: { k: 'ordinary', type: 'fess' }, paint: p }, { item: { k: 'ordinary', type, lines }, paint: p }],
});

const groupHost = (name: string, make: Make, place: 'primary' | 'chief' | 'bordure'): Host => {
  const pathOf = (d: Design): GroupPath => {
    const path = place === 'primary' ? ordinaryPath(d) : pathOfPlace(d, place);
    if (!path) throw new Error(`${name}: no ${place}`);
    return path;
  };
  return {
    name, make, at: (d) => ({ k: 'group', path: pathOf(d) }), set: (d, line) => setOrdinaryLine(d, pathOf(d), line),
    linesOf: (d) => { const it = groupAt(d, pathOf(d)).item; return it.k === 'ordinary' ? it.lines : { a: 'plain', b: 'plain' }; },
  };
};

const fieldHost = (name: string, field: (pair: readonly [string, string], lines: { a: Line; b: Line }) => object): Host => ({
  name, make: (pair, lines) => ({ v: 2, field: field(pair, lines), groups: [] }), at: () => ({ k: 'field' }), set: setFieldLine,
  linesOf: (d) => (d.kind === 'arms' && (d.field.k === 'divided' || d.field.k === 'variation') ? d.field.lines : { a: 'plain', b: 'plain' }),
});

const THIRD = 'gules';
/** The ordinaries a design can carry (the refused ones draw but never pass the structure rules). */
const HOST_ORDINARIES = DRAWN_ORDINARIES.filter((t) => !REFUSED_ORDINARIES.includes(t));
const HOSTS: Host[] = [
  ...DRAWN_DIVISIONS.map((division) =>
    fieldHost(`per ${division}`, ([a, b], lines) => ({ k: 'divided', division, parts: [a, b, THIRD].slice(0, partCount(division)), lines }))),
  ...LINED_VARIATIONS.flatMap((variation) =>
    (isCountedVariation(variation) ? VARIATION_PIECES : [null]).map((pieces) => fieldHost(`${variation} of ${pieces}`, ([a, b], lines) => ({ k: 'variation', variation, pieces, parts: [a, b], lines })))),
  ...HOST_ORDINARIES.filter((type) => type !== 'chief' && type !== 'bordure').map((type) => groupHost(`a ${type}`, band(type), 'primary')),
  groupHost('a chief', band('chief'), 'primary'),
  groupHost('a bordure', band('bordure'), 'primary'),
  groupHost('a chief beside a fess', beside('chief'), 'chief'),
  groupHost('a bordure beside a fess', beside('bordure'), 'bordure'),
];

/** The lines `host` may carry with some tincture, as arrangements: those that pass the oracle. */
function legalArrangements(host: Host, line: Line): Array<{ a: Line; b: Line }> {
  return arrangements(line).filter((lines) => PAIRS.some((pair) => {
    const r = resolve(host.make(pair, lines) as never);
    return r.ok && legal(r.design);
  }));
}

/** A valid level-0 design for the host to start from, or null when none exists. */
function start(host: Host): Design | null {
  for (const pair of PAIRS) {
    const r = resolve(host.make(pair, { a: 'plain', b: 'plain' }) as never);
    if (r.ok && legal(r.design)) return r.design;
  }
  return null;
}

const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

// ── The sweep ───────────────────────────────────────────────────────────────

/** Whether pair number `n` is drawn on the shape: every one on the heater, a rotating quarter on the rest. */
const drawnOn = (shape: FieldShape, n: number) => shape === 'heater' || (n + FIELD_SHAPES.indexOf(shape)) % 4 === 0;

describe('the edge row offers exactly the lines some tincture makes legal', () => {
  it('on every host, for every drawn line, and choosing one gives a design the oracle accepts', () => {
    let pairs = 0, offered = 0, refused = 0, drawn = 0;
    const missing: string[] = [], wrong: string[] = [];
    for (const host of HOSTS) {
      const base = start(host);
      expect(base, `${host.name} has a legal level-0 design`).not.toBeNull();
      if (!base) continue;
      const choices = lineChoices(base, host.at(base));
      for (const line of DRAWN_LINES) {
        const n = pairs++;
        const choice = choices.find((c) => c.value === line);
        const ok = legalArrangements(host, line);
        // A line some tincture allows is offered, and offered lines are those the host may carry at all
        if (ok.length > 0 && !choice) { missing.push(`${host.name} ${line}`); continue; }
        if (!choice) { refused++; continue; }
        offered++;
        const chosen = host.set(base, line);
        if (choice.allowed) {
          // allowed ⇒ the choice is a design the oracle accepts at some tincture, with the line on one of the arrangements
          if (!sound(chosen) || !ok.some((l) => same(l, host.linesOf(chosen)))) wrong.push(`${host.name} ${line}: allowed but ${JSON.stringify(host.linesOf(chosen))} ${[...structuralIssues(chosen), ...unsupportedIssues(chosen)].map((i) => i.message).join('; ')}`);
        } else if (ok.length > 0 && same(host.linesOf(chosen), ok[0]) && sound(chosen)) {
          // blocked although the line is legal with the tinctures at hand and the rules of the host accept it: only the tincture can be why
          if (tinctureIssues(chosen).length === 0) wrong.push(`${host.name} ${line}: blocked (${choice.reason}) but the design is legal`);
        }
        for (const shape of FIELD_SHAPES) {
          if (!choice.allowed || !drawnOn(shape, n)) continue;
          drawn++;
          expect(() => renderLayers(chosen, shape), `${host.name} ${line} on ${shape}`).not.toThrow();
        }
      }
    }
    log(`${pairs} host × line pairs: ${offered} offered, ${refused} not offered, ${drawn} drawn`);
    expect(missing).toEqual([]);
    expect(wrong).toEqual([]);
    expect(offered).toBeGreaterThan(150);
  });

  it('the lines a host may carry are those its own table allows', () => {
    // The row is the library's lineAllowed on the host, in the host's own words (a spot check of the oracle's other end).
    const fess = nd(band('fess')(['azure', 'or'], { a: 'plain', b: 'plain' }));
    const row = lineChoices(fess, { k: 'group', path: ordinaryPath(fess)! }).map((c) => c.value);
    expect(row).toEqual(['plain', ...DRAWN_LINES.filter((l) => lineAllowed({ k: 'ordinary', type: 'fess', inverted: false }, l))]);
  });
});

describe('an edge survives a change of division or band that takes it', () => {
  it('keeps the line on the divisions that carry it and drops it on the rest', () => {
    for (const line of ['wavy', 'embattled', 'engrailed'] as const) {
      const wavy = setFieldLine(nd({ v: 2, field: { k: 'divided', division: 'per-pale', parts: ['or', 'azure'] }, groups: [] }), line);
      for (const division of DRAWN_DIVISIONS) {
        const moved = setDivision(wavy, division);
        if (moved.kind !== 'arms' || moved.field.k !== 'divided') continue;
        const takes = lineAllowed({ k: 'division', division }, line);
        expect(moved.field.lines.a === line || moved.field.lines.b === line, `${line} on ${division}`).toBe(takes);
      }
    }
  });

  it('keeps the line on the bands that carry it', () => {
    const fess = nd(band('fess')(['azure', 'or'], { a: 'plain', b: 'plain' }));
    for (const line of ['wavy', 'embattled', 'dancetty'] as const) {
      const lined = setOrdinaryLine(fess, ordinaryPath(fess)!, line);
      for (const type of DRAWN_ORDINARIES) {
        const moved = setOrdinary(lined, type);
        const path = ordinaryPath(moved);
        const item = path && groupAt(moved, path).item;
        if (!item || item.k !== 'ordinary' || item.type !== type) continue;
        const takes = lineAllowed({ k: 'ordinary', type, inverted: false }, line);
        expect(item.lines.a === line || item.lines.b === line, `${line} on ${type}`).toBe(takes);
      }
    }
  });
});

describe('the toggles, outlines and counts of a band are held to the same oracle', () => {
  const MODS: readonly ShapeToggle[] = ['inverted', 'couped', 'throughout', 'voided', 'sinister'];
  const OUTLINES: Readonly<Record<Outline, object>> = {
    none: {}, fimbriated: { fimbriated: 'argent' }, cotised: { cotised: { count: 1, paint: 'argent' } },
    'doubly-cotised': { cotised: { count: 2, paint: 'argent' } }, 'triply-cotised': { cotised: { count: 3, paint: 'argent' } },
  };

  const legalWith = (type: string, extra: object): boolean =>
    PAIRS.some((pair) => {
      const r = resolve(band(type, extra)(pair, { a: 'plain', b: 'plain' }) as never);
      return r.ok && legal(r.design);
    });

  it('offers a toggle exactly when some tincture makes it legal, and sets it', () => {
    const wrong: string[] = [];
    let offered = 0, hosts = 0;
    for (const type of HOST_ORDINARIES.filter((t) => t !== 'chief' && t !== 'bordure')) {
      const host = groupHost(`a ${type}`, band(type), 'primary');
      const base = start(host);
      if (!base) continue;
      hosts++;
      const path = ordinaryPath(base)!;
      for (const c of toggleChoices(base, path)) {
        if (!MODS.includes(c.value)) continue;
        offered++;
        const ok = legalWith(type, { mods: [c.value] });
        if (c.allowed !== ok) { wrong.push(`${type} ${c.value}: ${c.allowed ? 'allowed' : `blocked (${c.reason})`}, oracle ${ok}`); continue; }
        if (c.allowed) {
          const set = setOrdinaryToggle(base, ordinaryPath(base)!, c.value, true);
          if (!sound(set)) wrong.push(`${type} ${c.value}: chosen design is not sound`);
        }
      }
    }
    expect(hosts).toBeGreaterThan(25);
    expect(offered).toBeGreaterThan(30);
    expect(wrong).toEqual([]);
  });

  it('offers an outline exactly when some tincture makes it legal, and sets it', () => {
    const wrong: string[] = [];
    let offered = 0, hosts = 0;
    for (const type of HOST_ORDINARIES.filter((t) => t !== 'chief' && t !== 'bordure')) {
      const host = groupHost(`a ${type}`, band(type), 'primary');
      const base = start(host);
      if (!base) continue;
      hosts++;
      const path = ordinaryPath(base)!;
      for (const c of outlineChoices(base, path)) {
        if (c.value === 'none') continue;
        offered++;
        const ok = PAIRS.some((pair) => {
          const r = resolve(band(type, OUTLINES[c.value])(pair, { a: 'plain', b: 'plain' }) as never);
          return r.ok && legal(r.design);
        });
        if (c.allowed && !ok) wrong.push(`${type} ${c.value}: allowed, oracle refuses`);
        if (c.allowed) {
          const set = setOrdinaryOutline(base, path, c.value);
          if (!sound(set)) wrong.push(`${type} ${c.value}: chosen design is not sound`);
        }
        if (!c.allowed && ok) wrong.push(`${type} ${c.value}: blocked (${c.reason}), oracle accepts`);
      }
    }
    expect(hosts).toBeGreaterThan(25);
    expect(offered).toBeGreaterThan(50);
    expect(wrong).toEqual([]);
  });

  it('every count a band offers is a sound design with that count', () => {
    let hosts = 0, counts = 0;
    for (const type of HOST_ORDINARIES) {
      // bars, bendlets and the like, and a double tressure, are drawn more than once: one alone is its ordinary or an orle
      const host = groupHost(`a ${type}`, band(type, {}, ORDINARY_COUNTS[type]?.[0] ?? 1), 'primary');
      const base = start(host);
      if (!base) continue;
      hosts++;
      const path = ordinaryPath(base)!;
      for (const c of ordinaryCountChoices(base, path)) {
        counts++;
        const set = setOrdinaryNumber(base, path, c.value);
        expect(sound(set), `${type} ×${c.value}`).toBe(true);
        expect(groupAt(set, ordinaryPath(set)!).count, `${type} ×${c.value}`).toBe(c.value);
      }
    }
    expect(hosts).toBeGreaterThan(25);
    expect(counts).toBeGreaterThan(12);
  });
});

// A chief or bordure is only ever added beside a band: the layer helper must give the path the oracle reads.
describe('the layers the oracle edges', () => {
  it('a fess takes a chief and a bordure at once', () => {
    const fess = nd(band('fess')(['azure', 'or'], { a: 'plain', b: 'plain' }));
    const both = addLayer(addLayer(fess, 'chief'), 'bordure');
    expect(pathOfPlace(both, 'chief')).not.toBeNull();
    expect(pathOfPlace(both, 'bordure')).not.toBeNull();
  });
});
