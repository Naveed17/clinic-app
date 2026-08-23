import type { Token, TokenInput, TokenPerson } from './token';
import type { Patient, PatientInput, PatientListInput } from './patient';
import type { Appointment, AppointmentInput, AppointmentPerson } from './appointment';
import type { Invoice, InvoiceInput, InvoicePerson } from './invoice';
import type { ReportSummary } from './report';
import type { LabOrder } from './lab';
import type { GlobalSearchResult } from './search';
import type { ChatMessage, ChatMessageInput } from './chat';
import type { Medicine } from './medicine';

declare global {
  interface Window {
    clinic: {
      medicines: {
        search: (query: string) => Promise<Medicine[]>;
        list: () => Promise<Medicine[]>;
        create: (name: string, price: number) => Promise<Medicine>;
        updatePrice: (id: string, price: number) => Promise<Medicine>;
        update: (id: string, name: string, price: number) => Promise<Medicine>;
        delete: (id: string) => Promise<{ ok: boolean; id: string } | void>;
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
      patients: {
        list: (input: PatientListInput) => Promise<{ data: Patient[]; total: number }>;
        create: (input: PatientInput) => Promise<Patient>;
        update: (id: string, input: PatientInput) => Promise<Patient>;
        delete: (id: string) => Promise<void>;
      };
      tokens: {
        getForPatient: (patientId: string, date: string) => Promise<Token | null>;
        getById: (tokenId: string) => Promise<Token | null>;
        upsertPrescription: any;
        list: (date: string) => Promise<Token[]>;
        listPrescriptions: (date: string) => Promise<import('./token').PrescriptionFeedItem[]>;
        doctors: () => Promise<TokenPerson[]>;
        patients: () => Promise<TokenPerson[]>;
        weekVisits: (patientId: string, doctorId: string, date: string) => Promise<{ count: number }>;
        create: (input: TokenInput) => Promise<Token>;
        updateStatus: (id: string, status: string) => Promise<Token>;
        refundFee: (id: string, amount?: number) => Promise<Token>;
        delete: (id: string) => Promise<void>;
      };
      appointments: {
        list: () => Promise<Appointment[]>;
        get: (id: string) => Promise<Appointment | null>;
        patients: () => Promise<AppointmentPerson[]>;
        doctors: () => Promise<AppointmentPerson[]>;
        create: (input: AppointmentInput) => Promise<Appointment>;
        ensureSameDay: (input: AppointmentInput) => Promise<Appointment>;
        update: (id: string, input: AppointmentInput) => Promise<Appointment>;
        updateStatus: (id: string, status: Appointment['status']) => Promise<Appointment>;
        cancel: (id: string) => Promise<Appointment>;
        delete: (id: string) => Promise<void>;
      };
      invoices: {
        list: () => Promise<Invoice[]>;
        get: (id: string) => Promise<Invoice | null>;
        patients: () => Promise<InvoicePerson[]>;
        create: (input: InvoiceInput) => Promise<Invoice>;
        addPayment: (invoiceId: string, amount: number, method: string, reference?: string) => Promise<Invoice>;
        refund: (invoiceId: string, amount: number, method: string, reason?: string) => Promise<Invoice>;
        void: (id: string) => Promise<Invoice>;
        delete: (id: string) => Promise<void>;
        payments: (invoiceId: string) => Promise<import('./invoice').Payment[]>;
      };
      reports: {
        summary: () => Promise<ReportSummary>;
        opd: (input: import('./report').OpdReportInput) => Promise<import('./report').OpdDailyReport>;
      };
      chat: {
        list: (roomId?: string) => Promise<ChatMessage[]>;
        staff: () => Promise<import('./chat').ChatStaff[]>;
        inbox: (userId?: string) => Promise<import('./chat').ChatInboxItem[]>;
        send: (input: ChatMessageInput) => Promise<ChatMessage>;
      };
      realtime: {
        connect: () => Promise<void>;
        identify: (userId: string) => Promise<void>;
        disconnect: () => void;
        onNotification: (handler: (notification: unknown) => void) => () => void;
        onDataChanged: (handler: (e: { entity: string; action: string }) => void) => () => void;
        onChatMessage: (handler: (message: unknown) => void) => () => void;
        onPresence: (handler: (payload: { userIds: string[] }) => void) => () => void;
      };
      users: {
        list: (input: unknown) => Promise<unknown>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
      };
      doctors: {
        list: (input: unknown) => Promise<unknown>;
        getOne: (id: string) => Promise<import('./doctor').Doctor & { schedules: { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[]; totalAppointments: number; todayTokens: number }>;
        attendance: (id: string, year: number, month: number) => Promise<{ date: string; checkInAt: string; checkOutAt: string | null }[]>;
        create: (input: unknown) => Promise<unknown>;
        update: (id: string, input: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<unknown>;
      };
      schedule: {
        get: (doctorId: string) => Promise<{ id: string; doctorId: string; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[]>;
        upsert: (doctorId: string, slots: { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[]) => Promise<{ id: string; doctorId: string; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[]>;
      };
      print: {
        pdf: (
          base64: string,
          options?: { printDialog?: boolean; paper?: 'pos80' | 'A4' },
        ) => Promise<{ ok: boolean; error?: string }>;
        html: (
          html: string,
          options?: { printDialog?: boolean; paper?: 'pos80' | 'A4' },
        ) => Promise<{ ok: boolean; error?: string }>;
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
        get: () => Promise<{ serverMode: 'local' | 'lan-server' | 'lan-client'; clientApiUrl: string; lanPort: number; clinicName: string; clinicAddress: string; clinicPhone: string; clinicLogo?: string; setupDone: boolean; databaseMode?: 'local' | 'online'; clinicalApiUrl?: string; schemaId?: string; aiEnabled?: boolean; groqApiKey?: string; groqModel?: string; whatsappEnabled?: boolean; whatsappToken?: string; whatsappPhoneNumberId?: string; whatsappDisplayNumber?: string }>;
        save: (patch: unknown) => Promise<{ serverMode: 'local' | 'lan-server' | 'lan-client'; clientApiUrl: string; lanPort: number; clinicName: string; clinicAddress: string; clinicPhone: string; clinicLogo?: string; setupDone: boolean; databaseMode?: 'local' | 'online'; clinicalApiUrl?: string; schemaId?: string; aiEnabled?: boolean; groqApiKey?: string; groqModel?: string; whatsappEnabled?: boolean; whatsappToken?: string; whatsappPhoneNumberId?: string; whatsappDisplayNumber?: string }>;
        relaunch: () => Promise<void>;
        lanIp: () => Promise<string>;
        testConnection: (url: string) => Promise<boolean>;
        scan: () => Promise<{ ip: string; port: number; name: string }[]>;
        onServerFound: (handler: (server: { ip: string; port: number; name: string }) => void) => () => void;
        onLanReconnected: (handler: (url: string) => void) => () => void;
      };
      backup: {
        create: () => Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
        restore: () => Promise<{ ok: boolean; canceled?: boolean; error?: string }>;
        migrateToCloud: () => Promise<{
          ok: boolean;
          error?: string;
          imported?: Record<string, number>;
          files?: { uploaded: number; skipped: number; failed: number };
        }>;
        migrateFromCloud: () => Promise<{
          ok: boolean;
          error?: string;
          imported?: Record<string, number>;
          files?: { uploaded: number; skipped: number; failed: number };
        }>;
        onMigrateProgress: (handler: (progress: { percent: number; label: string }) => void) => () => void;
        googleStatus: () => Promise<{
          connected: boolean;
          email: string;
          schedule: 'off' | 'daily' | 'weekly' | 'monthly';
          lastBackupAt: string | null;
          configured: boolean;
        }>;
        googleConnect: () => Promise<{ ok: boolean; email?: string; error?: string; canceled?: boolean }>;
        googleDisconnect: () => Promise<{
          connected: boolean;
          email: string;
          schedule: 'off' | 'daily' | 'weekly' | 'monthly';
          lastBackupAt: string | null;
          configured: boolean;
        }>;
        googleSchedule: (
          schedule: 'off' | 'daily' | 'weekly' | 'monthly',
        ) => Promise<{
          connected: boolean;
          email: string;
          schedule: 'off' | 'daily' | 'weekly' | 'monthly';
          lastBackupAt: string | null;
          configured: boolean;
        }>;
        googleBackupNow: () => Promise<{ ok: boolean; name?: string; error?: string }>;
      };
      docs: {
        patient: {
          list: (patientId: string) => Promise<{ id: string; name: string; filePath: string; uploadedAt: string }[]>;
          upload: (patientId: string) => Promise<{ id: string; name: string }[]>;
          delete: (id: string) => Promise<void>;
          open: (id: string) => Promise<{ type: 'pdf' | 'image'; name: string; data: string } | null>;
          whatsapp: (id: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
        };
        lab: {
          list: (labOrderId: string) => Promise<{ id: string; name: string; filePath: string; uploadedAt: string }[]>;
          upload: (labOrderId: string) => Promise<{ id: string; name: string }[]>;
          delete: (id: string) => Promise<void>;
          open: (id: string) => Promise<{ type: 'pdf' | 'image'; name: string; data: string } | null>;
        };
      };
      lab: {
        listByToken: (tokenId: string) => Promise<LabOrder[]>;
        list: () => Promise<LabOrder[]>;
        get: (id: string) => Promise<LabOrder | null>;
        patients: () => Promise<{ id: string; firstName: string; lastName: string }[]>;
        create: (input: { patientId: string; orderedById: string; test: string; tokenId?: string; notes?: string }) => Promise<LabOrder>;
        updateStatus: (id: string, status: string) => Promise<LabOrder>;
        saveResult: (id: string, result: string) => Promise<LabOrder>;
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
        onReady: (handler: () => void) => () => void;
        onError?: (handler: (err: string) => void) => () => void;
        getVersion: () => Promise<string>;
      };
      auth: {
        login: (email: string, password: string) => Promise<{ id: string; name: string; email: string; role: string; avatar: string; token?: string } | { blocked: true; error?: string } | null>;
        directory: () => Promise<Array<{ id: string; name: string; email: string; role: string; avatar: string | null }>>;
        changePassword: (userId: string, current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
      };
      search: {
        global: (query: string, role?: string) => Promise<GlobalSearchResult>;
      };
      ui: {
        getMaterials: () => Promise<{
          mica: boolean;
          acrylic: boolean;
          os: 'win11' | 'win10' | 'other';
        }>;
        onFocusChange: (handler: (focused: boolean) => void) => () => void;
      };
    };
  }
}

export {};