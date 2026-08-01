import { ipcMain, app } from 'electron';
import { machineIdSync } from 'node-machine-id';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';

const API_BASE_URL = process.env.API_BASE_URL || 'https://clinic-license-six.vercel.app/api';

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
type LicenseCache = { key: string; expiresAt: string | null; activatedAt: string; updatedAt: string };

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
function saveLicenseCache(key: string, expiresAt: string | null): void {
  try {
    const existing = getLicenseCache(key);
    const cache: LicenseCache = {
      key, expiresAt,
      activatedAt: existing?.activatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

// ── Modules ───────────────────────────────────────────────────────────────────
// API response: { ok: true, modules: {...}, expiresAt: '...' }
export async function getLicenseModules(): Promise<Record<string, boolean> | null> {
  const savedKey = getSavedKey();
  if (!savedKey) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/license/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: savedKey }),
    });
    const data = (await response.json()) as { ok: boolean; modules?: Record<string, boolean>; expiresAt?: string | null };
    if (!data.ok || !data.modules) return getCachedModules(savedKey);

    // expiresAt locally save karo
    if ('expiresAt' in data) saveLicenseCache(savedKey, data.expiresAt ?? null);
    saveModulesCache(savedKey, data.modules);
    return data.modules;
  } catch {
    return getCachedModules(savedKey);
  }
}

// ── Validate ──────────────────────────────────────────────────────────────────
// API response: { ok: true, valid: true/false, expiresAt: '...' }
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
    const data = (await response.json()) as { ok: boolean; valid: boolean; expiresAt?: string | null };
    if (!data.valid) {
      try { unlinkSync(getLicenseFilePath()); } catch {}
      return false;
    }
    // expiresAt locally save karo
    if ('expiresAt' in data) saveLicenseCache(savedKey, data.expiresAt ?? null);
    return true;
  } catch {
    // Offline: local expiry check
    if (isLocallyExpired(savedKey)) {
      console.warn('[License] Offline — expiry date guzar chuki hai.');
      return false;
    }
    return true;
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────
export function registerLicenseIpc(): void {
  ipcMain.handle('license:status', () => isLicenseActivated());
  ipcMain.handle('license:modules', () => getLicenseModules());

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
      const data = (await response.json()) as { ok: boolean; error?: string; expiresAt?: string | null };
      if (data.ok) {
        writeFileSync(getLicenseFilePath(), formattedKey, 'utf-8');
        saveLicenseCache(formattedKey, data.expiresAt ?? null);
        try { unlinkSync(getModulesCacheFilePath()); } catch {}
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Activation failed.' };
    } catch {
      return { ok: false, error: 'Cannot connect to server. Check your internet connection.' };
    }
  });

  ipcMain.handle('license:info', () => {
    const key = getSavedKey();
    if (!key) return null;
    return getLicenseCache(key);
  });
}
