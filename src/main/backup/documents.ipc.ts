import { ipcMain, dialog, app, shell } from 'electron';
import { copyFileSync, mkdirSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../database/client';

function getDocsDir(sub: string): string {
  const dir = join(app.getPath('userData'), 'documents', sub);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function registerDocumentsIpc(): void {
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
        data: { id, patientId, name: basename(src), filePath: dest, mimeType: extname(src).replace('.', ''), size: 0, updatedAt: new Date() },
      });
      results.push(doc);
    }
    return results;
  });

  ipcMain.handle('docs:patient:delete', async (_e, id: string) => {
    const doc = await getPrisma().patientDocument.findUnique({ where: { id } });
    if (doc && existsSync(doc.filePath)) unlinkSync(doc.filePath);
    await getPrisma().patientDocument.delete({ where: { id } });
  });

  ipcMain.handle('docs:patient:whatsapp', async (_e, id: string, phone?: string) => {
    const doc = await getPrisma().patientDocument.findUnique({ where: { id } });
    if (!doc || !existsSync(doc.filePath)) return { success: false, error: 'File not found.' };

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) return { success: false, error: 'WhatsApp API not configured.' };

    const cleaned = (phone ?? '').replace(/\D/g, '');
    if (!cleaned) return { success: false, error: 'No phone number.' };

    const ext = extname(doc.filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const mimeType = mimeMap[ext] ?? 'application/octet-stream';

    // Step 1: Upload media
    const fileBuffer = readFileSync(doc.filePath);
    const boundary = `----FormBoundary${Date.now()}`;
    const CRLF = '\r\n';
    const bodyParts = [
      `--${boundary}${CRLF}Content-Disposition: form-data; name="messaging_product"${CRLF}${CRLF}whatsapp`,
      `--${boundary}${CRLF}Content-Disposition: form-data; name="type"${CRLF}${CRLF}${mimeType}`,
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${doc.name}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`,
    ];
    const closing = `${CRLF}--${boundary}--${CRLF}`;
    const textBuf = Buffer.from(bodyParts.join(CRLF) + CRLF);
    const closingBuf = Buffer.from(closing);
    const formBody = Buffer.concat([textBuf, fileBuffer, closingBuf]);

    const uploadRes = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/media`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formBody,
      },
    );
    const uploadJson = await uploadRes.json() as { id?: string; error?: { message?: string } | string };
    if (!uploadRes.ok || !uploadJson.id) {
      const err = uploadJson.error;
      return { success: false, error: typeof err === 'object' && err !== null ? (err.message ?? 'Upload failed.') : (err ?? 'Upload failed.') };
    }

    // Step 2: Send document message
    const sendRes = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleaned,
          type: 'document',
          document: {
            id: uploadJson.id,
            filename: doc.name,
            caption: 'Aap ki document attached hai.',
          },
        }),
      },
    );
    const sendJson = await sendRes.json() as { messages?: unknown[]; error?: { message?: string } | string };
    if (!sendRes.ok) {
      const err = sendJson.error;
      return { success: false, error: typeof err === 'object' && err !== null ? (err.message ?? 'Send failed.') : (err ?? 'Send failed.') };
    }
    return { success: true };
  });

  ipcMain.handle('docs:patient:open', async (_e, id: string) => {
    const doc = await getPrisma().patientDocument.findUnique({ where: { id } });
    if (!doc || !existsSync(doc.filePath)) return null;
    const ext = extname(doc.filePath).toLowerCase();
    if (ext === '.pdf') {
      const buffer = readFileSync(doc.filePath);
      return { type: 'pdf', name: doc.name, data: buffer.toString('base64') };
    }
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      const buffer = readFileSync(doc.filePath);
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return { type: 'image', name: doc.name, data: `data:${mime};base64,${buffer.toString('base64')}` };
    }
    await shell.openPath(doc.filePath);
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
        data: { id, labOrderId, name: basename(src), filePath: dest, mimeType: extname(src).replace('.', ''), size: 0, updatedAt: new Date() },
      });
      results.push(report);
    }
    return results;
  });

  ipcMain.handle('docs:lab:delete', async (_e, id: string) => {
    const report = await getPrisma().labReport.findUnique({ where: { id } });
    if (report && existsSync(report.filePath)) unlinkSync(report.filePath);
    await getPrisma().labReport.delete({ where: { id } });
  });

  ipcMain.handle('docs:lab:open', async (_e, id: string) => {
    const report = await getPrisma().labReport.findUnique({ where: { id } });
    if (report && existsSync(report.filePath)) await shell.openPath(report.filePath);
  });
}
