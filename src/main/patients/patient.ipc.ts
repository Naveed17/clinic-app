import { ipcMain } from 'electron';
import type { Server as SocketIOServer } from 'socket.io';
import { createPatient, deletePatient, listPatients, updatePatient } from './patient.service';
import { emitNotification } from '../backend/realtime';

export function registerPatientIpc(io?: SocketIOServer): void {
  ipcMain.handle('patients:list', (_, input) => listPatients(input));
  ipcMain.handle('patients:create', async (_, input) => {
    const patient = await createPatient(input);
    if (io) emitNotification(io, { kind: 'success', title: 'Patient added', message: `${patient.firstName} ${patient.lastName} was added.`, payload: { entity: 'patient', id: patient.id } });
    return patient;
  });
  ipcMain.handle('patients:update', async (_, id, input) => {
    const patient = await updatePatient(id, input);
    if (io) emitNotification(io, { kind: 'info', title: 'Patient updated', message: `${patient.firstName} ${patient.lastName} was updated.`, payload: { entity: 'patient', id: patient.id } });
    return patient;
  });
  ipcMain.handle('patients:delete', async (_, id) => {
    const result = await deletePatient(id);
    if (io) emitNotification(io, { kind: 'warning', title: 'Patient deleted', message: 'A patient record was deleted.', payload: { entity: 'patient' } });
    return result;
  });
}
