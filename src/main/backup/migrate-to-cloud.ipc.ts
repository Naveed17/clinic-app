import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { getPrisma } from '../database/client';
import { getSettings, isOnlineDatabaseMode, resolveOnlineApiOrigin } from '../config/settings';
import { getLicenseRuntimeMeta } from '../license/license.ipc';
import { getDocsDir, getDocumentsRoot, resolveDocPath } from './docs-paths';
import { putPresignedObject } from './documents.ipc';

const BATCH = 40;
const INLINE_MAX = 1_800_000;

export const TABLES = [
  'User',
  'DoctorProfile',
  'DoctorSchedule',
  'DoctorAttendance',
  'Patient',
  'Medicine',
  'MedicineBatch',
  'Appointment',
  'Token',
  'Prescription',
  'Invoice',
  'InvoiceItem',
  'Payment',
  'LabOrder',
] as const;

export const TABLE_LABELS: Record<(typeof TABLES)[number], string> = {
  User: 'Users',
  DoctorProfile: 'Doctors',
  DoctorSchedule: 'Schedules',
  DoctorAttendance: 'Attendance',
  Patient: 'Patients',
  Medicine: 'Medicines',
  MedicineBatch: 'Medicine batches',
  Appointment: 'Appointments',
  Token: 'Tokens',
  Prescription: 'Prescriptions',
  Invoice: 'Invoices',
  InvoiceItem: 'Invoice items',
  Payment: 'Payments',
  LabOrder: 'Lab orders',
};

export type MigrateProgress = {
  percent: number;
  label: string;
};

type ProgressCb = (progress: MigrateProgress) => void;

type JsonRow = Record<string, unknown>;

import { getClinicDbPath } from '../database/client';

function dbPath(): string {
  return getClinicDbPath();
}

function apiOrigin(): string {
  const meta = getLicenseRuntimeMeta();
  return resolveOnlineApiOrigin(meta.clinicalApiUrl || getSettings().clinicalApiUrl);
}

function jsonHeaders(): Record<string, string> {
  const meta = getLicenseRuntimeMeta();
  return {
    'Content-Type': 'application/json',
    ...(meta.key ? { 'x-license-key': meta.key } : {}),
    ...(meta.schemaId ? { 'x-schema-id': meta.schemaId } : {}),
    ...(meta.hwid ? { 'x-hwid': meta.hwid } : {}),
  };
}

