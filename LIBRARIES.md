# JS/TS Library Menu for Offline Iframe Widgets

Audience: agents building small, self-contained widgets bundled by Vite, deployed to Cloudflare Workers, and embedded with `<iframe>`. Runtime baseline is Preact core, not React.

Size method and citations: figures are dated **2026-06-08** and measured locally from the linked npm package artifacts using esbuild `0.28.0`, browser ESM bundle, minify, gzip level 9. The linked official docs/repos and npm pages are the primary citations for package identity, current version, license metadata, and distributed source artifacts. Treat numbers as a living reference: re-measure when upgrading.

## Charts & Statistical Viz

Default: **Observable Plot** for most chart-like widgets. Avoid React-locked chart libraries unless there is a strong reason to pay the `preact/compat` cost.

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| [Observable Plot](https://observablehq.com/plot/) / [npm](https://www.npmjs.com/package/@observablehq/plot) | `@observablehq/plot@0.6.17`: **134.7 KB** | Grammar-of-graphics statistical charts, facets, scales, legends | Framework-agnostic | Strong: SVG/HTML output, no CDN needed | ISC | **Default** for statistical viz and explanatory charts. |
| [uPlot](https://leeoniya.github.io/uPlot/) / [npm](https://www.npmjs.com/package/uplot) | `uplot@1.6.32`: **23.2 KB** | Very fast time-series line charts | Framework-agnostic | Excellent: tiny Canvas/SVG-ish chart runtime | MIT | Dense time-series, streaming, or many points with simple interactions. |
| [Chart.js](https://www.chartjs.org/) / [npm](https://www.npmjs.com/package/chart.js) | `chart.js@4.5.1` modular line setup: **49.3 KB** | Familiar canvas charts | Framework-agnostic | Good: bundle only registered chart pieces | MIT | Common bar/line/pie charts where Plot feels too declarative. |
| [Chartist](https://chartist.dev/) / [npm](https://www.npmjs.com/package/chartist) | `chartist@1.5.0`: **8.9 KB** | Small responsive SVG charts | Framework-agnostic | Excellent: tiny, CSS-stylable SVG | MIT OR WTFPL | Very simple line/bar widgets where minimal weight matters. |
| [ECharts](https://echarts.apache.org/) / [npm](https://www.npmjs.com/package/echarts) | `echarts@6.1.0` modular line+grid+canvas: **168.1 KB**; full import: **383.6 KB** | Rich dashboards, tooltips, advanced chart types | Framework-agnostic | OK but heavy; modularize aggressively | Apache-2.0 | Complex interactive charting that Plot/Chart.js cannot cover. |
| [Plotly](https://plotly.com/javascript/) / [npm](https://www.npmjs.com/package/plotly.js-dist-min) | `plotly.js-dist-min@3.6.0`: **1,463.4 KB** | Scientific plotting suites | Framework-agnostic | Poor for small widgets | MIT | Usually **avoid**; only use for specialized Plotly-only chart types. |
| [Recharts](https://recharts.org/) / [npm](https://www.npmjs.com/package/recharts) | `recharts@3.8.1`: **94.9 KB** excluding React | React-bound | React-only components | Poor with Preact core unless using `preact/compat` | MIT | **Avoid by default**; use only in React-compatible projects. |
| [visx](https://airbnb.io/visx/) / [npm](https://www.npmjs.com/package/@visx/visx) | representative scale+shape: **13.7 KB** excluding React; whole meta-package is larger | Low-level chart primitives | React-bound | Poor with Preact core unless using `preact/compat` | MIT | **Avoid by default**; use modular D3/Plot instead. |

## Plotting & Math

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| [function-plot](https://mauriciopoppe.github.io/function-plot/) / [npm](https://www.npmjs.com/package/function-plot) | `function-plot@1.25.4`: **66.2 KB** | 2D mathematical function plots | Framework-agnostic | Good, but brings D3-style machinery | MIT | Need axes plus user-entered functions quickly. |
| [D3 modules](https://d3js.org/) / [d3-scale](https://www.npmjs.com/package/d3-scale), [d3-shape](https://www.npmjs.com/package/d3-shape), [d3-axis](https://www.npmjs.com/package/d3-axis), [d3-selection](https://www.npmjs.com/package/d3-selection) | `d3-scale@4.0.2` + `shape@3.2.0` + `axis@3.0.0` + `selection@3.0.0`: **30.3 KB** | Custom SVG plots, scales, axes, paths | Framework-agnostic | Excellent when imported module-by-module | ISC | Need bespoke visualization without a full charting library. |
| [KaTeX](https://katex.org/) / [npm](https://www.npmjs.com/package/katex) | `katex@0.17.0`: **76.6 KB** plus CSS/fonts as needed | Fast TeX equation rendering | Framework-agnostic | Good; bundle CSS/fonts locally | MIT | Static or simple dynamic equations. Prefer over MathJax for weight. |
| [MathJax](https://www.mathjax.org/) / [npm](https://www.npmjs.com/package/mathjax) | `mathjax@4.1.2` `tex-svg`: **616.2 KB** | Broad TeX/MathML rendering | Framework-agnostic | Heavy but offline-capable if assets are bundled | Apache-2.0 | Need MathJax coverage/accessibility beyond KaTeX. |
| [mathjs](https://mathjs.org/) / [npm](https://www.npmjs.com/package/mathjs) | `mathjs@15.2.0`: **191.7 KB** | Units, matrices, symbolic-ish math, parser | Framework-agnostic | Good but large | Apache-2.0 | Need its broad numeric API; otherwise use smaller helpers. |
| [expr-eval](https://www.npmjs.com/package/expr-eval) | `expr-eval@2.0.2`: **7.8 KB** | Safe-ish expression parsing/evaluation | Framework-agnostic | Excellent | MIT | User-entered formulas without the weight of mathjs. |
| Native `Math`, typed arrays, small helpers | **0 KB** | Numeric transforms, interpolation, statistics | Framework-agnostic | Best | n/a | Default for simple calculations; write a few tested functions. |

## Geometry, Graphs, Networks, Diagrams

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| [d3-force](https://d3js.org/d3-force) | `d3-force@3.0.0`: **6.0 KB** | Force simulations and graph positioning | Framework-agnostic | Excellent | ISC | Need lightweight node-link layout with custom SVG/canvas rendering. |
| [d3-hierarchy](https://d3js.org/d3-hierarchy) | `d3-hierarchy@3.1.2`: **5.9 KB** | Trees, treemaps, packs, clusters | Framework-agnostic | Excellent | ISC | Hierarchical diagrams where you render the marks yourself. |
| [Cytoscape.js](https://js.cytoscape.org/) / [npm](https://www.npmjs.com/package/cytoscape) | `cytoscape@3.34.0`: **142.0 KB** | Interactive graph/network visualization | Framework-agnostic | Good, self-contained, but heavier | MIT | Need graph interactions, selection, styling, layouts, and graph API. |
| [Sigma.js](https://www.sigmajs.org/) / [npm](https://www.npmjs.com/package/sigma) | `sigma@3.0.3`: **26.6 KB** | WebGL graph rendering | Framework-agnostic | Good; pair with graphology data model | MIT | Larger networks where canvas/SVG struggles. |
| [vis-network](https://visjs.github.io/vis-network/) / [npm](https://www.npmjs.com/package/vis-network) | `vis-network@10.1.0`: **154.0 KB** | Classic interactive network diagrams | Framework-agnostic | OK but chunky | Apache-2.0 OR MIT | Need batteries-included network UI; prefer D3/Sigma first. |
| [ELK.js](https://github.com/kieler/elkjs) / [npm](https://www.npmjs.com/package/elkjs) | `elkjs@0.11.1` bundled: **440.1 KB** | Sophisticated layered graph layout | Framework-agnostic | Heavy; layout can run in worker | EPL-2.0 | Complex node-link layout quality matters more than payload. |
| [dagre](https://github.com/dagrejs/dagre) / [npm](https://www.npmjs.com/package/dagre) | `dagre@0.8.5`: **31.3 KB** | Directed graph layout | Framework-agnostic | Good | MIT | Need simple DAG/flowchart layout without ELK weight. |
| [two.js](https://two.js.org/) / [npm](https://www.npmjs.com/package/two.js) | `two.js@0.8.23`: **50.1 KB** | 2D vector scene graph | Framework-agnostic | Good | MIT | Need animated geometric diagrams across SVG/canvas/WebGL modes. |
| SVG-first with D3/native DOM | **0-30 KB** depending on D3 modules | Diagrams, annotations, small graph renderers | Framework-agnostic | Excellent | n/a / ISC | Default for small diagrams: author SVG, add only needed layout modules. |

## Simulation, Physics, Generative

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| [p5.js](https://p5js.org/) / [npm](https://www.npmjs.com/package/p5) | `p5@2.3.0`: **392.3 KB** | Creative coding, sketches, generative art | Framework-agnostic | Offline-capable but large | LGPL-2.1 | Educational/sketch-style widgets where p5 idioms save time. |
| [Matter.js](https://brm.io/matter-js/) / [npm](https://www.npmjs.com/package/matter-js) | `matter-js@0.20.0`: **27.7 KB** | 2D rigid-body physics | Framework-agnostic | Excellent | MIT | Browser physics toys, collisions, constraints. |
| [Rapier 2D compat](https://rapier.rs/) / [npm](https://www.npmjs.com/package/@dimforge/rapier2d-compat) | `@dimforge/rapier2d-compat@0.19.3`: **627.7 KB** including JS/WASM-facing bundle | High-performance physics | Framework-agnostic | Offline OK if `.wasm` asset is bundled and served correctly | Apache-2.0 | Need robust physics performance; budget for WASM loading. |
| [planck.js](https://github.com/piqnt/planck.js) / [npm](https://www.npmjs.com/package/planck-js) | `planck-js@1.3.0`: **48.4 KB** | Box2D-style 2D physics | Framework-agnostic | Good | MIT | Need deterministic 2D physics without WASM. |
| [regl](https://regl.party/) / [npm](https://www.npmjs.com/package/regl) | `regl@2.1.1`: **41.4 KB** | Functional WebGL draw commands | Framework-agnostic | Good | MIT | Generative shaders/particles where Three.js is too much. |
| Plain Canvas2D / typed arrays | **0 KB** | Particles, cellular automata, simple simulations | Framework-agnostic | Best | n/a | Default for simple simulations; keep loop/state explicit. |

WASM note: Vite can bundle WASM, but the iframe must serve it with correct paths and MIME behavior. Initialize asynchronously and set `#widget-ready` only after the first meaningful render.

## 2D/3D Rendering & Canvas/WebGL

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| Plain Canvas2D | **0 KB** | Sprites, simple drawing, heatmaps, particles | Framework-agnostic | Best | n/a | Default when shapes/animation are straightforward. |
| [PixiJS](https://pixijs.com/) / [npm](https://www.npmjs.com/package/pixi.js) | `pixi.js@8.19.0`: **140.1 KB** | High-performance 2D WebGL renderer | Framework-agnostic | Good but nontrivial payload | MIT | Need many sprites, filters, scene graph, or game-like 2D. |
| [three.js](https://threejs.org/) / [npm](https://www.npmjs.com/package/three) | `three@0.184.0`: **188.1 KB** | 3D scenes, cameras, materials | Framework-agnostic | Good but asset-heavy if models/textures are used | MIT | Real 3D is central to the widget. |
| [OGL](https://github.com/oframe/ogl) / [npm](https://www.npmjs.com/package/ogl) | `ogl@1.0.11`: **9.3 KB** | Lightweight WebGL primitives | Framework-agnostic | Excellent for small shader scenes | Unlicense | Need 3D/WebGL without Three.js weight. |
| [regl](https://regl.party/) / [npm](https://www.npmjs.com/package/regl) | `regl@2.1.1`: **41.4 KB** | Lower-level WebGL render loops | Framework-agnostic | Good | MIT | Need custom shader/render pipeline control. |
| [two.js](https://two.js.org/) | `two.js@0.8.23`: **50.1 KB** | 2D vector scene graph | Framework-agnostic | Good | MIT | Need retained-mode shapes, morphing, and renderer flexibility. |

## Animation, Transitions, Presentation

Always gate nonessential motion behind `prefers-reduced-motion`.

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| [Web Animations API](https://developer.mozilla.org/docs/Web/API/Web_Animations_API) | **0 KB** | DOM/SVG keyframes and transitions | Native browser API | Best | n/a | Default for simple UI/SVG motion. |
| [motion](https://motion.dev/) / [npm](https://www.npmjs.com/package/motion) | `motion@12.40.0`: **22.8 KB** for `animate` | Spring/keyframe animation | Framework-agnostic API available; React APIs also exist | Good | MIT | Need polished imperative animation without React binding. |
| [anime.js](https://animejs.com/) / [npm](https://www.npmjs.com/package/animejs) | `animejs@4.4.1`: **12.1 KB** | Timeline-based DOM/SVG/object animation | Framework-agnostic | Excellent | MIT | Need a compact animation timeline. |
| [GSAP](https://gsap.com/) / [npm](https://www.npmjs.com/package/gsap) | `gsap@3.15.0`: **27.7 KB** core | Professional timelines and sequencing | Framework-agnostic | Good, but check license | GSAP Standard License, no SPDX/OSI identifier | Complex timeline work; verify license fit for the deployment. |
| [d3-transition](https://d3js.org/d3-transition) | `d3-transition@3.0.1`: **12.6 KB** | D3 selection transitions | Framework-agnostic | Good if already using D3 | ISC | Animate D3-rendered SVG marks. |
| [popmotion](https://popmotion.io/) / [npm](https://www.npmjs.com/package/popmotion) | `popmotion@11.0.5`: **5.6 KB** | Lightweight value animation | Framework-agnostic | Excellent | MIT | Tiny imperative value tweens/springs. |

## Interactivity & Input

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| Pointer events + native listeners | **0 KB** | Click, drag, hover, keyboard, touch basics | Native browser API | Best | n/a | Default for simple interaction. |
| [d3-zoom](https://d3js.org/d3-zoom) | `d3-zoom@3.0.0`: **16.3 KB** | Pan/zoom gestures for SVG/canvas | Framework-agnostic | Excellent | ISC | Need robust zoom transforms, wheel, drag, pinch. |
| [@use-gesture/vanilla](https://use-gesture.netlify.app/) / [npm](https://www.npmjs.com/package/@use-gesture/vanilla) | `@use-gesture/vanilla@10.3.1`: **7.0 KB** | Drag/pinch/scroll gesture recognition | Framework-agnostic | Excellent | MIT | Need gesture state without React. |
| [@use-gesture/react](https://www.npmjs.com/package/@use-gesture/react) | `@use-gesture/react@10.3.1`: **6.9 KB** excluding React | React gesture hooks | React-bound | Avoid with Preact core unless using compat | MIT | Only when already paying React/compat cost. No separate Preact package is published. |
| [interact.js](https://interactjs.io/) / [npm](https://www.npmjs.com/package/interactjs) | `interactjs@1.10.27`: **29.7 KB** | Drag, resize, drop, inertia | Framework-agnostic | Good | MIT | Need resize/drop constraints beyond simple pointer events. |
| [Hammer.js](https://hammerjs.github.io/) / [npm](https://www.npmjs.com/package/hammerjs) | `hammerjs@2.0.8`: **7.6 KB** | Legacy touch gestures | Framework-agnostic | OK but older | MIT | Maintaining older gesture code; prefer Pointer Events/use-gesture for new work. |
| [ResizeObserver](https://developer.mozilla.org/docs/Web/API/ResizeObserver) + [`postMessage`](https://developer.mozilla.org/docs/Web/API/Window/postMessage) | **0 KB** | Iframe sizing and parent/child state messages | Native browser APIs | Best | n/a | Default for iframe height, readiness, and state sync. |

## Maps & Geo (Occasional)

Maps are usually out of scope for tiny offline widgets because basemaps require tiles. If used, bundle code offline and define a tile strategy explicitly.

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) / [npm](https://www.npmjs.com/package/maplibre-gl) | `maplibre-gl@5.24.0`: **282.5 KB** plus CSS/workers/assets | Vector tile WebGL maps | Framework-agnostic | Heavy; needs tiles/styles/fonts/sprites | BSD-3-Clause | Only when interactive vector maps are central. |
| [Leaflet](https://leafletjs.com/) / [npm](https://www.npmjs.com/package/leaflet) | `leaflet@1.9.4`: **43.5 KB** plus CSS/images | Slippy raster maps | Framework-agnostic | Code is light; tiles are the problem | BSD-2-Clause | Occasional simple maps with a clear offline or approved tile source. |
| SVG/Canvas geo sketches | **0 KB** plus optional projection helpers | Choropleths, schematic maps, static outlines | Framework-agnostic | Best for self-contained widgets | n/a | Prefer for small static maps or custom geographic diagrams. |

## Utility & Data

Only add these when the widget actually needs them; utilities can quietly dominate a small bundle.

| Library | Current min+gzip size, date/source | Use it for | Binding | Offline / iframe fit | License | Pick when |
|---|---:|---|---|---|---|---|
| [dayjs](https://day.js.org/) / [npm](https://www.npmjs.com/package/dayjs) | `dayjs@1.11.21`: **3.4 KB** | Date formatting/parsing with small API | Framework-agnostic | Excellent | MIT | Need lightweight dates; add plugins sparingly. |
| [date-fns](https://date-fns.org/) / [npm](https://www.npmjs.com/package/date-fns) | `date-fns@4.4.0` `format+parseISO`: **6.7 KB** | Tree-shaken date functions | Framework-agnostic | Excellent when imported selectively | MIT | Prefer named pure functions over a date object API. |
| [Comlink](https://github.com/GoogleChromeLabs/comlink) / [npm](https://www.npmjs.com/package/comlink) | `comlink@4.4.2`: **2.1 KB** | Worker RPC | Framework-agnostic | Excellent | Apache-2.0 | Move heavy layout/math simulation off the main thread. |
| [Zod](https://zod.dev/) / [npm](https://www.npmjs.com/package/zod) | `zod@4.4.3`: **64.6 KB** | Runtime validation and typed schemas | Framework-agnostic | OK but sizeable | MIT | Validate untrusted/configurable inputs; otherwise keep validation manual. |
| [d3-dsv](https://d3js.org/d3-dsv) | `d3-dsv@3.0.1`: **1.1 KB** | CSV/TSV parse/format | Framework-agnostic | Excellent | ISC | Small CSV datasets and D3-adjacent workflows. |
| [Papa Parse](https://www.papaparse.com/) / [npm](https://www.npmjs.com/package/papaparse) | `papaparse@5.5.3`: **7.5 KB** | Robust CSV parsing, streaming, edge cases | Framework-agnostic | Excellent | MIT | User-supplied CSV or messy CSV input. |
| Native JSON, URLSearchParams, Intl | **0 KB** | Common parsing/formatting | Native browser APIs | Best | n/a | Default before reaching for utility packages. |

## How To Choose

1. **Default to prettiness within a ~100–150 KB gzip budget.** A polished, well-typeset widget is the goal; do not race to the smallest possible bundle. The default stack for chart-like widgets is **Preact core + Observable Plot** (~135 KB gzip for Plot alone, comfortably inside the budget).
2. **The lightweight tier is a deliberate choice, not the default.** Preact core + modular D3/SVG (≈19 KB gzip) is the right pick when bytes matter — many widgets on one page, or an intentionally minimal embed — but use it on purpose, not by reflex.
3. **For chart-like widgets, start with Observable Plot.** Reach for uPlot for dense time-series, Chartist for tiny simple charts, Chart.js for conventional canvas charts, and ECharts only for rich dashboards. Avoid Plotly for small widgets; avoid Recharts/visx unless React compatibility is already required.
4. **Data:** widgets that need real external data follow the per-widget contract in [`DATA.md`](./DATA.md) (modes: `static` / `prebake` / `live`).
5. Keep everything bundled and offline. No runtime CDN, no remote fonts, no unplanned map tiles, no external worker scripts.
6. Prefer framework-agnostic libraries. We use Preact core; `preact/compat` can bridge React-only packages but adds weight and compatibility risk.
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
