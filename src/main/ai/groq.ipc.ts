import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
  interpretLabReport,
  suggestPrescription,
  summarizePatientHistory,
  testGroqConnection,
  type InterpretLabInput,
  type SuggestPrescriptionInput,
  type SummarizePatientInput,
} from './groq.service';

type StreamMeta = { requestId?: string };

function withoutRequestId<T extends StreamMeta>(input: T): Omit<T, 'requestId'> {
  const rest = { ...input };
  delete rest.requestId;
  return rest;
}

export function registerAiIpc(): void {
  ipcMain.handle('ai:test', (_e, input?: { apiKey?: string }) =>
    testGroqConnection(input?.apiKey),
  );

  ipcMain.handle(
    'ai:suggestPrescription',
    async (event: IpcMainInvokeEvent, input: SuggestPrescriptionInput & StreamMeta) => {
      const requestId = input?.requestId;
      const payload = withoutRequestId(input ?? {});
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
      const payload = withoutRequestId(input ?? { visits: [] });
      return summarizePatientHistory(
        { ...payload, visits: payload.visits ?? [] },
        (delta) => {
          if (!requestId) return;
          event.sender.send('ai:summarizePatient:delta', { requestId, delta });
        },
      );
    },
  );

  ipcMain.handle(
    'ai:interpretLabReport',
    async (event: IpcMainInvokeEvent, input: InterpretLabInput & StreamMeta) => {
      const requestId = input?.requestId;
      const payload = withoutRequestId(input ?? { testName: '', rows: [] });
      return interpretLabReport(
        { ...payload, rows: payload.rows ?? [], testName: payload.testName ?? '' },
        (delta) => {
          if (!requestId) return;
          event.sender.send('ai:interpretLabReport:delta', { requestId, delta });
        },
      );
    },
  );
}
