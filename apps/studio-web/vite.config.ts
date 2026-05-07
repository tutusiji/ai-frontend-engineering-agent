import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import UnoCSS from 'unocss/vite';

export default defineConfig({
  plugins: [
    UnoCSS(),
    react(),
  ],
  server: {
    port: 4400,
    host: '0.0.0.0',
    allowedHosts: ['joox.cc', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4401',
        changeOrigin: true,
      },
    },
  },
});
