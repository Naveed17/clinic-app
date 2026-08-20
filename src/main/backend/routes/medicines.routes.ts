import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { emitDataChange, emitNotification } from '../realtime';
import {
  searchCatalogMedicines,
  listCatalogMedicines,
  createCatalogMedicine,
  updateCatalogMedicinePrice,
  updateCatalogMedicine,
  deleteCatalogMedicine,
} from '../../inventory/inventory.service';

export function createMedicinesRouter(io: SocketIOServer): Router {
  const router = Router();
  const readers = requireRole(['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist']);
  const writers = requireRole(['admin', 'receptionist', 'pharmacist']);
  const editors = requireRole(['receptionist', 'pharmacist']);

  router.get(
    '/',
    readers,
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      res.json(q.trim() ? await searchCatalogMedicines(q) : await listCatalogMedicines());
    }),
  );

  router.post(
    '/',
    writers,
    asyncHandler(async (req, res) => {
      const { name, price } = req.body as { name?: string; price?: number };
      if (!name?.trim()) {
        res.status(400).json({ error: 'name is required' });
        return;
      }
      const medicine = await createCatalogMedicine(name, Number(price) || 0);
      emitDataChange(io, 'medicine', 'created');
      emitNotification(io, {
        kind: 'success',
        title: 'Medicine added',
        message: `${medicine.name} was added to the catalog.`,
        payload: { entity: 'medicine', id: medicine.id },
      });
      res.status(201).json(medicine);
    }),
  );

  router.put(
    '/:id/price',
    writers,
    asyncHandler(async (req, res) => {
      const price = Number((req.body as { price?: number }).price) || 0;
      const medicine = await updateCatalogMedicinePrice(req.params['id'] as string, price);
      emitDataChange(io, 'medicine', 'updated');
      res.json(medicine);
    }),
  );

  router.put(
    '/:id',
    editors,
    asyncHandler(async (req, res) => {
      const { name, price } = req.body as { name?: string; price?: number };
      if (!name?.trim()) {
        res.status(400).json({ error: 'name is required' });
        return;
      }
      const medicine = await updateCatalogMedicine(
        req.params['id'] as string,
        name,
        Number(price) || 0,
      );
      emitDataChange(io, 'medicine', 'updated');
      emitNotification(io, {
        kind: 'info',
        title: 'Medicine updated',
        message: `${medicine.name} was updated.`,
        payload: { entity: 'medicine', id: medicine.id },
      });
      res.json(medicine);
    }),
  );

  router.delete(
    '/:id',
    editors,
    asyncHandler(async (req, res) => {
      await deleteCatalogMedicine(req.params['id'] as string);
      emitDataChange(io, 'medicine', 'deleted');
      emitNotification(io, {
        kind: 'warning',
        title: 'Medicine removed',
        message: 'A medicine was deleted from the catalog.',
        payload: { entity: 'medicine', id: req.params['id'] },
      });
      res.status(204).send();
    }),
  );

  return router;
}
