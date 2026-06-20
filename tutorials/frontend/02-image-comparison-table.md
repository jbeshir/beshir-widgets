# Building the Image Comparison Table

The finished widget lives at [**image-comparison-table.widgets.beshir.org**](https://image-comparison-table.widgets.beshir.org) — pick one of three AI-art comparison tables, browse a grid of thumbnails, and click any cell to open a full-size lightbox with keyboard navigation. For the visual design — card layout, thumbnail sizing, the fit-scale logic — see the [design tutorial](../design/02-image-comparison-table.md). This tutorial covers the component and data architecture, and assumes you have completed [tutorial 01](./01-function-plotter.md).

## What you'll build

The [Image Comparison Table](https://image-comparison-table.widgets.beshir.org) is, as `widget.json` puts it:

> Side-by-side comparison grids of labelled images, with click-to-zoom lightbox and per-row prompt info. Shows a table picker by default; selects a table via the `/<id>` path or `?table=<id>`, and scales to fit the viewport.
> <!-- widgets/image-comparison-table/widget.json:5 -->

In practice: you pick one of three AI-art comparison tables, browse a grid of thumbnails arranged by row (subject) and column (model or era), and click any cell to open a full-size lightbox with keyboard navigation. The widget scales itself to fill whatever viewport it is embedded in.

For the visual design — card layout, thumbnail sizing, the fit-scale logic — see the companion [design tutorial](../design/02-image-comparison-table.md). This tutorial covers only the component and data architecture.

### Three UI states

The widget has exactly three states, each rendered by a different branch in `App.tsx`:

| State | When | Component |
|---|---|---|
| **Picker** | No table is selected (root path, unknown id) | `<Picker>` |
| **Comparison grid** | A valid table id is resolved from the URL | `<Grid>` |
| **Lightbox** | A grid cell is clicked (`selection` is non-null) | `<Lightbox>` |

The Picker and Grid states are mutually exclusive; the Lightbox overlays the Grid. Two pieces of state drive everything:

```tsx
const [table] = useState<Table | null>(() => resolveTable(getInitialTableId()));
const [selection, setSelection] = useState<Selection | null>(null);
// widgets/image-comparison-table/src/App.tsx:24-25
```

`table` is set once at mount from the URL and never changes; `selection` is a `{ rowIdx, colIdx }` pair that opens and closes the Lightbox.

### File map

| File | Role |
|---|---|
| `App.tsx` | Root: reads URL, owns `table` and `selection` state, composes the three states |
| `Picker.tsx` | Landing view listing all available tables with preview thumbnails |
| `Grid.tsx` | The comparison table — rows × columns of clickable thumbnails |
| `Lightbox.tsx` | Full-size modal with keyboard navigation and focus management |
| `InfoPopover.tsx` | Per-row popover showing the generation prompt |
| `tables.ts` | Data module: type definitions, three `Table` objects, `resolveTable` |

The three tables in `tables.ts` are "Motivational Posters: Classic vs Modern AI", "Imitating the Classics: Modern AI Faking the Early-AI Look", and "Imitating the Classics II: Uncanny-Valley Edition".

### How this differs from tutorial 01

Tutorial [01](./01-function-plotter.md) introduced the Preact/Vite skeleton, `useState`, and a single-file component. This widget reuses that same skeleton but adds:

- **A multi-file component tree** — five components with explicit prop interfaces instead of one self-contained file.
- **No external charting library** — `preact` is the only runtime dependency; everything is hand-built JSX.
- **A heavier accessibility story** — the Lightbox uses a native `<dialog>` with `showModal()` for a browser-managed focus trap, keyboard navigation, and modal accessibility semantics; the Grid uses semantic `role` attributes throughout. Tutorial 01 had no modal interaction to manage.

With the big picture in mind, the first architectural decision is how to divide those three UI states among components and what wires them together.

## Multi-component composition and lifting state up

In [01](./01-function-plotter.md) a single `App` component owned everything: state, derived values, and the JSX. That works when one component is the whole UI. Here the widget has four distinct jobs — display a grid of thumbnails, show a full-size lightbox, offer a table picker on landing, and annotate each row with its generation prompt — and they need to share data. The answer is to split each job into its own component and let `App` wire them together.

### The component tree

`App` imports and renders `Grid`, `Picker`, `Lightbox`, and (via `Grid`) `InfoPopover`. The JSX that assembles them lives at `App.tsx:128–168`:

```tsx
// App.tsx:128-168
{table ? (
  <>
    <article class="card" aria-labelledby="ict-title">
      ...
      <Grid table={table} compact={compact} onCellClick={handleCellClick} />
    </article>
    ...
  </>
) : (
  <Picker tables={TABLE_LIST} />
)}
...
{table && selection && (
  <Lightbox
    table={table}
    selection={selection}
    onClose={closeLightbox}
    onNavigate={navigateLightbox}
  />
)}
```

`App` decides which branch to render; it does not duplicate logic that belongs inside `Grid` or `Lightbox`. Each child component receives exactly what it needs and nothing more.

### Props as typed contracts

Every child component defines a `type Props` that names what it accepts. This is a compile-time contract between parent and child: if `App` passes a prop with the wrong shape, TypeScript catches it before the browser sees it.

```ts
// Grid.tsx:4-8
type Props = {
  table: Table;
  compact: boolean;
  onCellClick: (rowIdx: number, colIdx: number) => void;
};
```

```ts
// Lightbox.tsx:5-9
type Props = {
  table: Table;
  selection: Selection;
  onClose: () => void;
  onNavigate: (dRow: number, dCol: number) => void;
};
```

```ts
// Picker.tsx:3-5
type Props = {
  tables: Table[];
};
```

Using `type` rather than `interface` is a convention for plain object shapes — both work and both are fine in Preact projects; `type` is slightly more common for prop bags because it reads as "this object looks like this."

### Data down, events up

The rule is simple: data flows down through props, state changes flow up through callbacks.

`App` passes `table` and `compact` down to `Grid` as read-only data. When the user clicks a thumbnail, `Grid` does not reach for `setSelection` — it cannot, because `setSelection` is private to `App`. Instead, `Grid` calls the callback it was handed:

```tsx
// Grid.tsx:58
onClick={() => onCellClick(rowIdx, colIdx)}
```

That invocation travels back up to `App`'s `handleCellClick`, which calls `setSelection` and triggers a re-render. `Grid` only ever fires an event; `App` decides what to do with it.

This asymmetry is deliberate. A component that could mutate its own coordinates in shared state would be impossible to reason about from the outside. By accepting a callback, `Grid` remains a pure display component whose only job is to render a table and report clicks.

### Why `selection` lives in `App`

`selection` — the currently expanded cell — is defined at `App.tsx:7` and held at `App.tsx:25`:

```ts
// App.tsx:7
export type Selection = { rowIdx: number; colIdx: number };
```

```ts
// App.tsx:25
const [selection, setSelection] = useState<Selection | null>(null);
```

Both `Grid` and `Lightbox` depend on it: `Grid` receives it implicitly through `onCellClick`'s side-effect, and `Lightbox` receives it explicitly as a prop to know which image to display. If `selection` lived inside `Grid`, `Lightbox` would have no way to read it. If it lived inside `Lightbox`, `Grid` could not trigger a change to it. State must live in the **lowest common ancestor** — the nearest component that is a parent of every component that needs it. That ancestor is `App`.

The consequence of getting this wrong is components that diverge: `Grid` would think row 2 col 3 is selected, `Lightbox` would show row 0 col 0 because it holds its own stale copy. Lifting the state to `App` means both children always see the same value from the same source.

### When *not* to lift: `InfoPopover`'s `open` state

`InfoPopover` also holds state — whether its popover is open:

```ts
// InfoPopover.tsx:10
const [open, setOpen] = useState(false);
```

This state is *not* lifted to `App`, and for good reason: no sibling component (`Grid`, `Lightbox`, `Picker`) needs to know or react to which row's popover is open. Lifting it to `App` would add indirection for zero benefit.

`InfoPopover` is rendered inside `Grid`'s row loop:

```tsx
// Grid.tsx:38-42
<InfoPopover
  prompt={row.prompt}
  rowLabel={row.label}
  note={table.promptNote}
/>
```

`Grid` passes data in; `InfoPopover` manages its own open/closed toggle privately. The judgment is: if only one component cares about a piece of state, colocate it there. Lift only when siblings must agree.

The extra complexity of this four-component design — compared to [01](./01-function-plotter.md)'s single-component approach — pays for exactly one thing: `Grid` and `Lightbox` can both read `selection` without either owning it. That is the entire motivation for the pattern.

For the visual structure these components produce, see [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md).

Before any component renders, `App` must decide which view to show — and that decision comes from the URL.

## URL-driven view selection and the lazy `useState` initialiser

The widget shows either a comparison table or a table picker — two views, zero router. The correct view is determined once, at mount, by reading the URL. This section explains how that works and why the initialiser is written as a function rather than a plain value.

### Two deep-link formats

The widget accepts two equivalent ways to target a specific table:

- **Query string:** `https://example.com/?table=imitating-classic-ai-art`
- **Path segment:** `https://example.com/imitating-classic-ai-art`

The query-string form is canonical (all picker links use it); the path-segment form exists so external deep links from other embedding contexts work without query-string support. Both are parsed by `getInitialTableId` (`App.tsx:12-21`):

```ts
// App.tsx:12-21
function getInitialTableId(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('table');
    if (q) return q;
    const seg = window.location.pathname.split('/').filter(Boolean)[0];
    return seg ? decodeURIComponent(seg) : null;
  } catch {
    return null;
  }
}
```

Query string takes priority. If `?table=` is absent, the first non-empty path segment is taken and run through `decodeURIComponent` — that handles ids percent-encoded by the browser (spaces, `%2F`, etc.).

The `try/catch` (`App.tsx:13-20`) isn't defensive over-engineering: `window.location` access can throw in offline `file://` render checks and some server-side render environments. Returning `null` is the graceful fallback — the picker shows instead of a broken state.

### Resolving the id to a table

The raw string from the URL is not used directly. `resolveTable` (`tables.ts:231-234`) validates it against the known table registry:

```ts
// tables.ts:231-234
export function resolveTable(id: string | null | undefined): Table | null {
  if (id && Object.prototype.hasOwnProperty.call(TABLES, id)) return TABLES[id];
  return null;
}
```

`Object.prototype.hasOwnProperty.call(TABLES, id)` is the safe presence check. Using `TABLES[id]` directly could return a truthy value for prototype-inherited keys like `"constructor"` — unlikely, but a defensive habit worth internalising when checking user-controlled keys against a plain object registry.

### The lazy `useState` initialiser

With the id resolved, the view is fixed at mount:

```ts
// App.tsx:24
const [table] = useState<Table | null>(() => resolveTable(getInitialTableId()));
```

Two things to unpack.

**Function form vs value form.** Compare:

```ts
// ❌ value form — getInitialTableId() runs on EVERY render
useState(resolveTable(getInitialTableId()))

// ✓ initialiser form — the function runs ONLY on first render
useState(() => resolveTable(getInitialTableId()))
```

When you pass a plain value, JavaScript evaluates the argument expression before `useState` even executes — which happens on every render call. Preact/React discards the result after the first render, but the work still runs. Passing a *function* tells `useState` to call it once, on initial mount, and never again. This matters most for expensive computations or side-effectful reads; `getInitialTableId()` is cheap but the pattern is correct regardless, and the cost of the wrong form scales with the computation.

(For a refresher on how `useState` works and what "every render" means, see [01](./01-function-plotter.md).)

**No setter destructured.** The destructuring is `const [table]`, not `const [table, setTable]`. That's intentional — once the URL is read at mount, the view is immutable for the lifetime of the component. Navigation to a different table is a full page load (following an `<a>` link), not a `setState` call. There is nothing to update.

### Conditional render as a route switch

The resolved value drives a ternary (`App.tsx:128-157`):

```tsx
{table ? (
  <article class="card">…<Grid …/></article>
) : (
  <Picker tables={TABLE_LIST} />
)}
```

`table` is `null` when no id matched (or none was in the URL); `<Picker>` renders. When it's a `Table` object, the grid renders. No router state, no history object, no location context — just a boolean branch on a value read once at mount.

### Linking back: `encodeURIComponent` and `./`

The picker constructs its links at `Picker.tsx:24`:

```tsx
<a class="pick-card" href={`./?table=${encodeURIComponent(t.id)}`}>
```

`encodeURIComponent` percent-encodes characters that are invalid or ambiguous in a query-string value (`&`, `=`, `#`, spaces, non-ASCII). Most table ids are alphanumeric and would survive without it, but the unconditional call is the safe default for any id that could contain those characters.

The `./` prefix is load-bearing. From the comment at `Picker.tsx:8-9`:

```
// Picker.tsx:8-9
// `./?table=<id>` — `./` resolves to the app root, so it works from `/` and from
// a `/<id>` deep link alike.
```

`./` resolves relative to the *directory* of the current URL. The browser treats `/imitating-classic-ai-art` as a file in the root directory, so `./` from that path also resolves to `/`. Both the root and a path-segment deep link produce `/?table=<id>` — the correct canonical form.

### The no-router tradeoff

Reading the URL once at mount is a deliberate constraint. The cost is that browser back/forward buttons trigger a full page reload — the URL changes but there is no `popstate` listener, so no re-render occurs. For a static embedded iframe where all navigation is plain `<a>` reloads, this is acceptable.

A real SPA would add `window.addEventListener('popstate', ...)` and re-parse the URL on navigation. The full router infrastructure — history management, link components, typed params — adds size and complexity that buys nothing for a two-view widget. Frame it as a fitting tradeoff for the use case, not a gap to be filled.

For CSS layout details, see [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md).

The routing logic calls `resolveTable`, which validates the URL id against a structured data module; that module deserves its own section.

## The typed data registry: `tables.ts`

As in [tutorial 01](./01-function-plotter.md), the widget's domain logic lives in a framework-free TypeScript module — no Preact imports, no side effects, testable in plain Node. This time the job isn't evaluating expressions; it's modelling a collection of image-comparison tables in a way that the rest of the app can consume without touching raw data directly.

### The four exported types

`tables.ts:8-37` defines the type hierarchy bottom-up:

```ts
// tables.ts:8-12
export type Cell = {
  thumb: string;
  full: string;
  alt: string;
};
```

A `Cell` holds three strings: thumbnail path, full-resolution path, and an alt-text description. Every image in a table is exactly one `Cell`.

```ts
// tables.ts:14-19
export type Column = {
  id: string;
  label: string;
  /** When true, this column's images are pre-existing reference art, not generated from the row prompt. */
  reference?: boolean;
};
```

The optional `reference?` flag marks columns whose images are pre-existing art rather than model-generated — the UI uses this to suppress the prompt popover for those cells.

```ts
// tables.ts:21-27
export type Row = {
  id: string;
  label: string;
  prompt: string | null;
  cells: Record<string, Cell>;
};
```

`prompt: string | null` makes the absence of a prompt explicit rather than `undefined`-ambiguous — null means "this row intentionally has no prompt". `cells` is a `Record<string, Cell>` keyed by column id, so looking up a cell by column is O(1) and doesn't depend on array position.

```ts
// tables.ts:29-37
export type Table = {
  id: string;
  title: string;
  subtitle?: string;
  promptNote?: string;
  columns: Column[];
  rows: Row[];
};
```

`Table` composes the two above. `subtitle` and `promptNote` are optional — their absence is a valid state, not an error, so `?` is the right tool rather than `| null`.

### The `cell()` factory

Constructing a `Cell` by hand for every image would mean repeating the path convention (`img/thumb/`, `img/full/`, `.jpg`) and the alt-text format across dozens of rows. Instead, `tables.ts:41-47` defines a private factory:

```ts
// tables.ts:41-47
function cell(base: string, rowLabel: string, colLabel: string): Cell {
  return {
    thumb: `img/thumb/${base}.jpg`,
    full: `img/full/${base}.jpg`,
    alt: `${rowLabel} — ${colLabel}`,
  };
}
```

`cell` is not exported — that's intentional. The module owns the convention for how paths are assembled; callers never construct `Cell` objects by hand. If the path scheme ever changes (say, `.webp` instead of `.jpg`), one edit to `cell` fixes every image in the registry. Row definitions stay readable:

```ts
cells: {
  classic: cell('family-classic', 'Family', 'Classic'),
  gpt:     cell('family-gpt',     'Family', 'GPT-Image-2'),
  gemini:  cell('family-gemini',  'Family', 'Imagen-4-Ultra'),
},
```

### Preamble closures

Several tables share long style-directive preambles that get a short concept appended. Repeating the preamble inline in every row prompt would make `Row` literals unreadable and cause drift when the preamble needs editing.

`tables.ts:101-108` introduces the first pattern:

```ts
// tables.ts:101-108
const BAD_STYLE_PREAMBLE = `A cheesy, over-rendered AI-generated motivational poster ...
Subject / concept: `;

const badPrompt = (concept: string): string => BAD_STYLE_PREAMBLE + concept;
```

`badPrompt` is a closure: it captures the preamble constant in its scope and exposes a one-argument function that appends a concept. A row that previously would embed 200+ characters of repeated text now reads:

```ts
prompt: badPrompt('a family on a beach at sunset near a pier'),
```

`tables.ts:163-171` applies the same pattern for a richer preamble that adds uncanny-valley figure instructions:

```ts
// tables.ts:163-171
const UNCANNY_STYLE_PREAMBLE = `A cheesy, over-rendered AI-generated motivational poster ...
Subject / concept: `;

const uncannyPrompt = (concept: string): string => UNCANNY_STYLE_PREAMBLE + concept;
```

Both preamble constants and their closures are module-private — the rest of the app sees only the fully-assembled prompt strings embedded in each `Row`.

### The registry and the list

`tables.ts:221-225` collects all tables into a single exported record:

```ts
// tables.ts:221-225
export const TABLES: Record<string, Table> = {
  [AI_CLASSIC_MOTIVATIONAL_PICTURES.id]: AI_CLASSIC_MOTIVATIONAL_PICTURES,
  [IMITATING_CLASSIC_AI_ART.id]: IMITATING_CLASSIC_AI_ART,
  [IMITATING_CLASSIC_AI_ART_2.id]: IMITATING_CLASSIC_AI_ART_2,
};
```

The computed property syntax `[X.id]: X` means each table's `id` field is the key — there's no second place to keep the id in sync. If you rename a table's `id`, the registry key updates automatically.

For UI components that need to iterate over all tables (the picker renders them as a list), a `Record` is inconvenient. `tables.ts:227` derives the list once:

```ts
// tables.ts:227
export const TABLE_LIST: Table[] = Object.values(TABLES);
```

`Object.values` preserves insertion order in V8 for string keys that aren't array indices, so `TABLE_LIST` follows the declaration order in `TABLES`.

### Selector functions

Rather than exporting `TABLES` and letting callers index it directly, `tables.ts` exposes two selector functions that encapsulate the access patterns the app actually needs.

You already met `resolveTable` in the routing section; it lives here because `tables.ts` owns the registry and the safe-lookup logic belongs with the data. `App.tsx:2` shows what the app actually imports:

```ts
// App.tsx:2
import { resolveTable, TABLE_LIST, type Table } from './tables';
```

App imports the two selectors and the `Table` type — it never imports `TABLES` directly. This boundary matters: App is free to call `resolveTable` or iterate `TABLE_LIST` without knowing how those are implemented, and `tables.ts` can reorganise its internals (add a new table, change a preamble) without any change to App.

`tables.ts:238-245` derives preview thumbnails for the picker:

```ts
// tables.ts:238-245
export function previewThumbs(table: Table): string[] {
  const row = table.rows[0];
  if (!row) return [];
  return table.columns
    .slice(0, 3)
    .map((c) => row.cells[c.id]?.thumb)
    .filter((s): s is string => typeof s === 'string');
}
```

The `.map()` uses optional chaining (`?.thumb`) because a column id might have no matching cell — the row could be incomplete. That produces `string | undefined` elements. The filter `(s): s is string` is a TypeScript type-predicate: without it, the return type would remain `(string | undefined)[]` even after filtering. The predicate narrows the type, so callers receive `string[]` and don't need a downstream undefined-check.

For visual presentation of cells and columns, see [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md).

With data loaded, the widget needs to scale itself to fit whatever viewport it lands in — and that requires reading DOM measurements before the browser paints.

## `useLayoutEffect`: reading the DOM before paint

[Tutorial 01](./01-function-plotter.md) covered how `useEffect` fires after the browser paints and how its dep array controls when it re-runs. This section introduces one additional hook — `useLayoutEffect` — and the single question that determines which one to reach for.

### The render → commit → effects model

Every Preact/React update follows three phases:

1. **Render** — the component function runs and produces a virtual-DOM diff.
2. **Commit** — the framework writes those mutations to the real DOM.
3. **Effects** — two queues drain:
   - `useLayoutEffect` fires **synchronously** after the DOM is mutated, **before** the browser has painted the new frame. The browser is blocked from painting until every layout effect returns.
   - `useEffect` fires **asynchronously after** the browser paints.

This ordering is what makes hook choice meaningful.

### The decision rule

Ask one question: **could the user ever see the intermediate state for one frame?**

Yes → `useLayoutEffect`. No → `useEffect`, which is preferable because it doesn't block the paint pipeline.

This widget scales its content to fit the viewport. The scaling effect opens with:

```tsx
// App.tsx:37
useLayoutEffect(() => {
```

Why `useLayoutEffect`? The effect reads `offsetWidth` / `offsetHeight` from the content element, computes a scale factor, then writes a CSS `transform: scale(…)` and a compensating `marginBottom`. If this ran in a `useEffect`, the browser would paint the full-size unscaled content first, then repaint after the effect — a visible flash of wrongly-sized content. `useLayoutEffect` prevents it: the transform is applied before the first pixel reaches the screen.

(The full body of this effect — measurement, scale computation, and ResizeObserver setup — is the subject of the next section. Here the point is only the hook choice.)

The dep array is empty:

```tsx
// App.tsx:87
  }, []);
```

Runs once on mount, cleans up on unmount — the same pattern from [01](./01-function-plotter.md).

### Two counter-examples: when `useEffect` is correct

The widget registers two more effects, both using `useEffect`:

```tsx
// App.tsx:90-92
  useEffect(() => {
    if (!ready) setReady(true);
  }, [ready]);
```

This sets a `ready` flag that mounts a hidden `#widget-ready` sentinel (line 170) for external automation to detect readiness. Nothing here is paint-sensitive — the sentinel's presence a frame later causes no visible artifact, so blocking paint would be wasted budget.

```tsx
// App.tsx:95-97
  useEffect(() => {
    document.title = table ? `${table.title} — Image Comparison` : 'Image Comparison Tables';
  }, [table]);
```

`document.title` writes to the browser tab, not to the visible layout. There is nothing to flash. A synchronous write before paint would cost frame budget for zero visual benefit. (The mechanics of this title sync are explored further in the smaller touches section.)

The three hooks side-by-side:

| Hook | Location | Why |
|---|---|---|
| `useLayoutEffect` | `App.tsx:37` | DOM measure → CSS transform — user sees the flash if deferred |
| `useEffect` | `App.tsx:90-92` | Ready sentinel — no visual consequence |
| `useEffect` | `App.tsx:95-97` | Tab title — not part of layout |

### SSR caveat

`useLayoutEffect` requires a DOM and a paint cycle — neither exists on the server. React and Preact both warn if it runs during SSR:

> Warning: useLayoutEffect does nothing on the server…

This widget is client-only so the warning never fires. If you adapt this code for a server-rendered context, the conventional fix is a `useIsomorphicLayoutEffect` shim that aliases to `useEffect` on the server and `useLayoutEffect` on the client.

The hook choice is settled; the next section implements the algorithm that runs inside that `useLayoutEffect` body.

## Fit-to-viewport scaling algorithm

The widget needs to stay fully visible without a scrollbar regardless of window size. The approach: compute how much space the viewport actually offers, measure the widget's natural size, derive a scale factor capped at 1, apply it with `transform: scale()`, and compensate the layout with a negative margin. This runs inside the `useLayoutEffect` introduced in the prior section — so the scaled frame is committed to the DOM before the browser paints. No unscaled flash.

### Step 1 — Available space from the viewport

```ts
// App.tsx:42-49
const recompute = () => {
  const cs = getComputedStyle(page);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  // Use the viewport, not page.clientHeight — `.page` has min-height:100vh and
  // grows with tall content, so it would report the full content height.
  const availW = Math.max(0, window.innerWidth - padX);
  const availH = Math.max(0, window.innerHeight - padY);
```

`getComputedStyle(page)` returns resolved values in `px` even when the CSS source uses `em` or `%`. Wrapping each side in `parseFloat` strips the `"px"` suffix. Adding both sides gives the total consumed padding per axis.

Then the available budget comes from `window.innerWidth` / `window.innerHeight` — the viewport rectangle — not from the page element itself. The comment explains why: `.page` has `min-height: 100vh` and **grows** with its content. When the widget is tall, `page.clientHeight` reports the full content height, which is larger than the viewport. Using it as "available height" would over-report space and produce a scale that still spills below the fold. `window.innerHeight` is always the visible rectangle.

### Step 2 — Natural (untransformed) content size

```ts
// App.tsx:50-53
// Natural (untransformed) content size — transforms don't affect layout box.
const naturalW = content.offsetWidth;
const naturalH = content.offsetHeight;
if (naturalW <= 0 || naturalH <= 0) return;
```

`offsetWidth` / `offsetHeight` report the element's **layout box** — the space it occupies in document flow, including border and padding, rounded to integer pixels.

The critical point, stated verbatim in the source comment: `transform: scale()` is a visual-only operation. It does not change the layout box. After `scale(0.5)` is applied, the element still occupies its original space in the flow; neighbouring elements are laid out as if the transform never happened. Therefore `offsetWidth` and `offsetHeight` always return the **unscaled** dimensions, even when a scale is already in effect. This is exactly what you want: measure the natural size, compute the scale factor, apply it — the measurement is always stable.

The early return on zero dimensions guards the initial render frame before the content has reflowed.

### Step 3 — Width state with hysteresis

```ts
// App.tsx:55-56
const w = Math.max(280, Math.floor(availW));
setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
```

The functional-updater form of `setWidth` — passing a function rather than a bare value — is covered in its own section. The point here is the 4 px threshold: if the new available width differs from the previous by 4 px or less, the state is left alone. This suppresses jitter — sub-pixel viewport oscillations (e.g. from the scrollbar appearing and disappearing) don't cascade into a layout recalculation loop.

### Step 4 — Scale factor and applying the transform

```ts
// App.tsx:61-74
const s = Math.min(1, availW / naturalW, availH / naturalH);
if (s < 0.999) {
  const next = {
    transform: `scale(${s})`,
    marginBottom: `-${Math.ceil(naturalH * (1 - s))}px`,
  };
  setFitStyle((prev) =>
    prev && prev.transform === next.transform && prev.marginBottom === next.marginBottom
      ? prev
      : next,
  );
} else {
  setFitStyle((prev) => (prev === undefined ? prev : undefined));
}
```

`Math.min(1, availW / naturalW, availH / naturalH)` is a three-way minimum:
- `availW / naturalW` — how much you'd need to shrink to fit width.
- `availH / naturalH` — how much you'd need to shrink to fit height.
- `1` — the cap: never enlarge. The widget looks best at its natural size; scaling up would just make images blurry.

The binding constraint (whichever axis is tighter) drives the scale, and `Math.min(..., 1)` ensures the result never exceeds 1.

**The negative margin trick.** `transform: scale(s)` shrinks the element visually, but the layout box is unchanged. At scale 0.6, a 1000 px tall element still occupies 1000 px of flow — 400 px of which is now visually empty space below the shrunken widget, producing a gap and often a scrollbar.

`marginBottom: -${Math.ceil(naturalH * (1 - s))}px` reclaims exactly that gap. At scale 0.6: `naturalH * (1 - 0.6) = 400 px`, so `marginBottom: -400px` pulls the document end upward by 400 px, matching the visual footprint. The layout box and the visual box agree again.

For the visual appearance of `transform: scale()` and how `transform-origin` affects the anchor point, see [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md).

The identity check on `setFitStyle` — comparing `prev.transform` and `prev.marginBottom` before setting — prevents triggering a re-render when `recompute` fires repeatedly but the scale hasn't changed. The `else` branch clears `fitStyle` (setting it back to `undefined`) only when the previous value was not already `undefined`, for the same reason.

### Step 5 — Dual observation

```ts
// App.tsx:77-86
recompute();
// Content size changes (reflow, table swap) — observe the layout box.
const ro = new ResizeObserver(recompute);
ro.observe(content);
// Viewport size changes (window / iframe resize).
window.addEventListener('resize', recompute);
return () => {
  ro.disconnect();
  window.removeEventListener('resize', recompute);
};
```

`recompute()` runs immediately — before the return — so the scale is applied on the first committed frame.

Two sources can invalidate the scale, and each misses what the other catches:

- `ResizeObserver` on `contentRef` fires when the **content element** changes size — a table swap loads different-sized images, fonts finish loading, or a CSS grid reflows. It does not fire when the viewport shrinks while content stays the same size.
- `window.addEventListener('resize', recompute)` fires when the **viewport** changes — the user drags the window edge, the DevTools panel opens, or the widget runs in an iframe that gets resized. It does not fire when the content element grows independently.

Both observers call the same `recompute` function. For the `ResizeObserver` hook pattern and `ro.disconnect()` cleanup, see [tutorial 01](./01-function-plotter.md) — this widget pairs it with `window.resize` rather than using either alone.

### Where the style lands

```tsx
// App.tsx:125-127
<div class="page" ref={pageRef}>
  <div class="fit-scale" style={fitStyle}>
    <div class="container" ref={contentRef}>
```

`fitStyle` is applied to the `.fit-scale` div, which sits between `.page` (measured for padding) and `.container` (measured for natural size via `contentRef`). The transform scales the container visually; the negative `marginBottom` on `.fit-scale` reclaims the empty flow space that the scale leaves behind.

The scaling algorithm introduces functional updater patterns for `setWidth` and `setFitStyle`; the next section formalises the principle behind them.

## Functional `setState` updaters and clamping

`useState` ([covered in 01](./01-function-plotter.md)) gives you a setter that accepts either a bare value or an **updater function**. The distinction matters whenever the next state derives from the current state.

### The stale-closure problem

Consider arrow-key navigation in the lightbox. A naive implementation reads `selection` directly from the closure:

```ts
// Broken: reads selection from the render-time closure
setSelection({ rowIdx: selection.rowIdx + dRow, colIdx: selection.colIdx + dCol });
```

This looks correct, but `selection` is whatever it was when the component last rendered. Under React 18 / Preact automatic batching, or when the arrow key fires faster than a repaint, multiple `setSelection` calls may be queued before a re-render occurs. Each call reads the same stale `selection`, so pressing the down arrow twice in rapid succession produces only one step — the second call overwrites the first with a value derived from the same outdated row index.

The fix is an **updater function**:

```ts
setSelection(prev => { /* derive next from prev, not from closure */ });
```

The framework calls the updater with the value that is actually queued at processing time — always current, regardless of batching or how stale the closure is.

### `navigateLightbox` in full

`App.tsx:108-122` shows the production version:

```ts
// App.tsx:108-122
const navigateLightbox = useMemo(
  () => (dRow: number, dCol: number) => {
    if (!table) return;
    const rowCount = table.rows.length;
    const colCount = table.columns.length;
    setSelection((prev) => {
      if (!prev) return prev;
      const nextRow = Math.min(rowCount - 1, Math.max(0, prev.rowIdx + dRow));
      const nextCol = Math.min(colCount - 1, Math.max(0, prev.colIdx + dCol));
      if (nextRow === prev.rowIdx && nextCol === prev.colIdx) return prev;
      return { rowIdx: nextRow, colIdx: nextCol };
    });
  },
  [table],
);
```

Three things happen inside the updater:

**1. Guard on null.** `if (!prev) return prev` — the lightbox can only be open when `selection` is non-null, but the updater must handle the type-safe null case. Returning `prev` (which is `null`) is a no-op.

**2. Clamping.** `Math.min(rowCount - 1, Math.max(0, prev.rowIdx + dRow))` is the standard double-clamp idiom: `Math.max(0, …)` prevents going below zero; `Math.min(max, …)` prevents overshooting the last row or column. At the grid edges the clamp produces the same index that's already in `prev`.

**3. Same-reference bail-out.** `if (nextRow === prev.rowIdx && nextCol === prev.colIdx) return prev` — when the user is already at the boundary, the clamped next index equals the current one. Returning the same object reference (`prev`) tells Preact/React that state hasn't changed, so it skips the re-render entirely. "Pressing right at the rightmost column does nothing" becomes free — no re-render, no flicker.

The function is wrapped in `useMemo(…, [table])`. `rowCount` and `colCount` are read from `table` inside the outer arrow function, not inside the updater — they are bounds that depend only on the table structure, not on `selection`. The `[table]` dep means the memoised function is recreated only when the table changes. The full `useMemo`-for-stable-identity story is in the smaller touches section.

### The same principle in two smaller examples

**Width hysteresis** (`App.tsx:55-56`):

```ts
setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
```

If the newly computed width `w` is within 4 px of the current width, return `prev` unchanged. A small measurement noise on resize doesn't trigger a re-render. Same-reference bail-out at work.

**Fit-style identity** (`App.tsx:67-73`):

```ts
setFitStyle((prev) =>
  prev && prev.transform === next.transform && prev.marginBottom === next.marginBottom
    ? prev
    : next,
);
```

`next` is a freshly allocated object on every `recompute` call. Without this updater, every resize observer fire would produce a new object reference and force a re-render, even when the transform values haven't changed. Comparing fields inside the updater and returning `prev` when they match preserves referential stability.

### The pattern in one line

> Pass an updater function — not a bare value — whenever the new state derives from the current state. Inside the updater, clamp or transform `prev`, and return `prev` unchanged when nothing actually changed to skip the re-render for free.

With navigation in place, the next challenge is the lightbox: a full-screen modal that must trap focus, block scroll, and restore the page state when dismissed.

## Modal dialog: accessibility and lifecycle

A modal dialog imposes several obligations at once: it must trap keyboard focus, announce itself to screen readers, lock the page scroll, and restore the previous focus state when it closes. The `Lightbox` component fulfills all of these by using a native `<dialog>` element opened with `showModal()` — which handles focus trap, background inertness, and focus restore at the platform level — combined with Preact's conditional mount/unmount as the open/close mechanism.

For the visual presentation — the full-screen backdrop and centred dialog panel — see [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md).

### Mount = open, unmount = close

`App.tsx:161-168` renders the lightbox like this:

```tsx
// App.tsx:161-168
{table && selection && (
  <Lightbox
    table={table}
    selection={selection}
    onClose={closeLightbox}
    onNavigate={navigateLightbox}
  />
)}
```

`Lightbox` only exists in the tree while `selection` is non-null. The moment the user dismisses it, `selection` is cleared, Preact unmounts `Lightbox`, and every effect cleanup runs. This is the entire open/close mechanism — no `isOpen` boolean, no CSS toggling. Mount *is* open; unmount *is* close.

The consequence for effects is direct: whatever setup runs on mount (scroll lock, event listeners, focus change) is automatically unwound on unmount via the cleanup function. The lifecycle is clean because the component's lifetime matches the dialog's visible lifetime.

### Two refs

`Lightbox.tsx:13-14` declares two refs:

```tsx
// Lightbox.tsx:13-14
const closeRef = useRef<HTMLButtonElement>(null);
const dialogRef = useRef<HTMLDialogElement>(null);
```

- `closeRef` points at the close button — the explicit initial focus target when the dialog opens.
- `dialogRef` points at the native `<dialog>` element — used to call `showModal()`, wire event listeners, and trigger `close()` for dismissal.

The old `prevActive` ref that stored the previously-focused element is gone. `showModal()` records the focused element automatically and restores it when the dialog closes — no hand-rolled save/restore needed.

### Three effects: open, event-bridge, navigation

`Lightbox` uses three separate effect calls with intentionally different dependency arrays. Each effect has a distinct reason to re-run.

**Effect 1 — open as modal, focus, and scroll lock** (`Lightbox.tsx:25–35`, deps `[]`):

```tsx
// Lightbox.tsx:25-35
useLayoutEffect(() => {
  const dlg = dialogRef.current;
  if (!dlg) return;
  if (!dlg.open) dlg.showModal();
  closeRef.current?.focus();
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = prevOverflow;
  };
}, []);
```

`useLayoutEffect` with `[]` runs once on mount, synchronously after the DOM is committed and before the browser paints — the right hook for `showModal()`, which must place the dialog in the top layer before any frame is rendered. (See the `useLayoutEffect` section for the full hook-choice rationale.)

`showModal()` does three things at once: it puts the `<dialog>` in the browser's **top layer** — a spec-defined surface that sits above every stacking context and `z-index` on the page; it makes all other elements in the document **inert** (non-focusable, non-clickable, unreachable by assistive technology); and it records the currently-focused element so it is **automatically restored when the dialog closes** — which is why the old `prevActive` ref and its manual focus-restore are gone.

The code then calls `closeRef.current?.focus()` explicitly. `showModal()` runs its own dialog-focusing algorithm before the layout effect fires (browsers typically focus the first focusable descendant). The explicit call overrides that and guarantees the close button receives initial focus regardless of other focusable content in the dialog.

`showModal()` does **not** lock background scroll — a user can still scroll the page behind an open modal dialog. The `document.body.style.overflow = 'hidden'` line is kept for exactly that reason. The cleanup restores the previous value rather than hard-coding `''`, so any pre-existing `overflow` setting is preserved when the dialog closes.

**Effect 2 — cancel and close event bridge** (`Lightbox.tsx:42–56`, deps `[onClose]`):

```tsx
// Lightbox.tsx:42-56
useEffect(() => {
  const dlg = dialogRef.current;
  if (!dlg) return;
  const onCancel = (e: Event) => {
    e.preventDefault();
    onClose();
  };
  const onCloseEvt = () => onClose();
  dlg.addEventListener('cancel', onCancel);
  dlg.addEventListener('close', onCloseEvt);
  return () => {
    dlg.removeEventListener('cancel', onCancel);
    dlg.removeEventListener('close', onCloseEvt);
  };
}, [onClose]);
```

This effect bridges the native dialog's two dismissal events to `onClose()` — the parent-supplied callback that sets `selection` to `null` and drives the unmount.

**`cancel` vs `close`:** Pressing Escape fires a `cancel` event on the `<dialog>` element. `cancel` is cancelable — the handler calls `e.preventDefault()` to stop the platform from also closing the dialog on its own. If the platform closed it, a `close` event would fire without a corresponding `onClose()` call, leaving the DOM dialog closed while Preact still thinks it is mounted. After preventing the default, `onClose()` is called, which clears `selection` and triggers Preact's unmount. Explicit dismissals — the close button and backdrop click — call `dialogRef.current?.close()`, which fires only `close` (never `cancel`), and the `close` handler calls `onClose()` directly. Net: `onClose()` fires exactly once, on every dismissal path.

**Why `addEventListener` and not `onCancel`/`onClose` JSX props?** Preact core maps `onX` props by stripping the `on` prefix and lowercasing, so `onCancel` and `onClose` would technically wire the correct DOM events. The widget's code comment says these are "not reliable here" — accurate in spirit, but the precise reasons are: (a) `Lightbox` already accepts its own `onClose` *prop* from the parent. Writing `<dialog onClose={…}>` inside the component would visually collide with that prop name, making it unclear whether the JSX attribute is forwarding the component prop or registering a new DOM handler. (b) The `cancel` handler must call `e.preventDefault()` before `onClose()`, and the explicit `addEventListener`/`removeEventListener` lifecycle is the cleanest way to express that. Using the ref + effect approach is unambiguous, survives prop renames, and co-locates setup and teardown in one block.

The dep array is `[onClose]`: if the parent passes a new `onClose` reference on re-render, the old listeners are torn down and new ones registered with the fresh callback.

**Effect 3 — arrow key navigation** (`Lightbox.tsx:60–83`, deps `[onNavigate]`):

```tsx
// Lightbox.tsx:60-83
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        onNavigate(0, -1);
        return;
      case 'ArrowRight':
        e.preventDefault();
        onNavigate(0, 1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        onNavigate(-1, 0);
        return;
      case 'ArrowDown':
        e.preventDefault();
        onNavigate(1, 0);
        return;
    }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [onNavigate]);
```

This effect handles only the four arrow keys. Escape is absent — the native `cancel` event (Effect 2) handles it. Tab is absent — Tab is trapped by the browser because all background elements are inert after `showModal()`. The handler stays on `document` so it catches keypresses regardless of what is focused inside the dialog. The dep is `[onNavigate]` so a new reference triggers a teardown and re-registration with the fresh callback.

### ARIA roles and associations

The `<dialog>` element (`Lightbox.tsx:98–106`) carries the ARIA labelling attributes:

```tsx
// Lightbox.tsx:98-106
<dialog
  class="lb-backdrop"
  ref={dialogRef}
  aria-labelledby={titleId}
  aria-describedby={captionId}
  onClick={(e) => {
    if (e.target === e.currentTarget) dialogRef.current?.close();
  }}
>
```

- `aria-labelledby={titleId}` associates the dialog with its visible `<h2>` title. Screen readers announce this label when the dialog receives focus.
- `aria-describedby={captionId}` associates it with the caption text (prompt or reference note), providing a longer description for screen readers to optionally read out.

`role="dialog"` and `aria-modal="true"` were present on the old `<div>` wrapper and are now absent. A `<dialog>` opened with `showModal()` is already exposed to assistive technology as a modal dialog with inert background — the platform enforces the modal semantics structurally, so the explicit ARIA attributes are redundant and were dropped.

`titleId` and `captionId` come from `Lightbox.tsx:85–86`:

```tsx
// Lightbox.tsx:85-86
const captionId = useMemo(() => 'lightbox-caption', []);
const titleId = useMemo(() => 'lightbox-title', []);
```

These are `useMemo` calls that return string literals — functionally equivalent to `const titleId = 'lightbox-title'`. Because `Lightbox` is only ever mounted once at a time (it's conditional on a single selection), there's no collision risk from a fixed id. This is a minor curiosity; in a context where multiple instances could coexist, ids would need to be unique (typically via `useId()` or a counter).

### Focus management: native trap and restore

The hand-rolled Tab focus trap from the old `Lightbox` is gone. No JavaScript is needed to cycle focus within the dialog — the native focus trap falls out of the background inertness applied by `showModal()`.

Per the HTML Living Standard, all elements in the same document as a modal dialog (except the dialog and its descendants) become **inert** when the dialog enters the top layer. Inert elements cannot receive keyboard focus. Tab therefore cycles only among the focusable elements within the dialog — not because a `keydown` handler intercepts Tab and manually re-directs focus, but because there is nowhere else for the browser to go. All current engines enforce this correctly.

Automatic focus restore works the same way: when the `<dialog>` closes by any means, the browser restores focus to the element that had focus before `showModal()` was called. This is spec-required behaviour. The old `prevActive.current = document.activeElement` save and the corresponding `prevActive.current.focus()` in the cleanup are gone — the platform handles both.

What *is* still explicit (in the `useLayoutEffect`) is the **initial focus** call: `closeRef.current?.focus()`. `showModal()` runs its own focusing algorithm — browsers typically focus the first focusable descendant — before the layout effect fires. The explicit call overrides that to guarantee the close button receives focus, making initial focus deterministic regardless of the dialog's content order.

### Early return guard

`Lightbox.tsx:88` sits after the three effects:

```tsx
// Lightbox.tsx:88
if (!cell || !row || !col) return null;
```

The effects run unconditionally on mount; the guard only controls what gets rendered. This ordering matters: if the guard were above the effects, the effects would never register when `cell` is unavailable. As written, the effects still fire (registering cleanup), but the dialog renders nothing — a safe fallback for stale props between the time a close is triggered and the parent re-renders to unmount the component.

### Backdrop click-to-close

The outermost element is the `<dialog>` itself, and its click handler (`Lightbox.tsx:103–105`) provides light-dismiss:

```tsx
// Lightbox.tsx:103-105
onClick={(e) => {
  if (e.target === e.currentTarget) dialogRef.current?.close();
}}
```

`e.target === e.currentTarget` is the reliable outside-click pattern for a full-screen overlay: `e.target` is the element the user actually clicked, and `e.currentTarget` is the element with the listener (the `<dialog>`). If the click landed on any child (the image, a button, the inner content panel), `e.target` will be that child and the check fails — no dismissal. Only a click directly on the bare backdrop area passes the check.

Crucially, the handler calls `dialogRef.current?.close()` rather than `onClose()` directly. Calling `close()` fires the native `close` event, which the event-bridge effect (Effect 2) catches and routes to `onClose()`. This keeps all dismissal paths — close button, backdrop click, and Escape — on the same event route, so `onClose()` is always invoked through a single code path.

`::backdrop` is a pseudo-element the browser creates behind any top-layer `<dialog>`. The widget sets `.lb-backdrop::backdrop { background: transparent; }` so the browser's built-in backdrop does not double up with the dialog's own frosted-glass treatment. Visual details are in [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md).

The row-level `InfoPopover` solves a lighter version of the same problem — an overlay that dismisses without taking over the page.

## Popover dismissal pattern

`InfoPopover` is the lighter sibling of the modal: it opens inline next to a table row, doesn't trap focus, doesn't lock scroll, and leaves the rest of the page fully interactive. Where the lightbox (previous section) is a heavyweight overlay that demands attention before the user can continue, the popover supplements — you can ignore it and keep reading. Use a popover for hints, tooltips, and info panels; use a modal for decisions that block the task.

### State and refs

Four pieces of mutable bookkeeping live at the top of the component (`InfoPopover.tsx:10-14`):

```tsx
const [open, setOpen] = useState(false);
const wrapRef     = useRef<HTMLSpanElement>(null);
const triggerRef  = useRef<HTMLButtonElement>(null);
const closeBtnRef = useRef<HTMLButtonElement>(null);
const wasOpenRef  = useRef(false);
```

`open` is Preact state — changing it re-renders. The refs are mutable boxes ([01](./01-function-plotter.md)): `wrapRef` points at the wrapper `<span>` for outside-click containment checks; `triggerRef` points at the trigger button so focus can return to it on close; `closeBtnRef` is wired to the ✕ button inside the panel; `wasOpenRef` is a latch explained below.

### Outside-click and Escape dismissal

One `useEffect` handles both document-level dismissal paths (`InfoPopover.tsx:17-35`):

```tsx
useEffect(() => {
  if (!open) return;
  const onDocClick = (e: MouseEvent) => {
    const wrap = wrapRef.current;
    if (wrap && !wrap.contains(e.target as Node)) setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };
  document.addEventListener('mousedown', onDocClick);
  document.addEventListener('keydown', onKey);
  return () => {
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKey);
  };
}, [open]);
```

The `if (!open) return` guard is the key efficiency pattern: when the popover is closed, the effect registers no listeners at all. They attach only while the popover is open, and the cleanup removes both.

**Why `mousedown`, not `click`?** The browser fires events in order: `mousedown` → `mouseup` → `click`. Listening on `mousedown` means the popover closes *before* the `click` event dispatches to whatever the user tapped next. With `click`, the dismiss and the target element's own click handler would race — the newly revealed element could receive a click it didn't expect, or a dropdown could close and immediately reopen.

**Why `e.stopPropagation()` on Escape?** In this widget the popover and the lightbox are not open simultaneously on the same row — they are independent UI paths. But `stopPropagation` is still correct defensive practice: if these two dismissible layers were ever nested, a single Escape would reach the popover's handler first and stop bubbling before the outer layer's handler could see it. Without it, one keystroke would close both. This isn't a scenario that actually occurs here, but the pattern is correct regardless.

### Focus-return with the `wasOpenRef` latch

A second `useEffect` returns focus to the trigger after the popover closes (`InfoPopover.tsx:38-45`):

```tsx
useEffect(() => {
  if (open) {
    wasOpenRef.current = true;
  } else if (wasOpenRef.current) {
    wasOpenRef.current = false;
    triggerRef.current?.focus();
  }
}, [open]);
```

The problem this solves: on initial mount `open` is `false`. If you called `triggerRef.current?.focus()` whenever `open` was falsy, focus would jump to the trigger on page load — before the user has done anything. The `wasOpenRef` latch records whether the popover was *ever* open. It starts `false`, flips to `true` when `open` goes `true`, and only triggers the focus-return logic once `open` subsequently goes back to `false`. Focus returns only after a real open→close transition, not on mount.

`wasOpenRef` is a `useRef`, not `useState` — mutating `.current` does not schedule a re-render ([01](./01-function-plotter.md) covers `useRef` as a mutable box). That is intentional: this is bookkeeping, not display data.

### The disclosure trigger

The button that opens the popover (`InfoPopover.tsx:49-57`):

```tsx
<button
  ref={triggerRef}
  aria-expanded={open}
  aria-haspopup="dialog"
  onClick={() => setOpen((v) => !v)}
>
```

`aria-expanded` tells screen readers whether the controlled content is currently visible. `aria-haspopup="dialog"` announces that activating this button reveals a dialog-like panel. The functional updater `(v) => !v` is the correct form for a toggle: it derives the next value from the current state rather than a closure value, avoiding stale-closure bugs under batched updates.

### Conditional render

The popover content mounts only when `open` is `true` (`InfoPopover.tsx:63-64`):

```tsx
{open && (
  <span class="info-popover" role="dialog" aria-label={`Generation prompt for ${rowLabel}`}>
```

No special close cleanup is required: without a focus trap or scroll lock, dismissal is just `setOpen(false)` and the content unmounts. The `role="dialog"` on a `<span>` is valid ARIA — as with the modal, a native `<dialog>` element would be more robust for production since it provides built-in accessibility semantics and top-layer rendering.

### Popover vs modal at a glance

| | InfoPopover | Lightbox |
|---|---|---|
| `open` state | Local `useState` | Lifted `selection` in `App` |
| Background interactive | Yes | No |
| Focus trap | No | Yes (native, via background inert) |
| Scroll lock | No | `document.body.overflow = 'hidden'` |
| Escape | `e.stopPropagation(); setOpen(false)` | `cancel` event: `e.preventDefault(); onClose()` |
| Focus return | `wasOpenRef` latch in second `useEffect` | Automatic (native `<dialog>` restores on close) |

Both approaches use `useEffect` with `[open]` deps and document-level listeners — the architecture is the same. The difference is weight: the popover opts out of every feature that would block background interaction.

For visual presentation, see [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md).

Four shorter techniques round out the widget's mechanics.

## Smaller touches: CSS custom property, compact prop, title sync, stable callbacks

### CSS custom property via inline style

`Grid` needs the column count to drive the CSS grid layout. JavaScript reads it from data; CSS consumes it via `var(--cols)`. The bridge is an inline-style custom property.

`Grid.tsx:11`:
```tsx
const cols = table.columns.length;
```

`Grid.tsx:15–19`:
```tsx
<div
  class="grid"
  role="table"
  aria-label={table.title}
  style={{ '--cols': cols } as any}
>
```

The `as any` cast is required because TypeScript's `CSSProperties` type enumerates known CSS property names, but not `--*` custom properties — there are infinitely many possible names, so none are in the type. At runtime Preact serialises the object to the DOM's `style` attribute correctly; the browser's CSSOM accepts custom properties natively. CSS then reads `var(--cols)` to drive `grid-template-columns` — see [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md) for what that produces visually.

One nuance worth noting: the value passed here is a plain JavaScript number. That works because the CSS expects a bare integer — `repeat(3, 1fr)`. If the CSS instead expected a unit (`--gap: 16px`), you would pass the string `'16px'`, not the number `16`.

### Responsive compact boolean

`App` measures the widget's rendered width via the `ResizeObserver`-backed `useLayoutEffect` from the fit-to-viewport section and stores it as state:

`App.tsx:27`:
```tsx
const [width, setWidth] = useState(960);
```

`compact` is then a plain derived value — no hook required:

`App.tsx:99`:
```tsx
const compact = width < 560;
```

It is passed down as a regular prop:

`App.tsx:137`:
```tsx
<Grid table={table} compact={compact} onCellClick={handleCellClick} />
```

Inside `Grid`, the flag drives a class toggle:

`Grid.tsx:14`:
```tsx
<div class={`grid-wrap${compact ? ' grid-wrap--compact' : ''}`}>
```

In compact mode the column header row is hidden, so each image button carries `data-label={col.label}` (`Grid.tsx:57`) — a data attribute the CSS reads via `content: attr(data-label)` to render a small badge over the thumbnail identifying the column.

The design choice is that `Grid` receives a pre-computed boolean rather than measuring the viewport itself. This keeps `Grid` stateless and free of layout side-effects: it applies a class when told to and knows nothing about where the breakpoint sits. What `.grid-wrap--compact` actually does to the layout — column reflow, thumbnail sizing — is covered in [`../design/02-image-comparison-table.md`](../design/02-image-comparison-table.md).

### `document.title` sync

Setting the browser tab title to match the active table is a non-visual side effect — the natural home for `useEffect`:

`App.tsx:95–97`:
```tsx
useEffect(() => {
  document.title = table ? `${table.title} — Image Comparison` : 'Image Comparison Tables';
}, [table]);
```

The dep array `[table]` means the title updates whenever the table changes, and on initial mount. `useLayoutEffect` would be wrong here: writing `document.title` does not interact with layout or painting, so there is no reason to block the browser's next frame for it. [01](./01-function-plotter.md) introduced `useEffect`; this is recognising non-visual side effects as its natural home. (This effect appeared as a counter-example in the `useLayoutEffect` section; here we look at what it actually does.)

### `useMemo` for stable callback identity

[01](./01-function-plotter.md) used `useMemo` to memoise a **derived value** — avoid recomputing an expensive result when its inputs haven't changed. Here `useMemo` serves a distinct purpose: keeping a **function reference** stable across renders.

`App.tsx:101–104`:
```tsx
const handleCellClick = useMemo(
  () => (rowIdx: number, colIdx: number) => setSelection({ rowIdx, colIdx }),
  [],
);
```

`App.tsx:106`:
```tsx
const closeLightbox = useMemo(() => () => setSelection(null), []);
```

Both have an empty dep array — the functions are created once and the reference never changes for the lifetime of the component. `navigateLightbox` is different:

`App.tsx:108–122`:
```tsx
const navigateLightbox = useMemo(
  () => (dRow: number, dCol: number) => {
    if (!table) return;
    const rowCount = table.rows.length;
    const colCount = table.columns.length;
    setSelection((prev) => { … });
  },
  [table],
);
```

Its dep array is `[table]` because the function body closes over `table` to read row and column counts. When `table` changes, a new function is produced with fresh counts captured; when `table` is stable, the reference is stable. (The body — the functional `setSelection` updater — is taught in the functional-updater section; here the focus is the dep array and its purpose.)

To be accurate about the practical effect: `Grid` and `Lightbox` are not wrapped in `memo()`, so they re-render whenever `App` re-renders regardless of whether callback references changed. The benefit of this `useMemo` pattern is therefore modest in this widget as written. What it does provide is explicitness — the dep array documents which data each function captures, making the closure relationship visible at a glance — and it positions the code to gain the full re-render saving if `memo` is applied to children later, without requiring a second diff to add memoisation.

Those are all the new patterns; it is worth briefly noting how this widget's boot sequence compares to tutorial 01's.

## Boot and project layout

The skeleton here is identical to what [01](./01-function-plotter.md) established: Preact + Vite, `@preact/preset-vite` as the only build plugin, a one-shot `render()` call in `main.tsx`, and `widget.json` declaring `framework: "preact-vite"`, `data: { "mode": "static" }`, and `dataSources: []`. If you haven't done 01, start there — none of those concepts are re-explained below.

**Difference 1 — zero runtime dependencies beyond Preact.**
The function plotter pulled in Observable Plot to do its rendering work. Here the `"dependencies"` block is one line:

```json
// package.json:11-13
"dependencies": {
  "preact": "^10.27.2"
}
```

All domain logic — table definitions, image paths, row/column shapes — lives in `src/tables.ts`, which is plain TypeScript with no imports beyond the standard library. No charting library, no data-processing package. The build stays small and there is no third-party API surface to version-pin.

**Difference 2 — a multi-file component tree.**
Tutorial 01's `App` was self-contained. Here `main.tsx` mounts `<App />` (lines 1–6), `App` imports three siblings — `Grid`, `Lightbox`, and `Picker` (App.tsx:3–5) — and `Grid` in turn imports `InfoPopover` (Grid.tsx:2). The rough graph:

```
main.tsx → App
             ├─ Grid → InfoPopover
             ├─ Picker
             └─ Lightbox
```

Each file owns one concern (grid layout, row-level info tooltip, table selector, zoom overlay); the split is just organisation, not an architectural novelty.

**`base: './'` and offline paths.**
`vite.config.ts` (lines 4–6) sets `base: './'`, which makes every asset URL in the built `dist/` relative rather than root-relative. That matters here because `tables.ts` stores relative image paths that must resolve under both `https://…` (production) and `file://` (the offline render check used by the data-registry pipeline). The data-registry section covers what that check does; the config line is why it works.

**`#widget-ready` — same convention, same timing.**
App.tsx:170 has the identical marker from 01:

```tsx
{ready && <div id="widget-ready" data-ready="true" hidden />}
```

`ready` is set to `true` by the `useEffect` at App.tsx:90–92, which fires after first paint — see [01](./01-function-plotter.md) for the full rationale.

## Putting it together

The widget is small — six source files — but every component and hook choice is load-bearing. Trace a single user journey in code order to see how it all connects.

**URL parsed.** `getInitialTableId()` runs once inside the lazy `useState` initialiser at `App.tsx:24`, reading `window.location.search` then `pathname`. `resolveTable` validates the result against `TABLES` and returns either a `Table` or `null`.

**Table resolved; App renders Picker or Grid.** `table` is `null` → `<Picker tables={TABLE_LIST} />` renders. `table` is a `Table` object → `<article class="card"><Grid …/></article>` renders instead. No router, no history — one boolean branch on a value that never changes during the session.

**User clicks a cell.** `Grid` fires `onCellClick(rowIdx, colIdx)`, which is `handleCellClick` in `App`. `handleCellClick` calls `setSelection({ rowIdx, colIdx })`. `App` re-renders; `selection` is now non-null.

**`selection` set; Lightbox mounts.** The `{table && selection && <Lightbox …/>}` conditional at `App.tsx:161` now renders. Preact mounts `Lightbox`, which is the open signal. Three effects fire: the `useLayoutEffect` calls `dialogRef.current.showModal()` (placing the dialog in the top layer and making the background inert), explicitly focuses the close button, and locks body scroll; the cancel/close `useEffect` wires the native dialog events to `onClose()`; the arrow-keys `useEffect` registers `document.addEventListener('keydown', onKey)` with `[onNavigate]` deps.

**Keyboard/focus effects fire.** The user presses ArrowRight. `onKey` matches `'ArrowRight'`, calls `onNavigate(0, 1)`, which is `navigateLightbox`. Inside `navigateLightbox`, `setSelection(prev => …)` clamps `prev.colIdx + 1` to the column bounds and returns the new selection — or returns `prev` unchanged if already at the edge, skipping the re-render for free.

**Esc pressed; Lightbox unmounts.** Pressing Escape fires a `cancel` event on the `<dialog>`. The cancel handler calls `e.preventDefault()` (stopping the platform from closing the dialog independently) then `onClose()`, which is `closeLightbox`. `closeLightbox` calls `setSelection(null)`. `App` re-renders; `selection` is `null` again. The `{table && selection && …}` conditional is `false`; Preact unmounts `Lightbox`.

**Focus restored.** The `useLayoutEffect` cleanup runs: `document.body.style.overflow` is restored to its saved value. The native `<dialog>` automatically restores focus to the element that was focused before `showModal()` was called — the grid cell the user clicked — with no explicit JS needed.

### Three architecture decisions

**1. Lift state to the lowest common ancestor.** `selection` lives in `App` because both `Grid` (to trigger the open) and `Lightbox` (to know which image to show) depend on it. Colocating it in either child would leave the other without a way to read or change it.

**2. Mount/unmount as the modal lifecycle backbone.** `Lightbox` has no `isOpen` prop. It exists in the tree while the dialog is open and is absent when closed. Effect setup = open side effects; effect cleanup = close side effects. The component's lifetime is the dialog's lifetime.

**3. `useLayoutEffect` for before-paint DOM work.** The fit-to-viewport scale is applied inside a `useLayoutEffect`, not a `useEffect`. The browser is blocked from painting until the transform is written — eliminating the one-frame flash of unscaled content that `useEffect` would cause.

## Concepts introduced

| Concept | First taught (section) |
|---|---|
| Multi-component composition: App → Grid / Picker / Lightbox / InfoPopover | Multi-component composition |
| TypeScript `type` alias as a Props contract | Multi-component composition |
| Unidirectional data flow: data down via props, events up via callbacks | Multi-component composition |
| Lifting state up to the lowest common ancestor (LCA) | Multi-component composition |
| URL-driven view selection without a router | URL-driven view selection |
| `URLSearchParams` + first pathname segment as routing signal | URL-driven view selection |
| `?table=<id>` and `/<id>` as deep-link formats | URL-driven view selection |
| `./` relative link resolution in a hosted SPA | URL-driven view selection |
| Lazy `useState` initialiser: `useState(() => fn())` called only on mount | URL-driven view selection |
| Framework-free typed data module: exported types, factory helpers, preamble closures, `Record<string, T>` registry, selector functions | Typed data registry |
| `useLayoutEffect` — synchronous before-paint effects | `useLayoutEffect` |
| `useLayoutEffect` vs `useEffect`: when each is correct | `useLayoutEffect` |
| `getComputedStyle` + `parseFloat` for computed padding | Fit-to-viewport scaling |
| `window.innerWidth/innerHeight` as viewport budget vs `element.clientHeight` | Fit-to-viewport scaling |
| `offsetWidth/offsetHeight` as natural (untransformed) layout dimensions | Fit-to-viewport scaling |
| `transform: scale()` as a visual-only operation (does not affect layout box) | Fit-to-viewport scaling |
| `Math.min(1, w/nW, h/nH)` — three-way min scale computation capped at 1 | Fit-to-viewport scaling |
| Negative `marginBottom` to reclaim layout space after `transform: scale()` | Fit-to-viewport scaling |
| `ResizeObserver` + `window.resize` dual observation for fit-to-viewport | Fit-to-viewport scaling |
| Functional `setState` updater: `setX(prev => ...)` for stale-closure safety | Functional updaters |
| Clamping within a functional updater; same-reference bail-out | Functional updaters |
| Native `<dialog>` element with `showModal()` for browser-managed modal semantics | Modal dialog |
| `showModal()`: top-layer rendering above all stacking contexts and z-indices | Modal dialog |
| Background inertness via `showModal()`: built-in focus trap and AT exclusion (spec-guaranteed) | Modal dialog |
| Automatic focus restore on `<dialog>` close (spec-guaranteed, no JS needed) | Modal dialog |
| Deterministic initial focus via explicit `.focus()` call after `showModal()` | Modal dialog |
| `cancel` vs `close` native dialog events: when each fires and why they differ | Modal dialog |
| Wiring dialog events via `addEventListener` in Preact: prop-collision avoidance and explicit teardown | Modal dialog |
| `aria-labelledby` + `aria-describedby` for modal title/description wiring | Modal dialog |
| Body scroll lock via `document.body.style.overflow = 'hidden'` (still needed: `showModal()` does not lock scroll) | Modal dialog |
| Backdrop click-to-close via `e.target === e.currentTarget` | Modal dialog |
| Conditional mount/unmount as the modal open/close lifecycle backbone | Modal dialog |
| Early `return null` guard in conditionally rendered components | Modal dialog |
| Non-modal popover vs modal dialog: when to use each | Popover dismissal |
| Outside-click dismissal: `document.mousedown` + `Node.contains()` | Popover dismissal |
| `mousedown` before `click` for outside-click ordering | Popover dismissal |
| `stopPropagation` to prevent Escape from closing outer layers | Popover dismissal |
| `wasOpenRef` latch for focus-return-to-trigger after genuine open→close | Popover dismissal |
| `aria-expanded` + `aria-haspopup` for disclosure widgets | Popover dismissal |
| CSS custom property from JSX inline style: `style={{ '--cols': n } as any}` | Smaller touches |
| Responsive `compact` boolean derived from measured width, passed as prop | Smaller touches |
| `document.title` synchronisation via `useEffect` | Smaller touches |
| `useMemo` for stable callback identity (memoised event handlers) | Smaller touches |
