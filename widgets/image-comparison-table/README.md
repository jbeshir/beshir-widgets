# image-comparison-table

A generic, data-driven **image comparison table** widget built on **Preact core** + Vite. All images are bundled (`data.mode: static`); the widget renders fully offline.

A URL query parameter chooses which comparison table to render:

```
?table=<id>
```

If the param is missing or unknown, the default table (`ai-classic-motivational-pictures`) is used.

## What it renders

- A header row of column labels and one row per theme with the theme label down the left.
- Each cell is a **thumbnail**; clicking it opens a **lightbox** showing the full-size image with the model/theme caption. The lightbox closes on Esc, backdrop click, or the close button, and supports arrow-key navigation between images.
- Each row has a small **info marker (ⓘ)** next to its label that reveals the verbatim generation prompt for the row's modern-model columns.

It respects `prefers-color-scheme` for light/dark theming and `prefers-reduced-motion` for transitions, observes its container size with `ResizeObserver` so the grid is responsive, and emits the `#widget-ready` marker after first paint.

## Adding a new table

Drop the images into `public/img/{full,thumb}/` and append an entry to `TABLES` in `src/tables.ts` — no structural changes required.

## Local development

```
cd widgets/image-comparison-table
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
<iframe src="https://image-comparison-table.widgets.beshir.org" loading="lazy" style="width:100%;height:760px;border:0"></iframe>
```

Append `?table=<id>` to the `src` to pick a specific table.
