import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
  suggestPrescription,
  summarizePatientHistory,
  type SuggestPrescriptionInput,
  type SummarizePatientInput,
} from './groq.service';

type StreamMeta = { requestId?: string };

export function registerAiIpc(): void {
  ipcMain.handle(
    'ai:suggestPrescription',
    async (event: IpcMainInvokeEvent, input: SuggestPrescriptionInput & StreamMeta) => {
      const requestId = input?.requestId;
      const { requestId: _rid, ...payload } = input ?? {};
      return suggestPrescription(payload, (delta) => {
        if (!requestId) return;
        event.sender.send('ai:suggestPrescription:delta', { requestId, delta });
      });
    },
  );

  ipcMain.handle(
    'ai:summarizePatient',
    async (event: IpcMainInvokeEvent, input: SummarizePatientInput & StreamMeta) => {
      const requestId = input?.requestId;
      const { requestId: _rid, ...payload } = input ?? { visits: [] };
      return summarizePatientHistory(
        { ...payload, visits: payload.visits ?? [] },
        (delta) => {
          if (!requestId) return;
          event.sender.send('ai:summarizePatient:delta', { requestId, delta });
        },
      );
    },
  );
}
