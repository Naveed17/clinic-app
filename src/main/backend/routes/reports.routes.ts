import { Router } from 'express';
import { isOpdReportsLicensed } from '../../license/license.ipc';
import { getOpdDailyReport, getReportSummary } from '../../reports/report.service';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';

function assertOpdReportsAddon(): void {
  if (!isOpdReportsLicensed()) {
    const err = new Error('OPD Reports add-on is not enabled for this license.');
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export function createReportsRouter(): Router {
  const router = Router();

  router.get(
    '/summary',
    requireRole(['admin', 'doctor', 'receptionist', 'lab_technician']),
    asyncHandler(async (_req, res) => {
      res.json(await getReportSummary());
    }),
  );

  router.get(
    '/opd',
    requireRole(['admin', 'receptionist']),
    asyncHandler(async (req, res) => {
      assertOpdReportsAddon();
      res.json(
        await getOpdDailyReport({
          date: String(req.query.date ?? ''),
          dateFrom: String(req.query.dateFrom ?? ''),
          dateTo: String(req.query.dateTo ?? ''),
          doctorId: String(req.query.doctorId ?? '').trim() || null,
        }),
      );
    }),
  );

  return router;
}
