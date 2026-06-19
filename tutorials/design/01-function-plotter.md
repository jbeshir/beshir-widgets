# Designing the Function Plotter

The Function Plotter is a single-page widget that evaluates a typed mathematical expression and graphs it in real time. Try it live at https://function-plotter.widgets.beshir.org — the experience is deliberate restraint: one centred card, no navigation, nothing competing for attention. The JavaScript half — expression parsing, Observable Plot, the ResizeObserver that keeps the chart sharp as the window resizes — is covered in the sibling tutorial [../frontend/01-function-plotter.md](../frontend/01-function-plotter.md). This is the first entry in the `design/` track; every CSS technique introduced here is listed in §07 and may be referenced by name in later tutorials without re-explanation.

## The look

No navigation, no sidebar, no chrome. Just the instrument. That restraint is visible in the CSS before a single pixel is rendered: the token vocabulary tells you what to expect.

Open `styles.css` at the top and read the property names:

```css
/* styles.css:2–7 */
--bg: #f8fafc;
--card-bg: #ffffff;
--card-border: #e5e7eb;
--card-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06);
--fg: #0f172a;
--muted: #64748b;
```

These are Tailwind's slate family — `#f8fafc` is slate-50, `#0f172a` slate-900. Slate is a cool, blue-tinted grey that reads as professional rather than clinical. Every tone steps inward from the same hue family, so nothing competes for attention. The name `--muted` signals its own purpose: secondary text that recedes.

Scroll a few lines further and the two accent tokens appear:

```css
/* styles.css:10, 14 */
--input-focus: #2563eb;
--curve: #2563eb;
```

The same blue-600 colours the focus ring and the plotted curve. The accent blue `#2563eb` is reused for both `--input-focus` and `--curve`, tying the focus ring and the plotted curve to one hue.

The card is equally legible in markup (`.container > .card > header + input-row + plot`) and in CSS:

```css
/* styles.css:63–69 */
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  box-shadow: var(--card-shadow);
  padding: 20px 22px 22px;
}
```

The 12px radius softens the corners without tipping toward playful. The `--card-shadow` token holds two layers: a tight 2px contact shadow at 4% opacity and a wide 24px ambient shadow at 6% — both near-invisible on their own, together producing the impression that the card sits a few millimetres above the page. The generous padding (20–22px) lets the contents breathe. These three properties function as a unit: remove the radius and the card hardens; remove the shadow and it flattens; tighten the padding and it crowds. The calm feeling comes from all three working together, not from any one of them alone.

That design intent doesn't just live in property names — it's also encoded in the ordering of the stylesheet itself.

## How the styles are organised

`styles.css` is 158 lines, and its shape is not accidental. Reading top to bottom, you pass through five identifiable layers: design tokens, a universal reset and element base, card and component rules, interaction states, and a final media query. Each layer depends on the one above it already being defined, and that dependency is what makes the ordering load-bearing.

