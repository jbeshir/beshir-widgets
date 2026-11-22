import { useEffect } from 'preact/hooks';
import { useStore } from '../store';
import { conceptsForPart } from './concepts';
import { PART_IDS, partInstance, partSelector, type PartRef } from './parts';
import {
  chainTransforms, haloKind, haloLayer, layerFor, locatorGapOffset, redrawsMark, wantsLocator, type HaloFrame, type HaloKind, type HaloLayer,
} from './highlightLayout';

/**
 * Step highlights are plain attributes on the real elements:
 *   `data-highlighted`  on every element a `PartRef` resolves to;
 *   `data-hl-shape` / `data-hl-text`  on the paintable shapes and text that
 *     belong to that element itself (not to a nested part).
 * Invisible highlight-only outlines (`data-hl-outline`) take part too.
 *
 * The marks themselves are never recoloured (a red scale stays red, a rule's
 * numbers stay legible). The emphasis is added: for every marked shape a
 * two-tone halo is drawn into a highlight layer the instrument renders for it
 * (see highlightLayout.ts), followed by a copy of the mark in its own colours,
 * and single ticks, numerals and stars get a locator ring. A whole scale gets
 * one band round it instead of a halo per tick (`data-hl-outline="band"`). Nothing here uses
 * a filter or animates; the copies are hidden from assistive technology and
 * from hit-testing.
 */
const SHAPES = 'path, circle, line, rect, ellipse, polygon, polyline, use';
const MARKS = '[data-highlighted], [data-hl-shape], [data-hl-text]';
/** Gap, in halo widths (--hl-k), between a numeral's glyph box and its locator ring: room for the numeral's own halo. */
const NUMERAL_RING_CLEARANCE = 10;
const SVG_NS = 'http://www.w3.org/2000/svg';
/** True when `node`, inside the highlighted `owner`, is a texture, shadow or glint layer rather than the part itself. */
const isOverlay = (node: Element, owner: Element): boolean => {
  const layer = node.closest('[data-occludes="false"]:not([data-hl-outline])');
  return layer !== null && owner.contains(layer);
};

/** Halo copies made for the current highlights, so rotating frames can re-place them. */
let placed: { wrapper: Element; source: Element; stop: Element; base?: Element }[] = [];

function layers(root: ParentNode): Element[] {
  return [...root.querySelectorAll('[data-hl-layer]')];
}

export function clearHighlights(root: ParentNode = document): void {
  for (const el of root.querySelectorAll(MARKS)) {
    el.removeAttribute('data-highlighted');
    el.removeAttribute('data-hl-shape');
    el.removeAttribute('data-hl-text');
  }
  for (const layer of layers(root)) layer.replaceChildren();
  placed = [];
}

/** The rotating part (`data-hl-frame`) a node is drawn in, or the static frame of its own SVG. */
function frameOf(node: Element): { frame: HaloFrame; stop: Element } | null {
  const root = node.closest('[data-hl-frame-root]');
  if (root) return { frame: root.getAttribute('data-hl-frame-root') as HaloFrame, stop: root };
  const svg = node.closest('svg');
  return svg ? { frame: 'base', stop: svg } : null;
}

/** Ancestor transforms between the frame and the node (outermost first). */
function chainOf(node: Element, stop: Element): string {
  const chain: (string | null)[] = [];
  for (let el = node.parentElement; el && el !== stop; el = el.parentElement) chain.unshift(el.getAttribute('transform'));
  return chainTransforms(chain);
}

function container(node: Element, frame: HaloFrame, stop: Element, layer: HaloLayer): Element | null {
  const face = node.closest('[data-face]') ?? document;
  if (frame !== 'base') {
    if (layer === 'top') return face.querySelector(`[data-hl-layer="top"][data-hl-frame="${frame}"]`);
    return [...stop.children].find((child) => child.getAttribute('data-hl-layer') === layer) ?? null;
  }
  if (layer !== 'top') {
    const own = stop.querySelector(`[data-hl-layer="${layer}"][data-hl-frame="base"]`);
    if (own) return own;
  }
  return face.querySelector('[data-hl-layer="top"][data-hl-frame="base"]');
}

