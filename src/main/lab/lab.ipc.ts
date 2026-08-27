import { ipcMain } from 'electron';
import type { Server as SocketIOServer } from 'socket.io';
import { isLicenseModuleEnabled } from '../license/license.ipc';
import { emitDataChange, emitNotification } from '../backend/realtime';
import { createLabOrder, getLabOrder, labPatients, listLabOrders, listLabOrdersByToken, saveLabResult, updateLabOrderStatus } from './lab.service';

function assertLabAddon(): void {
  if (!isLicenseModuleEnabled('labDashboard')) {
    throw new Error('Lab add-on is not enabled for this license.');
  }
}

function notifyLabCreated(io: SocketIOServer | undefined, order: { id: string; test: string; patientName: string; orderedByName: string; orderedById: string; patientId: string }): void {
  if (!io) return;
  emitDataChange(io, 'lab', 'created');
  emitNotification(io, {
    kind: 'success',
    title: 'New lab order',
    message: `${order.test} — ${order.patientName} · ${order.orderedByName}`,
    payload: {
      entity: 'lab',
      id: order.id,
      patientId: order.patientId,
      orderedById: order.orderedById,
    },
  });
}

function notifyLabUpdated(io: SocketIOServer | undefined, action: string, order?: { id: string; test: string; patientName: string; orderedById: string }): void {
  if (!io) return;
  emitDataChange(io, 'lab', action);
  if (action === 'completed' && order) {
    emitNotification(io, {
      kind: 'success',
      title: 'Lab result ready',
      message: `${order.test} — ${order.patientName}`,
      payload: {
        entity: 'lab',
        id: order.id,
        orderedById: order.orderedById,
      },
    });
  }
}

export function registerLabIpc(io?: SocketIOServer): void {
  ipcMain.handle('lab:list', (_e, limit?: number) => {
    assertLabAddon();
    return listLabOrders(limit);
  });
  ipcMain.handle('lab:get', (_e, id: string) => {
    assertLabAddon();
    return getLabOrder(id);
  });
  ipcMain.handle('lab:list-by-token', (_e, tokenId) => {
    assertLabAddon();
    return listLabOrdersByToken(tokenId);
  });
  ipcMain.handle('lab:patients', (_e, search?: string) => {
    assertLabAddon();
    return labPatients(search);
  });
  ipcMain.handle('lab:create', async (_e, input) => {
    assertLabAddon();
    const order = await createLabOrder(input);
    notifyLabCreated(io, order);
    return order;
  });
  ipcMain.handle('lab:update-status', async (_e, id, status) => {
    assertLabAddon();
    const order = await updateLabOrderStatus(id, status);
    notifyLabUpdated(io, 'updated');
    return order;
  });
  ipcMain.handle('lab:save-result', async (_e, id, result) => {
    assertLabAddon();
    const order = await saveLabResult(id, result);
    notifyLabUpdated(io, 'completed', order);
    return order;
  });
}
