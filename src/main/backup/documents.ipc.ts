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
