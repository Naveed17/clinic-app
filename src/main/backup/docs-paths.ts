import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

/** Absolute path to CareFlow userData/documents */
export function getDocumentsRoot(): string {
  const dir = join(app.getPath('userData'), 'documents');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDocsDir(sub: string): string {
  const dir = join(getDocumentsRoot(), sub);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Store relative paths like `documents/patients/<id>/<file>` so backups
 * work across machines. Absolute legacy paths are still accepted.
 */
export function toStoredDocPath(absolutePath: string): string {
  const userData = normalize(app.getPath('userData'));
  const abs = normalize(absolutePath);
  if (abs.toLowerCase().startsWith(userData.toLowerCase() + sep)) {
    return abs.slice(userData.length + 1).split(/[/\\]/).join('/');
  }
  const marker = abs.match(/[\\/]documents[\\/].+$/i);
  if (marker) {
    return marker[0].replace(/^[\\/]+/, '').split(/[/\\]/).join('/');
  }
  return abs;
}

/** Resolve stored path (relative or absolute) to an absolute file path. */
export function resolveDocPath(stored: string): string {
  if (!stored) return stored;
  const userData = app.getPath('userData');
  const normalized = stored.replace(/\//g, sep);

  // Relative under userData (preferred)
  if (
    normalized.startsWith(`documents${sep}`) ||
    normalized.startsWith('documents/') ||
    normalized === 'documents'
  ) {
    return join(userData, normalized);
  }

  // Absolute path that still exists
  if (existsSync(stored)) return stored;

  // Absolute from another machine — remap .../documents/...
  const marker = stored.match(/[\\/]documents[\\/].+$/i);
  if (marker) {
    const relative = marker[0].replace(/^[\\/]+/, '');
    return join(userData, relative);
  }

  return join(userData, normalized);
}
