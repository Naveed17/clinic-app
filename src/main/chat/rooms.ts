export const TEAM_CHAT_ROOM = 'staff';

export function dmRoomId(userA: string, userB: string): string {
  const [left, right] = [String(userA || '').trim(), String(userB || '').trim()].sort();
  return `dm:${left}:${right}`;
}

export function isTeamRoom(roomId: string): boolean {
  return String(roomId || '').trim() === TEAM_CHAT_ROOM;
}

export function isDmRoomFor(roomId: string, userId: string): boolean {
  const id = String(userId || '').trim();
  const room = String(roomId || '').trim();
  if (!id || !room.startsWith('dm:')) return false;
  const parts = room.slice(3).split(':').filter(Boolean);
  return parts.length === 2 && parts.includes(id);
}

export function assertChatRoom(roomId: string, senderId: string): string {
  const room = String(roomId || TEAM_CHAT_ROOM).trim() || TEAM_CHAT_ROOM;
  if (isTeamRoom(room)) return room;
  if (isDmRoomFor(room, senderId)) return room;
  throw new Error('You cannot send messages in this chat.');
}
