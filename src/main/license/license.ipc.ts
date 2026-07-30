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

type ModulesCache = {
  key: string;
  modules: Record<string, boolean>;
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
    const data = (await response.json()) as { ok: boolean; modules?: Record<string, boolean> };
    if (!data.ok || !data.modules) return getCachedModules(savedKey);

    saveModulesCache(savedKey, data.modules);
    return data.modules;
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: savedKey, hwid }),
    });

    const data = (await response.json()) as { valid: boolean };

    if (!data.valid) {
      try {
        unlinkSync(getLicenseFilePath());
      } catch {}
      return false;
    }

    return true;
  } catch {
    // Offline mode support: server drop hone par local key valid manna
    return savedKey !== null;
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: formattedKey, hwid, deviceName }), 
      });

      const data = (await response.json()) as { ok: boolean; error?: string };

      if (data.ok) {
        writeFileSync(getLicenseFilePath(), formattedKey, 'utf-8');
        try {
          unlinkSync(getModulesCacheFilePath());
        } catch {}
        return { ok: true };
      }

      return { ok: false, error: data.error || 'Activation failed.' };
    } catch {
      return { ok: false, error: 'Cannot connect to server. Check your internet connection.' };
    }
  });
}
