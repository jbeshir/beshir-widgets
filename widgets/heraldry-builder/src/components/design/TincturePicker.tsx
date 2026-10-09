// Radio group of the tinctures, metals and colours grouped. Choices that would break the
// rule of tincture (or a divided field's "two different tinctures") stay visible but blocked:
// lock glyph + strike, aria-disabled, data-blocked; activating one opens the explainer instead.
// A non-standard tincture (celestine) says so on its swatch and in its accessible name; its note
// describes the swatch and is shown under the metals while it is selected.

import { useRef } from 'preact/hooks';
import {
  COLOURS, METALS, NON_STANDARD_NOTE, TINCTURE_FILL, TINCTURE_NAME, TINCTURE_WORD, type Choice, type Tincture,
} from '../../lib/heraldry';
import { LockGlyph, useExplainer } from './Explainer';

interface Props {
  /** Swatch testid group: swatch-<group>-<tincture>. */
  group: string;
  legend: string;
  choices: Choice<Tincture>[];
  value: Tincture;
  onChange: (t: Tincture) => void;
  testid?: string;
}

export function TincturePicker({ group, legend, choices, value, onChange: change, testid }: Props) {
  const { explain: onBlocked, close: closeExplainer, node: explainer } = useExplainer();
  const onChange = (t: Tincture) => {
    closeExplainer();
    change(t);
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const byValue = new Map(choices.map((c) => [c.value, c]));
  const order = [...METALS, ...COLOURS] as Tincture[];
  const legendId = `tl-${group}`;
  const anyBlocked = choices.some((c) => !c.allowed);
  const noteId = (t: Tincture) => `note-${group}-${t}`;
  // Always rendered so the swatch's description resolves; visible only while that tincture is selected.
  const notes = order.flatMap((t) => {
    const note = NON_STANDARD_NOTE[t];
    if (!note) return [];
    return [
      <p key={t} id={noteId(t)} class={t === value ? 'tincture-note' : 'sr-only'} data-testid={`tincture-note-${group}-${t}`}>
        <span class="tincture-note-flag">Non-standard</span> {note}
      </p>,
    ];
  });

  const activate = (t: Tincture, el: HTMLElement) => {
    const c = byValue.get(t);
    if (c && !c.allowed) {
      onBlocked({
        anchor: el,
        kind: 'tincture',
        title: `${TINCTURE_NAME[t]} isn't allowed here`,
        reason: c.reason ?? '',
      });
      return;
    }
    if (t !== value) onChange(t);
  };

  // Arrow keys move focus around the group (roving tabindex); allowed choices are selected as focus
  // lands on them, blocked ones only receive focus (Space/Enter then explains them).
  const onKeyDown = (e: KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const current = (e.target as HTMLElement).dataset.tincture as Tincture;
    let i = order.indexOf(current);
    if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = order.length - 1;
    else i = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + order.length) % order.length;
    const next = order[i];
    const btn = rootRef.current?.querySelector<HTMLElement>(`[data-tincture="${next}"]`);
    btn?.focus();
    if (byValue.get(next)?.allowed) onChange(next);
  };

  const swatch = (t: Tincture) => {
    const c = byValue.get(t);
    const blocked = !!c && !c.allowed;
    const checked = t === value;
    // A checked swatch that is also blocked is the cause of a violation, not a disabled option.
    const conflicts = blocked && checked;
    const whyId = `why-${group}-${t}`;
    const note = NON_STANDARD_NOTE[t];
    const describedBy = [blocked && c?.reason ? whyId : null, note ? noteId(t) : null].filter(Boolean).join(' ');
    // The testid sits on a role-less wrapper box: test drivers (Playwright) refuse to click an
    // aria-disabled control, but a blocked swatch must stay clickable so it can explain itself.
    return (
      <span key={t} class="option-wrap" data-testid={`swatch-${group}-${t}`} data-blocked={blocked ? 'true' : undefined}>
      <button
        type="button"
        role="radio"
        id={`swatch-${group}-${t}`}
        class={`swatch${checked ? ' is-checked' : ''}${blocked ? ' is-blocked' : ''}`}
        aria-checked={checked ? 'true' : 'false'}
        aria-disabled={blocked && !checked ? 'true' : undefined}
        aria-label={`${TINCTURE_NAME[t]} (${TINCTURE_WORD[t]})${note ? ', non-standard' : ''}${conflicts ? ', selected, conflicts with the design' : blocked ? ', not allowed here' : ''}`}
        aria-describedby={describedBy || undefined}
        data-blocked={blocked ? 'true' : undefined}
        data-tincture={t}
        tabIndex={checked ? 0 : -1}
        onClick={(e) => activate(t, e.currentTarget as HTMLElement)}
      >
        <span class={`swatch-chip tincture-${t}`} style={{ background: TINCTURE_FILL[t] }} aria-hidden="true">
          {blocked && <LockGlyph />}
        </span>
        <span class="swatch-text" aria-hidden="true">
          <span class="swatch-name">{TINCTURE_NAME[t]}</span>
          <span class="swatch-word">{TINCTURE_WORD[t]}</span>
          {note && <span class="swatch-flag">Non-standard</span>}
        </span>
      </button>
      {blocked && c?.reason && <span class="sr-only" id={whyId}>{c.reason}</span>}
      </span>
    );
  };

  return (
    <div class="tincture-picker">
      <p class="picker-legend" id={legendId}>{legend}</p>
      {anyBlocked && (
        <p class="lock-legend" data-testid="lock-legend">
          <LockGlyph /> Locked would put colour on colour or metal on metal. Tap one to see why.
        </p>
      )}
      <div ref={rootRef} role="radiogroup" aria-labelledby={legendId} data-testid={testid} class="swatch-groups" onKeyDown={onKeyDown}>
        <div class="swatch-group">
          <span class="swatch-group-label" aria-hidden="true">Metals</span>
          <div class="swatch-row">{METALS.map(swatch)}</div>
        </div>
        <div class="swatch-group">
          <span class="swatch-group-label" aria-hidden="true">Colours</span>
          <div class="swatch-row">{COLOURS.map(swatch)}</div>
        </div>
      </div>
      {notes}
      {explainer}
    </div>
  );
}
