# Widget library menu

Top-in-class libraries for building widgets — Preact core runtime, bundled by Vite, embedded in an iframe. One or two best picks per domain, not an exhaustive catalogue. Sizes are min+gzip measured 2026-06-08; they are **reference, not a target** (see [How To Choose](#how-to-choose)). Everything is framework-agnostic and works with Preact unless noted.

## Charts & statistical viz

Default to **Observable Plot**.

| Library | gzip | Best for | Notes |
|---|--:|---|---|
| [Observable Plot](https://observablehq.com/plot/) | 135 KB | Polished statistical / explanatory charts (grammar of graphics) | **Default.** SVG output, no CDN |
| [uPlot](https://github.com/leeoniya/uPlot) | 23 KB | Dense or realtime time-series, thousands of points | tiny, fast, canvas |
| [Chart.js](https://www.chartjs.org/) | 49 KB | Conventional bar / line / pie charts | register only the pieces you use |
| [ECharts](https://echarts.apache.org/) (modular) | 168 KB | Rich interactive dashboards — tooltips, zoom, legends | reach for it when you need the breadth |

Heavy / niche: **Plotly** (~1.4 MB) — only when you genuinely need its scientific/3D plotting; **Recharts** / **visx** are React-bound, so prefer modular D3 or Plot.

## Math — plotting & equations

| Library | gzip | Best for | Notes |
|---|--:|---|---|
| [D3 modules](https://d3js.org/) (`d3-scale` / `d3-shape` / `d3-axis`) | 30 KB | Bespoke plots, axes, scales, paths in your own SVG | the flexible base for custom viz |
| [KaTeX](https://katex.org/) | 77 KB +CSS | Rendering TeX equations | bundle its CSS/fonts; prefer over MathJax |
| [expr-eval](https://www.npmjs.com/package/expr-eval) | 8 KB | Safely evaluating user-entered formulas | or native `Math` for fixed expressions |

## Geometry, graphs & networks

| Library | gzip | Best for | Notes |
|---|--:|---|---|
| [d3-force](https://d3js.org/d3-force) / [d3-hierarchy](https://d3js.org/d3-hierarchy) | ~6 KB each | Node-link layouts, trees, treemaps — you render the marks | pair with your own SVG/canvas |
| [Cytoscape.js](https://js.cytoscape.org/) | 142 KB | Full interactive graph / network UI — selection, layouts, styling | batteries-included; heavier |

Need only layered/DAG positioning? [dagre](https://github.com/dagrejs/dagre) (~31 KB) or [ELK.js](https://github.com/kieler/elkjs) computes coordinates you then render yourself.

## Simulation & physics

For draggable bodies, collisions, and object physics.

| Library | gzip | Best for | Notes |
|---|--:|---|---|
| [Matter.js](https://brm.io/matter-js/) | 28 KB | 2D rigid-body physics — draggable bodies, collisions, constraints | **the pick** for physics toys |
| [p5.js](https://p5js.org/) | 392 KB | Creative-coding / generative sketches | sizeable but fine; great for sketch-style widgets |
| plain Canvas2D | 0 KB | Particles, cellular automata, custom simulations | default for simple loops |

## 2D / 3D rendering

| Library | gzip | Best for | Notes |
|---|--:|---|---|
| [PixiJS](https://pixijs.com/) | 140 KB | High-performance 2D WebGL — many sprites, filters, scene graph | when Canvas2D isn't enough |
| [three.js](https://threejs.org/) | 188 KB | Real 3D scenes | asset-heavy if models/textures are used |
| plain Canvas2D | 0 KB | Straightforward 2D drawing & animation | default |

## Animation & motion

Gate non-essential motion behind `prefers-reduced-motion`.

| Library | gzip | Best for | Notes |
|---|--:|---|---|
| [Web Animations API](https://developer.mozilla.org/docs/Web/API/Web_Animations_API) | 0 KB | DOM/SVG keyframes & transitions | native; default |
| [Motion](https://motion.dev/) | 23 KB | Springs / keyframes, imperative | framework-agnostic, polished |
| [GSAP](https://gsap.com/) | 28 KB | Complex timelines & sequencing | check its license for your use |

## Interaction — drag, gestures, pan/zoom

For moving objects around, recognizing gestures, and zoomable canvases. (Iframe resize/sizing plumbing is in [How To Choose](#how-to-choose), not a library.)

| Library | gzip | Best for | Notes |
|---|--:|---|---|
| [interact.js](https://interactjs.io/) | 30 KB | Draggable / resizable / droppable objects with inertia & snapping | **the pick** for draggable objects |
| [@use-gesture/vanilla](https://use-gesture.netlify.app/) | 7 KB | Drag / pinch / wheel gesture recognition | feed positions into your own render loop |
| [d3-zoom](https://d3js.org/d3-zoom) | 16 KB | Pan / zoom transforms for SVG or canvas (wheel, drag, pinch) | works with SVG or canvas |

For physics-driven dragging — throw, collide, settle — drive the objects with **Matter.js** (above).

## Maps

Maps fetch tiles at runtime, so give dev and the render check an offline fallback (a bundled style or a static sample) and a loading state. [MapLibre GL](https://maplibre.org/) (~283 KB, vector) or [Leaflet](https://leafletjs.com/) (~44 KB code + tiles). For schematic or choropleth maps, draw SVG yourself.

## Utilities (only if needed)

Reach for native APIs first — `JSON`, `Intl`, `URLSearchParams`, `Date`. If you genuinely need more: [date-fns](https://date-fns.org/) (~7 KB, tree-shaken dates), [Papa Parse](https://www.papaparse.com/) (~8 KB, messy CSV), [Comlink](https://github.com/GoogleChromeLabs/comlink) (~2 KB, move heavy work to a Worker).

## How To Choose

1. **Pick the tool that produces the best widget.** Optimize for the result — clarity, polish, correctness, building it well — not for the smallest bundle. For chart-like widgets that default is **Preact core + Observable Plot**.
2. **Don't optimize for size.** Treat **~400 KB gzip** as a comfortable ceiling — below it, don't think about size at all. Going higher is fine when the library is the best fit; if a widget is large or waits on data, show a **loading state** so the wait is graceful. Never trade quality for size, and reserve real caution for the true heavyweights (e.g. Plotly ~1.4 MB, MathJax ~600 KB) when a lighter tool would do as well. The sizes above are reference, not a target.
3. **For chart-like widgets, start with Observable Plot.** uPlot for dense time-series, Chart.js for conventional canvas charts, ECharts (modular) for rich dashboards. Recharts/visx are React-bound — skip unless you're already on React.
4. **Data:** widgets that need real external data follow the per-widget contract in [`DATA.md`](./DATA.md) (modes: `static` / `prebake` / `live`).
5. **Work offline in dev and the render check.** Bundle the code; for data widgets ship a `sample` (see [`DATA.md`](./DATA.md)) so the widget renders without the network. In production a widget may fetch at runtime (live data, map tiles) — prefer bundling for reliability, give remote data a loading state, and keep the dev/render offline path working.
6. Prefer framework-agnostic libraries. We use Preact core; `preact/compat` can bridge React-only packages but adds compatibility risk.
7. Set the `#widget-ready` marker only after first meaningful paint, including async WASM, fonts, or layout work.
8. Respect `prefers-color-scheme` for theming and `prefers-reduced-motion` for animation. Do not make essential information depend on motion.
9. Use `ResizeObserver` inside the iframe to report content size to the parent via `postMessage`; debounce if layout is noisy.
10. Put heavy layout, parsing, or simulation work in a Worker when it can block interaction; Comlink is a small convenience layer.

Imperative library integration in Preact:

```tsx
import { useEffect, useRef } from "preact/hooks";
import * as Plot from "@observablehq/plot";

export function Chart({ data }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const node = Plot.plot({ marks: [Plot.lineY(data)] });
    host.current.replaceChildren(node);
    document.getElementById("widget-ready")?.setAttribute("data-ready", "true");
    return () => node.remove();
  }, [data]);

  return <div ref={host} />;
}
```

For canvas/WebGL libraries, use the same pattern: create the renderer in `useEffect`, attach it to a ref-owned container, observe container size with `ResizeObserver`, and clean up animation frames/listeners on unmount.
