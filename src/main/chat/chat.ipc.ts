import { ipcMain } from 'electron';
import type { Server as SocketIOServer } from 'socket.io';
import { isLicenseModuleEnabled } from '../license/license.ipc';
import { emitDataChange, emitNotification } from '../backend/realtime';
import { createChatMessage, listChatInbox, listChatMessages, listChatStaff } from './chat.service';

function assertChatAddon(): void {
  if (!isLicenseModuleEnabled('chat')) {
    throw new Error('Chat add-on is not enabled for this license.');
  }
}

function notifyChat(io: SocketIOServer | undefined, message: { id: string; senderName: string; roomId: string }): void {
  if (!io) return;
  io.emit('chat:message', message);
  emitDataChange(io, 'chat', 'created');
  emitNotification(io, {
    kind: 'info',
    title: 'New chat message',
    message: `${message.senderName} sent a message.`,
    payload: { entity: 'chat', roomId: message.roomId, id: message.id },
  });
}

export function registerChatIpc(io?: SocketIOServer): void {
  ipcMain.removeHandler('chat:list');
  ipcMain.removeHandler('chat:send');
  ipcMain.removeHandler('chat:staff');
  ipcMain.removeHandler('chat:inbox');
  ipcMain.handle('chat:list', (_e, roomId?: string) => {
    assertChatAddon();
    return listChatMessages(roomId);
  });
  ipcMain.handle('chat:staff', () => {
    assertChatAddon();
    return listChatStaff();
  });
  ipcMain.handle('chat:inbox', (_e, userId?: string) => {
    assertChatAddon();
    return listChatInbox(String(userId || ''));
  });
  ipcMain.handle('chat:send', async (_e, input) => {
    assertChatAddon();
    const message = await createChatMessage(input);
    notifyChat(io, message);
    return message;
  });
}
