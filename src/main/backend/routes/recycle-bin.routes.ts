import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import {
  listDeletedItems,
  restoreItem,
  purgeItem,
  type RecycleBinEntityType,
} from '../../recycle-bin/recycle-bin.service';
import { emitNotification } from '../realtime';

export function createRecycleBinRouter(io?: SocketIOServer): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const items = await listDeletedItems();
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/restore', async (req, res) => {
    try {
      const { entityType, id } = req.body as { entityType: RecycleBinEntityType; id: string };
      const result = await restoreItem(entityType, id);
      if (io) {
        emitNotification(io, {
          kind: 'success',
          title: 'Record restored',
          message: `The deleted ${entityType} record was restored successfully.`,
          payload: { entity: entityType, id },
        });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/purge', async (req, res) => {
    try {
      const { entityType, id } = req.body as { entityType: RecycleBinEntityType; id: string };
      const result = await purgeItem(entityType, id);
      if (io) {
        emitNotification(io, {
          kind: 'warning',
          title: 'Record permanently deleted',
          message: `The ${entityType} record was permanently deleted.`,
          payload: { entity: entityType, id },
        });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
