import type { Token, TokenInput, TokenPerson } from './token';
import type { Patient, PatientInput, PatientListInput } from './patient';
import type { Appointment, AppointmentInput, AppointmentPerson } from './appointment';
import type { Invoice, InvoiceInput, InvoicePerson } from './invoice';
import type { ReportSummary } from './report';
import type { LabOrder } from './lab';
import type { GlobalSearchResult } from './search';

// ── Inventory Module Types ───────────────────────────────────────────────────
export interface InventoryCategory {
  id: string;
  name: string;
  description?: string | null;
  _count?: { medicines: number };
}

export interface InventoryMedicine {
  id: string;
  name: string;
  genericName?: string | null;
  categoryId?: string | null;
  barcode?: string | null;
  unit: string;
  rackNumber?: string | null;
  minStockAlert: number;
  createdAt: string;
  updatedAt: string;
  category?: InventoryCategory | null;
  batches?: InventoryBatch[];
  stock?: number;
}

export interface InventoryBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  medicine?: InventoryMedicine;
}

export interface InventorySupplier {
  id: string;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { purchases: number };
}

export interface InventoryPurchaseOrderItem {
  id: string;
  purchaseId: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  batch?: InventoryBatch;
}

export interface InventoryPurchaseOrder {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  totalAmount: number;
  purchaseDate: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: InventorySupplier;
  items?: InventoryPurchaseOrderItem[];
}

export interface InventoryStockMovement {
  id: string;
  batchId: string;
  type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'EXPIRED' | 'DAMAGE' | 'DISPENSE';
  quantity: number;
  reference?: string | null;
  createdAt: string;
  batch?: InventoryBatch;
}
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    clinic: {
      medicines: any;
      license: {
        status: () => Promise<boolean>;
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
        pharmacyQueue: (date: string) => Promise<import('./token').PharmacyQueueItem[]>;
        pharmacyDispense: (
          tokenId: string,
          options?: { invoiceId?: string | null },
        ) => Promise<import('./token').PharmacyQueueItem | null>;
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
        ensureSameDay: (input: AppointmentInput) => Promise<Appointment>;
        update: (id: string, input: AppointmentInput) => Promise<Appointment>;
        cancel: (id: string) => Promise<Appointment>;
      };
      invoices: {
        list: () => Promise<Invoice[]>;
        patients: () => Promise<InvoicePerson[]>;
        create: (input: InvoiceInput) => Promise<Invoice>;
        addPayment: (invoiceId: string, amount: number, method: string, reference?: string) => Promise<Invoice>;
        void: (id: string) => Promise<Invoice>;
        delete: (id: string) => Promise<void>;
        payments: (invoiceId: string) => Promise<import('./invoice').Payment[]>;
      };
      reports: {
        summary: () => Promise<ReportSummary>;
      };
      realtime: {
        connect: () => Promise<void>;
        disconnect: () => void;
        onNotification: (handler: (notification: unknown) => void) => () => void;
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
        get: () => Promise<{ serverMode: 'local' | 'lan-server' | 'lan-client'; clientApiUrl: string; lanPort: number; clinicName: string; clinicAddress: string; clinicPhone: string; setupDone: boolean; databaseMode?: 'local' | 'online'; clinicalApiUrl?: string; schemaId?: string; aiEnabled?: boolean; groqApiKey?: string; groqModel?: string; whatsappEnabled?: boolean; whatsappToken?: string; whatsappPhoneNumberId?: string; whatsappDisplayNumber?: string }>;
        save: (patch: unknown) => Promise<{ serverMode: 'local' | 'lan-server' | 'lan-client'; clientApiUrl: string; lanPort: number; clinicName: string; clinicAddress: string; clinicPhone: string; setupDone: boolean; databaseMode?: 'local' | 'online'; clinicalApiUrl?: string; schemaId?: string; aiEnabled?: boolean; groqApiKey?: string; groqModel?: string; whatsappEnabled?: boolean; whatsappToken?: string; whatsappPhoneNumberId?: string; whatsappDisplayNumber?: string }>;
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
      // ── New Inventory API Bridge Definitions ──────────────────────────────
      inventory: {
        categories: {
          list: () => Promise<InventoryCategory[]>;
          create: (input: { name: string; description?: string }) => Promise<InventoryCategory>;
        };
        medicines: {
          list: () => Promise<InventoryMedicine[]>;
          create: (input: {
            name: string;
            genericName?: string;
            categoryId?: string;
            barcode?: string;
            unit?: string;
            rackNumber?: string;
            minStockAlert?: number;
          }) => Promise<InventoryMedicine>;
          update: (
            id: string,
            input: Partial<{
              name: string;
              genericName?: string;
              categoryId?: string;
              barcode?: string;
              unit?: string;
              rackNumber?: string;
              minStockAlert?: number;
            }>
          ) => Promise<InventoryMedicine>;
          delete: (id: string) => Promise<void>;
          lowStock: () => Promise<InventoryMedicine[]>;
          upsertWithStock: (input: {
            id?: string;
            name: string;
            unit?: string;
            category?: string;
            minStockAlert?: number;
            salePrice?: number;
            stock?: number;
            genericName?: string;
            rackNumber?: string;
          }) => Promise<InventoryMedicine>;
        };
        batches: {
          list: () => Promise<InventoryBatch[]>;
          create: (input: {
            medicineId: string;
            batchNumber: string;
            expiryDate: string | Date;
            purchasePrice: number;
            salePrice: number;
            quantity: number;
          }) => Promise<InventoryBatch>;
          expiringSoon: (daysAhead?: number) => Promise<InventoryBatch[]>;
        };
        suppliers: {
          list: () => Promise<InventorySupplier[]>;
          create: (input: {
            name: string;
            companyName?: string;
            phone?: string;
            email?: string;
            address?: string;
          }) => Promise<InventorySupplier>;
        };
        purchases: {
          list: () => Promise<InventoryPurchaseOrder[]>;
          create: (input: {
            invoiceNumber: string;
            supplierId: string;
            notes?: string;
            items: Array<{
              batchId?: string;
              medicineId?: string;
              batchNumber?: string;
              expiryDate?: string | Date;
              purchasePrice?: number;
              salePrice?: number;
              quantity: number;
              unitPrice: number;
            }>;
          }) => Promise<InventoryPurchaseOrder>;
        };
        movements: {
          list: () => Promise<InventoryStockMovement[]>;
          record: (input: {
            batchId: string;
            type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'EXPIRED' | 'DAMAGE' | 'DISPENSE';
            quantity: number;
            reference?: string;
          }) => Promise<InventoryStockMovement>;
        };
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
        changePassword: (userId: string, current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
      };
      search: {
        global: (query: string) => Promise<GlobalSearchResult>;
      };
    };
  }
}

export {};