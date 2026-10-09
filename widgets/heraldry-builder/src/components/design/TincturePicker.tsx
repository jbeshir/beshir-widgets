// Radio group of the seven tinctures, metals and colours grouped. Choices that would break the
// rule of tincture (or a divided field's "two different tinctures") stay visible but blocked:
// lock glyph + strike, aria-disabled, data-blocked; activating one opens the explainer instead.

import { useRef } from 'preact/hooks';
import { COLOURS, METALS, TINCTURE_FILL, TINCTURE_GLOSS, TINCTURE_NAME, type Choice, type Tincture } from '../../lib/heraldry';
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
        aria-label={`${TINCTURE_NAME[t]} (${TINCTURE_GLOSS[t]})${conflicts ? ', selected, conflicts with the design' : blocked ? ', not allowed here' : ''}`}
        aria-describedby={blocked && c?.reason ? whyId : undefined}
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
          <span class="swatch-word">{TINCTURE_GLOSS[t]}</span>
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
      {explainer}
    </div>
  );
}