export async function clinicMigrateApi<T>(path: string, init?: RequestInit): Promise<T> {
  const origin = apiOrigin();
  if (!origin) throw new Error('Online API URL is missing. Activate the license with Online DB first.');
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: { ...jsonHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Copy API not found on ${origin}. Restart CareFlow so Online DB uses the cloud API, then try again.`,
      );
    }
    const body = parsed as { message?: unknown; error?: unknown };
    const msg = Array.isArray(body?.message)
      ? body.message.map(String).join(' ')
      : String(body?.message || body?.error || raw || `HTTP ${response.status}`);
    throw new Error(msg);
  }
  return parsed as T;
}

const api = clinicMigrateApi;

function plain(row: unknown): JsonRow {
  return JSON.parse(
    JSON.stringify(row, (_key, value) => {
      if (typeof value === 'bigint') return Number(value);
      if (value && typeof value === 'object' && 'toNumber' in value) {
        try {
          return (value as { toNumber: () => number }).toNumber();
        } catch {
          return String(value);
        }
      }
      return value;
    }),
  ) as JsonRow;
}

function remap(id: unknown, from: string | null, to: string | null): unknown {
  if (!from || !to || from === to) return id;
  return id === from ? to : id;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function chunkByPayload(rows: JsonRow[], maxBytes = 700_000): JsonRow[][] {
  const out: JsonRow[][] = [];
  let current: JsonRow[] = [];
  let bytes = 2;
  for (const row of rows) {
    const size = Buffer.byteLength(JSON.stringify(row), 'utf8') + 1;
    if (current.length && bytes + size > maxBytes) {
      out.push(current);
      current = [];
      bytes = 2;
    }
    if (size > maxBytes) {
      if (current.length) {
        out.push(current);
        current = [];
        bytes = 2;
      }
      out.push([row]);
      continue;
    }
    current.push(row);
    bytes += size;
    if (current.length >= BATCH) {
      out.push(current);
      current = [];
      bytes = 2;
    }
  }
  if (current.length) out.push(current);
  return out;
}

async function loadTable(name: (typeof TABLES)[number]): Promise<JsonRow[]> {
  const db = getPrisma();
  try {
    switch (name) {
      case 'User': {
        const rows = await db.$queryRawUnsafe<JsonRow[]>('SELECT * FROM "User"');
        return rows.map(plain).map((row) => embedImageFields(row, ['avatar']));
      }
      case 'DoctorProfile':
        return (await db.doctorProfile.findMany()).map(plain).map((row) => embedImageFields(row, ['avatar']));
      case 'DoctorSchedule':
        return (await db.doctorSchedule.findMany()).map(plain);
      case 'DoctorAttendance':
        return (await db.doctorAttendance.findMany()).map(plain);
      case 'Patient':
        return (await db.patient.findMany()).map(plain);
      case 'Medicine':
        return (await db.medicine.findMany()).map(plain);
      case 'MedicineBatch':
        return (await db.medicineBatch.findMany()).map(plain);
      case 'Appointment':
        return (await db.appointment.findMany()).map(plain);
      case 'Token':
        return (await db.token.findMany()).map(plain);
      case 'Prescription': {
        const rows = await db.$queryRawUnsafe<JsonRow[]>('SELECT * FROM "Prescription"');
        return rows.map(plain).map((row) => embedImageFields(row, ['thumbnail']));
      }
      case 'Invoice':
        return (await db.invoice.findMany()).map(plain);
      case 'InvoiceItem':
        return (await db.invoiceItem.findMany()).map(plain);
      case 'Payment':
        return (await db.payment.findMany()).map(plain);
      case 'LabOrder':
        return (await db.labOrder.findMany()).map(plain);
      default:
        return [];
    }
  } catch {
    return [];
  }
}

function applyUserRemap(table: string, rows: JsonRow[], from: string | null, to: string | null): JsonRow[] {
  if (!from || !to || from === to) return rows;
  return rows
    .filter((row) => !(table === 'User' && row.id === from))
    .map((row) => {
      const next = { ...row };
      if (table === 'User' && next.id === from) next.id = to;
      if ('userId' in next) next.userId = remap(next.userId, from, to);
      if ('doctorId' in next) next.doctorId = remap(next.doctorId, from, to);
      if ('providerId' in next) next.providerId = remap(next.providerId, from, to);
      if ('orderedById' in next) next.orderedById = remap(next.orderedById, from, to);
      if ('primaryDoctorId' in next) next.primaryDoctorId = remap(next.primaryDoctorId, from, to);
      return next;
    });
}

function mimeFromPath(filePath: string, fallback: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
  if (lower.endsWith('.webp')) return 'webp';
  return fallback || 'bin';
}

function dataUrlFromFile(absolute: string): string | null {
  if (!existsSync(absolute)) return null;
  const buf = readFileSync(absolute);
  const ext = mimeFromPath(absolute, 'bin');
  const mime =
    ext === 'png' ? 'image/png'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'webp' ? 'image/webp'
    : ext === 'pdf' ? 'application/pdf'
    : 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function looksLikePath(value: unknown): value is string {
  const text = String(value || '');
  if (!text || text.startsWith('data:')) return false;
  return /documents[/\\]/i.test(text) || /[/\\]/.test(text) || /\.(png|jpe?g|webp|pdf)$/i.test(text);
}

function embedImageFields(row: JsonRow, keys: string[]): JsonRow {
  const next = { ...row };
  for (const key of keys) {
    if (!looksLikePath(next[key])) continue;
    const found = findLocalFile(String(next[key]), '', '', String(row.id || ''));
    if (!found) continue;
    const dataUrl = dataUrlFromFile(found);
    if (dataUrl) next[key] = dataUrl;
  }
  return next;
}

function findLocalFile(storedPath: string, kind: string, ownerId: string, id: string): string | null {
  const tries: string[] = [];
  if (storedPath) {
    tries.push(resolveDocPath(storedPath), storedPath);
  }
  const sub = kind === 'lab' ? `lab/${ownerId}` : kind === 'patient' ? `patients/${ownerId}` : '';
  if (sub && id) {
    const dir = getDocsDir(sub);
    if (existsSync(dir)) {
      for (const name of readdirSync(dir)) {
        if (name.startsWith(id) || (storedPath && name === storedPath.split(/[/\\]/).pop())) {
          tries.push(join(dir, name));
        }
      }
    }
  }
  if (id) {
    const root = getDocumentsRoot();
    scanForId(root, id, tries, 0);
  }
  for (const candidate of tries) {
    if (candidate && existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function scanForId(dir: string, id: string, out: string[], depth: number): void {
  if (depth > 4 || !existsSync(dir)) return;
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) scanForId(full, id, out, depth + 1);
    else if (name.startsWith(id)) out.push(full);
  }
}

export type MigrateToCloudResult = {
  ok: boolean;
  error?: string;
  imported?: Record<string, number>;
  files?: { uploaded: number; skipped: number; failed: number };
};

export async function migrateLocalToCloud(onProgress?: ProgressCb): Promise<MigrateToCloudResult> {
  const report = (percent: number, label: string) => {
    onProgress?.({ percent: Math.min(100, Math.max(0, Math.round(percent))), label });
  };

  if (!isOnlineDatabaseMode()) {
    return { ok: false, error: 'Turn on Online Database for this license first, then migrate.' };
  }
  if (!existsSync(dbPath())) {
    return { ok: false, error: 'No local clinic.db found on this PC.' };
  }

  report(1, 'Starting…');

  const db = getPrisma();
  const localUsers = await db.user.findMany();
  const localAdmin =
    localUsers.find((u) => u.email.toLowerCase() === 'admin@clinic.com') ||
    localUsers.find((u) => String(u.role).toUpperCase() === 'ADMIN') ||
    null;

  report(3, 'Preparing Online DB…');
  const begin = await api<{
    empty: boolean;
    seedAdminId: string | null;
    remapFrom: string | null;
    patientCount: number;
  }>('/api/clinic/migrate/begin', {
    method: 'POST',
    body: JSON.stringify({
      localAdmin: localAdmin
        ? {
            id: localAdmin.id,
            firstName: localAdmin.firstName,
            lastName: localAdmin.lastName,
            email: localAdmin.email,
            passwordHash: localAdmin.passwordHash,
            isActive: localAdmin.isActive,
            role: localAdmin.role,
          }
        : null,
    }),
  });

  const remapFrom = begin.remapFrom || null;
  const remapTo = begin.seedAdminId || null;
  const imported: Record<string, number> = {};

  report(6, 'Reading local data…');
  const loaded: { table: (typeof TABLES)[number]; rows: JsonRow[] }[] = [];
  for (const table of TABLES) {
    const rows = applyUserRemap(table, await loadTable(table), remapFrom, remapTo);
    loaded.push({ table, rows });
    report(6 + Math.round((loaded.length / TABLES.length) * 8), `Reading ${TABLE_LABELS[table]}…`);
  }

  const patientDocs = await db.patientDocument.findMany();
  const labReports = await db.labReport.findMany();
  const fileTotal = patientDocs.length + labReports.length;
  const tableBatches = loaded.map(({ table, rows }) => ({
    table,
    batches: chunkByPayload(rows),
  }));
  const transferSteps =
    tableBatches.reduce((n, item) => n + Math.max(1, item.batches.length), 0) +
    fileTotal +
    1;

  let done = 0;
  const bump = (label: string) => {
    done += 1;
    const percent = 14 + Math.round((done / Math.max(1, transferSteps)) * 85);
    report(Math.min(99, percent), label);
  };

  for (const item of tableBatches) {
    imported[item.table] = 0;
    const label = TABLE_LABELS[item.table];
    if (!item.batches.length) {
      bump(`${label} — nothing to copy`);
      continue;
    }
    for (const part of item.batches) {
      const result = await api<{ inserted: number }>('/api/clinic/migrate/rows', {
        method: 'POST',
        body: JSON.stringify({ table: item.table, rows: part }),
      });
      imported[item.table] += Number(result.inserted || 0);
      bump(`${label} — ${imported[item.table]} rows`);
    }
  }

  const files = { uploaded: 0, skipped: 0, failed: 0 };
  let fileDone = 0;
  for (const doc of patientDocs) {
    const result = await uploadLocalFile({
      kind: 'patient',
      ownerId: doc.patientId,
      id: doc.id,
      name: doc.name,
      mimeType: doc.mimeType || mimeFromPath(doc.filePath, 'bin'),
      size: doc.size,
      storedPath: doc.filePath,
    });
    files[result] += 1;
    fileDone += 1;
    bump(`Patient documents — ${fileDone}/${fileTotal}`);
  }
  for (const doc of labReports) {
    const result = await uploadLocalFile({
      kind: 'lab',
      ownerId: doc.labOrderId,
      id: doc.id,
      name: doc.name,
      mimeType: doc.mimeType || mimeFromPath(doc.filePath, 'bin'),
      size: doc.size,
      storedPath: doc.filePath,
    });
    files[result] += 1;
    fileDone += 1;
    bump(`Lab reports — ${fileDone}/${fileTotal}`);
  }

  const settings = getSettings();
  await api('/api/clinic/migrate/meta', {
    method: 'POST',
    body: JSON.stringify({
      clinicName: settings.clinicName || '',
      clinicAddress: settings.clinicAddress || '',
      clinicPhone: settings.clinicPhone || '',
      clinicLogo: settings.clinicLogo || '',
    }),
  });
  bump('Clinic settings');
  report(100, 'Done');

  return { ok: true, imported, files };
}

async function uploadLocalFile(input: {
  kind: 'patient' | 'lab';
  ownerId: string;
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storedPath: string;
}): Promise<'uploaded' | 'skipped' | 'failed'> {
  const absolute = findLocalFile(input.storedPath, input.kind, input.ownerId, input.id);
  if (!absolute) {
    console.warn('[migrate] file missing', input.kind, input.id, input.storedPath);
    return 'skipped';
  }
  try {
    const buffer = readFileSync(absolute);
    const mimeType = input.mimeType || mimeFromPath(absolute, extname(absolute).replace('.', '') || 'bin');
    const begin = await api<{
      storage?: string;
      uploadUrl?: string;
      contentType?: string;
      maxBytes?: number;
    }>('/api/clinic/migrate/file-begin', {
      method: 'POST',
      body: JSON.stringify({
        kind: input.kind,
        ownerId: input.ownerId,
        id: input.id,
        name: input.name,
        mimeType,
        size: buffer.length,
      }),
    });

    if (begin.storage === 'r2' && begin.uploadUrl) {
      const put = await putPresignedObject(begin.uploadUrl, buffer, begin.contentType || 'application/octet-stream');
      if (!put.ok) {
        console.warn('[migrate] R2 put failed', input.id, put.error);
        return 'failed';
      }
      return 'uploaded';
    }

    if (buffer.length > INLINE_MAX) {
      console.warn('[migrate] file too large for inline', input.id, buffer.length);
      return 'skipped';
    }
    await api('/api/clinic/migrate/file', {
      method: 'POST',
      body: JSON.stringify({
        kind: input.kind,
        ownerId: input.ownerId,
        id: input.id,
        name: input.name,
        mimeType,
        size: buffer.length,
        fileData: buffer.toString('base64'),
      }),
    });
    return 'uploaded';
  } catch (err) {
    console.warn('[migrate] file upload failed', input.id, (err as Error).message);
    return 'failed';
  }
}

export function registerMigrateToCloudIpc(): void {
  ipcMain.removeHandler('backup:migrate-to-cloud');
  ipcMain.handle('backup:migrate-to-cloud', async (event: IpcMainInvokeEvent) => {
    const send = (progress: MigrateProgress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('backup:migrate-progress', progress);
      }
    };
    try {
      return await migrateLocalToCloud(send);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Migration failed.' };
    }
  });
}
