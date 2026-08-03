import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL || 'http://localhost:4000/api'),
      'process.env.WHATSAPP_TOKEN': JSON.stringify(env.WHATSAPP_TOKEN || ''),
      'process.env.WHATSAPP_PHONE_NUMBER_ID': JSON.stringify(env.WHATSAPP_PHONE_NUMBER_ID || ''),
    },
    build: {
      rollupOptions: {
        external: [],
      },
      copyPublicDir: true,
    },
    publicDir: resolve('src/main/assets'),
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    plugins: [react()],
    optimizeDeps: {
      include: [
        '@fullcalendar/react',
        '@fullcalendar/daygrid',
        '@fullcalendar/timegrid',
        '@fullcalendar/interaction',
        '@fullcalendar/core',
      ],
      esbuildOptions: { target: 'es2020' },
    },
  },
});
