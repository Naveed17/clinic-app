import { Router } from 'express';
import { createPatient, deletePatient, listPatients, updatePatient } from '../../patients/patient.service';
import type { PatientInput, PatientListInput } from '../../patients/patient.service';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { emitNotification, emitDataChange } from '../realtime';
import type { Server as SocketIOServer } from 'socket.io';

export function createPatientsRouter(io: SocketIOServer): Router {
  const router = Router();

  router.get(
    '/',
    requireRole(['admin', 'doctor', 'receptionist', 'lab_technician']),
    asyncHandler(async (req, res) => {
      const input: PatientListInput = {
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
        search: typeof req.query.search === 'string' ? req.query.search : '',
      };
      res.json(await listPatients(input));
    }),
  );

  router.post(
    '/',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (req, res) => {
      const patient = await createPatient(req.body as PatientInput);
      emitNotification(io, {
        kind: 'success',
        title: 'Patient created',
        message: `${patient.firstName} ${patient.lastName} was added to the clinic records.`,
        payload: { entity: 'patient', id: patient.id },
      });
      emitDataChange(io, 'patient', 'created');
      res.status(201).json(patient);
    }),
  );

  router.patch(
    '/:id',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (req, res) => {
      const patient = await updatePatient(String(req.params.id), req.body as PatientInput);
      emitNotification(io, {
        kind: 'info',
        title: 'Patient updated',
        message: `${patient.firstName} ${patient.lastName} was updated.`,
        payload: { entity: 'patient', id: patient.id },
      });
      emitDataChange(io, 'patient', 'updated');
      res.json(patient);
    }),
  );

  router.delete(
    '/:id',
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
      await deletePatient(String(req.params.id));
      emitNotification(io, {
        kind: 'warning',
        title: 'Patient removed',
        message: 'A patient record was deleted.',
        payload: { entity: 'patient', id: req.params.id },
      });
      emitDataChange(io, 'patient', 'deleted');
      res.status(204).send();
    }),
  );

  return router;
}
