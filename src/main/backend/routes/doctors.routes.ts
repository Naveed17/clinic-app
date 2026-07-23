import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { listDoctors, createDoctor, updateDoctor, deleteDoctor } from '../../doctors/doctor.service';
import type { DoctorInput, DoctorUpdateInput, DoctorListInput } from '../../doctors/doctor.service';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { emitNotification } from '../realtime';

export function createDoctorsRouter(io: SocketIOServer): Router {
  const router = Router();

  router.get(
    '/',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (req, res) => {
      const input: DoctorListInput = {
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
        search: typeof req.query.search === 'string' ? req.query.search : '',
      };
      res.json(await listDoctors(input));
    }),
  );

  router.post(
    '/',
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
      const doctor = await createDoctor(req.body as DoctorInput);
      emitNotification(io, {
        kind: 'success',
        title: 'Doctor added',
        message: `Dr. ${doctor.firstName} ${doctor.lastName} was added.`,
        payload: { entity: 'doctor', id: doctor.id },
      });
      res.status(201).json(doctor);
    }),
  );

  router.patch(
    '/:id',
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
      const doctor = await updateDoctor(String(req.params.id), req.body as DoctorUpdateInput);
      emitNotification(io, {
        kind: 'info',
        title: 'Doctor updated',
        message: `Dr. ${doctor.firstName} ${doctor.lastName} was updated.`,
        payload: { entity: 'doctor', id: doctor.id },
      });
      res.json(doctor);
    }),
  );

  router.delete(
    '/:id',
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
      await deleteDoctor(String(req.params.id));
      emitNotification(io, {
        kind: 'warning',
        title: 'Doctor removed',
        message: 'A doctor account was deleted.',
        payload: { entity: 'doctor', id: req.params.id },
      });
      res.status(204).send();
    }),
  );

  return router;
}
