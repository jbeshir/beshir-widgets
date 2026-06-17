import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    // The bundled 2026 schedule (~1.6 MB raw / ~300 KB gzip) is imported as a module so the
    // widget renders fully offline. Raise the warning ceiling so the data chunk is not noise.
    chunkSizeWarningLimit: 2048,
  },
});
