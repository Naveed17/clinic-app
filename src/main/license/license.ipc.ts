import { ipcMain, app } from 'electron';
import { machineIdSync } from 'node-machine-id';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import { saveSettings, saveDatabaseModeSettings, type DatabaseMode, resolveOnlineApiOrigin, isUnusableOnlineOrigin } from '../config/settings';

const API_BASE_URL = process.env.API_BASE_URL || 'https://clinic-license-six.vercel.app/api';

/** Origin used for online clinical HTTP (no trailing /api). */
function apiOriginFromEnv(): string {
  return resolveOnlineApiOrigin();
}

function normalizeClinicalApiUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

function isUsableClinicalApiUrl(url: string): boolean {
  return Boolean(url) && !isUnusableOnlineOrigin(url);
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
function getSupportCacheFilePath(): string {
  return join(app.getPath('userData'), 'careflow-support.json');
}

export type CareFlowSupportContact = { phone: string; email: string };

export async function getCareFlowSupport(): Promise<CareFlowSupportContact> {
  try {
    const response = await fetch(`${API_BASE_URL}/support`);
    const data = (await response.json()) as { ok?: boolean; phone?: string; email?: string };
    const phone = String(data.phone || '').trim();
    const email = String(data.email || '').trim();
    if (phone || email) {
      try {
        writeFileSync(getSupportCacheFilePath(), JSON.stringify({ phone, email }), 'utf-8');
      } catch { /* ignore */ }
      return { phone, email };
    }
  } catch { /* offline — use cache */ }
  try {
    const cached = JSON.parse(readFileSync(getSupportCacheFilePath(), 'utf-8')) as CareFlowSupportContact;
    return {
      phone: String(cached.phone || '').trim(),
      email: String(cached.email || '').trim(),
    };
  } catch {
    return { phone: '', email: '' };
  }
}

type ModulesCache = { key: string; modules: Record<string, boolean>; updatedAt: string };
type LicenseCache = {
  key: string;
  expiresAt: string | null;
  licenseType?: 'monthly' | 'lifetime';
  activatedAt: string;
  updatedAt: string;
  databaseMode?: DatabaseMode;
  clinicalApiUrl?: string | null;
  schemaId?: string | null;
  lastGate?: 'ok' | 'blocked';
  lastReason?: string;
};

export type LicenseGate =
  | { state: 'ok' }
  | { state: 'none' }
  | { state: 'blocked'; reason: string };

const DISABLED_FALLBACK =
  'This license has been disabled. Contact CareFlow customer support.';
const EXPIRED_REASON = 'License has expired. Contact CareFlow customer support.';

function getHWID(): string {
  try { return machineIdSync(); } catch { return 'UNKNOWN_HWID'; }
}

export function getLicenseApiBase(): string {
  return API_BASE_URL;
}

export function getLicenseAuth(): { key: string; hwid: string } | null {
  const key = getSavedKey();
  if (!key) return null;
  return { key, hwid: getHWID() };
}
function getDeviceName(): string {
  try { return os.hostname() || 'Unknown Device'; } catch { return 'Unknown Device'; }
}
function getSavedKey(): string | null {
  try {
    const file = getLicenseFilePath();
    if (existsSync(file)) {
      const key = readFileSync(file, 'utf-8').trim();
      if (key) return key;
    }
  } catch { /* ignore */ }
  try {
    const cacheFile = getLicenseCacheFilePath();
    if (!existsSync(cacheFile)) return null;
    const cache = JSON.parse(readFileSync(cacheFile, 'utf-8')) as LicenseCache;
    const key = String(cache.key || '').trim();
    if (!key) return null;
    try { writeFileSync(getLicenseFilePath(), key, 'utf-8'); } catch { /* still use cache key */ }
    return key;
  } catch {
    return null;
  }
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
function rememberGate(key: string, lastGate: 'ok' | 'blocked', lastReason?: string): void {
  try {
    const existing = getLicenseCache(key);
    const cache: LicenseCache = {
      key,
      expiresAt: existing?.expiresAt ?? null,
      licenseType: existing?.licenseType,
      activatedAt: existing?.activatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      databaseMode: existing?.databaseMode ?? 'local',
      clinicalApiUrl: existing?.clinicalApiUrl ?? null,
      schemaId: existing?.schemaId ?? null,
      lastGate,
      lastReason: lastGate === 'ok' ? undefined : (lastReason || existing?.lastReason),
    };
    writeFileSync(getLicenseCacheFilePath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

function toIsoExpiry(value: unknown): string | null {
  if (value == null || value === '') return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function asLicenseType(value: unknown): 'monthly' | 'lifetime' | undefined {
  return value === 'monthly' || value === 'lifetime' ? value : undefined;
}

function saveLicenseCache(
  key: string,
  expiresAt: string | null,
  extra?: {
    databaseMode?: DatabaseMode;
    clinicalApiUrl?: string | null;
    schemaId?: string | null;
    licenseType?: 'monthly' | 'lifetime';
    lastGate?: 'ok' | 'blocked';
    lastReason?: string;
  },
): void {
  try {
    const existing = getLicenseCache(key);
    const cache: LicenseCache = {
      key,
      expiresAt,
      licenseType: extra?.licenseType ?? existing?.licenseType,
      activatedAt: existing?.activatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      databaseMode: extra?.databaseMode ?? existing?.databaseMode ?? 'local',
      clinicalApiUrl: extra?.clinicalApiUrl ?? existing?.clinicalApiUrl ?? null,
      schemaId: extra?.schemaId ?? existing?.schemaId ?? null,
      lastGate: extra?.lastGate ?? existing?.lastGate,
      lastReason: extra?.lastGate === 'ok' ? undefined : (extra?.lastReason ?? existing?.lastReason),
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

/** Sync read of cached license modules (no network). Missing key = disabled. */
export function isLicenseModuleEnabled(moduleKey: string): boolean {
  const savedKey = getSavedKey();
  if (!savedKey) return false;
  if (isLocallyExpired(savedKey)) return false;
  const modules = getCachedModules(savedKey);
  return modules?.[moduleKey] === true;
}

/** OPD daily reports page. */
export function isOpdReportsLicensed(): boolean {
  return isLicenseModuleEnabled('opdReports');
}
function saveModulesCache(key: string, modules: Record<string, boolean>): void {
  try {
    writeFileSync(getModulesCacheFilePath(), JSON.stringify({ key, modules, updatedAt: new Date().toISOString() }), 'utf-8');
  } catch { /* ignore */ }
}
function isLocallyExpired(key: string): boolean {
  const cache = getLicenseCache(key);
  if (!cache) return false;
  if (cache.licenseType === 'monthly' && !cache.expiresAt) return true;
  if (!cache.expiresAt) return false;
  const end = new Date(cache.expiresAt);
  if (Number.isNaN(end.getTime())) return cache.licenseType === 'monthly';
  return Date.now() > end.getTime();
}

function clearLocalLicense(): void {
  for (const file of [getLicenseFilePath(), getModulesCacheFilePath(), getLicenseCacheFilePath()]) {
    try {
      if (existsSync(file)) unlinkSync(file);
    } catch { /* ignore */ }
  }
}

/** Backend deleted the key (as opposed to merely disabling it). */
function isLicenseMissingOnServer(
  data: { valid?: boolean; error?: string; code?: string; message?: string },
  httpStatus: number,
): boolean {
  const code = String(data.code || '').trim().toLowerCase();
  if (code === 'not_found' || code === 'missing') return true;
  if (httpStatus === 404) return true;
  const err = String(data.error || data.message || '').trim().toLowerCase();
  if (!err) return false;
  if (err.includes('has been disabled')) return false;
  if (err.includes('not found') || err.includes('does not exist') || err.includes('no such license')) {
    return true;
  }
  // Current / previous validate payload when the key row was deleted
  if (err === 'license invalid or disabled.') return true;
  return false;
}

type LicenseApiExtras = {
  databaseMode?: DatabaseMode;
  clinicalApiUrl?: string | null;
  schemaId?: string | null;
  onlineDatabase?: boolean;
  localDatabase?: boolean;
  licenseType?: string;
};

function applyDatabaseModeFromApi(key: string, data: LicenseApiExtras & { expiresAt?: string | Date | null }): void {
  const databaseMode: DatabaseMode =
    data.databaseMode === 'online' || data.onlineDatabase === true ? 'online' : 'local';
  const fromApi = normalizeClinicalApiUrl(data.clinicalApiUrl || '');
  // Prefer env/live origin when API returns empty or localhost (common on Vercel without PUBLIC_API_BASE_URL)
  const clinicalApiUrl = isUsableClinicalApiUrl(fromApi) ? fromApi : apiOriginFromEnv();
  const schemaId = (data.schemaId || '').trim();
  const existing = getLicenseCache(key);
  const expiresAt =
    data.expiresAt !== undefined ? toIsoExpiry(data.expiresAt) : (existing?.expiresAt ?? null);

  saveLicenseCache(key, expiresAt, {
    databaseMode,
    clinicalApiUrl: databaseMode === 'online' ? clinicalApiUrl || null : null,
    schemaId: schemaId || null,
    licenseType: asLicenseType(data.licenseType),
    lastGate: 'ok',
  });

  saveDatabaseModeSettings({
    databaseMode,
    clinicalApiUrl: databaseMode === 'online' ? clinicalApiUrl : '',
    schemaId: databaseMode === 'online' ? schemaId : '',
    ...(databaseMode === 'online' ? { serverMode: 'local' as const, clientApiUrl: '' } : {}),
  });
}

// ── Modules ───────────────────────────────────────────────────────────────────
const KNOWN_MODULE_KEYS = [
  'doctorDashboard',
  'labDashboard',
  'billing',
  'reports',
  'opdReports',
  'statistics',
  'tokens',
  'manageDoctors',
  'managePatients',
  'manageMedicines',
  'manageUsers',
  'pharmacy',
  'whatsapp',
  'ai',
  'chat',
] as const;

function normalizeModulesPayload(modules?: Record<string, boolean> | null): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of KNOWN_MODULE_KEYS) {
    out[key] = modules?.[key] === true;
  }
  out.pharmacy = false;
  out.billing = true;
  out.manageMedicines = true;
  out.reports = true;
  return out;
}

export async function getLicenseModules(): Promise<Record<string, boolean> | null> {
  const savedKey = getSavedKey();
  if (!savedKey) return null;
  if (isLocallyExpired(savedKey)) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/license/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: savedKey }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      modules?: Record<string, boolean>;
      expiresAt?: string | null;
    } & LicenseApiExtras;
    if (!data.ok || !data.modules) {
      const expired = /expir/i.test(String(data.error || ''));
      if (expired) {
        const nextExpiry = toIsoExpiry(data.expiresAt) ?? getLicenseCache(savedKey)?.expiresAt ?? null;
        saveLicenseCache(savedKey, nextExpiry, { lastGate: 'blocked', lastReason: EXPIRED_REASON });
        return null;
      }
      const cached = getCachedModules(savedKey);
      return cached ? normalizeModulesPayload(cached) : null;
    }

    applyDatabaseModeFromApi(savedKey, data);
    if (isLocallyExpired(savedKey)) {
      rememberGate(savedKey, 'blocked', EXPIRED_REASON);
      return null;
    }
    const normalized = normalizeModulesPayload(data.modules);
    saveModulesCache(savedKey, normalized);
    return normalized;
  } catch {
    if (isLocallyExpired(savedKey)) return null;
    const cached = getCachedModules(savedKey);
    return cached ? normalizeModulesPayload(cached) : null;
  }
}

// ── Validate ──────────────────────────────────────────────────────────────────
export async function getLicenseGate(): Promise<LicenseGate> {
  const savedKey = getSavedKey();
  if (!savedKey) return { state: 'none' };
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
      error?: string;
      code?: string;
      message?: string;
      expiresAt?: string | null;
    } & LicenseApiExtras;
    if (isLicenseMissingOnServer(data, response.status)) {
      clearLocalLicense();
      return { state: 'none' };
    }
    if (!data.valid) {
      const reason = String(data.error || data.message || '').trim() || DISABLED_FALLBACK;
      rememberGate(savedKey, 'blocked', reason);
      return { state: 'blocked', reason };
    }
    applyDatabaseModeFromApi(savedKey, data);
    if (isLocallyExpired(savedKey)) {
      rememberGate(savedKey, 'blocked', EXPIRED_REASON);
      return { state: 'blocked', reason: EXPIRED_REASON };
    }
    return { state: 'ok' };
  } catch {
    const cache = getLicenseCache(savedKey);
    if (isLocallyExpired(savedKey)) {
      return { state: 'blocked', reason: EXPIRED_REASON };
    }
    if (cache?.lastGate === 'blocked') {
      return { state: 'blocked', reason: cache.lastReason || DISABLED_FALLBACK };
    }
    return { state: 'ok' };
  }
}

export async function isLicenseActivated(): Promise<boolean> {
  return (await getLicenseGate()).state === 'ok';
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
  ipcMain.handle('license:gate', () => getLicenseGate());
  ipcMain.handle('license:support', () => getCareFlowSupport());
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

    ipcMain.handle('license:cloud-suspended', () => {
      const key = getSavedKey();
      if (key) {
        applyDatabaseModeFromApi(key, { databaseMode: 'local', onlineDatabase: false });
      } else {
        saveDatabaseModeSettings({
          databaseMode: 'local',
          clinicalApiUrl: '',
          schemaId: '',
        });
      }
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 50);
      return { ok: true };
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
