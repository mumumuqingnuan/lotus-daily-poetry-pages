import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'lotus-daily-poetry-pages';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || `/${repository}/`,
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist' },
});
