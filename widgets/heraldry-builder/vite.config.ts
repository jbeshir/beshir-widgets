import path from 'node:path';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  // The only dynamic imports are the art's category chunks (art/paths/lazy.ts), which import nothing: there is nothing to preload.
  build: { modulePreload: false },
  resolve: {
    alias: [
      // The app reads its charge art through art/paths/lazy.ts, which loads the art outside the main chunk a category at a time;
      // every other reader (vitest, which does not read this file, the worker's wrangler build, the art tools) gets the static
      // art/paths/index.ts. The library imports that module as `./art/paths/index` or `../paths/index` only.
      { find: /^(?:\.\.?\/)+(?:art\/)?paths\/index$/, replacement: path.resolve(import.meta.dirname, 'src/lib/heraldry/art/paths/lazy.ts') },
    ],
  },
});
