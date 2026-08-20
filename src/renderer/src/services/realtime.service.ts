export interface RealtimeNotification {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

type ClinicRealtime = typeof window.clinic.realtime & {
  onDataChanged: (handler: (e: { entity: string; action: string }) => void) => () => void;
  onChatMessage?: (handler: (message: unknown) => void) => () => void;
  onPresence?: (handler: (payload: { userIds: string[] }) => void) => () => void;
  identify?: (userId: string) => Promise<void>;
};

export const realtimeService = {
  connect: () => window.clinic.realtime.connect(),
  disconnect: () => window.clinic.realtime.disconnect(),
  identify: (userId: string) => {
    const api = window.clinic.realtime as ClinicRealtime;
    if (!api.identify) return Promise.resolve();
    return api.identify(userId);
  },
  onNotification: (handler: (notification: RealtimeNotification) => void) =>
    window.clinic.realtime.onNotification(handler as (notification: unknown) => void),
  onDataChanged: (handler: (e: { entity: string; action: string }) => void) =>
    (window.clinic.realtime as ClinicRealtime).onDataChanged(handler),
  onChatMessage: (handler: (message: import('@/types/chat').ChatMessage) => void) => {
    const api = window.clinic.realtime as ClinicRealtime;
    if (!api.onChatMessage) return () => undefined;
    return api.onChatMessage(handler as (message: unknown) => void);
  },
  onPresence: (handler: (payload: { userIds: string[] }) => void) => {
    const api = window.clinic.realtime as ClinicRealtime;
    if (!api.onPresence) return () => undefined;
    return api.onPresence(handler);
  },
};
