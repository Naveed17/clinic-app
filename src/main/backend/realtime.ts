import { randomUUID } from 'node:crypto';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { RealtimeNotification } from './types';

/** Sync uses DB table names; the renderer's query map uses entity names. */
const TABLE_TO_ENTITY: Record<string, string> = {
  Patient: 'patient',
  PatientDocument: 'patient',
  Appointment: 'appointment',
  Token: 'token',
  Prescription: 'prescription',
  Invoice: 'invoice',
  InvoiceItem: 'invoice',
  Payment: 'invoice',
  LabOrder: 'lab',
  LabReport: 'lab',
  Medicine: 'medicine',
  MedicineBatch: 'medicine',
  User: 'doctor',
  DoctorProfile: 'doctor',
  DoctorSchedule: 'doctor',
  DoctorAttendance: 'doctor',
};

export function emitDataChange(io: SocketIOServer, entity: string, action: string): void {
  io.emit('data:changed', { entity: TABLE_TO_ENTITY[entity] ?? entity, action });
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
  const socketsByUser = new Map<string, Set<string>>();

  function onlineIds(): string[] {
    return [...socketsByUser.keys()];
  }

  function emitPresence(): void {
    io.emit('presence:update', { userIds: onlineIds() });
  }

  io.on('connection', (socket: Socket) => {
    socket.emit('realtime:ready', {
      connectedAt: new Date().toISOString(),
    });
    socket.emit('presence:update', { userIds: onlineIds() });

    socket.on('presence:join', (payload: { userId?: string } | string) => {
      const userId = String(typeof payload === 'string' ? payload : payload?.userId || '').trim();
      if (!userId) return;
      const prev = String(socket.data.userId || '');
      if (prev && prev !== userId) {
        const old = socketsByUser.get(prev);
        old?.delete(socket.id);
        if (!old?.size) socketsByUser.delete(prev);
      }
      socket.data.userId = userId;
      const set = socketsByUser.get(userId) ?? new Set<string>();
      set.add(socket.id);
      socketsByUser.set(userId, set);
      emitPresence();
    });

    socket.on('disconnect', () => {
      const userId = String(socket.data.userId || '');
      if (!userId) return;
      const set = socketsByUser.get(userId);
      set?.delete(socket.id);
      if (!set?.size) socketsByUser.delete(userId);
      emitPresence();
    });
  });
}
