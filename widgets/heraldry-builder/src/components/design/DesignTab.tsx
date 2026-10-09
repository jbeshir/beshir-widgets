// Design tab (PLAN §6): live preview + blazon + readability on the left (sticky on wide screens),
// the Field / Ordinary / Charges builder on the right. Check availability and Register are wired to
// callbacks owned by App; this component only reports the design and renders what it is given.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { blazon, type NormDesign } from '../../lib/heraldry';
import type { Issue } from '../../lib/heraldry';
import type { DesignReport } from '../../lib/builder';
import type { RefObject } from 'preact';
import type { JumpTarget } from '../Availability';
import { Shield } from '../Shield';
import { BlazonPanel } from './BlazonPanel';
import { ChargesStep, FieldStep, OrdinaryStep } from './BuilderSteps';
import { ReadabilityMeter } from './ReadabilityMeter';
import { ViolationPanel } from './ViolationPanel';

interface Props {
  design: NormDesign;
  report: DesignReport;
  onChange: (nd: NormDesign) => void;
  onStartOver: () => void;
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
function MiniPreview({ design, status, watch, onFix }: { design: NormDesign; status: DesignReport['status']; watch: RefObject<HTMLElement>; onFix: () => void }) {
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
        <Shield design={design} size={40} label={null} />
        <p class="mini-blazon">{blazon(design)}</p>
        {status === 'violation' ? (
          <button type="button" class="button-primary button-small mini-fix" tabIndex={away ? 0 : -1} onClick={onFix}>Rule broken · Fix</button>
        ) : (
          <span class="mini-status">{status === 'incomplete' ? 'Incomplete' : 'Follows the rules'}</span>
        )}
      </div>
    </div>
  );
}

export function DesignTab(p: Props) {
  const { design, report } = p;
  // The left column sticks to the top only while it fits the viewport; a taller column (e.g. with
  // a violation panel and a check result) would otherwise hide its bottom actions.
  const previewRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => el.setAttribute('data-sticky', el.offsetHeight + 24 <= window.innerHeight ? 'true' : 'false');
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  const goToLayer = (layer: Layer) => focusControl(STEP_SELECTOR[layer]);
  const layerIssues = (layer: 'field' | 'ordinary' | 'charges') => report.problems.filter((i) => i.layer === layer);
  const blockedWhy = report.status === 'violation'
    ? 'Fix the problem above before checking or registering.'
    : report.status === 'incomplete' ? 'Add an ordinary or a charge first.' : null;

  return (
    <div class="design-layout">
      <MiniPreview
        design={design}
        status={report.status}
        watch={figureRef}
        onFix={() => goToLayer(report.problems[0]?.layer ?? 'charges')}
      />
      <div class="design-preview" ref={previewRef}>
        <h2 class="sr-only">Preview</h2>
        <figure class="preview" data-testid="shield-preview" data-status={report.status} ref={figureRef} tabIndex={-1}>
          <Shield design={design} hatching={p.hatching} class="shield-large" />
          <figcaption class="sr-only">Preview of your arms</figcaption>
        </figure>
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
            <span>Hatching</span>
          </button>
          <span id="hatching-help" class="switch-help">Line patterns show each tincture without colour.</span>
        </div>

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

        <ReadabilityMeter design={design} />

        <div class="design-actions">
          <div class="action-row">
            <button
              type="button"
              class="button-primary"
              data-testid="check-availability"
              disabled={!!blockedWhy || p.checking}
              aria-describedby={blockedWhy ? 'actions-why' : undefined}
              onClick={p.onCheck}
            >
              {p.checking ? 'Checking…' : 'Check availability'}
            </button>
            <button
              type="button"
              class="button-secondary"
              data-testid="open-register"
              disabled={!!blockedWhy}
              aria-describedby={blockedWhy ? 'actions-why' : undefined}
              onClick={p.onRegister}
            >
              Register…
            </button>
          </div>
          {blockedWhy && <p class="actions-why" id="actions-why">{blockedWhy}</p>}
          {p.availability?.((t) => focusControl(JUMP_SELECTOR[t]))}
        </div>
      </div>

      <div class="design-builder">
        <h2 class="sr-only">Build your arms</h2>
        <p class="rule-intro" data-testid="rule-intro">
          The rule of tincture: put metals (Or, Argent) on colours and colours on metals, never colour on colour or metal on metal. Locked options below would break it.
        </p>
        <FieldStep design={design} onChange={p.onChange} issues={layerIssues('field')} />
        <OrdinaryStep design={design} onChange={p.onChange} issues={layerIssues('ordinary')} />
        <ChargesStep design={design} onChange={p.onChange} issues={layerIssues('charges')} />
        <div class="builder-footer">
          <button type="button" class="button-tertiary" data-testid="start-over" onClick={p.onStartOver}>
            Start over
          </button>
          <span class="draft-note">Your design is saved on this device as you go.</span>
        </div>
      </div>
    </div>
  );
}
