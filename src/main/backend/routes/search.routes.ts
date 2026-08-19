import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { isLicenseModuleEnabled } from '../../license/license.ipc';
import { getSearchScope } from '../../../shared/searchAccess';
import { globalSearch } from '../../search/search.service';

export function createSearchRouter(): Router {
  const router = Router();

  router.get(
    '/',
    requireRole(['admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const scope = getSearchScope(req.user?.role, {
        billing: isLicenseModuleEnabled('billing'),
        labDashboard: isLicenseModuleEnabled('labDashboard'),
      });
      res.json(await globalSearch(q, scope));
    }),
  );

  return router;
}
