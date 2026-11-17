import { describe, expect, it } from 'vitest';
import { LESSONS, validateCatalog } from './catalog';
import { CALENDAR_DATES, describeFrameRef, describePartRef, formatPartValue, frameSelector, isValidFrameRef, isValidPartRef, PART_IDS, PARTS, partSelector, type PartRef } from './parts';

describe('part vocabulary', () => {
  it('has the 39 part ids of SYLLABUS 1.2, each with a face', () => {
    expect(PART_IDS).toHaveLength(39);
    expect(new Set(PART_IDS).size).toBe(39);
    expect(Object.keys(PARTS).sort()).toEqual([...PART_IDS].sort());
  });
  it('declares the instance keys and domains', () => {
    const instanced = Object.fromEntries(PART_IDS.filter((id) => PARTS[id].instance).map((id) => [id, PARTS[id].instance?.key]));
    expect(instanced).toEqual({
      'limb-degree-scale': 'degree', 'limb-hour-scale': 'hour', almucantar: 'altitude', 'azimuth-line': 'azimuth',
      'unequal-hour-line': 'hour', 'ecliptic-scale': 'longitude', 'star-pointer': 'star', 'calendar-scale': 'date',
      'back-degree-scale': 'degree', 'altitude-scale': 'altitude',
    });
    expect(PARTS['limb-degree-scale'].instance?.values).toHaveLength(360);
    expect(PARTS['limb-hour-scale'].instance?.values).toHaveLength(24);
    expect(PARTS.almucantar.instance?.values).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(PARTS['azimuth-line'].instance?.values).toHaveLength(12);
    expect(PARTS['unequal-hour-line'].instance?.values).toHaveLength(11);
    expect(PARTS['ecliptic-scale'].instance?.values).toHaveLength(720);
    expect(PARTS['star-pointer'].instance?.values).toContain('sirius');
    expect(PARTS['back-degree-scale'].instance?.values).toHaveLength(360);
    expect(PARTS['altitude-scale'].instance?.values).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(CALENDAR_DATES).toHaveLength(365);
    expect(CALENDAR_DATES).toContain('04-20');
    expect(CALENDAR_DATES).not.toContain('02-29');
  });
  it('resolves refs to selectors with one value formatter', () => {
    expect(partSelector('rete')).toBe('[data-part="rete"]');
    expect(partSelector({ part: 'almucantar', altitude: 30 })).toBe('[data-part="almucantar"][data-altitude="30"]');
    expect(partSelector({ part: 'ecliptic-scale', longitude: 30.5 })).toBe('[data-part="ecliptic-scale"][data-longitude="30.5"]');
    expect(partSelector({ part: 'calendar-scale', date: '04-20' })).toBe('[data-part="calendar-scale"][data-date="04-20"]');
    expect(partSelector({ part: 'star-pointer', star: 'sirius' })).toBe('[data-part="star-pointer"][data-star="sirius"]');
    expect(partSelector({ part: 'altitude-scale', altitude: 60 })).toBe('[data-part="altitude-scale"][data-altitude="60"]');
    expect(formatPartValue(30)).toBe('30');
    expect(formatPartValue(0.5)).toBe('0.5');
    expect(describePartRef({ part: 'almucantar', altitude: 30 })).toBe('almucantar[altitude=30]');
  });
  it('names a numeral-only frame entry with the shared formatter', () => {
    const label = { label: { part: 'almucantar', altitude: 30 } } as const;
    expect(frameSelector(label)).toBe('[data-part="almucantar"][data-altitude="30"][data-label]');
    expect(frameSelector({ label: { part: 'azimuth-line', azimuth: 120 } })).toBe('[data-part="azimuth-line"][data-azimuth="120"][data-label]');
    expect(frameSelector('rete')).toBe('[data-part="rete"]');
    expect(describeFrameRef(label)).toBe('label(almucantar[altitude=30])');
    expect(isValidFrameRef(label)).toBe(true);
    for (const bad of [{ label: 'rete' }, { label: { part: 'almucantar', altitude: 35 } }, { label: { part: 'almucantar', altitude: 30 }, extra: 1 }, { label: null }]) {
      expect(isValidFrameRef(bad), JSON.stringify(bad)).toBe(false);
    }
  });
  it('rejects unknown ids, keys and values', () => {
    const bad: unknown[] = [
      'nope', 'toString', { part: 'rete', altitude: 3 }, { part: 'almucantar', altitude: 35 }, { part: 'almucantar' },
      { part: 'almucantar', azimuth: 30 }, { part: 'star-pointer', star: 'nobody' }, { part: 'calendar-scale', date: '02-30' }, null, 3,
    ];
    for (const ref of bad) expect(isValidPartRef(ref), JSON.stringify(ref)).toBe(false);
    for (const ref of ['rete', { part: 'almucantar', altitude: 30 }] satisfies PartRef[]) expect(isValidPartRef(ref)).toBe(true);
  });
  it('uses only known part ids and valid instance values in every catalog step', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        for (const ref of step.highlights) expect(isValidPartRef(ref), `${lesson.id}/${step.id}: ${JSON.stringify(ref)}`).toBe(true);
      }
    }
    expect(validateCatalog()).toEqual([]);
  });
  it('reports a bad highlight through validateCatalog', () => {
    const [first] = LESSONS;
    const broken = { ...first, steps: [{ ...first.steps[0], highlights: [{ part: 'almucantar', altitude: 35 } as unknown as PartRef] }] };
    expect(validateCatalog([broken]).join('\n')).toMatch(/Unknown highlight/);
  });
});