**Tokens first.** The file opens with a `:root` block that declares every custom property the widget uses — `--bg`, `--fg`, `--input-focus`, and so on (styles.css:1–17). These are declared before any `var()` consumer appears anywhere in the file. That matters because `var()` resolves at computed-value time: when the browser builds the computed style for `body`, it looks up `--bg` by walking up the DOM and finding the value on `:root`. The value must already exist in the cascade. If the token block sat below the component rules, the properties would still resolve correctly at runtime (inheritance doesn't care about source order in the same file), but the organisational intent would be lost and a reader would have to hunt backwards to understand where values come from. Keeping tokens first makes the stylesheet self-documenting.

**Reset and base next.** Immediately after the tokens, three lines establish a universal box-sizing rule:

```css
/* styles.css:39–41 */
*, *::before, *::after {
  box-sizing: border-box;
}
```

This resets the box model for every element before any component dimensions are declared, so padding and borders are always absorbed into stated widths. Then `body` picks up the first `var()` consumers (styles.css:50–51): `background: var(--bg); color: var(--fg);` — straightforward inheritance from the token block above.

**Components, then states.** The `.container` and `.card` rules follow (styles.css:57–69), and further down come the interaction state rules. When a user focuses the input, two selectors compete: `.input-row input:focus` at styles.css:123 and `.input-row input.error` at styles.css:128. Both have specificity (0,2,1) — a pseudo-class and a class each count equally. With no `@layer` in this file, the cascade falls back to source order after specificity ties: the later rule wins. The `.error` rule appears after `:focus`, so when an input is both focused and invalid, the error border colour takes precedence. That's a deliberate UX decision, expressed entirely through the order of declarations.

The same tiebreaker governs theming. The light `:root` at line 1 and the dark `:root` inside `@media (prefers-color-scheme: dark)` at line 20 share identical specificity (0,1,0). In dark mode the media query matches, making the second rule active, and source order hands it the win.

**Media queries last.** The reduced-motion block at styles.css:154–158 sets `transition: none` on the input. It overrides the transition declared at styles.css:120 — same selector, same specificity, later position wins. Placing motion accommodations at the end of the file means they defeat any earlier transition declarations automatically, with no specificity tricks required.

Source order here is architectural, not arbitrary. Each layer is positioned so the cascade resolves in exactly the right direction: tokens before consumers, resets before components, states and media queries after everything they need to override.

The token layer that opens the file merits a closer look at how custom properties actually work.

## Theming with custom properties

CSS custom properties look like ordinary declarations with one difference: the property name starts with `--`. Everything in the `--*` namespace is reserved for author-defined properties — the CSS specification guarantees no native property will ever claim that prefix.

```css
/* styles.css:1 */
:root {
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --card-border: #e5e7eb;
  --card-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06);
  --fg: #0f172a;
```

Those five lines define the palette for the entire widget. Anywhere a component needs a colour, it reaches for one of these names via `var()`:

```css
/* styles.css:50 */
background: var(--bg);
color: var(--fg);
```

The crucial detail is that custom properties are **inherited CSS properties**. They flow down the DOM tree exactly like `color` or `font-size`. When the browser evaluates `var(--fg)` on a deeply nested element, it walks the DOM upward from that element looking for the nearest ancestor where `--fg` is declared. Because the tokens are set on `:root` — the pseudo-class that matches `<html>`, the root of everything — every element in the document inherits them.

This is nothing like a Sass or Less variable. A preprocessor variable is resolved at compile time: `$fg: #0f172a` is textually substituted before any CSS reaches the browser, which then receives only the literal `color: #0f172a`. The variable is gone. A CSS custom property is alive — the browser re-evaluates `var(--fg)` per element, per computed-value pass. That laziness is what makes the theming mechanism work.

### How dark mode propagates for free

The dark-mode block re-declares the same property names with adjusted values:

```css
/* styles.css:19 */
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b1220;
    --card-bg: #111827;
    --card-border: #1f2937;
    --card-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.5);
    --fg: #e5e7eb;
```

Both blocks target `:root`, a pseudo-class with specificity (0,1,0) — equal in both cases. The cascade falls back to source order (as in §02): the dark block at line 19 appears after the light block at line 1, so when the media query matches, its values overwrite the light ones. When the media query doesn't match, the dark block is inert, and the earlier light values are unchallenged.

Media queries do not change specificity; they only gate whether a rule participates in the cascade at all. The moment the OS switches to dark mode, the browser re-evaluates the matched media queries, the dark `:root` block becomes active, and all fifteen custom properties on `:root` update simultaneously.

Now every `var()` consumer re-resolves — automatically, without any change to component rules. Consider the focus rule at `styles.css:123`: it names only tokens — `var(--input-focus)` for the border colour and `var(--input-focus-ring)` for the shadow spread — never raw values. In light mode `--input-focus` resolves to `#2563eb` (blue-600); in dark mode to `#60a5fa` (blue-400). The rule itself is untouched. Any new component that follows the same pattern inherits dark mode support at zero cost. The full focus-ring mechanics are covered in §05.

### Adjacent concepts this widget does not use

`color-scheme: light dark` (a CSS property also available as a `<meta>` tag) is a related but distinct mechanism: it instructs the browser to adapt UA-rendered elements — scrollbars, native form controls, `<select>` backgrounds — to match the user's preference. This widget themes purely through the `@media (prefers-color-scheme: dark)` token override. There is no `color-scheme` declaration, no JavaScript toggle, and no `.dark` class. The cascade handles it entirely.

With the colour system established, the next question is layout: how the card finds its centre and how the controls are arranged inside it.

## Layout and the card

### Centring the container

`margin: 0 auto` is the classic block-centring idiom: a block element with a fixed or capped width leaves leftover horizontal space, and distributing that space equally on both sides places the element in the middle of its containing block. The container pairs it with `max-width` to cap line length on wide viewports (`styles.css:57`):

```css
.container {
  max-width: 820px;
  margin: 0 auto;
  padding: 24px 16px;
```

`max-width: 820px` sets the ceiling so the content never stretches uncomfortably wide. `margin: 0 auto` does the centering. This works only for block-level layout — `.container` is a plain block element, which is exactly the condition `margin: auto` requires.

### The card and its shadow

`.card` (`styles.css:63`) draws the panel with a 1px border, 12px rounded corners, and a layered box-shadow:

```css
border: 1px solid var(--card-border);
border-radius: 12px;
box-shadow: var(--card-shadow);
```

CSS renders comma-separated shadows front to back — the first item in the list paints on top. The two-layer recipe (as in §01) serves a specific theme-aware purpose: the token value differs significantly between light and dark mode. Light mode (`styles.css:5`) and dark mode (`styles.css:24`) side by side:

```css
/* light */
--card-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06);

/* dark */
--card-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.5);
```

The dark override explains why the shadow is a token rather than a literal value on `.card`. Against `--card-bg: #111827`, a shadow in `rgba(15,23,42,…)` at 4–6% alpha is nearly invisible — the shadow colour is too close in lightness to the background to register. Dark mode raises the opacity to 40–50% and switches to pure black. Because `.card` only ever declares `box-shadow: var(--card-shadow)`, the component rule never changes; the `@media (prefers-color-scheme: dark)` block simply re-assigns the token.

### The flex input row

Flex is the right tool for placing a label and input on one line: it lays items on a single axis and handles vertical alignment in one property, with no float or positioning involved (`styles.css:95`):

```css
.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
```

`display: flex` makes the label and input flex items on a horizontal axis. `align-items: center` vertically centres them; the default `stretch` would expand both children to the full row height, misaligning any element that is naturally shorter than its sibling. `gap: 10px` places a gutter between items without the edge-case margin creates: a `margin-right` on the label would need a `:last-child` override to avoid trailing space at the row's end; `gap` simply skips the space before the first item and after the last.

The input needs two further declarations (`styles.css:110`):

```css
flex: 1;
min-width: 0;
```

`flex: 1` grows the input to fill all remaining horizontal space after the fixed-width label is measured. It carries a silent gotcha: flex items default to `min-width: auto`, which prevents them from shrinking below their intrinsic minimum content size. For a text input, that floor is set by the value text inside it — so on a narrow viewport, the input would overflow the container rather than compress. `min-width: 0` overrides that default, allowing the input to shrink freely and making `flex: 1` behave predictably at any width.

The `box-sizing: border-box` reset from §02 is what keeps this predictable at the card level too: the card's `padding: 20px 22px 22px` folds into its declared width rather than pushing outward, so the flex calculation inside never encounters unexpected overflow.

Layout settled, the remaining CSS work is behavioural: how the widget signals focus and error states, and what the stylesheet does for users who need reduced motion.

## States and accessibility

### The focus ring: why `outline: none` is safe here

The base input rule removes the browser's default focus indicator:

```css
/* styles.css:119 */
outline: none;
```

Stripping `outline` without replacement is an accessibility failure — keyboard users lose all ability to track where focus is. The reason it is safe here is that `input:focus` immediately provides a replacement:

```css
/* styles.css:123–126 */
.input-row input:focus {
  border-color: var(--input-focus);
  box-shadow: 0 0 0 3px var(--input-focus-ring);
}
```

The replacement uses `box-shadow`, not `outline`. `box-shadow` has always followed `border-radius`, so the ring wraps the rounded corners cleanly. A `0 0 0 3px` shadow (zero offset, zero blur, 3px spread) paints a solid halo flush against the border; the 3px band satisfies WCAG 2.4.11's area requirement and is clearly visible across colour themes.

**A note on `:focus` vs `:focus-visible`:** `:focus` fires on both keyboard navigation and mouse click, so clicking into the field also shows the ring. The modern best practice is `:focus-visible`, which suppresses the ring on pointer interaction. For a text input, however, `:focus` is defensible: a text field is almost always followed by typing regardless of how focus arrived, so the ring is informative rather than noisy. A deliberate trade-off, not an oversight.

### The cascade collision: focused and invalid at once

When a user has typed an invalid expression and the cursor is still in the field, the input carries both the `:focus` pseudo-class and the `.error` class simultaneously. Both rules compete for `border-color`:

```css
/* styles.css:128–130 */
.input-row input.error {
  border-color: var(--error-border);
}
```

To know which wins, compute specificity for each selector:

- `.input-row input:focus` — one class (`.input-row`), one pseudo-class (`:focus`), one element (`input`) → **(0,2,1)**
- `.input-row input.error` — one class (`.input-row`), one class (`.error`), one element (`input`) → **(0,2,1)**

They are equal in specificity, so the cascade falls back to source order (as in §02): `.input-row input.error` at line 128 appears after `.input-row input:focus` at line 123, so the error-red border takes precedence.

This is intentional UX: a wrong expression should stay visibly wrong even when the caret is inside the field. The focus box-shadow ring still renders — only `border-color` is in conflict. The user sees both the ring (they are focused) and the red border (their expression is invalid).

### Contrast and theming

The focus and error colours are all custom properties — `--input-focus` and `--input-focus-ring` (styles.css:10–11 light, styles.css:29–30 dark), and `--error-border` — so both the ring and the error border re-theme automatically. WCAG 1.4.11 requires 3:1 non-text contrast for focus rings and input borders; WCAG 1.4.3 requires 4.5:1 for text. FINDINGS §8 confirms AA throughout: light-mode fg/bg ~17:1, dark-mode fg/bg ~15:1, and the light-mode focus ring ~4.9:1 against the page background.

### Layout-stable error slot

The error message container pre-reserves vertical space:

```css
/* styles.css:135 */
  min-height: 18px;
```

Without this, the layout would shift downward each time "Invalid expression" appears and snap back when it clears. By holding the 18px slot open even when the message is empty, the input row stays anchored in place.

### Reduced motion

The input transitions its border and shadow on focus and blur:

```css
/* styles.css:120 */
transition: border-color 120ms ease, box-shadow 120ms ease;
```

For users who have enabled Reduce Motion in their OS, the stylesheet disables the transition:

```css
/* styles.css:154–158 */
@media (prefers-reduced-motion: reduce) {
  .input-row input {
    transition: none;
  }
}
```

This is the correct default-on pattern: transitions are on for everyone by default and suppressed only when the user has opted into reduced motion. The alternative — enabling them only when `prefers-reduced-motion: no-preference` matches — silently removes motion for every user who has never touched the setting. The transition is purely cosmetic (it signals state changes but carries no meaning), so dropping it is safe.

The final CSS concern is how the plot area scales as the viewport narrows.

## Responsive behaviour

The plot area is built from two nested block containers. `.plot-wrap` (styles.css:139–142) and `.plot-host` (styles.css:144–146) each carry `width: 100%`, which makes them stretch to fill the card's inner content box regardless of how wide the iframe happens to be. Because both elements are block-level by default, `width: 100%` is all that is needed — no flex or grid context required. The result is a fluid slot whose edges track the card's padding boundary as the viewport resizes.

The harder work happens on the SVG that Observable Plot drops inside `.plot-host`. An SVG element is, by default, an inline element with an intrinsic size baked into its `width` and `height` attributes at render time. Left unchecked, that produces two problems on narrow screens: the SVG overflows its container, and a few pixels of descender space accumulate below it (the same gap that appears below an `<img>` sitting on a text baseline). The following rule fixes both:

```css
/* styles.css:148–152 */
.plot-host svg {
  display: block;
  max-width: 100%;
  height: auto;
}
```

`display: block` (styles.css:149) is the baseline-gap fix. Inline elements are positioned relative to the surrounding text baseline, which reserves descender space below them even when no text is present. Promoting the SVG to block removes it from inline formatting entirely, closing that gap.

`max-width: 100%` (styles.css:150) is the overflow guard. It does not force the SVG to any particular width — it only sets a ceiling. If the SVG's intrinsic width is narrower than the container, it renders at its natural size; if it would overflow, this rule clamps it to the container's width. Using `max-width` rather than `width: 100%` here is deliberate: `width: 100%` would stretch a narrow SVG to fill a wide container, which is rarely desirable for a chart with fixed axis labels and margins.

`height: auto` (styles.css:151) lets the height scale in proportion to the width. Without it, the SVG keeps its intrinsic height while its width is clamped, producing a squashed or cropped chart.

**The CSS/JS boundary.** These three declarations make the SVG *display* correctly at any container width, but they cannot change the SVG's internal resolution. Observable Plot draws axis ticks, labels, and curve points at the pixel counts it was told to use when it first rendered. If the container shrinks significantly and the SVG is only visually scaled by CSS, those elements become misaligned or blurry. To solve this, App.tsx attaches a `ResizeObserver` to the container element and, whenever the measured width changes by more than two pixels, re-calls `Plot.plot({ width })` with the new pixel count — replacing the SVG entirely so it is drawn at the correct resolution from the start. CSS handles fit; JS handles fidelity. Neither half is sufficient on its own.

For a full walkthrough of the `ResizeObserver` setup and the Observable Plot render loop, see [../frontend/01-function-plotter.md](../frontend/01-function-plotter.md).

## CSS techniques introduced

Every technique in the table below is introduced here for the first time in the design track; tutorials 02 and later may reference these concepts by name without re-explaining the underlying mechanics.

| Technique | `styles.css` anchor | Section |
|---|---|---|
| CSS custom properties (`--name: value`) | lines 1–17 | §03 |
| `:root` as global token scope | line 1 | §03 |
| `var()` substitution | lines 48–55, 63–64 | §03 |
| Custom property inheritance (computed-value-time resolution) | lines 1–17, 48–55 | §03 |
| `@media (prefers-color-scheme: dark)` token override | lines 19–37 | §03 |
| Source-order tiebreaker at equal specificity | lines 1 vs 20 | §03 |
| `box-sizing: border-box` universal reset | lines 39–41 | §02 |
| System font stack (sans-serif) | lines 48–55 | §02 |
| System font stack (monospace) | lines 103, 112 | §04 |
| `max-width` + `margin: 0 auto` centering | lines 57–61 | §04 |
| `border-radius` | lines 66, 91, 118 | §04 |
| `box-shadow` comma list (layered elevation) | lines 5, 63–68 | §04 |
| `rgba()` low-alpha for subtle shadow | lines 5, 24 | §04 |
| `display: flex` | line 96 | §04 |
| `align-items: center` | line 97 | §04 |
| `gap` between flex items | line 98 | §04 |
| `flex: 1` (flex-grow shorthand) | line 110 | §04 |
| `min-width: 0` flex shrink fix | line 111 | §04 |
| `outline: none` with replacement focus indicator | line 119 | §05 |
| `:focus` pseudo-class | line 123 | §05 |
| `box-shadow` as focus ring (0 0 0 3px spread) | lines 123–126 | §05 |
| Specificity calculation (A,B,C) + source-order tiebreaker for states | lines 123–130 | §05 |
| `min-height` for layout-stable error slot | line 135 | §05 |
| `@media (prefers-reduced-motion: reduce)` | lines 154–158 | §05 |
| Default-enable / reduce-to-disable motion pattern | lines 120, 154–158 | §05 |
| WCAG 1.4.3 text contrast (4.5:1 / 7:1) | token pairs | §05 |
| WCAG 1.4.11 non-text contrast (3:1) for focus rings | token pairs | §05 |
| `width: 100%` fluid container | lines 139–146 | §06 |
| `display: block` on SVG (clears inline baseline gap) | line 149 | §06 |
| `max-width: 100%; height: auto` responsive SVG | lines 150–151 | §06 |
