// The builder steps rendered to markup: the default flow (Background → Band or shape → Picture) keeps its
// test ids, and the new controls (More… counts, splendour, extra pictures) appear only when they apply.

import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { ChargesStep, FieldStep, OrdinaryStep } from '../src/components/design/BuilderSteps';
import { AddLayer } from '../src/components/design/AddLayer';
import { LayerStep } from '../src/components/design/LayerStep';
import { setCharge, setDivision, setOrdinary, setGroupTincture, setVariation, ordinaryPath, picturePath, DEFAULT_DESIGN } from '../src/lib/builder';
import { addLayer, layerChoices, layersIn, removeLayer, setFur, setGroupVariation, setProper, setSemy, setTreatment, splitGroup, type Design } from '../src/lib/heraldry';
import { setCount } from './helpers';

const noop = () => {};
const base = { onChange: noop, issues: [], accordion: null };
const fieldBase = { ...base, onBadge: noop, notice: null };
const ids = (markup: string) => new Set([...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]));

const field = (d: Design) => ids(renderToString(h(FieldStep, { ...fieldBase, design: d, shape: 'heater' })));
const ordinary = (d: Design) => ids(renderToString(h(OrdinaryStep, { ...base, design: d, shape: 'heater' })));
const picture = (d: Design) => ids(renderToString(h(ChargesStep, { ...base, n: 3, design: d, onAdjust: noop, adjusted: null, compact: false })));

