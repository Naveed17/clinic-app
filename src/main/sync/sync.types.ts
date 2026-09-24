export const SYNC_TABLES = [
  'User',
  'DoctorProfile',
  'DoctorSchedule',
  'DoctorAttendance',
  'Patient',
  'Medicine',
  'MedicineBatch',
  'Appointment',
  'Token',
  'Prescription',
  'Invoice',
  'InvoiceItem',
  'Payment',
  'LabOrder',
  'LabReport',
  'PatientDocument',
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];

export const SYNC_COLUMNS: Record<SyncTableName, string[]> = {
  User: ['id', 'firstName', 'lastName', 'email', 'passwordHash', 'role', 'isActive', 'avatar', 'createdAt', 'updatedAt'],
  DoctorProfile: [
    'id', 'userId', 'specialization', 'qualification', 'experienceYears', 'phone', 'bio', 'avatar',
    'consultationFee', 'createdAt', 'updatedAt',
  ],
  DoctorSchedule: ['id', 'doctorId', 'dayOfWeek', 'startTime', 'endTime', 'isActive', 'createdAt', 'updatedAt'],
  DoctorAttendance: ['id', 'doctorId', 'date', 'checkInAt', 'checkOutAt', 'createdAt', 'updatedAt'],
  Patient: [
    'id', 'mrNumber', 'firstName', 'lastName', 'weight', 'dateOfBirth', 'gender', 'phone', 'email', 'address',
    'emergencyContactName', 'emergencyContactPhone', 'bloodGroup', 'allergies', 'chronicConditions',
    'primaryDoctorId', 'createdAt', 'updatedAt',
  ],
  Medicine: [
    'id', 'name', 'mg', 'genericName', 'categoryId', 'barcode', 'unit', 'rackNumber', 'minStockAlert',
    'createdAt', 'updatedAt',
  ],
  MedicineBatch: [
    'id', 'medicineId', 'batchNumber', 'expiryDate', 'purchasePrice', 'salePrice', 'quantity',
    'createdAt', 'updatedAt',
  ],
  Appointment: [
    'id', 'patientId', 'providerId', 'startsAt', 'endsAt', 'status', 'reason', 'notes',
    'feeType', 'recurrenceRule', 'parentId', 'createdAt', 'updatedAt',
  ],
  Token: [
    'id', 'tokenNumber', 'date', 'patientId', 'doctorId', 'status', 'notes', 'reason',
    'consultationFee', 'feeDiscount', 'feeRefunded', 'createdAt', 'updatedAt',
  ],
  Prescription: [
    'id', 'tokenId', 'diagnosis', 'medicines', 'tests', 'advice', 'thumbName', 'thumbnail',
    'pharmacyStatus', 'dispensedAt', 'invoiceId', 'createdAt', 'updatedAt',
  ],
  Invoice: [
    'id', 'patientId', 'appointmentId', 'invoiceNumber', 'status', 'issuedAt', 'dueAt', 'subtotal',
    'discount', 'tax', 'total', 'amountPaid', 'notes', 'createdAt', 'updatedAt',
  ],
  InvoiceItem: ['id', 'invoiceId', 'description', 'quantity', 'unitPrice', 'lineTotal', 'createdAt', 'updatedAt'],
  Payment: ['id', 'invoiceId', 'amount', 'method', 'paidAt', 'reference', 'notes', 'createdAt', 'updatedAt'],
  LabOrder: [
    'id', 'patientId', 'orderedById', 'tokenId', 'test', 'status', 'result', 'notes', 'orderedAt',
    'createdAt', 'updatedAt',
  ],
  LabReport: ['id', 'labOrderId', 'name', 'filePath', 'mimeType', 'size', 'uploadedAt', 'createdAt', 'updatedAt'],
  PatientDocument: ['id', 'patientId', 'name', 'filePath', 'mimeType', 'size', 'uploadedAt', 'createdAt', 'updatedAt'],
};

export interface SyncDeletedItem {
  id: string;
  tableName: string;
  deletedAt: string;
}

export type SyncChanges = Partial<Record<SyncTableName, Record<string, unknown>[]>>;

export interface SyncExchangePayload {
  clientSince: number;
  clientChanges: SyncChanges;
  clientDeletions: SyncDeletedItem[];
  deviceId?: string;
}

export interface SyncExchangeResponse {
  ok: boolean;
  serverChanges: SyncChanges;
  serverDeletions: SyncDeletedItem[];
  syncedAt: number;
  serverName?: string;
  error?: string;
}

export interface SyncProgressInfo {
  percent: number;
  label: string;
  currentStep?: number;
  totalSteps?: number;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
  lastSyncTime: number | null;
  peerUrl: string | null;
  peerName?: string;
  message?: string;
  recordsSyncedLastTime?: number;
  progress?: SyncProgressInfo;
}

export interface SyncManifest {
  ok: boolean;
  serverTime: number;
  serverName?: string;
  tables: Partial<Record<SyncTableName, number>>;
  totalRows: number;
  deletionsCount: number;
}