/** Each layer paints all outer rims, then all pale cores, then the marks, then the locators, so no halo covers another mark. */
function tier(layer: Element, name: 'outer' | 'core' | 'mark' | 'locator'): Element {
  let group = [...layer.children].find((child) => child.getAttribute('data-hl-tier') === name);
  if (!group) {
    group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-hl-tier', name);
    const order = ['outer', 'core', 'mark', 'locator'];
    const after = [...layer.children].find((child) => order.indexOf(child.getAttribute('data-hl-tier') ?? '') > order.indexOf(name));
    layer.insertBefore(group, after ?? null);
  }
  return group;
}

/** A copy that carries the mark's geometry and look, but no identity: no id, part data, ARIA or focus. */
function inertCopy(node: Element, extraClass: string): Element {
  const copy = node.cloneNode(true) as Element;
  for (const el of [copy, ...copy.querySelectorAll('*')]) {
    for (const name of el.getAttributeNames()) {
      if (name === 'id' || name.startsWith('data-') || name.startsWith('aria-') || name === 'role' || name === 'tabindex') el.removeAttribute(name);
    }
  }
  if (extraClass) copy.setAttribute('class', `${copy.getAttribute('class') ?? ''} ${extraClass}`.trim());
  return copy;
}

/** Ancestors of `node` below `stop` that clip it (outermost first): the plate's engraving is clipped to the plate. */
function clippersOf(node: Element, stop: Element): Element[] {
  const found: Element[] = [];
  for (let el = node.parentElement; el && el !== stop; el = el.parentElement) if (el.hasAttribute('clip-path')) found.unshift(el);
  return found;
}

/** The transform of an element's ancestors below `stop`, plus its own. */
const chainThrough = (el: Element, stop: Element): string => chainTransforms([chainOf(el, stop), el.getAttribute('transform')]);

/**
 * Places `child` in a wrapper. A halo of something clipped (a plate engraving) is clipped the same way, so it never
 * runs past the edge of the plate: the wrapper sits inside copies of the clipping groups, each in its own space.
 */
function wrap(into: Element, transform: string, child: Element, source: Element, stop: Element): void {
  const wrapper = document.createElementNS(SVG_NS, 'g');
  const clippers = child.classList.contains('astro-hl-locator') ? [] : clippersOf(source, stop);
  let parent: Element = into;
  let base: Element | undefined;
  if (clippers.length) {
    let previous = stop;
    for (const clipper of clippers) {
      const group = document.createElementNS(SVG_NS, 'g');
      const t = chainThrough(clipper, previous);
      if (t) group.setAttribute('transform', t);
      group.setAttribute('clip-path', clipper.getAttribute('clip-path') ?? '');
      parent.append(group);
      parent = group;
      previous = clipper;
    }
    base = previous;
  }
  const own = base ? chainOf(source, base) : transform;
  const full = base && child.classList.contains('astro-hl-locator') ? chainTransforms([own, source.getAttribute('transform')]) : own;
  if (full) wrapper.setAttribute('transform', full);
  wrapper.append(child);
  parent.append(wrapper);
  // Only the rotating parts re-render with a new transform; a static face's copies never need re-placing.
  if (!stop.matches('svg')) placed.push({ wrapper, source, stop, base });
}

