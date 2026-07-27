import { describe, expect, it } from 'vitest';
import {
  HORARY_FIELD_RADIUS,
  HORARY_LABEL_FONT_SIZE,
  HORARY_SIDE_FONT_SIZE,
  HORARY_TITLE_FONT_SIZE,
  HORARY_DIVISION_DEGREES,
  boxClearance,
  createHoraryLayout,
  engravingCssPixels,
  engravingTextBox,
  horaryBoundaryPoint,
  intersectHoraryCircle,
  readTemporalHour,
  solarNoonAltitude,
} from './horaryQuadrant';
import { equationOfTimeLabelPosition, equationOfTimePoint } from './ruleGeometry';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => (
  Math.hypot(a.x - b.x, a.y - b.y)
);

interface ParsedHoraryPath {
  start: { x: number; y: number };
  arcs: Array<{
    radiusX: number;
    radiusY: number;
    rotation: number;
    largeArc: number;
    sweep: number;
    end: { x: number; y: number };
  }>;
}

/** Deliberately small parser for the exact M + A + A grammar emitted here. */
const parseHoraryPath = (path: string): ParsedHoraryPath => {
  const tokens = path.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  let cursor = 0;
  const command = (expected: string): void => {
    expect(tokens[cursor++]).toBe(expected);
  };
  const number = (): number => {
    const value = Number(tokens[cursor++]);
    expect(Number.isFinite(value)).toBe(true);
    return value;
  };

  command('M');
  const start = { x: number(), y: number() };
  const arcs = Array.from({ length: 2 }, () => {
    command('A');
    return {
      radiusX: number(),
      radiusY: number(),
      rotation: number(),
      largeArc: number(),
      sweep: number(),
      end: { x: number(), y: number() },
    };
  });
  expect(cursor).toBe(tokens.length);
  return { start, arcs };
};

