import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import AdmZip from 'adm-zip';
import { disconnectPrisma, getPrisma, getClinicDbPath } from '../database/client';
import { getDocumentsRoot } from './docs-paths';

export { getClinicDbPath };

export function defaultBackupFileName(at = new Date()): string {
  const stamp = at.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  return `careflow-backup-${stamp}.zip`;
}

export async function writeBackupZip(zipPath: string): Promise<void> {
  await disconnectPrisma();
  try {
    const zip = new AdmZip();
    zip.addFile('clinic.db', readFileSync(getClinicDbPath()));

    const docsRoot = getDocumentsRoot();
    if (existsSync(docsRoot) && readdirSync(docsRoot).length > 0) {
      zip.addLocalFolder(docsRoot, 'documents');
    }

    mkdirSync(dirname(zipPath), { recursive: true });
    zip.writeZip(zipPath);
  } finally {
    getPrisma();
  }
}

export function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    const to = join(dest, name);
    if (statSync(from).isDirectory()) {
      copyDirRecursive(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}
