import { useState, useEffect, useMemo } from 'react';
import { compileExpr } from './evaluator';

const SVG_W = 720;
const SVG_H = 400;
const PAD = 36;
const N_SAMPLES = 400;
const X_MIN = -10;
const X_MAX = 10;

function mapToSVG(
  val: number,
  domainMin: number,
  domainMax: number,
  svgMin: number,
  svgMax: number,
): number {
  return svgMin + ((val - domainMin) / (domainMax - domainMin)) * (svgMax - svgMin);
}

function computeYRange(ys: number[]): [number, number] {
  const finite = ys.filter(Number.isFinite);
  if (finite.length === 0) return [-10, 10];
  let yMin = Math.min(...finite);
  let yMax = Math.max(...finite);
  if (yMin === yMax) { yMin -= 5; yMax += 5; }
  const pad = (yMax - yMin) * 0.05;
  return [yMin - pad, yMax + pad];
}

export function App() {
  const [expr, setExpr] = useState('sin(x)');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const fn = useMemo(() => compileExpr(expr), [expr]);
  const invalid = fn === null;

  const xs = useMemo(
    () => Array.from({ length: N_SAMPLES }, (_, i) => X_MIN + (X_MAX - X_MIN) * (i / (N_SAMPLES - 1))),
    [],
  );

  const ys = useMemo(() => {
    if (!fn) return xs.map(() => NaN);
    return xs.map(fn);
  }, [fn, xs]);

  const [yMin, yMax] = useMemo(() => computeYRange(ys), [ys]);

  // x/y-axis positions in SVG space
  const axisY = mapToSVG(0, yMin, yMax, SVG_H - PAD, PAD);
  const axisX = mapToSVG(0, X_MIN, X_MAX, PAD, SVG_W - PAD);

  // Split curve into segments over consecutive finite points.
  const segments = useMemo(() => {
    const segs: string[][] = [];
    let current: string[] = [];
    for (let i = 0; i < N_SAMPLES; i++) {
      if (Number.isFinite(ys[i])) {
        const sx = mapToSVG(xs[i], X_MIN, X_MAX, PAD, SVG_W - PAD);
        const sy = mapToSVG(ys[i], yMin, yMax, SVG_H - PAD, PAD);
        current.push(`${sx.toFixed(2)},${sy.toFixed(2)}`);
      } else {
        if (current.length > 1) segs.push(current);
        current = [];
      }
    }
    if (current.length > 1) segs.push(current);
    return segs;
  }, [ys, xs, yMin, yMax]);

  return (
    <div className="container">
      <div className="input-row">
        <label htmlFor="expr-input">f(x) =</label>
        <input
          id="expr-input"
          type="text"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          className={invalid ? 'error' : ''}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div className="error-msg">{invalid ? 'Invalid expression' : ''}</div>

      <svg
        className="plot-svg"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`Plot of f(x) = ${expr}`}
      >
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#f4f4f4" />

        {/* x-axis */}
        <line
          x1={PAD} y1={axisY} x2={SVG_W - PAD} y2={axisY}
          stroke="#999" strokeWidth={1}
        />
        {/* y-axis */}
        <line
          x1={axisX} y1={PAD} x2={axisX} y2={SVG_H - PAD}
          stroke="#999" strokeWidth={1}
        />

        {/* curve segments */}
        {segments.map((pts, idx) => (
          <polyline
            key={idx}
            points={pts.join(' ')}
            fill="none"
            stroke="#2563eb"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      {ready && <div id="widget-ready" style={{ display: 'none' }} />}
    </div>
  );
}
