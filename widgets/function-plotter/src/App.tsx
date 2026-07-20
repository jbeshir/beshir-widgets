import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import * as Plot from '@observablehq/plot';
import { compileExpr } from './evaluator';

const N_SAMPLES = 480;
const X_MIN = -10;
const X_MAX = 10;
const Y_CLAMP = 1e6;

type Sample = { x: number; y: number; seg: number };

function sampleFunction(fn: (x: number) => number): Sample[] {
  const out: Sample[] = [];
  let seg = 0;
  let prevFinite = false;
  let prevY = 0;
  for (let i = 0; i < N_SAMPLES; i++) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / (N_SAMPLES - 1);
    const y = fn(x);
    const finite = Number.isFinite(y) && Math.abs(y) < Y_CLAMP;
    if (!finite) {
      prevFinite = false;
      continue;
    }
    // Split into a new segment on discontinuity jumps (very large step between adjacent samples).
    if (prevFinite && Math.abs(y - prevY) > 50) {
      seg++;
    }
    out.push({ x, y, seg });
    prevFinite = true;
    prevY = y;
  }
  return out;
}

function computeYDomain(samples: Sample[]): [number, number] {
  if (samples.length === 0) return [-10, 10];
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of samples) {
    if (s.y < yMin) yMin = s.y;
    if (s.y > yMax) yMax = s.y;
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return [-10, 10];
  if (yMin === yMax) {
    yMin -= 5;
    yMax += 5;
  }
  const pad = (yMax - yMin) * 0.08;
  return [yMin - pad, yMax + pad];
}

export function App() {
  const [expr, setExpr] = useState('sin(x)');
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(720);
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fn = useMemo(() => compileExpr(expr), [expr]);
  const invalid = fn === null;

  // Journey lifecycle contract: plotting is interactive once its first render
  // completes; invalid input is a deterministic input-processing error.
  useEffect(() => {
    document.documentElement.dataset.widgetState = !ready
      ? 'loading'
      : invalid
        ? 'error'
        : 'ready';
  }, [ready, invalid]);

  const samples = useMemo(() => {
    if (!fn) return [] as Sample[];
    return sampleFunction(fn);
  }, [fn]);

  const yDomain = useMemo(() => computeYDomain(samples), [samples]);

  // Observe container width so the plot is responsive within the iframe.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(280, Math.floor(entry.contentRect.width));
        setWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Report content height so a host page can auto-size the iframe to fit.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const send = () =>
      window.parent.postMessage({ type: 'resize', height: el.scrollHeight }, '*');
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, []);

  // Mount/update the Observable Plot SVG.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (samples.length < 2) {
      host.replaceChildren();
      if (!ready) setReady(true);
      return;
    }

    const node = Plot.plot({
      width,
      height: Math.max(260, Math.round(width * 0.55)),
      marginLeft: 52,
      marginBottom: 40,
      marginRight: 18,
      marginTop: 18,
      style: {
        background: 'transparent',
        color: 'var(--fg)',
        fontFamily: 'inherit',
        fontSize: '14px',
      },
      x: {
        domain: [X_MIN, X_MAX],
        label: 'x →',
        grid: true,
        nice: true,
      },
      y: {
        domain: yDomain,
        label: '↑ f(x)',
        grid: true,
        nice: true,
      },
      marks: [
        Plot.ruleX([0], { stroke: 'var(--axis)', strokeWidth: 1 }),
        Plot.ruleY([0], { stroke: 'var(--axis)', strokeWidth: 1 }),
        Plot.line(samples, {
          x: 'x',
          y: 'y',
          z: 'seg',
          stroke: 'var(--curve)',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      ],
    });

    host.replaceChildren(node);
    if (!ready) setReady(true);

    return () => {
      node.remove();
    };
  }, [samples, yDomain, width, ready]);

  return (
    <div className="container" ref={rootRef}>
      <div className="card">
        <header className="card-header">
          <h1>Function plotter</h1>
          <p className="hint">
            Try expressions in <code>x</code> like <code>sin(x)</code>, <code>x^2 - 4</code>,{' '}
            <code>1/x</code>, <code>exp(-x^2/4)*cos(x)</code>.
          </p>
        </header>

        <div className="input-row">
          <label htmlFor="expr-input">f(x) =</label>
          <input
            id="expr-input"
            data-testid="expression-input"
            type="text"
            value={expr}
            onInput={(e) => setExpr((e.target as HTMLInputElement).value)}
            className={invalid ? 'error' : ''}
            spellcheck={false}
            autocomplete="off"
            aria-invalid={invalid}
            aria-describedby="expr-error"
          />
        </div>
        <div id="expr-error" className="error-msg" role="alert" data-testid="expression-error">
          {invalid ? 'Invalid expression' : ''}
        </div>

        <div className="plot-wrap" ref={containerRef}>
          <div className="plot-host" ref={hostRef} aria-label={`Plot of f(x) = ${expr}`} />
        </div>
      </div>

      {ready && <div id="widget-ready" data-ready="true" hidden />}
    </div>
  );
}
