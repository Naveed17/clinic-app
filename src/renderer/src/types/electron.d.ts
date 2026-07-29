import type { Token, TokenInput, TokenPerson } from './token';
import type { Patient, PatientInput, PatientListInput } from './patient';
import type { Appointment, AppointmentInput, AppointmentPerson } from './appointment';
import type { Invoice, InvoiceInput, InvoicePerson } from './invoice';
import type { ReportSummary } from './report';
import type { LabOrder } from './lab';
import type { GlobalSearchResult } from './search';

declare global {
  interface Window {
    clinic: {
      medicines: any;
      license: {
        status: () => Promise<boolean>;
        activate: (key: string) => Promise<{ ok: boolean; error?: string }>;
        modules: () => Promise<Record<string, boolean> | null>;
      };
      patients: {
        list: (input: PatientListInput) => Promise<{ data: Patient[]; total: number }>;
        create: (input: PatientInput) => Promise<Patient>;
        update: (id: string, input: PatientInput) => Promise<Patient>;
        delete: (id: string) => Promise<void>;
      };
      tokens: {
        getForPatient: (patientId: string, date: string) => Promise<Token | null>;
        upsertPrescription: any;
        list: (date: string) => Promise<Token[]>;
        doctors: () => Promise<TokenPerson[]>;
        patients: () => Promise<TokenPerson[]>;
        create: (input: TokenInput) => Promise<Token>;
        updateStatus: (id: string, status: string) => Promise<Token>;
        delete: (id: string) => Promise<void>;
      };
      appointments: {
        list: () => Promise<Appointment[]>;
        patients: () => Promise<AppointmentPerson[]>;
        doctors: () => Promise<AppointmentPerson[]>;
        create: (input: AppointmentInput) => Promise<Appointment>;
        update: (id: string, input: AppointmentInput) => Promise<Appointment>;
        cancel: (id: string) => Promise<Appointment>;
      };
      invoices: {
        list: () => Promise<Invoice[]>;
        patients: () => Promise<InvoicePerson[]>;
        create: (input: InvoiceInput) => Promise<Invoice>;
        addPayment: (invoiceId: string, amount: number, method: string, reference?: string) => Promise<Invoice>;
        void: (id: string) => Promise<Invoice>;
        payments: (invoiceId: string) => Promise<import('./invoice').Payment[]>;
        print: () => Promise<boolean>;
      };
      reports: {
        summary: () => Promise<ReportSummary>;
        detailed: (from: string, to: string) => Promise<{ date: string; patients: number; appointments: number; revenue: number; invoices: number }[]>;
        doctorRevenue: (from: string, to: string) => Promise<{ doctorId: string; doctorName: string; appointments: number; revenue: number }[]>;
      };
      realtime: {
        connect: () => Promise<void>;
        disconnect: () => void;
        onNotification: (handler: (notification: unknown) => void) => () => void;
        onChatMessage: (handler: (message: unknown) => void) => () => void;
        sendChatMessage: (message: unknown) => Promise<boolean>;
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
      settings: {
        get: () => Promise<{ serverMode: 'local' | 'lan-server' | 'lan-client'; clientApiUrl: string; lanPort: number; clinicName: string; clinicAddress: string; clinicPhone: string }>;
        save: (patch: unknown) => Promise<{ serverMode: 'local' | 'lan-server' | 'lan-client'; clientApiUrl: string; lanPort: number; clinicName: string; clinicAddress: string; clinicPhone: string }>;
        lanIp: () => Promise<string>;
        discoveredServers: () => Promise<{ ip: string; port: number; name: string }[]>;
        testConnection: (url: string) => Promise<boolean>;
        scan: () => Promise<{ ip: string; port: number; name: string }[]>;
        onServerFound: (handler: (server: { ip: string; port: number; name: string }) => void) => () => void;
      };
      backup: {
        create: () => Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
        restore: () => Promise<{ ok: boolean; canceled?: boolean; error?: string }>;
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
        listByToken: any;
        list: () => Promise<LabOrder[]>;
        patients: () => Promise<{ id: string; firstName: string; lastName: string }[]>;
        create: (input: { patientId: string; orderedById: string; test: string; tokenId?: string; notes?: string }) => Promise<LabOrder>;
        updateStatus: (id: string, status: string) => Promise<LabOrder>;
        saveResult: (id: string, result: string) => Promise<LabOrder>;
      };
      auth: {
        login: (email: string, password: string) => Promise<{ id: string; name: string; email: string; role: string; avatar: string; token?: string } | { blocked: true; error?: string } | null>;
        changePassword: (userId: string, current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
      };
      search: {
        global: (query: string) => Promise<GlobalSearchResult>;
      };
    };
  }
}

export {};
