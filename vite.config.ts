import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are loaded correctly on GitHub Pages (e.g. /repo-name/assets/...)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});