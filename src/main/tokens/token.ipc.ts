import { ipcMain } from 'electron';
import type { Server as SocketIOServer } from 'socket.io';
import type { TokenStatus } from '@prisma/client';
import { getPrisma } from '../database/client';
import {
  createToken,
  deleteToken,
  dispensePharmacyPrescription,
  getTokenById,
  getTokenForPatient,
  listPharmacyQueue,
  listTokenDoctors,
  listTokenPatients,
  listPrescriptionFeed,
  listTokens,
  updateTokenStatus,
  upsertPrescription,
} from './token.service';
import { emitNotification } from '../backend/realtime';

export function registerTokenIpc(io?: SocketIOServer): void {
  ipcMain.handle('tokens:get-for-patient', (_, patientId: string, date: string) =>
    getTokenForPatient(patientId, date)
  );
  ipcMain.handle('tokens:list', (_, date: string) => listTokens(date));
  ipcMain.handle('tokens:get-by-id', (_, tokenId: string) => getTokenById(tokenId));
  ipcMain.handle('tokens:list-prescriptions', (_, date: string) => listPrescriptionFeed(date));
  ipcMain.handle('tokens:pharmacy-queue', (_, date: string) => listPharmacyQueue(date));
  ipcMain.handle('tokens:doctors', () => listTokenDoctors());
  ipcMain.handle('tokens:patients', () => listTokenPatients());
  ipcMain.handle('tokens:create', async (_, input) => {
    const token = await createToken(input);
    if (io) {
      const patientName = `${token.patient.firstName} ${token.patient.lastName}`.trim();
      const doctorName = token.doctor
        ? `${token.doctor.firstName} ${token.doctor.lastName}`.trim()
        : '';
      emitNotification(io, {
        kind: 'success',
        title: 'New patient in queue',
        message: doctorName
          ? `Token #${String(token.tokenNumber).padStart(3, '0')} — ${patientName} for Dr. ${doctorName}.`
          : `Token #${String(token.tokenNumber).padStart(3, '0')} issued for ${patientName}.`,
        payload: {
          entity: 'token',
          id: token.id,
          doctorId: token.doctorId,
          patientId: token.patientId,
        },
      });
    }
    return token;
  });
  ipcMain.handle('tokens:update-status', (_, id: string, status: TokenStatus) =>
    updateTokenStatus(id, status)
  );
  ipcMain.handle('tokens:delete', (_, id: string) => deleteToken(id));
  ipcMain.handle('tokens:upsert-prescription', async (_, tokenId: string, input) => {
    const result = await upsertPrescription(tokenId, input);
    if (io) {
      const db = getPrisma();
      const rows = await db.$queryRaw<
        Array<{ tokenNumber: number; firstName: string; lastName: string }>
      >`
        SELECT t.tokenNumber, p.firstName, p.lastName
        FROM "Token" t
        JOIN "Patient" p ON p.id = t.patientId
        WHERE t.id = ${tokenId}
        LIMIT 1
      `;

      if (rows[0]) {
        const r = rows[0];
        emitNotification(io, {
          kind: 'success',
          title: 'Prescription Added',
          message: `Prescription written for ${r.firstName} ${r.lastName} (Token #${String(r.tokenNumber).padStart(3, '0')}).`,
          payload: { entity: 'prescription', tokenId },
        });
      }
    }
    return result;
  });
  ipcMain.handle(
    'tokens:pharmacy-dispense',
    async (_, tokenId: string, options?: { invoiceId?: string | null }) => {
      const item = await dispensePharmacyPrescription(tokenId, options);
      if (io && item) {
        emitNotification(io, {
          kind: 'success',
          title: 'Pharmacy dispensed',
          message: `Token #${String(item.tokenNumber).padStart(3, '0')} — ${item.patientName} marked dispensed.`,
          payload: { entity: 'prescription', tokenId },
        });
      }
      return item;
    },
  );
}
