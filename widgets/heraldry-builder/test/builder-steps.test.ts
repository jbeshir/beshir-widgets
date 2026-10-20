// The builder steps rendered to markup: the default flow (Background → Band or shape → Picture) keeps its
// test ids, and the new controls (More… counts, splendour, extra pictures) appear only when they apply.

import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { ChargesStep, FieldStep, OrdinaryStep } from '../src/components/design/BuilderSteps';
import { AddLayer } from '../src/components/design/AddLayer';
import { LayerStep } from '../src/components/design/LayerStep';
import { setBadge, setCharge, setCut, setForm, setFacing, setHold, setModifier, setPart, setPosture, setOrientation, setPair, setDivision, setFieldLine, setOrdinary, setOrdinaryLine, setOrdinaryOutline, setOrdinaryToggle, setGroupTincture, setVariation, ordinaryPath, picturePath, DEFAULT_DESIGN } from '../src/lib/builder';
import { CHARGE_CATEGORIES, CHARGE_IDS, addLayer, layerChoices, layersIn, pathOfPlace, removeLayer, setFur, setGroupVariation, setProper, setSemy, setTreatment, splitGroup, toggleChoices, withLayout, CHARGES, type Design } from '../src/lib/heraldry';
import { setCount } from './helpers';

const noop = () => {};
const base = { onChange: noop, issues: [], accordion: null, shape: 'heater' as const };
const fieldBase = { ...base, onBadge: noop, notice: null };
const ids = (markup: string) => new Set([...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]));

const field = (d: Design) => ids(renderToString(h(FieldStep, { ...fieldBase, design: d })));
const ordinary = (d: Design) => ids(renderToString(h(OrdinaryStep, { ...base, design: d })));
const picture = (d: Design) => ids(renderToString(h(ChargesStep, { ...base, n: 3, design: d, onAdjust: noop, adjusted: null })));

describe('the default flow keeps its test ids', () => {
  it('Background', () => {
    const got = field(DEFAULT_DESIGN);
    for (const id of ['step-field', 'field-division-select', 'field-kind-plain', 'division-per-pale', 'division-quarterly', 'field-tincture-1', 'swatch-field1-azure']) expect(got, id).toContain(id);
    expect(got).not.toContain('field-tincture-2');
    // Beyond phase A's tiles and colours, only the Badge tile and the two closed disclosures: "More colours and patterns…" and (phase C) "More divisions and edges…".
    const phaseA = [...got].filter((id) => !/^(division-badge|field-more|field-shape-more)$/.test(id));
    expect(phaseA.every((id) => /^(step-field|field-division-select|field-kind-plain|division-[a-z-]+|field-tincture-1|swatch-field1-[a-z]+|tl-field1)$/.test(id)), phaseA.join()).toBe(true);
    expect(got.size - phaseA.length).toBe(3);
  });

  it('Band or shape', () => {
    const d = setOrdinary(DEFAULT_DESIGN, 'bend');
    const got = ordinary(d);
    for (const id of ['step-ordinary', 'ordinary-select', 'ordinary-none', 'ordinary-bend', 'ordinary-pile', 'ordinary-tincture', 'swatch-ordinary-or']) expect(got, id).toContain(id);
    expect(ordinary(DEFAULT_DESIGN)).not.toContain('ordinary-tincture');
  });

  it('Picture', () => {
    const d = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    const got = picture(d);
    for (const id of [
      'step-charges', 'charge-select', 'charge-none', 'charge-lion', 'charge-selected', 'count-select', 'count-1', 'count-6', 'placement-select', 'placement-field',
      'placement-ordinary', 'arrangement-select', 'posture-select', 'charge-tincture', 'swatch-charge-or',
    ]) expect(got, id).toContain(id);
    expect(picture(DEFAULT_DESIGN)).not.toContain('count-select');
  });
});

describe('the picture picker', () => {
  it('has a search box and the Popular tab first, then a tab per kind, on every screen', () => {
    const got = picture(DEFAULT_DESIGN);
    for (const id of ['charge-search', 'charge-tab-popular', ...CHARGE_CATEGORIES.map((c) => `charge-tab-${c}`)]) expect(got, id).toContain(id);
    expect(got).not.toContain('charge-search-results');
  });

  it('opens on Popular with no picture or a popular one, else on the tab of the picture chosen', () => {
    expect(picture(DEFAULT_DESIGN)).toContain('charge-mullet');
    expect(picture(DEFAULT_DESIGN)).not.toContain('charge-cross-tau');
    const tau = picture(setCharge(DEFAULT_DESIGN, 'picture', 'cross-tau'));
    expect(tau).toContain('charge-cross-tau');
    expect(tau).not.toContain('charge-lion');
    expect(picture(setCharge(DEFAULT_DESIGN, 'picture', 'lion'))).toContain('charge-lion');
  });

  it('lists every picture once in the menu of a layer, grouped by kind', () => {
    const band = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const d = setCharge(setGroupTincture(band, picturePath(band)!, 'argent'), 'on-ordinary', 'mullet');
    const html = renderToString(h(LayerStep, { ...base, design: d, place: 'on-ordinary', n: 4, onAdjust: noop }));
    const menu = html.slice(html.indexOf('data-testid="on-ordinary-charge-select"')).split('</select>')[0];
    const values = [...menu.matchAll(/<option[^>]*value="([^"]+)"/g)].map((m) => m[1]);
    expect(values).toEqual(CHARGE_CATEGORIES.flatMap((c) => CHARGE_IDS.filter((id) => CHARGES[id].category === c)));
  });
});

