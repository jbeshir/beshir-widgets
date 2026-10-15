// Ordinaries and partitions built from contours draw exactly what phase B drew: the body, fill rule, centre, box and
// samples of every phase-B ordinary in every shape (fixture captured from the phase-B code), the regions of every
// division, the part a point lies in, and the Shield markup of an ordinary layer with only a body.

import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { Shield } from '../src/components/Shield';
import {
  BUILDER_ORDINARIES, DRAWN_DIVISIONS, FIELD_SHAPES, PLAIN_LINES, defaultOrdinaryFrame, divisionRegions, fieldOrdinaryGeometry, inFirstPart, inFirstRegion,
  ordinaryGeometry, partIndexAt, partyPaint, pathPolygon, pathRings, plainSpec, pointInPolygon, shapeFrame, variationPaint,
  type DividedField, type Design,
} from '../src/lib/heraldry';
import { arms, div, group, nd, ordinary } from './helpers';
import phaseB from './fixtures/ordinary-geometry.json';

const OR = { k: 'tincture', t: 'or' } as const, AZURE = { k: 'tincture', t: 'azure' } as const;
const divided = (division: (typeof DRAWN_DIVISIONS)[number]): DividedField => ({ k: 'divided', division, lines: PLAIN_LINES, paints: [OR, AZURE] });
const inRegion = (d: string, x: number, y: number) => pathRings(d).filter((r) => pointInPolygon(x, y, r)).length % 2 === 1;

describe('ordinary geometry', () => {
  it('every phase-B ordinary\'s body, fill rule, centre, box and samples are what phase B drew, in every shape', () => {
    for (const shape of FIELD_SHAPES) {
      for (const type of BUILDER_ORDINARIES) {
        const g = ordinaryGeometry(plainSpec(type), defaultOrdinaryFrame(shape));
        const want = phaseB.ordinaries[shape][type as keyof (typeof phaseB.ordinaries)['heater']];
        expect({ shape, type, body: g.body, fillRule: g.fillRule, centre: g.centre, box: g.box, samples: g.samples })
          .toEqual({ shape, type, ...want });
      }
      // the counterchanged chevron raised astride a field per chevron's line
      const astride = fieldOrdinaryGeometry(partyPaint('per-chevron', 'or', 'azure'), plainSpec('chevron'), { k: 'counterchanged' }, defaultOrdinaryFrame(shape));
      expect({ shape, body: astride.body, samples: astride.samples }).toEqual({ shape, ...phaseB.astride[shape] });
    }
  });

  it('partIndexAt agrees with phase B\'s analytic test on a 101 × 121 heater grid for every phase-B division', () => {
    const fess = shapeFrame('heater').fessPoint;
    for (const division of DRAWN_DIVISIONS) {
      const f = divided(division);
      for (let x = 0; x <= 100; x++) {
        for (let y = 0; y <= 120; y++) {
          if (partIndexAt(f, 'heater', x, y) !== (inFirstPart(division, fess, x, y) ? 0 : 1)) expect({ division, x, y }).toBe('the same part');
        }
      }
    }
    const barry = { k: 'varied', paint: variationPaint('barry', 'or', 'azure') } as const;
    const box = shapeFrame('heater').box;
    for (let y = 0; y <= 120; y++) expect(partIndexAt(barry, 'heater', 50, y)).toBe(inFirstRegion('barry', barry.paint.pieces, box, 50, y) ? 0 : 1);
  });

  it('the regions of a division partition the field', () => {
    // a grid offset by 0.5 across and 0.25 down, so that no point sits on a line (diagonal ones included); each point inside the shape
    // lies in exactly one region, the one partIndexAt names
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const division of DRAWN_DIVISIONS) {
        const regions = divisionRegions(division, PLAIN_LINES, shape);
        expect(regions).toHaveLength(2);
        for (let x = 0.5; x < 100; x += 2) {
          for (let y = 0.25; y < 120; y += 2) {
            if (!pointInPolygon(x, y, outline)) continue;
            const holding = regions.flatMap((d, i) => (inRegion(d, x, y) ? [i] : []));
            if (holding.length !== 1 || holding[0] !== partIndexAt(divided(division), shape, x, y)) expect({ shape, division, x, y, holding }).toBe('in one region');
          }
        }
      }
    }
  });

  it('a body-only ordinary layer renders exactly phase B\'s markup', () => {
    const ssr = (d: Design) => renderToString(h(Shield, { design: d, shape: 'heater', hatching: true, label: null })).replace(/\bs\d+\b/g, 'S');
    expect(ssr(nd(arms('azure', group(ordinary('fess'), 'or'))))).toBe(phaseB.markup.fess);
    expect(ssr(nd(arms(div('per-chevron', 'argent', 'sable'), group(ordinary('chevron'), { k: 'counterchanged' }))))).toBe(phaseB.markup.astride);
    expect(ssr(nd(arms('gules', group(ordinary('bordure'), { k: 'fur', fur: 'ermine' }))))).toBe(phaseB.markup.bordure);
  });
});
