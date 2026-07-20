import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  define: { 'import.meta.env.GAME_TEST_BUILD': JSON.stringify(process.env.GAME_TEST_BUILD ?? '0') },
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
});
