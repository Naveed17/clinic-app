import { readFileSync, statSync } from 'node:fs';

/**
 * Small cache for config files read on hot paths (license key, license cache, settings).
 * getPrisma() / getSettings() used to readFileSync + JSON.parse these on every call.
 * Entries are keyed by mtime + size, so a write from anywhere invalidates them; our own
 * writers also call invalidateFileCache() to be safe within the same mtime tick.
 */
type Entry = { mtimeMs: number; size: number; text: string; json?: unknown; jsonOk?: boolean };
const cache = new Map<string, Entry>();

function load(path: string): Entry | null {
  let st;
  try {
    st = statSync(path);
  } catch {
    cache.delete(path);
    return null;
  }
  const hit = cache.get(path);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit;
  try {
    const entry: Entry = { mtimeMs: st.mtimeMs, size: st.size, text: readFileSync(path, 'utf-8') };
    cache.set(path, entry);
    return entry;
  } catch {
    cache.delete(path);
    return null;
  }
}

/** File text, or null when missing / unreadable. */
export function readCachedText(path: string): string | null {
  return load(path)?.text ?? null;
}

/** Parsed JSON (shallow copy for objects so callers cannot mutate the cache), or null. */
export function readCachedJson<T>(path: string): T | null {
  const entry = load(path);
  if (!entry) return null;
  if (entry.jsonOk === undefined) {
    try {
      entry.json = JSON.parse(entry.text);
      entry.jsonOk = true;
    } catch {
      entry.jsonOk = false;
    }
  }
  if (!entry.jsonOk) return null;
  const value = entry.json;
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...(value as object) } as T;
  return value as T;
}

export function invalidateFileCache(path?: string): void {
  if (path) cache.delete(path);
  else cache.clear();
}
