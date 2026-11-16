import { applyTransaction, getState, reset, setFace } from '../store';
import { LESSONS } from './catalog';
import { CONCEPTS } from './concepts';
import {
  PARTIAL_COVERAGE, PARTS, PART_IDS, describePartRef, formatPartValue, partFace, partId, partInstance, partSelector, type PartId, type PartRef,
} from './parts';
import { composeTutorialSearch } from './url';
import { toolTips, type ScreenPoint } from '../toolTips';
import type { Face } from '../store';
import type { Lesson, LessonStep } from './types';

export type ProbeCheck = 'resolve' | 'face' | 'bbox' | 'occluded' | 'highlight' | 'stale-highlight' | 'copy' | 'coherence' | 'timeout'
  | 'frame' | 'part-missing' | 'part-unknown' | 'part-instance' | 'pending-rendered' | 'filter';
export interface ProbeFailure { lessonId: string; stepId: string; stepNumber: number; check: ProbeCheck; ref?: string; detail: string }
export interface RefVisibility {
  ref: string; elements: number; samples: number; conclusive: number; visible: number; occluders: string[]; pass: boolean;
}
export interface StepAudit {
  lessonId: string; stepId: string; stepNumber: number; heading: string; renderedText: string;
  refs: RefVisibility[]; warnings: string[]; failures: ProbeFailure[];
}

/** Test and tooling hooks, exposed as `window.astrolabe.inspect`. */
export interface AstrolabeInspect {
  /**
   * Opens a lesson step through the real shared-link path (history entry plus
   * `popstate`) and resolves once the step has settled: its snapshot is applied,
   * any demonstration has finished, and the render has committed. A step can be
   * given by index or by id. Rejects on an unknown lesson or step, or after
   * `timeoutMs` (default 3000) if the step never settles.
   */
  openStep(lessonId: string, step: number | string, options?: { timeoutMs?: number }): Promise<void>;
  /** A copy of a catalog step (including its `solution`), for test walks. Never shown to the learner. */
  step(lessonId: string, step: number | string): LessonStep | undefined;
  /** The whole course as plain data (a copy), for the lesson gallery. */
  catalog(): readonly Lesson[];
  /** The elements a part reference resolves to (all instances for a bare id). */
  resolveRef(ref: PartRef, root?: ParentNode): Element[];
  /** Hit-tests samples along the reference's drawn geometry: how much of it can the learner see? */
  probeVisibility(ref: PartRef, options?: { maxSamples?: number }): RefVisibility;
  /** Every part of the vocabulary is drawn on its face, with every instance value (resets the instrument). */
  auditParts(): Promise<ProbeFailure[]>;
  /** Audits the open step (call after openStep): highlights, visibility, copy and coherence. */
  auditStep(lessonId: string, step: number | string, options: { visibility: boolean }): Promise<StepAudit>;
  /** Opens and audits every step (of the given lessons, default all). Collects every failure. */
  auditCourse(options: { visibility: boolean; lessons?: readonly string[]; budgetMs?: number }): Promise<{ steps: number; failures: ProbeFailure[]; audits: StepAudit[] }>;
  formatFailure(failure: ProbeFailure): string;
}

export function findStep(lessonId: string, step: number | string): LessonStep | undefined {
  const lesson = LESSONS.find((item) => item.id === lessonId);
  const found = typeof step === 'number' ? lesson?.steps[step] : lesson?.steps.find((item) => item.id === step);
  return found ? structuredClone(found) : undefined;
}

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export function openStep(lessonId: string, step: number | string, options: { timeoutMs?: number } = {}): Promise<void> {
  const lesson = LESSONS.find((item) => item.id === lessonId);
  if (!lesson) return Promise.reject(new Error(`Unknown lesson: ${lessonId}`));
  const target = typeof step === 'number' ? lesson.steps[step] : lesson.steps.find((item) => item.id === step);
  if (!target) return Promise.reject(new Error(`Unknown step ${String(step)} in ${lessonId}`));
  const timeoutMs = options.timeoutMs ?? 3000;

  const search = composeTutorialSearch(window.location.search, lesson.id, target.id);
  window.history.pushState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));

  return (async () => {
    // A timer, not a clock reading: the journey harness freezes performance.now and Date.now.
    let expired = false;
    const timer = setTimeout(() => { expired = true; }, timeoutMs);
    await frame(); // let the guide re-render before trusting its markers
    for (;;) {
      const panel = document.querySelector('aside.astrolabe-guide');
      const phase = panel?.getAttribute('data-step-phase');
      if (panel?.getAttribute('data-lesson') === lesson.id && panel.getAttribute('data-step') === target.id
        && (phase === 'ready' || phase === 'passed')) break;
      if (expired) throw new Error(`Timed out opening ${lesson.id}/${target.id}: phase is ${phase ?? 'absent'}`);
      await frame();
    }
    clearTimeout(timer);
    await frame();
    await frame();
  })();
}

