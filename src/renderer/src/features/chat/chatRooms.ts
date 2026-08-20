export const TEAM_CHAT_ROOM = 'staff';
export const CHAT_ROOM_STORAGE = 'careflow-chat-room';
export const CHAT_READ_STORAGE = 'careflow-chat-read';

export function dmRoomId(userA: string, userB: string): string {
  const [left, right] = [String(userA || '').trim(), String(userB || '').trim()].sort();
  return `dm:${left}:${right}`;
}

export function isTeamRoom(roomId: string): boolean {
  return String(roomId || '').trim() === TEAM_CHAT_ROOM;
}

export function otherUserId(roomId: string, me: string): string | null {
  const room = String(roomId || '').trim();
  if (!room.startsWith('dm:')) return null;
  const parts = room.slice(3).split(':').filter(Boolean);
  return parts.find((id) => id !== me) || null;
}

export function readCursorMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(CHAT_READ_STORAGE);
    const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function markRoomRead(roomId: string, at: string): void {
  const next = { ...readCursorMap(), [roomId]: at };
  window.localStorage.setItem(CHAT_READ_STORAGE, JSON.stringify(next));
}

export function isThreadUnread(roomId: string, lastAt?: string | null, senderId?: string, me?: string): boolean {
  if (!lastAt) return false;
  if (me && senderId === me) return false;
  const seen = readCursorMap()[roomId] || '';
  return lastAt > seen;
}
