// Parts and details drawn as pieces (PLAN-D §0.3.5, §1.4 M11–M16; art batch A3): crowned and collared, winged, enflamed, slipped and leaved.
// Which charges and drawings take them, where each piece is placed and how the charge makes room for it, how the shield draws them (and the
// render check sees them), their words and signature, and how conflict and the rule of tincture treat them.

import { describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, OVERLAY_PIECES, bboxOf, blazon, chargeOnBox, chargePath, differences, gloss, overlaidArt, pathRings, readability, signature,
  unsupportedIssues, validate, type ArtKey, type Charge, type Design,
} from '../src/lib/heraldry';
import { arms, charge, group, nd } from './helpers';
import { checkRendered, renderShieldSvg } from './sca/widget-checks';

const lone = (item: object, paint = 'or', field: unknown = 'azure', extra: object = {}) => nd(arms(field, group(item, paint, extra)));
const crowned = (paint: string) => ({ part: 'crowned', paint });
const collared = (paint: string) => ({ part: 'collared', paint });
const mod = (id: string, paint: string) => ({ id, paint });
const gaps = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
const changes = (a: Design, b: Design) => differences(a, b).map((x) => `${x.attr}:${x.kind}:${x.rule}`);
const item = (d: Design): Charge => {
  const it = d.groups[0].item;
  if (it.k !== 'charge') throw new Error('not a charge');
  return it;
};
const pieces = (d: Design) => overlaidArt(item(d)).overlays.map((o) => `${o.part}${o.under ? ' under' : ' over'}`);
const inBox = (d: string) => { const b = bboxOf(pathRings(d).flat()); return b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 100 && b.y1 <= 100; };
const withPart = (part: string) => CHARGE_IDS.filter((id) => (CHARGES[id].parts as readonly string[]).includes(part));
const withDetail = (detail: string) => CHARGE_IDS.filter((id) => (CHARGES[id].details as readonly string[]).includes(detail));

