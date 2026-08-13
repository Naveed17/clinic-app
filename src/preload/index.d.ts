import type { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  // ── Inventory Module Shared Types ──────────────────────────────────────────
  interface InventoryCategory {
    id: string;
    name: string;
    description?: string | null;
    _count?: { medicines: number };
  }

  interface InventoryMedicine {
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

  interface InventoryBatch {
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

  interface InventorySupplier {
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

  interface InventoryPurchaseOrderItem {
    id: string;
    purchaseId: string;
    batchId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    batch?: InventoryBatch;
  }

  interface InventoryPurchaseOrder {
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

  interface InventoryStockMovement {
    id: string;
    batchId: string;
    type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'EXPIRED' | 'DAMAGE' | 'DISPENSE';
    quantity: number;
    reference?: string | null;
    createdAt: string;
    batch?: InventoryBatch;
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
        get: () => Promise<{
          serverMode: 'local' | 'lan-server' | 'lan-client';
          clientApiUrl: string;
          lanPort: number;
          clinicName?: string;
          clinicAddress?: string;
          clinicPhone?: string;
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
      // ── Complete Inventory API Type Definitions ───────────────────────────
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
            type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'EXPIRED' | 'DAMAGE';
            quantity: number;
            reference?: string;
          }) => Promise<InventoryStockMovement>;
        };
      };
      search: {
        global: (query: string) => Promise<unknown>;
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