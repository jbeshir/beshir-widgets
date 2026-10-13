// "Why can't I pick this?" — an inline explanation panel rendered right under the control group it
// explains (never over it), opened when a blocked option is activated. The blocked choice itself is
// never applied. Escape or "Got it" closes it and returns focus to the option that opened it.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { COLOURS, METALS, TINCTURE_LABEL, type Tincture } from '../../lib/heraldry';
import { pushLayer, restoreFocus } from '../overlay/layers';

export type ExplainKind = 'tincture' | 'structure';

export interface Explanation {
  anchor: HTMLElement;
  kind: ExplainKind;
  title: string;
  reason: string;
}

const plainList = (ts: readonly Tincture[]) => ts.map((t) => TINCTURE_LABEL[t].plain.toLowerCase()).join(', ');

const RULE_LINE: Record<ExplainKind, string> = {
  tincture: `The rule of tincture: a colour (${plainList(COLOURS)}) goes on a metal (${plainList(METALS)}) and a metal on a colour, so arms read clearly from a distance.`,
  structure: "Each layout needs room: every picture must be drawn at least a set size, and some combinations aren't heraldic.",
};

export function useExplainer() {
  const [current, setCurrent] = useState<Explanation | null>(null);
  const explain = useCallback((e: Explanation) => setCurrent(e), []);
  const close = useCallback(() => setCurrent(null), []);
  const node = current && <ExplainerPanel key={current.anchor.id || current.title} explanation={current} onClose={close} />;
  return { explain, close, node };
}

let seq = 0;

function ExplainerPanel({ explanation: e, onClose }: { explanation: Explanation; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(`explainer-${++seq}`);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const pop = pushLayer({ close: () => closeRef.current(), modal: false });
    ref.current?.focus();
    return () => {
      pop();
      // Hand focus back to the option unless the user already moved on to another control.
      const active = document.activeElement;
      if (!active || active === document.body || ref.current?.contains(active)) restoreFocus(e.anchor);
    };
  }, []);

  return (
    <div
      ref={ref}
      id={id.current}
      role="group"
      tabIndex={-1}
      aria-label={e.title}
      aria-describedby={`${id.current}-reason`}
      data-testid={e.kind === 'tincture' ? 'tincture-explainer' : 'option-explainer'}
      class="explainer"
    >
      <p class="explainer-title">
        <LockGlyph />
        <strong>{e.title}</strong>
      </p>
      <p class="explainer-reason" id={`${id.current}-reason`}>{e.reason}</p>
      <p class="explainer-rule">{RULE_LINE[e.kind]}</p>
      <button type="button" class="button-secondary button-small" onClick={() => closeRef.current()}>Got it</button>
    </div>
  );
}

export function LockGlyph() {
  return (
    <svg class="lock-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="1.6" />
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}
