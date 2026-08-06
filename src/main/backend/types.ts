export type AppRole = 'admin' | 'doctor' | 'receptionist' | 'lab_technician' | 'pharmacist';

export type NotificationKind = 'info' | 'success' | 'warning' | 'error';

export interface RealtimeNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}
