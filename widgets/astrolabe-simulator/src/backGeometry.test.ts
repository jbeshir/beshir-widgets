import { describe, expect, it } from 'vitest';
import { calendarDayTicks } from './calendarScale';
import {
  alidadeAltitudeReading,
  alidadeLineCross,
  alidadeRotationForLongitude,
  backLongitudePoint,
} from './backGeometry';

describe('back scale and alidade alignment', () => {
  it.each([0, 30, 90, 112.075, 180, 270, 359])(
    'places longitude %s on the matching rendered alidade line',
    (longitude) => {
      const point = backLongitudePoint(468, longitude);
      const rotation = alidadeRotationForLongitude(longitude);
      expect(alidadeLineCross(point, rotation)).toBeCloseTo(0, 10);
    },
  );

  it('aligns every engraved calendar notch using the same geometry', () => {
    for (const tick of calendarDayTicks()) {
      const point = backLongitudePoint(456, tick.longitude);
      const rotation = alidadeRotationForLongitude(tick.longitude);
      expect(alidadeLineCross(point, rotation)).toBeCloseTo(0, 9);
    }
  });

  it('uses the physical alidade rotation for the July 14 radial line', () => {
    const july14 = calendarDayTicks().find((tick) => tick.month === 6 && tick.dayOfMonth === 14);
    expect(july14).toBeDefined();
    const rotation = alidadeRotationForLongitude(july14!.longitude);
    expect(rotation).toBeCloseTo(67.9, 1);
    expect(rotation).not.toBeCloseTo(july14!.longitude, 1);
    expect(alidadeLineCross(backLongitudePoint(456, july14!.longitude), rotation)).toBeCloseTo(0, 10);
  });
});

describe('alidade altitude reading', () => {
  it.each([[0, 0], [47, 47], [90, 90], [133, 47], [180, 0], [227, 47], [300, 60], [359.5, 0.5]])(
    'rotation %s reads %s on the red scale',
    (rotation, altitude) => {
      expect(alidadeAltitudeReading(rotation)).toBeCloseTo(altitude, 6);
    },
  );
});
