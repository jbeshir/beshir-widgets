// The builder steps rendered to markup: the default flow (Background → Band or shape → Picture) keeps its
// test ids, and the new controls (More… counts, splendour, extra pictures) appear only when they apply.

import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { AddExtraPicture, ChargesStep, ExtraStep, FieldStep, OrdinaryStep } from '../src/components/design/BuilderSteps';
import { addExtraPicture, setCharge, setCount, setOrdinary, setGroupTincture, picturePath, DEFAULT_DESIGN } from '../src/lib/next/builder';
import type { Design } from '../src/lib/heraldry/next';

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

  it('offers the face of a sun, and nothing for other charges', () => {
    expect(picture(setCharge(DEFAULT_DESIGN, 'picture', 'sun'))).toContain('splendour-toggle');
    expect(picture(setCharge(DEFAULT_DESIGN, 'picture', 'lion'))).not.toContain('splendour-toggle');
  });

  it('offers extra pictures on a band, with their own controls once added', () => {
    const band = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const toned = setGroupTincture(band, picturePath(band)!, 'argent');
    const add = renderToString(h(AddExtraPicture, { design: toned, onChange: noop }));
    expect(add).toContain('data-testid="add-extra-picture"');
    expect(add).toContain('Add pictures on the band');
    expect(renderToString(h(AddExtraPicture, { design: DEFAULT_DESIGN, onChange: noop }))).toBe('');

    const withExtra = addExtraPicture(toned, 'mullet');
    expect(renderToString(h(AddExtraPicture, { design: withExtra, onChange: noop }))).toBe('');
    const got = ids(renderToString(h(ExtraStep, { ...base, design: withExtra, onAdjust: noop })));
    for (const id of ['step-extra', 'extra-charge-select', 'extra-count-select', 'extra-count-1', 'extra-arrangement-select', 'extra-charge-tincture', 'remove-extra-picture']) expect(got, id).toContain(id);
    expect(got).not.toContain('extra-placement-select');
    expect(renderToString(h(ExtraStep, { ...base, design: toned, onAdjust: noop }))).toBe('');
  });
});
