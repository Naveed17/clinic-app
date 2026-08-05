import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { createChatMessage, emitNotification } from '../realtime';

export function createChatRouter(io: SocketIOServer): Router {
  const router = Router();

  router.post(
    '/messages',
    requireRole(['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const message = createChatMessage(req.body);
      if (!message.message) {
        res.status(400).json({ message: 'Message text is required.' });
        return;
      }

      io.emit('chat:message', message);
      emitNotification(io, {
        kind: 'info',
        title: 'New chat message',
        message: `${message.sender} sent a message in ${message.roomId}.`,
        payload: { entity: 'chat', roomId: message.roomId, id: message.id },
      });
      res.status(201).json(message);
    }),
  );

  return router;
}
