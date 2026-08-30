import { randomUUID } from 'node:crypto';
import { getPrisma } from '../database/client';
import { TEAM_CHAT_ROOM, assertChatRoom } from './rooms';

export const STAFF_CHAT_ROOM = TEAM_CHAT_ROOM;
const MAX_MESSAGE = 2000;
const LIST_LIMIT = 200;

export type ChatStaff = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  avatar: string | null;
  isActive: boolean;
};

export type ChatInboxItem = {
  roomId: string;
  lastMessage: string;
  lastAt: string;
  senderId: string;
  senderName: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  role: string;
  message: string;
  createdAt: string;
  senderAvatar?: string | null;
  audioData?: string | null;
  audioDuration?: number | null;
};

export type ChatMessageInput = {
  roomId?: string;
  senderId?: string;
  senderName?: string;
  role?: string;
  message?: string;
  audioData?: string | null;
  audioDuration?: number | null;
};

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value || '').trim();
  if (text) return text;
  return new Date().toISOString();
}

function asAvatar(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function mapRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    roomId: String(row.roomId || TEAM_CHAT_ROOM),
    senderId: String(row.senderId || ''),
    senderName: String(row.senderName || 'Staff'),
    role: String(row.role || ''),
    message: String(row.message || ''),
    createdAt: asIso(row.createdAt),
    senderAvatar: asAvatar(row.senderAvatar),
    audioData: row.audioData ? String(row.audioData) : null,
    audioDuration: row.audioDuration != null ? Number(row.audioDuration) : null,
  };
}

async function lookupSenderAvatar(senderId: string): Promise<string | null> {
  if (!senderId) return null;
  const rows = await getPrisma().$queryRawUnsafe<Array<{ senderAvatar?: unknown }>>(
    `SELECT COALESCE(NULLIF(u.avatar, ''), dp.avatar) AS "senderAvatar"
       FROM "User" u
       LEFT JOIN "DoctorProfile" dp ON dp."userId" = u.id
      WHERE u.id = ?
      LIMIT 1`,
    senderId,
  );
  return asAvatar(rows[0]?.senderAvatar);
}

export async function listChatStaff(): Promise<ChatStaff[]> {
  const rows = await getPrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT u.id, u."firstName", u."lastName", u.role, u."isActive",
            COALESCE(NULLIF(u.avatar, ''), dp.avatar) AS avatar
       FROM "User" u
       LEFT JOIN "DoctorProfile" dp ON dp."userId" = u.id
      WHERE u."isActive" = 1
      ORDER BY u."firstName" ASC, u."lastName" ASC`,
  );
  return rows.map((row) => {
    const firstName = String(row.firstName || '');
    const lastName = String(row.lastName || '');
    return {
      id: String(row.id),
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim() || 'Staff',
      role: String(row.role || ''),
      avatar: asAvatar(row.avatar),
      isActive: row.isActive === 1 || row.isActive === true,
    };
  });
}

export async function listChatInbox(userId: string): Promise<ChatInboxItem[]> {
  const me = String(userId || '').trim();
  if (!me) return [];
  const rows = await getPrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT m."roomId", m.message, m."createdAt", m."senderId", m."senderName"
       FROM "ChatMessage" m
       INNER JOIN (
         SELECT "roomId", MAX("createdAt") AS "lastAt"
           FROM "ChatMessage"
          WHERE "roomId" = ?
             OR "roomId" LIKE ('dm:' || ? || ':%')
             OR "roomId" LIKE ('dm:%:' || ?)
          GROUP BY "roomId"
       ) latest ON latest."roomId" = m."roomId" AND latest."lastAt" = m."createdAt"
      ORDER BY m."createdAt" DESC`,
    TEAM_CHAT_ROOM,
    me,
    me,
  );
  return rows.map((row) => ({
    roomId: String(row.roomId || TEAM_CHAT_ROOM),
    lastMessage: String(row.message || ''),
    lastAt: asIso(row.createdAt),
    senderId: String(row.senderId || ''),
    senderName: String(row.senderName || 'Staff'),
  }));
}

export async function listChatMessages(roomId = TEAM_CHAT_ROOM): Promise<ChatMessage[]> {
  const db = getPrisma();
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT m.id, m."roomId", m."senderId", m."senderName", m.role, m.message, m."createdAt",
            m."audioData", m."audioDuration",
            COALESCE(NULLIF(u.avatar, ''), dp.avatar) AS "senderAvatar"
       FROM "ChatMessage" m
       LEFT JOIN "User" u ON u.id = m."senderId"
       LEFT JOIN "DoctorProfile" dp ON dp."userId" = m."senderId"
      WHERE m."roomId" = ?
      ORDER BY m."createdAt" DESC
      LIMIT ?`,
    roomId || TEAM_CHAT_ROOM,
    LIST_LIMIT,
  );
  return rows.map(mapRow).reverse();
}

export async function createChatMessage(input: ChatMessageInput): Promise<ChatMessage> {
  const rawMessage = String(input.message || '').trim();
  const audioData = input.audioData ? String(input.audioData).trim() : null;
  const audioDuration = input.audioDuration != null ? Math.max(0, Number(input.audioDuration)) : null;

  if (!rawMessage && !audioData) throw new Error('Message text or voice note is required.');
  if (rawMessage.length > MAX_MESSAGE) throw new Error('Message is too long.');

  const message = rawMessage || (audioData ? '🎤 Voice message' : '');
  const senderId = String(input.senderId || '').trim();
  const roomId = assertChatRoom(String(input.roomId || TEAM_CHAT_ROOM), senderId);
  const row: ChatMessage = {
    id: randomUUID(),
    roomId,
    senderId,
    senderName: String(input.senderName || 'Staff').trim() || 'Staff',
    role: String(input.role || '').trim(),
    message,
    createdAt: new Date().toISOString(),
    senderAvatar: await lookupSenderAvatar(senderId),
    audioData,
    audioDuration,
  };
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO "ChatMessage"
      ("id", "roomId", "senderId", "senderName", "role", "message", "createdAt", "audioData", "audioDuration")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.roomId,
    row.senderId,
    row.senderName,
    row.role,
    row.message,
    row.createdAt,
    row.audioData,
    row.audioDuration,
  );
  return row;
}
