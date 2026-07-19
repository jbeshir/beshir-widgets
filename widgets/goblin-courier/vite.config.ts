import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(() => ({
  base: './',
  define: { __GAME_TEST_BUILD__: JSON.stringify(process.env.GAME_TEST_BUILD === '1') },
  plugins: [preact(), viteSingleFile(), {
    name: 'classic-offline-html',
    enforce: 'post',
    transformIndexHtml(html) {
      html = html.replace(/<link[^>]+favicon\.(?:ico|svg)[^>]*>/g, '');
      const match = html.match(/<script type="module"([^>]*)>([\s\S]*?)<\/script>/);
      if (!match) return html;
      const classic = `<script${match[1]}>${match[2]}</script>`;
      return html.replace(match[0], '').replace('</body>', `${classic}</body>`);
    },
  }],
  build: { assetsInlineLimit: 10000000, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } },
}));