// ---------------------------------------------------------------------------
// Probes. Everything below reads the rendered DOM; the pure parts are unit-tested.
// ---------------------------------------------------------------------------

const BANNED_COPY = /\b(fixture|deterministic|endpoint|API|solver|snapshot|predicate|checkpoint|rotation|undefined|NaN|null)\b/i;
const IDENTIFIER_COPY = /\b[a-z]+[A-Z]\w*\b|data-|\$\{|=>/;
const MIN_VISIBLE_SAMPLES = 3;
const MIN_VISIBLE_FRACTION = 0.25;
const WARN_VISIBLE_FRACTION = 0.5;
const SINGLE_VISIBLE_FRACTION = 0.5;
const REF_SAMPLE_BUDGET = 64;
const ELEMENT_SAMPLE_BUDGET = 24;
const PAINT = 'path, circle, line, rect, ellipse, polygon, polyline, text';
const PAINT_OR_USE = `${PAINT}, use`;

export type SampleClass<T> = { kind: 'visible' } | { kind: 'occluded'; by: T } | { kind: 'inconclusive' };

/**
 * Classifies one hit-test stack (topmost first). The first entry that belongs to the target decides:
 * only ancestors of the target above it means visible; anything else above it occludes. A stack
 * without the target is inconclusive (the sample missed the drawn geometry).
 */
export function classifyStack<T>(stack: readonly T[], isTarget: (entry: T) => boolean, isAncestor: (entry: T) => boolean): SampleClass<T> {
  const index = stack.findIndex(isTarget);
  if (index < 0) return { kind: 'inconclusive' };
  const blocker = stack.slice(0, index).find((entry) => !isAncestor(entry));
  return blocker === undefined ? { kind: 'visible' } : { kind: 'occluded', by: blocker };
}

/**
 * Pass rule: at least three visible samples and a quarter of the conclusive ones; partial-coverage
 * parts need only the count. A single instance (one tick with its numeral, one line, one star tip)
 * is one small mark that a cue asks the learner to find: if half of it is under metal the cue
 * cannot be followed, so it needs half of its samples (the family rule is for parts made of many marks).
 */
export function visibilityPasses(visible: number, conclusive: number, partial: boolean, single = false): boolean {
  if (visible < MIN_VISIBLE_SAMPLES) return false;
  if (partial) return true;
  return visible / conclusive >= (single ? SINGLE_VISIBLE_FRACTION : MIN_VISIBLE_FRACTION);
}

export function formatFailure(f: ProbeFailure): string {
  return `${f.lessonId}#${f.stepNumber} ${f.stepId}${f.ref ? ` ${f.ref}` : ''}: ${f.check} ${f.detail}`;
}

export function resolveRef(ref: PartRef, root: ParentNode = document): Element[] {
  return [...root.querySelectorAll(partSelector(ref))];
}

const frames = async (count: number): Promise<void> => { for (let i = 0; i < count; i += 1) await frame(); };

const faceOf = (el: Element): string | null => el.closest('[data-face]')?.getAttribute('data-face') ?? null;
const evenly = <T,>(items: readonly T[], count: number): T[] =>
  items.length <= count ? [...items] : Array.from({ length: count }, (_, i) => items[Math.floor(((i + 0.5) * items.length) / count)]);
const inViewport = (p: { x: number; y: number }): boolean => p.x >= 0 && p.y >= 0 && p.x < window.innerWidth && p.y < window.innerHeight;
const label = (el: Element | null | undefined): string => {
  const owner = el?.closest('[data-part]');
  if (owner) {
    const instance = owner.getAttributeNames().find((name) => name.startsWith('data-') && !['data-part', 'data-concept', 'data-highlighted'].includes(name) && !name.startsWith('data-hl'));
    return `${owner.getAttribute('data-part')}${instance ? `[${instance.slice(5)}=${owner.getAttribute(instance)}]` : ''}`;
  }
  return el ? `${el.tagName.toLowerCase()}${el.classList.length ? `.${el.classList[0]}` : ''}` : 'nothing';
};

/** The elements that actually paint a part: itself, or the shapes and text it owns (not nested parts, not texture layers). */
function paintElements(owner: Element): Element[] {
  if (!(owner instanceof SVGElement)) return [owner];
  const own = shapesOf(owner, true);
  return own.length ? own : shapesOf(owner, false);
}

/** Shapes inside `owner`; with `sameOnly`, only those not belonging to a differently named nested part. */
function shapesOf(owner: SVGElement, sameOnly: boolean): Element[] {
  const candidates = owner.matches(PAINT) ? [owner] : [...owner.querySelectorAll(sameOnly ? PAINT : PAINT_OR_USE)];
  return candidates.filter((node) => {
    if (sameOnly && node.closest('[data-part]')?.getAttribute('data-part') !== owner.getAttribute('data-part')) return false;
    const layer = node.closest('[data-occludes="false"]');
    if (layer && owner.contains(layer)) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    return node.matches('use') || style.stroke !== 'none' || style.fill !== 'none';
  });
}

function screenPoints(el: SVGGraphicsElement, local: readonly (readonly [number, number])[]): { x: number; y: number }[] {
  const ctm = el.getScreenCTM();
  if (!ctm) return [];
  return local.map(([x, y]) => new DOMPoint(x, y).matrixTransform(ctm));
}

/** Client-space sample points along the element's geometry (strokes), inside its fill, or across its box. */
function samplePoints(el: Element, count: number): { x: number; y: number }[] {
  if (el instanceof SVGGeometryElement) {
    const style = getComputedStyle(el);
    if (style.stroke !== 'none' && parseFloat(style.strokeWidth) > 0) {
      const total = el.getTotalLength();
      const at = (fraction: number): readonly [number, number] => { const p = el.getPointAtLength(total * fraction); return [p.x, p.y] as const; };
      const centres = screenPoints(el, Array.from({ length: count }, (_, i) => at((i + 0.5) / count)));
      // The painted stroke is wider than its centre line: a tick under a hairline edge still shows beside it. Sample both sides too.
      const reach = Math.max(0.75, (parseFloat(style.strokeWidth) * Math.abs(el.getScreenCTM()?.a ?? 1)) / 2 - 0.75);
      const ahead = screenPoints(el, Array.from({ length: count }, (_, i) => at(Math.min(1, (i + 0.5) / count + 0.5 / count / 4))));
      return centres.flatMap((p, i) => {
        const dx = ahead[i].x - p.x; const dy = ahead[i].y - p.y; const length = Math.hypot(dx, dy) || 1;
        return [p, { x: p.x - (dy / length) * reach, y: p.y + (dx / length) * reach }, { x: p.x + (dy / length) * reach, y: p.y - (dx / length) * reach }];
      }).filter(inViewport);
    }
    const box = el.getBBox();
    const grid: (readonly [number, number])[] = [];
    for (let i = 0; i < 15; i += 1) for (let j = 0; j < 15; j += 1) {
      const x = box.x + ((i + 0.5) / 15) * box.width;
      const y = box.y + ((j + 0.5) / 15) * box.height;
      if (el.isPointInFill(new DOMPoint(x, y))) grid.push([x, y]);
    }
    return screenPoints(el, evenly(grid, count)).filter(inViewport);
  }
  const rect = el.getBoundingClientRect();
  const grid = (n: number): number[][] => Array.from({ length: n * n }, (_, k) => [(Math.floor(k / n) + 0.5) / n, ((k % n) + 0.5) / n]);
  const fractions = el instanceof SVGTextElement ? [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]] : el instanceof SVGElement ? grid(10) : grid(3);
  return fractions.map(([x, y]) => ({ x: rect.left + x * rect.width, y: rect.top + y * rect.height })).filter(inViewport);
}