describe('traditional double horary construction', () => {
  const layout = createHoraryLayout(360);
  const engravingLayout = createHoraryLayout();

  it('constructs six distinct circular hours from twelve 15-degree divisions', () => {
    expect(layout.circles).toHaveLength(6);
    expect(layout.labels.map(({ roman }) => roman)).toEqual([
      'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
    ]);
    expect(layout.circles.map(({ boundaryAngle }) => boundaryAngle)).toEqual([15, 30, 45, 60, 75, 90]);
  });

  it('puts every center on the meridian and every circle through the pivot', () => {
    for (const circle of layout.circles) {
      expect(circle.center.x).toBe(0);
      expect(distance(circle.center, { x: 0, y: 0 })).toBeCloseTo(circle.radius, 10);
    }
  });

  it('passes through the correct upper-semicircle division points', () => {
    for (const circle of layout.circles) {
      const expected = horaryBoundaryPoint(layout.radius, circle.hour * HORARY_DIVISION_DEGREES);
      expect(circle.leftBoundary.x).toBeCloseTo(expected.x, 10);
      expect(circle.leftBoundary.y).toBeCloseTo(expected.y, 10);
      expect(distance(circle.center, circle.leftBoundary)).toBeCloseTo(circle.radius, 10);
      expect(distance(circle.center, circle.rightBoundary)).toBeCloseTo(circle.radius, 10);
    }
  });

  it('is mirror-symmetric about the vertical meridian', () => {
    for (const circle of layout.circles) {
      expect(circle.leftBoundary.x).toBeCloseTo(-circle.rightBoundary.x, 10);
      expect(circle.leftBoundary.y).toBeCloseTo(circle.rightBoundary.y, 10);
    }
    for (let hour = 1; hour <= 5; hour += 1) {
      const left = layout.labels[hour - 1].position;
      const right = layout.labels[11 - hour].position;
      expect(left.x).toBeCloseTo(-right.x, 10);
      expect(left.y).toBeCloseTo(right.y, 10);
    }
  });

  it('returns exact ray/circle intersections used by the rendered curves', () => {
    for (const circle of layout.circles) {
      const intersection = intersectHoraryCircle(circle, circle.boundaryAngle);
      expect(intersection).not.toBeNull();
      expect(intersection!.point.x).toBeCloseTo(circle.rightBoundary.x, 9);
      expect(intersection!.point.y).toBeCloseTo(circle.rightBoundary.y, 9);
    }
  });

  it('emits all six paths as exact circular arcs, never sampled line segments', () => {
    for (const circle of layout.circles) {
      expect(circle.path).toMatch(/\bA\b/);
      expect(circle.path).not.toMatch(/\bL\b/i);
      const parsed = parseHoraryPath(circle.path);
      expect(parsed.arcs).toHaveLength(2);
      for (const arc of parsed.arcs) {
        expect(arc.radiusX).toBeCloseTo(circle.radius, 9);
        expect(arc.radiusY).toBeCloseTo(circle.radius, 9);
        expect(arc.rotation).toBe(0);
        expect(arc.largeArc).toBe(0);
        expect(arc.sweep).toBe(0);
      }
    }
  });

  it('starts and ends at the correct boundaries and joins continuously at the pivot', () => {
    for (const circle of layout.circles) {
      const parsed = parseHoraryPath(circle.path);
      expect(distance(parsed.start, circle.leftBoundary)).toBeCloseTo(0, 8);
      expect(distance(parsed.arcs[0].end, { x: 0, y: 0 })).toBeCloseTo(0, 10);
      expect(distance(parsed.arcs[1].end, circle.rightBoundary)).toBeCloseTo(0, 8);

      // Each command's endpoint independently lies on the declared circle.
      for (const point of [parsed.start, parsed.arcs[0].end, parsed.arcs[1].end]) {
        expect(distance(point, circle.center)).toBeCloseTo(circle.radius, 8);
      }
    }
  });

  it('scales the deliberately fine engraving consistently with the instrument', () => {
    expect(engravingLayout.labels.map(({ roman }) => roman)).toHaveLength(12);
    expect(engravingLayout.sideLabels.map(({ text }) => text)).toEqual(['A.M.', 'P.M.']);
    for (const width of [700, 340]) {
      expect(engravingCssPixels(HORARY_LABEL_FONT_SIZE, width)).toBeCloseTo(HORARY_LABEL_FONT_SIZE * width / 1240, 10);
      expect(engravingCssPixels(HORARY_SIDE_FONT_SIZE, width)).toBeCloseTo(HORARY_SIDE_FONT_SIZE * width / 1240, 10);
      expect(engravingCssPixels(HORARY_TITLE_FONT_SIZE, width)).toBeCloseTo(HORARY_TITLE_FONT_SIZE * width / 1240, 10);
    }
  });

  it('places every numeral directly on the line it labels', () => {
    for (const label of engravingLayout.labels) {
      if (label.hour === 12) {
        expect(label.position.x).toBeCloseTo(engravingLayout.radius - 35, 10);
        expect(label.position.y).toBeCloseTo(-18, 10);
        continue;
      }
      const circleHour = label.hour <= 6 ? label.hour : 12 - label.hour;
      const circle = engravingLayout.circles[circleHour - 1];
      expect(distance(label.position, circle.center)).toBeCloseTo(circle.radius, 10);
    }
  });

  it('gives adjacent hour labels positive conservative bounding clearance', () => {
    const boxes = engravingLayout.labels.map((label) => (
      engravingTextBox(label.roman, label.position, HORARY_LABEL_FONT_SIZE)
    ));
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxClearance(boxes[index - 1], boxes[index])).toBeGreaterThan(3);
    }
  });

  it('keeps hour labels inside the field and clear of fixed central engravings', () => {
    const titleBox = engravingTextBox(engravingLayout.title.text, engravingLayout.title.position, engravingLayout.title.fontSize);
    const sideBoxes = engravingLayout.sideLabels.map((label) => engravingTextBox(label.text, label.position, label.fontSize));
    const equationSamples = Array.from({ length: 365 }, (_, day) => (
      equationOfTimePoint(new Date(Date.UTC(2026, 0, day + 1, 12)))
    ));
    const equationLabel = engravingTextBox('EOT', equationOfTimeLabelPosition(equationSamples), 13);
    const centerHub = { left: -13, right: 13, top: -13, bottom: 13 };

    for (const label of engravingLayout.labels) {
      const box = engravingTextBox(label.roman, label.position, HORARY_LABEL_FONT_SIZE);
      for (const corner of [
        { x: box.left, y: box.top }, { x: box.right, y: box.top },
        { x: box.left, y: box.bottom }, { x: box.right, y: box.bottom },
      ]) {
        expect(Math.hypot(corner.x, corner.y)).toBeLessThan(HORARY_FIELD_RADIUS);
      }
      expect(box.bottom).toBeLessThan(0); // shadow square begins at the horizon
      expect(boxClearance(box, titleBox)).toBeGreaterThan(0);
      expect(boxClearance(box, equationLabel)).toBeGreaterThan(0);
    }
    for (const box of [titleBox, ...sideBoxes]) {
      expect(boxClearance(box, centerHub)).toBeGreaterThan(20);
    }
    expect(boxClearance(sideBoxes[0], titleBox)).toBeGreaterThan(20);
    expect(boxClearance(titleBox, sideBoxes[1])).toBeGreaterThan(20);
  });
});

