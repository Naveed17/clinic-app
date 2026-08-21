import { writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { getPrisma, initializeDatabase } from '../database/client';
import { isOnlineDatabaseMode, saveSettings } from '../config/settings';
import { seedDefaultAdmin } from '../auth/seed';
import { getDocsDir, toStoredDocPath } from './docs-paths';
import {
  clinicMigrateApi,
  TABLE_LABELS,
  TABLES,
  type MigrateProgress,
} from './migrate-to-cloud.ipc';

const BATCH = 40;

const WIPE_TABLES = [
  'LabReport',
  'PatientDocument',
  'Payment',
  'InvoiceItem',
  'Prescription',
  'Invoice',
  'LabOrder',
  'Token',
  'Appointment',
  'MedicineBatch',
  'Medicine',
  'DoctorAttendance',
  'DoctorSchedule',
  'DoctorProfile',
  'Patient',
  'ChatMessage',
  'User',
] as const;

/** Columns that exist on local SQLite (cloud may send extras like Patient.notes). */
const LOCAL_COLUMNS: Record<string, string[]> = {
  User: ['id', 'firstName', 'lastName', 'email', 'passwordHash', 'role', 'isActive', 'avatar', 'createdAt', 'updatedAt'],
  DoctorProfile: [
    'id', 'userId', 'specialization', 'qualification', 'experienceYears', 'phone', 'bio', 'avatar',
    'consultationFee', 'createdAt', 'updatedAt',
  ],
  DoctorSchedule: ['id', 'doctorId', 'dayOfWeek', 'startTime', 'endTime', 'isActive', 'createdAt', 'updatedAt'],
  DoctorAttendance: ['id', 'doctorId', 'date', 'checkInAt', 'checkOutAt', 'createdAt', 'updatedAt'],
  Patient: [
    'id', 'mrNumber', 'firstName', 'lastName', 'dateOfBirth', 'phone', 'email', 'address',
    'emergencyContactName', 'emergencyContactPhone', 'bloodGroup', 'allergies', 'chronicConditions',
    'primaryDoctorId', 'createdAt', 'updatedAt',
  ],
  Medicine: [
    'id', 'name', 'genericName', 'categoryId', 'barcode', 'unit', 'rackNumber', 'minStockAlert',
    'createdAt', 'updatedAt',
  ],
  MedicineBatch: [
    'id', 'medicineId', 'batchNumber', 'expiryDate', 'purchasePrice', 'salePrice', 'quantity',
    'createdAt', 'updatedAt',
  ],
  Appointment: [
    'id', 'patientId', 'providerId', 'startsAt', 'endsAt', 'status', 'reason', 'notes',
    'recurrenceRule', 'parentId', 'createdAt', 'updatedAt',
  ],
  Token: ['id', 'tokenNumber', 'date', 'patientId', 'doctorId', 'status', 'notes', 'reason', 'consultationFee', 'feeDiscount', 'feeRefunded', 'createdAt', 'updatedAt'],
  Prescription: [
    'id', 'tokenId', 'diagnosis', 'medicines', 'tests', 'advice', 'thumbName', 'thumbnail',
    'pharmacyStatus', 'dispensedAt', 'invoiceId', 'createdAt', 'updatedAt',
  ],
  Invoice: [
    'id', 'patientId', 'appointmentId', 'invoiceNumber', 'status', 'issuedAt', 'dueAt', 'subtotal',
    'discount', 'tax', 'total', 'amountPaid', 'notes', 'createdAt', 'updatedAt',
  ],
  InvoiceItem: ['id', 'invoiceId', 'description', 'quantity', 'unitPrice', 'lineTotal', 'createdAt', 'updatedAt'],
  Payment: ['id', 'invoiceId', 'amount', 'method', 'paidAt', 'reference', 'notes', 'createdAt', 'updatedAt'],
  LabOrder: [
    'id', 'patientId', 'orderedById', 'tokenId', 'test', 'status', 'result', 'notes', 'orderedAt',
    'createdAt', 'updatedAt',
  ],
};

type JsonRow = Record<string, unknown>;
type ProgressCb = (progress: MigrateProgress) => void;

type ExportStatus = {
  tables: Record<string, number>;
  files: { patient: number; lab: number };
  empty: boolean;
};

type FileListItem = {
  kind: 'patient' | 'lab';
  id: string;
  ownerId: string;
  name: string;
  mimeType: string;
  size: number;
  hasInline?: boolean;
  downloadUrl?: string | null;
};

function toSqlite(value: unknown): string | number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function insertRow(table: string, row: JsonRow): Promise<void> {
  const allowed = LOCAL_COLUMNS[table];
  if (!allowed || !row.id) return;
  const use = allowed.filter((col) => row[col] !== undefined);
  if (!use.includes('id')) use.unshift('id');
  const values = use.map((col) => toSqlite(row[col]));
  const cols = use.map((col) => `"${col}"`).join(', ');
  const placeholders = use.map(() => '?').join(', ');
  await getPrisma().$executeRawUnsafe(
    `INSERT OR IGNORE INTO "${table}" (${cols}) VALUES (${placeholders})`,
    ...values,
  );
}

async function wipeLocalClinic(): Promise<void> {
  const db = getPrisma();
  await db.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  try {
    for (const table of WIPE_TABLES) {
      await db.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }
  } finally {
    await db.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }
}

function extFromMime(mimeType: string, name: string): string {
  const fromName = extname(name).replace(/^\./, '').toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  const raw = String(mimeType || '').toLowerCase().replace(/^\./, '');
  const sub = raw.includes('/') ? raw.split('/')[1] || 'bin' : raw;
  if (sub === 'jpeg') return 'jpg';
  return sub.replace(/[^a-z0-9]+/g, '') || 'bin';
}

function bufferFromInline(fileData: string): Buffer {
  const text = String(fileData || '');
  const idx = text.indexOf('base64,');
  return Buffer.from(idx >= 0 ? text.slice(idx + 7) : text, 'base64');
}

async function saveCloudFile(item: FileListItem): Promise<'uploaded' | 'skipped' | 'failed'> {
  try {
    let buffer: Buffer | null = null;
    if (item.downloadUrl) {
      const response = await fetch(item.downloadUrl);
      if (!response.ok) return 'failed';
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      const full = await clinicMigrateApi<{
        skipped?: boolean;
        fileData?: string | null;
        downloadUrl?: string | null;
      }>(
        `/api/clinic/migrate/export/file?kind=${encodeURIComponent(item.kind)}&id=${encodeURIComponent(item.id)}`,
      );
      if (full.skipped) return 'skipped';
      if (full.downloadUrl) {
        const response = await fetch(full.downloadUrl);
        if (!response.ok) return 'failed';
        buffer = Buffer.from(await response.arrayBuffer());
      } else if (full.fileData) {
        buffer = bufferFromInline(full.fileData);
      }
    }
    if (!buffer || !buffer.length) return 'skipped';

    const ext = extFromMime(item.mimeType, item.name);
    const sub = item.kind === 'lab' ? `lab/${item.ownerId}` : `patients/${item.ownerId}`;
    const absolute = join(getDocsDir(sub), `${item.id}.${ext}`);
    writeFileSync(absolute, buffer);
    const filePath = toStoredDocPath(absolute);
    const db = getPrisma();
    if (item.kind === 'lab') {
      await db.labReport.create({
        data: {
          id: item.id,
          labOrderId: item.ownerId,
          name: item.name || `${item.id}.${ext}`,
          filePath,
          mimeType: item.mimeType || ext,
          size: buffer.length,
          updatedAt: new Date(),
        },
      });
    } else {
      await db.patientDocument.create({
        data: {
          id: item.id,
          patientId: item.ownerId,
          name: item.name || `${item.id}.${ext}`,
          filePath,
          mimeType: item.mimeType || ext,
          size: buffer.length,
          updatedAt: new Date(),
        },
      });
    }
    return 'uploaded';
  } catch (err) {
    console.warn('[migrate-from-cloud] file failed', item.id, (err as Error).message);
    return 'failed';
  }
}

export type MigrateFromCloudResult = {
  ok: boolean;
  error?: string;
  imported?: Record<string, number>;
  files?: { uploaded: number; skipped: number; failed: number };
};

export async function migrateCloudToLocal(onProgress?: ProgressCb): Promise<MigrateFromCloudResult> {
  const report = (percent: number, label: string) => {
    onProgress?.({ percent: Math.min(100, Math.max(0, Math.round(percent))), label });
  };

  if (!isOnlineDatabaseMode()) {
    return {
      ok: false,
      error: 'Turn on Online Database first, copy data to this PC, then switch the license back to Local.',
    };
  }

  report(1, 'Starting…');
  const status = await clinicMigrateApi<ExportStatus>('/api/clinic/migrate/export/status');
  if (status.empty) {
    return { ok: false, error: 'Online DB has no clinic data to copy.' };
  }

  report(4, 'Preparing local database…');
  await initializeDatabase();
  await wipeLocalClinic();
  report(8, 'Local database cleared');

  const imported: Record<string, number> = {};
  const tableSteps = TABLES.reduce(
    (n, table) => n + Math.max(1, Math.ceil((status.tables[table] || 0) / BATCH)),
    0,
  );
  const fileTotal = (status.files.patient || 0) + (status.files.lab || 0);
  const transferSteps = tableSteps + fileTotal + 1;
  let done = 0;
  const bump = (label: string) => {
    done += 1;
    const percent = 8 + Math.round((done / Math.max(1, transferSteps)) * 90);
    report(Math.min(99, percent), label);
  };

  for (const table of TABLES) {
    const label = TABLE_LABELS[table];
    const totalRows = status.tables[table] || 0;
    imported[table] = 0;
    if (!totalRows) {
      bump(`${label} — nothing to copy`);
      continue;
    }
    let offset = 0;
    while (offset < totalRows) {
      const page = await clinicMigrateApi<{ rows: JsonRow[] }>(
        `/api/clinic/migrate/export/rows?table=${encodeURIComponent(table)}&offset=${offset}&limit=${BATCH}`,
      );
      const rows = Array.isArray(page.rows) ? page.rows : [];
      if (!rows.length) break;
      for (const row of rows) {
        try {
          await insertRow(table, row);
          imported[table] += 1;
        } catch (err) {
          console.warn('[migrate-from-cloud] row failed', table, row.id, (err as Error).message);
        }
      }
      offset += rows.length;
      bump(`${label} — ${imported[table]}/${totalRows}`);
    }
  }

  const files = { uploaded: 0, skipped: 0, failed: 0 };
  let fileDone = 0;
  for (const kind of ['patient', 'lab'] as const) {
    const total = kind === 'patient' ? status.files.patient || 0 : status.files.lab || 0;
    let offset = 0;
    while (offset < total) {
      const page = await clinicMigrateApi<{ items: FileListItem[] }>(
        `/api/clinic/migrate/export/files?kind=${kind}&offset=${offset}&limit=50`,
      );
      const items = Array.isArray(page.items) ? page.items : [];
      if (!items.length) break;
      for (const item of items) {
        const result = await saveCloudFile({ ...item, kind });
        files[result] += 1;
        fileDone += 1;
        const kindLabel = kind === 'lab' ? 'Lab reports' : 'Patient documents';
        bump(`${kindLabel} — ${fileDone}/${fileTotal}`);
      }
      offset += items.length;
    }
  }

  const meta = await clinicMigrateApi<{
    clinicName?: string;
    clinicAddress?: string;
    clinicPhone?: string;
    clinicLogo?: string;
  }>('/api/clinic/meta');
  saveSettings({
    clinicName: meta.clinicName || '',
    clinicAddress: meta.clinicAddress || '',
    clinicPhone: meta.clinicPhone || '',
    clinicLogo: meta.clinicLogo || '',
  });
  bump('Clinic settings');

  await seedDefaultAdmin();
  report(100, 'Done');
  return { ok: true, imported, files };
}

export function registerMigrateFromCloudIpc(): void {
  ipcMain.removeHandler('backup:migrate-from-cloud');
  ipcMain.handle('backup:migrate-from-cloud', async (event: IpcMainInvokeEvent) => {
    const send = (progress: MigrateProgress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('backup:migrate-progress', progress);
      }
    };
    try {
      return await migrateCloudToLocal(send);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Download from Online DB failed.' };
    }
  });
}