describe('controls that appear only when they apply', () => {
  it('holds counts above six behind More…, open when one is chosen', () => {
    const d = setCharge(DEFAULT_DESIGN, 'picture', 'mullet');
    const closed = renderToString(h(ChargesStep, { ...base, n: 3, design: d, onAdjust: noop, adjusted: null }));
    expect(closed).toContain('data-testid="count-more"');
    expect(closed).toMatch(/<details[^>]*data-testid="count-more"(?![^>]*\sopen)/);
    expect(ids(closed)).toContain('count-12');
    const open = renderToString(h(ChargesStep, { ...base, n: 3, design: setCount(d, picturePath(d)!, 8), onAdjust: noop, adjusted: null }));
    expect(open).toMatch(/<details[^>]*data-testid="count-more"[^>]*\sopen/);
  });

  it('hides More… when none of its counts is allowed, unless one is chosen', () => {
    const onBand = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const html = renderToString(h(ChargesStep, { ...base, n: 3, design: onBand, onAdjust: noop, adjusted: null }));
    expect(ids(html)).toContain('count-6');
    expect(ids(html)).not.toContain('count-more');
    expect(ids(html)).not.toContain('count-12');
  });

  it('says once that the greyed-out layouts have no room', () => {
    const d = setCount(setCharge(DEFAULT_DESIGN, 'picture', 'mullet'), [0], 8);
    const html = renderToString(h(ChargesStep, { ...base, n: 3, design: d, onAdjust: noop, adjusted: null }));
    expect(html.match(/Greyed-out layouts have no room for eight mullets\./g)).toHaveLength(1);
    expect(html).not.toContain("There isn't room");
  });

  it('offers the face of a sun, and nothing for other charges', () => {
    expect(picture(setCharge(DEFAULT_DESIGN, 'picture', 'sun'))).toContain('splendour-toggle');
    expect(picture(setCharge(DEFAULT_DESIGN, 'picture', 'lion'))).not.toContain('splendour-toggle');
  });

  it('offers the layer chooser only when some layer can be drawn, listing every layer it can still take, greyed where it cannot', () => {
    expect(renderToString(h(AddLayer, { design: DEFAULT_DESIGN, onChange: noop, onAdded: noop }))).toBe('');
    const band = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const toned = setGroupTincture(band, picturePath(band)!, 'argent');
    const add = renderToString(h(AddLayer, { design: toned, onChange: noop, onAdded: noop }));
    expect(add).toContain('data-testid="add-layer-toggle"');
    expect(add).toContain('aria-expanded="false"');
    // Every layer not in the design is listed, but pictures on a top bar or border only once there is one; one that can't be added is greyed and says why when pressed.
    const listed = layerChoices(toned).filter((c) => c.value !== 'on-chief' && c.value !== 'on-bordure');
    expect(ids(add)).toEqual(new Set(['add-layer-toggle', ...listed.map((c) => `add-layer-${c.value}`)]));
    for (const c of listed) expect(add).toMatch(new RegExp(`data-testid="add-layer-${c.value}"${c.allowed ? '(?![^>]*aria-disabled)' : '[^>]*aria-disabled="true"'}`));
    expect(add).toContain('On the band');
    expect(add).toContain('A border (bordure)');
    expect(renderToString(h(AddLayer, { design: setOrdinary(DEFAULT_DESIGN, 'chevron'), onChange: noop, onAdded: noop }))).toContain('A top band (chief)');
  });

  it('takes a layer out of the chooser once the design has it, and gives it a card', () => {
    const band = setOrdinary(DEFAULT_DESIGN, 'chevron');
    const bordered = addLayer(band, 'bordure');
    const add = renderToString(h(AddLayer, { design: bordered, onChange: noop, onAdded: noop }));
    expect(add).not.toContain('add-layer-bordure');
    expect(add).toContain('add-layer-chief');
    const got = ids(renderToString(h(LayerStep, { ...base, design: bordered, place: 'bordure', n: 4, onAdjust: noop })));
    for (const id of ['step-layer-bordure', 'bordure-tincture', 'remove-layer-bordure']) expect(got, id).toContain(id);
    expect(renderToString(h(LayerStep, { ...base, design: band, place: 'bordure', n: 4, onAdjust: noop }))).toBe('');
    // Pictures and the top band or border go together: the add buttons stay, and the picture step no longer warns.
    const pictured = setCharge(band, 'picture', 'lion');
    expect(renderToString(h(AddLayer, { design: pictured, onChange: noop, onAdded: noop }))).toContain('add-layer-bordure');
    expect(renderToString(h(ChargesStep, { ...base, n: 3, design: addLayer(pictured, 'bordure'), onAdjust: noop, adjusted: null }))).not.toContain('peripheral-picture-note');
  });

  it('numbers a card per layer, with its title, role and remove button; removing returns to the earlier design', () => {
    const band = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const toned = setGroupTincture(band, picturePath(band)!, 'argent');
    const withExtra = setCharge(toned, 'on-ordinary', 'mullet');
    expect(renderToString(h(AddLayer, { design: withExtra, onChange: noop, onAdded: noop }))).not.toContain('add-layer-on-ordinary');
    const html = renderToString(h(LayerStep, { ...base, design: withExtra, place: 'on-ordinary', n: 4, onAdjust: noop }));
    const got = ids(html);
    for (const id of ['step-layer-on-ordinary', 'on-ordinary-charge-select', 'on-ordinary-count-select', 'on-ordinary-count-1', 'on-ordinary-arrangement-select', 'on-ordinary-charge-tincture', 'remove-layer-on-ordinary']) expect(got, id).toContain(id);
    expect(got).not.toContain('on-ordinary-placement-select');
    expect(html).toContain('Pictures on the band');
    expect(html).toContain('charges on the ordinary');
    expect(renderToString(h(LayerStep, { ...base, design: toned, place: 'on-ordinary', n: 4, onAdjust: noop }))).toBe('');
    expect(layersIn(withExtra)).toEqual(['on-ordinary']);
    expect(removeLayer(withExtra, 'on-ordinary')).toEqual(toned);
    const bordered = addLayer(withExtra, 'bordure');
    expect(layersIn(bordered)).toEqual(['on-ordinary', 'bordure']);
    expect(removeLayer(bordered, 'bordure')).toEqual(withExtra);
  });

  it('gives the pictures on a top band and on a border cards of their own', () => {
    const framed = addLayer(addLayer(setOrdinary(DEFAULT_DESIGN, 'pale'), 'chief'), 'bordure');
    const add = renderToString(h(AddLayer, { design: framed, onChange: noop, onAdded: noop }));
    expect(add).toContain('On the top bar');
    expect(add).toContain('On the border');
    expect(renderToString(h(LayerStep, { ...base, design: framed, place: 'on-chief', n: 6, onAdjust: noop }))).toBe('');
    const carried = addLayer(addLayer(framed, 'on-chief'), 'on-bordure');
    expect(layersIn(carried)).toEqual(['chief', 'on-chief', 'bordure', 'on-bordure']);
    for (const place of ['on-chief', 'on-bordure'] as const) {
      const html = renderToString(h(LayerStep, { ...base, design: carried, place, n: 6, onAdjust: noop }));
      const got = ids(html);
      for (const id of [`step-layer-${place}`, `${place}-charge-select`, `${place}-count-select`, `${place}-count-1`, `${place}-charge-tincture`, `remove-layer-${place}`]) expect(got, id).toContain(id);
      expect(got).not.toContain(`${place}-placement-select`);
      expect(html).toContain(place === 'on-chief' ? 'Pictures on the top bar' : 'Pictures on the border');
    }
    expect(removeLayer(removeLayer(carried, 'on-chief'), 'on-bordure')).toEqual(framed);
  });

  it('gives pictures around the picture a card of their own, with the layouts they take there', () => {
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    expect(renderToString(h(AddLayer, { design: lion, onChange: noop, onAdded: noop }))).toContain('Around the lion');
    const d = addLayer(lion, 'around');
    expect(layersIn(d)).toEqual(['around']);
    const html = renderToString(h(LayerStep, { ...base, design: d, place: 'around', n: 4, onAdjust: noop }));
    const got = ids(html);
    for (const id of ['step-layer-around', 'around-charge-select', 'around-count-select', 'around-count-3', 'around-arrangement-select', 'around-charge-tincture', 'remove-layer-around']) expect(got, id).toContain(id);
    expect(got).not.toContain('around-placement-select');
    expect(html).toContain('Pictures around the lion');
    expect(html).toContain('Two above, one below');
    expect(removeLayer(d, 'around')).toEqual(lion);
  });

  it('gives pictures on the picture a card of their own, with the layouts they take there', () => {
    const heart = setCharge(DEFAULT_DESIGN, 'picture', 'heart');
    expect(renderToString(h(AddLayer, { design: heart, onChange: noop, onAdded: noop }))).toContain('On the heart');
    const d = addLayer(heart, 'on-picture');
    expect(layersIn(d)).toEqual(['on-picture']);
    const html = renderToString(h(LayerStep, { ...base, design: d, place: 'on-picture', n: 4, onAdjust: noop }));
    const got = ids(html);
    for (const id of ['step-layer-on-picture', 'on-picture-charge-select', 'on-picture-count-select', 'on-picture-count-1', 'on-picture-arrangement-select', 'on-picture-charge-tincture', 'remove-layer-on-picture']) expect(got, id).toContain(id);
    expect(got).not.toContain('on-picture-placement-select');
    expect(html).toContain('Pictures on the heart');
    expect(removeLayer(d, 'on-picture')).toEqual(heart);
  });

  it('gives pictures in chief, in base or in canton a card of their own, with the one layout they stand in', () => {
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    const add = renderToString(h(AddLayer, { design: lion, onChange: noop, onAdded: noop }));
    for (const text of ['Along the top (in chief)', 'Along the bottom (in base)', 'In the top corner (in canton)']) expect(add).toContain(text);
    for (const place of ['in-chief', 'in-base', 'in-canton'] as const) {
      const d = addLayer(lion, place);
      expect(layersIn(d)).toEqual([place]);
      const html = renderToString(h(LayerStep, { ...base, design: d, place, n: 4, onAdjust: noop }));
      const got = ids(html);
      for (const id of [`step-layer-${place}`, `${place}-charge-select`, `${place}-count-select`, `${place}-count-1`, `${place}-arrangement-select`, `${place}-charge-tincture`, `remove-layer-${place}`]) expect(got, id).toContain(id);
      expect(got).not.toContain(`${place}-placement-select`);
      expect(html).toContain({ 'in-chief': 'Pictures along the top', 'in-base': 'Pictures along the bottom', 'in-canton': 'Pictures in the top corner' }[place]);
      expect(html).toMatch(/<select[^>]*data-testid="[a-z-]+-arrangement-select"[^>]*disabled/);
      expect(removeLayer(d, place)).toEqual(lion);
    }
    expect(renderToString(h(LayerStep, { ...base, design: addLayer(lion, 'in-canton'), place: 'in-canton', n: 4, onAdjust: noop }))).toContain('In the top corner');
  });

  it('gives the second main picture a card of its own, laid out with the first', () => {
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    expect(renderToString(h(AddLayer, { design: lion, onChange: noop, onAdded: noop }))).toContain('A second picture beside the lion');
    const two = addLayer(lion, 'co-primary');
    expect(layersIn(two)).toEqual(['co-primary']);
    const html = renderToString(h(LayerStep, { ...base, design: two, place: 'co-primary', n: 4, onAdjust: noop }));
    const got = ids(html);
    for (const id of ['step-layer-co-primary', 'co-primary-charge-select', 'co-primary-count-select', 'co-primary-count-1', 'co-primary-arrangement-select', 'co-primary-charge-tincture', 'remove-layer-co-primary']) expect(got, id).toContain(id);
    expect(html).toContain('Second picture');
    expect(removeLayer(two, 'co-primary')).toEqual(lion);
  });

  it('gives what lies across everything a card of its own: a band with a colour, or a picture with its count', () => {
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    expect(renderToString(h(AddLayer, { design: lion, onChange: noop, onAdded: noop }))).toContain('Across everything (overall)');
    const band = addLayer(lion, 'overall');
    expect(layersIn(band)).toEqual(['overall']);
    const bandHtml = renderToString(h(LayerStep, { ...base, design: band, place: 'overall', n: 4, onAdjust: noop }));
    for (const id of ['step-layer-overall', 'overall-item-select', 'overall-tincture', 'remove-layer-overall']) expect(ids(bandHtml), id).toContain(id);
    expect(bandHtml).toContain('Across everything');
    expect(bandHtml).toContain('Picture');
    expect(ids(bandHtml)).not.toContain('overall-count-select');
    expect(removeLayer(band, 'overall')).toEqual(lion);
    const picture = addLayer(setOrdinary(DEFAULT_DESIGN, 'fess'), 'overall');
    const pictureHtml = renderToString(h(LayerStep, { ...base, design: picture, place: 'overall', n: 4, onAdjust: noop }));
    for (const id of ['overall-item-select', 'overall-count-select', 'overall-count-1', 'overall-arrangement-select', 'overall-charge-tincture']) expect(ids(pictureHtml), id).toContain(id);
    expect(ids(pictureHtml)).not.toContain('overall-tincture');
    // What App I4 doesn't allow is greyed out in the list, with its reason.
    expect(bandHtml).toMatch(/<option[^>]*disabled[^>]*>Rose \(not here\)/);
  });
});

