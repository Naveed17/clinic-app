import { ipcMain } from 'electron';
import type { Server as SocketIOServer } from 'socket.io';
import type { TokenStatus } from '@prisma/client';
import {
  createToken,
  deleteToken,
  listTokenDoctors,
  listTokenPatients,
  listTokens,
  updateTokenStatus,
} from './token.service';
import { emitNotification } from '../backend/realtime';

export function registerTokenIpc(io?: SocketIOServer): void {
  ipcMain.handle('tokens:list', (_, date: string) => listTokens(date));
  ipcMain.handle('tokens:doctors', () => listTokenDoctors());
  ipcMain.handle('tokens:patients', () => listTokenPatients());
  ipcMain.handle('tokens:create', async (_, input) => {
    const token = await createToken(input);
    if (io) emitNotification(io, { kind: 'success', title: 'Token issued', message: `Token #${String(token.tokenNumber).padStart(3, '0')} issued for ${token.patient.firstName} ${token.patient.lastName}.`, payload: { entity: 'token', id: token.id } });
    return token;
  });
  ipcMain.handle('tokens:update-status', (_, id: string, status: TokenStatus) => updateTokenStatus(id, status));
  ipcMain.handle('tokens:delete', (_, id: string) => deleteToken(id));
}
