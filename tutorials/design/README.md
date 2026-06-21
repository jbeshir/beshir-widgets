# Design tutorials

CSS and UI-design walkthroughs of the beshir widgets — each tutorial ends with a "CSS techniques introduced" ledger so later entries build on earlier ones without repeating the fundamentals.

| # | Widget | CSS themes covered | Link |
|---|---|---|---|
| 01 | Function plotter | design tokens & `prefers-color-scheme` theming, the cascade & source order, centred card + layered `box-shadow`, flexbox input row, `:focus` ring & `.error` state, `prefers-reduced-motion`, responsive SVG | [01-function-plotter.md](./01-function-plotter.md) |
| 02 | Image comparison table | CSS Grid + `repeat(var(--cols))` & `display:contents`, compact-layout restructure, positioning/stacking & `z-index`, `clamp()`/`min()`/`calc()`, `@keyframes` & `animation`, `transform` & `transform-origin`, `backdrop-filter`/`aspect-ratio`/`object-fit`, pseudo-element `content`/`attr()`, `:focus-visible` & `appearance:none` | [02-image-comparison-table.md](./02-image-comparison-table.md) |
| 03 | Japanese verb tower | `<ruby>`/`<rt>` furigana & `ruby-align`, CJK font stack, gap-as-hairline slab stack & `overflow` corner-clipping, `linear-gradient` rail, structural pseudo-classes (`:first`/`:last`/`:only-child`), `accent-color` vs `appearance:none`, `cursor`/`title` tooltip affordances, `transition` vs `@keyframes`, `color-mix()` | [03-japanese-verb-tower.md](./03-japanese-verb-tower.md) |
