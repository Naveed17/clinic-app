import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import {
  listMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getLowStockMedicines,
  upsertMedicineWithStock,
  listBatches,
  createBatch,
  getExpiringSoonBatches,
  listSuppliers,
  createSupplier,
  createPurchaseOrder,
  listPurchaseOrders,
  recordStockMovement,
  listStockMovements,
  listCategories,
  createCategory,
} from '../../inventory/inventory.service';
import type {
  MedicineInput,
  BatchInput,
  SupplierInput,
  PurchaseOrderInput,
  StockMovementInput,
} from '../../inventory/inventory.service';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { emitNotification, emitDataChange } from '../realtime';

export function createInventoryRouter(io: SocketIOServer): Router {
  const router = Router();

  // ==========================================
  // MEDICINE CATEGORIES
  // ==========================================

  router.get(
    '/categories',
    requireRole(['admin', 'receptionist', 'pharmacist', 'doctor']),
    asyncHandler(async (_req, res) => {
      res.json(await listCategories());
    }),
  );

  router.post(
    '/categories',
    requireRole(['admin', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const category = await createCategory(req.body as { name: string; description?: string });
      emitDataChange(io, 'inventory-category', 'created');
      res.status(201).json(category);
    }),
  );

  // ==========================================
  // MEDICINE ITEMS
  // ==========================================

  router.get(
    '/medicines',
    requireRole(['admin', 'receptionist', 'pharmacist', 'doctor']),
    asyncHandler(async (_req, res) => {
      res.json(await listMedicines());
    }),
  );

  router.get(
    '/medicines/low-stock',
    requireRole(['admin', 'receptionist', 'pharmacist', 'doctor']),
    asyncHandler(async (_req, res) => {
      res.json(await getLowStockMedicines());
    }),
  );

  router.post(
    '/medicines',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const medicine = await createMedicine(req.body as MedicineInput);
      emitNotification(io, {
        kind: 'success',
        title: 'Medicine Added',
        message: `Medicine ${medicine.name} was added to catalog.`,
        payload: { entity: 'medicine', id: medicine.id },
      });
      emitDataChange(io, 'medicine', 'created');
      res.status(201).json(medicine);
    }),
  );

  router.post(
    '/medicines/upsert-with-stock',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const medicine = await upsertMedicineWithStock(req.body);
      emitDataChange(io, 'medicine', medicine?.id && req.body?.id ? 'updated' : 'created');
      emitDataChange(io, 'inventory-batch', 'updated');
      res.status(201).json(medicine);
    }),
  );

  router.put(
    '/medicines/:id',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const medicine = await updateMedicine(req.params['id'] as string, req.body as Partial<MedicineInput>);
      emitDataChange(io, 'medicine', 'updated');
      res.json(medicine);
    }),
  );

  router.delete(
    '/medicines/:id',
    requireRole(['admin', 'pharmacist']),
    asyncHandler(async (req, res) => {
      await deleteMedicine(req.params['id'] as string);
      emitDataChange(io, 'medicine', 'deleted');
      res.status(204).end();
    }),
  );

  // ==========================================
  // MEDICINE BATCHES & EXPIRY
  // ==========================================

  router.get(
    '/batches',
    requireRole(['admin', 'receptionist', 'pharmacist', 'doctor']),
    asyncHandler(async (_req, res) => {
      res.json(await listBatches());
    }),
  );

  router.get(
    '/batches/expiring-soon',
    requireRole(['admin', 'receptionist', 'pharmacist', 'doctor']),
    asyncHandler(async (req, res) => {
      const days = req.query['days'] ? parseInt(req.query['days'] as string, 10) : 60;
      res.json(await getExpiringSoonBatches(days));
    }),
  );

  router.post(
    '/batches',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const batch = await createBatch(req.body as BatchInput);
      emitNotification(io, {
        kind: 'success',
        title: 'Batch Created',
        message: `Batch ${batch.batchNumber} added with quantity ${batch.quantity}.`,
        payload: { entity: 'batch', id: batch.id },
      });
      emitDataChange(io, 'inventory-batch', 'created');
      res.status(201).json(batch);
    }),
  );

  // ==========================================
  // SUPPLIERS
  // ==========================================

  router.get(
    '/suppliers',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (_req, res) => {
      res.json(await listSuppliers());
    }),
  );

  router.post(
    '/suppliers',
    requireRole(['admin', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const supplier = await createSupplier(req.body as SupplierInput);
      emitNotification(io, {
        kind: 'success',
        title: 'Supplier Added',
        message: `Supplier ${supplier.name} registered.`,
        payload: { entity: 'supplier', id: supplier.id },
      });
      emitDataChange(io, 'supplier', 'created');
      res.status(201).json(supplier);
    }),
  );

  // ==========================================
  // PURCHASE ORDERS
  // ==========================================

  router.get(
    '/purchases',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (_req, res) => {
      res.json(await listPurchaseOrders());
    }),
  );

  router.post(
    '/purchases',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const purchase = await createPurchaseOrder(req.body as PurchaseOrderInput);
      emitNotification(io, {
        kind: 'success',
        title: 'Purchase Order Created',
        message: `Purchase invoice ${purchase.invoiceNumber} recorded.`,
        payload: { entity: 'purchase', id: purchase.id },
      });
      emitDataChange(io, 'purchase-order', 'created');
      emitDataChange(io, 'inventory-batch', 'updated');
      res.status(201).json(purchase);
    }),
  );

  // ==========================================
  // STOCK MOVEMENTS & AUDITING
  // ==========================================

  router.get(
    '/movements',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (_req, res) => {
      res.json(await listStockMovements());
    }),
  );

  router.post(
    '/movements',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const movement = await recordStockMovement(req.body as StockMovementInput);
      emitNotification(io, {
        kind: 'info',
        title: 'Stock Adjusted',
        message: `Stock movement of type ${movement.type} recorded (${movement.quantity}).`,
        payload: { entity: 'stock-movement', id: movement.id },
      });
      emitDataChange(io, 'stock-movement', 'created');
      emitDataChange(io, 'inventory-batch', 'updated');
      res.status(201).json(movement);
    }),
  );

  return router;
}