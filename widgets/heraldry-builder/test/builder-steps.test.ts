// The builder steps rendered to markup: the default flow (Background → Band or shape → Picture) keeps its
// test ids, and the new controls (More… counts, splendour, extra pictures) appear only when they apply.

import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { AddExtraLayer, ChargesStep, ExtraStep, FieldStep, OrdinaryStep, PeripheralStep } from '../src/components/design/BuilderSteps';
import { setCharge, setOrdinary, setGroupTincture, picturePath, DEFAULT_DESIGN } from '../src/lib/builder';
import { addLayer, type Design } from '../src/lib/heraldry';
import { setCount } from './helpers';

const noop = () => {};
const base = { onChange: noop, issues: [], accordion: null };
const ids = (markup: string) => new Set([...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]));

const field = (d: Design) => ids(renderToString(h(FieldStep, { ...base, design: d, shape: 'heater' })));
const ordinary = (d: Design) => ids(renderToString(h(OrdinaryStep, { ...base, design: d, shape: 'heater' })));
const picture = (d: Design) => ids(renderToString(h(ChargesStep, { ...base, design: d, onAdjust: noop, adjusted: null, compact: false })));

describe('the default flow keeps its test ids', () => {
  it('Background', () => {
    const got = field(DEFAULT_DESIGN);
    for (const id of ['step-field', 'field-division-select', 'field-kind-plain', 'division-per-pale', 'division-quarterly', 'field-tincture-1', 'swatch-field1-azure']) expect(got, id).toContain(id);
    expect(got).not.toContain('field-tincture-2');
    expect(field(DEFAULT_DESIGN)).toEqual(got);
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
    const closed = renderToString(h(ChargesStep, { ...base, design: d, onAdjust: noop, adjusted: null, compact: false }));
    expect(closed).toContain('data-testid="count-more"');
    expect(closed).toMatch(/<details[^>]*data-testid="count-more"(?![^>]*\sopen)/);
    expect(ids(closed)).toContain('count-12');
    const open = renderToString(h(ChargesStep, { ...base, design: setCount(d, picturePath(d)!, 8), onAdjust: noop, adjusted: null, compact: false }));
    expect(open).toMatch(/<details[^>]*data-testid="count-more"[^>]*\sopen/);
  });

  it('hides More… when none of its counts is allowed, unless one is chosen', () => {
    const onBand = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const html = renderToString(h(ChargesStep, { ...base, design: onBand, onAdjust: noop, adjusted: null, compact: false }));
    expect(ids(html)).toContain('count-6');
    expect(ids(html)).not.toContain('count-more');
    expect(ids(html)).not.toContain('count-12');
  });

  it('says once that the greyed-out layouts have no room', () => {
    const d = setCount(setCharge(DEFAULT_DESIGN, 'picture', 'mullet'), [0], 8);
    const html = renderToString(h(ChargesStep, { ...base, design: d, onAdjust: noop, adjusted: null, compact: false }));
    expect(html.match(/Greyed-out layouts have no room for eight mullets\./g)).toHaveLength(1);
    expect(html).not.toContain("There isn't room");
  });

  it('offers the face of a sun, and nothing for other charges', () => {
    expect(picture(setCharge(DEFAULT_DESIGN, 'picture', 'sun'))).toContain('splendour-toggle');
    expect(picture(setCharge(DEFAULT_DESIGN, 'picture', 'lion'))).not.toContain('splendour-toggle');
  });

  it('offers extra pictures on a band, with their own controls once added', () => {
    const band = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const toned = setGroupTincture(band, picturePath(band)!, 'argent');
    const add = renderToString(h(AddExtraLayer, { design: toned, onChange: noop }));
    expect(add).toContain('data-testid="add-extra-picture"');
    expect(add).toContain('Add pictures on the band');
    expect(renderToString(h(AddExtraLayer, { design: DEFAULT_DESIGN, onChange: noop }))).toBe('');

    const withExtra = setCharge(toned, 'on-ordinary', 'mullet');
    expect(renderToString(h(AddExtraLayer, { design: withExtra, onChange: noop }))).not.toContain('add-extra-picture');
    const got = ids(renderToString(h(ExtraStep, { ...base, design: withExtra, n: 4, onAdjust: noop })));
    for (const id of ['step-extra', 'extra-charge-select', 'extra-count-select', 'extra-count-1', 'extra-arrangement-select', 'extra-charge-tincture', 'remove-extra-picture']) expect(got, id).toContain(id);
    expect(got).not.toContain('extra-placement-select');
    expect(renderToString(h(ExtraStep, { ...base, design: toned, n: 4, onAdjust: noop }))).toBe('');
  });

  it('offers a top band and a border beside a band, with their own controls once added', () => {
    const band = setOrdinary(DEFAULT_DESIGN, 'chevron');
    const add = renderToString(h(AddExtraLayer, { design: band, onChange: noop }));
    expect(add).toContain('data-testid="add-peripheral-chief"');
    expect(add).toContain('Add a top band (chief)');
    expect(add).toContain('data-testid="add-peripheral-bordure"');
    expect(add).toContain('Add a border (bordure)');
    expect(add).not.toContain('add-extra-picture');

    const bordered = addLayer(band, 'bordure');
    expect(renderToString(h(AddExtraLayer, { design: bordered, onChange: noop }))).not.toContain('add-peripheral-bordure');
    expect(renderToString(h(AddExtraLayer, { design: bordered, onChange: noop }))).toContain('add-peripheral-chief');
    const got = ids(renderToString(h(PeripheralStep, { ...base, design: bordered, place: 'bordure', n: 4 })));
    for (const id of ['step-peripheral-bordure', 'peripheral-tincture-bordure', 'remove-peripheral-bordure']) expect(got, id).toContain(id);
    expect(renderToString(h(PeripheralStep, { ...base, design: band, place: 'bordure', n: 4 }))).toBe('');
    // Pictures and the top band or border go together: the add buttons stay, and the picture step no longer warns.
    const pictured = setCharge(band, 'picture', 'lion');
    expect(renderToString(h(AddExtraLayer, { design: pictured, onChange: noop }))).toContain('add-peripheral-bordure');
    expect(renderToString(h(ChargesStep, { ...base, design: addLayer(pictured, 'bordure'), onAdjust: noop, adjusted: null, compact: false }))).not.toContain('peripheral-picture-note');
  });
});
