import { app } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export interface AppSettings {
  serverMode: 'local' | 'lan-server' | 'lan-client';
  clientApiUrl: string;
  lanPort: number;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  setupDone: boolean;
}

const DEFAULTS: AppSettings = {
  serverMode: 'local',
  clientApiUrl: '',
  lanPort: 3333,
  clinicName: 'CLINIC MANAGEMENT',
  clinicAddress: '',
  clinicPhone: '',
  setupDone: false,
};

function getPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function getSettings(): AppSettings {
  try {
    const path = getPath();
    if (!existsSync(path)) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(readFileSync(path, 'utf-8')) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = { ...current, ...settings };
  writeFileSync(getPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
