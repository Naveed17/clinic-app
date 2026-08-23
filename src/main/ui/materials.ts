import { release } from 'node:os';

export type MaterialsOs = 'win11' | 'win10' | 'other';

export type MaterialsCapability = {
  mica: boolean;
  acrylic: boolean;
  os: MaterialsOs;
};

function windowsBuildNumber(): number {
  if (process.platform !== 'win32') return 0;
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(release());
  return match ? Number(match[3]) : 0;
}

/** Windows 11 starts at build 22000 — required for native Mica. */
export function getMaterialsCapability(): MaterialsCapability {
  if (process.platform !== 'win32') {
    return { mica: false, acrylic: true, os: 'other' };
  }
  const win11 = windowsBuildNumber() >= 22000;
  return {
    mica: win11,
    acrylic: true,
    os: win11 ? 'win11' : 'win10',
  };
}
