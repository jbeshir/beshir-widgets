import { describe, expect, it } from 'vitest';
import { classifyStack, visibilityPasses } from './inspect';

type Node = { id: string; ancestor?: boolean; target?: boolean };
const classify = (stack: Node[]) => classifyStack(stack, (n) => Boolean(n.target), (n) => Boolean(n.ancestor));

describe('classifyStack', () => {
  it('is visible when only ancestors sit above the target', () => {
    expect(classify([{ id: 'g', ancestor: true }, { id: 't', target: true }, { id: 'below' }])).toEqual({ kind: 'visible' });
  });
  it('reports the topmost non-ancestor above the target as the occluder', () => {
    const rete = { id: 'rete' };
    expect(classify([rete, { id: 'rule' }, { id: 't', target: true }])).toEqual({ kind: 'occluded', by: rete });
  });
  it('is inconclusive when the target is absent from the stack', () => {
    expect(classify([{ id: 'plate' }, { id: 'mater' }])).toEqual({ kind: 'inconclusive' });
  });
});

describe('visibilityPasses', () => {
  it('needs three visible samples and a quarter of the conclusive ones', () => {
    expect(visibilityPasses(2, 2, false)).toBe(false);
    expect(visibilityPasses(3, 12, false)).toBe(true);
    expect(visibilityPasses(3, 13, false)).toBe(false);
  });
  it('asks a single instance for half of its samples', () => {
    expect(visibilityPasses(24, 72, false, true)).toBe(false);
    expect(visibilityPasses(36, 72, false, true)).toBe(true);
    expect(visibilityPasses(2, 2, false, true)).toBe(false);
  });
  it('asks partial-coverage parts only for the count', () => {
    expect(visibilityPasses(3, 100, true)).toBe(true);
    expect(visibilityPasses(2, 2, true)).toBe(false);
  });
});
