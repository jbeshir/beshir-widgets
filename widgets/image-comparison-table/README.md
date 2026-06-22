# image-comparison-table

A generic, data-driven **image comparison table** widget built on **Preact core** + Vite. All images are bundled (`data.mode: static`); the widget renders fully offline.

With no table specified the widget shows a **picker** of all available tables. A specific table is chosen by **either** a path segment **or** a query parameter:

```
/<id>          e.g. /imitating-classic-ai-art
?table=<id>    e.g. ?table=imitating-classic-ai-art
```

The query parameter takes precedence; if neither is present or the id is unknown, the picker is shown.

Available tables:

| id | What it shows |
|---|---|
| `ai-classic-motivational-pictures` | Classic early-AI posters vs the same briefs given to GPT-Image-2 and Imagen-4-Ultra. |
| `imitating-classic-ai-art` | The classic posters vs GPT-Image-2 / Imagen-4-Ultra **prompted to deliberately imitate the early-AI look** (garbled text and all). |
| `imitating-classic-ai-art-2` | As above with an **expanded prompt** — uncanny-valley figures and a misaligned decorative border that slices through the scene. |

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

Append `?table=<id>` (or use the `/<id>` path) on the `src` to pick a specific table.

The widget posts `{ type: "resize", height }` to its parent with its natural content
height, so a host can auto-size the iframe:

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'resize' && e.source === frame.contentWindow) {
    frame.style.height = e.data.height + 'px';
  }
});
```

If the host pins a fixed height instead, the table scales down to fit it.
