import { Router } from 'express';
import { getReportSummary } from '../../reports/report.service';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';

export function createReportsRouter(): Router {
  const router = Router();

  router.get(
    '/summary',
    requireRole(['admin', 'doctor', 'receptionist', 'lab_technician']),
    asyncHandler(async (_req, res) => {
      res.json(await getReportSummary());
    }),
  );

  return router;
}
