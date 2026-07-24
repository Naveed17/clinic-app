export interface RealtimeNotification {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  sender: string;
  role: string;
  message: string;
  createdAt: string;
}

type ClinicRealtime = typeof window.clinic.realtime & {
  onDataChanged: (handler: (e: { entity: string; action: string }) => void) => () => void;
};

export const realtimeService = {
  connect: () => window.clinic.realtime.connect(),
  disconnect: () => window.clinic.realtime.disconnect(),
  onNotification: (handler: (notification: RealtimeNotification) => void) =>
    window.clinic.realtime.onNotification(handler as (notification: unknown) => void),
  onChatMessage: (handler: (message: ChatMessage) => void) =>
    window.clinic.realtime.onChatMessage(handler as (message: unknown) => void),
  onDataChanged: (handler: (e: { entity: string; action: string }) => void) =>
    (window.clinic.realtime as ClinicRealtime).onDataChanged(handler),
  sendChatMessage: (
    message: Omit<ChatMessage, 'id' | 'createdAt'> & { message: string },
  ) => window.clinic.realtime.sendChatMessage(message),
};
