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
  senderAvatar?: string | null;
  audioData?: string | null;
  audioDuration?: number | null;
};
