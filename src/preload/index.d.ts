import type { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  // ── Pharmacy shared types ──────────────────────────────────────────────────
  interface PharmacyMedicine {
    id: string;
    name: string;
    price: number;
    category: string;
    unit: string;
    stock: number;
    reorderLevel: number;
    createdAt: string;
    updatedAt: string;
  }

  interface PharmacyMedicineInput {
    id?: string;
    name: string;
    price: number;
    category: string;
    unit: string;
    stock: number;
    reorderLevel: number;
  }

  // ──────────────────────────────────────────────────────────────────────────
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
        delete: (id: string) => Promise<unknown>;
      };
      invoices: {
        list: () => Promise<unknown>;
        patients: () => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        addPayment: (invoiceId: string, amount: number, method: string, reference?: string) => Promise<unknown>;
        void: (id: string) => Promise<unknown>;
        payments: (invoiceId: string) => Promise<unknown>;
        print: () => Promise<unknown>;
      };
      reports: {
        summary: () => Promise<unknown>;
        detailed: (from: string, to: string) => Promise<unknown>;
        doctorRevenue: (from: string, to: string) => Promise<unknown>;
      };
      users: {
        list: (input: unknown) => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
      };
      doctors: {
        list: (input: unknown) => Promise<unknown>;
        getOne: (id: string) => Promise<unknown>;
        attendance: (id: string, year: number, month: number) => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
      };
      tokens: {
        getForPatient: (patientId: string, date: string) => Promise<unknown>;
        list: (date: string) => Promise<unknown>;
        listPrescriptions: (date: string) => Promise<unknown>;
        doctors: () => Promise<unknown>;
        patients: () => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        updateStatus: (id: string, status: string) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
        upsertPrescription: (tokenId: string, input: unknown) => Promise<unknown>;
      };
      lab: {
        list: () => Promise<unknown>;
        listByToken: (tokenId: string) => Promise<unknown>;
        patients: () => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        updateStatus: (id: string, status: string) => Promise<unknown>;
        saveResult: (id: string, result: string) => Promise<unknown>;
      };
      backup: {
        create: () => Promise<unknown>;
        restore: () => Promise<unknown>;
      };
      docs: {
        patient: {
          list: (patientId: string) => Promise<unknown>;
          upload: (patientId: string) => Promise<unknown>;
          delete: (id: string) => Promise<unknown>;
          open: (id: string) => Promise<unknown>;
          whatsapp: (id: string, phone?: string) => Promise<unknown>;
        };
        lab: {
          list: (labOrderId: string) => Promise<unknown>;
          upload: (labOrderId: string) => Promise<unknown>;
          delete: (id: string) => Promise<unknown>;
          open: (id: string) => Promise<unknown>;
        };
      };
      schedule: {
        get: (doctorId: string) => Promise<unknown>;
        upsert: (doctorId: string, slots: unknown[]) => Promise<unknown>;
      };
      realtime: {
        connect: () => Promise<void>;
        disconnect: () => void;
        onDataChanged: (handler: (e: { entity: string; action: string }) => void) => () => void;
        onNotification: (handler: (notification: unknown) => void) => () => void;
        onChatMessage: (handler: (message: unknown) => void) => () => void;
        sendChatMessage: (message: unknown) => Promise<boolean>;
      };
      settings: {
        get: () => Promise<{
          serverMode: 'local' | 'lan-server' | 'lan-client';
          clientApiUrl: string;
          lanPort: number;
          clinicName?: string;
          clinicAddress?: string;
          clinicPhone?: string;
          setupDone?: boolean;
        }>;
        save: (patch: unknown) => Promise<{
          serverMode: 'local' | 'lan-server' | 'lan-client';
          clientApiUrl: string;
          lanPort: number;
        }>;
        lanIp: () => Promise<string>;
        discoveredServers: () => Promise<{ ip: string; port: number; name: string }[]>;
        testConnection: (url: string) => Promise<boolean>;
        scan: () => Promise<{ ip: string; port: number; name: string }[]>;
        onServerFound: (handler: (server: { ip: string; port: number; name: string }) => void) => () => void;
        onLanReconnected: (handler: (url: string) => void) => () => void;
      };
      auth: {
        login: (
          email: string,
          password: string
        ) => Promise<{ id: string; name: string; email: string; role: string; avatar: string; token?: string } | { blocked: true; error?: string } | null>;
        changePassword: (userId: string, current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
      };
      print: {
        html: (html: string) => Promise<void>;
      };
      license: {
        status: () => Promise<boolean>;
        activate: (key: string) => Promise<{ ok: boolean; error?: string }>;
        modules: () => Promise<Record<string, boolean> | null>;
        info: () => Promise<{ key: string; expiresAt: string | null; activatedAt: string; updatedAt: string } | null>;
      };
      medicines: {
        search: (query: string) => Promise<unknown>;
        list: () => Promise<unknown>;
        create: (name: string, price: number) => Promise<unknown>;
        updatePrice: (id: string, price: number) => Promise<unknown>;
      };
      pharmacy: {
        medicines: {
          list: (search?: string) => Promise<PharmacyMedicine[]>;
          upsert: (data: PharmacyMedicineInput) => Promise<PharmacyMedicine>;
          adjustStock: (id: string, delta: number) => Promise<PharmacyMedicine>;
          lowStock: () => Promise<PharmacyMedicine[]>;
          delete: (id: string) => Promise<void>;
        };
      };
      search: {
        global: (query: string) => Promise<unknown>;
      };
      update: {
        check: () => Promise<'available' | 'latest' | 'error' | { error?: string }>;
        install: () => Promise<void>;
        onProgress: (handler: (percent: number) => void) => () => void;
        onReady: (handler: () => void) => () => void;
        onError?: (handler: (err: string) => void) => () => void;
        getVersion: () => Promise<string>;
      };
    };
  }
}

export {};