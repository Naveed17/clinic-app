import { ipcMain, app } from 'electron';
import { machineIdSync } from 'node-machine-id';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import { saveSettings, saveDatabaseModeSettings, type DatabaseMode, resolveOnlineApiOrigin } from '../config/settings';

const API_BASE_URL = process.env.API_BASE_URL || 'https://clinic-license-six.vercel.app/api';

/** Origin used for online clinical HTTP (no trailing /api). */
function apiOriginFromEnv(): string {
  return resolveOnlineApiOrigin();
}

function normalizeClinicalApiUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

function isUsableClinicalApiUrl(url: string): boolean {
  if (!url) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) return false;
  return true;
}
function getLicenseFilePath(): string {
  return join(app.getPath('userData'), 'license.dat');
}
function getModulesCacheFilePath(): string {
  return join(app.getPath('userData'), 'license-modules.json');
}
function getLicenseCacheFilePath(): string {
  return join(app.getPath('userData'), 'license-cache.json');
}

type ModulesCache = { key: string; modules: Record<string, boolean>; updatedAt: string };
type LicenseCache = {
  key: string;
  expiresAt: string | null;
  activatedAt: string;
  updatedAt: string;
  databaseMode?: DatabaseMode;
  clinicalApiUrl?: string | null;
  schemaId?: string | null;
};

function getHWID(): string {
  try { return machineIdSync(); } catch { return 'UNKNOWN_HWID'; }
}
function getDeviceName(): string {
  try { return os.hostname() || 'Unknown Device'; } catch { return 'Unknown Device'; }
}
function getSavedKey(): string | null {
  try {
    const file = getLicenseFilePath();
    if (!existsSync(file)) return null;
    return readFileSync(file, 'utf-8').trim();
  } catch { return null; }
}
function getLicenseCache(key: string): LicenseCache | null {
  try {
    const file = getLicenseCacheFilePath();
    if (!existsSync(file)) return null;
    const cache = JSON.parse(readFileSync(file, 'utf-8')) as LicenseCache;
    if (cache.key !== key) return null;
    return cache;
  } catch { return null; }
}
function saveLicenseCache(
  key: string,
  expiresAt: string | null,
  extra?: { databaseMode?: DatabaseMode; clinicalApiUrl?: string | null; schemaId?: string | null },
): void {
  try {
    const existing = getLicenseCache(key);
    const cache: LicenseCache = {
      key,
      expiresAt,
      activatedAt: existing?.activatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      databaseMode: extra?.databaseMode ?? existing?.databaseMode ?? 'local',
      clinicalApiUrl: extra?.clinicalApiUrl ?? existing?.clinicalApiUrl ?? null,
      schemaId: extra?.schemaId ?? existing?.schemaId ?? null,
    };
    writeFileSync(getLicenseCacheFilePath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch { /* ignore */ }
}
function getCachedModules(key: string): Record<string, boolean> | null {
  try {
    const file = getModulesCacheFilePath();
    if (!existsSync(file)) return null;
    const cache = JSON.parse(readFileSync(file, 'utf-8')) as ModulesCache;
    if (cache.key !== key || !cache.modules || typeof cache.modules !== 'object') return null;
    if (!Object.values(cache.modules).every((v) => typeof v === 'boolean')) return null;
    return cache.modules;
  } catch { return null; }
}
function saveModulesCache(key: string, modules: Record<string, boolean>): void {
  try {
    writeFileSync(getModulesCacheFilePath(), JSON.stringify({ key, modules, updatedAt: new Date().toISOString() }), 'utf-8');
  } catch { /* ignore */ }
}
function isLocallyExpired(key: string): boolean {
  const cache = getLicenseCache(key);
  if (!cache || !cache.expiresAt) return false;
  return new Date() > new Date(cache.expiresAt);
}

type LicenseApiExtras = {
  databaseMode?: DatabaseMode;
  clinicalApiUrl?: string | null;
  schemaId?: string | null;
  onlineDatabase?: boolean;
  localDatabase?: boolean;
};

function applyDatabaseModeFromApi(key: string, data: LicenseApiExtras & { expiresAt?: string | null }): void {
  const databaseMode: DatabaseMode =
    data.databaseMode === 'online' || data.onlineDatabase === true ? 'online' : 'local';
  const fromApi = normalizeClinicalApiUrl(data.clinicalApiUrl || '');
  // Prefer env/live origin when API returns empty or localhost (common on Vercel without PUBLIC_API_BASE_URL)
  const clinicalApiUrl = isUsableClinicalApiUrl(fromApi) ? fromApi : apiOriginFromEnv();
  const schemaId = (data.schemaId || '').trim();

  saveLicenseCache(key, data.expiresAt ?? null, {
    databaseMode,
    clinicalApiUrl: databaseMode === 'online' ? clinicalApiUrl || null : null,
    schemaId: schemaId || null,
  });

  saveDatabaseModeSettings({
    databaseMode,
    clinicalApiUrl: databaseMode === 'online' ? clinicalApiUrl : '',
    schemaId: databaseMode === 'online' ? schemaId : '',
    ...(databaseMode === 'online' ? { serverMode: 'local' as const, clientApiUrl: '' } : {}),
  });
}

// ── Modules ───────────────────────────────────────────────────────────────────
export async function getLicenseModules(): Promise<Record<string, boolean> | null> {
  const savedKey = getSavedKey();
  if (!savedKey) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/license/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: savedKey }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      modules?: Record<string, boolean>;
      expiresAt?: string | null;
    } & LicenseApiExtras;
    if (!data.ok || !data.modules) return getCachedModules(savedKey);

    applyDatabaseModeFromApi(savedKey, data);
    saveModulesCache(savedKey, data.modules);
    return data.modules;
  } catch {
    return getCachedModules(savedKey);
  }
}