const PROBE_CSS = 'svg{pointer-events:none!important}svg *{pointer-events:visiblePainted!important}'
  + ':not(svg)[data-occludes=false],:not(svg)[data-occludes=false] *,svg[data-occludes=false]{pointer-events:none!important}';

/** Runs `work` with hit-testing equal to painting: hit-only layers and textures never block. */
function withProbeStyle<T>(work: () => T, extraCss = ''): T {
  const style = document.createElement('style');
  style.id = 'occlusion-probe';
  style.textContent = PROBE_CSS + extraCss;
  document.head.append(style);
  try { return work(); } finally { style.remove(); }
}

const TOOL_OF_OCCLUDER: Readonly<Record<string, 'ruleRotation' | 'alidadeRotation'>> = {
  rule: 'ruleRotation', 'rule-edge': 'ruleRotation', alidade: 'alidadeRotation', 'alidade-edge': 'alidadeRotation',
};

/** The tools a predicate is about: the rule (an angle, or a rule point) and the alidade. */
function checkTools(check: LessonStep['check'], into: Set<string>): void {
  if (!check || check.kind === 'choice') return;
  if (check.kind === 'allOf') { for (const inner of check.predicates) checkTools(inner, into); return; }
  if (check.kind === 'angleNear') into.add(check.field);
  else if (check.kind === 'frontGeometry' && check.rulePoint) into.add('ruleRotation');
  else if (check.kind === 'alidadeAltitude' || check.kind === 'alidadeLongitude') into.add('alidadeRotation');
}

