// "More divisions and edges…": the one disclosure under a shape picker that holds what goes beyond the plain row of shapes — the
// edge each line of the shape is drawn with. Closed until asked for, and open by itself while the shape uses one (Disclosure).

import type { ComponentChildren } from 'preact';
import { Disclosure } from './Disclosure';

interface Props {
  /** The disclosure is <testid>-shape-more. */
  testid: string;
  summary: string;
  /** Whether the shape already uses something in here (opens the disclosure when it becomes true). */
  used: boolean;
  children: () => ComponentChildren;
}

export function MoreShapes({ testid, summary, used, children }: Props) {
  return <Disclosure testid={`${testid}-shape-more`} class="more-shapes" summary={summary} used={used}>{children}</Disclosure>;
}
