import { app } from 'electron';

export const environment = {
  isDevelopment: !app.isPackaged,
  appName: 'Clinic Management System',
  apiHost: process.env.CLINIC_API_HOST ?? '127.0.0.1',
  apiPort: Number(process.env.CLINIC_API_PORT ?? 0),
};
