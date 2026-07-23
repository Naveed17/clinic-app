import { Router } from 'express';
import { getReportSummary, getDetailedReport, getDoctorRevenue } from '../../reports/report.service';
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

  router.get(
    '/detailed',
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
      const from = String(req.query.from ?? '');
      const to = String(req.query.to ?? '');
      res.json(await getDetailedReport(from, to));
    }),
  );

  router.get(
    '/doctor-revenue',
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
      const from = String(req.query.from ?? '');
      const to = String(req.query.to ?? '');
      res.json(await getDoctorRevenue(from, to));
    }),
  );

  return router;
}