// ── Validate ──────────────────────────────────────────────────────────────────
export async function isLicenseActivated(): Promise<boolean> {
  const savedKey = getSavedKey();
  if (!savedKey) return false;
  try {
    const hwid = getHWID();
    const response = await fetch(`${API_BASE_URL}/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: savedKey, hwid }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      valid: boolean;
      expiresAt?: string | null;
    } & LicenseApiExtras;
    if (!data.valid) {
      try { unlinkSync(getLicenseFilePath()); } catch { /* ignore */ }
      return false;
    }
    applyDatabaseModeFromApi(savedKey, data);
    return true;
  } catch {
    if (isLocallyExpired(savedKey)) {
      console.warn('[License] Offline — expiry date guzar chuki hai.');
      return false;
    }
    return true;
  }
}

export function getLicenseRuntimeMeta(): {
  key: string | null;
  hwid: string;
  databaseMode: DatabaseMode;
  clinicalApiUrl: string;
  schemaId: string;
} {
  const key = getSavedKey();
  const cache = key ? getLicenseCache(key) : null;
  return {
    key,
    hwid: getHWID(),
    databaseMode: cache?.databaseMode === 'online' ? 'online' : 'local',
    clinicalApiUrl: cache?.clinicalApiUrl || '',
    schemaId: cache?.schemaId || '',
  };
}

// ── IPC ───────────────────────────────────────────────────────────────────────
export function registerLicenseIpc(): void {
  ipcMain.handle('license:status', () => isLicenseActivated());
  ipcMain.handle('license:modules', () => getLicenseModules());
  ipcMain.handle('license:database-mode', () => {
    const meta = getLicenseRuntimeMeta();
    return {
      key: meta.key,
      databaseMode: meta.databaseMode,
      clinicalApiUrl: meta.clinicalApiUrl,
      schemaId: meta.schemaId,
    };
  });

  ipcMain.handle('license:activate', async (_e, key: string) => {
    const formattedKey = key.trim().toUpperCase();
    if (!formattedKey) return { ok: false, error: 'Please enter a key.' };
    try {
      const hwid = getHWID();
      const deviceName = getDeviceName();
      const response = await fetch(`${API_BASE_URL}/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: formattedKey, hwid, deviceName }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        expiresAt?: string | null;
      } & LicenseApiExtras;
      if (data.ok) {
        writeFileSync(getLicenseFilePath(), formattedKey, 'utf-8');
        applyDatabaseModeFromApi(formattedKey, data);
        try { unlinkSync(getModulesCacheFilePath()); } catch { /* ignore */ }
        return {
          ok: true,
          databaseMode: data.databaseMode === 'online' || data.onlineDatabase ? 'online' : 'local',
        };
      }
      return { ok: false, error: data.error || 'Activation failed.' };
    } catch {
      return { ok: false, error: 'Cannot connect to server. Check your internet connection.' };
    }
  });
}
