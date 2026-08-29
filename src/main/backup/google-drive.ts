import { app, shell } from 'electron';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isOnlineDatabaseMode } from '../config/settings';
import { defaultBackupFileName, writeBackupZip } from './backup-zip';

const LICENSE_API = process.env.API_BASE_URL || 'https://clinic-license-six.vercel.app/api';
const FOLDER_NAME = 'CareFlow Backups';
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
].join(' ');

export type DriveSchedule = 'off' | 'daily' | 'weekly' | 'monthly';

export type GoogleDriveStatus = {
  connected: boolean;
  email: string;
  schedule: DriveSchedule;
  lastBackupAt: string | null;
  configured: boolean;
};

type DriveState = {
  refreshToken: string;
  email: string;
  folderId: string;
  schedule: DriveSchedule;
  lastBackupAt: string | null;
};

let connectInFlight: Promise<{ ok: boolean; email?: string; error?: string; canceled?: boolean }> | null = null;
let schedulerStarted = false;
let backupInFlight = false;

function statePath(): string {
  return join(app.getPath('userData'), 'google-drive.json');
}

function readState(): DriveState | null {
  try {
    if (!existsSync(statePath())) return null;
    const raw = JSON.parse(readFileSync(statePath(), 'utf-8')) as Partial<DriveState>;
    if (!raw.refreshToken || !raw.email) return null;
    return {
      refreshToken: String(raw.refreshToken),
      email: String(raw.email),
      folderId: String(raw.folderId || ''),
      schedule: raw.schedule === 'daily' || raw.schedule === 'weekly' || raw.schedule === 'monthly' ? raw.schedule : 'off',
      lastBackupAt: raw.lastBackupAt ? String(raw.lastBackupAt) : null,
    };
  } catch {
    return null;
  }
}

function writeState(next: DriveState): void {
  writeFileSync(statePath(), JSON.stringify(next, null, 2), 'utf-8');
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

const DEFAULT_GOOGLE_CLIENT_ID = '1081559817743-careflowdesktopbackup.apps.googleusercontent.com';

type GoogleClientConfig = {
  clientId: string;
  clientSecret?: string;
};

async function fetchGoogleClientConfig(): Promise<GoogleClientConfig> {
  const fromEnvId = String(process.env.GOOGLE_DRIVE_CLIENT_ID || '').trim();
  const fromEnvSecret = String(process.env.GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
  if (fromEnvId) {
    return { clientId: fromEnvId, ...(fromEnvSecret ? { clientSecret: fromEnvSecret } : {}) };
  }
  try {
    const response = await fetch(`${LICENSE_API}/backup/google/config`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const data = (await response.json()) as { clientId?: string; clientSecret?: string };
      const apiId = String(data.clientId || '').trim();
      const apiSecret = String(data.clientSecret || '').trim();
      if (apiId) return { clientId: apiId, ...(apiSecret ? { clientSecret: apiSecret } : {}) };
    }
  } catch {
    /* fallback to default zero-config client */
  }
  return { clientId: DEFAULT_GOOGLE_CLIENT_ID };
}

async function fetchGoogleClientId(): Promise<string> {
  const config = await fetchGoogleClientConfig();
  return config.clientId;
}

async function googleJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { error: text };
  }
  if (!response.ok) {
    const err = data.error;
    const desc = data.error_description ? String(data.error_description) : '';
    const message =
      typeof err === 'object' && err && 'message' in err
        ? String((err as { message?: string }).message)
        : typeof err === 'string'
          ? (desc ? `${err}: ${desc}` : err)
          : (desc || `Google API ${response.status}`);
    console.error(`[GoogleDrive] Request to ${url} failed (${response.status}):`, text);
    throw new Error(message);
  }
  return data;
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret?: string): Promise<string> {
  const params: Record<string, string> = {
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };
  if (clientSecret) params.client_secret = clientSecret;
  const body = new URLSearchParams(params);
  const data = await googleJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const token = String(data.access_token || '');
  if (!token) throw new Error('Google did not return an access token.');
  return token;
}

