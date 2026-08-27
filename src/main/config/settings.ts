import { app } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
  clinicLogo: string;
  setupDone: boolean;
  /** From license API — not user-toggled freely */
  databaseMode: DatabaseMode;
  /** Cloud API origin when databaseMode=online (no trailing /api — paths already include /api/...) */
  clinicalApiUrl: string;
  schemaId: string;
  /** Hosted Groq via license-server — clinics do not store API keys */
  aiEnabled: boolean;
  groqApiKey: string;
  groqModel: string;
  /** Hosted WhatsApp Cloud API via license-server — one shared CareFlow number */
  whatsappEnabled: boolean;
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  /** Clinic WhatsApp display number, e.g. 923001234567 */
  whatsappDisplayNumber: string;
}

const DEFAULTS: AppSettings = {
  serverMode: 'local',
  clientApiUrl: '',
  lanPort: 3333,
  clinicName: 'CLINIC MANAGEMENT',
  clinicAddress: '',
  clinicPhone: '',
  clinicLogo: '',
  setupDone: false,
  databaseMode: 'local',
  clinicalApiUrl: '',
  schemaId: '',
  aiEnabled: false,
  groqApiKey: '',
  groqModel: 'gemini-3.6-flash',
  whatsappEnabled: false,
  whatsappToken: '',
  whatsappPhoneNumberId: '',
  whatsappDisplayNumber: '',
};

function getSavedLicenseKey(): string | null {
  try {
    const file = join(app.getPath('userData'), 'license.dat');
    if (existsSync(file)) {
      const key = readFileSync(file, 'utf-8').trim();
      if (key) return key;
    }
  } catch { /* ignore */ }
  try {
    const cacheFile = join(app.getPath('userData'), 'license-cache.json');
    if (existsSync(cacheFile)) {
      const cache = JSON.parse(readFileSync(cacheFile, 'utf-8')) as { key?: string };
      if (cache?.key) return cache.key;
    }
  } catch { /* ignore */ }
  return null;
}

function getActiveSchemaId(): string {
  const key = getSavedLicenseKey();
  if (!key) return '';
  try {
    const cacheFile = join(app.getPath('userData'), 'license-cache.json');
    if (existsSync(cacheFile)) {
      const cache = JSON.parse(readFileSync(cacheFile, 'utf-8')) as { key?: string; schemaId?: string };
      if (cache?.key === key && cache?.schemaId) return cache.schemaId;
    }
  } catch { /* ignore */ }
  const hash = createHash('sha256').update(key.toUpperCase()).digest('hex').slice(0, 16);
  return `lic_${hash}`;
}

function getPath(): string {
  const schemaId = getActiveSchemaId();
  if (!schemaId) {
    return join(app.getPath('userData'), 'settings.json');
  }

  const schemaSettingsPath = join(app.getPath('userData'), `settings_${schemaId}.json`);
  const legacySettingsPath = join(app.getPath('userData'), 'settings.json');
  const legacyFlagPath = join(app.getPath('userData'), 'clinic_legacy_migrated.flag');

  // Legacy one-time migration for pre-existing single-clinic installations:
  if (!existsSync(schemaSettingsPath) && existsSync(legacySettingsPath) && !existsSync(legacyFlagPath)) {
    try {
      const legacyRaw = JSON.parse(readFileSync(legacySettingsPath, 'utf-8')) as Partial<AppSettings>;
      if (legacyRaw.setupDone === true) {
        copyFileSync(legacySettingsPath, schemaSettingsPath);
        writeFileSync(legacyFlagPath, schemaId, 'utf-8');
        console.log(`[Settings] One-time legacy migration of settings.json to ${schemaSettingsPath}`);
      }
    } catch { /* ignore */ }
  }

  return schemaSettingsPath;
}

function stripApiSuffix(url: string): string {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
}

export function isUnusableOnlineOrigin(url: string): boolean {
  if (!url) return true;
  try {
    const host = new URL(url.includes('://') ? url : `http://${url}`).hostname
      .replace(/^\[|\]$/g, '')
      .toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      if (parts[0] === 10) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Resolve live API origin for online mode (env → hardcoded Vercel → saved). */
export function resolveOnlineApiOrigin(savedClinicalApiUrl = ''): string {
  const fromEnv = stripApiSuffix(process.env.API_BASE_URL || '');
  if (fromEnv && !isUnusableOnlineOrigin(fromEnv)) return fromEnv;
  const saved = stripApiSuffix(savedClinicalApiUrl);
  if (saved && !isUnusableOnlineOrigin(saved)) return saved;
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
  // databaseMode / clinicalApiUrl / schemaId come from license API only —
  // ignore accidental UI patches so Network Settings save cannot force local mode.
  const safePatch: Partial<AppSettings> = { ...settings };
  delete safePatch.databaseMode;
  delete safePatch.clinicalApiUrl;
  delete safePatch.schemaId;
  const next = normalizeOnlineSettings({ ...current, ...safePatch });
  writeFileSync(getPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

/** License/main-process only — updates cloud vs local database mode. */
export function saveDatabaseModeSettings(
  patch: Pick<AppSettings, 'databaseMode' | 'clinicalApiUrl' | 'schemaId'> &
    Partial<Pick<AppSettings, 'serverMode' | 'clientApiUrl'>>,
): AppSettings {
  const current = getSettings();
  const next = normalizeOnlineSettings({ ...current, ...patch });
  writeFileSync(getPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function isOnlineDatabaseMode(settings: AppSettings = getSettings()): boolean {
  return settings.databaseMode === 'online' && Boolean(settings.clinicalApiUrl);
}
