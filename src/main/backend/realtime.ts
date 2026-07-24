import { randomUUID } from 'node:crypto';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { ChatMessage, RealtimeNotification } from './types';

export function emitDataChange(io: SocketIOServer, entity: string, action: string): void {
  io.emit('data:changed', { entity, action });
}

export function emitNotification(
  io: SocketIOServer,
  notification: Omit<RealtimeNotification, 'id' | 'createdAt'>,
): void {
  io.emit('notification:new', {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...notification,
  } satisfies RealtimeNotification);
}

export function createChatMessage(payload: Partial<ChatMessage>): ChatMessage {
  return {
    id: randomUUID(),
    roomId: payload.roomId?.trim() || 'general',
    sender: payload.sender?.trim() || 'Anonymous',
    role: payload.role?.trim() || 'guest',
    message: payload.message?.trim() || '',
    createdAt: new Date().toISOString(),
  };
}

export function registerRealtimeSocket(io: SocketIOServer): void {
  io.on('connection', (socket: Socket) => {
    socket.emit('realtime:ready', {
      connectedAt: new Date().toISOString(),
    });

    socket.on('chat:message', (payload: Partial<ChatMessage>) => {
      const message = createChatMessage(payload);
      if (!message.message) {
        socket.emit('realtime:error', { message: 'Message text is required.' });
        return;
      }

      io.emit('chat:message', message);
    });
  });
}
