import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { getDoctorSchedule, upsertDoctorSchedule, type ScheduleInput } from '../../doctors/schedule.service';

export function createScheduleRouter(): Router {
  const router = Router();

  router.get(
    '/:doctorId',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (req, res) => {
      res.json(await getDoctorSchedule(String(req.params.doctorId)));
    }),
  );

  router.put(
    '/:doctorId',
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
      res.json(await upsertDoctorSchedule(String(req.params.doctorId), req.body as ScheduleInput[]));
    }),
  );

  return router;
}