/**
 * The tools a step lays on its subject: the ones it moves (its demonstration, or its `solution`) and the ones its
 * check is about. Only the end state counts: a your-turn step's starting position must not hide anything.
 */
function toolsInvolved(step: LessonStep): Set<string> {
  const fields = new Set<string>();
  const demo = step.demonstration;
  if (demo && (!demo.kind || demo.kind === 'angle')) {
    fields.add(demo.field);
    if (demo.companion) fields.add(demo.companion.field);
  }
  for (const field of ['ruleRotation', 'alidadeRotation'] as const) if (step.solution?.[field] !== undefined) fields.add(field);
  checkTools(step.check, fields);
  return fields;
}

/**
 * Hit-tests the locator rings (the two-tone ring drawn above the tools around a single instance): the share of
 * their rim that shows. When a step asks the learner to lay a tool on a single tick, the tick is under the tool's
 * edge by design; what must still be findable is its ring.
 */
export function locatorVisibility(): { visible: number; conclusive: number } {
  const rims = [...document.querySelectorAll('.astro-hl-locator-rim')].filter((el): el is SVGGeometryElement => el instanceof SVGGeometryElement);
  const result = { visible: 0, conclusive: 0 };
  // The rings live in hit-exempt layers: switch them back on for this probe only.
  withProbeStyle(() => {
    for (const rim of rims) {
      const ctm = rim.getScreenCTM();
      if (!ctm) continue;
      const total = rim.getTotalLength();
      for (let i = 0; i < 24; i += 1) {
        const at = rim.getPointAtLength((total * (i + 0.5)) / 24);
        const point = new DOMPoint(at.x, at.y).matrixTransform(ctm);
        if (!inViewport(point)) continue;
        const top = document.elementsFromPoint(point.x, point.y)[0];
        result.conclusive += 1;
        if (top && top.closest('.astro-hl-locator')) result.visible += 1;
      }
    }
  }, '.astro-hl-locator.astro-hl-locator,.astro-hl-locator.astro-hl-locator *{pointer-events:visiblePainted!important}');
  return result;
}

