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
};

export const realtimeService = {
  connect: () => window.clinic.realtime.connect(),
  disconnect: () => window.clinic.realtime.disconnect(),
  onNotification: (handler: (notification: RealtimeNotification) => void) =>
    window.clinic.realtime.onNotification(handler as (notification: unknown) => void),
  onDataChanged: (handler: (e: { entity: string; action: string }) => void) =>
    (window.clinic.realtime as ClinicRealtime).onDataChanged(handler),
};
