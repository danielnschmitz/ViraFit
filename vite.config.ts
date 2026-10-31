import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5176,
    proxy: {
      '/api': {
        target: 'http://localhost:3336',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3336',
        changeOrigin: true,
      },
    },
  },
});
