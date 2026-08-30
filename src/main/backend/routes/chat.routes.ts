import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { emitDataChange, emitNotification } from '../realtime';
import { isLicenseModuleEnabled } from '../../license/license.ipc';
import { createChatMessage, listChatInbox, listChatMessages, listChatStaff } from '../../chat/chat.service';

function assertChatAddon(): void {
  if (!isLicenseModuleEnabled('chat')) {
    const err = new Error('Chat add-on is not enabled for this license.');
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export function createChatRouter(io: SocketIOServer): Router {
  const router = Router();
  const staff = requireRole(['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist']);

  router.get(
    '/staff',
    staff,
    asyncHandler(async (_req, res) => {
      assertChatAddon();
      res.json(await listChatStaff());
    }),
  );

  router.get(
    '/inbox',
    staff,
    asyncHandler(async (req, res) => {
      assertChatAddon();
      const userId = typeof req.query.userId === 'string' ? req.query.userId : req.user?.userId || '';
      res.json(await listChatInbox(userId));
    }),
  );

  router.get(
    '/messages',
    staff,
    asyncHandler(async (req, res) => {
      assertChatAddon();
      const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'staff';
      res.json(await listChatMessages(roomId));
    }),
  );

  router.post(
    '/messages',
    staff,
    asyncHandler(async (req, res) => {
      assertChatAddon();
      const body = (req.body || {}) as Record<string, unknown>;
      const message = await createChatMessage({
        roomId: String(body.roomId || 'staff'),
        senderId: String(body.senderId || req.user?.userId || ''),
        senderName: String(body.senderName || ''),
        role: String(body.role || req.user?.role || ''),
        message: typeof body.message === 'string' ? body.message : '',
        audioData: typeof body.audioData === 'string' ? body.audioData : undefined,
        audioDuration: typeof body.audioDuration === 'number' ? body.audioDuration : undefined,
      });
      io.emit('chat:message', message);
      emitDataChange(io, 'chat', 'created');
      emitNotification(io, {
        kind: 'info',
        title: 'New chat message',
        message: `${message.senderName} sent a message.`,
        payload: { entity: 'chat', roomId: message.roomId, id: message.id },
      });
      res.status(201).json(message);
    }),
  );

  return router;
}
