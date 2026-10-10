// Design tab: a welcome strip and starting designs on top, then the live preview + blazon + readability
// on the left (sticky on wide screens; when the column is taller than the screen only the shield
// sticks and the Register bar takes over) and the Background / Band or shape / Picture builder on the
// right. Register is the main action; Check availability is a secondary one. Both are wired to
// callbacks owned by App; this component only reports the design and renders what it is given.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { blazon, type ChargedDesign, type Companion, type FieldShape, type NormDesign, type ShapedDesign } from '../../lib/heraldry';
import type { Issue } from '../../lib/heraldry';
import { useCompact } from '../../lib/useCompact';
import type { DesignReport } from '../../lib/builder';
import type { RefObject } from 'preact';
import type { JumpTarget } from '../Availability';
import { SavePicture } from '../SavePicture';
import { Shield } from '../Shield';
import { BlazonPanel } from './BlazonPanel';
import { ChargesStep, FieldStep, OrdinaryStep, type Accordion } from './BuilderSteps';
import { ReadabilityMeter } from './ReadabilityMeter';
import { ShapePicker } from './ShapePicker';
import { StartingGallery } from './StartingGallery';
import { ViolationPanel } from './ViolationPanel';
import { WelcomeStrip } from './WelcomeStrip';

interface Props {
  design: NormDesign;
  /** The shape the preview is drawn in (display only). */
  shape: FieldShape;
  report: DesignReport;
  onChange: (nd: NormDesign) => void;
  /** Apply a count or placement that brings its partner along (App keeps it for Undo). */
  onAdjust: (nd: ChargedDesign, companion: Companion) => void;
  /** The note (with Undo, and the rule fix when the change broke it) for such a change, shown under the picture controls. */
  adjusted: (onFix: (nd: NormDesign) => void) => ComponentChildren;
  onShape: (shape: FieldShape) => void;
  onStartOver: () => void;
  /** Load a starting design; `caption` names it for the announcement. */
  onStartFrom: (pick: ShapedDesign, caption: string) => void;
  onSurprise: () => void;
  /** Dismiss the welcome strip; null once it has been dismissed. */
  onDismissWelcome: (() => void) | null;
  hatching: boolean;
  onHatching: (on: boolean) => void;
  /** Check availability against the registry (App owns the request and its result). */
  onCheck: () => void;
  checking: boolean;
  /** Open the Register… dialog. */
  onRegister: () => void;
  /** Availability result panel, rendered under the actions. */
  availability?: (onJump: (t: JumpTarget) => void) => ComponentChildren;
}

type Layer = Issue['layer'];
type StepKey = 'field' | 'ordinary' | 'charges';

const STEP_OF_LAYER: Record<Layer, StepKey> = { field: 'field', ordinary: 'ordinary', charges: 'charges', design: 'charges' };
const STEP_OF_JUMP: Record<JumpTarget, StepKey> = {
  field: 'field', ordinary: 'ordinary', charge: 'charges', count: 'charges', arrangement: 'charges', posture: 'charges', tincture: 'charges',
};

const STEP_SELECTOR: Record<Layer, string> = {
  field: '[data-testid=step-field]', ordinary: '[data-testid=step-ordinary]', charges: '[data-testid=step-charges]', design: '[data-testid=step-charges]',
};
const JUMP_SELECTOR: Record<JumpTarget, string> = {
  field: STEP_SELECTOR.field, ordinary: STEP_SELECTOR.ordinary, charge: '[data-testid=charge-select]',
  count: '[data-testid=count-select]', arrangement: '#arrangement-select', posture: '#posture-select',
  tincture: '[data-testid=charge-tincture]',
};

/** Scroll a builder control into view and focus it (the checked option of a group, or the control itself). */
function focusControl(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>(STEP_SELECTOR.charges);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  const target = el.matches('select, button, input')
    ? el
    : el.querySelector<HTMLElement>('[role=radio][tabindex="0"], [role=radio][aria-checked=true], select, button, input');
  target?.focus({ preventScroll: true });
}

