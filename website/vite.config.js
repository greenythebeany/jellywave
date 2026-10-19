import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base: the site is served from a GitHub Pages project path
// (https://<user>.github.io/jellywave/), so assets must not assume "/".
export default defineConfig({
  plugins: [react()],
  base: './',
  // Changes on every build; appended to media URLs so browsers fetch the
  // new screenshots/video after a deploy instead of their cached copies.
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) }
});