export function probeVisibility(ref: PartRef, options: { maxSamples?: number } = {}): RefVisibility {
  const budget = options.maxSamples ?? REF_SAMPLE_BUDGET;
  const id = partId(ref);
  const elements = resolveRef(ref);
  const result: RefVisibility = { ref: describePartRef(ref), elements: elements.length, samples: 0, conclusive: 0, visible: 0, occluders: [], pass: false };
  if (elements.length === 0) return result;
  const targets = new Set(elements);
  const isTarget = (entry: Element): boolean => { for (let n: Element | null = entry; n; n = n.parentElement) if (targets.has(n)) return true; return false; };
  // A part drawn by <use> or an image has no shapes of its own to follow: fall back to a grid over its box.
  const owners = [...new Set(elements.flatMap((owner) => { const own = paintElements(owner); return own.length ? own : [owner]; }))].map((node) => ({ node }));
  const partial = PARTIAL_COVERAGE.has(id);
  const chosen = evenly(owners, Math.min(owners.length, 16));
  const perElement = Math.min(ELEMENT_SAMPLE_BUDGET, Math.max(MIN_VISIBLE_SAMPLES, Math.floor(budget / Math.max(1, chosen.length))));
  const occluders = new Set<string>();
  withProbeStyle(() => {
    for (const { node } of chosen) {
      const widened = node instanceof SVGGeometryElement && getComputedStyle(node).stroke !== 'none';
      const previous = widened ? node.style.getPropertyValue('stroke-width') : '';
      if (widened) {
        const scale = Math.abs(node.getScreenCTM()?.a ?? 1) || 1;
        if (parseFloat(getComputedStyle(node).strokeWidth) * scale < 3) node.style.setProperty('stroke-width', `${3 / scale}px`, 'important');
      }
      try {
        for (const point of samplePoints(node, perElement)) {
          if (result.samples >= budget * 3) break;
          result.samples += 1;
          const verdict = classifyStack(document.elementsFromPoint(point.x, point.y), isTarget, (entry) => entry.contains(node));
          if (verdict.kind === 'inconclusive') continue;
          // A neighbouring instance of the same part (the next half-degree tick, under a stroke widened for the probe) is not a tool or a plate over the mark.
          if (verdict.kind === 'occluded' && partInstance(ref) !== null && verdict.by.closest('[data-part]')?.getAttribute('data-part') === id) continue;
          result.conclusive += 1;
          if (verdict.kind === 'visible') result.visible += 1; else occluders.add(label(verdict.by));
        }
      } finally {
        if (widened) { if (previous) node.style.setProperty('stroke-width', previous); else node.style.removeProperty('stroke-width'); }
      }
    }
  });
  result.occluders = [...occluders];
  result.pass = visibilityPasses(result.visible, result.conclusive, partial, partInstance(ref) !== null);
  return result;
}

// --- parts rendered (J1) -----------------------------------------------------

export async function auditParts(): Promise<ProbeFailure[]> {
  const failures: ProbeFailure[] = [];
  const fail = (check: ProbeCheck, ref: string, detail: string): void => {
    failures.push({ lessonId: 'parts', stepId: ref, stepNumber: 0, check, ref, detail });
  };
  reset();
  const known = new Set<string>(PART_IDS);
  for (const face of ['front', 'back'] as Face[]) {
    setFace(face);
    await frames(2);
    const root = document.querySelector(`[data-face="${face}"]`);
    if (!root) { fail('part-missing', face, `no [data-face="${face}"] element`); continue; }
    for (const id of PART_IDS) {
      const info = PARTS[id];
      if (info.face === 'controls' || (info.face !== 'both' && info.face !== face)) continue;
      const found = [...root.querySelectorAll(`[data-part="${id}"]`)];
      if (found.length === 0) { fail('part-missing', id, `not rendered on the ${face} face`); continue; }
      if (!info.instance) continue;
      const present = new Set(found.map((el) => el.getAttribute(`data-${info.instance!.key}`)));
      const missing = info.instance.values.filter((value) => !present.has(formatPartValue(value)));
      if (missing.length) fail('part-missing', id, `${missing.length} ${info.instance.key} values not rendered on ${face}: ${missing.slice(0, 6).join(', ')}`);
    }
    for (const el of root.querySelectorAll('[data-part]')) {
      const id = el.getAttribute('data-part') ?? '';
      if (!known.has(id)) { fail('part-unknown', id, `unknown data-part on the ${face} face`); continue; }
      const instance = PARTS[id as PartId].instance;
      const value = instance ? el.getAttribute(`data-${instance.key}`) : null;
      if (instance && value !== null && !instance.values.some((v) => formatPartValue(v) === value)) fail('part-instance', id, `${instance.key}="${value}" is not in the domain`);
    }
    for (const id of ['rete', 'rule', 'alidade']) {
      for (const owner of root.querySelectorAll(`[data-part="${id}"]`)) {
        for (const el of [owner, ...owner.querySelectorAll('*')]) {
          const filter = getComputedStyle(el).filter;
          if (filter !== 'none') { fail('filter', id, `${label(el)} has filter ${filter}`); break; }
        }
      }
    }
  }
  for (const id of PART_IDS) {
    if (PARTS[id].face !== 'controls') continue;
    if (![...document.querySelectorAll(`[data-part="${id}"]`)].some((el) => !el.closest('[data-face]'))) fail('part-missing', id, 'control not rendered');
  }
  for (const el of document.querySelectorAll('[data-part]')) {
    const id = el.getAttribute('data-part') ?? '';
    if (!known.has(id)) fail('part-unknown', id, 'unknown data-part outside the faces');
  }
  reset();
  await frames(2);
  return failures;
}

