# Designing the Japanese Verb Tower

The Japanese Verb Tower is an interactive conjugation explorer: pick a verb, toggle morphology layers (tense, politeness, voice, aspect), and a vertical stack of slabs builds in real time — the fully assembled form floating at the top in 40 px kanji with furigana and rōmaji beneath. A live demo is at https://japanese-verb-tower.widgets.beshir.org. This is entry 03 of the `design/` track and assumes the techniques introduced in [01](./01-function-plotter.md) and [02](./02-image-comparison-table.md); every CSS technique introduced here is listed in the closing ledger and may be referenced by name in later tutorials without re-explanation. The JavaScript half — the conjugation engine, morpheme hooks, async translation, URL state, and iframe height signalling — is covered in the sibling [`../frontend/03-japanese-verb-tower.md`](../frontend/03-japanese-verb-tower.md).

## The look

In visual terms the widget is a calm card in the same slate-and-blue house style as tutorials 01 and 02. The tower itself reads as a single rounded panel of stacked slabs joined by a gradient spine along the left edge: base form at the bottom in understated grey, each intermediate layer adding a slab with the newly contributed morpheme highlighted in amber, and the fully assembled form floating at the top in large type — 40 px kanji with furigana above and rōmaji below — against a pale-blue tint that lifts it clear of the stack. A thin hairline separates each slab; `overflow: hidden` keeps the corners crisp. The controls panel to the left stays unobtrusive: native checkboxes and radio buttons, branded with a single `accent-color` property, and a verb search bar with dotted-underline tooltip signals on auxiliary labels that need more explanation. Light and dark themes follow from a token swap in `:root`.

The seven sections that follow trace every CSS decision from the token layer down to the responsive breakpoints.

## How the styles are organised

`styles.css` opens with the structure [01](./01-function-plotter.md) established: design tokens on `:root`, a universal `box-sizing` reset, and element base rules — tokens before consumers so the cascade resolves in the right direction. This widget extends that pattern with four new token families and adds something the Latin stack in tutorial 01 could not handle: Japanese glyphs.

### Theming additions

