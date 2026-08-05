import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import {
  searchCatalogMedicines,
  createCatalogMedicine,
  updateCatalogMedicinePrice,
} from '../../inventory/inventory.service';

export function createMedicinesRouter(): Router {
  const router = Router();

  router.get(
    '/',
    requireRole(['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      res.json(await searchCatalogMedicines(q));
    }),
  );

  router.post(
    '/',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const { name, price } = req.body as { name?: string; price?: number };
      if (!name?.trim()) {
        res.status(400).json({ error: 'name is required' });
        return;
      }
      const medicine = await createCatalogMedicine(name, Number(price) || 0);
      res.status(201).json(medicine);
    }),
  );

  router.put(
    '/:id/price',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const price = Number((req.body as { price?: number }).price) || 0;
      const medicine = await updateCatalogMedicinePrice(req.params['id'] as string, price);
      res.json(medicine);
    }),
  );

  return router;
}