// --- step audit (J2) -----------------------------------------------------------

const circularDelta = (a: number, b: number): number => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** The snapshot as it stands once any demonstration has finished. */
function endState(step: LessonStep): { face: Face; reteRotation: number; ruleRotation: number; alidadeRotation: number; plateLatitude: number } {
  const { face, reteRotation, ruleRotation, alidadeRotation, plateLatitude } = step.snapshot;
  const end = { face, reteRotation, ruleRotation, alidadeRotation, plateLatitude };
  const demo = step.demonstration;
  if (demo?.kind === 'face') end.face = demo.to;
  else if (demo?.kind === 'plate') end.plateLatitude = demo.to;
  else if (demo) {
    end[demo.field] = demo.to;
    if (demo.companion) end[demo.companion.field] = demo.companion.to;
  }
  return end;
}

/** The refs a step must show: its highlights, plus the parts of concepts it introduces as highlighted or animated. */
function stepTargets(step: LessonStep): { highlighted: PartRef[]; shown: PartRef[] } {
  const shown = step.introduces.map((id) => CONCEPTS.find((c) => c.id === id))
    .filter((c) => c !== undefined && (c.visibility === 'highlighted' || c.visibility === 'animated'))
    .flatMap((c) => [...c!.parts])
    .filter((ref) => !step.highlights.includes(ref) && (partFace(ref) === 'both' || partFace(ref) === 'controls' || partFace(ref) === endState(step).face));
  return { highlighted: [...step.highlights], shown };
}

/** True when the two rectangles overlap (touching edges do not count). */
const overlaps = (a: DOMRect, b: DOMRect): boolean => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;

/**
 * Magnified view: everything the step frames (else highlights) must lie inside the visible frame and clear of the Magnify button, and so must
 * the tip of the tool a your-turn step has the learner turn (now, or at the solution). Nothing is required while the view is not magnified.
 */
function frameProblems(step: LessonStep, stage: string, turning: boolean): string[] {
  const content = document.querySelector('.magnify-content[data-magnified="true"]');
  const view = document.querySelector('.magnify-frame')?.getBoundingClientRect();
  const instrument = document.querySelector('.astro-instrument');
  const framed = step.frame?.length ? step.frame : step.highlights;
  if (!content || !view || !instrument || !framed.length) return [];
  const button = document.querySelector('.magnify-toggle')?.getBoundingClientRect();
  const problems: string[] = [];
  const place = (what: string, r: DOMRect): void => {
    const inside = r.left >= view.left - 1 && r.right <= view.right + 1 && r.top >= view.top - 1 && r.bottom <= view.bottom + 1;
    if (!inside) problems.push(`${stage}${what} is outside the magnified view`);
    else if (button && overlaps(r, button)) problems.push(`${stage}${what} is under the Magnify button`);
  };
  let all: DOMRect | null = null;
  for (const ref of framed) {
    const rects = resolveRef(ref).map((el) => el.getBoundingClientRect()).filter((r) => Math.max(r.width, r.height) >= 1);
    if (!rects.length) continue;
    const left = Math.min(...rects.map((r) => r.left)); const top = Math.min(...rects.map((r) => r.top));
    const box = new DOMRect(left, top, Math.max(...rects.map((r) => r.right)) - left, Math.max(...rects.map((r) => r.bottom)) - top);
    all = all ? new DOMRect(Math.min(all.left, box.left), Math.min(all.top, box.top), Math.max(all.right, box.right) - Math.min(all.left, box.left), Math.max(all.bottom, box.bottom) - Math.min(all.top, box.top)) : box;
    place(describePartRef(ref), box);
  }
  if (turning && all) {
    const near: ScreenPoint = { x: all.left + all.width / 2, y: all.top + all.height / 2 };
    const state = getState();
    for (const [tool, field] of [['rule', 'ruleRotation'], ['alidade', 'alidadeRotation']] as const) {
      const to = step.solution?.[field];
      if (to === undefined) continue;
      const [now, solved] = toolTips(instrument, tool, to - state[field], near);
      for (const [label, p] of [['now', now], ['at the solution', solved]] as const) if (p) place(`the ${tool} tip ${label}`, new DOMRect(p.x, p.y, 0, 0));
    }
  }
  return problems;
}

