import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import {
  cancelAppointment,
  createAppointment,
  listAppointmentPatients,
  listAppointments,
  listDoctors,
  updateAppointment,
  updateAppointmentStatus,
} from '../../appointments/appointment.service';
import type { AppointmentInput } from '../../appointments/appointment.service';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { emitNotification } from '../realtime';

export function createAppointmentsRouter(io: SocketIOServer): Router {
  const router = Router();

  router.get(
    '/',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (_req, res) => {
      res.json(await listAppointments());
    }),
  );

  router.get(
    '/patients',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (_req, res) => {
      res.json(await listAppointmentPatients());
    }),
  );

  router.get(
    '/doctors',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (_req, res) => {
      res.json(await listDoctors());
    }),
  );

  router.post(
    '/',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (req, res) => {
      const appointment = await createAppointment(req.body as AppointmentInput);
      emitNotification(io, {
        kind: 'success',
        title: 'Appointment created',
        message: 'A new appointment was scheduled.',
        payload: { entity: 'appointment', id: appointment.id },
      });
      res.status(201).json(appointment);
    }),
  );

  router.patch(
    '/:id',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (req, res) => {
      const appointment = await updateAppointment(String(req.params.id), req.body as AppointmentInput);
      emitNotification(io, {
        kind: 'info',
        title: 'Appointment updated',
        message: 'An appointment was updated.',
        payload: { entity: 'appointment', id: appointment.id },
      });
      res.json(appointment);
    }),
  );

  router.patch(
    '/:id/status',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (req, res) => {
      const appointment = await updateAppointmentStatus(
        String(req.params.id),
        String((req.body as { status: string }).status) as Parameters<typeof updateAppointmentStatus>[1],
      );
      emitNotification(io, {
        kind: 'info',
        title: 'Appointment updated',
        message: `Appointment status changed to ${appointment.status}.`,
        payload: { entity: 'appointment', id: appointment.id },
      });
      res.json(appointment);
    }),
  );

  router.post(
    '/:id/cancel',
    requireRole(['admin', 'doctor', 'receptionist']),
    asyncHandler(async (req, res) => {
      const appointment = await cancelAppointment(String(req.params.id));
      emitNotification(io, {
        kind: 'warning',
        title: 'Appointment cancelled',
        message: 'An appointment was cancelled.',
        payload: { entity: 'appointment', id: appointment.id },
      });
      res.json(appointment);
    }),
  );

  return router;
}
