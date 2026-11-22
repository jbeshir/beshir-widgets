import { describe, expect, it } from 'vitest';
import { CONCEPT_IDS, CONCEPTS, conceptsForPart } from './concepts';
import { describePartRef, isValidPartRef } from './parts';

describe('concept ledger', () => {
  it('has the 90 concepts of SYLLABUS 1.1, each once', () => {
    expect(CONCEPTS).toHaveLength(90);
    expect(new Set(CONCEPTS.map((concept) => concept.id)).size).toBe(90);
    expect(CONCEPTS.map((concept) => concept.id)).toEqual([...CONCEPT_IDS]);
  });
  it('names only valid part references', () => {
    for (const concept of CONCEPTS) {
      for (const ref of concept.parts) expect(isValidPartRef(ref), `${concept.id}: ${JSON.stringify(ref)}`).toBe(true);
    }
  });
  it('is introduced at a 1-based step with a definition', () => {
    for (const concept of CONCEPTS) {
      expect(Number.isInteger(concept.introducedAt.step) && concept.introducedAt.step >= 1, concept.id).toBe(true);
      expect(concept.definition.length, concept.id).toBeGreaterThan(10);
    }
  });
  it('keeps the two engraving-free concepts and the spot values', () => {
    expect(CONCEPTS.filter((concept) => concept.parts.length === 0).map((concept) => concept.id))
      .toEqual(['longitude-correction', 'summer-time']);
    const fiducial = CONCEPTS.find((concept) => concept.id === 'fiducial-edge');
    expect(fiducial?.parts.map(describePartRef)).toEqual(['rule-edge', 'alidade-edge']);
    expect(fiducial?.introducedAt).toEqual({ lesson: 'front.foundations.v1', step: 4 });
    expect(CONCEPTS.find((concept) => concept.id === 'sunrise')?.introducedAt).toEqual({ lesson: 'solar.events.v1', step: 2 });
  });
  it('lists the concepts served by a part', () => {
    expect(conceptsForPart('azimuth-line')).toEqual(expect.arrayContaining(['azimuth-line', 'azimuth', 'east-west', 'read-alt-az', 'rising-azimuth']));
    expect(conceptsForPart('azimuth-line')).toHaveLength(5);
    expect(conceptsForPart('face-toggle')).toEqual(['turn-over']);
  });
});
