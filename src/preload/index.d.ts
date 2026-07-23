import type { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    clinic: {
      patients: {
        list: (input: unknown) => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
      };
      appointments: {
        list: () => Promise<unknown>;
        patients: () => Promise<unknown>;
        doctors: () => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        updateStatus: (id: string, status: string) => Promise<unknown>;
        cancel: (id: string) => Promise<unknown>;
      };
      invoices: {
        list: () => Promise<unknown>;
        patients: () => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        print: () => Promise<unknown>;
      };
      reports: {
        summary: () => Promise<unknown>;
      };
      users: {
        list: (input: unknown) => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
      };
      doctors: {
        list: (input: unknown) => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
      };
      realtime: {
        connect: () => Promise<void>;
        disconnect: () => void;
        onNotification: (handler: (notification: unknown) => void) => () => void;
        onChatMessage: (handler: (message: unknown) => void) => () => void;
        sendChatMessage: (message: unknown) => Promise<boolean>;
      };
      settings: {
        get: () => Promise<{ serverMode: 'local' | 'lan-server' | 'lan-client'; clientApiUrl: string; lanPort: number }>;
        save: (patch: unknown) => Promise<{ serverMode: 'local' | 'lan-server' | 'lan-client'; clientApiUrl: string; lanPort: number }>;
        lanIp: () => Promise<string>;
        discoveredServers: () => Promise<{ ip: string; port: number; name: string }[]>;
        testConnection: (url: string) => Promise<boolean>;
        scan: () => Promise<{ ip: string; port: number; name: string }[]>;
        onServerFound: (handler: (server: { ip: string; port: number; name: string }) => void) => () => void;
      };
      auth: {
        login: (email: string, password: string) => Promise<{ id: string; name: string; email: string; role: string; avatar: string } | null>;
        changePassword: (userId: string, current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
      };
      print: {
        html: (html: string) => Promise<void>;
      };
    };
  }
}
