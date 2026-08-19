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
        ensureSameDay: (input: unknown) => Promise<unknown>;
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
        delete: (id: string) => Promise<unknown>;
        payments: (invoiceId: string) => Promise<unknown>;
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
        getOne: (id: string) => Promise<unknown>;
        attendance: (id: string, year: number, month: number) => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
      };
      tokens: {
        getForPatient: (patientId: string, date: string) => Promise<unknown>;
        getById: (tokenId: string) => Promise<unknown>;
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
      };
      print: {
        pdf: (
          base64: string,
          options?: { printDialog?: boolean; paper?: 'pos80' | 'A4' },
        ) => Promise<{ ok: boolean; error?: string }>;
        html: (html: string) => Promise<{ ok: boolean; error?: string }>;
        captureHtml: (
          html: string,
          options?: { width?: number; height?: number },
        ) => Promise<{ ok: boolean; base64?: string; error?: string }>;
      };
      ai: {
        test: (input?: { apiKey?: string }) => Promise<{ ok: boolean; error?: string }>;
        suggestPrescription: (
          input: {
            diagnosis?: string;
            age?: string;
            sex?: string;
            currentText?: string;
            patientName?: string;
          },
          onDelta?: (delta: string) => void,
        ) => Promise<{ ok: boolean; html?: string; error?: string }>;
        summarizePatient: (
          input: {
            patientName?: string;
            visits: Array<{ date?: string; diagnosis?: string; advice?: string }>;
          },
          onDelta?: (delta: string) => void,
        ) => Promise<{ ok: boolean; summary?: string; error?: string }>;
        interpretLabReport: (
          input: {
            testName: string;
            specimen?: string;
            patientAge?: string;
            rows: Array<{ name: string; value: string; unit: string; range: string; flag: string }>;
          },
          onDelta?: (delta: string) => void,
        ) => Promise<{ ok: boolean; html?: string; error?: string }>;
      };
      whatsapp: {
        status: () => Promise<{ enabled: boolean; configured: boolean; displayNumber: string }>;
        embeddedConfig: () => Promise<{ configured: boolean; appId: string; configId: string }>;
        embeddedExchange: (input: {
          code: string;
          phoneNumberId?: string | null;
          wabaId?: string | null;
        }) => Promise<{
          success: boolean;
          token?: string;
          phoneNumberId?: string;
          displayNumber?: string;
          wabaId?: string;
          error?: string;
        }>;
        test: () => Promise<{ ok: boolean; name?: string; phone?: string; error?: string }>;
        campaign: (input: {
          text: string;
          phones: string[];
          imageBase64?: string;
          imageMime?: string;
          imageName?: string;
        }) => Promise<{ sent: number; failed: number; skipped: number; errors: string[] }>;
        sendMessage: (input: { phone?: string; text: string }) => Promise<{ success: boolean; error?: string }>;
      };
      settings: {
        get: () => Promise<{
          serverMode: 'local' | 'lan-server' | 'lan-client';
          clientApiUrl: string;
          lanPort: number;
          clinicName?: string;
          clinicAddress?: string;
          clinicPhone?: string;
          clinicLogo?: string;
          setupDone?: boolean;
          whatsappEnabled?: boolean;
          whatsappToken?: string;
          whatsappPhoneNumberId?: string;
          whatsappDisplayNumber?: string;
        }>;
        save: (patch: unknown) => Promise<{
          serverMode: 'local' | 'lan-server' | 'lan-client';
          clientApiUrl: string;
          lanPort: number;
          clinicName?: string;
          clinicAddress?: string;
          clinicPhone?: string;
          clinicLogo?: string;
          setupDone?: boolean;
        }>;
        relaunch: () => Promise<void>;
        lanIp: () => Promise<string>;
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
      license: {
        status: () => Promise<boolean>;
        gate: () => Promise<{ state: 'ok' | 'none' | 'blocked'; reason?: string }>;
        support: () => Promise<{ phone: string; email: string }>;
        activate: (key: string) => Promise<{ ok: boolean; error?: string; databaseMode?: 'local' | 'online' }>;
        modules: () => Promise<Record<string, boolean> | null>;
        databaseMode: () => Promise<{
          key?: string | null;
          databaseMode: 'local' | 'online';
          clinicalApiUrl: string;
          schemaId: string;
        }>;
      };
      medicines: {
        search: (query: string) => Promise<unknown>;
        list: () => Promise<unknown>;
        create: (name: string, price: number) => Promise<unknown>;
        updatePrice: (id: string, price: number) => Promise<unknown>;
      };
      search: {
        global: (query: string, role?: string) => Promise<unknown>;
      };
      update: {
        check: () => Promise<'available' | 'latest' | 'error' | { error?: string }>;
        install: () => Promise<void>;
        onAvailable?: (handler: (version?: string) => void) => () => void;
        onProgress: (handler: (progress: number | {
          percent: number;
          transferred?: number;
          total?: number;
          bytesPerSecond?: number;
          phase?: string;
          label?: string;
        }) => void) => () => void;
        onReady: (handler: (version?: string) => void) => () => void;
        onError?: (handler: (err: string) => void) => () => void;
        getVersion: () => Promise<string>;
      };
    };
  }
}

export {};