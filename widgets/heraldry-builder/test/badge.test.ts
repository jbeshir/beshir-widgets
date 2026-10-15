// Fieldless badges: what is drawn, how it is blazoned and judged, how the builder offers it (and that it adds nothing to the
// default flow), and that the SCA records it unlocks are built.


import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Shield } from '../src/components/Shield';
import { DesignTab } from '../src/components/design/DesignTab';
import { FieldStep } from '../src/components/design/BuilderSteps';
import {
  CHARGE_IDS, CHARGES, assembleParts, chargeOnBox, badgeView, blazon, countChoices, deriveTags, gloss, layerChoices, layoutChoices, normalise, partsOf, placementChoices, placesOf, readability, renderLayers,
  signature, structuralIssues, tinctureIssues, unsupportedIssues,
  type Design,
} from '../src/lib/heraldry';
import { DEFAULT_DESIGN, assess, setBadge, setCharge, setDivision, setPlainField } from '../src/lib/builder';
import { builderPath } from './builder-path';
import { checkBlazon } from './sca/classify';
import { arms, charge, group, nd, ordinary } from './helpers';


const badge = (...groups: object[]) => ({ v: 2, kind: 'badge', groups });
const gaps = (d: unknown) => unsupportedIssues(nd(d)).map((i) => `${i.gap.category}:${i.gap.detail}`);
const rules = (d: unknown) => [...structuralIssues(nd(d)), ...tinctureIssues(nd(d))].map((i) => i.message);
const built = (d: unknown): Design => {
  const r = normalise(d);
  if (!r.ok) throw new Error(`not a valid design: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.design;
};


describe('what a badge is', () => {
  const CASES: Array<[string, object, string, string]> = [
    ['one charge', badge(group(charge('rose'), 'gules')), '(Fieldless) A rose gules.', 'No background: a red rose.'],
    ['a posed beast, divided', badge(group(charge('lion', { posture: 'passant' }), { k: 'divided', division: 'per-pale', parts: ['argent', 'gules'] })), '(Fieldless) A lion passant per pale argent and gules.',
      'No background: a lion walking split vertically, white on the left and red on the right.'],
    ['two long charges crossed', badge(group(charge('sword'), 'argent', { count: 2, arrangement: 'crossed' })), '(Fieldless) Two swords in saltire argent.', 'No background: two white swords, crossed like an X.'],
    ['a charge on a charge', badge(group(charge('mullet'), 'or', { charged: [group(charge('rose'), 'azure', { count: 2, arrangement: 'in-fess' })] })),
      '(Fieldless) On a mullet Or in fess two roses azure.', 'No background: a gold five-pointed star, carrying two blue roses, in a row.'],
    ['a beast charged', badge(group(charge('lion'), 'or', { charged: [group(charge('rose'), 'gules')] })), '(Fieldless) A lion Or charged with a rose gules.',
      'No background: a gold lion rearing up, carrying a red rose.'],
    ['a display form in a fur of colours of its own', badge(group(charge('heart'), { k: 'fur', fur: 'ermine', colours: ['gules', 'or'] })), '(Fieldless) A heart gules ermined Or.', ''],
  ];
  for (const [label, input, text, words] of CASES) {
    it(`${label}: registrable, blazoned and glossed`, () => {
      const d = built(input);
      expect(d).toMatchObject({ kind: 'badge', field: null });
      expect(blazon(d)).toBe(text);
      if (words) expect(gloss(d)).toBe(words);
      expect(assess(d).status).toBe('valid');
    });
  }


  it('is told apart from the same charge on a field, in the signature and the tags', () => {
    const lion = built(badge(group(charge('lion'), 'or')));
    const fielded = built(arms('azure', group(charge('lion'), 'or')));
    expect(signature(lion)).toBe('badge|P:c.lion.rampant:1:single:or');
    expect(signature(lion)).not.toBe(signature(fielded));
    expect(deriveTags(lion)).toContain('field:none');
    expect(deriveTags(lion)).not.toContain('field:plain');
    expect(deriveTags(fielded)).toContain('field:plain');
    expect(readability(lion).band).toBe('bold');
  });


  it('has no blazon of its own when empty, and asks for a picture', () => {
    const empty = nd({ v: 2, kind: 'badge', groups: [] });
    expect(blazon(empty)).toBe('(Fieldless).');
    expect(gloss(empty)).toBe('No background.');
    expect(assess(empty)).toMatchObject({ status: 'incomplete', hint: 'Add a picture — a badge is made of its picture alone.' });
  });
});


describe('the structure of a badge (SENA A3A2, A3C)', () => {
  const REJECTED: Array<[string, object, RegExp]> = [
    ['a bordure', badge(group(ordinary('bordure'), 'or')), /no edge for a bordure/],
    ['a chief', badge(group(ordinary('chief'), 'or')), /no edge for a chief/],
    ['an uncouped band', badge(group(ordinary('bend'), 'or')), /can't have a bend unless it is couped/],
    ['charges set apart', badge(group(charge('lion'), 'or', { count: 3 })), /charges must touch/],
    ['two that are not long', badge(group(charge('rose'), 'gules', { count: 2, arrangement: 'in-pale' })), /charges must touch/],
    ['a charge in chief', badge(group(charge('lion'), 'or', { position: 'chief' })), /no field to set a charge in chief/],
    ['a charged display form', badge(group(charge('heart'), 'argent', { charged: [group(charge('lion'), 'azure')] })), /shield of arms rather than a badge/],
    ['a divided display form', badge(group(charge('lozenge'), { k: 'divided', division: 'per-pale', parts: ['or', 'gules'] })), /looks like a shield of arms/],
    ['a checky display form', badge(group(charge('billet'), { k: 'variation', variation: 'checky', parts: ['argent', 'azure'] })), /looks like a shield of arms/],
    ['a plain ermine display form', badge(group(charge('roundel'), { k: 'fur', fur: 'ermine' })), /not plain ermine/],
  ];
  for (const [label, input, message] of REJECTED) {
    it(`rejects ${label}`, () => {
      const found = rules(input);
      expect(found.length, found.join(' | ')).toBe(1);
      expect(found[0]).toMatch(message);
      expect(assess(nd(input)).status).toBe('violation');
    });
  }


  it('allows a display form in one tincture or a fur, and a long charge divided', () => {
    for (const paint of ['argent', { k: 'fur', fur: 'vair' }, { k: 'fur', fur: 'counter-ermine' }]) expect(rules(badge(group(charge('heart'), paint))), JSON.stringify(paint)).toEqual([]);
    expect(rules(badge(group(charge('sword'), { k: 'divided', division: 'per-fess', parts: ['or', 'sable'] })))).toEqual([]);
  });


  it('draws no more than its one main charge and what is on it: the rest are gaps', () => {
    const lion = group(charge('lion'), 'or');
    expect(gaps(badge(lion, group(charge('rose'), 'gules', { count: 3, relation: 'between' })))).toEqual(['fieldless:conjoined']);
    expect(gaps(badge(lion, group(charge('sword'), 'argent', { role: 'overall' })))).toEqual(['fieldless:overall']);
    expect(gaps(badge(lion, group(charge('rose'), 'gules')))).toEqual(['fieldless:co-primary']);
    expect(gaps(badge(lion))).toEqual([]);
  });
});


describe('the rule of tincture on a badge', () => {
  it('has no field to contrast with: any tincture stands alone', () => {
    for (const t of ['or', 'argent', 'gules', 'sable']) expect(rules(badge(group(charge('lion'), t))), t).toEqual([]);
  });


  it('judges what is on a charge against that charge', () => {
    expect(rules(badge(group(charge('lion'), 'or', { charged: [group(charge('rose'), 'gules')] })))).toEqual([]);
    expect(rules(badge(group(charge('lion'), 'or', { charged: [group(charge('rose'), 'argent')] })))).toEqual(['Argent rose on the Or lion: metal on metal']);
  });


  it('has nothing to counterchange', () => {
    expect(rules(badge(group(charge('lion'), 'counterchanged')))).toEqual(["Counterchanged needs a divided field: each charge takes the field's other tincture, and a plain field has only one."]);
  });
});


describe('drawing a badge', () => {
  const rose = built(badge(group(charge('rose'), 'gules')));
  const crossed = built(badge(group(charge('sword'), 'argent', { count: 2, arrangement: 'crossed' })));


  it('has no field layer, in any shape', () => {
    for (const shape of ['heater', 'banner', 'round', 'lozenge'] as const) {
      expect(renderLayers(rose, shape).map((l) => l.k)).toEqual(['charges']);
      expect(renderLayers(rose, shape)[0]).toEqual(renderLayers(rose, 'heater')[0]);
    }
  });


  it('is scaled to fill the picture and kept in its middle', () => {
    for (const d of [rose, crossed]) {
      const view = badgeView(d, renderLayers(d, 'heater'))!;
      const [, tx, ty, scale] = /translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.]+)\)/.exec(view)!.map(Number);
      const slots = renderLayers(d, 'heater').flatMap((l) => (l.k === 'charges' ? l.slots : []));
      // Seen through the view the charges are centred in the 100×120 picture and touch the margin on one axis at least.
      const reach = (s: { size: number; rotation: number }) => (scale * s.size * (Math.abs(Math.cos((s.rotation * Math.PI) / 180)) + Math.abs(Math.sin((s.rotation * Math.PI) / 180)))) / 2;
      const left = Math.min(...slots.map((s) => tx + scale * s.x - reach(s))), right = Math.max(...slots.map((s) => tx + scale * s.x + reach(s)));
      const top = Math.min(...slots.map((s) => ty + scale * s.y - reach(s))), bottom = Math.max(...slots.map((s) => ty + scale * s.y + reach(s)));
      expect((left + right) / 2).toBeCloseTo(50, 0);
      expect((top + bottom) / 2).toBeCloseTo(60, 0);
      expect(Math.max(right - left - 84, bottom - top - 104)).toBeCloseTo(0, 0);
      expect([left - 8, top - 8, 92 - right, 112 - bottom].every((margin) => margin > -0.5)).toBe(true);
    }
    expect(badgeView(nd(arms('azure', group(charge('rose'), 'argent'))), [])).toBeNull();
  });


  it('is drawn without a shield: no outline, rim or clip', () => {
    const svg = renderToString(h(Shield, { design: rose, shape: 'round', label: null }));
    expect(svg).toContain('data-shape="badge"');
    expect(svg).not.toContain('shield-rim');
    expect(svg).not.toContain('clipPath');
    expect(svg).toContain('data-layer="charges"');
    expect(svg).not.toContain('data-layer="field"');
    const arms_ = renderToString(h(Shield, { design: nd(arms('azure', group(charge('rose'), 'argent'))), shape: 'round', label: null }));
    expect(arms_).toContain('shield-rim');
  });


  it('keeps its name for a screen reader', () => {
    expect(renderToString(h(Shield, { design: rose, shape: 'heater' }))).toContain('aria-label="No background: a red rose."');
  });
});


describe('the builder offers a badge', () => {
  const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
  const onBend = built(arms('azure', group(ordinary('fess'), 'or'), group(ordinary('chief'), 'argent')));


  it('keeps the picture and what is on it, and drops the background and the bands', () => {
    const withRose = built(arms('argent', group(charge('lion'), 'sable', { charged: [group(charge('rose'), 'argent')] }), group(ordinary('bordure'), 'gules')));
    expect(blazon(setBadge(withRose))).toBe('(Fieldless) A lion sable charged with a rose argent.');
    expect(blazon(setBadge(lion))).toBe('(Fieldless) A lion Or.');
    expect(blazon(setBadge(built(arms('azure', group(ordinary('fess'), 'or')))))).toBe('(Fieldless).');
    expect(setBadge(onBend).groups).toEqual([]);
  });


  it('makes one charge of a group the badge cannot hold, and a tincture of counterchanged', () => {
    const three = built(arms(  { k: 'divided', division: 'per-pale', parts: ['or', 'azure'] }, group(charge('rose'), 'counterchanged', { count: 3 })));
    expect(blazon(setBadge(three))).toBe('(Fieldless) A rose Or.');
    const swords = built(arms('azure', group(charge('sword'), 'argent', { count: 2, arrangement: 'crossed' })));
    expect(blazon(setBadge(swords))).toBe('(Fieldless) Two swords in saltire argent.');
  });


  it('is left by choosing a background, one the picture stands out against', () => {
    const gold = setBadge(lion);
    const plain = setPlainField(gold);
    expect(plain.kind).toBe('arms');
    expect(assess(plain).status).toBe('valid');
    const gules = setPlainField(setBadge(setCharge(DEFAULT_DESIGN, 'picture', 'rose')));
    expect(assess(gules).status).toBe('valid');
    expect(setDivision(gold, 'per-pale')).toMatchObject({ kind: 'arms', field: { k: 'divided', division: 'per-pale' } });
    expect(setPlainField(setPlainField(gold))).toEqual(plain);
  });


  it('has one count, no place to put the picture, and a layout that is fixed', () => {
    const d = setBadge(lion);
    const path = [0];
    expect(countChoices(d, path).filter((c) => c.allowed).map((c) => c.value)).toEqual([1]);
    expect(placementChoices(d, path)).toEqual([]);
    expect(layoutChoices(d, path)).toEqual({ mode: 'single', note: 'A single charge sits in the centre.' });
    const swords = setBadge(setCharge(DEFAULT_DESIGN, 'picture', 'sword'));
    expect(countChoices(swords, path).filter((c) => c.allowed).map((c) => c.value)).toEqual([1, 2]);
  });


  it('adds only pictures on the picture, and only where its drawing has room for them', () => {
    expect(layerChoices(setBadge(lion)).filter((c) => c.allowed).map((c) => c.value)).toEqual(['on-picture']);
    const bare = CHARGE_IDS.find((id) => chargeOnBox(id, CHARGES[id].defaultPosture) === null)!;
    expect(layerChoices(setBadge(setCharge(DEFAULT_DESIGN, 'picture', bare))).filter((c) => c.allowed)).toEqual([]);
    expect(layerChoices(setBadge(DEFAULT_DESIGN)).filter((c) => c.allowed)).toEqual([]);
  });


  it('has two places: the picture and the pictures on it', () => {
    const lionOnLion = built(badge(group(charge('lion'), 'or', { charged: [group(charge('rose'), 'gules')] })));
    expect(placesOf(lionOnLion).map((p) => [p.place, p.path])).toEqual([['picture', [0]], ['on-picture', [0, 0]]]);
    expect(placesOf(setBadge(lion)).map((p) => p.place)).toEqual(['picture']);
  });


  it('puts the picture first when the badge is assembled from nothing', () => {
    const empty = setBadge(DEFAULT_DESIGN);
    const parts = partsOf(empty);
    expect(blazon(assembleParts(empty, { ...parts, picture: partsOf(lion).picture }))).toBe('(Fieldless) A lion Or.');
  });
});


describe('the default flow gains nothing', () => {
  const ids = (markup: string) => new Set([...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]));
  const base = { onChange: () => {}, issues: [], accordion: null };
  const field = (d: Design) => ids(renderToString(h(FieldStep, { ...base, design: d, shape: 'heater' })));


  it('adds one tile to the background step and nothing to the other steps of the arms flow', () => {
    const got = field(DEFAULT_DESIGN);
    expect(got).toContain('division-badge');
    // Everything else the step showed before the badge tile is still there, and nothing but the tile is new.
    const before = ['step-field', 'field-division-select', 'field-kind-plain', 'division-per-pale', 'division-quarterly', 'field-tincture-1', 'swatch-field1-azure'];
    for (const id of before) expect(got, id).toContain(id);
    const without = new Set(got);
    without.delete('division-badge');
    expect(without.size).toBe(got.size - 1);
  });


  // The tab reads the screen size when it renders; there is no window in the test runtime.
  beforeEach(() => { vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });


  it('shows a badge only its picture: no colours for a background, no pattern, no shape, no band step', () => {
    const d = setBadge(setCharge(DEFAULT_DESIGN, 'picture', 'lion'));
    const got = field(d);
    expect(got).toContain('division-badge');
    for (const id of ['field-tincture-1', 'field-pattern-toggle']) expect(got, id).not.toContain(id);
    const tab = renderToString(h(DesignTab, {
      design: d, shape: 'heater', report: assess(d), onChange: () => {}, onAdjust: () => {}, adjusted: () => null, onShape: () => {}, onStartOver: () => {},
      examplesOpen: false, onLoadExample: () => {}, onSurprise: () => {}, onDismissWelcome: null, hatching: false, onHatching: () => {}, onCheck: () => {}, checking: false, onRegister: () => {},
    }));
    expect(tab).toContain('data-testid="step-charges"');
    expect(tab).not.toContain('data-testid="step-ordinary"');
    expect(tab).not.toContain('data-testid="shape-picker"');
    const withBand = renderToString(h(DesignTab, {
      design: DEFAULT_DESIGN, shape: 'heater', report: assess(DEFAULT_DESIGN), onChange: () => {}, onAdjust: () => {}, adjusted: () => null, onShape: () => {}, onStartOver: () => {},
      examplesOpen: false, onLoadExample: () => {}, onSurprise: () => {}, onDismissWelcome: null, hatching: false, onHatching: () => {}, onCheck: () => {}, checking: false, onRegister: () => {},
    }));
    expect(withBand).toContain('data-testid="step-ordinary"');
    expect(withBand).toContain('data-testid="shape-picker"');
  });
});


describe('badges are built by clicks the builder allows', () => {
  const BADGES: Array<[string, object, string]> = [
    ['an owl (O&A 569)', badge(group(charge('owl'), 'or')), '(Fieldless) An owl Or.'],
    ['a flame (O&A 2545)', badge(group(charge('flame'), 'argent')), '(Fieldless) A flame argent.'],
    ['an open book divided (O&A 1618)', badge(group(charge('open-book'), { k: 'divided', division: 'per-pale', parts: ['gules', 'argent'] })), '(Fieldless) An open book per pale gules and argent.'],
    ['a lion passant divided (O&A 2293)', badge(group(charge('lion', { posture: 'passant' }), { k: 'divided', division: 'per-pale', parts: ['argent', 'gules'] })), '(Fieldless) A lion passant per pale argent and gules.'],
    ['charges on a charge (O&A 1838)', badge(group(charge('mullet'), 'or', { charged: [group(charge('rose'), 'azure', { count: 2, arrangement: 'in-fess' })] })),
      '(Fieldless) On a mullet Or in fess two roses azure.'],
    ['two swords crossed', badge(group(charge('sword'), 'argent', { count: 2, arrangement: 'crossed' })), '(Fieldless) Two swords in saltire argent.'],
    ['a sun in splendour', badge(group(charge('sun', { mods: [{ id: 'in-splendour', count: null, paint: null }] }), 'or')), '(Fieldless) A sun in splendor Or.'],
    ['a fur', badge(group(charge('mullet'), { k: 'fur', fur: 'vair' })), '(Fieldless) A mullet vair.'],
  ];
  for (const [label, input, text] of BADGES) {
    it(`${label}`, () => {
      const d = built(input);
      expect(blazon(d)).toBe(text);
      const path = builderPath(d);
      expect(path.problems).toEqual([]);
      expect(path.actions[0]).toEqual({ kind: 'badge' });
    });
  }


  it('every charge is a badge by itself, in a tincture it has, and the SCA blazon of it is matched', () => {
    for (const id of CHARGE_IDS) {
      const meta = CHARGES[id];
      const d = built(badge(group(charge(id), 'argent')));
      expect(builderPath(d).problems, id).toEqual([]);
      const text = blazon(d);
      expect(text, id).toMatch(/^\(Fieldless\) (A|An) /);
      if (!['lion', 'wolf', 'boar', 'stag', 'goat', 'hare', 'unicorn', 'dragon'].includes(id) && meta.postures === null) {
        expect(checkBlazon(text).failures.filter((f) => f.check !== 'match'), id).toEqual([]);
      }
    }
  });


  it('the SCA blazon of a badge is matched to the same design', () => {
    expect(checkBlazon('(Fieldless) A mullet of six points Or.').match.status).toBe('vocabulary');
    expect(checkBlazon('(Fieldless) An owl Or.').failures).toEqual([]);
    expect(checkBlazon('(Fieldless) A lion passant per pale argent and gules.').failures).toEqual([]);
    expect(checkBlazon('(Fieldless) A heart gules ermined Or.').failures).toEqual([]);
    expect(checkBlazon('(Fieldless) Three mullets one and two argent.').failures[0]).toMatchObject({ check: 'assess' });
    expect(checkBlazon('(Fieldless) A bend sable.').failures[0]).toMatchObject({ check: 'assess' });
  });
});
