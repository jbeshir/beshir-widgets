// Radio group of the tinctures, metals and colours grouped. Choices that would break the
// rule of tincture (or a divided field's "two different tinctures") stay visible but blocked:
// lock glyph + strike, aria-disabled, data-blocked; activating one opens the explainer instead.
// A non-standard tincture (celestine) says so on its swatch and in its accessible name; its note
// describes the swatch and is shown under the metals while it is selected. The charge picker also
// offers "counterchanged" on a divided field, in a group of its own after the colours.

import { useRef } from 'preact/hooks';
import {
  CHARGE_TINCTURES, CHARGE_TINCTURE_NAME, CHARGE_TINCTURE_WORD, COLOURS, METALS, NON_STANDARD_NOTE, TINCTURE_FILL,
  type ChargeTincture, type Choice,
} from '../../lib/heraldry';
import { LockGlyph, useExplainer } from './Explainer';

interface Props<T extends ChargeTincture> {
  /** Swatch testid group: swatch-<group>-<tincture>. */
  group: string;
  legend: string;
  /** The tinctures offered, in any order; they are shown metals, colours, then counterchanged. */
  choices: Choice<T>[];
  value: T;
  onChange: (t: T) => void;
  testid?: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Note shown under the picker while counterchanged is selected. */
const COUNTERCHANGED_NOTE = "Each charge, or each part of one that crosses the field's line, takes the field's other tincture.";

const chipStyle = (t: ChargeTincture) => (t === 'counterchanged' ? undefined : { background: TINCTURE_FILL[t] });

/** The counterchanged swatch: a divided square with a disc in the opposite tinctures. */
function CounterchangedChip() {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <path d="M0 0H14V28H0Z" fill={TINCTURE_FILL.azure} />
      <path d="M14 0H28V28H14Z" fill={TINCTURE_FILL.or} />
      <path d="M14 6A8 8 0 0 0 14 22Z" fill={TINCTURE_FILL.or} />
      <path d="M14 6A8 8 0 0 1 14 22Z" fill={TINCTURE_FILL.azure} />
    </svg>
  );
}

export function TincturePicker<T extends ChargeTincture>({ group, legend, choices, value, onChange: change, testid }: Props<T>) {
  const { explain: onBlocked, close: closeExplainer, node: explainer } = useExplainer();
  const onChange = (t: T) => {
    closeExplainer();
    change(t);
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const byValue = new Map<ChargeTincture, Choice<T>>(choices.map((c) => [c.value, c]));
  const order = CHARGE_TINCTURES.filter((t): t is T => byValue.has(t));
  const offered = (ts: readonly ChargeTincture[]) => ts.filter((t): t is T => byValue.has(t));
  const legendId = `tl-${group}`;
  const anyBlocked = choices.some((c) => !c.allowed);
  const noteId = (t: ChargeTincture) => `note-${group}-${t}`;
  const noteOf = (t: ChargeTincture) => (t === 'counterchanged' ? null : NON_STANDARD_NOTE[t]);
  const nameOf = (t: ChargeTincture) => cap(CHARGE_TINCTURE_NAME[t]);
  // Always rendered so the swatch's description resolves; visible only while that tincture is selected.
  const notes = order.flatMap((t) => {
    const note = noteOf(t);
    if (!note) return [];
    return [
      <p key={t} id={noteId(t)} class={t === value ? 'tincture-note' : 'sr-only'} data-testid={`tincture-note-${group}-${t}`}>
        <span class="tincture-note-flag">Non-standard</span> {note}
      </p>,
    ];
  });

  const activate = (t: T, el: HTMLElement) => {
    const c = byValue.get(t);
    if (c && !c.allowed) {
      onBlocked({
        anchor: el,
        kind: 'tincture',
        title: `${nameOf(t)} isn't allowed here`,
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
    const current = (e.target as HTMLElement).dataset.tincture as T;
    let i = order.indexOf(current);
    if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = order.length - 1;
    else i = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + order.length) % order.length;
    const next = order[i];
    const btn = rootRef.current?.querySelector<HTMLElement>(`[data-tincture="${next}"]`);
    btn?.focus();
    if (byValue.get(next)?.allowed) onChange(next);
  };

  const swatch = (t: T) => {
    const c = byValue.get(t);
    const blocked = !!c && !c.allowed;
    const checked = t === value;
    // A checked swatch that is also blocked is the cause of a violation, not a disabled option.
    const conflicts = blocked && checked;
    const whyId = `why-${group}-${t}`;
    const note = noteOf(t);
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
        aria-label={`${nameOf(t)} (${CHARGE_TINCTURE_WORD[t]})${note ? ', non-standard' : ''}${conflicts ? ', selected, conflicts with the design' : blocked ? ', not allowed here' : ''}`}
        aria-describedby={describedBy || undefined}
        data-blocked={blocked ? 'true' : undefined}
        data-tincture={t}
        tabIndex={checked ? 0 : -1}
        onClick={(e) => activate(t, e.currentTarget as HTMLElement)}
      >
        <span class={`swatch-chip tincture-${t}`} style={chipStyle(t)} aria-hidden="true">
          {t === 'counterchanged' && <CounterchangedChip />}
          {blocked && <LockGlyph />}
        </span>
        <span class="swatch-text" aria-hidden="true">
          <span class="swatch-name">{nameOf(t)}</span>
          <span class="swatch-word">{CHARGE_TINCTURE_WORD[t]}</span>
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
          <div class="swatch-row">{offered(METALS).map(swatch)}</div>
        </div>
        <div class="swatch-group swatch-group-colours">
          <span class="swatch-group-label" aria-hidden="true">Colours</span>
          <div class="swatch-row">{offered(COLOURS).map(swatch)}</div>
        </div>
        {byValue.has('counterchanged') && (
          <div class="swatch-group">
            <span class="swatch-group-label" aria-hidden="true">Field's colours reversed</span>
            <div class="swatch-row">{offered(['counterchanged']).map(swatch)}</div>
          </div>
        )}
      </div>
      {notes}
      {value === 'counterchanged' && <p class="tincture-note" data-testid={`tincture-note-${group}-counterchanged`}>{COUNTERCHANGED_NOTE}</p>}
      {explainer}
    </div>
  );
}
