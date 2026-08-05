import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { globalSearch } from '../../search/search.service';

export function createSearchRouter(): Router {
  const router = Router();

  router.get(
    '/',
    requireRole(['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      res.json(await globalSearch(q));
    }),
  );

  return router;
}