async function ensureFolder(accessToken: string, existingId: string): Promise<string> {
  if (existingId) {
    const check = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existingId)}?fields=id,trashed`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (check.ok) {
      const file = (await check.json()) as { id?: string; trashed?: boolean };
      if (file.id && !file.trashed) return file.id;
    }
  }
  const q = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listed = await googleJson(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const files = Array.isArray(listed.files) ? (listed.files as Array<{ id?: string }>) : [];
  if (files[0]?.id) return String(files[0].id);

  const created = await googleJson('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const id = String(created.id || '');
  if (!id) throw new Error('Could not create the CareFlow Backups folder.');
  return id;
}

async function uploadZip(accessToken: string, folderId: string, filePath: string, fileName: string): Promise<void> {
  const start = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/zip',
    },
    body: JSON.stringify({
      name: fileName,
      parents: [folderId],
    }),
  });
  if (!start.ok) {
    const text = await start.text();
    throw new Error(text || `Google upload failed (${start.status}).`);
  }
  const location = start.headers.get('location');
  if (!location) throw new Error('Google did not return an upload URL.');
  const bytes = readFileSync(filePath);
  const put = await fetch(location, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip', 'Content-Length': String(bytes.length) },
    body: bytes,
  });
  if (!put.ok) {
    const text = await put.text();
    throw new Error(text || `Google upload failed (${put.status}).`);
  }
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title></head><body style="font-family:Inter,Arial,sans-serif;padding:40px;text-align:center"><h2>${title}</h2><p>${body}</p></body></html>`;
}

export async function getGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  const state = readState();
  const clientId = await fetchGoogleClientId();
  return {
    connected: Boolean(state?.refreshToken),
    email: state?.email || '',
    schedule: state?.schedule || 'off',
    lastBackupAt: state?.lastBackupAt || null,
    configured: Boolean(clientId),
  };
}

