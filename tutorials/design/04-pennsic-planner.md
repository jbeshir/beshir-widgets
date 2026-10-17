# 04 · Pennsic Planner — Container Queries, Sticky, and the JS→CSS Styling API

The [Pennsic Planner](https://pennsic-planner.widgets.beshir.org) is a week-at-a-glance class scheduler for a large medieval re-enactment event: five views — Schedule, My Plan, Calendar, Instructors, and About — with per-track colour coding, conflict detection, and a proportional timetable grid. This is entry 04 of the `design/` track and assumes the techniques introduced in [01](./01-function-plotter.md), [02](./02-image-comparison-table.md), and [03](./03-japanese-verb-tower.md); every CSS technique introduced here is listed in the closing ledger and may be referenced by name in later tutorials without re-explanation. The Preact component tree, event handling, and the proportional timetable geometry are covered in the sibling frontend tutorial at [`../frontend/04-pennsic-planner.md`](../frontend/04-pennsic-planner.md).

## The look

The palette is warm parchment — a deliberate departure from the cool-slate house style of tutorials 01–03. Light mode opens on `--bg: #faf6f0` for the page background and `--card-bg: #fffdfa` for content surfaces (`styles.css:2–3`). The interactive accent is rose-red `--accent-fill: #9d2235` (`styles.css:27`), used for focused inputs, active pills, and the primary action colour throughout. The ☆/★ star that marks a session "in my plan" renders in literal gold: `#d99a1f` in light mode and `#ffd166` in dark (`styles.css:1281, 1301`). Full dark mode is handled by the token-swap pattern established in [tutorial 01 §"Theming with custom properties"](./01-function-plotter.md#theming-with-custom-properties): `:root` custom properties are redeclared inside a `@media (prefers-color-scheme: dark)` block (`styles.css:31–61`) and every `var()` reference picks up the new values automatically.

The design constraint that drives every new technique in this entry is simple: the widget lives in an **iframe at an arbitrary width**. An embedding page may give it 320 px in a narrow sidebar or 1400 px at full desktop width. Media queries fire on the *host page's viewport* — so on a 1440 px desktop with the widget in a 320 px sidebar, every viewport breakpoint triggers while the widget itself stays narrow. The layout must respond to its own container's width, which is what makes container queries the headline technique of this entry.

That one constraint cascades into a chain of related decisions. To make layout respond to the container, `container-type: inline-size` and `@container (min-width: …)` queries replace the media-query approach used in earlier tutorials. Making container queries work correctly means `.card` must not create a scroll container — which introduces `overflow: clip`. Avoiding a scroll container is also a prerequisite for `position: sticky` to work inside cards. Separately, collapsible filter panels are built on native `<details>`/`<summary>` elements styled with attribute selectors. Per-track session colours flow from JavaScript into the stylesheet via a custom-property styling API consumed with `var()` fallbacks. Block titles in the timetable use multi-line line-clamp whose count is set by JavaScript as an inline style. And the tab strip uses scrollbar hiding to overflow cleanly at any width.

The convergence point for several of these techniques is the `.card` rule at `styles.css:87–94`:

```css
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  box-shadow: var(--card-shadow);
  overflow: clip; /* clip preserves border-radius clipping without creating a scroll container, which would break position:sticky on slot headers */
  container-type: inline-size;
}
```

`overflow: clip` at line 92 and `container-type: inline-size` at line 93 sit next to each other because they solve related problems — and sticky positioning inside the card depends on both being set correctly. The inline comment on line 92 is unusually load-bearing; unpacking it takes two full sections.

## Container queries — the widget queries its own width

The Pennsic Planner lives inside an `<iframe>`. The host page controls how wide that frame is; the widget cannot know in advance whether it has 300 px or 1200 px. A `@media (min-width: 1000px)` rule fires on the *host page's viewport* — so on a 1440 px desktop with the widget in a 320 px sidebar, every viewport breakpoint triggers while the widget itself stays narrow. `@container (min-width: …)` fires on the *container element's* inline size, which is what the widget actually has to work with.

### Declaring the container

`container-type: inline-size` at `styles.css:93` (see the `.card` block in [§ The look](#the-look)) does two things simultaneously: it registers `.card` as a **query container**, so any `@container` rule in its subtree resolves against `.card`'s inline size rather than the viewport; and it applies **inline-size containment**, so the browser can compute `.card`'s size without first examining its contents.

The `var()` and `:root` token mechanics here follow the pattern established in [tutorial 01 §"Theming with custom properties"](./01-function-plotter.md#theming-with-custom-properties).

One constraint follows from containment: an element cannot query itself. A `@container` rule walks up the tree to find the nearest *ancestor* with a container type. If you wrote a rule targeting `.card` inside an `@container` block, the query would look for a container above `.card` — not `.card` itself. That is why both breakpoints below target descendants of `.card`, not `.card` directly.

### Breakpoint 1: plan sidebar at 1000 px

The plan sidebar is hidden by default (`styles.css:1633`):

```css
.plan-sidebar {
  display: none;
}

@container (min-width: 1000px) {         /* styles.css:1637 */
  .plan-sidebar {
    display: block;
    flex: 0 0 300px;
    width: 300px;
    /* …border, border-radius, padding, align-self… */
  }

  .plan-sidebar--floating {
    position: sticky;
    top: var(--sticky-top, 0px);         /* styles.css:1650 */
  }
}
```

When `.card`'s inline size crosses 1000 px, the sidebar materialises as a fixed-width 300 px column and sticks as the user scrolls. Below that threshold it stays invisible — no wasted space on narrow frames. The `--sticky-top` offset is a JS→CSS handoff explained in full in [§ `position: sticky` and the scroll-container dependency](#position-sticky-and-the-scroll-container-dependency) and [§ Custom properties as a JS→CSS styling API](#custom-properties-as-a-jscss-styling-api).

### Breakpoint 2: calendar columns at 720 px

The Calendar view's day columns stack full-width by default (`styles.css:1921`). The `@container` query switches them to a side-by-side layout:

```css
.cal-grid .dtg-col {
  flex: 1 1 100%;                        /* styles.css:1922 — default: full row */
}

@container (min-width: 720px) {          /* styles.css:1925 */
  .cal-grid .dtg-col {
    flex: 1 1 200px;
    max-width: 280px;
  }
}
```

Both thresholds resolve against `.card` — the container declared at line 93 — regardless of the surrounding page's viewport.

### Baseline

Container queries are **Baseline Widely Available** (Chrome 105, Firefox 110, Safari 16). No fallback is needed for evergreen targets.

### Sub-note: intrinsic auto-placement without a query

Not every responsive layout in this widget uses `@container`. `.slot-sessions` (`styles.css:570`) and `.instructor-sessions` (`styles.css:2085`) both respond to their available width with no query at all:

```css
grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
```

The `repeat(auto-fill, …)` idiom and `min(A, B)` function are covered in [tutorial 02 §"CSS Grid"](./02-image-comparison-table.md#css-grid-building-the-comparison-table) and [§"CSS Math Functions"](./02-image-comparison-table.md#css-math-functions-clamp-min-max). The wrinkle new here is nesting `min(100%, 16rem)` as the `minmax` floor. Without it, `minmax(16rem, 1fr)` instructs the grid "tracks are at least 16rem wide" — which overflows any container narrower than 16rem. `min(100%, 16rem)` caps the floor at the container's full width: at any width below 16rem the track collapses to 100% instead of overflowing.

## `overflow: clip` vs `overflow: hidden`

The `.card` block has `border-radius: 14px` (line 90 of the block shown in [§ The look](#the-look)). Without some `overflow` value, child content bleeds past those rounded corners. The obvious fix is `overflow: hidden` — but that would silently break the sticky headers you will see in the next section. The codebase avoids the problem with a single line:

```css
/* styles.css:92 */
overflow: clip; /* clip preserves border-radius clipping without creating a scroll container, which would break position:sticky on slot headers */
```

That comment is the whole story. Unpacking it:

### `overflow: hidden` creates a scroll container

Any element with `overflow: hidden` becomes a **scroll container** — not scrollable by the user, but scrollable programmatically (anchor jumps, focus-follow, `scrollTo()`), and, critically, the browser treats it as the nearest scrollable ancestor for `position: sticky`. A sticky descendant sticks within the *scroll container*, not the page. So if `.card` used `overflow: hidden`, any sticky header inside it would stick to `.card`'s top edge rather than the viewport. In a card that is only a few hundred pixels tall, that sticky element would never appear to stick at all — or it would stick in the wrong place.

Tutorial 03 introduced `overflow: hidden` for corner-clipping in [§ "The tower shell"](./03-japanese-verb-tower.md#the-tower-shell); here we encounter the case where `hidden` would *break* the layout.

### `overflow: clip` only clips paint

`overflow: clip` clips overflowing content at the element's padding edge — exactly like `hidden` visually — but it stops there. It does **not** establish a scroll container. The element is not scrollable, not even programmatically. `position: sticky` descendants still navigate the ancestor chain looking for a scroll container and find the real outer scroller instead.

The practical difference in one table:

| | `overflow: hidden` | `overflow: clip` |
|---|---|---|
| Clips visible overflow | ✓ | ✓ |
| Creates a scroll container | ✓ | ✗ |
| Programmatic scrolling (`scrollTo()`, anchor jumps) | ✓ | ✗ |
| Creates a block formatting context (BFC) | ✓ | ✗ |
| One-axis clip (`overflow-x: clip; overflow-y: visible`) | ✗ | ✓ |
| `overflow-clip-margin` | ✗ | ✓ |

Two secondary differences are worth noting. First, `overflow: clip` does not create a BFC — if you need float containment separately, add `display: flow-root`. Second, unlike `hidden`, `clip` lets you clip one axis while leaving the other as `visible`; `overflow-x: hidden; overflow-y: visible` silently promotes `visible` to `auto`, but `overflow-x: clip; overflow-y: visible` is valid.

`overflow: clip` is **Baseline Widely Available** (Safari 16 shipped it in September 2022), safe without a fallback for evergreen targets.

### `.card` holds both properties at once

`overflow: clip` and `container-type: inline-size` coexist on `.card` at lines 92–93 without conflict: `overflow: clip` has no effect on size containment.

### Second instance: `.slot`

```css
/* styles.css:545 */
.slot {
  overflow: clip;
}
```

Each time slot uses the same value for the same reason: it clips slot overflow without making `.slot` its own sub-scroller. If `.slot` used `overflow: hidden`, sticky elements would be trapped inside each slot's tiny scroll container rather than floating against the outer column scroll.

The scroll-container trap that `overflow: clip` sidesteps is precisely what makes `position: sticky` work in this widget — which is the subject of the next section.

## `position: sticky` and the scroll-container dependency

The Pennsic Planner's standalone view is one long scroll. Four pieces of UI must stay reachable regardless of scroll position: the day-picker bar, the timetable column headers, the lightbox dialog header, and the floating plan sidebar. All four use `position: sticky`.

### The mechanism — and the mandatory threshold

`position: sticky` is a hybrid. Until an element reaches its threshold it behaves like `position: relative` — it sits in normal flow and does not lift out. Once it hits the threshold it locks in place like `position: fixed`, but *within its scroll container* rather than the viewport. The rest of the document continues to scroll past it.

The threshold is not optional. A sticky element with no `top`, `bottom`, `left`, or `right` value never sticks — it scrolls away as if it were `relative`. This is the most common "why isn't my sticky working?" bug.

### The scroll-container trap — and why `overflow: clip` matters

`position: sticky` pins within its **nearest scroll container** — the closest ancestor that has `overflow: hidden`, `overflow: auto`, or `overflow: scroll`. If that ancestor is shorter than the page, the element sticks inside it and appears to stop working. The bug is silent: no error, no visual indication that the wrong container was chosen.

This is exactly the problem [§ `overflow: clip` vs `overflow: hidden`](#overflow-clip-vs-overflow-hidden) was written to prevent. `.card` clips its overflow with `overflow: clip` rather than `overflow: hidden` precisely because `clip` does not create a scroll container. The load-bearing comment at `styles.css:92` makes this explicit:

```css
overflow: clip; /* clip preserves border-radius clipping without creating a scroll container,
                   which would break position:sticky on slot headers */
```

If `.card` used `overflow: hidden` instead, every sticky element inside would be trapped inside its own card — sticking at the card's top edge, not the page's.

### The four sticky elements

**Day-picker bar — `z-index: 20`** (`styles.css:180`)

```css
/* Day tabs — sticky so the day picker stays reachable in the single-scroll standalone view.
   Harmless in the auto-height embed (nothing scrolls past it there). */
.day-tabs-outer {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--card-bg);
  …
}
```

`top: 0` declares the threshold: stick the moment the element's top edge reaches the top of the scroll container. The day-picker bar gets the highest z-index of the four — as timetable content scrolls underneath it, the bar must sit cleanly above all scrolling elements.

**Timetable column headers — `z-index: 1`** (`styles.css:1730`)

```css
.dtg-col-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--card-bg);
  …
}
```

Each column header (`Monday`, `Tuesday`, …) sticks at the top of its column as the timetable scrolls vertically. `z-index: 1` is enough to cover the time-block content flowing past below.

**Lightbox dialog header — `z-index: 1`** (`styles.css:1350`)

```css
.lightbox-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--card-bg);
  …
}
```

The `<dialog>` for session details is itself the scroll container, so its header sticks inside the dialog as long session descriptions scroll past.

**Floating plan sidebar — `var(--sticky-top, 0px)`** (`styles.css:1648`)

```css
@container (min-width: 1000px) {   /* styles.css:1637 */
  .plan-sidebar--floating {
    position: sticky;
    top: var(--sticky-top, 0px);   /* styles.css:1650 */
  }
}
```

The plan sidebar only exists when the container is wide enough, so its sticky rule lives inside the `@container` block introduced in [§ Container queries](#container-queries--the-widget-queries-its-own-width). `top: 0px` would stick it to the very top of the viewport — but the day-picker bar is already there. JavaScript measures the bar's rendered height and pushes that value in as a custom property:

```ts
el.style.setProperty('--sticky-top', `${topOffset}px`);  // PlanSidebar.tsx:28
```

The stylesheet consumes it with `var(--sticky-top, 0px)` — the `0px` fallback fires only when the property is unset. This is the first example of the JS→CSS custom-property pattern this widget uses throughout; the full custom-property API is covered in [§ Custom properties as a JS→CSS styling API](#custom-properties-as-a-jscss-styling-api). For the JS measurement logic, see [`../frontend/04-pennsic-planner.md`](../frontend/04-pennsic-planner.md).

### `z-index` — why it is needed

Without an explicit `z-index`, a sticky element stays in the same stacking order as its siblings. Content scrolling past can render *in front of* the sticky header — covering its text or controls. Adding `z-index: 20` (`.day-tabs-outer`) or `z-index: 1` (`.dtg-col-header`, `.lightbox-header`) ensures each sticky element sits above its scrolling neighbours.

The `position: fixed`, `z-index`, and stacking-context mechanics are covered in [tutorial 02 §"Positioning & Stacking Contexts"](./02-image-comparison-table.md#positioning--stacking-contexts); this section covers only what is unique to `sticky`.

## Styling native `<details>`/`<summary>` and attribute selectors

The track colour legend lists every class track with its colour chip — useful, but long. Tucking it into a native disclosure widget keeps the filter toolbar calm without a single line of toggle logic.

### Why `<details>`/`<summary>`

`<details>` is a built-in HTML disclosure widget. The browser manages everything: clicking `<summary>` (or pressing Enter/Space when it has focus) toggles an `open` boolean attribute on the `<details>` element, revealing or hiding the rest of its content. You get keyboard support and correct ARIA semantics — `<summary>` is exposed as `role="button"` with `aria-expanded` wired to the actual open state — for free. No JavaScript, no manual `aria-expanded` to keep in sync.

### The markup

`Filters.tsx:177–210` uses the element exactly as the browser intends:

```jsx
<details class="track-legend-details">
  <summary class="track-legend-summary">
    Track color key <span class="track-legend-count">({tracks.length})</span>
  </summary>
  <div class="track-legend-grid">
    {/* colour chips */}
  </div>
</details>
```

When the user opens the legend the browser writes `<details open>` into the DOM. When they close it, the attribute is removed. Your CSS observes that attribute change — no event listener needed.

### Step 1 — Remove the UA disclosure marker

Browsers render a default triangle on `<summary>`. Two declarations are required to remove it across all engines:

```css
/* styles.css:457 */
.track-legend-summary {
  list-style: none;   /* removes ::marker in Chrome and Firefox */
}

/* styles.css:466 */
.track-legend-summary::-webkit-details-marker { display: none; }
```

The `::-webkit-details-marker` pseudo-element is a Safari-specific legacy target — it follows the same pattern as `::-webkit-search-cancel-button` covered in [tutorial 03 §"Native controls and affordances"](./03-japanese-verb-tower.md#native-controls-and-affordances).

### Step 2 — Supply a custom caret

With the default marker gone, add your own via `::before` (`styles.css:468–473`):

```css
.track-legend-summary::before {
  content: '▶';
  font-size: 9px;
  opacity: 0.6;
  transition: transform 120ms ease;
}
```

The `::before` pseudo-element and `content` property were introduced in [tutorial 02 §"Pseudo-element Content"](./02-image-comparison-table.md#pseudo-element-content--the-quotes-property); `transform: rotate()` in [tutorial 02 §"Transform and transform-origin"](./02-image-comparison-table.md#transform-and-transform-origin). The only new work here is connecting the rotation to the open state — which brings us to the attribute selector.

### Step 3 — The `[open]` attribute selector

```css
/* styles.css:475–477 */
details[open] .track-legend-summary::before {
  transform: rotate(90deg);
}
```

`[open]` is an **attribute selector** in its boolean-presence form. It matches any element that has the `open` attribute present, regardless of value — so it matches `<details open>` and `<details open="">` alike. Do not write `[open="true"]`; that matches only a literal string `"true"`, which the browser never sets.

**Specificity.** An attribute selector contributes `(0,1,0)` — the same weight as a class. Compounded with the `details` type selector, `details[open]` resolves to `(0,1,1)`: one element `(0,0,1)` plus one attribute `(0,1,0)`. That is enough to override the base `::before` rule without needing `!important`.

**The cascade doing the state management.** When the user clicks `<summary>`, the browser toggles the `open` attribute on `<details>`. The `details[open]` rule fires or stops firing. The caret rotates. No JavaScript observes anything; the browser is the only state manager, and CSS reads that state directly through the attribute selector.

### A second instance confirms the idiom

`styles.css:1025–1031` repeats the same pattern in the share popover's "Your calendars on this device" section:

```css
/* styles.css:1025 */
.device-cals { margin-top: 12px; }

/* styles.css:1026–1031 */
.device-cals-summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-secondary);
}
```

A different `<details>` widget, a different class name, but the same open/close mechanism. The `[open]` attribute selector is equally available to any element in the disclosure tree — you apply the same pattern without modification.

## Custom properties as a JS→CSS styling API

Custom properties, `:root`, `var()` substitution, and inheritance are covered in [tutorial 01 §"Theming with custom properties"](./01-function-plotter.md#theming-with-custom-properties), and the JS-set-inline-custom-property mechanism — JavaScript writing a `--var` as an inline style for CSS to read back via `var()` — was introduced in [tutorial 02 §"CSS Grid"](./02-image-comparison-table.md#css-grid-building-the-comparison-table) as the `var(--cols)` column-count driver. This section reuses that mechanism for per-track theming; what is genuinely new here is the `var()` **fallback argument** and the `hsl()` colour model.

### The pattern: inline custom property as a parameter

The planner assigns each track a colour pair in JavaScript. `SessionBlock` and `DayTimeGrid` deliver those values to the stylesheet by writing them as inline custom properties on the element they render:

```tsx
// SessionBlock.tsx:19–21
const style: JSX.CSSProperties & Record<string, unknown> = {
  '--tc-l': trackColor.l,
  '--tc-d': trackColor.d,
};
```

`DayTimeGrid.tsx:70–77` does the same for timetable blocks. The values — for example, `hsl(40,55%,37%)` — are strings computed by `App.tsx:214–227`; see [`../frontend/04-pennsic-planner.md`](../frontend/04-pennsic-planner.md) for the hue arithmetic.

On the CSS side, every rule that colours a track surface reads these via `var()`:

```css
/* styles.css:341 */
.track-chip {
  background: var(--tc-l, hsl(220, 55%, 37%));
}
```

Think of the component as the *caller* and the CSS rule as a *function with a default parameter*. The component passes an argument through the inline style; the declaration body receives it via `var()`. When no argument is passed — when a session has no assigned track — the fallback is what renders.

### The `var()` fallback: when it fires and when it doesn't

The second argument to `var(--prop, fallback)` is substituted in exactly two cases:

1. The custom property is **not set** anywhere in the element's inheritance chain.
2. The custom property is set to the **guaranteed-invalid** value (`initial`, `unset`, or `revert`).

What it does *not* rescue is a property set to a syntactically wrong value for the consuming context. Suppose `--tc-l` is set to `"hello"`. The `var()` substitution still succeeds — the string is substituted — but `background: "hello"` is invalid at computed-value time. The browser makes the *entire consuming declaration* invalid-at-computed-value-time and falls back to the **property's inherited or initial value**, not to the `var()` fallback argument. The fallback `hsl(220, 55%, 37%)` is never reached.

This is a real footgun: setting a custom property to a value of the wrong type silently drops the declaration rather than triggering the fallback you wrote. Type your values correctly, or the fallback will give you no warning that something is wrong.

### The `hsl()` color model

HSL expresses colour as three independent axes:

- **Hue** — position on the colour wheel, 0–360°. Red is near 0°/360°, green near 120°, blue near 240°.
- **Saturation** — 0% is grey; 100% is fully saturated.
- **Lightness** — 0% is black; 50% is a mid-tone; 100% is white.

This decomposition is what makes HSL the right model for generating a family of per-track colours from a single integer. Distribute tracks evenly around the hue wheel and every track gets a perceptually distinct colour; lightness and saturation stay consistent across the set.

The codebase uses the legacy comma syntax throughout (e.g., `hsl(220, 55%, 37%)`). Modern CSS Color Level 4 allows space-separated `hsl(220 55% 37%)`, but the two forms are equivalent; the codebase predates the modern syntax and is consistent on the older form.

Dark mode requires more than just inverting the palette. The same lightness value reads very differently across hues: yellow at 37% lightness is already quite bright, while blue at 37% is quite dark. `App.tsx:219–224` compensates by adjusting saturation and lightness per hue band to keep white text legible on every generated colour. That is why there are two separate properties rather than one: `--tc-l` carries the light-mode value and `--tc-d` carries the dark-mode value, and the stylesheet switches between them under `@media (prefers-color-scheme: dark)`:

```css
/* styles.css:341 — light mode */
.track-chip {
  background: var(--tc-l, hsl(220, 55%, 37%));
}

/* styles.css:349–353 — dark mode */
@media (prefers-color-scheme: dark) {
  .track-chip {
    background: var(--tc-d, hsl(220, 51%, 49%));
  }
}
```

### One property, six surfaces

A single `--tc-l`/`--tc-d` pair set on an element propagates through CSS inheritance to every descendant rule that consumes it. The stylesheet uses these properties in six distinct places:

- `styles.css:341` — `.track-chip` background (the pill label on session cards)
- `styles.css:524` — `.legend-swatch` background (the colour square in the track filter legend)
- `styles.css:583` — `.session-card` `border-left: 4px solid` (the coloured accent bar on each card)
- `styles.css:1334` — `.lightbox-dialog` `border-left: 4px solid` (the same accent bar on the detail sheet)
- `styles.css:1416` — `.lightbox-chip` background (the track pill inside the detail sheet)
- `styles.css:1809` — `.dtg-block::before` background at 6% opacity — a subtle colour wash behind the timetable block that makes each track identifiable at a glance without overwhelming the text

Every one of these reads `var(--tc-l, hsl(220, 55%, 37%))` (or its `--tc-d` counterpart). The default `hsl(220, 55%, 37%)` — a mid-tone slate blue — is what renders for sessions with no track assigned.

### The same pattern for layout: `--sticky-top`

Colour is not the only thing JS can hand to CSS this way. `PlanSidebar.tsx:28` sets a geometry value:

```ts
el.style.setProperty('--sticky-top', `${topOffset}px`);
```

The value is the measured height of the `.day-tabs-outer` sticky bar — a number that only exists at runtime. The stylesheet consumes it at `styles.css:1650` (`top: var(--sticky-top, 0px)`) inside the `@container` block covered in [§ `position: sticky` and the scroll-container dependency](#position-sticky-and-the-scroll-container-dependency). This is structurally identical to the colour API: JS computes a value that CSS cannot know statically, writes it as a custom property on the element, and the stylesheet consumes it via `var()` with a safe default.

### Blending and further manipulation

Once a colour is in a custom property, you can blend it with other values using `color-mix()`. The `color-mix()` function for blending or lightening token-derived colours was covered in [tutorial 03 §"Motion: transitions, not keyframes"](./03-japanese-verb-tower.md#motion-transitions-not-keyframes).

### Accessibility and generated colours

Hue rotation does not guarantee consistent perceptual contrast. Yellow (~60°) is intrinsically bright; blue (~240°) is intrinsically dark. At identical lightness values, some hues will produce insufficient contrast against white text and others will pass easily. `App.tsx:219–222` partially addresses this with per-hue-band lightness adjustments, and the separate `--tc-l`/`--tc-d` values let the dark-mode palette independently target contrast. If you adopt this pattern, verify generated colours against your contrast targets — 4.5:1 for normal text, 3:1 for large text per WCAG 2.1 AA — rather than trusting hue rotation alone.

## Multi-line truncation with line-clamp

In the Pennsic Planner's proportional timetable, a session block's pixel height is proportional to its duration — a 30-minute class gets half the height of a 60-minute one. That means the title has a variable, often small, amount of vertical space to fill. Clamping to a single line loses too much for longer titles in tall blocks; leaving text unconstrained overflows the block entirely. What you need is *however many lines actually fit*.

### The `-webkit-box` stack

The mechanism lives in CSS. `.dtg-block-title` establishes the multi-line clamp container:

```css
/* styles.css:1860–1862 */
overflow: hidden;
display: -webkit-box;
-webkit-box-orient: vertical;
```

Three declarations, each load-bearing:

- `display: -webkit-box` switches the element into the legacy webkit box model — the prerequisite for line clamping to work at all.
- `-webkit-box-orient: vertical` stacks the box's children along the block axis, which is what lets the browser count lines.
- `overflow: hidden` clips the content that falls past the clamped line boundary. Without it, the ellipsis appears but the text is not cut — everything past line N bleeds through.

This is a case where `overflow: hidden` is exactly right. In [§ `overflow: clip` vs `overflow: hidden`](#overflow-clip-vs-overflow-hidden) you learned that `hidden` silently creates a scroll container, which breaks `position: sticky` on any descendant. `.dtg-block-title` is a leaf text node — it has no sticky descendants, no inner scrollers, nothing to break. Here `hidden` is just clipping.

### The line count belongs to JS

What you will not find anywhere in `styles.css` is `-webkit-line-clamp: N`. The numeric count is not a constant — it depends on how tall the block is at render time, and the browser does not know that at parse time. `DayTimeGrid.tsx` computes it:

```tsx
// DayTimeGrid.tsx:80
const titleLines = Math.max(1, Math.floor((height - reservedH) / TITLE_LINE_H));
```

`TITLE_LINE_H` is the per-line pixel height constant (`DayTimeGrid.tsx:7`). Once the line budget is known, it is pushed onto the element as an inline style:

```tsx
// DayTimeGrid.tsx:100
<div class="dtg-block-title" style={{ WebkitLineClamp: titleLines }}>{s.title}</div>
```

This is the section's core point: **CSS owns the truncation mechanism; JS owns the line count.** The stylesheet sets up the box model and `overflow` so that whenever `WebkitLineClamp` arrives, it works correctly. JS computes the right N from block geometry and writes only that number. Neither side duplicates the other's job. The height arithmetic — what `height` and `reservedH` are — is covered in the sibling frontend tutorial at [`../frontend/04-pennsic-planner.md`](../frontend/04-pennsic-planner.md).

### Contrast: single-line ellipsis

When you only need to clamp to one line, there is a simpler idiom. `.plan-item-title` (`styles.css:806–808`) uses it:

```css
/* styles.css:806–808 */
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

`white-space: nowrap` forces the text to a single line; `overflow: hidden` clips it; `text-overflow: ellipsis` appends `…` at the cut. No vendor prefix, no JS involvement, no display-mode change. `.session-card-meta` (`styles.css:656–658`) follows the same pattern.

The distinction is sharp:

| Truncation target | Technique |
|---|---|
| Exactly one line | `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis` |
| N lines (variable or fixed) | `display: -webkit-box` + `-webkit-box-orient: vertical` + `overflow: hidden` + `-webkit-line-clamp: N` |

Reach for `text-overflow: ellipsis` when you know one line is the right answer. Reach for the `-webkit-box` stack when the line budget depends on available space.

### 2026 browser status

The un-prefixed `line-clamp` property is included in Interop 2026. Chromium has begun shipping it, but as of June 2026 it is **not yet Baseline** — it is not interoperably supported across all three major engines at stable release. Use the `-webkit-` prefixed stack for production. The spec defines `-webkit-line-clamp` as a compatibility alias, so the prefixed form will continue to work once the standard property lands everywhere.

### Accessibility

Clamping is visual only. The full title text remains in the DOM — assistive technology reads it without any extra work. `DayTimeGrid.tsx:91` already sets an `aria-label` on the block element that includes the full title; the clamped `.dtg-block-title` is redundant from a screen-reader perspective but harmless.

## Scrollbar hiding

The `.tabs` strip (`styles.css:126`) is a `display: flex` row of tab buttons. On narrow embeds it overflows horizontally, so it has `overflow-x: auto` (`styles.css:130`). That makes it scrollable — but a native scrollbar sitting under a row of tabs looks like interface chrome clutter and steals vertical space from the schedule. You want the scroll to work; you just do not want the bar to show.

Two declarations are required together:

```css
/* styles.css:131 */
scrollbar-width: none;

/* styles.css:134 */
.tabs::-webkit-scrollbar { display: none; }
```

`scrollbar-width` is the standard CSS Scrollbars Level 1 property — **Baseline Newly Available as of December 2024**, when Safari shipped support. It only accepts keywords: `auto`, `thin`, or `none`. It does not accept length values.

`::-webkit-scrollbar` is a non-standard Blink/WebKit pseudo-element that predates the standard by years. Older Chromium and Safari versions only respond to this form, not `scrollbar-width`. Both declarations together cover all evergreen browsers.

**Accessibility caveat.** Hiding a scrollbar removes the visual cue that the strip is scrollable. This is only safe where an alternative affordance exists. Here it is defensible: the active tab is always fully visible without scrolling (so users never need to scroll to reach their current view), the strip is supplemental navigation rather than a primary content area, and touch and trackpad users get gesture scrolling automatically. On a primary scrollable region with no other affordance, hiding the scrollbar would be a usability problem.

The `font-variant-numeric: tabular-nums` property used on `.session-card-time` (647), `.dtg-hour-label` (1763), and elsewhere is introduced in [tutorial 02 §":focus-visible & Interaction Polish"](./02-image-comparison-table.md#focus-visible-appearance-none--interaction-polish); it is used extensively here but not re-taught.

## CSS techniques introduced

Every technique in the table below is introduced here for the first time in the design track; tutorials 05 and later may reference these concepts by name without re-explaining the underlying mechanics.

| Technique | `styles.css` anchor | Section |
|---|---|---|
| `container-type: inline-size` | `styles.css:93` | [§ Container queries — the widget queries its own width](#container-queries--the-widget-queries-its-own-width) |
| `@container (min-width: …)` size query | `styles.css:1637, 1925` | [§ Container queries — the widget queries its own width](#container-queries--the-widget-queries-its-own-width) |
| `min()` nested inside `minmax()` as overflow-safe floor | `styles.css:570, 2085` | [§ Container queries — the widget queries its own width](#container-queries--the-widget-queries-its-own-width) |
| `overflow: clip` (clips without creating scroll container) | `styles.css:92, 545` | [§ `overflow: clip` vs `overflow: hidden`](#overflow-clip-vs-overflow-hidden) |
| `position: sticky` (threshold + scroll-container dependency) | `styles.css:180, 1350, 1648, 1730` | [§ `position: sticky` and the scroll-container dependency](#position-sticky-and-the-scroll-container-dependency) |
| `<details>` / `<summary>` native disclosure widget | `styles.css:445–477, 1025–1031` | [§ Styling native `<details>`/`<summary>` and attribute selectors](#styling-native-detailssummary-and-attribute-selectors) |
| `list-style: none` on `<summary>` to remove marker | `styles.css:457` | [§ Styling native `<details>`/`<summary>` and attribute selectors](#styling-native-detailssummary-and-attribute-selectors) |
| `::-webkit-details-marker { display: none }` | `styles.css:466` | [§ Styling native `<details>`/`<summary>` and attribute selectors](#styling-native-detailssummary-and-attribute-selectors) |
| Attribute selector `[attr]` boolean-presence form | `styles.css:475` | [§ Styling native `<details>`/`<summary>` and attribute selectors](#styling-native-detailssummary-and-attribute-selectors) |
| `details[open]` compound selector specificity `(0,1,1)` | `styles.css:475` | [§ Styling native `<details>`/`<summary>` and attribute selectors](#styling-native-detailssummary-and-attribute-selectors) |
| `var()` fallback second argument | `styles.css:341, 524, 583, 1334, 1416, 1650, 1809` | [§ Custom properties as a JS→CSS styling API](#custom-properties-as-a-jscss-styling-api) |
| `hsl()` color model | `styles.css:341` | [§ Custom properties as a JS→CSS styling API](#custom-properties-as-a-jscss-styling-api) |
| `-webkit-line-clamp` / `-webkit-box` multi-line truncation | `styles.css:1860–1862`, `DayTimeGrid.tsx:100` | [§ Multi-line truncation with line-clamp](#multi-line-truncation-with-line-clamp) |
| `scrollbar-width: none` | `styles.css:131` | [§ Scrollbar hiding](#scrollbar-hiding) |
| `::-webkit-scrollbar { display: none }` | `styles.css:134` | [§ Scrollbar hiding](#scrollbar-hiding) |
