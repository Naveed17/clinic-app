import { app } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export type DatabaseMode = 'local' | 'online';

/** Live Nest API (Vercel) → Neon Postgres. Used whenever databaseMode=online. */
export const ONLINE_API_ORIGIN = 'https://clinic-license-six.vercel.app';

export interface AppSettings {
  serverMode: 'local' | 'lan-server' | 'lan-client';
  clientApiUrl: string;
  lanPort: number;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  setupDone: boolean;
  /** From license API — not user-toggled freely */
  databaseMode: DatabaseMode;
  /** Cloud API origin when databaseMode=online (no trailing /api — paths already include /api/...) */
  clinicalApiUrl: string;
  schemaId: string;
}

const DEFAULTS: AppSettings = {
  serverMode: 'local',
  clientApiUrl: '',
  lanPort: 3333,
  clinicName: 'CLINIC MANAGEMENT',
  clinicAddress: '',
  clinicPhone: '',
  setupDone: false,
  databaseMode: 'local',
  clinicalApiUrl: '',
  schemaId: '',
};

function getPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function stripApiSuffix(url: string): string {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
}

function isLocalhostOrigin(url: string): boolean {
  return !url || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

/** Resolve live API origin for online mode (env → hardcoded Vercel → saved). */
export function resolveOnlineApiOrigin(savedClinicalApiUrl = ''): string {
  const fromEnv = stripApiSuffix(process.env.API_BASE_URL || '');
  if (fromEnv && !isLocalhostOrigin(fromEnv)) return fromEnv;
  const saved = stripApiSuffix(savedClinicalApiUrl);
  if (saved && !isLocalhostOrigin(saved)) return saved;
  return ONLINE_API_ORIGIN;
}

export function getSettings(): AppSettings {
  try {
    const path = getPath();
    const raw = existsSync(path)
      ? { ...DEFAULTS, ...(JSON.parse(readFileSync(path, 'utf-8')) as Partial<AppSettings>) }
      : { ...DEFAULTS };
    return normalizeOnlineSettings(raw);
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Online mode → only Vercel API → Neon.
 * No LAN, no localhost clinical URL, no local SQLite for clinic data.
 */
function normalizeOnlineSettings(settings: AppSettings): AppSettings {
  if (settings.databaseMode !== 'online') return settings;
  return {
    ...settings,
    serverMode: 'local',
    clientApiUrl: '',
    clinicalApiUrl: resolveOnlineApiOrigin(settings.clinicalApiUrl),
  };
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = normalizeOnlineSettings({ ...current, ...settings });
  writeFileSync(getPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function isOnlineDatabaseMode(settings: AppSettings = getSettings()): boolean {
  return settings.databaseMode === 'online' && Boolean(settings.clinicalApiUrl);
}