export async function auditStep(lessonId: string, stepKey: number | string, options: { visibility: boolean }): Promise<StepAudit> {
  const lesson = LESSONS.find((l) => l.id === lessonId);
  const index = lesson ? (typeof stepKey === 'number' ? stepKey : lesson.steps.findIndex((s) => s.id === stepKey)) : -1;
  const step = lesson?.steps[index];
  if (!lesson || !step) throw new Error(`Unknown step ${String(stepKey)} in ${lessonId}`);
  const panel = document.querySelector('aside.astrolabe-guide') as HTMLElement | null;
  const audit: StepAudit = {
    lessonId, stepId: step.id, stepNumber: index + 1, heading: document.querySelector('#lesson-step-heading')?.textContent ?? '',
    renderedText: panel?.innerText ?? '', refs: [], warnings: [], failures: [],
  };
  const fail = (check: ProbeCheck, detail: string, ref?: string): void => {
    audit.failures.push({ lessonId, stepId: step.id, stepNumber: index + 1, check, detail, ...(ref ? { ref } : {}) });
  };
  const { highlighted, shown } = stepTargets(step);
  const highlightedEls = new Set<Element>();
  const probeRef = (ref: PartRef, els: Element[], name: string, stage: string, moved: ReadonlySet<string> = new Set()): void => {
    const target = els.find((el) => { const r = el.getBoundingClientRect(); return Math.max(r.width, r.height) >= 1; }) ?? els[0];
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const box = target.getBoundingClientRect();
    const onScreen = els.some((el) => {
      const r = el.getBoundingClientRect();
      return Math.max(r.width, r.height) >= 1 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    });
    if (!onScreen) { fail('bbox', `${stage}no element has a visible box in the viewport (first is ${Math.round(box.width)}x${Math.round(box.height)})`, name); return; }
    const probe = probeVisibility(ref);
    audit.refs.push(stage ? { ...probe, ref: `${probe.ref} (${stage.trim().replace(/:$/, '')})` } : probe);
    const fraction = probe.conclusive ? probe.visible / probe.conclusive : 0;
    // Laid on by design: only the tool the step moves hides a single instance, and its ring still shows.
    const byMovedTool = partInstance(ref) !== null && probe.occluders.length > 0
      && probe.occluders.every((o) => { const tool = TOOL_OF_OCCLUDER[o.replace(/\[.*$/, '')]; return tool !== undefined && moved.has(tool); });
    const ring = !probe.pass && byMovedTool ? locatorVisibility() : null;
    if (ring && ring.conclusive > 0 && ring.visible / ring.conclusive >= SINGLE_VISIBLE_FRACTION) {
      audit.warnings.push(`${name}: ${stage}under the tool the step lays on it (${probe.visible}/${probe.conclusive}); its ring shows ${ring.visible}/${ring.conclusive}`);
    } else if (!probe.pass) {
      fail('occluded', `${stage}${probe.visible}/${probe.conclusive} visible, by ${probe.occluders.join(', ') || 'unknown (no conclusive samples)'}`, name);
    } else if (fraction < WARN_VISIBLE_FRACTION && !PARTIAL_COVERAGE.has(partId(ref))) {
      audit.warnings.push(`${name}: ${stage}only ${probe.visible}/${probe.conclusive} visible`);
    }
  };

  for (const [refs, mustHighlight] of [[highlighted, true], [shown, false]] as const) {
    for (const ref of refs) {
      const name = describePartRef(ref);
      const els = resolveRef(ref);
      if (els.length === 0) { fail('resolve', 'no element on the page', name); continue; }
      const wanted = partFace(ref);
      const stepFace = endState(step).face;
      const wrongFace = els.filter((el) => (wanted === 'controls' ? faceOf(el) !== null : faceOf(el) !== stepFace));
      if (wrongFace.length === els.length) { fail('face', `drawn on face ${faceOf(wrongFace[0]) ?? 'none'}, step is on ${stepFace}`, name); continue; }
      if (mustHighlight) {
        for (const el of els) highlightedEls.add(el);
        const missing = els.filter((el) => el.getAttribute('data-highlighted') !== 'true');
        if (missing.length) fail('highlight', `${missing.length}/${els.length} elements lack the highlight marker`, name);
      }
      if (!options.visibility) continue;
      probeRef(ref, els, name, '', step.mode === 'demonstrate' ? toolsInvolved(step) : undefined);
    }
  }

  if (options.visibility) for (const detail of frameProblems(step, '', step.mode === 'your-turn')) fail('frame', detail);

  // The END state. A demonstrate step is audited above at the end of its demonstration (openStep waits for it).
  // A your-turn step is audited again with its `solution` applied: the position the learner is asked to reach
  // must not hide what the step is about (lessons-03-04-01). The learner-facing state is restored afterwards.
  if (options.visibility && step.solution && step.mode === 'your-turn') {
    const before = getState();
    applyTransaction(step.solution, { source: 'host', syncUrl: false });
    await frames(3);
    for (const ref of highlighted) {
      const els = resolveRef(ref);
      if (els.length) probeRef(ref, els, describePartRef(ref), 'at solution: ', toolsInvolved(step));
    }
    for (const detail of frameProblems(step, 'at solution: ', true)) fail('frame', detail);
    const { face, location, plateSelection, plateLatitude, reteRotation, ruleRotation, alidadeRotation, visibility, epochIso } = before;
    applyTransaction({ face, location, plateSelection, plateLatitude, reteRotation, ruleRotation, alidadeRotation, visibility, epochIso }, { source: 'host', syncUrl: false });
    await frames(2);
  }
  const stale = [...document.querySelectorAll('[data-highlighted]')].filter((el) => !highlightedEls.has(el));
  if (stale.length) fail('stale-highlight', `${stale.length} unexpected highlighted: ${[...new Set(stale.map(label))].slice(0, 4).join(', ')}`);

  const hit = audit.renderedText.match(BANNED_COPY) ?? audit.renderedText.match(IDENTIFIER_COPY);
  if (hit) fail('copy', `panel text contains “${hit[0]}”`);

  const problems: string[] = [];
  if (audit.heading !== step.title) problems.push(`heading is “${audit.heading}”`);
  const params = new URLSearchParams(window.location.search);
  if (params.get('lesson') !== lessonId || params.get('step') !== step.id) problems.push(`URL is ${window.location.search}`);
  const state = getState();
  const end = endState(step);
  if (state.face !== end.face) problems.push(`face is ${state.face}, expected ${end.face}`);
  for (const field of ['reteRotation', 'ruleRotation', 'alidadeRotation'] as const) {
    if (circularDelta(state[field], end[field]) > 0.01) problems.push(`${field} is ${state[field].toFixed(2)}, expected ${end[field].toFixed(2)}`);
  }
  if (Math.abs(state.plateLatitude - end.plateLatitude) > 0.01) problems.push(`plate is ${state.plateLatitude}, expected ${end.plateLatitude}`);
  const next = [...document.querySelectorAll('.lesson-actions button')].find((b) => b.textContent === 'Next') as HTMLButtonElement | undefined;
  if (step.mode === 'your-turn' && next && !next.disabled) problems.push('Next is enabled on an unsolved your-turn step');
  if (problems.length) fail('coherence', problems.join('; '));
  return audit;
}

export async function auditCourse(options: { visibility: boolean; lessons?: readonly string[]; budgetMs?: number }):
Promise<{ steps: number; failures: ProbeFailure[]; audits: StepAudit[] }> {
  const failures: ProbeFailure[] = [];
  const audits: StepAudit[] = [];
  let expired = false;
  const timer = setTimeout(() => { expired = true; }, options.budgetMs ?? 120000);
  for (const lesson of LESSONS) {
    if (options.lessons && !options.lessons.includes(lesson.id)) continue;
    for (const [index, step] of lesson.steps.entries()) {
      if (expired) {
        failures.push({ lessonId: lesson.id, stepId: step.id, stepNumber: index + 1, check: 'timeout', detail: 'audit budget exhausted before this step' });
        continue;
      }
      try {
        await openStep(lesson.id, index);
        const audit = await auditStep(lesson.id, index, { visibility: options.visibility });
        audits.push(audit);
        failures.push(...audit.failures);
      } catch (error) {
        failures.push({ lessonId: lesson.id, stepId: step.id, stepNumber: index + 1, check: 'timeout', detail: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  clearTimeout(timer);
  return { steps: audits.length, failures, audits };
}

export const catalog = (): readonly Lesson[] => structuredClone(LESSONS);

export function installInspect(): void {
  if (window.astrolabe) {
    window.astrolabe.inspect = { openStep, step: findStep, catalog, resolveRef, probeVisibility, auditParts, auditStep, auditCourse, formatFailure };
  }
}

