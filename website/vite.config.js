import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base: the site is served from a GitHub Pages project path
// (https://<user>.github.io/jellywave/), so assets must not assume "/".
export default defineConfig({
  plugins: [react()],
  base: './'
});