export async function connectGoogleDrive(): Promise<{
  ok: boolean;
  email?: string;
  error?: string;
  canceled?: boolean;
}> {
  if (connectInFlight) return connectInFlight;
  connectInFlight = (async () => {
    const clientId = await fetchGoogleClientId();
    if (!clientId) {
      return {
        ok: false,
        error: 'Google Drive is not configured yet. Add GOOGLE_DRIVE_CLIENT_ID on the license server.',
      };
    }
    const verifier = base64url(randomBytes(32));
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    const stateNonce = base64url(randomBytes(16));
    let redirectUri = '';

    const result = await new Promise<{ code: string } | { canceled: true } | { error: string }>((resolve) => {
      let settled = false;
      const finish = (value: { code: string } | { canceled: true } | { error: string }) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end();
          return;
        }
        const err = url.searchParams.get('error');
        const returnedState = url.searchParams.get('state') || '';
        const code = url.searchParams.get('code') || '';
        if (err) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(htmlPage('Connection cancelled', 'You can close this tab and return to CareFlow.'));
          server.close();
          finish({ canceled: true });
          return;
        }
        if (!code || returnedState !== stateNonce) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(htmlPage('Could not connect', 'Try Connect Google Drive again from CareFlow.'));
          server.close();
          finish({ error: 'Google sign-in did not finish. Try again.' });
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlPage('Google Drive connected', 'You can close this tab and return to CareFlow.'));
        server.close();
        finish({ code });
      });
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          server.close();
          finish({ error: 'Could not start Google sign-in.' });
          return;
        }
        redirectUri = `http://127.0.0.1:${address.port}/callback`;
        const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        auth.searchParams.set('client_id', clientId);
        auth.searchParams.set('redirect_uri', redirectUri);
        auth.searchParams.set('response_type', 'code');
        auth.searchParams.set('scope', SCOPES);
        auth.searchParams.set('access_type', 'offline');
        auth.searchParams.set('prompt', 'consent');
        auth.searchParams.set('code_challenge', challenge);
        auth.searchParams.set('code_challenge_method', 'S256');
        auth.searchParams.set('state', stateNonce);
        void shell.openExternal(auth.toString()).catch(() => {
          server.close();
          finish({ error: 'Could not open the Google sign-in page.' });
        });
      });
      setTimeout(() => {
        try {
          server.close();
        } catch {
          /* ignore */
        }
        finish({ error: 'Google sign-in timed out. Try again.' });
      }, 5 * 60 * 1000);
    });

    if ('canceled' in result) return { ok: false, canceled: true };
    if ('error' in result) return { ok: false, error: result.error };

    try {
      const config = await fetchGoogleClientConfig();
      console.log('[GoogleDrive] Exchanging code with redirectUri:', redirectUri, 'clientId:', clientId.slice(0, 15) + '...', 'hasSecret:', !!config.clientSecret);
      const params: Record<string, string> = {
        client_id: clientId,
        code: result.code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      };
      if (config.clientSecret) params.client_secret = config.clientSecret;
      const tokenBody = new URLSearchParams(params);
      const tokens = await googleJson('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });
      const refreshToken = String(tokens.refresh_token || '');
      const accessToken = String(tokens.access_token || '');
      const idToken = String(tokens.id_token || '');
      if (!refreshToken || !accessToken) {
        console.error('[GoogleDrive] Tokens missing:', { hasRefresh: !!refreshToken, hasAccess: !!accessToken });
        return { ok: false, error: 'Google did not return a refresh token. Try Connect again.' };
      }

      let email = '';
      try {
        const me = await googleJson('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        email = String(me.email || '').trim();
      } catch (e) {
        console.warn('[GoogleDrive] Failed fetching userinfo endpoint, trying id_token fallback:', e);
      }

      // Fallback: extract email from id_token if userinfo didn't return it
      if (!email && idToken) {
        try {
          const parts = idToken.split('.');
          if (parts[1]) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as { email?: string };
            email = String(payload.email || '').trim();
          }
        } catch (e) {
          console.warn('[GoogleDrive] Failed extracting email from id_token:', e);
        }
      }

      if (!email) {
        console.error('[GoogleDrive] Google account email was not found in userinfo or id_token');
        return { ok: false, error: 'Google account email was not returned.' };
      }

      const folderId = await ensureFolder(accessToken, '');
      const previous = readState();
      writeState({
        refreshToken,
        email,
        folderId,
        schedule: previous?.schedule && previous.schedule !== 'off' ? previous.schedule : 'daily',
        lastBackupAt: previous?.lastBackupAt || null,
      });
      console.log('[GoogleDrive] Successfully connected & stored state for email:', email);
      return { ok: true, email };
    } catch (error) {
      console.error('[GoogleDrive] connectGoogleDrive error:', error);
      return { ok: false, error: error instanceof Error ? error.message : 'Google Drive connect failed.' };
    }
  })().finally(() => {
    connectInFlight = null;
  });
  return connectInFlight;
}

export function disconnectGoogleDrive(): DriveState | null {
  try {
    if (existsSync(statePath())) unlinkSync(statePath());
  } catch {
    /* ignore */
  }
  return readState();
}

export function setGoogleDriveSchedule(schedule: DriveSchedule): DriveState | null {
  const state = readState();
  if (!state) return null;
  writeState({ ...state, schedule });
  return readState();
}