describe('temporal-hour read-off', () => {
  it('handles sunrise/sunset boundaries and the sixth hour at noon', () => {
    expect(readTemporalHour(60, 0, 'morning')!.hour).toBeCloseTo(0, 10);
    expect(readTemporalHour(60, 0, 'afternoon')!.hour).toBeCloseTo(12, 10);
    expect(readTemporalHour(60, 60, 'morning')!.hour).toBeCloseTo(6, 10);
    expect(readTemporalHour(60, 60, 'afternoon')!.hour).toBeCloseTo(6, 10);
  });

  it('mirrors morning and afternoon readings around hour VI', () => {
    const morning = readTemporalHour(68, 31, 'morning')!;
    const afternoon = readTemporalHour(68, 31, 'afternoon')!;
    expect(morning.hour + afternoon.hour).toBeCloseTo(12, 10);
    expect(morning.transferredRadius).toBeCloseTo(afternoon.transferredRadius, 10);
  });

  it('has the expected equinox behavior', () => {
    const noon = solarNoonAltitude(40, 0);
    expect(noon).toBe(50);
    const altitudeAtThirdHour = Math.asin(Math.sin(noon * Math.PI / 180) * Math.sin(45 * Math.PI / 180)) * 180 / Math.PI;
    expect(readTemporalHour(noon, altitudeAtThirdHour, 'morning')!.hour).toBeCloseTo(3, 10);
    expect(readTemporalHour(noon, altitudeAtThirdHour, 'afternoon')!.hour).toBeCloseTo(9, 10);
  });

  it('preserves the same hour divisions across solstitial and seasonal noon altitudes', () => {
    for (const declination of [-23.44, -11, 11, 23.44]) {
      const noon = solarNoonAltitude(40, declination);
      const altitudeAtFourthHour = Math.asin(Math.sin(noon * Math.PI / 180) * Math.sin(60 * Math.PI / 180)) * 180 / Math.PI;
      expect(readTemporalHour(noon, altitudeAtFourthHour, 'morning')!.hour).toBeCloseTo(4, 9);
      expect(readTemporalHour(noon, altitudeAtFourthHour, 'afternoon')!.hour).toBeCloseTo(8, 9);
    }
  });

  it('reproduces the documented July 14 example within historical tolerance', () => {
    const reading = readTemporalHour(70, 27.5, 'afternoon')!;
    expect(reading.hour).toBeGreaterThan(9.75);
    expect(reading.hour).toBeLessThan(10.25);
    expect(reading.hour).toBeCloseTo(10, 0);
  });

  it('rejects geometrically impossible observations', () => {
    expect(readTemporalHour(0, 0, 'morning')).toBeNull();
    expect(readTemporalHour(50, 55, 'afternoon')).toBeNull();
    expect(readTemporalHour(50, -1, 'morning')).toBeNull();
  });
});
