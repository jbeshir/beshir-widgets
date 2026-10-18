// A closed-until-asked disclosure: closed by default, open by itself while the design uses what is inside it (an example loaded, Undo),
// and its body drawn only while it is open. "More divisions and edges…" (MoreShapes) and a picture's "Facing, turning and details…"
// (ChargeMore) are made of it.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

interface Props {
  testid: string;
  /** The classes of the <details>, after "more-paint". */
  class: string;
  summary: string;
  /** Whether the design already uses something in here (opens the disclosure when it becomes true). */
  used: boolean;
  children: () => ComponentChildren;
}

export function Disclosure({ testid, class: cls, summary, used, children }: Props) {
  const [open, setOpen] = useState(used);
  useEffect(() => {
    if (used) setOpen(true);
  }, [used]);
  return (
    <details class={`more-paint ${cls}`} data-testid={testid} open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{summary}</summary>
      {open && <div class="more-paint-body">{children()}</div>}
    </details>
  );
}
