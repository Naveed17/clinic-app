import { ipcMain } from 'electron';
import { getDoctorSchedule, upsertDoctorSchedule, type ScheduleInput } from './schedule.service';

export function registerScheduleIpc(): void {
  ipcMain.handle('schedule:get', (_e, doctorId: string) => getDoctorSchedule(doctorId));
  ipcMain.handle('schedule:upsert', (_e, doctorId: string, slots: ScheduleInput[]) =>
    upsertDoctorSchedule(doctorId, slots),
  );
}
