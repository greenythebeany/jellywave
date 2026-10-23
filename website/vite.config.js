import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { legalPages } from './legal.js';

// Relative base: the site is served from a GitHub Pages project path
// (https://<user>.github.io/triptych/), so assets must not assume "/".
export default defineConfig({
  plugins: [react(), legalPages()],
  base: './',
  // Changes on every build; appended to media URLs so browsers fetch the
  // new screenshots/video after a deploy instead of their cached copies.
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  build: {
    rollupOptions: {
<<<<<<< HEAD
      // Design exploration: the chosen direction (D) until the rebuild replaces it.
      input: {
        main: resolve(__dirname, 'index.html'),
        d: resolve(__dirname, 'variants/d.html')
=======
      // /terms/ and /privacy/ are built from docs/legal (see legal.js).
      input: {
        main: resolve(__dirname, 'index.html'),
        terms: resolve(__dirname, 'terms/index.html'),
        privacy: resolve(__dirname, 'privacy/index.html')
>>>>>>> main
      }
    }
  }
});
