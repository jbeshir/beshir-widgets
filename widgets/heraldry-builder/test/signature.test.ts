// The canonical signature is the registry's UNIQUE key (PLAN-C §3.1): equal for equivalent canonical designs, different for
// different ones, and unchanged for every design phase B could draw, so stored rows keep their key. Lines of the field are
// written `~line` (`~a/b` for two different ones) after the division or variation and its pieces.

import { describe, expect, it } from 'vitest';
import { BUILDER_DIVISIONS, DIVISIONS, DRAWN_LINES, LINES, ORDINARY_TYPES, VARIATIONS, canonicalJson, lineAllowed, signature, type Design } from '../src/lib/heraldry';
import { ORDINARY_MODS } from '../src/lib/heraldry/ordinaries';
import { arms, charge, div, group, nd } from './helpers';
import { generatedGeometryDesigns, generatedRichDesigns } from './design-generator';
import { PINNED } from './signature-cases';

/** What each pinned design's signature was when phase B shipped. */
const PHASE_B: Record<string, string> = {
  'a lion': 'arms|az|P:c.lion.rampant:1:single:or',
  'per pale, a lion': 'arms|per-pale(ar,az)|P:c.lion.rampant:1:single:gu',
  'barry of four, a mullet': 'arms|barry4(or,sa)|P:c.mullet:1:single:ar',
  'paly, a rose': 'arms|paly6(ar,gu)|P:c.rose:1:single:or',
  'checky, a chief': 'arms|checky(az,or)|R:o.chief:1:single:gu',
  'a fess': 'arms|or|P:o.fess:1:single:gu',
  'a fess between three mullets': 'arms|az|P:o.fess:1:single:or|S>:c.mullet:3:host:ar',
  'a chief and a bordure': 'arms|ar|P:c.lion.rampant:1:single:sa|R:o.chief:1:single:gu|R:o.bordure:1:single:az',
  'on a pale three keys': 'arms|gu|P:o.pale:1:single:ar{T:c.key:3:host:sa}',
  'quarterly, roses counterchanged': 'arms|quarterly(or,gu)|P:c.rose:4:rows-2-2:cc',
  'per chevron, three crescents': 'arms|per-chevron(ar,vt)|P:c.crescent:3:rows-2-1:or',
  'per saltire, a heart': 'arms|per-saltire(or,az)|P:c.heart:1:single:gu',
  'ermine, a chief': 'arms|ermine|R:o.chief:1:single:gu',
  'a bend per pale': 'arms|or|P:o.bend:1:single:per-pale(az,gu)',
  'a fieldless rose': 'badge|P:c.rose:1:single:gu',
  'plain field, two wolves': 'arms|vt|P:c.wolf.passant:2:in-pale:ar',
};

const lion = (field: unknown) => nd(arms(field, group(charge('lion'), 'or')));

/** A field with every allowed line on every phase-B division (quarterly with each line alone too) and on the counted variations. */
function linedDesigns(): Design[] {
  const divided = BUILDER_DIVISIONS.flatMap((division) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'division', division }, l)).flatMap((line) => [
    { ...div(division, 'argent', 'azure'), lines: { a: line } },
    ...(division === 'quarterly' ? [{ ...div(division, 'argent', 'azure'), lines: { a: line, b: 'plain' } }, { ...div(division, 'argent', 'azure'), lines: { a: 'plain', b: line } }] : []),
  ]));
  const varied = (['barry', 'paly', 'bendy', 'bendy-sinister', 'chevronny'] as const).flatMap((variation) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'variation', variation }, l))
    .flatMap((line) => [4, 6, 8].map((pieces) => ({ k: 'variation', variation, pieces, lines: { a: line }, parts: ['argent', 'azure'] }))));
  return [...divided, ...varied].map(lion);
}

describe('the signature', () => {
  it('designs phase B could draw keep their signatures', () => {
    expect(PINNED.map(([name]) => name).sort()).toEqual(Object.keys(PHASE_B).sort());
    for (const [name, input] of PINNED) expect(signature(nd(input)), name).toBe(PHASE_B[name]);
  });

  it('writes the lines of the field after the division or variation', () => {
    expect(signature(lion({ ...div('per-pale', 'argent', 'azure'), lines: { a: 'wavy' } }))).toBe('arms|per-pale~wavy(ar,az)|P:c.lion.rampant:1:single:or');
    expect(signature(lion({ ...div('quarterly', 'argent', 'azure'), lines: { a: 'plain', b: 'embattled' } }))).toBe('arms|quarterly~plain/embattled(ar,az)|P:c.lion.rampant:1:single:or');
    expect(signature(lion({ k: 'variation', variation: 'barry', pieces: 8, lines: { a: 'wavy' }, parts: ['argent', 'azure'] }))).toBe('arms|barry8~wavy(ar,az)|P:c.lion.rampant:1:single:or');
  });

  it('different canonical designs never share a signature; equal ones always do', () => {
    const designs = [...PINNED.map(([, input]) => nd(input)), ...linedDesigns(), ...generatedRichDesigns(808, 300), ...generatedGeometryDesigns(808, 150)];
    const bySignature = new Map<string, Design>();
    // Beyond four pieces a variation's tinctures may be either way round (A5G1a): the one way two canonical designs share a signature.
    const swapped = (d: Design): string => canonicalJson(d.kind === 'arms' && d.field.k === 'variation' ? { ...d, field: { ...d.field, parts: [d.field.parts[1], d.field.parts[0]] } } : d);
    for (const d of designs) {
      const json = canonicalJson(d), sig = signature(d);
      const seen = bySignature.get(sig);
      if (seen !== undefined && canonicalJson(seen) !== json) expect(swapped(seen), `${sig}\n${canonicalJson(seen)}\n${json}`).toBe(json);
      bySignature.set(sig, d);
      // A design read back from its canonical form keeps its signature.
      expect(signature(nd(JSON.parse(json)))).toBe(sig);
    }
    expect(new Set(linedDesigns().map(signature)).size).toBe(linedDesigns().length);
  });

  it('every id ends in a letter, so a piece count or a separator after it reads unambiguously', () => {
    for (const id of [...LINES, ...ORDINARY_TYPES, ...DIVISIONS, ...VARIATIONS, ...ORDINARY_MODS]) expect(id).toMatch(/^[a-z][a-z0-9-]*[a-z]$/);
  });
});