/** The "More colours and patterns…" disclosures in some markup, and whether each is open. */
const disclosures = (markup: string) => [...markup.matchAll(/<details[^>]*class="more-paint"[^>]*>/g)].map((m) => ({ testid: /data-testid="([^"]+)"/.exec(m[0])![1], open: /\sopen/.test(m[0]) }));

/** The "More divisions and edges…" disclosures in some markup, and whether each is open. */
const shapeDisclosures = (markup: string) => [...markup.matchAll(/<details[^>]*class="more-paint more-shapes"[^>]*>/g)].map((m) => ({ testid: /data-testid="([^"]+)"/.exec(m[0])![1], open: /\sopen/.test(m[0]) }));

describe('"More divisions and edges…"', () => {
  const render = (d: Design) => renderToString(h(FieldStep, { ...fieldBase, design: d }));

  it('every background shows one closed disclosure with the division and edge rows inside', () => {
    expect(shapeDisclosures(render(DEFAULT_DESIGN))).toEqual([{ testid: 'field-shape-more', open: false }]);
    const divided = render(setDivision(DEFAULT_DESIGN, 'per-pale'));
    expect(shapeDisclosures(divided)).toEqual([{ testid: 'field-shape-more', open: false }]);
    expect(divided).toContain('More divisions and edges…');
    expect(divided).not.toContain('field-edge-select');
    expect(shapeDisclosures(render(setVariation(DEFAULT_DESIGN, 'barry')))).toEqual([{ testid: 'field-shape-more', open: false }]);
    // Chevronny's corners take no line, a pattern without stripes none either: the disclosure is still there, for the divisions.
    expect(shapeDisclosures(render(setVariation(DEFAULT_DESIGN, 'chevronny')))).toEqual([{ testid: 'field-shape-more', open: false }]);
    expect(shapeDisclosures(render(setVariation(DEFAULT_DESIGN, 'checky')))).toEqual([{ testid: 'field-shape-more', open: false }]);
  });

  it('opens on a division behind it, with its tiles; a gyronny also offers its wedge counts and its arrondi line', () => {
    const inverted = render(setDivision(DEFAULT_DESIGN, 'per-chevron-inverted'));
    expect(shapeDisclosures(inverted)).toEqual([{ testid: 'field-shape-more', open: true }]);
    const got = ids(inverted);
    for (const id of ['field-more-division-select', 'division-per-chevron-inverted', 'division-per-chevron-throughout', 'division-gyronny', 'field-edge-ploye']) expect(got, id).toContain(id);
    expect(got).not.toContain('field-pieces-6');
    expect(inverted).toMatch(/data-testid="division-per-chevron-inverted"[^>]*><button[^>]*aria-checked="true"/);
    const gyronny = ids(render(setDivision(DEFAULT_DESIGN, 'gyronny')));
    for (const id of ['field-pieces-6', 'field-pieces-8', 'field-pieces-12', 'field-edge-arrondi']) expect(gyronny, id).toContain(id);
    expect(ids(render(setDivision(DEFAULT_DESIGN, 'per-pale')))).not.toContain('field-edge-arrondi');
  });

  it('a lined background opens it, on a row of the lines the division takes', () => {
    const wavy = render(setFieldLine(setDivision(DEFAULT_DESIGN, 'per-pale'), 'wavy'));
    expect(shapeDisclosures(wavy)).toEqual([{ testid: 'field-shape-more', open: true }]);
    const got = ids(wavy);
    for (const id of ['field-edge-select', 'field-edge-plain', 'field-edge-wavy', 'field-edge-embattled']) expect(got, id).toContain(id);
    expect(got).not.toContain('field-edge-dancetty');
    expect(got).not.toContain('field-edge-side-both');
    expect(wavy).toMatch(/data-testid="field-edge-wavy"[^>]*><button[^>]*aria-checked="true"/);
    // The collapsed step's summary names the line.
    const collapsed = renderToString(h(FieldStep, { ...fieldBase, accordion: { open: false, onToggle: noop }, design: setFieldLine(setDivision(DEFAULT_DESIGN, 'per-pale'), 'wavy') }));
    expect(collapsed).toMatch(/step-field-summary">Split down the middle, wavy: /i);
  });

  it('a quartered background with a line offers which lines carry it', () => {
    const got = ids(render(setFieldLine(setDivision(DEFAULT_DESIGN, 'quarterly'), 'embattled')));
    for (const id of ['field-edge-side-both', 'field-edge-side-a', 'field-edge-side-b']) expect(got, id).toContain(id);
  });
});

describe('"More colours and patterns…"', () => {
  it('is the one closed disclosure per colour of the default flow, which shows nothing else beyond the colours', () => {
    const lion = setCharge(setOrdinary(DEFAULT_DESIGN, 'bend'), 'picture', 'lion');
    expect(disclosures(renderToString(h(FieldStep, { ...fieldBase, design: DEFAULT_DESIGN })))).toEqual([{ testid: 'field-more', open: false }]);
    expect(disclosures(renderToString(h(FieldStep, { ...fieldBase, design: setDivision(DEFAULT_DESIGN, 'per-pale') })))).toEqual([{ testid: 'field-more', open: false }]);
    expect(disclosures(renderToString(h(OrdinaryStep, { ...base, design: lion })))).toEqual([{ testid: 'ordinary-tincture-more', open: false }]);
    const step3 = renderToString(h(ChargesStep, { ...base, n: 3, design: lion, onAdjust: noop, adjusted: null }));
    expect(disclosures(step3)).toEqual([{ testid: 'charge-tincture-more', open: false }]);
    // Nothing of a fur, a pattern, a scatter, brick, a split or natural colours is drawn until it is asked for.
    for (const html of [step3, renderToString(h(FieldStep, { ...fieldBase, design: DEFAULT_DESIGN }))]) {
      expect(html).not.toMatch(/-(fur|pattern|semy|treatment|split|proper|mode)-/);
    }
  });

  it('opens on what the paint is, offering only the kinds the target can take', () => {
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const furred = setFur(fess, { k: 'group', path: ordinaryPath(fess)! }, 'ermine');
    const band = renderToString(h(OrdinaryStep, { ...base, design: furred }));
    expect(disclosures(band)).toEqual([{ testid: 'ordinary-tincture-more', open: true }]);
    const modes = [...band.matchAll(/data-testid="ordinary-tincture-mode-([a-z]+)"/g)].map((m) => m[1]);
    expect(modes).toEqual(['split', 'fur', 'pattern', 'scatter', 'treatment']);
    expect(band).toMatch(/data-testid="ordinary-tincture-mode-fur"[^>]*><button[^>]*aria-checked="true"/);
    // A lion has natural colours and can't be strewn.
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    const proper = setProper(lion, picturePath(lion)!);
    const picture = renderToString(h(ChargesStep, { ...base, n: 3, design: proper, onAdjust: noop, adjusted: null }));
    expect([...picture.matchAll(/data-testid="charge-tincture-mode-([a-z]+)"/g)].map((m) => m[1])).toEqual(['split', 'fur', 'pattern', 'treatment', 'natural']);
    expect(picture).toMatch(/data-testid="charge-tincture-proper"[^>]*><button[^>]*aria-checked="true"/);
    // The background offers its own kinds: no split (that is the division tiles) and no natural colours.
    const ermine = renderToString(h(FieldStep, { ...fieldBase, design: setFur(DEFAULT_DESIGN, { k: 'field', part: 0 }, 'ermine') }));
    expect([...ermine.matchAll(/data-testid="field-mode-([a-z]+)"/g)].map((m) => m[1])).toEqual(['fur', 'pattern', 'scatter', 'treatment']);
  });

  it('keeps a scatter or brick when a colour is picked above: the picker sets the colour under it', () => {
    const strewn = setSemy(DEFAULT_DESIGN, { k: 'field', part: 0 }, 'mullet');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: strewn }));
    expect(html).toMatch(/data-testid="swatch-field1-azure"[^>]*><button[^>]*aria-checked="true"/);
    // The picker above is the colour it is strewn on, so the scatter offers only the colour of its pictures.
    expect(ids(html)).toContain('field-1-semy-colour-2');
    expect(ids(html)).not.toContain('field-1-semy-colour-1');
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const masoned = setTreatment(fess, { k: 'group', path: ordinaryPath(fess)! }, 'masoned');
    const band = renderToString(h(OrdinaryStep, { ...base, design: masoned }));
    expect(band).toMatch(/data-testid="swatch-ordinary-or"[^>]*><button[^>]*aria-checked="true"/);
    for (const id of ['ordinary-tincture-treatment-colour-2', 'ordinary-tincture-treatment-none']) expect(ids(band), id).toContain(id);
  });
});

