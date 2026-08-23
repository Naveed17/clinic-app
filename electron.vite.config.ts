import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    define: {
      'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL || 'https://clinic-license-six.vercel.app/api'),
      'process.env.WHATSAPP_TOKEN': JSON.stringify(env.WHATSAPP_TOKEN || ''),
      'process.env.WHATSAPP_PHONE_NUMBER_ID': JSON.stringify(env.WHATSAPP_PHONE_NUMBER_ID || ''),
      'process.env.META_APP_ID': JSON.stringify(env.META_APP_ID || ''),
      'process.env.META_APP_SECRET': JSON.stringify(env.META_APP_SECRET || ''),
      'process.env.META_EMBEDDED_CONFIG_ID': JSON.stringify(env.META_EMBEDDED_CONFIG_ID || ''),
      'process.env.GOOGLE_DRIVE_CLIENT_ID': JSON.stringify(env.GOOGLE_DRIVE_CLIENT_ID || ''),
    },
    build: {
      rollupOptions: {},
      copyPublicDir: true,
    },
    publicDir: resolve('src/main/assets'),
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    define: {
      'import.meta.env.VITE_META_APP_ID': JSON.stringify(env.META_APP_ID || ''),
      'import.meta.env.VITE_META_EMBEDDED_CONFIG_ID': JSON.stringify(env.META_EMBEDDED_CONFIG_ID || ''),
    },
    plugins: [react()],
    optimizeDeps: {
      include: [
        '@fullcalendar/react',
        '@fullcalendar/daygrid',
        '@fullcalendar/timegrid',
        '@fullcalendar/interaction',
        '@fullcalendar/core',
        'react-phone-number-input',
      ],
      esbuildOptions: { target: 'es2020' },
    },
  },
});
