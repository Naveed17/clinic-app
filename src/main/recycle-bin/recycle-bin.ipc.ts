import { ipcMain } from 'electron';
import type { Server as SocketIOServer } from 'socket.io';
import {
  listDeletedItems,
  purgeItem,
  restoreItem,
  type RecycleBinEntityType,
} from './recycle-bin.service';
import { emitNotification } from '../backend/realtime';

export function registerRecycleBinIpc(io?: SocketIOServer): void {
  ipcMain.handle('recycle-bin:list', async () => {
    return listDeletedItems();
  });

  ipcMain.handle(
    'recycle-bin:restore',
    async (_, { entityType, id }: { entityType: RecycleBinEntityType; id: string }) => {
      const result = await restoreItem(entityType, id);
      if (io) {
        emitNotification(io, {
          kind: 'success',
          title: 'Record restored',
          message: `The deleted ${entityType} record was restored successfully.`,
          payload: { entity: entityType, id },
        });
      }
      return result;
    },
  );

  ipcMain.handle(
    'recycle-bin:purge',
    async (_, { entityType, id }: { entityType: RecycleBinEntityType; id: string }) => {
      const result = await purgeItem(entityType, id);
      if (io) {
        emitNotification(io, {
          kind: 'warning',
          title: 'Record permanently deleted',
          message: `The ${entityType} record was permanently deleted.`,
          payload: { entity: entityType, id },
        });
      }
      return result;
    },
  );
}
