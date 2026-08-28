import { ipcMain } from 'electron';
import type { Server as SocketIOServer } from 'socket.io';
import {
  cancelAppointment,
  createAppointment,
  deleteAppointment,
  ensureSameDayAppointment,
  getAppointment,
  listAppointmentPatients,
  listAppointments,
  listDoctors,
  updateAppointment,
  updateAppointmentStatus,
} from './appointment.service';
import { emitNotification, emitDataChange } from '../backend/realtime';

export function registerAppointmentIpc(io?: SocketIOServer): void {
  ipcMain.handle('appointments:list', (_, date?: string) => listAppointments(date));
  ipcMain.handle('appointments:get', (_, id: string) => getAppointment(id));
  ipcMain.handle('appointments:patients', () => listAppointmentPatients());
  ipcMain.handle('appointments:doctors', () => listDoctors());
  ipcMain.handle('appointments:create', async (_, input) => {
    const appointment = await createAppointment(input);
    if (io && appointment) {
      emitNotification(io, {
        kind: 'success',
        title: 'Appointment created',
        message: 'A new appointment was scheduled.',
        payload: { entity: 'appointment', id: appointment.id, providerId: appointment.providerId },
      });
    }
    return appointment;
  });
  ipcMain.handle('appointments:ensureSameDay', async (_, input) => {
    const appointment = await ensureSameDayAppointment(input);
    if (io && appointment) {
      emitNotification(io, {
        kind: 'success',
        title: 'Appointment ready',
        message: 'Visit appointment was created or updated for this token.',
        payload: { entity: 'appointment', id: appointment.id, providerId: appointment.providerId },
      });
    }
    return appointment;
  });
  ipcMain.handle('appointments:update', async (_, id, input) => {
    const appointment = await updateAppointment(id, input);
    if (io && appointment) emitNotification(io, { kind: 'info', title: 'Appointment updated', message: 'An appointment was updated.', payload: { entity: 'appointment', id: appointment.id } });
    return appointment;
  });
  ipcMain.handle('appointments:cancel', async (_, id) => {
    const appointment = await cancelAppointment(id);
    if (io && appointment) emitNotification(io, { kind: 'warning', title: 'Appointment cancelled', message: 'An appointment was cancelled.', payload: { entity: 'appointment', id: appointment.id } });
    return appointment;
  });
  ipcMain.handle('appointments:updateStatus', async (_, id, status) => {
    const appointment = await updateAppointmentStatus(id, status);
    if (io && appointment) {
      emitNotification(io, {
        kind: 'info',
        title: 'Appointment updated',
        message: `Appointment status changed to ${appointment?.status}.`,
        payload: { entity: 'appointment', id: appointment.id, providerId: appointment.providerId },
      });
      if (status === 'COMPLETED') emitDataChange(io, 'token', 'updated');
    }
    return appointment;
  });
  ipcMain.handle('appointments:delete', async (_, id) => {
    await deleteAppointment(id);
  });
}
