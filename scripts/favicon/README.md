# Favicon helper

Reusable script that turns a widget's `public/favicon.svg` into the multi-size `public/favicon.ico`
the widget conventions require (16, 32 and 48 px).

- Renders the SVG's **light** variant: any `@media (prefers-color-scheme: dark) { … }` block in the
  SVG's `<style>` is stripped before rasterising.
- Rasterises with [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) (pinned exactly in
  `package.json`, locked in `package-lock.json`) and writes a PNG-in-ICO container with a small
  built-in writer — no other dependencies.
- The SVG must be square (the widget convention is a `0 0 32 32` viewBox).

## Usage

```sh
cd scripts/favicon
npm ci --no-audit --no-fund
node generate-favicon.mjs ../../widgets/<slug>/public/favicon.svg ../../widgets/<slug>/public/favicon.ico
```

Widgets can wrap this as an npm script, e.g. `widgets/heraldry-builder`:

```sh
cd widgets/heraldry-builder && npm run favicon
```

Commit both `favicon.svg` and the regenerated `favicon.ico`. `node_modules/` is git-ignored.