export async function backupToGoogleDriveNow(): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (isOnlineDatabaseMode()) {
    return { ok: false, error: 'Google Drive backup is for local database mode.' };
  }
  if (backupInFlight) return { ok: false, error: 'A Google Drive backup is already running.' };
  const state = readState();
  if (!state) return { ok: false, error: 'Connect Google Drive first.' };
  backupInFlight = true;
  const tmp = join(tmpdir(), defaultBackupFileName());
  try {
    const config = await fetchGoogleClientConfig();
    if (!config.clientId) return { ok: false, error: 'Google Drive is not configured yet.' };
    const accessToken = await refreshAccessToken(state.refreshToken, config.clientId, config.clientSecret);
    const folderId = await ensureFolder(accessToken, state.folderId);
    await writeBackupZip(tmp);
    const name = defaultBackupFileName();
    await uploadZip(accessToken, folderId, tmp, name);
    writeState({
      ...state,
      folderId,
      lastBackupAt: new Date().toISOString(),
    });
    return { ok: true, name };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.toLowerCase().includes('invalid_grant') || errMsg.toLowerCase().includes('token has been expired or revoked')) {
      disconnectGoogleDrive();
    }
    return { ok: false, error: errMsg || 'Google Drive backup failed.' };
  } finally {
    backupInFlight = false;
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function dueForSchedule(state: DriveState, now = new Date()): boolean {
  if (state.schedule === 'off') return false;
  if (!state.lastBackupAt) return true;
  const last = new Date(state.lastBackupAt);
  if (Number.isNaN(last.getTime())) return true;
  const ms = now.getTime() - last.getTime();
  if (state.schedule === 'daily') return ms >= 20 * 60 * 60 * 1000;
  if (state.schedule === 'weekly') return ms >= 6.5 * 24 * 60 * 60 * 1000;
  return last.getUTCFullYear() !== now.getUTCFullYear() || last.getUTCMonth() !== now.getUTCMonth();
}

async function runScheduledBackup(): Promise<void> {
  if (isOnlineDatabaseMode()) return;
  const state = readState();
  if (!state || !dueForSchedule(state)) return;
  await backupToGoogleDriveNow();
}

export type GoogleDriveBackupFile = {
  id: string;
  name: string;
  size: number;
  createdTime: string;
};

export async function listGoogleDriveBackups(): Promise<{ ok: boolean; files?: GoogleDriveBackupFile[]; error?: string }> {
  const state = readState();
  if (!state) return { ok: false, error: 'Google Drive is not connected.' };
  try {
    const config = await fetchGoogleClientConfig();
    if (!config.clientId) return { ok: false, error: 'Google Drive is not configured.' };
    const accessToken = await refreshAccessToken(state.refreshToken, config.clientId, config.clientSecret);
    const folderId = await ensureFolder(accessToken, state.folderId);
    const q = `'${folderId}' in parents and trashed=false`;
    const res = await googleJson(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const rawFiles = Array.isArray(res.files) ? (res.files as Array<{ id?: string; name?: string; size?: string | number; createdTime?: string }>) : [];
    const files: GoogleDriveBackupFile[] = rawFiles.map((f) => ({
      id: String(f.id || ''),
      name: String(f.name || ''),
      size: Number(f.size || 0),
      createdTime: String(f.createdTime || ''),
    }));
    return { ok: true, files };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to list Drive backups.' };
  }
}

export async function downloadGoogleDriveBackup(
  fileId: string,
  destPath: string,
  onProgress?: (percent: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  const state = readState();
  if (!state) return { ok: false, error: 'Google Drive is not connected.' };
  try {
    const config = await fetchGoogleClientConfig();
    if (!config.clientId) return { ok: false, error: 'Google Drive is not configured.' };
    const accessToken = await refreshAccessToken(state.refreshToken, config.clientId, config.clientSecret);

    onProgress?.(10);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: text || `Failed to download file (${response.status})` };
    }

    const totalBytes = Number(response.headers.get('content-length') || 0);
    onProgress?.(30);

    const arrayBuf = await response.arrayBuffer();
    onProgress?.(80);

    const buffer = Buffer.from(arrayBuf);
    writeFileSync(destPath, buffer);
    onProgress?.(100);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Download failed.' };
  }
}

export function startGoogleDriveBackupScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  mkdirSync(app.getPath('userData'), { recursive: true });
  setTimeout(() => {
    void runScheduledBackup();
  }, 20_000);
  setInterval(() => {
    void runScheduledBackup();
  }, 15 * 60 * 1000);
}
