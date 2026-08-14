import { ipcMain, dialog, shell } from 'electron';
import { copyFileSync, unlinkSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../database/client';
import { getDocsDir, resolveDocPath, toStoredDocPath } from './docs-paths';
import { sendWhatsAppDocument } from '../whatsapp/whatsapp.service';

type DoctorLike = {
  firstName: string;
  lastName: string;
  doctorProfile?: { specialization?: string | null } | null;
} | null | undefined;

const MAX_CLOUD_BYTES = 3 * 1024 * 1024;

function formatDoctorName(doctor: DoctorLike): string | null {
  if (!doctor) return null;
  const name = `Dr. ${doctor.firstName} ${doctor.lastName}`.replace(/\s+/g, ' ').trim();
  const spec = doctor.doctorProfile?.specialization?.trim();
  return spec ? `${name} (${spec})` : name;
}

function formatVisitDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function stripDataUrl(fileData: string): string {
  const raw = String(fileData || '');
  const idx = raw.indexOf('base64,');
  return idx >= 0 ? raw.slice(idx + 7) : raw;
}

export function registerDocumentsIpc(): void {
  /** Pick files and return base64 payloads (used by online cloud upload). */
  ipcMain.handle(
    'docs:pick-files',
    async (
      _e,
      opts?: { title?: string; extensions?: string[] },
    ): Promise<{ name: string; mimeType: string; size: number; fileData: string }[]> => {
      const extensions = opts?.extensions?.length
        ? opts.extensions
        : ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'txt'];
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: opts?.title || 'Select Document',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Documents', extensions }],
      });
      if (canceled || !filePaths.length) return [];
      const results: { name: string; mimeType: string; size: number; fileData: string }[] = [];
      for (const src of filePaths) {
        const buf = readFileSync(src);
        if (buf.length > MAX_CLOUD_BYTES) {
          throw new Error(`"${basename(src)}" is too large (max 3 MB for online storage).`);
        }
        results.push({
          name: basename(src),
          mimeType: extname(src).replace('.', '').toLowerCase() || 'bin',
          size: buf.length,
          fileData: buf.toString('base64'),
        });
      }
      return results;
    },
  );

  /** Open a cloud buffer in-app (pdf/image) or via OS for other types. */
  ipcMain.handle(
    'docs:open-buffer',
    async (
      _e,
      input: { name?: string; mimeType?: string; fileData?: string },
    ): Promise<{ type: 'pdf' | 'image'; name: string; data: string } | null> => {
      const name = String(input?.name || 'document');
      const mimeType = String(input?.mimeType || '').toLowerCase().replace(/^\./, '');
      const data = stripDataUrl(String(input?.fileData || ''));
      if (!data) return null;
      if (mimeType === 'pdf' || mimeType.includes('pdf')) {
        return { type: 'pdf', name, data };
      }
      if (
        ['jpg', 'jpeg', 'png'].includes(mimeType) ||
        mimeType.includes('png') ||
        mimeType.includes('jpeg')
      ) {
        const mime = mimeType.includes('png') ? 'image/png' : 'image/jpeg';
        return { type: 'image', name, data: `data:${mime};base64,${data}` };
      }
      const ext = mimeType ? `.${mimeType}` : extname(name) || '.bin';
      const tmp = join(tmpdir(), `careflow-doc-${randomUUID()}${ext}`);
      writeFileSync(tmp, Buffer.from(data, 'base64'));
      await shell.openPath(tmp);
      return null;
    },
  );

  /** Send WhatsApp from an in-memory (cloud) file. */
  ipcMain.handle(
    'docs:whatsapp-from-buffer',
    async (
      _e,
      input: {
        fileName: string;
        fileData: string;
        mimeType?: string;
        phone?: string | null;
        context?: {
          patientName?: string | null;
          mrNumber?: string | null;
          doctorName?: string | null;
          visitDate?: string | null;
          tokenNumber?: number | null;
        };
      },
    ) => {
      const data = stripDataUrl(String(input.fileData || ''));
      if (!data) return { success: false, error: 'File not found.' };
      const ext =
        (input.mimeType ? `.${String(input.mimeType).replace(/^\./, '')}` : '') ||
        extname(input.fileName) ||
        '.bin';
      const tmp = join(tmpdir(), `careflow-wa-${randomUUID()}${ext}`);
      writeFileSync(tmp, Buffer.from(data, 'base64'));
      try {
        return await sendWhatsAppDocument({
          filePath: tmp,
          fileName: input.fileName,
          phone: input.phone,
          context: input.context,
        });
      } finally {
        try {
          if (existsSync(tmp)) unlinkSync(tmp);
        } catch {
          /* ignore */
        }
      }
    },
  );

  // ── Patient Documents ──
  ipcMain.handle('docs:patient:list', (_e, patientId: string) =>
    getPrisma().patientDocument.findMany({ where: { patientId }, orderBy: { uploadedAt: 'desc' } }),
  );

  ipcMain.handle('docs:patient:upload', async (_e, patientId: string) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Document',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'txt'] }],
    });
    if (canceled || !filePaths.length) return [];
    const dir = getDocsDir(`patients/${patientId}`);
    const results = [];
    for (const src of filePaths) {
      const id = randomUUID();
      const dest = join(dir, `${id}${extname(src)}`);
      copyFileSync(src, dest);
      const doc = await getPrisma().patientDocument.create({
        data: {
          id,
          patientId,
          name: basename(src),
          filePath: toStoredDocPath(dest),
          mimeType: extname(src).replace('.', ''),
          size: 0,
          updatedAt: new Date(),
        },
      });
      results.push(doc);
    }
    return results;
  });

  ipcMain.handle('docs:patient:delete', async (_e, id: string) => {
    const doc = await getPrisma().patientDocument.findUnique({ where: { id } });
    if (doc) {
      const abs = resolveDocPath(doc.filePath);
      if (existsSync(abs)) unlinkSync(abs);
    }
    await getPrisma().patientDocument.delete({ where: { id } });
  });

  ipcMain.handle('docs:patient:whatsapp', async (_e, id: string, phone?: string) => {
    const prisma = getPrisma();
    const doctorInclude = { include: { doctorProfile: true } } as const;
    const doc = await prisma.patientDocument.findUnique({
      where: { id },
      include: {
        patient: {
          include: { primaryDoctor: doctorInclude },
        },
      },
    });
    const abs = doc ? resolveDocPath(doc.filePath) : '';
    if (!doc || !existsSync(abs)) return { success: false, error: 'File not found.' };

    const [token, appointment] = await Promise.all([
      prisma.token.findFirst({
        where: { patientId: doc.patientId },
        orderBy: { createdAt: 'desc' },
        include: { doctor: doctorInclude },
      }),
      prisma.appointment.findFirst({
        where: { patientId: doc.patientId, status: { not: 'CANCELLED' } },
        orderBy: { startsAt: 'desc' },
        include: { provider: doctorInclude },
      }),
    ]);

    const tokenAt = token
      ? Date.parse(token.date) || new Date(token.createdAt).getTime()
      : 0;
    const apptAt = appointment ? new Date(appointment.startsAt).getTime() : 0;
    const useToken = Boolean(token) && tokenAt >= apptAt;
    const doctor = useToken
      ? token?.doctor
      : appointment?.provider || doc.patient.primaryDoctor;
    const visitRaw = useToken ? token?.date || token?.createdAt : appointment?.startsAt;
    const visitDate = formatVisitDate(visitRaw);
    const doctorName = formatDoctorName(doctor);
    const tokenNumber = useToken ? token?.tokenNumber : null;

    return sendWhatsAppDocument({
      filePath: abs,
      fileName: doc.name,
      phone: phone || doc.patient.phone,
      context: {
        patientName: `${doc.patient.firstName} ${doc.patient.lastName}`.trim(),
        mrNumber: doc.patient.mrNumber,
        doctorName,
        visitDate,
        tokenNumber,
      },
    });
  });

  ipcMain.handle('docs:patient:open', async (_e, id: string) => {
    const doc = await getPrisma().patientDocument.findUnique({ where: { id } });
    if (!doc) return null;
    const abs = resolveDocPath(doc.filePath);
    if (!existsSync(abs)) return null;
    const ext = extname(abs).toLowerCase();
    if (ext === '.pdf') {
      const buffer = readFileSync(abs);
      return { type: 'pdf', name: doc.name, data: buffer.toString('base64') };
    }
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      const buffer = readFileSync(abs);
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return { type: 'image', name: doc.name, data: `data:${mime};base64,${buffer.toString('base64')}` };
    }
    await shell.openPath(abs);
    return null;
  });

  // ── Lab Reports ──
  ipcMain.handle('docs:lab:list', (_e, labOrderId: string) =>
    getPrisma().labReport.findMany({ where: { labOrderId }, orderBy: { uploadedAt: 'desc' } }),
  );

  ipcMain.handle('docs:lab:upload', async (_e, labOrderId: string) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Attach Lab Report',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Reports', extensions: ['pdf', 'jpg', 'jpeg', 'png'] }],
    });
    if (canceled || !filePaths.length) return [];
    const dir = getDocsDir(`lab/${labOrderId}`);
    const results = [];
    for (const src of filePaths) {
      const id = randomUUID();
      const dest = join(dir, `${id}${extname(src)}`);
      copyFileSync(src, dest);
      const report = await getPrisma().labReport.create({
        data: {
          id,
          labOrderId,
          name: basename(src),
          filePath: toStoredDocPath(dest),
          mimeType: extname(src).replace('.', ''),
          size: 0,
          updatedAt: new Date(),
        },
      });
      results.push(report);
    }
    return results;
  });

  ipcMain.handle('docs:lab:delete', async (_e, id: string) => {
    const report = await getPrisma().labReport.findUnique({ where: { id } });
    if (report) {
      const abs = resolveDocPath(report.filePath);
      if (existsSync(abs)) unlinkSync(abs);
    }
    await getPrisma().labReport.delete({ where: { id } });
  });

  ipcMain.handle('docs:lab:open', async (_e, id: string) => {
    const report = await getPrisma().labReport.findUnique({ where: { id } });
    if (!report) return;
    const abs = resolveDocPath(report.filePath);
    if (existsSync(abs)) await shell.openPath(abs);
  });
}