/** Compact sticky shield + blazon bar for single-column layouts, shown once the main preview scrolls away. */
function MiniPreview({ design, shape, status, watch, onFix }: {
  design: NormDesign;
  shape: FieldShape;
  status: DesignReport['status'];
  watch: RefObject<HTMLElement>;
  onFix: () => void;
}) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = watch.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div class="mini-anchor" data-away={away ? 'true' : 'false'}>
      <div class="mini-bar" data-testid="mini-preview" data-status={status} aria-hidden={away ? undefined : 'true'}>
        <Shield design={design} shape={shape} size={56} label={null} />
        <p class="mini-blazon">{blazon(design)}</p>
        {status === 'violation' ? (
          <button type="button" class="button-primary button-small mini-fix" tabIndex={away ? 0 : -1} onClick={onFix}>Rule broken · Fix</button>
        ) : status === 'incomplete' ? (
          <span class="mini-status">Incomplete</span>
        ) : null}
      </div>
    </div>
  );
}

/** Register, always in reach at the bottom of the screen whenever the preview column's own Register
 * button can scroll away (single-column screens, or a preview column taller than the screen); says
 * why when it can't be used yet. */
function RegisterBar({ blockedWhy, onRegister }: { blockedWhy: string | null; onRegister: () => void }) {
  return (
    <div class="register-bar" data-testid="register-bar">
      {blockedWhy && <p class="register-bar-why" id="register-bar-why">{blockedWhy}</p>}
      <button
        type="button"
        class="button-primary"
        data-testid="sticky-register"
        disabled={!!blockedWhy}
        aria-describedby={blockedWhy ? 'register-bar-why' : undefined}
        onClick={onRegister}
      >
        Register this design
      </button>
    </div>
  );
}

