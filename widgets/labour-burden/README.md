# labour-burden

A horizontal stacked-bar comparison of the total economic burden — direct
tax, rent, and forced or unpaid labour service — borne by an ordinary
person across nine historical eras, expressed as an illustrative share of
their output or income. An optional toggle appends a modern UK reference
bar for comparison.

Built with **Preact core** + hand-authored SVG scaled with
[`d3-scale`](https://d3js.org/d3-scale) (`src/Chart.tsx`), not Observable
Plot: every bar segment needs to be an independently focusable, keyboard-
activatable control with a stable `data-testid`, and each bar needs a
custom uncertainty whisker overlay — both are easier to get right with
owned SVG than to retrofit onto a mark-based plotting library.

## Data and sourcing

All figures live in `src/data/dataset.json`, copied verbatim from the
research phase's `dataset.json` — no numbers or citations are edited in
this widget. Each bucket carries a `low`/`central`/`high` estimate and a
citation for each of its three segments, plus a bucket-level `caveat`
explaining why the figure is contested. `data.mode` is `static`
(`widget.json`); there is no runtime fetch.

Attributability is reachable from the chart in two interactions or fewer:

1. Every segment rect (or, for a zero-value segment, a small marker) is
   its own `role="button"` control. Hover or keyboard focus shows a
   tooltip with the segment's central estimate, range, and citation.
2. Click or `Enter`/`Space` opens a persistent `segment-detail` card with
   the full citation, the source note, and the bucket's caveat. It closes
   via a close button or `Esc`.

A bar's uncertainty is shown directly on the chart: a whisker spans from
the sum of each segment's `low` value to the sum of its `high` value,
centred on the summed `central` mark — so the reader sees the plausible
range for the total burden, not a falsely precise single number. A
collapsible "Methodology & sources" panel (`methodology-toggle` /
`methodology-panel`) holds the full methodology prose and the complete
source list (citation, what it's cited for, and its caveat) without
leaving the widget.

## Comparability caveats

The intro copy and methodology panel are explicit that cross-era
comparison is itself contested: "output" meant different things in a
subsistence agrarian economy than in a modern cash economy, corvée's
opportunity cost is hard to monetise, and labour-rent is counted only
under forced labour (never also under rent) to avoid double-counting.
The modern-UK reference bar, shown only when `toggle-modern` is switched
on, carries its own prominent caveat that its tax base and housing-cost
base are not strictly apples-to-apples with the historical estimates.

## Local development

```
cd widgets/labour-burden
npm install
npm run dev
```

## Build

```
npm run build
```

Output goes to `dist/`.

## Embed

```html
<iframe src="https://labour-burden.widgets.beshir.org" loading="lazy" style="width:100%;height:900px;border:0"></iframe>
```

The widget posts `{ type: "resize", height }` to its parent (via
`ResizeObserver`), so a host can auto-size the iframe to its content:

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'resize' && e.source === frame.contentWindow) {
    frame.style.height = e.data.height + 'px';
  }
});
```
