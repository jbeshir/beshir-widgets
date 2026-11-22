/**
 * Where the tip of the tool a your-turn step has the learner turn lies (the rule's Sun end, the alidade's
 * end), now and after the turn, so Magnify can keep the tool in view as well as the target.
 */
export interface ScreenPoint { x: number; y: number }
export type TurnedTool = 'rule' | 'alidade';

const ARMS: Record<TurnedTool, string[]> = {
  // The Sun end of the rule is its +y arm; either end of the alidade can be laid on the target.
  rule: ['[data-part="rule-edge"] > line.astro-fiducial-vertical-pos'],
  alidade: ['[data-part="alidade-edge"] > line.astro-fiducial-horizontal-pos', '[data-part="alidade-edge"] > line.astro-fiducial-horizontal-neg'],
};

/** The tool's group is drawn with `rotate(rotation * sign)` (the alidade's rotation runs the other way). */
const LOCAL_TURN: Record<TurnedTool, number> = { rule: 1, alidade: -1 };

/**
 * The tool's tip on screen now and once its rotation parameter has changed by `turn` degrees. An arm's line lies in
 * the rotating group's own frame, so its screen matrix times a local rotation gives the turned position.
 * For the alidade the end that finishes nearest `near` is used. Empty when the tool is not drawn.
 */
export function toolTips(root: Element, tool: TurnedTool, turn: number, near: ScreenPoint): ScreenPoint[] {
  const t = turn * LOCAL_TURN[tool] * Math.PI / 180;
  const arms = ARMS[tool].flatMap((selector) => [...root.querySelectorAll(selector)]).filter((el): el is SVGLineElement => el instanceof SVGLineElement);
  const ends = arms.flatMap((line) => {
    const m = line.getScreenCTM();
    if (!m) return [];
    const x = line.x2.baseVal.value;
    const y = line.y2.baseVal.value;
    const at = (px: number, py: number): ScreenPoint => { const p = new DOMPoint(px, py).matrixTransform(m); return { x: p.x, y: p.y }; };
    return [[at(x, y), at(x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t))]];
  });
  if (!ends.length) return [];
  const best = ends.reduce((a, b) => (Math.hypot(a[1].x - near.x, a[1].y - near.y) <= Math.hypot(b[1].x - near.x, b[1].y - near.y) ? a : b));
  return best;
}
