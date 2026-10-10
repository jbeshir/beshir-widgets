// Radio-style option buttons shared by the builder's icon grids and segmented controls.
// A RadioGroup keeps exactly one option tabbable (the checked one, else the first) and moves focus
// with the arrow keys, selecting allowed options as it goes. Blocked options stay focusable and
// visible; activating one explains it instead of applying it. An option that changes something else
// too says so in its accessible description and shows a small arrows mark.

import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { LockGlyph, type ExplainKind, type Explanation } from './Explainer';

interface GroupProps {
  label: string;
  /** Id of an element that explains the whole group. */
  describedBy?: string;
  testid?: string;
  class?: string;
  children: ComponentChildren;
}

export function RadioGroup({ label, describedBy, testid, class: cls, children }: GroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role=radio]') ?? []);
    const checked = items.find((el) => el.getAttribute('aria-checked') === 'true') ?? items[0];
    for (const el of items) el.tabIndex = el === checked ? 0 : -1;
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key) || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>('[role=radio]'));
    const i = items.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    let n = i;
    if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = items.length - 1;
    else n = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    const next = items[n];
    next.focus();
    if (next.getAttribute('aria-disabled') !== 'true' && next.getAttribute('aria-checked') !== 'true') next.click();
  };

  return (
    <div ref={ref} role="radiogroup" aria-label={label} aria-describedby={describedBy} data-testid={testid} class={cls} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

/** open: chosen as it is; blocked: explained instead of applied; with-change: choosing it changes something else too, which `note` says. */
export type OptionStatus = { kind: 'open' } | { kind: 'blocked'; reason: string } | { kind: 'with-change'; note: string };

const OPEN: OptionStatus = { kind: 'open' };

interface ChoiceProps {
  testid: string;
  checked: boolean;
  status?: OptionStatus;
  /** Accessible name (also used in the explainer title). */
  label: string;
  /** Native hover tooltip. */
  title?: string;
  kind?: ExplainKind;
  onSelect: () => void;
  onBlocked: (e: Explanation) => void;
  class?: string;
  children: ComponentChildren;
}

export function ChoiceButton({ testid, checked, status = OPEN, label, title, kind = 'structure', onSelect, onBlocked, class: cls, children }: ChoiceProps) {
  const blocked = status.kind === 'blocked';
  const described = status.kind === 'blocked' ? status.reason : status.kind === 'with-change' ? status.note : null;
  // testid on a role-less wrapper box so test drivers can click blocked (aria-disabled) options.
  return (
    <span class={`option-wrap${cls ? ` wrap-${cls.split(' ')[0]}` : ''}`} data-testid={testid} data-blocked={blocked ? 'true' : undefined} data-with-change={status.kind === 'with-change' ? 'true' : undefined}>
    <button
      type="button"
      role="radio"
      aria-checked={checked ? 'true' : 'false'}
      aria-disabled={blocked ? 'true' : undefined}
      aria-label={blocked ? `${label}, not available` : label}
      title={title}
      aria-describedby={described ? `${testid}-why` : undefined}
      data-blocked={blocked ? 'true' : undefined}
      id={testid}
      class={`choice${checked ? ' is-checked' : ''}${blocked ? ' is-blocked' : ''}${cls ? ` ${cls}` : ''}`}
      onClick={(e) => {
        if (status.kind === 'blocked') onBlocked({ anchor: e.currentTarget as HTMLElement, kind, title: `${label} isn't available`, reason: status.reason });
        else if (!checked) onSelect();
      }}
    >
      {children}
      {blocked && <LockGlyph />}
      {status.kind === 'with-change' && <ChangeGlyph />}
    </button>
    {described && <span class="sr-only" id={`${testid}-why`}>{described}</span>}
    </span>
  );
}

/** Marks an option that changes something else too (two arrows passing). */
function ChangeGlyph() {
  return (
    <svg class="change-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M2 5h10M9 2l3 3-3 3M14 11H4M7 8l-3 3 3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