export function DesignTab(p: Props) {
  const { design, shape, report } = p;
  // The whole left column sticks to the top only while it fits the viewport; a taller column (shape
  // picker, readability, a violation panel, a check result) would otherwise hide its bottom actions.
  // Then only the shield sticks and the Register bar shows. Its content is measured rather than its
  // box, which stretches to the row in that mode; runs after every render as the content changes.
  const layoutRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const el = previewRef.current;
    if (!layout || !el) return;
    const update = () => {
      const last = el.lastElementChild;
      const height = last ? last.getBoundingClientRect().bottom - el.getBoundingClientRect().top : 0;
      layout.setAttribute('data-preview-sticky', height + 24 <= window.innerHeight ? 'true' : 'false');
    };
    update();
    const ro = new ResizeObserver(update);
    Array.from(el.children).forEach((c) => ro.observe(c));
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  });
  const compact = useCompact();
  // Phones collapse the steps, each showing what is chosen; a step with a problem opens by itself.
  const [open, setOpen] = useState<Record<StepKey, boolean>>({ field: false, ordinary: false, charges: false });
  useEffect(() => {
    const broken = report.problems.map((i) => STEP_OF_LAYER[i.layer]);
    if (broken.some((k) => !open[k])) setOpen((o) => ({ ...o, ...Object.fromEntries(broken.map((k) => [k, true])) }));
  }, [report]);
  const accordion = (k: StepKey): Accordion | null => (compact ? { open: open[k], onToggle: () => setOpen((o) => ({ ...o, [k]: !o[k] })) } : null);
  /** Open the step a control lives in, then move to the control once it is on screen. */
  const reveal = (k: StepKey, selector: string) => {
    setOpen((o) => ({ ...o, [k]: true }));
    setTimeout(() => focusControl(selector), 0);
  };
  const goToLayer = (layer: Layer) => reveal(STEP_OF_LAYER[layer], STEP_SELECTOR[layer]);
  // The fix beside Undo recolours the charges and the note goes with it, so focus moves to the new
  // colour's swatch (named by id: the picker may not have re-rendered its checked swatch yet).
  const fixFromNotice = (nd: NormDesign) => {
    p.onChange(nd);
    reveal('charges', nd.charges ? `#swatch-charge-${nd.charges.tincture}` : JUMP_SELECTOR.tincture);
  };
  // The dismiss button disappears with the strip, so focus moves on to the starting designs.
  const welcomeShown = p.onDismissWelcome !== null;
  const welcomeWasShown = useRef(welcomeShown);
  useEffect(() => {
    if (welcomeWasShown.current && !welcomeShown) document.querySelector<HTMLElement>('[data-testid=starting-gallery] button')?.focus();
    welcomeWasShown.current = welcomeShown;
  }, [welcomeShown]);
  const layerIssues = (layer: 'field' | 'ordinary' | 'charges') => report.problems.filter((i) => i.layer === layer);
  const blockedWhy = report.status === 'violation'
    ? 'Fix the problem above before registering.'
    : report.status === 'incomplete' ? 'Add a band or shape, or a picture, first.' : null;

  return (
    <>
    {p.onDismissWelcome && <WelcomeStrip onDismiss={p.onDismissWelcome} />}
    <StartingGallery onPick={p.onStartFrom} onSurprise={p.onSurprise} />
    <div class="design-layout" ref={layoutRef}>
      <MiniPreview
        design={design}
        shape={shape}
        status={report.status}
        watch={figureRef}
        onFix={() => goToLayer(report.problems[0]?.layer ?? 'charges')}
      />
      <div class="design-preview" ref={previewRef}>
        <h2 class="sr-only">Preview</h2>
        <figure class="preview" data-testid="shield-preview" data-status={report.status} ref={figureRef} tabIndex={-1}>
          <Shield design={design} shape={shape} hatching={p.hatching} class="shield-large" />
          <figcaption class="sr-only">Preview of your arms</figcaption>
        </figure>
        <ShapePicker design={design} value={shape} onChange={p.onShape} idPrefix="shape" />
        <div class="preview-toggles">
          <button
            type="button"
            role="switch"
            aria-checked={p.hatching ? 'true' : 'false'}
            class="switch"
            data-testid="hatching-toggle"
            aria-describedby="hatching-help"
            onClick={() => p.onHatching(!p.hatching)}
          >
            <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
            <span>Colour-blind patterns (hatching)</span>
          </button>
          <span id="hatching-help" class="switch-help">Line patterns show each colour without needing to see it.</span>
        </div>
        <SavePicture design={design} shape={shape} hatching={p.hatching} displayName="" />

        <BlazonPanel design={design} />

        {report.status === 'violation' && (
          <ViolationPanel
            design={design}
            problems={report.problems}
            onFix={(nd) => {
              const layer = report.problems[0]?.layer ?? 'charges';
              p.onChange(nd);
              setTimeout(() => goToLayer(layer), 0);
            }}
            onGoTo={goToLayer}
          />
        )}
        {report.hint && (
          <p class="structural-hint" data-testid="structural-hint" role="status">{report.hint}</p>
        )}

        <ReadabilityMeter design={design} report={report} />

        <div class="design-actions">
          <div class="action-row">
            <button
              type="button"
              class="button-primary"
              data-testid="open-register"
              disabled={!!blockedWhy}
              aria-describedby={blockedWhy ? 'actions-why' : undefined}
              onClick={p.onRegister}
            >
              Register this design
            </button>
            <button
              type="button"
              class="button-secondary"
              data-testid="check-availability"
              disabled={!!blockedWhy || p.checking}
              aria-describedby={blockedWhy ? 'actions-why' : undefined}
              onClick={p.onCheck}
            >
              {p.checking ? 'Checking…' : 'Check availability first'}
            </button>
          </div>
          {blockedWhy && <p class="actions-why" id="actions-why">{blockedWhy}</p>}
          {p.availability?.((t) => reveal(STEP_OF_JUMP[t], JUMP_SELECTOR[t]))}
        </div>
      </div>

      <div class="design-builder">
        <h2 class="sr-only">Build your arms</h2>
        <p class="rule-intro" data-testid="rule-intro">
          The one rule (the rule of tincture): gold, white and sky blue (the metals) go on colours, and colours go on metals — never colour on colour or metal on metal. Locked choices would break it; tap one to see why.
        </p>
        <FieldStep design={design} shape={shape} onChange={p.onChange} issues={layerIssues('field')} accordion={accordion('field')} />
        <OrdinaryStep design={design} shape={shape} onChange={p.onChange} issues={layerIssues('ordinary')} accordion={accordion('ordinary')} />
        <ChargesStep design={design} onChange={p.onChange} onAdjust={p.onAdjust} adjusted={p.adjusted(fixFromNotice)} issues={layerIssues('charges')} accordion={accordion('charges')} compact={compact} />
        <div class="builder-footer">
          <button type="button" class="button-tertiary" data-testid="start-over" onClick={p.onStartOver}>
            Start over
          </button>
          <span class="draft-note">Your design is saved on this device as you go.</span>
        </div>
      </div>
      <RegisterBar blockedWhy={blockedWhy} onRegister={p.onRegister} />
    </div>
    </>
  );
}
