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

// Expiry date locally save karne ke liye alag file
function getLicenseCacheFilePath(): string {
  return join(app.getPath('userData'), 'license-cache.json');
}

type ModulesCache = {
  key: string;
  modules: Record<string, boolean>;
  updatedAt: string;
};

// License cache — key + expiry date locally save hoti hai
type LicenseCache = {
  key: string;
  expiresAt: string | null; // ISO date string, null = lifetime/unknown
  activatedAt: string;
  updatedAt: string;
};

// Computer ka Machine/Hardware ID
function getHWID(): string {
  try {
    return machineIdSync();
  } catch {
    return 'UNKNOWN_HWID';
  }
}

function getDeviceName(): string {
  try {
    return os.hostname() || 'Unknown Device';
  } catch {
    return 'Unknown Device';
  }
}

function getSavedKey(): string | null {
  try {
    const file = getLicenseFilePath();
    if (!existsSync(file)) return null;
    return readFileSync(file, 'utf-8').trim();
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
  } catch {
    return null;
  }
}

function saveLicenseCache(key: string, expiresAt: string | null): void {
  try {
    const existing = getLicenseCache(key);
    const cache: LicenseCache = {
      key,
      expiresAt,
      activatedAt: existing?.activatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(getLicenseCacheFilePath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // cache write failure nahi rokni chahiye valid response ko
  }
}

function getCachedModules(key: string): Record<string, boolean> | null {
  try {
    const file = getModulesCacheFilePath();
    if (!existsSync(file)) return null;
    const cache = JSON.parse(readFileSync(file, 'utf-8')) as ModulesCache;
    if (cache.key !== key || !cache.modules || typeof cache.modules !== 'object') return null;
    if (!Object.values(cache.modules).every((value) => typeof value === 'boolean')) return null;
    return cache.modules;
  } catch {
    return null;
  }
}

function saveModulesCache(key: string, modules: Record<string, boolean>): void {
  try {
    const cache: ModulesCache = { key, modules, updatedAt: new Date().toISOString() };
    writeFileSync(getModulesCacheFilePath(), JSON.stringify(cache), 'utf-8');
  } catch {
    // A cache write failure must not prevent a valid online response from being used.
  }
}

/**
 * Locally cached expiry date se check karta hai ke license expire hui ya nahi.
 * Offline mode mein yahi use hoti hai.
 * Returns: true = expired, false = valid ya unknown
 */
function isLocallyExpired(key: string): boolean {
  const cache = getLicenseCache(key);
  if (!cache || !cache.expiresAt) return false; // no expiry info = assume valid
  return new Date() > new Date(cache.expiresAt);
}

// Actual API se aane wala license object shape
type ApiLicenseData = {
  key: string;
  isEnabled: boolean;
  expiresAt: string | null;
  modules: Record<string, boolean>;
  licenseType: string;
  maxDevices: number;
  activeDevices: { hwid: string; deviceName: string; activatedAt: string }[];
};

// Validate, modules, activate — sab ka wrapper response
type ApiResponse<T> = {
  success: boolean;
  data?: T[];
  error?: string;
  message?: string;
};

/**
 * Gets the latest module permissions when online and falls back to the last
 * successful response for the currently activated license when offline.
 */
export async function getLicenseModules(): Promise<Record<string, boolean> | null> {
  const savedKey = getSavedKey();
  if (!savedKey) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/license/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: savedKey }),
    });
    const res = (await response.json()) as ApiResponse<ApiLicenseData>;
    const licenseData = res.success && res.data?.[0];
    if (!licenseData || !licenseData.modules) return getCachedModules(savedKey);

    // expiresAt aur modules dono locally save karo
    saveLicenseCache(savedKey, licenseData.expiresAt ?? null);
    saveModulesCache(savedKey, licenseData.modules);
    return licenseData.modules;
  } catch {
    return getCachedModules(savedKey);
  }
}

// 1. App Startup Validation
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

    const res = (await response.json()) as ApiResponse<ApiLicenseData>;
    const licenseData = res.success && res.data?.[0];

    if (!licenseData || !licenseData.isEnabled) {
      try { unlinkSync(getLicenseFilePath()); } catch {}
      return false;
    }

    // Online validate ke waqt expiresAt aur modules locally save kar lo
    saveLicenseCache(savedKey, licenseData.expiresAt ?? null);
    if (licenseData.modules) saveModulesCache(savedKey, licenseData.modules);

    return true;
  } catch {
    // Offline mode: local key hai toh valid mano — LEKIN local expiry check karo
    if (isLocallyExpired(savedKey)) {
      console.warn('[License] Offline — locally cached expiry date guzar chuki hai. Access denied.');
      return false;
    }
    return true;
  }
}

// 2. IPC Communication Handlers
export function registerLicenseIpc(): void {
  // Status check IPC
  ipcMain.handle('license:status', async () => {
    return await isLicenseActivated();
  });

  // Modules fetch IPC
  ipcMain.handle('license:modules', async () => {
    return await getLicenseModules();
  });

  // Activation IPC
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

      const res = (await response.json()) as ApiResponse<ApiLicenseData> & { ok?: boolean; error?: string };

      // API ya toh { success: true, data: [...] } ya { ok: true } bhejta hai — dono handle karo
      const activated = res.success === true || res.ok === true;
      const licenseData = res.data?.[0];

      if (activated) {
        writeFileSync(getLicenseFilePath(), formattedKey, 'utf-8');
        // Activation ke waqt expiresAt aur modules locally save karo
        const expiresAt = licenseData?.expiresAt ?? null;
        saveLicenseCache(formattedKey, expiresAt);
        if (licenseData?.modules) saveModulesCache(formattedKey, licenseData.modules);
        try { unlinkSync(getModulesCacheFilePath()); } catch {}
        return { ok: true };
      }

      return { ok: false, error: res.error || res.message || 'Activation failed.' };
    } catch {
      return { ok: false, error: 'Cannot connect to server. Check your internet connection.' };
    }
  });

  // License info IPC — renderer expiry date dikhane ke liye
  ipcMain.handle('license:info', () => {
    const key = getSavedKey();
    if (!key) return null;
    return getLicenseCache(key);
  });
}
