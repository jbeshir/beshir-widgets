// DOM-free check that every Shield instance gets a distinct SVG id fragment (fix02 W1).
import { describe, it, expect } from 'vitest';
import { nextShieldUid } from '../src/components/Shield';

describe('Shield ids', () => {
  it('hands out unique ids per instance', () => {
    const ids = Array.from({ length: 50 }, () => nextShieldUid());
    expect(new Set(ids).size).toBe(50);
    expect(ids.every((i) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(i))).toBe(true);
  });
});
