import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base: the site is served from a GitHub Pages project path
// (https://<user>.github.io/triptych/), so assets must not assume "/".
export default defineConfig({
  plugins: [react()],
  base: './',
  // Changes on every build; appended to media URLs so browsers fetch the
  // new screenshots/video after a deploy instead of their cached copies.
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  build: {
    rollupOptions: {
      // Design exploration (Phase 2): one page per direction, plus a gallery.
      input: {
        main: resolve(__dirname, 'index.html'),
        variants: resolve(__dirname, 'variants/index.html'),
        a: resolve(__dirname, 'variants/a.html'),
        b: resolve(__dirname, 'variants/b.html'),
        c: resolve(__dirname, 'variants/c.html'),
        d: resolve(__dirname, 'variants/d.html')
      }
    }
  }
});