describe('the default flow keeps its test ids', () => {
  it('Background', () => {
    const got = field(DEFAULT_DESIGN);
    for (const id of ['step-field', 'field-division-select', 'field-kind-plain', 'division-per-pale', 'division-quarterly', 'field-tincture-1', 'swatch-field1-azure']) expect(got, id).toContain(id);
    expect(got).not.toContain('field-tincture-2');
    // Beyond phase A's tiles and colours, only the Badge tile and the one closed "More colours and patterns…".
    const phaseA = [...got].filter((id) => !/^(division-badge|field-more)$/.test(id));
    expect(phaseA.every((id) => /^(step-field|field-division-select|field-kind-plain|division-[a-z-]+|field-tincture-1|swatch-field1-[a-z]+|tl-field1)$/.test(id)), phaseA.join()).toBe(true);
    expect(got.size - phaseA.length).toBe(2);
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

describe('controls that appear only when they apply', () => {
  it('holds counts above six behind More…, open when one is chosen', () => {
    const d = setCharge(DEFAULT_DESIGN, 'picture', 'mullet');
    const closed = renderToString(h(ChargesStep, { ...base, n: 3, design: d, onAdjust: noop, adjusted: null, compact: false }));
    expect(closed).toContain('data-testid="count-more"');
    expect(closed).toMatch(/<details[^>]*data-testid="count-more"(?![^>]*\sopen)/);
    expect(ids(closed)).toContain('count-12');
    const open = renderToString(h(ChargesStep, { ...base, n: 3, design: setCount(d, picturePath(d)!, 8), onAdjust: noop, adjusted: null, compact: false }));
    expect(open).toMatch(/<details[^>]*data-testid="count-more"[^>]*\sopen/);
  });

  it('hides More… when none of its counts is allowed, unless one is chosen', () => {
    const onBand = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const html = renderToString(h(ChargesStep, { ...base, n: 3, design: onBand, onAdjust: noop, adjusted: null, compact: false }));
    expect(ids(html)).toContain('count-6');
    expect(ids(html)).not.toContain('count-more');
    expect(ids(html)).not.toContain('count-12');
  });

  it('says once that the greyed-out layouts have no room', () => {
    const d = setCount(setCharge(DEFAULT_DESIGN, 'picture', 'mullet'), [0], 8);
    const html = renderToString(h(ChargesStep, { ...base, n: 3, design: d, onAdjust: noop, adjusted: null, compact: false }));
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
    expect(renderToString(h(ChargesStep, { ...base, n: 3, design: addLayer(pictured, 'bordure'), onAdjust: noop, adjusted: null, compact: false }))).not.toContain('peripheral-picture-note');
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

describe('"More colours and patterns…"', () => {
  it('is the one closed disclosure per colour of the default flow, which shows nothing else beyond the colours', () => {
    const lion = setCharge(setOrdinary(DEFAULT_DESIGN, 'bend'), 'picture', 'lion');
    expect(disclosures(renderToString(h(FieldStep, { ...fieldBase, design: DEFAULT_DESIGN, shape: 'heater' })))).toEqual([{ testid: 'field-more', open: false }]);
    expect(disclosures(renderToString(h(FieldStep, { ...fieldBase, design: setDivision(DEFAULT_DESIGN, 'per-pale'), shape: 'heater' })))).toEqual([{ testid: 'field-more', open: false }]);
    expect(disclosures(renderToString(h(OrdinaryStep, { ...base, design: lion, shape: 'heater' })))).toEqual([{ testid: 'ordinary-tincture-more', open: false }]);
    const step3 = renderToString(h(ChargesStep, { ...base, n: 3, design: lion, onAdjust: noop, adjusted: null, compact: false }));
    expect(disclosures(step3)).toEqual([{ testid: 'charge-tincture-more', open: false }]);
    // Nothing of a fur, a pattern, a scatter, brick, a split or natural colours is drawn until it is asked for.
    for (const html of [step3, renderToString(h(FieldStep, { ...fieldBase, design: DEFAULT_DESIGN, shape: 'heater' }))]) {
      expect(html).not.toMatch(/-(fur|pattern|semy|treatment|split|proper|mode)-/);
    }
  });

  it('opens on what the paint is, offering only the kinds the target can take', () => {
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const furred = setFur(fess, { k: 'group', path: ordinaryPath(fess)! }, 'ermine');
    const band = renderToString(h(OrdinaryStep, { ...base, design: furred, shape: 'heater' }));
    expect(disclosures(band)).toEqual([{ testid: 'ordinary-tincture-more', open: true }]);
    const modes = [...band.matchAll(/data-testid="ordinary-tincture-mode-([a-z]+)"/g)].map((m) => m[1]);
    expect(modes).toEqual(['split', 'fur', 'pattern', 'scatter', 'treatment']);
    expect(band).toMatch(/data-testid="ordinary-tincture-mode-fur"[^>]*><button[^>]*aria-checked="true"/);
    // A lion has natural colours and can't be strewn.
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    const proper = setProper(lion, picturePath(lion)!);
    const picture = renderToString(h(ChargesStep, { ...base, n: 3, design: proper, onAdjust: noop, adjusted: null, compact: false }));
    expect([...picture.matchAll(/data-testid="charge-tincture-mode-([a-z]+)"/g)].map((m) => m[1])).toEqual(['split', 'fur', 'pattern', 'treatment', 'natural']);
    expect(picture).toMatch(/data-testid="charge-tincture-proper"[^>]*><button[^>]*aria-checked="true"/);
    // The background offers its own kinds: no split (that is the division tiles) and no natural colours.
    const ermine = renderToString(h(FieldStep, { ...fieldBase, design: setFur(DEFAULT_DESIGN, { k: 'field', part: 0 }, 'ermine'), shape: 'heater' }));
    expect([...ermine.matchAll(/data-testid="field-mode-([a-z]+)"/g)].map((m) => m[1])).toEqual(['fur', 'pattern', 'scatter', 'treatment']);
  });

  it('keeps a scatter or brick when a colour is picked above: the picker sets the colour under it', () => {
    const strewn = setSemy(DEFAULT_DESIGN, { k: 'field', part: 0 }, 'mullet');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: strewn, shape: 'heater' }));
    expect(html).toMatch(/data-testid="swatch-field1-azure"[^>]*><button[^>]*aria-checked="true"/);
    // The picker above is the colour it is strewn on, so the scatter offers only the colour of its pictures.
    expect(ids(html)).toContain('field-1-semy-colour-2');
    expect(ids(html)).not.toContain('field-1-semy-colour-1');
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const masoned = setTreatment(fess, { k: 'group', path: ordinaryPath(fess)! }, 'masoned');
    const band = renderToString(h(OrdinaryStep, { ...base, design: masoned, shape: 'heater' }));
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
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d, shape: 'heater' }));
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
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d, shape: 'heater' }));
    for (const id of ['field-1-fur-layout-plain', 'field-1-fur-layout-counter', 'field-1-fur-layout-en-pointe']) expect(ids(html), id).toContain(id);
    expect(html).toMatch(/data-testid="field-1-fur-layout-counter"[^>]*><button[^>]*aria-checked="true"/);
    expect(html).toContain('Base to base · counter-vair');
    // Counter-vair keeps its own colours.
    expect(html).not.toContain('field-1-fur-colour-1');
  });

  it('keeps the plain colours reachable with Tab while a fur is chosen: the first allowed swatch is the tab stop', () => {
    const d = setFur(DEFAULT_DESIGN, { k: 'field', part: 0 }, 'ermine');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d, shape: 'heater' }));
    const stops = [...html.matchAll(/<button[^>]*id="swatch-field1-([a-z]+)"[^>]*>/g)].filter((m) => m[0].includes('tabindex="0"')).map((m) => m[1]);
    expect(stops).toEqual(['or']);
    // With a tincture chosen, the chosen one is the tab stop.
    const plain = renderToString(h(FieldStep, { ...fieldBase, design: DEFAULT_DESIGN, shape: 'heater' }));
    const chosen = [...plain.matchAll(/<button[^>]*id="swatch-field1-([a-z]+)"[^>]*>/g)].filter((m) => m[0].includes('tabindex="0"')).map((m) => m[1]);
    expect(chosen).toHaveLength(1);
    expect(plain).toMatch(new RegExp(`id="swatch-field1-${chosen[0]}"[^>]*aria-checked="true"`));
  });

  it('gives each part of a divided background its own fur, the part chosen above it', () => {
    const d = setFur(setDivision(DEFAULT_DESIGN, 'per-pale'), { k: 'field', part: 1 }, 'vair');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: d, shape: 'heater' }));
    expect(html).toMatch(/data-testid="field-more-part-2"[^>]*><button[^>]*aria-checked="true"/);
    for (const id of ['field-more-part-1', 'field-2-fur-vair', 'field-2-fur-colour-1']) expect(ids(html), id).toContain(id);
    expect(ids(html)).not.toContain('field-1-fur-vair');
  });

  it('gives every chip its own pattern id: the family row and the arrangement row both draw vair and potent', () => {
    for (const fur of ['vair', 'potent'] as const) {
      const html = renderToString(h(FieldStep, { ...fieldBase, design: setFur(DEFAULT_DESIGN, { k: 'field', part: 0 }, fur), shape: 'heater' }));
      const patternIds = [...html.matchAll(/<pattern[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
      expect(patternIds.filter((id) => id.startsWith('fur-chip-')).length, fur).toBeGreaterThan(3);
      expect(new Set(patternIds).size, fur).toBe(patternIds.length);
    }
  });
});

describe('the stripes and checks picker', () => {
  it('opens with the pattern chosen, a count for the counted ones and a picker for each of its two colours', () => {
    const barry = setVariation(DEFAULT_DESIGN, 'barry');
    const html = renderToString(h(FieldStep, { ...fieldBase, design: barry, shape: 'heater' }));
    expect(disclosures(html)).toEqual([{ testid: 'field-more', open: true }]);
    for (const id of ['field-pattern-barry', 'field-pattern-checky', 'field-pattern-paly-bendy', 'field-pattern-pieces-4', 'field-pattern-pieces-6', 'field-pattern-pieces-8', 'field-pattern-tincture-1', 'field-pattern-tincture-2', 'swatch-field-pattern-1-azure', 'swatch-field-pattern-2-or']) expect(html, id).toContain(id);
    expect(html).toContain('How many stripes');
    // The plain colour and the divisions are not chosen while a pattern is, and the plain colour picker gives way to the pattern's.
    expect(html).not.toContain('field-tincture-1');
    expect(renderToString(h(FieldStep, { ...fieldBase, design: setVariation(DEFAULT_DESIGN, 'checky'), shape: 'heater' }))).not.toContain('field-pattern-pieces');
  });

  it('gives a patterned band its own pickers', () => {
    const d = setOrdinary(DEFAULT_DESIGN, 'fess');
    const band = setGroupVariation(d, ordinaryPath(d)!, 'barry');
    const html = renderToString(h(OrdinaryStep, { ...base, design: band, shape: 'heater' }));
    for (const id of ['ordinary-tincture-mode-pattern', 'ordinary-tincture-pattern-lozengy', 'ordinary-tincture-pattern-pieces-8', 'ordinary-tincture-pattern-tincture-1', 'swatch-ordinary-or']) expect(html, id).toContain(id);
    expect(html).not.toContain('ordinary-tincture-split');
  });
});
