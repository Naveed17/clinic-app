import { randomUUID } from 'node:crypto';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { RealtimeNotification } from './types';

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

export function registerRealtimeSocket(io: SocketIOServer): void {
  io.on('connection', (socket: Socket) => {
    socket.emit('realtime:ready', {
      connectedAt: new Date().toISOString(),
    });
  });
}