describe('parts and details drawn as pieces (PLAN-D §0.3.5, §1.4)', () => {
  it('are taken by the charges art batch A3 anchored: crowned only animate charges (M11), winged the A3 list, enflamed and slipped as planned', () => {
    expect(withPart('crowned')).toEqual(['lion', 'wolf', 'boar', 'stag', 'fish', 'unicorn', 'dragon', 'eagle', 'owl', 'cat']);
    expect(withPart('collared')).toEqual(['lion', 'wolf', 'boar', 'stag', 'goat', 'hare', 'unicorn', 'dragon', 'cat', 'bear', 'horse']);
    expect(withDetail('winged')).toEqual(['lion', 'wolf', 'boar', 'stag', 'goat', 'hare', 'unicorn', 'heart']);
    expect(withDetail('enflamed')).toEqual(['heart', 'sword', 'roundel']);
    expect(withDetail('slipped')).toEqual(['rose']);
    expect(CHARGE_IDS.filter((id) => CHARGES[id].pairedWings)).toEqual(['heart']);
    // the overlay pieces are not charges
    for (const piece of Object.keys(OVERLAY_PIECES)) expect(CHARGE_IDS as readonly string[]).not.toContain(`piece-${piece}`);
  });

  it('are drawn in a tincture where the drawing has the anchor, else stay gaps (M11, M15)', () => {
    for (const d of [
      lone(charge('lion', { parts: [crowned('gules')] })), lone(charge('wolf', { form: 'head', parts: [collared('or')] }), 'argent'),
      lone(charge('heart', { mods: [mod('winged', 'or')] }), 'gules', 'argent'), lone(charge('heart', { mods: [mod('enflamed', 'proper')] }), 'gules', 'argent'),
      lone(charge('sword', { mods: [mod('enflamed', 'gules')] }), 'argent'), lone(charge('rose', { mods: [mod('slipped', 'vert'), mod('leaved', 'vert')] }), 'gules', 'argent'),
      lone(charge('lion', { posture: 'passant', mods: [mod('winged', 'argent')] })),
    ]) expect(gaps(d), blazon(d)).toEqual([]);
    expect(gaps(lone(charge('mullet', { parts: [crowned('gules')] })))).toEqual(['charge-modifier:crowned']);
    expect(gaps(lone(charge('heart', { parts: [crowned('or')] }), 'gules'))).toEqual(['charge-modifier:crowned']);
    expect(gaps(lone(charge('lion', { parts: [{ part: 'armed', paint: 'gules' }] })))).toEqual(['charge-modifier:armed']);
    expect(gaps(lone(charge('lion', { posture: 'sejant', mods: [mod('winged', 'argent')] })))).toEqual(['charge-modifier:winged']);
    expect(gaps(lone(charge('lion', { form: 'demi', parts: [crowned('gules')] })))).toEqual(['charge-modifier:crowned']);
    expect(gaps(lone(charge('rose', { mods: [mod('leaved', 'vert')] })))).toEqual(['charge-modifier:leaved']);
    expect(gaps(lone(charge('rose', { mods: ['slipped'] })))).toEqual(['charge-modifier:slipped']);
    expect(gaps(lone(charge('heart', { mods: [mod('winged', 'proper')] }), 'gules'))).toEqual(['charge-modifier:winged']);
  });

  it('place wings, flames and slips under the charge and a collar and a crown over it', () => {
    expect(pieces(lone(charge('lion', { parts: [crowned('gules'), collared('or')], mods: [mod('winged', 'argent')] })))).toEqual(['wings under', 'collar over', 'crown over']);
    expect(pieces(lone(charge('rose', { mods: [mod('slipped', 'vert'), mod('leaved', 'vert')] })))).toEqual(['slip under', 'leaves under']);
    expect(pieces(lone(charge('roundel', { mods: [mod('enflamed', 'proper')] })))).toEqual(['flames under']);
  });

  it('keep a crowned or collared charge\'s drawing and on-box: no crown or collar moves it', () => {
    for (const id of CHARGE_IDS) {
      for (const [key, meta] of Object.entries(CHARGES[id].drawings) as Array<[ArtKey, { anchors: Record<string, unknown> }]>) {
        const parts = [...('crown' in meta.anchors && withPart('crowned').includes(id) ? [crowned('gules')] : []), ...('collar' in meta.anchors ? [collared('gules')] : [])];
        if (parts.length === 0) continue;
        const [posture, gaze] = key === 'head' || key === '_' ? [null, null] : key.split('~');
        const c = item(lone(charge(id, { ...(key === 'head' ? { form: 'head' } : { posture }), ...(gaze ? { gaze } : {}), parts })));
        expect(overlaidArt(c).art, `${id} ${key}`).toBe(chargePath(c));
        expect(overlaidArt(c).overlays.length, `${id} ${key}`).toBe(parts.length);
      }
    }
    const d = nd(arms('azure', group(charge('lion', { parts: [crowned('gules')] }), 'or', { charged: [group(charge('mullet'), 'gules')] })));
    expect(gaps(d)).toEqual([]);
    expect(chargeOnBox(item(d))).toEqual(CHARGES.lion.drawings.rampant!.onBox);
  });

  it('draw a heart winged with a pair, one the mirror of the other, and shrink a charge whose pieces under it reach out of the box', () => {
    const heart = overlaidArt(item(lone(charge('heart', { mods: [mod('winged', 'or')] }), 'gules')));
    const pts = pathRings(heart.overlays[0].d).flat().map(([x, y]) => `${Math.round(x)},${Math.round(y)}`);
    const mirrored = pathRings(heart.overlays[0].d).flat().map(([x, y]) => `${Math.round(100 - x)},${Math.round(y)}`);
    expect(new Set(mirrored).size).toBeGreaterThan(20);
    expect([...new Set(mirrored)].filter((p) => !new Set(pts).has(p)).length).toBeLessThan(pts.length / 10);
    for (const c of [
      charge('heart', { mods: [mod('winged', 'or')] }), charge('heart', { mods: [mod('enflamed', 'proper')] }), charge('roundel', { mods: [mod('enflamed', 'or')] }),
      charge('rose', { mods: [mod('slipped', 'vert'), mod('leaved', 'vert')] }), charge('lion', { mods: [mod('winged', 'or')] }),
    ]) {
      const drawn = overlaidArt(item(lone(c)));
      for (const d of [drawn.art, ...drawn.overlays.map((o) => o.d)]) expect(inBox(d), JSON.stringify(c)).toBe(true);
    }
    expect(heart.art).not.toBe(chargePath(item(lone(charge('heart')))));
  });

  it('are drawn by the shield and seen by the render check, which refuses a piece left out or put on the wrong side', () => {
    const designs = [
      lone(charge('lion', { parts: [crowned('gules'), collared('argent')] })), lone(charge('wolf', { form: 'head', parts: [collared('or')] }), 'argent'),
      lone(charge('lion', { mods: [mod('winged', 'argent')] }), 'or', 'azure', { count: 2, arrangement: { k: 'pair', pair: 'combattant' } }),
      lone(charge('heart', { mods: [mod('winged', 'or')] }), 'gules', 'argent', { count: 3 }), lone(charge('roundel', { mods: [mod('enflamed', 'proper')] }), 'azure', 'argent'),
      lone(charge('rose', { mods: [mod('slipped', 'vert'), mod('leaved', 'vert')] }), 'gules', 'argent'),
      nd(arms({ k: 'divided', division: 'per-pale', parts: ['argent', 'gules'] }, group(charge('lion', { parts: [crowned('or')] }), 'counterchanged'))),
    ];
    for (const d of designs) for (const hatching of [false, true]) expect(checkRendered(d, renderShieldSvg(d, { hatching })), blazon(d)).toEqual([]);
    const svg = renderShieldSvg(designs[0]);
    expect(svg).toMatch(/<clipPath id="art-clip-[^"]+"><path d="M/);
    expect(checkRendered(designs[0], renderShieldSvg(lone(charge('lion', { parts: [collared('argent')] }))))).toEqual([expect.stringMatching(/pieces of the charges at 0 are drawn collar, expected collar crown/)]);
    const crownFirst = svg.replace(/(<g data-layer="charges"[^>]*>)([\s\S]*)(<path[^>]*data-overlay="crown"[^>]*><\/path>)/, '$1$3$2');
    expect(checkRendered(designs[0], crownFirst)).toEqual([expect.stringMatching(/not drawn on their side of them/)]);
    expect(checkRendered(designs[0], svg.replace(/ clip-path="url\(#art-clip-[^"]+\)"/, ''))).toEqual([expect.stringMatching(/collar of the charges at 0 is not clipped/)]);
  });

  it('are worded after the charge\'s tincture, a piece of its tincture leaving it unsaid; glossed as they look; signed', () => {
    expect(blazon(lone(charge('lion', { parts: [crowned('gules')] })))).toBe('Azure, a lion Or crowned gules.');
    expect(blazon(lone(charge('lion', { parts: [crowned('or')] })))).toBe('Azure, a lion crowned Or.');
    expect(blazon(lone(charge('lion', { parts: [crowned('gules'), collared('gules')] }), 'argent'))).toBe('Azure, a lion argent crowned and collared gules.');
    expect(blazon(lone(charge('rose', { mods: [mod('slipped', 'vert'), mod('leaved', 'vert')] }), 'gules', 'argent', { count: 3 }))).toBe('Argent, three roses gules slipped and leaved vert.');
    expect(blazon(lone(charge('heart', { mods: [mod('winged', 'or')] }), 'or', 'gules'))).toBe('Gules, a heart winged Or.');
    expect(blazon(lone(charge('heart', { mods: [mod('enflamed', 'proper')] }), 'gules', 'argent'))).toBe('Argent, a heart gules enflamed proper.');
    expect(blazon(lone(charge('wolf', { form: 'head', parts: [collared('or')] }), 'argent', 'vert'))).toBe('Vert, a wolf\'s head couped argent collared Or.');
    expect(gloss(lone(charge('lion', { parts: [crowned('gules')] })))).toMatch(/gold lion rearing up, wearing a red crown/);
    expect(gloss(lone(charge('rose', { mods: [mod('slipped', 'vert'), mod('leaved', 'vert')] }), 'gules', 'argent'))).toMatch(/red rose, on a green stem, with green leaves/);
    expect(gloss(lone(charge('heart', { mods: [mod('enflamed', 'proper')] }), 'gules', 'argent'))).toMatch(/red heart, in flames/);
    expect(signature(lone(charge('lion', { parts: [crowned('gules')] })))).toBe('arms|az|P:c.lion.rampant~part-crowned(gu):1:single:or');
    expect(signature(lone(charge('heart', { mods: [mod('winged', 'or')] }), 'gules'))).toBe('arms|az|P:c.heart+winged(or):1:single:gu');
    const detail = (d: Design) => readability(d).breakdown.find((b) => b.factor === 'detail')!.points;
    expect(detail(lone(charge('heart', { mods: [mod('winged', 'or')] }), 'gules'))).toBe(detail(lone(charge('heart'), 'gules')) + 1);
  });

  it('count for conflict as SENA says: a crown, flames, a slip nothing (M11, M14), a collar on a head and wings a distinct change (M12, M13)', () => {
    const same = (a: object, b: object, paint = 'or') => changes(lone(a, paint), lone(b, paint));
    expect(same(charge('lion'), charge('lion', { parts: [crowned('gules')] }))).toEqual([]);
    expect(same(charge('lion'), charge('lion', { parts: [collared('gules')] }))).toEqual([]);
    expect(same(charge('rose'), charge('rose', { mods: [mod('slipped', 'vert'), mod('leaved', 'vert')] }), 'gules')).toEqual([]);
    expect(same(charge('heart'), charge('heart', { mods: [mod('enflamed', 'proper')] }), 'gules')).toEqual([]);
    expect(same(charge('wolf', { form: 'head' }), charge('wolf', { form: 'head', parts: [collared('gules')] }))).toEqual(['type:dc:A5G4']);
    expect(same(charge('heart'), charge('heart', { mods: [mod('winged', 'argent')] }), 'gules')).toEqual(['type:dc:A5G4']);
    expect(same(charge('lion'), charge('lion', { mods: [mod('winged', 'argent')] }))).toEqual(['type:dc:A5G4']);
  });

  it('are exempt from the rule of tincture: crowns, collars, slips and flames are artistic detail (M16, herald question D9); wings are not judged either', () => {
    const issues = (d: Design) => validate(d).filter((i) => i.code === 'tincture');
    for (const [paint, field, c] of [
      ['gules', 'argent', charge('lion', { parts: [crowned('argent'), collared('argent')] })], ['gules', 'argent', charge('heart', { mods: [mod('enflamed', 'argent')] })],
      ['gules', 'argent', charge('rose', { mods: [mod('slipped', 'argent'), mod('leaved', 'argent')] })], ['gules', 'argent', charge('heart', { mods: [mod('winged', 'argent')] })],
    ] as Array<[string, string, object]>) expect(issues(lone(c, paint, field)), JSON.stringify(c)).toEqual([]);
  });
});