describe('the split into two colours', () => {
  it('keeps the plain picker and its test ids, with the split folded away', () => {
    const got = ordinary(setOrdinary(DEFAULT_DESIGN, 'fess'));
    expect(got).toContain('swatch-ordinary-or');
    expect(got).toContain('ordinary-tincture-more');
    expect(got).not.toContain('ordinary-tincture-division');
  });

  it('opens a division and a picker for each part once the colour is split', () => {
    const d = setOrdinary(DEFAULT_DESIGN, 'fess');
    const split = splitGroup(d, ordinaryPath(d)!)!;
    const got = ordinary(split);
    for (const id of ['ordinary-tincture-mode-split', 'ordinary-tincture-division', 'ordinary-tincture-division-per-pale', 'ordinary-tincture-part-1', 'ordinary-tincture-part-2', 'swatch-ordinary-part-1-or', 'swatch-ordinary-part-2-argent']) {
      expect(got, id).toContain(id);
    }
    expect(got).not.toContain('ordinary-tincture-split');
  });
});

describe('the fur picker', () => {
  it('offers three kinds of fur in plain words, then the colours, and names the fur they make', () => {
    const d = setFur(DEFAULT_DESIGN, { k: 'field', part: 0 }, 'ermine');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d }));
    expect(disclosures(html)).toEqual([{ testid: 'field-more', open: true }]);
    expect([...html.matchAll(/data-testid="field-1-fur-(ermine|vair|potent)"/g)].map((m) => m[1])).toEqual(['ermine', 'vair', 'potent']);
    expect(html).toContain('Spots · ermine');
    expect(html).toMatch(/data-testid="field-1-fur-ermine"[^>]*><button[^>]*aria-checked="true"/);
    for (const id of ['field-1-fur-colour-1', 'field-1-fur-colour-2', 'swatch-field1-fur-1-argent', 'swatch-field1-fur-2-sable']) expect(html, id).toContain(id);
    expect(html).toContain('This is ermine (white with black spots).');
    // Spots have no arrangement to choose; the plain tinctures stay offered, none chosen while a fur is.
    expect(html).not.toContain('field-1-fur-layout');
    expect(html).toContain('swatch-field1-gules');
  });

  it('sets bells and crutch-heads in rows, base to base or in columns', () => {
    const d = setFur(DEFAULT_DESIGN, { k: 'field', part: 0 }, 'counter-vair');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d }));
    for (const id of ['field-1-fur-layout-plain', 'field-1-fur-layout-counter', 'field-1-fur-layout-en-pointe']) expect(ids(html), id).toContain(id);
    expect(html).toMatch(/data-testid="field-1-fur-layout-counter"[^>]*><button[^>]*aria-checked="true"/);
    expect(html).toContain('Base to base · counter-vair');
    // Counter-vair keeps its own colours.
    expect(html).not.toContain('field-1-fur-colour-1');
  });

  it('keeps the plain colours reachable with Tab while a fur is chosen: the first allowed swatch is the tab stop', () => {
    const d = setFur(DEFAULT_DESIGN, { k: 'field', part: 0 }, 'ermine');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d }));
    const stops = [...html.matchAll(/<button[^>]*id="swatch-field1-([a-z]+)"[^>]*>/g)].filter((m) => m[0].includes('tabindex="0"')).map((m) => m[1]);
    expect(stops).toEqual(['or']);
    // With a tincture chosen, the chosen one is the tab stop.
    const plain = renderToString(h(FieldStep, { ...fieldBase, design: DEFAULT_DESIGN }));
    const chosen = [...plain.matchAll(/<button[^>]*id="swatch-field1-([a-z]+)"[^>]*>/g)].filter((m) => m[0].includes('tabindex="0"')).map((m) => m[1]);
    expect(chosen).toHaveLength(1);
    expect(plain).toMatch(new RegExp(`id="swatch-field1-${chosen[0]}"[^>]*aria-checked="true"`));
  });

  it('gives each part of a divided background its own fur, the part chosen above it', () => {
    const d = setFur(setDivision(DEFAULT_DESIGN, 'per-pale'), { k: 'field', part: 1 }, 'vair');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d }));
    expect(html).toMatch(/data-testid="field-more-part-2"[^>]*><button[^>]*aria-checked="true"/);
    for (const id of ['field-more-part-1', 'field-2-fur-vair', 'field-2-fur-colour-1']) expect(ids(html), id).toContain(id);
    expect(ids(html)).not.toContain('field-1-fur-vair');
  });

  it('a three-part background shows three colour pickers and a third part switch', () => {
    const d = setFur(setDivision(DEFAULT_DESIGN, 'per-pall'), { k: 'field', part: 2 }, 'ermine');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d }));
    for (const id of ['field-tincture-1', 'field-tincture-2', 'field-tincture-3', 'field-more-part-1', 'field-more-part-2', 'field-more-part-3', 'field-3-fur-ermine']) expect(ids(html), id).toContain(id);
    expect(html).toMatch(/data-testid="field-more-part-3"[^>]*><button[^>]*aria-checked="true"/);
    expect(html).toMatch(/id="swatch-field3-or"/);
    // the third part's legend names it where it lies; two-part backgrounds keep two pickers
    expect(html).toContain('Right (sinister)');
    expect(ids(renderToString(h(FieldStep, { ...fieldBase, design: setDivision(DEFAULT_DESIGN, 'per-pale') })))).not.toContain('field-tincture-3');
  });

  it('gives every chip its own pattern id: the family row and the arrangement row both draw vair and potent', () => {
    for (const fur of ['vair', 'potent'] as const) {
      const html = renderToString(h(FieldStep, { ...fieldBase, design: setFur(DEFAULT_DESIGN, { k: 'field', part: 0 }, fur) }));
      const patternIds = [...html.matchAll(/<pattern[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
      expect(patternIds.filter((id) => id.startsWith('fur-chip-')).length, fur).toBeGreaterThan(3);
      expect(new Set(patternIds).size, fur).toBe(patternIds.length);
    }
  });
});

describe('the stripes and checks picker', () => {
  it('opens with the pattern chosen, a count for the counted ones and a picker for each of its two colours', () => {
    const barry = setVariation(DEFAULT_DESIGN, 'barry');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: barry }));
    expect(disclosures(html)).toEqual([{ testid: 'field-more', open: true }]);
    for (const id of ['field-pattern-barry', 'field-pattern-checky', 'field-pattern-paly-bendy', 'field-pattern-pieces-4', 'field-pattern-pieces-6', 'field-pattern-pieces-8', 'field-pattern-tincture-1', 'field-pattern-tincture-2', 'swatch-field-pattern-1-azure', 'swatch-field-pattern-2-or']) expect(html, id).toContain(id);
    expect(html).toContain('How many stripes');
    // The plain colour and the divisions are not chosen while a pattern is, and the plain colour picker gives way to the pattern's.
    expect(html).not.toContain('field-tincture-1');
    expect(renderToString(h(FieldStep, { ...fieldBase, design: setVariation(DEFAULT_DESIGN, 'checky') }))).not.toContain('field-pattern-pieces');
  });

  it('gives a patterned band its own pickers', () => {
    const d = setOrdinary(DEFAULT_DESIGN, 'fess');
    const band = setGroupVariation(d, ordinaryPath(d)!, 'barry');
    const html = renderToString(h(OrdinaryStep, { ...base, design: band }));
    for (const id of ['ordinary-tincture-mode-pattern', 'ordinary-tincture-pattern-lozengy', 'ordinary-tincture-pattern-pieces-8', 'ordinary-tincture-pattern-tincture-1', 'swatch-ordinary-or']) expect(html, id).toContain(id);
    expect(html).not.toContain('ordinary-tincture-split');
  });
});