/** Centre of a point-like mark in its own user space. */
function centreOf(node: Element): { x: number; y: number } | null {
  const num = (name: string) => Number(node.getAttribute(name) ?? 0);
  if (node.matches('line')) return { x: (num('x1') + num('x2')) / 2, y: (num('y1') + num('y2')) / 2 };
  if (node.matches('circle')) return { x: num('cx'), y: num('cy') };
  if (node instanceof SVGGraphicsElement && typeof node.getBBox === 'function') {
    const box = node.getBBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  return node.matches('text') ? { x: num('x'), y: num('y') } : null;
}

/** Radius, in the numeral's own units, of the circle through the corners of its glyph box; null for anything but text. */
function numeralRingRadius(node: Element): number | null {
  if (!node.matches('text') || !(node instanceof SVGGraphicsElement) || typeof node.getBBox !== 'function') return null;
  const box = node.getBBox();
  return Math.ceil(Math.hypot(box.width, box.height) / 2);
}

function locate(node: Element, single: boolean): void {
  const where = frameOf(node);
  const centre = centreOf(node);
  if (!where || !centre) return;
  const into = container(node, where.frame, where.stop, layerFor(single ? 'top' : 'over', where.frame));
  if (!into) return;
  const ring = document.createElementNS(SVG_NS, 'g');
  ring.setAttribute('class', 'astro-hl-locator');
  // A star's ring opens towards the name engraved beside its tip, so the ring never cuts the name.
  const gap = node.getAttribute('data-hl-gap');
  const radius = numeralRingRadius(node);
  for (const part of ['rim', 'core']) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', `astro-hl-locator-${part}`);
    circle.setAttribute('cx', String(centre.x));
    circle.setAttribute('cy', String(centre.y));
    circle.setAttribute('r', '22');
    // A numeral gets a ring that clears the whole glyph (the CSS radius would cross it).
    if (radius !== null) circle.style.setProperty('--hl-ring', `calc(${radius}px + var(--hl-k) * ${NUMERAL_RING_CLEARANCE}px)`);
    if (gap !== null) {
      circle.setAttribute('pathLength', '360');
      circle.setAttribute('stroke-dasharray', '260 100');
      circle.setAttribute('stroke-dashoffset', String(locatorGapOffset(Number(gap))));
    }
    ring.append(circle);
  }
  wrap(tier(into, 'locator'), chainTransforms([chainOf(node, where.stop), node.getAttribute('transform')]), ring, node, where.stop);
}

function kindOf(node: Element): HaloKind {
  return haloKind({
    tag: node.tagName.toLowerCase(),
    fill: typeof getComputedStyle === 'function' ? getComputedStyle(node).fill ?? '' : '',
    outline: node.hasAttribute('data-hl-outline'),
  });
}

/**
 * `ring`: draw the two-tone halo; `mark`: redraw the mark above it in its own colours.
 * A part outlined as a whole (its metal body, or its highlight-only outline) keeps
 * its engraving as it is: only redrawn above an outline halo, never haloed itself.
 */
function halo(node: Element, kind: HaloKind, pointLike: boolean, ring: boolean, layerKind: HaloKind = kind): void {
  // A highlighted reading edge widens onto its own metal only (styles.css): a halo would spill onto the open side.
  if (node.matches('.astro-fiducial')) return;
  const where = frameOf(node);
  if (!where) return;
  const band = node.getAttribute('data-hl-outline') === 'band';
  const into = container(node, where.frame, where.stop, layerFor(haloLayer(layerKind, where.frame, pointLike, band), where.frame));
  if (!into) return;
  const transform = chainOf(node, where.stop);
  const flavour = `astro-hl-${kind}`;
  if (ring) {
    wrap(tier(into, 'outer'), transform, inertCopy(node, `astro-hl-outer ${flavour}`), node, where.stop);
    wrap(tier(into, 'core'), transform, inertCopy(node, `astro-hl-core ${flavour}`), node, where.stop);
  }
  if (redrawsMark(kind)) wrap(tier(into, 'mark'), transform, inertCopy(node, 'astro-hl-mark'), node, where.stop);
  // An outline that stands for metal (a star blade) is refilled with that metal, so its halo frames it without eating into it.
  const refill = node.getAttribute('data-hl-refill');
  if (ring && kind === 'outline' && refill) wrap(tier(into, 'mark'), transform, inertCopy(node, `astro-hl-mark ${refill}`), node, where.stop);
}

