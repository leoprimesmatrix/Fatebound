import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Critical for GitHub Pages to find assets
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});