describe('"More shapes and edges…" under the band', () => {
  const render = (d: Design) => renderToString(h(OrdinaryStep, { ...base, design: d }));

  it('draws no preview inside a closed disclosure, and the edge chips come the commonest first with a break after the eighth', () => {
    const closed = render(setOrdinary(DEFAULT_DESIGN, 'fess'));
    const inside = (markup: string) => /<details[^>]*class="more-paint more-shapes"[\s\S]*?<\/details>/.exec(markup)![0];
    expect(inside(closed)).not.toContain('<svg');
    expect(inside(closed)).not.toContain('icon-choice');
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const open = render(setOrdinaryLine(fess, ordinaryPath(fess)!, 'embattled'));
    const chips = [...open.matchAll(/\sid="ordinary-edge-([a-z]+)"/g)].map((m) => m[1]).filter((id) => id !== 'select' && !id.startsWith('side'));
    expect(chips.slice(0, 8)).toEqual(['plain', 'embattled', 'wavy', 'engrailed', 'indented', 'rayonny', 'invected', 'dovetailed']);
    expect(chips.length).toBeGreaterThan(8);
    const before = open.slice(0, open.indexOf('id="ordinary-edge-' + chips[8] + '"'));
    expect(before.lastIndexOf('icon-grid-break')).toBeGreaterThan(before.lastIndexOf('id="ordinary-edge-' + chips[7] + '"'));
    expect(open.match(/icon-grid-break/g)).toHaveLength(1);
  });

  it('is there closed from the start, with the More shapes row; a lined band opens it on its lines and edges', () => {
    expect(shapeDisclosures(render(DEFAULT_DESIGN))).toEqual([{ testid: 'ordinary-shape-more', open: false }]);
    expect(render(DEFAULT_DESIGN)).not.toContain('ordinary-more-select');
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const closed = render(fess);
    expect(shapeDisclosures(closed)).toEqual([{ testid: 'ordinary-shape-more', open: false }]);
    expect(closed).toContain('More shapes and edges…');
    expect(closed).not.toContain('ordinary-edge-select');
    const embattled = setOrdinaryLine(fess, ordinaryPath(fess)!, 'embattled');
    const open = render(embattled);
    expect(shapeDisclosures(open)).toEqual([{ testid: 'ordinary-shape-more', open: true }]);
    const got = ids(open);
    for (const id of ['ordinary-edge-select', 'ordinary-edge-plain', 'ordinary-edge-wavy', 'ordinary-edge-embattled', 'ordinary-edge-dancetty', 'ordinary-edge-side-both', 'ordinary-edge-side-a', 'ordinary-edge-side-b']) expect(got, id).toContain(id);
    expect(open).toContain('Top edge only');
    const collapsed = renderToString(h(OrdinaryStep, { ...base, accordion: { open: false, onToggle: noop }, design: embattled }));
    expect(collapsed).toMatch(/step-ordinary-summary">[^<]*, embattled, /);
    // A chief takes no dancetty and has one edge; a pale names its edges left and right.
    const chief = ids(render(setOrdinaryLine(setOrdinary(DEFAULT_DESIGN, 'chief'), ordinaryPath(setOrdinary(DEFAULT_DESIGN, 'chief'))!, 'wavy')));
    expect(chief).not.toContain('ordinary-edge-dancetty');
    expect(chief).not.toContain('ordinary-edge-side-both');
    const pale = setOrdinary(DEFAULT_DESIGN, 'pale');
    expect(render(setOrdinaryLine(pale, ordinaryPath(pale)!, 'wavy'))).toContain('Left edge only');
  });

  it('is closed by default and opens on a canton, whose tile is in the More shapes row (no main tile checked), with On the right', () => {
    const canton = setOrdinary(DEFAULT_DESIGN, 'canton');
    const html = render(canton);
    expect(shapeDisclosures(html)).toEqual([{ testid: 'ordinary-shape-more', open: true }]);
    const got = ids(html);
    for (const id of ['ordinary-more-select', 'ordinary-base', 'ordinary-point', 'ordinary-canton', 'ordinary-quarter', 'ordinary-gyron', 'ordinary-shape-sinister']) expect(got, id).toContain(id);
    expect(html).toMatch(/aria-checked="true"[^>]*id="ordinary-canton"/);
    expect(html).not.toMatch(/aria-checked="true"[^>]*id="ordinary-(none|fess|pale|bend|bend-sinister|chevron|cross|saltire|chief|bordure|pile)"/);
    expect(ids(render(setOrdinary(DEFAULT_DESIGN, 'base')))).not.toContain('ordinary-shape-sinister');
  });

  it('offers the orle, tressure, flaunches and gore in the More shapes row; a tressure has its Double · Triple row, a gore its On the right', () => {
    const tressure = setOrdinary(DEFAULT_DESIGN, 'tressure');
    const got = ids(render(tressure));
    for (const id of ['ordinary-orle', 'ordinary-tressure', 'ordinary-flaunches', 'ordinary-gore', 'ordinary-number', 'ordinary-number-2', 'ordinary-number-3']) expect(got, id).toContain(id);
    expect(render(tressure)).toMatch(/aria-checked="true"[^>]*id="ordinary-number-2"/);
    expect(got).not.toContain('ordinary-point-dexter');
    const gore = ids(render(setOrdinary(DEFAULT_DESIGN, 'gore')));
    expect(gore).toContain('ordinary-shape-sinister');
    expect(gore).not.toContain('ordinary-number-2');
  });

  it('draws a band thin from its Thin toggle, with a Two · Three · Four row; its tile stays checked and the disclosure open, and the baton has a tile', () => {
    const bend = setOrdinary(DEFAULT_DESIGN, 'bend');
    expect(ids(render(bend))).not.toContain('ordinary-number-2');
    const thin = setOrdinaryToggle(bend, ordinaryPath(bend)!, 'thin', true);
    const html = render(thin);
    expect(shapeDisclosures(html)).toEqual([{ testid: 'ordinary-shape-more', open: true }]);
    for (const id of ['ordinary-shape-thin', 'ordinary-number-2', 'ordinary-number-3', 'ordinary-number-4', 'ordinary-baton']) expect(ids(html), id).toContain(id);
    expect(html).toMatch(/aria-checked="true"[^>]*id="ordinary-bend"/);
    expect(html).toMatch(/aria-checked="true"[^>]*id="ordinary-number-2"/);
    expect(html).not.toContain('ordinary-outline-cotised');
  });

  it('offers the pall, label, fret, mount and trimount in the More shapes row (no tile for the pall inverted); a pall has its Upside down and Hollow toggles, which a pall inverted keeps checked on the pall tile', () => {
    const pall = setOrdinary(DEFAULT_DESIGN, 'pall');
    const got = ids(render(pall));
    for (const id of ['ordinary-pall', 'ordinary-label', 'ordinary-fret', 'ordinary-mount', 'ordinary-trimount', 'ordinary-shape-inverted', 'ordinary-shape-voided']) expect(got, id).toContain(id);
    expect(got).not.toContain('ordinary-pall-inverted');
    expect(got).not.toContain('ordinary-shape-couped');
    expect(render(pall)).toMatch(/aria-checked="true"[^>]*id="ordinary-pall"/);
    const turned = setOrdinaryToggle(pall, ordinaryPath(pall)!, 'inverted', true);
    expect(shapeDisclosures(render(turned))).toEqual([{ testid: 'ordinary-shape-more', open: true }]);
    expect(render(turned)).toMatch(/aria-checked="true"[^>]*id="ordinary-pall"/);
    expect(render(turned)).toMatch(/aria-pressed="true"[^>]*id="ordinary-shape-inverted"|id="ordinary-shape-inverted"[^>]*aria-pressed="true"/);
    expect(renderToString(h(OrdinaryStep, { ...base, accordion: { open: false, onToggle: noop }, design: turned }))).toMatch(/step-ordinary-summary">[^<]*upside down/);
    // a fret or a mount takes no toggle and no edge
    expect(ids(render(setOrdinary(DEFAULT_DESIGN, 'fret')))).not.toContain('ordinary-shape-inverted');
    expect(ids(render(setOrdinary(DEFAULT_DESIGN, 'mount')))).not.toContain('ordinary-edge-select');
  });

  it('the outline row and its colour picker appear inside the closed disclosure; cotises add their edge row', () => {
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const path = ordinaryPath(fess)!;
    const closed = render(fess);
    expect(shapeDisclosures(closed)).toEqual([{ testid: 'ordinary-shape-more', open: false }]);
    expect(ids(closed)).not.toContain('ordinary-outline-cotised');
    const edged = ids(render(setOrdinaryOutline(fess, path, 'fimbriated')));
    for (const id of ['ordinary-outline-select', 'ordinary-outline-none', 'ordinary-outline-fimbriated', 'ordinary-outline-cotised', 'ordinary-outline-doubly-cotised', 'ordinary-outline-triply-cotised', 'ordinary-outline-tincture', 'swatch-outline-argent']) expect(edged, id).toContain(id);
    expect(edged).not.toContain('ordinary-cotise-edge-select');
    expect(edged).not.toContain('swatch-outline-counterchanged');
    const cotised = setOrdinaryOutline(fess, path, 'cotised');
    const open = render(cotised);
    expect(shapeDisclosures(open)).toEqual([{ testid: 'ordinary-shape-more', open: true }]);
    const got = ids(open);
    for (const id of ['ordinary-outline-tincture', 'swatch-outline-argent', 'ordinary-cotise-edge-select', 'ordinary-cotise-edge-plain', 'ordinary-cotise-edge-wavy']) expect(got, id).toContain(id);
    expect(renderToString(h(OrdinaryStep, { ...base, accordion: { open: false, onToggle: noop }, design: cotised }))).toMatch(/step-ordinary-summary">[^<]*, cotised in [a-z ]+, /);
    // On a divided field the cotises may be counterchanged.
    const divided = setOrdinary(setDivision(DEFAULT_DESIGN, 'per-pale'), 'fess');
    expect(ids(render(setOrdinaryOutline(divided, ordinaryPath(divided)!, 'cotised')))).toContain('swatch-outline-counterchanged');
    // A top band or border has no outline.
    const chief = setOrdinary(DEFAULT_DESIGN, 'chief');
    expect(ids(render(setOrdinaryLine(chief, ordinaryPath(chief)!, 'wavy')))).not.toContain('ordinary-outline-select');
  });

  it('Hollow is a toggle of a cross, and opens the disclosure; a fess shows it blocked (review U-9)', () => {
    const cross = setOrdinary(DEFAULT_DESIGN, 'cross');
    expect(ids(render(setOrdinaryToggle(cross, ordinaryPath(cross)!, 'voided', true)))).toContain('ordinary-shape-voided');
    const fess = setOrdinaryToggle(setOrdinary(DEFAULT_DESIGN, 'fess'), ordinaryPath(setOrdinary(DEFAULT_DESIGN, 'fess'))!, 'couped', true);
    expect(ids(render(fess))).toContain('ordinary-shape-voided');
    expect(toggleChoices(fess, ordinaryPath(fess)!).find((c) => c.value === 'voided')).toMatchObject({ allowed: false, reason: expect.stringContaining('SENA A3C') });
  });

  it('a top band and a border have an "Edge…" disclosure', () => {
    const framed = addLayer(addLayer(setOrdinary(DEFAULT_DESIGN, 'fess'), 'chief'), 'bordure');
    for (const place of ['chief', 'bordure'] as const) {
      const html = renderToString(h(LayerStep, { ...base, design: framed, place, n: 4, onAdjust: noop }));
      expect(shapeDisclosures(html)).toEqual([{ testid: `${place}-shape-more`, open: false }]);
      expect(html).toContain('Edge…');
    }
    const lined = setOrdinaryLine(framed, pathOfPlace(framed, 'bordure')!, 'engrailed');
    const html = renderToString(h(LayerStep, { ...base, design: lined, place: 'bordure', n: 4, onAdjust: noop }));
    expect(shapeDisclosures(html)).toEqual([{ testid: 'bordure-shape-more', open: true }]);
    expect(ids(html)).toContain('bordure-edge-engrailed');
  });

  it('lists triangular on a chief, rompu on a chevron and bevilled on a bend and a field per bend — and on no other host', () => {
    const edged = (type: Parameters<typeof setOrdinary>[1]) => { const d = setOrdinary(DEFAULT_DESIGN, type); return ids(render(setOrdinaryLine(d, ordinaryPath(d)!, 'wavy'))); };
    expect(edged('chief')).toContain('ordinary-edge-triangular');
    expect(edged('chevron')).toContain('ordinary-edge-rompu');
    expect(edged('bend')).toContain('ordinary-edge-bevilled');
    expect(edged('bend-sinister')).toContain('ordinary-edge-bevilled');
    for (const type of ['fess', 'pale', 'cross', 'bordure'] as const) for (const id of ['triangular', 'rompu', 'bevilled']) expect(edged(type), `${type} ${id}`).not.toContain(`ordinary-edge-${id}`);
    expect(edged('chief')).not.toContain('ordinary-edge-rompu');
    expect(edged('chevron')).toContain('ordinary-edge-ploye');
    expect(edged('pile')).toContain('ordinary-edge-ploye');
    const chiefCard = renderToString(h(LayerStep, { ...base, design: setOrdinaryLine(addLayer(setOrdinary(DEFAULT_DESIGN, 'fess'), 'chief'), pathOfPlace(addLayer(setOrdinary(DEFAULT_DESIGN, 'fess'), 'chief'), 'chief')!, 'wavy'), place: 'chief', n: 4, onAdjust: noop }));
    expect(ids(chiefCard)).toContain('chief-edge-triangular');
    const background = (division: Parameters<typeof setDivision>[1]) => ids(renderToString(h(FieldStep, { ...fieldBase, design: setFieldLine(setDivision(DEFAULT_DESIGN, division), 'wavy') })));
    expect(background('per-bend')).toContain('field-edge-bevilled');
    expect(background('per-bend-sinister')).toContain('field-edge-bevilled');
    expect(background('per-pale')).not.toContain('field-edge-bevilled');
  });
});

describe('"Facing, turning and details…" under the picture', () => {
  const render = (d: Design, accordion: { open: boolean; onToggle: () => void } | null = null) => renderToString(h(ChargesStep, { ...base, accordion, n: 3, design: d, onAdjust: noop, adjusted: null }));
  const disclosure = (markup: string) => [...markup.matchAll(/<details[^>]*data-testid="charge-more"[^>]*>/g)].map((m) => ({ open: /\sopen/.test(m[0]) }));
  const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
  const twoLions = (layout: string) => { const d = setCount(lion, picturePath(lion)!, 2); return withLayout(d, picturePath(d)!, layout); };

  it('is one closed row for a charge that faces, drawn empty, and absent for one that does not', () => {
    expect(disclosure(render(lion))).toEqual([{ open: false }]);
    expect(render(lion)).toContain('Facing, turning and details…');
    for (const id of ['facing', 'facing-to-sinister', 'gaze', 'pair']) expect(ids(render(lion)), id).not.toContain(id);
    for (const id of ['sun', 'gear', 'annulet'] as const) expect(ids(render(setCharge(DEFAULT_DESIGN, 'picture', id))), id).not.toContain('charge-more');
  });

  it('opens on a picture facing right, with Facing out and the head turns blocked, and the summary says so', () => {
    const contourny = setFacing(lion, picturePath(lion)!, 'to-sinister');
    const html = render(contourny);
    expect(disclosure(html)).toEqual([{ open: true }]);
    for (const id of ['facing-to-dexter', 'facing-to-sinister', 'facing-affronty', 'gaze-none', 'gaze-guardant', 'gaze-regardant']) expect(ids(html), id).toContain(id);
    expect(html).toMatch(/aria-checked="true"[^>]*id="facing-to-sinister"/);
    expect(html).toMatch(/data-testid="facing-affronty" data-blocked="true"/);
    expect(html).not.toMatch(/data-testid="gaze-guardant" data-blocked="true"/);
    expect(render(setPosture(contourny, picturePath(lion)!, 'couchant'))).toMatch(/data-testid="gaze-guardant" data-blocked="true"/);
    expect(ids(html)).not.toContain('pair');
    expect(render(contourny, { open: false, onToggle: noop })).toMatch(/step-charges-summary">1 lion, gold, facing right</);
  });

  it('offers the Pair row for two that face side by side, blocked with a reason when they are not, and shows a pair as in fess', () => {
    const inFess = render(twoLions('in-fess'));
    for (const id of ['pair-same', 'pair-respectant', 'pair-addorsed']) expect(ids(render(setFacing(twoLions('in-fess'), picturePath(lion)!, 'to-sinister'))), id).toContain(id);
    expect(disclosure(inFess)).toEqual([{ open: false }]);
    const inPale = render(setFacing(twoLions('in-pale'), picturePath(lion)!, 'to-sinister'));
    expect(inPale).toMatch(/data-testid="pair-addorsed" data-blocked="true"/);
    expect(inPale).toContain('Lay the two lions side by side (in fess) first.');
    const pair = setPair(twoLions('in-fess'), picturePath(lion)!, 'combattant');
    const html = render(pair);
    expect(disclosure(html)).toEqual([{ open: true }]);
    expect(html).toMatch(/aria-checked="true"[^>]*id="pair-respectant"/);
    expect(html).toMatch(/data-testid="facing-to-sinister" data-blocked="true"/);
    expect(html).toContain('<option selected value="in-fess">');
    expect(html).not.toContain('pair-combattant');
    expect(render(pair, { open: false, onToggle: noop })).toMatch(/step-charges-summary">2 lions, gold, facing each other</);
  });
});

describe('the Turned row under the picture', () => {
  const render = (d: Design, accordion: { open: boolean; onToggle: () => void } | null = null) => renderToString(h(ChargesStep, { ...base, accordion, n: 3, design: d, onAdjust: noop, adjusted: null }));
  const disclosure = (markup: string) => [...markup.matchAll(/<details[^>]*data-testid="charge-more"[^>]*>/g)].map((m) => ({ open: /\sopen/.test(m[0]) }));
  type Id = Parameters<typeof setCharge>[2];
  const pictured = (id: Id) => setCharge(DEFAULT_DESIGN, 'picture', id);
  /** The picture with an orientation set, so that its disclosure is open and the row drawn. */
  const turned = (id: Id, orientation: 'palewise' | 'inverted' | 'fesswise', count = 1) => {
    const d = setCount(pictured(id), picturePath(pictured(id))!, count);
    return setOrientation(d, picturePath(d)!, orientation);
  };
  const turnedIds = (markup: string) => [...ids(markup)].filter((id) => id.startsWith('turned-'));

  it('is a closed disclosure for a charge that turns, and absent for one that does not turn or face', () => {
    for (const id of ['sword', 'mullet', 'crescent'] as const) expect(disclosure(render(pictured(id))), id).toEqual([{ open: false }]);
    for (const id of ['sun', 'annulet'] as const) expect(disclosure(render(pictured(id))), id).toEqual([]);
    expect(turnedIds(render(pictured('sword')))).toEqual([]);
    expect(turnedIds(render(pictured('lion')))).toEqual([]);
  });

  it('lists as usual first, then the ways the charge takes, and blocks the others with their reason', () => {
    const sword = render(turned('sword', 'palewise'));
    expect(turnedIds(sword).slice(0, 3)).toEqual(['turned-none', 'turned-palewise', 'turned-fesswise']);
    for (const id of ['turned-fesswise-reversed', 'turned-bendwise-sinister-inverted', 'turned-inverted', 'turned-to-center']) expect(turnedIds(sword), id).toContain(id);
    expect(turnedIds(sword)).not.toContain('turned-reversed');
    expect(turnedIds(render(turned('key', 'palewise')))).toContain('turned-reversed');
    expect(sword).toMatch(/data-testid="turned-to-center" data-blocked="true"/);
    expect(sword).toContain('One sword has no group to point to the middle of.');
    expect(render(turned('sword', 'palewise', 3))).not.toMatch(/data-testid="turned-to-center" data-blocked/);
    const mullet = render(turned('mullet', 'inverted'));
    expect(turnedIds(mullet)).toEqual(['turned-none', 'turned-palewise', 'turned-inverted']);
    expect(mullet).not.toMatch(/data-testid="turned-inverted" data-blocked/);
  });

  it('opens on a turned picture, and the summary says how it lies', () => {
    const flat = turned('sword', 'fesswise');
    const html = render(flat);
    expect(disclosure(html)).toEqual([{ open: true }]);
    expect(html).toMatch(/aria-checked="true"[^>]*id="turned-fesswise"/);
    expect(render(flat, { open: false, onToggle: noop })).toMatch(/step-charges-summary">1 sword, gold, lying flat</);
  });
});

describe('the Details disclosure under the picture', () => {
  const render = (d: Design) => renderToString(h(ChargesStep, { ...base, accordion: null, n: 3, design: d, onAdjust: noop, adjusted: null }));
  const opened = (markup: string, testid: string) => [...markup.matchAll(new RegExp(`<details[^>]*data-testid="${testid}"[^>]*>`, 'g'))].map((m) => ({ open: /\sopen/.test(m[0]) }));
  type Id = Parameters<typeof setCharge>[2];
  const pictured = (id: Id) => setCharge(DEFAULT_DESIGN, 'picture', id);
  const sixPoints = setModifier(pictured('mullet'), [0], 'of-points', true, { count: 6, paint: null });

  it('is closed by default, and there only for a charge that has details', () => {
    for (const id of ['mullet', 'roundel', 'cross-formy'] as const) expect(opened(render(pictured(id)), 'charge-more'), id).toEqual([{ open: false }]);
    // the outer disclosure draws its body only when open: a turned mullet shows the Details closed inside it
    expect(opened(render(setOrientation(pictured('mullet'), [0], 'inverted')), 'charge-details')).toEqual([{ open: false }]);
    expect(opened(render(setOrientation(pictured('key'), [0], 'fesswise')), 'charge-details')).toEqual([]);
    // every beast that faces now takes a piece (the hare wings and a collar): the Details are there, closed
    expect(opened(render(setFacing(pictured('hare'), [0], 'to-sinister')), 'charge-details')).toEqual([{ open: false }]);
  });

  it('opens for a mullet of six points: the points 4 to 12, the drawn five marked, and the detail toggles', () => {
    const html = render(sixPoints);
    expect(opened(html, 'charge-more')).toEqual([{ open: true }]);
    expect(opened(html, 'charge-details')).toEqual([{ open: true }]);
    expect([...ids(html)].filter((id) => id.startsWith('points-'))).toEqual(['points-4', 'points-5', 'points-6', 'points-7', 'points-8', 'points-9', 'points-10', 'points-11', 'points-12']);
    expect(html).toMatch(/aria-checked="true"[^>]*id="points-6"/);
    expect(html).toContain('5 (usual)');
    for (const id of ['mod-voided', 'mod-fimbriated', 'mod-pierced']) expect(ids(html), id).toContain(id);
    expect(ids(html)).not.toContain('mod-fimbriated-tincture');
  });

  it('shows the Shape row for a charge drawn as a demi charge or a head, and the Cut row for a head only', () => {
    const lion = pictured('lion');
    expect(opened(render(lion), 'charge-more')).toEqual([{ open: false }]);
    const demi = setForm(lion, [0], 'demi');
    expect(opened(render(demi), 'charge-details')).toEqual([{ open: true }]);
    expect([...ids(render(demi))].filter((id) => id.startsWith('form-') || id.startsWith('cut-'))).toEqual(['form-whole', 'form-demi', 'form-head']);
    expect(render(demi)).toMatch(/aria-checked="true"[^>]*id="form-demi"/);
    const head = setCut(setForm(lion, [0], 'head'), [0], 'erased');
    expect([...ids(render(head))].filter((id) => id.startsWith('cut-'))).toEqual(['cut-couped', 'cut-erased']);
    expect(render(head)).toMatch(/aria-checked="true"[^>]*id="cut-erased"/);
    for (const id of ['sword', 'mullet', 'sun'] as const) expect([...ids(render(pictured(id)))].filter((x) => x.startsWith('form-')), id).toEqual([]);
    // a head or demi charge has no pose: the Pose select says so instead of standing empty (D7b's deferred blank select)
    expect(render(demi)).toMatch(/<select[^>]*data-testid="posture-select" disabled><option selected value>No pose \(front half\)<\/option><\/select>/);
    expect(render(head)).toContain('No pose (head only)');
    expect(render(lion)).not.toContain('No pose');
  });

  it('is closed for a lion, and opens for a crowned lion: the piece toggles, the crown\'s colour, wings blocked where the drawing has none', () => {
    const lion = pictured('lion');
    expect(opened(render(setFacing(lion, [0], 'to-sinister')), 'charge-details')).toEqual([{ open: false }]);
    const crowned = setPart(lion, [0], 'crowned', true);
    const html = render(crowned);
    expect(opened(html, 'charge-more')).toEqual([{ open: true }]);
    expect(opened(html, 'charge-details')).toEqual([{ open: true }]);
    expect([...ids(html)].filter((id) => /^(mod|part)-/.test(id))).toEqual(['mod-winged', 'part-crowned', 'part-collared', 'part-crowned-tincture']);
    expect(html).toMatch(/aria-pressed="true"[^>]*id="part-crowned"/);
    expect(html).toMatch(/id="swatch-crowned-gules"[^>]*aria-checked="true"/);
    expect(html).toContain('Colour of the crown');
    expect(render(setPart(setPosture(lion, [0], 'sejant'), [0], 'crowned', true))).toMatch(/data-testid="mod-winged" data-blocked="true"/);
    const enflamed = render(setModifier(pictured('heart'), [0], 'enflamed', true));
    expect(enflamed).toMatch(/aria-checked="true"[^>]*id="mod-enflamed-proper"/);
    expect(ids(enflamed)).toContain('mod-enflamed-tincture');
  });

  it('holds the Holding select for a main charge that holds things, and while it holds one the way it does and the item\'s colour (PLAN-D §3 D9d)', () => {
    const html = render(setHold(pictured('lion'), [0], 'sword'));
    expect(opened(html, 'charge-details')).toEqual([{ open: true }]);
    expect([...ids(html)].filter((id) => id.startsWith('hold-'))).toEqual(['hold-select', 'hold-how', 'hold-how-maintaining', 'hold-how-sustaining', 'hold-how-in-mouth', 'hold-proper-select', 'hold-proper', 'hold-tincture']);
    expect(html).toContain('<option selected value="sword">');
    // natural colours only for an item that has them (D16b): a sword, not a key
    expect(render(setHold(pictured('lion'), [0], 'sword', 'maintaining', { k: 'proper' }))).toMatch(/aria-checked="true"[^>]*id="hold-proper"/);
    expect(ids(render(setHold(pictured('lion'), [0], 'key')))).not.toContain('hold-proper');
    expect(html).toMatch(/aria-checked="true"[^>]*id="hold-how-maintaining"/);
    expect(html).toMatch(/id="swatch-held-argent"[^>]*aria-checked="true"/);
    expect(html).toContain('Colour of the sword');
    // a mullet holds nothing: no Holding select, though its Details are open
    const mullet = render(setModifier(pictured('mullet'), [0], 'voided', true));
    expect(opened(mullet, 'charge-details')).toEqual([{ open: true }]);
    expect(ids(mullet)).not.toContain('hold-select');
    // a demi lion has no paw: the select is there, switched off, and says why
    const demi = render(setForm(pictured('lion'), [0], 'demi'));
    expect(demi).toMatch(/<select(?=[^>]*data-testid="hold-select")[^>]*disabled/);
    expect(demi).toContain('The demi-lion is not drawn holding anything in this builder.');
    expect(ids(demi)).not.toContain('hold-how');
  });

  it('shows the edging\'s tincture while fimbriated, blocks what does not stand out, and explains a refused toggle', () => {
    const lozenge = setModifier(pictured('lozenge'), [0], 'fimbriated', true);
    const html = render(lozenge);
    expect(opened(html, 'charge-details')).toEqual([{ open: true }]);
    expect(ids(html)).toContain('mod-fimbriated-tincture');
    expect(html).toMatch(/aria-pressed="true"[^>]*id="mod-fimbriated"/);
    expect(html).toMatch(/data-testid="swatch-fimbriation-gules" data-blocked="true"/);
    expect(html).toMatch(/data-testid="mod-voided" data-blocked="true"/);
    const badge = setModifier(setCharge(setBadge(DEFAULT_DESIGN), 'picture', 'mullet'), [0], 'pierced', true);
    expect(render(badge)).toContain('A fieldless badge has no field to show through a voided charge (SENA A3C).');
  });
});