/** Marks every element the refs resolve to and draws its halo; returns how many elements matched. */
export function applyHighlights(refs: readonly PartRef[], root: ParentNode = document): number {
  clearHighlights(root);
  let matched = 0;
  for (const ref of refs) {
    const owners = [...root.querySelectorAll(partSelector(ref))];
    const anchors = owners.map((el) => ({ el, anchor: el.querySelector('[data-hl-anchor]') }));
    const single = partInstance(ref) !== null;
    const locating = single && wantsLocator(anchors.map(({ el, anchor }) => ({ tag: el.tagName.toLowerCase(), anchored: anchor !== null })));
    // A whole scale is outlined once, by its band; its ticks and numerals are marked but get no halo of their own.
    const banded = !single && owners.some((el) => el.querySelector(':scope > [data-hl-outline="band"]'));
    for (const { el, anchor } of anchors) {
      matched += 1;
      el.setAttribute('data-highlighted', 'true');
      if (!(el instanceof SVGElement)) continue;
      const own = [el, ...el.querySelectorAll(`${SHAPES}, text`)]
        .filter((node) => node.closest('[data-part]') === el && !isOverlay(node, el));
      const kinds = own.map((node) => ({ node, kind: kindOf(node) }));
      // A highlight-only outline, when the part has one, stands for the whole part (it is drawn round the part's free edge).
      const whole = (kinds.find(({ kind }) => kind === 'outline') ?? kinds.find(({ kind }) => kind === 'body'))?.kind;
      for (const { node, kind } of kinds) {
        if (node.matches('text')) node.setAttribute('data-hl-text', 'true');
        else if (node.matches(SHAPES)) node.setAttribute('data-hl-shape', 'true');
        else continue;
        if (banded) { if (node.getAttribute('data-hl-outline') === 'band') halo(node, kind, false, true); }
        else if (!whole || kind === whole) halo(node, kind, locating, true);
        else if (whole === 'outline') halo(node, kind, locating, false, 'outline');
      }
      if (locating) locate(anchor ?? el, single);
    }
  }
  return matched;
}

/** Re-places the halo copies after a rotating part re-rendered (upright labels carry a rotation-dependent transform). */
export function syncHighlights(): void {
  for (const { wrapper, source, stop, base } of placed) {
    if (!source.isConnected) continue;
    const isLocator = wrapper.firstElementChild?.classList.contains('astro-hl-locator') ?? false;
    const from = base ?? stop;
    const transform = isLocator ? chainTransforms([chainOf(source, from), source.getAttribute('transform')]) : chainOf(source, from);
    if ((wrapper.getAttribute('transform') ?? '') !== transform) {
      if (transform) wrapper.setAttribute('transform', transform); else wrapper.removeAttribute('transform');
    }
  }
}

let conceptsByPart: ReadonlyMap<string, string> | null = null;
/** Adds `data-concept="<ids>"`: the concepts whose ledger parts include the element's part. Generated from concepts.ts. */
export function annotateConcepts(root: ParentNode = document): void {
  conceptsByPart ??= new Map(PART_IDS.map((id) => [id, conceptsForPart(id).join(' ')]));
  for (const [id, concepts] of conceptsByPart) {
    if (!concepts) continue;
    for (const el of root.querySelectorAll(`[data-part="${id}"]:not([data-concept])`)) el.setAttribute('data-concept', concepts);
  }
}

/** Reference-tab part keys, expressed as the same `PartRef`s. */
const REFERENCE_PARTS: Readonly<Record<string, readonly PartRef[]>> = {
  mater: ['mater', 'throne'],
  plate: ['plate'],
  rete: ['rete'],
  rule: ['rule'],
  back: ['back-degree-scale', 'altitude-scale', 'zodiac-scale', 'calendar-scale', 'shadow-square', 'eot-curve', 'horary-quadrant'],
  alidade: ['alidade'],
};

export const HIGHLIGHTS_APPLIED = 'astrolabe-highlights-applied';

/** Keeps the rendered instrument in step with the open step's highlights and the Reference tab's hover. */
export function useHighlights(stepRefs: readonly PartRef[]): void {
  const { face, plateLatitude, visibility, highlight, reteRotation, ruleRotation, alidadeRotation } = useStore();
  const refs = [...stepRefs, ...(highlight ? REFERENCE_PARTS[highlight] ?? [] : [])];
  const refsKey = JSON.stringify(refs);
  const layersKey = JSON.stringify(visibility);
  // The instrument re-mounts elements when the face, plate or a layer changes, so those re-apply too.
  useEffect(() => {
    annotateConcepts();
    applyHighlights(refs);
    // The layout frames the highlighted parts (Magnify) as soon as they are marked.
    window.dispatchEvent(new Event(HIGHLIGHTS_APPLIED));
  }, [refsKey, face, plateLatitude, layersKey]);
  useEffect(() => { syncHighlights(); }, [reteRotation, ruleRotation, alidadeRotation]);
}