The custom-property / `:root` / `var()` mechanics and the `@media (prefers-color-scheme: dark)` token-override pattern are covered in [01 §"Theming with custom properties"](./01-function-plotter.md#theming-with-custom-properties); tutorial 02 applied the same structure to a second widget in [02 §"The look"](./02-image-comparison-table.md#the-look). Tutorial 03 adds four new families and leaves the established tokens unchanged.

New light-mode families (styles.css:16–24):

```css
/* styles.css:16–24 */
  --tier-bg:          #ffffff;
  --tier-border:      #e2e8f0;
  --tier-top-bg:      #eff6ff;
  --tier-top-border:  #60a5fa;
  --tier-base-bg:     #f8fafc;
  --hl-bg:            #fef08a;
  --hl-fg:            #78350f;
  --hl-border:        #fcd34d;
  --conn-color:       #93c5fd;
```

`--tier-*` colours the conjugation slabs: neutral white for the default tier, a pale-blue tint for the top (fully conjugated) tier, and an off-white for the base verb; `--tier-border` gives the hairline between them. `--hl-*` defines the amber morpheme highlight — the mark that shows exactly which suffix each layer contributes. `--conn-color` drives the gradient spine running down the tower's left edge. `--fieldset-border` (line 29) subtly frames the voice radio group.

The dark block re-declares the same names with adjusted values (styles.css:47–55):

```css
/* styles.css:47–55 */
    --tier-bg:          #1a2738;
    --tier-border:      #253447;
    --tier-top-bg:      #1a3252;
    --tier-top-border:  #3b82f6;
    --tier-base-bg:     #141f2d;
    --hl-bg:            #92400e;
    --hl-fg:            #fef3c7;
    --hl-border:        #b45309;
    --conn-color:       #2d5ca8;
```

Same `:root` selector, same `@media (prefers-color-scheme: dark)` gate, same source-order win — all as in [01](./01-function-plotter.md). No component rule changes; every `var()` consumer re-resolves automatically when the OS theme switches.

### The `.jp` CJK font stack

The `body` rule (styles.css:69–70) sets a Latin system sans-serif stack. That covers the widget's UI chrome — labels, buttons, romaji — but contains no Japanese glyphs. Any element showing kanji or kana needs a separate rule.

```css
/* styles.css:78–82 */
/* Japanese text — system JP stack for proper glyph rendering */
.jp {
  font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP",
               "Yu Gothic", Meiryo, "MS PGothic", sans-serif;
}
```

**Why a Latin stack fails for CJK.** When the browser encounters a character not covered by the current font, it walks down the stack looking for a font that has the glyph. Without an explicit Japanese font early in the list, that search reaches the generic `sans-serif` — and the OS's CJK fallback may be a Simplified Chinese or Korean font. The same Unicode codepoint maps to subtly different canonical glyph shapes across Japanese (JIS), Simplified Chinese (GB), and Korean (KS) standards. Kanji rendered in a Chinese or Korean variant looks wrong to Japanese readers even when the character is technically present.

**The fallback chain.** The stack is ordered to serve the best available font on each platform and degrades gracefully toward older fonts:

| Family | Platform |
|---|---|
| `"Hiragino Kaku Gothic ProN"`, `"Hiragino Sans"` | macOS, iOS — Apple's primary Japanese sans-serif; "ProN" = updated JIS standard; `"Hiragino Sans"` covers newer Apple naming |
| `"Noto Sans JP"` | Android, Linux, cross-platform — Google's "no-tofu" family with complete Unicode coverage; may also be cached from Google Fonts |
| `"Yu Gothic"` | Windows 8.1+ — Microsoft's modern Japanese font |
| `Meiryo` | Windows Vista+ — Microsoft's previous primary Japanese UI font |
| `"MS PGothic"` | Windows XP+ — oldest widely available Windows Japanese font; acceptable last resort |
| `sans-serif` | Universal — lets the OS pick any available sans-serif with Japanese coverage |

A macOS user matches on Hiragino and never sees Meiryo; a Windows 8.1+ user gets Yu Gothic. Modern, high-quality fonts come first; the list degrades without serving a worse font to a platform that has a better one.

**`lang="ja"` and OpenType `locl`.** The widget sets `lang="ja"` on its HTML root element. This is a separate mechanism from the font stack. Even when a single font file contains multiple regional glyph variants of the same codepoint — as large Unicode fonts like Noto do — the font engine needs a signal to know which variant to render. The `lang` attribute provides that signal; the browser passes it to the font engine, which activates the OpenType `locl` (localisation) feature and selects Japanese-standard glyph shapes. The two mechanisms are independent: the font stack puts a Japanese-capable font in the pipeline; `lang="ja"` tells that font which glyphs to use.

**System fonts only.** There is no `@font-face` declaration — no CDN request, no load penalty. Rendering quality is OS-dependent and exact glyph appearance varies by device, the same trade-off tutorial 01's Latin stack made.

With the design token layer and CJK font stack in place, the top tier's kanji display can use both — and adds a new HTML mechanism for phonetic annotation above the characters.

## Furigana with `<ruby>`

Japanese kanji carry pronunciation ambiguity: a reader may know 飲む but be uncertain how a new compound reads. Furigana — small hiragana placed above the kanji — resolves that ambiguity. The HTML mechanism for it is the `<ruby>` element pair: `<ruby>` wraps base text and annotation together as a semantic unit; `<rt>` (ruby text) holds the phonetic reading. The widget does not use `<rp>` (the parenthesis fallback for browsers without ruby support), because every evergreen engine has supported ruby layout for years — basic `<ruby>`/`<rt>` is Baseline Widely Available.

The widget's markup places only the annotated kanji inside `<ruby>`, letting the remaining kana follow outside as plain text:

```tsx
{/* App.tsx:123 */}
<ruby>{kanjiPrefix}<rt>{rubyText}</rt></ruby>
```

In a real render `kanjiPrefix` might be 飲 and `rubyText` の, with the rest of the conjugation — ませる — following as plain text in the same span: `<ruby>飲<rt>の</rt></ruby>ませる`. Keeping plain kana outside the `<ruby>` element is correct; annotation belongs only to the base characters it glosses.

### Furigana is conditional, not universal

This markup appears only on the top tier and only when the verb has an identifiable kanji prefix. The guard at the top of `renderTopKanji` handles all cases where annotation is inappropriate:

```tsx
// App.tsx:114–115
if (!kanjiPrefix || prefixLen === 0 || !kanji.startsWith(kanjiPrefix) || hl[0] < kanjiPrefix.length) {
  return <span class="tier-kanji jp">{renderHighlighted(kanji, hl)}</span>;
}
```

No kanji prefix, a zero-length prefix, a kanji string that does not begin with the prefix, or a highlight range that reaches into the prefix — any of these routes around the `<ruby>` construction entirely. The CSS rules that follow are therefore scoped to genuine ruby markup, not defensive overrides against hypothetical edge cases.

### Placement: the widget declares no `ruby-position`

The CSS initial value for annotation placement is `over`, which positions `<rt>` above the base text in horizontal writing mode — the correct and conventional position for Japanese furigana. `ruby-position` is **absent from `styles.css`**; the widget relies entirely on that initial value. The omission is not an oversight: `over` is exactly what is needed, and writing `ruby-position: over` explicitly would be redundant without being wrong.

### `ruby-align: center`

With placement settled by the default, `ruby-align` controls how the annotation distributes itself horizontally when it is narrower or wider than the base character. The widget sets:

```css
/* styles.css:497–499 */
.tier--top .tier-kanji ruby {
  ruby-align: center;
}
```

The four specified values:

| Value | Effect |
|---|---|
| `start` | Annotation aligned to the start edge of the base |
| `center` | Annotation centred over the base |
| `space-between` | Annotation justified to the full width of the base |
| `space-around` | Like `space-between` but with half-width spacing at edges |

`center` is the natural choice for furigana: a single-mora reading like の centres cleanly above 飲 regardless of their relative widths, and multi-mora readings look balanced over multi-kanji bases.

**Baseline note.** `ruby-align` has a split history. Firefox has supported it since Firefox 38 (2015) and Safari since the early WebKit era. Chromium did not ship a conformant implementation until **Chrome 128 (August 2024)**, making `ruby-align` **Baseline Newly Available** from that point. The 30-month Widely Available threshold falls approximately **February 2027** — as of mid-2026 it works in every current browser, but is not yet the long-established tier that needs no qualification. In practice only pre-Chrome-128 installs would miss it, and alignment falls back gracefully to the browser's default (typically start or center) rather than breaking layout.

The selector `.tier--top .tier-kanji ruby` limits this rule to the top-tier kanji cell. Its specificity is (0,2,1) — two classes (`.tier--top`, `.tier-kanji`) plus the `ruby` type selector — which is sufficient to override any alignment inherited from a lower-specificity context.

### Em-relative `<rt>` sizing

```css
/* styles.css:501–508 */
.tier--top .tier-kanji ruby rt {
  font-size: 0.38em;
  font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP",
               "Yu Gothic", Meiryo, "MS PGothic", sans-serif;
  color: var(--muted);
  text-align: center;
  letter-spacing: 0.04em;
}
```

`font-size: 0.38em` on `rt` resolves against the inherited font size on the `<ruby>` element. In the top tier, `.tier--top .tier-kanji` carries a 40 px font size (established by the modifier rules covered in [§ Slab hierarchy and the morpheme highlight](#slab-hierarchy-and-the-morpheme-highlight)). So `0.38 × 40 = 15.2 px` — roughly one-third the kanji size, which is the conventional furigana-to-kanji proportion in Japanese print and digital typography.

The `em` unit is what makes this work at any scale. If the parent font size changes — through the responsive step-downs at narrow viewports (covered in [§ States, accessibility, and responsive behaviour](#states-accessibility-and-responsive-behaviour)), browser zoom, or a user font-size preference — the furigana tracks it automatically without a separate override. A `px` value would lock the annotation to an absolute size, breaking its proportional relationship to the kanji as soon as any scaling applies.

The `font-family` declaration reuses the same Hiragino → Noto → Yu Gothic → Meiryo → MS PGothic system stack as the `.jp` class (styles.css:78–82) — see [§ The `.jp` CJK font stack](#the-jp-cjk-font-stack) for the platform fallback rationale and glyph-variant considerations. The `rt` rule repeats the values inline rather than inheriting from `.jp` because `rt` is a browser-generated element that does not receive JSX class attributes.

### Accessibility

Screen-reader announcement of `<ruby>` is inconsistent across AT/browser pairs — some read base text and annotation as a combined string, others insert a pause, and some flatten the annotation inline. The phonetic content in `<rt>` generally reaches users of assistive technology in some form, but no standardised announcement pattern exists.

With the top tier's annotation in place, the next step is the container that holds all the slabs together as a single cohesive column.

## The tower shell

The tower presents as a single rounded rectangle despite being built from two to four independent slab elements. What makes it coherent is a cluster of properties on `.tower` that work as a system: a flex column whose gaps become visible dividers, `overflow: hidden` that clips children to the container's curves, and a pseudo-element rail that spans the full height as a decorative gradient stripe. Three new CSS techniques make it land; two borrow infrastructure already taught.

### The gap-as-hairline idiom

```css
/* styles.css:287–301 */
/*
  Tiers share one outer border/rounded-rect container; a 1px gap between them
  (whose color is var(--tier-border)) reads as a hairline separator.
  A left accent border on each slab is the "spine" connecting them visually.
*/
.tower {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--tier-border);   /* hairline separators between slabs */
  border: 1px solid var(--tier-border);
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}
```

`display: flex`, `flex-direction: column`, and `gap` are covered in [01 §"Layout and the card"](./01-function-plotter.md#layout-and-the-card); `position: relative` in [02 §"Positioning & Stacking Contexts"](./02-image-comparison-table.md#positioning--stacking-contexts). What is new here is using `gap: 1px` together with a solid container background as a divider mechanism.

The trick depends on each `.tier-body` carrying an **opaque** background:

```css
/* styles.css:320–327 */
.tier-body {
  background: var(--tier-bg);
  border-left: 4px solid var(--conn-color);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

Because `.tier-body` completely covers the container behind it, the 1 px gap between flex items is the only place `.tower`'s `background: var(--tier-border)` peeks through — and it reads as a hairline rule.

Compare the conventional alternative: add `border-bottom: 1px solid var(--tier-border)` to every `.tier-body`, then suppress the trailing line with `.tier-body:last-child { border-bottom: none }`. The gap idiom needs neither rule. The divider color lives in exactly one declaration (the container `background`), there is no `:last-child` exception to maintain, and no separator can appear above the first slab or below the last — the container border handles those edges by definition.

### `overflow: hidden` — corner clipping and the BFC it creates

`border-radius: 10px` rounds the container's *outer* shape. Without `overflow: hidden`, child elements are still rectangles; their backgrounds bleed through the curved corners, making the stack look square at the edges despite the rounded border. `overflow: hidden` clips all descendant painting to the container's padding box, which is shaped by `border-radius`. The top corners of the first slab and the bottom corners of the last are cut flush with the 10 px curve — the rounded shape the eye expects becomes the shape it actually gets.

A side effect worth knowing: setting `overflow` to any value other than `visible` establishes a new **block formatting context (BFC)**, which affects float containment and margin collapsing between the container and its children. Neither matters in a flex layout, but the BFC is good to recognize whenever you reach for `overflow: hidden` on other containers.

### The gradient rail

A 2 px vertical stripe runs the full height of the tower, fading from the connection color at the base upward to the accent blue of the top tier:

```css
/* styles.css:304–314 */
.tower::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: linear-gradient(to top, var(--conn-color), var(--tier-top-border));
  z-index: 1;
  pointer-events: none;
}
```

The `::before` setup — `content: ''` with `position: absolute` inside the `position: relative` parent — is taught in [02 §"Pseudo-element Content"](./02-image-comparison-table.md#pseudo-element-content) and [02 §"Positioning & Stacking Contexts"](./02-image-comparison-table.md#positioning--stacking-contexts). What is new is the `linear-gradient()` value assigned to `background`.

**`linear-gradient()` is a `<image>`, not a `<color>`.** That distinction decides where it can legally appear. A gradient is valid for any property whose value type includes `<image>`: `background`, `background-image`, `mask-image`, `border-image`. It is *not* valid for `color`, `border-color`, `outline-color`, or `box-shadow` color — all of which expect a `<color>` type. Assigning a gradient to `background` is shorthand for `background-image`; the `background-color` layer sits underneath it and is separate.

The syntax is `linear-gradient(<direction>, <stop-1>, <stop-2>, …)`. The direction `to top` means the gradient flows from the first color stop at the **bottom** edge to the last stop at the **top** edge — equivalent to the CSS angle `0deg` (where 0° points upward), but more legible when the intent is directional. Here, `var(--conn-color)` anchors at the base and `var(--tier-top-border)` at the top: a fade that ties every slab to the same visual column without needing an explicit connection element.

Color stops are custom properties. Custom properties resolve at used-value time; as long as each token holds a valid `<color>`, the gradient computes normally. If a token were undefined, the entire `background` declaration would be invalid and fall back to transparent — there is no partial fallback inside `linear-gradient()`.

### Corner radii via structural pseudo-classes

The outer container provides a 10 px radius. The inner slab bodies need to match on the outside edges and stay square on the shared edges between slabs:

```css
/* styles.css:329–332 */
/* Outer corners follow the tower's border-radius */
.tier:first-child .tier-body { border-radius: 9px 9px 0 0; }
.tier:last-child  .tier-body { border-radius: 0 0 9px 9px; }
.tier:only-child  .tier-body { border-radius: 9px; }
```

`:first-child`, `:last-child`, and `:only-child` are **structural pseudo-classes** that match based on DOM position among siblings:

- `:first-child` — the element is the first child of its parent.
- `:last-child` — the element is the last child of its parent.
- `:only-child` — the element has no siblings; it is both first and last at once.

The `border-radius` four-value shorthand follows the clockwise box-model order: **top-left / top-right / bottom-right / bottom-left**. So `9px 9px 0 0` rounds both top corners and squares both bottom corners; `0 0 9px 9px` does the inverse; a lone `9px` rounds all four corners equally. (The inner radius is 9 px rather than 10 px because the container's 1 px border consumes one pixel of depth, making the inner edge match the outer curve.)

Each compound selector — `.tier:first-child .tier-body`, `.tier:last-child .tier-body`, `.tier:only-child .tier-body` — carries two class weights (`.tier` and `.tier-body`) plus one pseudo-class weight (`:first-child` / `:last-child` / `:only-child`), all of which count in the same (B) column: **(0, 3, 0)** each. All three rules are equal in specificity.

For a multi-slab tower this causes no conflict: each `.tier-body` matches at most one of the three (it is either the first, the last, or a middle slab). For a **one-slab tower**, the single `.tier-body` satisfies all three simultaneously — it is the first, the last, and the only child. When specificity is equal, the cascade falls to **source order**: the rule that appears latest in the stylesheet wins. `:only-child` is declared last (line 332), so it prevails with `border-radius: 9px`, rounding all four corners. The result is a standalone slab that reads as a complete capsule rather than a clipped top or bottom half.

This is the same source-order tiebreaker introduced in [01 §"How the styles are organised"](./01-function-plotter.md#how-the-styles-are-organised). Structural pseudo-classes make the rule context-sensitive; source order resolves the tie when context collapses to a single element.

### The left spine

Each `.tier-body` carries `border-left: 4px solid var(--conn-color)` (styles.css:322), a 4 px stripe along the left edge in the connection color. Together with the gradient rail from `.tower::before`, it visually links all the slabs into one column. The modifier rules in the next section will override this spine for the top and base tiers specifically.

### A note on the opacity transition

```css
/* styles.css:316–318 */
.tier {
  transition: opacity 180ms ease;
}
```

This rule sits here in source order and is quoted for completeness. Its teaching — the `transition` shorthand, compositor-cheap properties, and reduced-motion suppression — belongs in [§ Motion: transitions, not keyframes](#motion-transitions-not-keyframes).

The shell establishes the outer shape; the next section looks inside it at how three size variants and an inline highlight bring each slab to life.

## Slab hierarchy and the morpheme highlight

### The slab hierarchy: two modifiers, three sizes

The tower needs three visually distinct weights: a large **top tier** for the final assembled form, a medium intermediate size for each conjugation step, and a small **base tier** for the root. Three sizes, one shared shell — the solution is a two-modifier pattern: add `.tier--top` or `.tier--base` to the `.tier` element and let descendant selectors do the rest.

The modifier first overrides the tier body's background and padding:

```css
/* styles.css:335–340 */
.tier--top .tier-body {
  background: var(--tier-top-bg);
  border-left-color: var(--tier-top-border);
  border-left-width: 5px;
  padding: 18px 18px 14px;
}

/* styles.css:343–346 */
.tier--base .tier-body {
  background: var(--tier-base-bg);
  padding: 8px 14px;
}
```

The top tier widens its left spine to 5px and claims the most breathing room; the base tier tightens its padding and adopts a subtler background token. Intermediate tiers carry neither modifier and fall through to the `.tier-body` defaults from [§ The tower shell](#the-tower-shell).

The same pattern then cascades into every text element. Kanji is the clearest illustration:

```css
/* styles.css:357–362 */
.tier-kanji {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.01em;
}

/* styles.css:364–368 */
.tier--top .tier-kanji {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* styles.css:370–373 */
.tier--base .tier-kanji {
  font-size: 17px;
  font-weight: 500;
}
```

22px is the intermediate default. The top modifier pushes it to 40px; the base modifier trims it to 17px. Kana follows the same three-step progression — 13 / 17 / 12px (styles.css:376–387) — and romaji does too — 12 / 14 / 11px (styles.css:390–403).

**How specificity makes this work.** The base rule `.tier-kanji` carries specificity **(0,1,0)** — one class. Each modifier rule, `.tier--top .tier-kanji` and `.tier--base .tier-kanji`, carries **(0,2,0)** — two classes. One extra class weight is enough to win unconditionally; no `!important`, no order dependency against the base rule. See [01 §"States and accessibility"](./01-function-plotter.md#states-and-accessibility) for the full (A,B,C) cascade mechanics.

**Where source order enters.** The two modifier overrides for the same element — say `.tier--top .tier-kana` and `.tier--base .tier-kana` — are also equal at **(0,2,0)**. They can only conflict on an element that carries both modifiers simultaneously, which never happens: `.tier--top` and `.tier--base` are mutually exclusive at the DOM level. Were they to collide, the later rule in source order would win — the same tiebreaker behind the `:only-child` win in [§ The tower shell](#the-tower-shell). The mechanics live in [01 §"States and accessibility"](./01-function-plotter.md#states-and-accessibility).

### Tracked-caps labels: `text-transform` and `letter-spacing`

Several small labels across the widget share a visual convention — uppercased, closely tracked text. Three sites in the stylesheet use it.

`.tier-label`, the inline badge on each slab's meta row:

```css
/* styles.css:408–418 */
.tier-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
  background: var(--label-bg);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}
```

`.slot-legend-title`, the header of the composition slot legend:

```css
/* styles.css:449–456 */
.slot-legend-title {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--muted);
  margin-bottom: 7px;
}
```

And `.type-badge` (styles.css:738–739) carries `letter-spacing: 0.06em; text-transform: uppercase;` with the same intent.

`text-transform: uppercase` converts glyphs to uppercase **at render time, without touching the DOM text**. The source value in the HTML stays in its original case, so copy-paste, screen readers, and search engines all receive the original casing. The conversion is also locale-sensitive: the browser applies the correct case-folding rules for the document's `lang` attribute — relevant for languages like Turkish, where lowercase `i` uppercases to `İ` (dotted), not `I`.

`letter-spacing` in `em` units tracks proportionally with font size, so the spacing ratio stays consistent whether a label is 9.5px or 10px. Uppercase glyphs sit closer optically than lowercase, so a small positive letter-spacing restores visual evenness — the conventional "tracked caps" treatment that signals a category label rather than readable prose.

### The `.hl` morpheme highlight

Each conjugation layer contributes a morpheme slice to the kanji and kana strings. The engine expresses that slice as a `[start, end]` character range and passes it to `renderHighlighted` (App.tsx:95–105), which wraps the slice in a semantics-free `<span class="hl">`:

```tsx
// App.tsx:95–105
function renderHighlighted(text: string, hl: [number, number]): JSX.Element {
  const [start, end] = hl;
  if (start === end) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <span class="hl">{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  );
}
```

The span appears in both the kanji display (App.tsx:751) and the kana display (App.tsx:758) inside each tier row. The CSS styles it to read like a `<mark>` — a background wash, contrasting foreground, a border to lift it from the surrounding text, and tight padding to hug the glyphs:

```css
/* styles.css:431–438 */
.hl {
  background: var(--hl-bg);
  color: var(--hl-fg);
  border-radius: 4px;
  padding: 1px 3px;
  border: 1px solid var(--hl-border);
  margin: 0 1px;
}
```

Using `<span>` rather than `<mark>` is deliberate. `<mark>` carries a semantic meaning — "highlighted for search relevance or reference context" — that does not fit "the morpheme this conjugation layer contributed." A neutral `<span>` with a class makes the intent clear without claiming false semantics. The visual result is identical; the distinction matters to screen readers that announce `<mark>` elements.

### `.type-badge`: a fixed radius, not a pill

Each tier row carries a type badge labelling its grammatical form — te-form, passive, and so on. The badge is composed in `App.tsx` and receives the form string as both content and a native `title` tooltip:

```tsx
// App.tsx:753–755
<span class="type-badge" title={`form type: ${tier.type}`}>
  {FORM_LABEL[tier.type]}
</span>
```

The CSS rule:

```css
/* styles.css:733–749 */
.type-badge {
  display: inline-flex;
  align-items: center;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 10px;
  border: 1px solid var(--tier-top-border);
  background: var(--tier-top-bg);
  color: var(--input-focus);
  white-space: nowrap;
  line-height: 1.5;
  cursor: default;
  flex-shrink: 0;
}
```

`border-radius: 10px` here is a **fixed radius**, not the infinite-radius pill technique. At the badge's rendered height (roughly 16–18px), a 10px radius rounds the corners deeply — close to capsule-shaped — but the value is tied to an absolute pixel size. If the element grew taller, the corners would no longer reach the vertical midpoint and the shape would open up. Compare [02's `border-radius: 999px` pill](./02-image-comparison-table.md#focus-visible--interaction-polish): that value is intentionally larger than any realistic element height, guaranteeing a true capsule regardless of content. For a badge with predictable, fixed-size text, 10px is safe and sufficient; a general-purpose pill button should reach for 999px.

The badge also carries `text-transform: uppercase` and `letter-spacing: 0.06em` — the tracked-caps pattern just introduced — and `cursor: default`, which resets the platform arrow cursor. That keyword signals "read-only content inside an interactive parent"; the full `cursor` vocabulary is covered in [§ Native controls and affordances](#native-controls-and-affordances).

With the tower's visual hierarchy settled, the section turns to the controls panel and the signal system that tells users what each element can do before they click.

## Native controls and affordances

Every interactive element in the widget sends a message to the pointer before anything is clicked — a cursor shape that announces intent, a text-selection barrier that resists misfire, a dotted underline that promises a tooltip. This section covers the CSS behind those signals, then zooms out to two structural patterns that hold the form controls together: the accessible radio group and a vendor workaround for a browser-injected button.

### Branding native controls with `accent-color`

Matching a checkbox or radio button to a design palette used to mean reaching for `appearance: none` and rebuilding the control entirely in CSS. The widget takes a cheaper path — one property, no markup change:

```css
/* styles.css:207–213 */
.toggle-row input[type="checkbox"] {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--input-focus);  /* line 211 */
  flex-shrink: 0;
}

/* styles.css:259–262 */
.radio-row input[type="radio"] {
  accent-color: var(--input-focus);  /* line 260 */
  cursor: pointer;
}
```

`accent-color` supplies a single color — here the design token `--input-focus` — and the browser applies it to the checked state of the control: the fill of a ticked checkbox, the ring and dot of a selected radio. The control shape, focus ring, keyboard behaviour, and ARIA semantics remain fully native.

That last point is the real reason to prefer this approach. Compare it with the `appearance: none` technique from [02 §":focus-visible & Interaction Polish"](./02-image-comparison-table.md#focus-visible--interaction-polish):

| | `accent-color` tint | `appearance:none` rebuild |
|---|---|---|
| Native a11y semantics | Preserved — browser handles role, focus, keyboard toggle | Must be re-implemented manually (`role`, `aria-checked`, `tabindex`, focus styles) |
| OS integration | Inherits system high-contrast and forced-colors modes automatically | Must handle each mode with separate media queries |
| Hit target | Native OS/UA size | Must set `width`/`height` explicitly |
| Visual control | Tint only — colour, not shape | Full control over shape, check mark, and animation |
| Implementation cost | One property | Significant CSS, possibly JS |

When native UX quality and accessibility are priorities and a colour tint is sufficient, `accent-color` is the right tool. **Baseline Widely Available** (Chrome 93 / Firefox 92 / Safari 15.4, September 2021–March 2022).

One caveat the spec cannot paper over: `accent-color` does not expose what mark color the browser chooses (white or black, based on luminance contrast against the accent). A very light or low-contrast accent value can produce an illegible check mark. Test visually — WCAG 2.1 SC 1.4.11 requires a 3:1 contrast ratio between the control boundary and adjacent color.

### The `cursor` vocabulary

The cursor shape is a one-word sentence to the pointer user. The widget deploys four values, each at a precisely chosen site:

```css
.toggle-row  { cursor: pointer; }    /* styles.css:202 — label is clickable */
.radio-row   { cursor: pointer; }    /* styles.css:255 — label is clickable */

.tier-label--aux { cursor: help; }   /* styles.css:670 — tooltip is waiting */

.type-badge  { cursor: default; }    /* styles.css:747 — badge is not interactive */

.layer-menu-item--disabled {
  opacity: 0.4;
  cursor: not-allowed;               /* styles.css:888 — action is prohibited */
}
```

`pointer` is the pointing hand — the universal "this is clickable" affordance, appropriate on any element that behaves like a link or button. `help` shows a question-mark cursor on most platforms; the convention is "hover here for more information." `default` resets to the platform arrow. The type badge sits inside the tower body — an area where inherited cursor shapes might otherwise make it look interactive — so `default` is a deliberate reset. `not-allowed` places a circle-with-slash over disabled menu items, communicating prohibition before the user commits to a click.

One important boundary: `cursor` is cosmetic only. It does not change whether an element receives pointer events. That requires `pointer-events` — covered in [02 §":focus-visible & Interaction Polish"](./02-image-comparison-table.md#focus-visible--interaction-polish).

### `user-select: none` — resisting accidental selection

Toggle rows and radio rows both carry `user-select: none` alongside `cursor: pointer`:

```css
/* styles.css:198–205 */
.toggle-row {
  cursor: pointer;
  user-select: none;   /* line 203 */
}

/* styles.css:250–257 */
.radio-row {
  cursor: pointer;
  user-select: none;   /* line 256 */
}
```

Rapid clicking on a label would otherwise drag-select its text, producing an unsightly blue highlight that has nothing to do with the control's state. `user-select: none` suppresses that selection without hiding the content: the DOM text stays in the accessibility tree, so screen readers are unaffected.

### Dotted underline — signalling a title tooltip

The `.tier-aux` element shows the Japanese auxiliary verb name inside a slab label. When a tooltip is attached to the enclosing `.tier-label--aux`, the widget applies a visual convention borrowed from the `<abbr>` element:

```css
/* styles.css:669–671 */
.tier-label--aux {
  cursor: help;   /* line 670 */
}

/* styles.css:674–679 */
.tier-aux {
  font-family: /* JP stack */;
  text-decoration: underline dotted;   /* line 677 */
  text-underline-offset: 2px;          /* line 678 */
}
```

`text-decoration: underline dotted` is a shorthand that sets two sub-properties simultaneously: `text-decoration-line: underline` (draw a line beneath the text baseline) and `text-decoration-style: dotted`. The dotted style is the established visual convention for "this text has a title attribute or similar annotation." Together with `cursor: help` on the parent, the pair forms a coherent pointer-user signal.

`text-underline-offset` is **not** part of the `text-decoration` shorthand — it is an independent property and must be declared separately. The `2px` value pushes the line slightly below the baseline, preventing it from slicing through descenders (g, y, p) and giving the text room. Positive values increase the gap; negative values bring the line closer. **Baseline Widely Available** (Chrome 87 / Firefox 70 / Safari 14.1).

### The native `title` tooltip

The tooltip itself is browser-native. There is no `::after` pseudo-element and no `content: attr()` construct in this widget — the CSS solely signals that a tooltip is available. The tooltip is produced by the HTML `title` attribute:

```tsx
// App.tsx:768–773 — aux label with tooltip
<span
  class="tier-label tier-label--aux"
  title={AUX_TOOLTIP[tier.op] ?? opMeta?.tooltip ?? ''}
>
  {tier.label} · <span class="tier-aux jp">{tier.aux}</span>
</span>

// App.tsx:753 — type badge with tooltip
<span class="type-badge" title={`form type: ${tier.type}`}>
```

The browser reads the `title` attribute and renders a small tooltip box when the pointer rests over the element for long enough. CSS plays no part in that rendering — `cursor: help` and the dotted underline are anticipatory signals only, not the tooltip mechanism.

The native `title` tooltip has real limitations worth stating plainly:

- **No touch support.** It does not appear on touchscreen devices.
- **Inconsistent screen-reader exposure.** Some screen reader / browser pairs announce it; others do not. It cannot be relied upon as an accessible label.
- **Not keyboard-discoverable** in most browsers — focus alone does not show the tooltip.

This makes it appropriate only for supplementary, non-critical information aimed at pointer users. It is **not** a pure-CSS tooltip pattern; that construction — a `::after` pseudo-element with `content: attr(data-tooltip)` and `position: absolute` — does not exist in this widget.

### `fieldset` and `legend` — the accessible radio group

The Voice section of the controls panel uses a native `<fieldset>`:

```tsx
// App.tsx:595–617
<fieldset class="voice-group">
  <legend>Voice <span class="morph-tag">one slot — always innermost</span></legend>
  {(['none', 'passive', 'potential'] as const).map((v) => (
    <label key={v} class="radio-row">
      <input type="radio" name="voice" value={v} ... />
      {/* option label */}
    </label>
  ))}
</fieldset>
```

Without a `<legend>`, a screen reader user focusing a radio button hears only the option label and its position: "Passive, radio button, 2 of 3." They have no context for what is being selected. With `<legend>Voice</legend>`, they hear the group label on entry into any radio in the set: "Voice — Passive, radio button, 2 of 3." That contextual announcement is the job of `<fieldset>` + `<legend>` and it cannot be replicated with `aria-label` alone as naturally. For a set of mutually exclusive radio buttons, this grouping is semantically essential.

The CSS adapts the browser's default fieldset rendering:

```css
/* styles.css:233–248 */
.voice-group {
  border: 1px solid var(--fieldset-border);
  border-radius: 8px;
  padding: 8px 12px 10px;
  margin: 2px 0;
}

.voice-group legend {
  font-size: 14px;
  font-weight: 500;
  padding: 0 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
```

`<fieldset>` has historically resisted use as a flex or grid container — margin collapsing and percentage-width computation behave oddly in some engines. This widget does not use the fieldset as a layout container; the CSS is cosmetic (border, radius, padding). The semantic grouping it provides is the point.

### `::-webkit-search-cancel-button` — a vendor workaround

Chrome and Safari inject a small clear button (✕) into `<input type="search">`. The widget hides it:

```css
/* styles.css:571 */
.search-input::-webkit-search-cancel-button { display: none; }
```

The `-webkit-` prefix is the signal: this is a vendor-specific pseudo-element, not part of any CSS specification. It works only in WebKit and Blink engines (Chrome, Safari, Edge). Firefox never implemented this pseudo-element and silently ignores the rule. There is no cross-browser CSS way to remove the native search clear button; this rule simply does nothing where it is unsupported.

The approach is acceptable as a cosmetic progressive enhancement — it removes an unwanted affordance in the engines that show it, fails silently elsewhere, and is scoped tightly to `.search-input` rather than applied globally. The lesson to carry forward: vendor-prefixed pseudo-elements are pragmatic workarounds, not standard CSS, and should be labelled as such rather than taught as portable technique.

With the controls established, the final ingredient is the motion layer that gives every state change a short visual transition.

## Motion: transitions, not keyframes

Every interactive element in this widget responds to its state changes with a short visual shift — a chip darkens on hover, the search field's border brightens on focus, the "add layer" button fills when the menu opens. None of these are scripted. CSS `transition` watches for the property change and handles the interpolation automatically.

### The `transition` shorthand

The shorthand packs four sub-properties into one declaration:

```
transition: <property> <duration> <timing-function> [<delay>]
```

- **`<property>`** — the CSS property to watch (`background`, `opacity`, `all`, etc.).
- **`<duration>`** — how long the interpolation runs (`120ms`, `0.5s`).
- **`<timing-function>`** — the speed curve: `ease` (fast out, slow in; the default), `linear`, `ease-in`, `ease-out`, `ease-in-out`, or `cubic-bezier(…)`.
- **`<delay>`** — optional wait before starting; defaults to `0s` and is usually omitted.

When a state change occurs — a `:hover` arrives, a class is toggled, `:focus` fires — the browser captures the property's before-value and after-value, then interpolates between them over the duration. When the triggering state is removed, the transition automatically reverses: no second rule, no `animation-direction`, no JavaScript.

**Multi-property comma list.** A single `transition` declaration can cover several properties at once, each as an independent comma-separated entry:

```css
/* styles.css:137–138 */
transition: background 120ms ease, border-color 120ms ease,
            color 120ms ease, box-shadow 120ms ease;
```

Each entry is independent — different properties can have different durations or curves — and all entries fire simultaneously on a state change. The widget applies this same pattern across its interactive elements, varying only which properties and how fast:

| Element | Transitions | Duration |
|---|---|---|
| `.verb-chip` (styles.css:137–138) | `background`, `border-color`, `color`, `box-shadow` | 120 ms |
| `.tier` (styles.css:317) | `opacity` | 180 ms |
| `.search-input` (styles.css:562) | `border-color`, `box-shadow` | 120 ms |
| `.search-result` (styles.css:615) | `background` | 80 ms |
| `.tier-remove` (styles.css:771) | `background`, `color`, `border-color` | 100 ms |
| `.add-layer-btn` (styles.css:813) | `background`, `border-color` | 100 ms |

The durations are tuned to interaction weight: quick background swaps at 80–100 ms, slightly longer for the chip's four-property shift at 120 ms, and the slowest at 180 ms for a tier's opacity fade.

### `transition` vs `@keyframes`

Both produce animation, but they address different problems:

| | `transition` | `@keyframes` / `animation` |
|---|---|---|
| **Trigger** | A CSS property value changes (hover, class toggle, focus) | Self-running when `animation` is applied |
| **Control points** | Two: the before-value and the after-value | Unlimited keyframe stops (`0%`, `50%`, `100%`, …) |
| **Reversal** | Automatic when the triggering state is removed | Requires `animation-direction: reverse` or a reverse keyframe block |
| **Typical use** | Hover effects, focus rings, state-change colour shifts | Looping spinners, entrance sequences, multi-step motion |

This widget uses **only `transition`** — there are no `@keyframes` declarations anywhere in the stylesheet. For the `@keyframes`-based entrance and loop animations used in tutorial 02, see [02 §"@keyframes & animation"](./02-image-comparison-table.md#keyframes--animation).

### What the tower actually animates

The `.tier` rule is precise:

```css
/* styles.css:316–318 */
.tier {
  transition: opacity 180ms ease;
}
```

`opacity` is the **only** property transitioned on `.tier`. That is the full extent of the tower's CSS motion.

The tower's grow-and-collapse behaviour — slabs appearing and disappearing as conjugation layers are added or removed — is not CSS animation. When the framework re-renders and a slab is removed from the DOM, there is no property to transition to; the element is simply gone. There is no `height`, `max-height`, `grid-template-rows`, or `display` transition. The visual restructuring is instantaneous, driven by React re-render. See [`../frontend/03-japanese-verb-tower.md`](../frontend/03-japanese-verb-tower.md) for the full account of how the component tree maps to the slab structure.

The opacity transition applies in the cases where a tier's `opacity` itself changes state — for example, a tier becoming visually inactive — not to DOM insertion or removal.

**Why `opacity` (and `transform`) are the right properties to animate.** Modern browsers split rendering work across two threads. The main thread handles style, layout, and paint; the compositor thread applies final layer transformations and alpha compositing. `opacity` and `transform` run entirely on the compositor: once a layer is painted, the compositor can change its alpha or matrix on every frame without touching the main thread or repainting pixels. This makes them smooth even when the main thread is busy. Properties that affect layout — `width`, `height`, `margin`, `padding`, `grid-template-rows` — trigger the full style → layout → paint → composite pipeline on every animation frame, which is significantly more expensive.

**What now exists for `height: auto` transitions.** Historically, transitioning to `height: auto` was impossible because `auto` is not a number and the browser cannot interpolate it. Two newer CSS features address this: `interpolate-size: allow-keywords` (Chrome 129+) enables `height: auto` as a transition endpoint, and `@starting-style` defines the starting state when an element first becomes visible, enabling from-display-none entry transitions. Neither is used in this widget; its slab visibility is managed entirely by the framework.

### `color-mix()` for a computed hover background

Rather than defining a fixed hover colour for `.add-layer-btn`, the stylesheet derives it at used-value time:

```css
/* styles.css:817–820 */
.add-layer-btn:hover, .add-layer-btn--open {
  background: color-mix(in srgb, var(--tier-top-bg) 60%, var(--tier-top-border));
  border-style: solid;
}
```

The `color-mix()` syntax:

```
color-mix(in <color-space>, <color1> [<percentage>], <color2> [<percentage>])
```

- **`in srgb`** — required; specifies the interpolation space. `srgb` is the conventional web color space (same as CSS named colors, hex, and `rgb()`), producing predictable results that match most designers' intuitions. Alternative spaces like `oklch` or `lab` can produce perceptually more uniform midpoints but behave less intuitively for adjacent hues.
- **`var(--tier-top-bg) 60%`** — 60% of the first color.
- **`var(--tier-top-border)`** — the second color takes the remainder: `100% − 60% = 40%`. (If both percentages are given and sum to less than 100%, the result becomes partially transparent.)

The two custom properties — `--tier-top-bg` and `--tier-top-border` — are substituted before `color-mix()` is evaluated. If either resolves to an invalid color, the entire `background` declaration is invalid and falls back; there is no partial fallback inside the function.

The practical result: the hover background is a 60/40 blend of the slab's background and border colours, automatically correct in both light and dark themes because the custom properties already carry the right values per mode.

**Baseline.** `color-mix()` shipped in Safari 16.2 (December 2022), Chrome 111 (March 2023), and Firefox 113 (May 2023). Its 30-month Widely Available threshold fell approximately November 2025; as of June 2026 it is **Baseline Widely Available**.

### Reduced motion: adding to the suppression list

[Tutorial 01 §"States and accessibility"](./01-function-plotter.md#states-and-accessibility) introduced the default-on/reduce-to-disable pattern: give elements transitions by default, then remove them under `@media (prefers-reduced-motion: reduce)`. Tutorial 03 applies that pattern to its own transitioned elements across two separate blocks:

**First block** — near the component's responsive rules (styles.css:511–516):

```css
/* styles.css:511–516 */
@media (prefers-reduced-motion: reduce) {
  .verb-chip,
  .tier,
  .search-input,
  .search-result { transition: none; }
}
```

**Second block** — at the end of the file, collocated with the later button and menu rules (styles.css:937–939):

```css
/* styles.css:937–939 */
@media (prefers-reduced-motion: reduce) {
  .add-layer-btn, .tier-remove, .layer-menu-item, .mode-btn { transition: none; }
}
```

Two blocks rather than one reflects stylesheet organisation: the first block sits alongside the elements it covers (verb chips, tier, search), the second alongside the elements defined later (buttons, menu items). The result is the same: every element that declares a `transition` is named in a reduced-motion block.

`transition: none` is sufficient here because the widget has no `@keyframes`. Tutorial 02 needed `animation: none !important` — a stronger declaration to override `animation` shorthand specificity — but `transition` and `animation` are independent properties. Suppressing `transition` has no effect on keyframe animations, and suppressing `animation` has no effect on transitions. Because there are no `@keyframes` in this stylesheet, the lighter `transition: none` covers everything. See [02 §"@keyframes & animation"](./02-image-comparison-table.md#keyframes--animation) for the `animation: none !important` counterpart.

With the transition system defined, the final section assembles the accessibility and responsive behaviours that make the widget usable across devices and input modes.

## States, accessibility, and responsive behaviour

### Focus ring on the search result list

The search-result dropdown is a keyboard-navigable list, and keyboard focus needs a visible ring. Here the widget uses `:focus-visible` with an inset `box-shadow` rather than `outline` — a pattern introduced in [02 §":focus-visible & Interaction Polish"](./02-image-comparison-table.md#focus-visible--interaction-polish):

```css
/* styles.css:627–631 */
.search-result:focus-visible {
  background: var(--tier-top-bg);
  outline: none;
  box-shadow: inset 0 0 0 2px var(--input-focus);
}
```

The reason for `inset` is specific to this context: the result list has `overflow: hidden` to clip its rounded corners (as established in [§ The tower shell](#the-tower-shell)). An `outline` drawn outside the box would be clipped by the parent's overflow boundary and disappear. An `inset box-shadow` sits *inside* the element's border edge, clear of the overflow clip, so the ring remains fully visible.

The `:hover` rule (styles.css:622–625) sets the identical `background: var(--tier-top-bg)` — the `:hover` / `:focus-visible` pairing from [02](./02-image-comparison-table.md#focus-visible--interaction-polish) that gives keyboard users the same affordance as pointer users, with no extra property to keep in sync.

### WCAG contrast across both themes

The token pairs `--fg` / `--bg` and `--input-focus` / `--input-focus-ring` are chosen to meet WCAG 1.4.3 (text contrast) and 1.4.11 (non-text UI component contrast) in light mode. The mechanics of picking those ratios are covered in [01 §"States and accessibility"](./01-function-plotter.md#states-and-accessibility).

What the dark override adds is a swap, not a recalculation. The dark `:root` block (styles.css:32–62) replaces the same token names with new values:

```css
/* styles.css:32–62 (excerpt) */
@media (prefers-color-scheme: dark) {
  :root {
    --fg:               #e2e8f0;   /* was #0f172a */
    --bg:               #0b1220;   /* was #f1f5f9 */
    --input-focus:      #60a5fa;   /* was #2563eb */
    --input-focus-ring: rgba(96,165,250,.3);
    /* … */
  }
}
```

Because every consumer of `--fg` and `--bg` uses `var()`, switching both poles of a contrast pair simultaneously maintains the ratio: a light foreground on a dark background still separates by the same margin as the original dark-on-light pair. The structural approach — token swap rather than per-element dark-mode overrides — is the [01](./01-function-plotter.md#states-and-accessibility) pattern applied here a second time.

### Reduced-motion coverage

Two `@media (prefers-reduced-motion: reduce)` blocks suppress every transition in the widget. The first (styles.css:511–516) covers `.verb-chip`, `.tier`, `.search-input`, and `.search-result`; the second (styles.css:937–939) covers `.add-layer-btn`, `.tier-remove`, `.layer-menu-item`, and `.mode-btn`. Together they account for all transitions declared in the stylesheet — no animated property is left unsuppressed. Full teaching of this pattern and why those two blocks are structured separately lives in [§ Motion: transitions, not keyframes](#motion-transitions-not-keyframes).

### Responsive layout: two columns to one

The base layout for the widget body is a two-column flex row established at styles.css:174–188:

```css
/* styles.css:174–188 */
.card-body {
  display: flex;
  gap: 28px;
  align-items: flex-start;
}

.card-controls {
  flex: 0 0 220px;
  min-width: 0;
}

.card-tower {
  flex: 1;
  min-width: 0;
}
```

The controls panel holds a fixed 220 px column; the tower takes the remaining space via `flex: 1`. The `display: flex`, `gap`, `flex: 0 0 <size>`, and `flex: 1` mechanics are all covered in [01 §"Layout and the card"](./01-function-plotter.md#layout-and-the-card).

At 600 px the layout collapses to a single column with one media query property override:

```css
/* styles.css:519–530 */
@media (max-width: 600px) {
  .card-body {
    flex-direction: column;
  }
  .card-controls {
    flex: none;
    width: 100%;
  }
  .tier--top .tier-kanji { font-size: 32px; }
  .tier-kanji             { font-size: 20px; }
  .tier--base .tier-kanji { font-size: 16px; }
}
```

Setting `flex-direction: column` is the only structural change needed — the flex items already stack correctly because `flex: 1` on `.card-tower` expands to fill the column width. The controls panel gets `flex: none; width: 100%` to release its fixed 220 px constraint and span the full width. Everything here is a direct application of `flex-direction` and `@media` from [01](./01-function-plotter.md#layout-and-the-card); nothing new is introduced.

The font-size step-downs in the same block — top-tier kanji from 40 px to 32 px, base tier from 17 px to 16 px — preserve legibility in the narrower column. A second step-down at 400 px takes the top kanji further to 26 px (styles.css:537):

```css
/* styles.css:532–538 */
@media (max-width: 400px) {
  .card { padding: 16px 14px 20px; }
  .verb-picker { gap: 4px; }
  .verb-chip   { min-width: 52px; padding: 5px 7px; }
  .verb-chip-kanji { font-size: 17px; }
  .tier--top .tier-kanji { font-size: 26px; }
}
```

These are plain `font-size` + `@media` — tools from [01](./01-function-plotter.md#layout-and-the-card) — applied as a legibility-preservation pattern: step the size down rather than letting the browser wrap or clip CJK glyphs at their original size on a narrow screen.

### Iframe height signalling

One interaction the CSS cannot handle is keeping the host page's `<iframe>` tall enough to fit the widget's content as it expands and contracts. That is handled in JavaScript: a `ResizeObserver` in App.tsx:253–262 watches the container element and posts `{ type: 'widget-size', height: el.scrollHeight }` to the parent frame whenever the height changes. The full explanation is in the [frontend tutorial](../frontend/03-japanese-verb-tower.md); there is no CSS involved.

With the accessibility and responsive patterns accounted for, the closing ledger collects every new CSS technique introduced across all seven sections of this tutorial.

## CSS techniques introduced

Every technique in the table below is introduced here for the first time in the design track; tutorials 04 and later may reference these concepts by name without re-explaining the underlying mechanics.

| Technique | `styles.css` anchor | Section |
|---|---|---|
| CJK / Japanese font stack (`.jp` class) | `styles.css:78–82` | [§ How the styles are organised](#how-the-styles-are-organised) |
| `<ruby>` / `<rt>` HTML elements | `App.tsx:123` | [§ Furigana with `<ruby>`](#furigana-with-ruby) |
| Default ruby placement (`over`); no `ruby-position` declared | `App.tsx:107–127` | [§ Furigana with `<ruby>`](#furigana-with-ruby) |
| `ruby-align: center` | `styles.css:497–499` | [§ Furigana with `<ruby>`](#furigana-with-ruby) |
| Em-relative `<rt>` sizing (`font-size: 0.38em`) | `styles.css:501–508` | [§ Furigana with `<ruby>`](#furigana-with-ruby) |
| Gap-as-hairline idiom (`gap: 1px` + opaque children over container background) | `styles.css:287–301` | [§ The tower shell](#the-tower-shell) |
| `overflow: hidden` corner clipping | `styles.css:299` | [§ The tower shell](#the-tower-shell) |
| `linear-gradient(to top, …)` | `styles.css:304–314` | [§ The tower shell](#the-tower-shell) |
| `:first-child` / `:last-child` / `:only-child` structural pseudo-classes | `styles.css:329–332` | [§ The tower shell](#the-tower-shell) |
| `text-transform: uppercase` + `letter-spacing` on small labels | `styles.css:411–412, 452–453, 738–739` | [§ Slab hierarchy and the morpheme highlight](#slab-hierarchy-and-the-morpheme-highlight) |
| `transition` shorthand (single- and multi-property comma list) | `styles.css:137–138, 316–318, 562, 615, 771, 813` | [§ Motion: transitions, not keyframes](#motion-transitions-not-keyframes) |
| Transition vs `@keyframes` distinction | `styles.css:316–318` | [§ Motion: transitions, not keyframes](#motion-transitions-not-keyframes) |
| `color-mix(in srgb, …)` | `styles.css:817–820` | [§ Motion: transitions, not keyframes](#motion-transitions-not-keyframes) |
| `accent-color` | `styles.css:211, 260` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `cursor: pointer` | `styles.css:202, 255` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `cursor: help` | `styles.css:670` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `cursor: default` | `styles.css:747` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `cursor: not-allowed` | `styles.css:888` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `user-select: none` | `styles.css:203, 256` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `text-decoration: underline dotted` | `styles.css:677` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `text-underline-offset` | `styles.css:678` | [§ Native controls and affordances](#native-controls-and-affordances) |
| Native HTML `title` tooltip (not `::after`; CSS signals only) | `styles.css:670, 677–678` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `fieldset` / `legend` for radio group accessibility | `styles.css:233–248` | [§ Native controls and affordances](#native-controls-and-affordances) |
| `::-webkit-search-cancel-button` (vendor pseudo-element) | `styles.css:571` | [§ Native controls and affordances](#native-controls-and-affordances) |
