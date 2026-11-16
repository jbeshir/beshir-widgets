import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Front } from './components/Front';
import { Back } from './components/Back';
import { Controls } from './components/Controls';
import { AstrolabeGuide } from './components/AstrolabeGuide';
import { useLessonUi } from './lessonUi';
import { FRAME_PADDING, magnifyTransform, magnifyView, unionBox, type FractionBox, type MagnifyView } from './magnify';
import { getState, useStore } from './store';
import { toolTips, type TurnedTool } from './toolTips';
import { HIGHLIGHTS_APPLIED } from './tutorial/highlights';
import { frameSelector, type FrameRef } from './tutorial/parts';
import type { Snapshot } from './tutorial/types';

const PHONE = '(max-width: 520px)';
/** Space round the Magnify button inside the frame (px); matches .magnify-toggle in styles.css. */
const MAGNIFY_BUTTON_INSET = 4;

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    update();
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** The step's frame (else its highlighted parts) as a box in instrument fractions (independent of any zoom already applied). */
function highlightBox(instrument: Element, refs: readonly FrameRef[]): FractionBox | null {
  const frame = instrument.getBoundingClientRect();
  if (frame.width < 1 || frame.height < 1) return null;
  let box: FractionBox | null = null;
  const selector = refs.length ? refs.map(frameSelector).join(', ') : '[data-highlighted]';
  for (const el of instrument.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) continue;
    const next = {
      x0: (r.left - frame.left) / frame.width, y0: (r.top - frame.top) / frame.height,
      x1: (r.right - frame.left) / frame.width, y1: (r.bottom - frame.top) / frame.height,
    };
    box = box
      ? { x0: Math.min(box.x0, next.x0), y0: Math.min(box.y0, next.y0), x1: Math.max(box.x1, next.x1), y1: Math.max(box.y1, next.y1) }
      : next;
  }
  return box && { x0: Math.max(0, box.x0), y0: Math.max(0, box.y0), x1: Math.min(1, box.x1), y1: Math.min(1, box.y1) };
}

/** The tool a your-turn step has the learner turn, with how far (degrees of its own rotation). */
function turnedTools(solution: Partial<Snapshot> | null): { tool: TurnedTool; turn: number }[] {
  if (!solution) return [];
  const state = getState();
  const fields = [['rule', 'ruleRotation'], ['alidade', 'alidadeRotation']] as const;
  return fields.flatMap(([tool, field]) => (solution[field] === undefined ? [] : [{ tool, turn: solution[field] - state[field] }]));
}

/** The frame box together with the tip of the turned tool, now and at the solution, so the tool is in view too. */
function boxWithTools(instrument: Element, box: FractionBox | null, solution: Partial<Snapshot> | null): FractionBox | null {
  if (!box) return box;
  const rect = instrument.getBoundingClientRect();
  const near = { x: rect.left + (box.x0 + box.x1) / 2 * rect.width, y: rect.top + (box.y0 + box.y1) / 2 * rect.height };
  let all = box;
  for (const { tool, turn } of turnedTools(solution)) {
    for (const p of toolTips(instrument, tool, turn, near)) {
      const x = (p.x - rect.left) / rect.width;
      const y = (p.y - rect.top) / rect.height;
      all = unionBox(all, { x0: x, y0: y, x1: x, y1: y }) ?? all;
    }
  }
  return all;
}

/** Where the guide panel starts on the page: the desktop panel is sized to end inside the viewport from there. */
function publishLayoutTop(root: HTMLElement): void {
  const layout = root.querySelector('.widget-layout');
  if (layout) root.style.setProperty('--layout-top', `${Math.round(layout.getBoundingClientRect().top + window.scrollY)}px`);
}

export function App(): JSX.Element {
  const state = useStore();
  const lesson = useLessonUi();
  const phone = useMedia(PHONE);
  const [ready, setReady] = useState(false);
  /** The learner's own Magnify choice; null leaves it to the default (on, on a phone, when a step's highlights are small). */
  const [magnifyChoice, setMagnifyChoice] = useState<boolean | null>(null);
  const [view, setView] = useState<MagnifyView>(() => magnifyView(null));
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    document.documentElement.dataset.widgetState = ready ? 'ready' : 'loading';
  }, [ready]);

  // Report content height so a host page can auto-size the iframe to fit.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const send = () => {
      window.parent.postMessage({ type: 'resize', height: el.scrollHeight }, '*');
      publishLayoutTop(el);
    };
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, []);

  // Frame the step's highlighted parts as soon as they are marked and once the step has settled
  // (and again when the face or the screen changes).
  useEffect(() => {
    const measure = () => {
      if (rootRef.current) publishLayoutTop(rootRef.current);
      const instrument = frameRef.current?.querySelector('.astro-instrument');
      const frameEl = frameRef.current;
      if (instrument && frameEl) {
        const padding = lesson.frame.length ? FRAME_PADDING : undefined;
        const button = frameEl.querySelector<HTMLElement>('.magnify-toggle');
        // The Magnify button lies over the top of the view: keep the framed parts below it.
        const reserve = button ? Math.min(0.4, (button.offsetHeight + 2 * MAGNIFY_BUTTON_INSET) / Math.max(1, frameEl.getBoundingClientRect().height)) : 0;
        const box = highlightBox(instrument, lesson.frame);
        const target = magnifyView(box, padding, reserve);
        // Automatic Magnify must keep the tool the learner turns in view too (at the start and at the solution): else it stays off.
        const withTool = magnifyView(boxWithTools(instrument, box, lesson.solution), padding, reserve);
        setView(withTool.fits ? withTool : { ...target, fits: false });
      }
    };
    measure();
    window.addEventListener(HIGHLIGHTS_APPLIED, measure);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener(HIGHLIGHTS_APPLIED, measure); window.removeEventListener('resize', measure); };
  }, [lesson.stepKey, lesson.settled, lesson.frame, lesson.solution, state.face, phone]);

  // On a phone the engraving is too small to read: zoom in by default while a step's small highlights fit at 2x.
  const automatic = phone && lesson.active && (lesson.hasHighlights || lesson.frame.length > 0) && view.fits;
  const magnified = magnifyChoice ?? automatic;

  return (
    <div className={`container${lesson.active ? ' lesson-active' : ''}`} ref={rootRef}>
      <div className="card">
        <header className="card-header header-row">
          <h1>Astrolabe Simulator</h1>
          <p className="hint">A working map of the heavens, engraved for latitude {state.plateLatitude.toFixed(2)}°.</p>
        </header>
        <Controls />
        <div className="widget-layout">
          <div className={`instrument-stage${state.reducedMotion ? ' reduced-motion' : ''}`}>
            <div className={`magnify-frame${magnified ? ' is-magnified' : ''}`} ref={frameRef}>
              <button className="magnify-toggle" data-testid="magnify-toggle" aria-pressed={magnified} onClick={() => setMagnifyChoice(!magnified)}>Magnify</button>
              <div className="magnify-content" data-magnified={magnified} style={magnified ? { transform: magnifyTransform(view), '--hl-zoom': view.zoom.toFixed(4) } : undefined}>
                {state.face === 'front' ? <Front /> : <Back />}
              </div>
            </div>
          </div>
          <AstrolabeGuide />
        </div>
      </div>
      {ready && <div id="widget-ready" data-ready="true" hidden />}
    </div>
  );
}
