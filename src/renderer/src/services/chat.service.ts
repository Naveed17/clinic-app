import type { ChatInboxItem, ChatMessage, ChatMessageInput, ChatStaff } from '@/types/chat';

export type { ChatInboxItem, ChatMessage, ChatMessageInput, ChatStaff };

export const chatService = {
  list: (roomId = 'staff') => window.clinic.chat.list(roomId),
  staff: () => window.clinic.chat.staff(),
  inbox: (userId?: string) => window.clinic.chat.inbox(userId),
  send: (input: ChatMessageInput) => window.clinic.chat.send(input),
};
