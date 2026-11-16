// "More divisions and edges…": the one disclosure under a shape picker that holds what goes beyond the plain row of shapes — the
// edge each line of the shape is drawn with. Closed until asked for, and open by itself while the shape uses one; the body is drawn
// only while it is open.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

interface Props {
  /** The disclosure is <testid>-shape-more. */
  testid: string;
  summary: string;
  /** Whether the shape already uses something in here (opens the disclosure when it becomes true). */
  used: boolean;
  children: () => ComponentChildren;
}

export function MoreShapes({ testid, summary, used, children }: Props) {
  const [open, setOpen] = useState(used);
  // A design that comes to use one (an example loaded, Undo) opens the disclosure.
  useEffect(() => {
    if (used) setOpen(true);
  }, [used]);
  return (
    <details class="more-paint more-shapes" data-testid={`${testid}-shape-more`} open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{summary}</summary>
      {open && <div class="more-paint-body">{children()}</div>}
    </details>
  );
}
