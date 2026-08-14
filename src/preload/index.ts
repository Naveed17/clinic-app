import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer } from 'electron';
import { io, type Socket } from 'socket.io-client';

let apiUrl = '';
let isLanClient = false;
let isOnlineClient = false;
let onlineSchemaId = '';
let onlineLicenseKey = '';

const settingsReady = ipcRenderer
  .invoke('settings:get')
  .then(async (s: {
    serverMode: string;
    clientApiUrl: string;
    databaseMode?: string;
    clinicalApiUrl?: string;
    schemaId?: string;
  }) => {
    if (s.databaseMode === 'online' && s.clinicalApiUrl) {
      apiUrl = s.clinicalApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
      isOnlineClient = true;
      isLanClient = true; // reuse HTTP path in call()
      onlineSchemaId = s.schemaId || '';
      try {
        const meta = await ipcRenderer.invoke('license:database-mode') as {
          schemaId?: string;
          key?: string;
        };
        if (meta?.schemaId) onlineSchemaId = meta.schemaId;
        if (meta?.key) onlineLicenseKey = meta.key;
      } catch { /* ignore */ }
      return;
    }
    if (s.serverMode === 'lan-client' && s.clientApiUrl) {
      // If main fell back to a local backend (server unreachable), app:get-api-url is set.
      // Prefer IPC/local in that case so we don't keep hitting a dead remote URL.
      const runtimeUrl = await ipcRenderer.invoke('app:get-api-url').catch(() => null);
      if (runtimeUrl) {
        apiUrl = runtimeUrl as string;
        isLanClient = false;
      } else {
        apiUrl = s.clientApiUrl;
        isLanClient = true;
      }
    } else {
      const url = await ipcRenderer.invoke('app:get-api-url').catch(() => null);
      if (url) apiUrl = url as string;
    }
  })
  .catch(() => {});

let socket: Socket | undefined;
let socketUrl = '';

function getAuthContext(): { token?: string } {
  try {
    const token = window.localStorage.getItem('clinic-auth-token');
    return token ? { token } : {};
  } catch {
    return {};
  }
}

/** Wait for settings so LAN clients connect to the server, not localhost. */
async function resolveSocketUrl(): Promise<string> {
  await settingsReady;
  if (apiUrl) return apiUrl;
  const runtimeUrl = await ipcRenderer.invoke('app:get-api-url').catch(() => null);
  if (typeof runtimeUrl === 'string' && runtimeUrl) return runtimeUrl;
  return 'http://127.0.0.1:3333';
}

function toQueryString(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  await settingsReady;
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
    } catch {
      return 'Asia/Karachi';
    }
  })();
  const { token } = getAuthContext();
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isOnlineClient && onlineSchemaId ? { 'x-schema-id': onlineSchemaId } : {}),
      ...(isOnlineClient && onlineLicenseKey ? { 'x-license-key': onlineLicenseKey } : {}),
      ...(isOnlineClient || isLanClient ? { 'x-timezone': timeZone } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('clinic:session-expired'));
    throw new Error('Session expired.');
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}.`);
  }
  if (response.status === 204) return undefined as T;
  if (response.status === 205) return true as T;
  return (await response.json()) as T;
}

// LAN client: HTTP to remote server. Local/server: IPC to main process.
function ipc<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function call<T>(httpFn: () => Promise<T>, ipcChannel: string, ...ipcArgs: unknown[]): Promise<T> {
  if (isLanClient) return httpFn();
  return ipc<T>(ipcChannel, ...ipcArgs);
}

async function ensureSocket(): Promise<Socket> {
  const url = await resolveSocketUrl();
  if (socket && socketUrl !== url) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = undefined;
  }
  if (!socket) {
    socketUrl = url;
    socket = io(url, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      auth: isOnlineClient
        ? {
            schemaId: onlineSchemaId,
            licenseKey: onlineLicenseKey,
            ...(getAuthContext().token ? { token: getAuthContext().token } : {}),
          }
        : getAuthContext().token
          ? { token: getAuthContext().token }
          : undefined,
    });
  }
  return socket;
}

const api = {
  patients: {
    list: (input: unknown) =>
      call(
        () => request(`/api/patients?${toQueryString(input)}`),
        'patients:list', input,
      ),
    create: (input: unknown) =>
      call(
        () => request('/api/patients', { method: 'POST', body: JSON.stringify(input) }),
        'patients:create', input,
      ),
    update: (id: string, input: unknown) =>
      call(
        () => request(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
        'patients:update', id, input,
      ),
    delete: (id: string) =>
      call(
        () => request(`/api/patients/${id}`, { method: 'DELETE' }),
        'patients:delete', id,
      ),
  },
  appointments: {
    list: () => call(() => request('/api/appointments'), 'appointments:list'),
    patients: () => call(() => request('/api/appointments/patients'), 'appointments:patients'),
    doctors: () => call(() => request('/api/appointments/doctors'), 'appointments:doctors'),
    create: (input: unknown) =>
      call(
        () => request('/api/appointments', { method: 'POST', body: JSON.stringify(input) }),
        'appointments:create', input,
      ),
    ensureSameDay: (input: unknown) =>
      call(
        () =>
          request('/api/appointments/ensure-same-day', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
        'appointments:ensureSameDay',
        input,
      ),
    update: (id: string, input: unknown) =>
      call(
        () => request(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
        'appointments:update', id, input,
      ),
    updateStatus: (id: string, status: string) =>
      call(
        () => request(`/api/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
        'appointments:updateStatus', id, status,
      ),
    cancel: (id: string) =>
      call(
        () => request(`/api/appointments/${id}/cancel`, { method: 'POST' }),
        'appointments:cancel', id,
      ),
    delete: (id: string) =>
      call(
        () => request(`/api/appointments/${id}`, { method: 'DELETE' }),
        'appointments:delete', id,
      ),
  },
  invoices: {
    list: () => call(() => request('/api/invoices'), 'invoices:list'),
    patients: () => call(() => request('/api/invoices/patients'), 'invoices:patients'),
    create: (input: unknown) =>
      call(
        () => request('/api/invoices', { method: 'POST', body: JSON.stringify(input) }),
        'invoices:create', input,
      ),
    addPayment: (invoiceId: string, amount: number, method: string, reference?: string) =>
      call(
        () => request(`/api/invoices/${invoiceId}/payment`, { method: 'POST', body: JSON.stringify({ amount, method, reference }) }),
        'invoices:add-payment', invoiceId, amount, method, reference,
      ),
    void: (id: string) =>
      call(
        () => request(`/api/invoices/${id}/void`, { method: 'POST' }),
        'invoices:void', id,
      ),
    delete: (id: string) =>
      call(
        () => request(`/api/invoices/${id}`, { method: 'DELETE' }),
        'invoices:delete', id,
      ),
    payments: (invoiceId: string) =>
      call(
        () => request(`/api/invoices/${invoiceId}/payments`),
        'invoices:payments', invoiceId,
      ),
  },
  reports: {
    summary: () => call(() => request('/api/reports/summary'), 'reports:summary'),
  },
  users: {
    list: (input: unknown) =>
      call(
        () => request(`/api/users?${toQueryString(input)}`),
        'users:list', input,
      ),
    create: (input: unknown) =>
      call(
        () => request('/api/users', { method: 'POST', body: JSON.stringify(input) }),
        'users:create', input,
      ),
    update: (id: string, input: unknown) =>
      call(
        () => request(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
        'users:update', id, input,
      ),
    delete: (id: string) =>
      call(
        () => request(`/api/users/${id}`, { method: 'DELETE' }),
        'users:delete', id,
      ),
  },
  doctors: {
    list: (input: unknown) =>
      call(
        () => request(`/api/doctors?${toQueryString(input)}`),
        'doctors:list', input,
      ),
    getOne: (id: string) =>
      call(
        () => request(`/api/doctors/${id}`),
        'doctors:getOne', id,
      ),
    attendance: (id: string, year: number, month: number) =>
      call(
        () => request(`/api/doctors/${id}/attendance?year=${year}&month=${month}`),
        'doctors:attendance', id, year, month,
      ),
    create: (input: unknown) =>
      call(
        () => request('/api/doctors', { method: 'POST', body: JSON.stringify(input) }),
        'doctors:create', input,
      ),
    update: (id: string, input: unknown) =>
      call(
        () => request(`/api/doctors/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
        'doctors:update', id, input,
      ),
    delete: (id: string) =>
      call(
        () => request(`/api/doctors/${id}`, { method: 'DELETE' }),
        'doctors:delete', id,
      ),
  },
  backup: {
    create: () => ipc('backup:create'),
    restore: () => ipc('backup:restore'),
  },
  docs: {
    patient: {
      list: (patientId: string) =>
        isOnlineClient
          ? request(`/api/docs/patients/${encodeURIComponent(patientId)}`)
          : ipc('docs:patient:list', patientId),
      upload: async (patientId: string) => {
        if (!isOnlineClient) return ipc('docs:patient:upload', patientId);
        const files = await ipc<
          { name: string; mimeType: string; size: number; fileData: string }[]
        >('docs:pick-files', {
          title: 'Select Document',
          extensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'txt'],
        });
        if (!files.length) return [];
        const results = [];
        for (const file of files) {
          results.push(
            await request(`/api/docs/patients/${encodeURIComponent(patientId)}`, {
              method: 'POST',
              body: JSON.stringify(file),
            }),
          );
        }
        return results;
      },
      delete: (id: string) =>
        isOnlineClient
          ? request(`/api/docs/${encodeURIComponent(id)}`, { method: 'DELETE' })
          : ipc('docs:patient:delete', id),
      open: async (id: string) => {
        if (!isOnlineClient) return ipc('docs:patient:open', id);
        const doc = await request<{
          name: string;
          mimeType: string;
          fileData: string | null;
          open?: { type: string; name: string; data: string };
        }>(`/api/docs/${encodeURIComponent(id)}`);
        if (doc.open?.type === 'pdf' || doc.open?.type === 'image') return doc.open;
        return ipc('docs:open-buffer', {
          name: doc.name,
          mimeType: doc.mimeType,
          fileData: doc.fileData,
        });
      },
      whatsapp: async (id: string, phone?: string) => {
        if (!isOnlineClient) return ipc('docs:patient:whatsapp', id, phone);
        const doc = await request<{
          name: string;
          mimeType: string;
          fileData: string | null;
          patient?: {
            firstName?: string;
            lastName?: string;
            phone?: string | null;
            mrNumber?: string | null;
          };
        }>(`/api/docs/${encodeURIComponent(id)}`);
        if (!doc.fileData) return { success: false, error: 'File not found.' };
        return ipc('docs:whatsapp-from-buffer', {
          fileName: doc.name,
          mimeType: doc.mimeType,
          fileData: doc.fileData,
          phone: phone || doc.patient?.phone,
          context: {
            patientName: `${doc.patient?.firstName ?? ''} ${doc.patient?.lastName ?? ''}`.trim(),
            mrNumber: doc.patient?.mrNumber ?? null,
          },
        });
      },
    },
    lab: {
      list: (labOrderId: string) =>
        isOnlineClient
          ? request(`/api/docs/lab/${encodeURIComponent(labOrderId)}`)
          : ipc('docs:lab:list', labOrderId),
      upload: async (labOrderId: string) => {
        if (!isOnlineClient) return ipc('docs:lab:upload', labOrderId);
        const files = await ipc<
          { name: string; mimeType: string; size: number; fileData: string }[]
        >('docs:pick-files', {
          title: 'Attach Lab Report',
          extensions: ['pdf', 'jpg', 'jpeg', 'png'],
        });
        if (!files.length) return [];
        const results = [];
        for (const file of files) {
          results.push(
            await request(`/api/docs/lab/${encodeURIComponent(labOrderId)}`, {
              method: 'POST',
              body: JSON.stringify(file),
            }),
          );
        }
        return results;
      },
      delete: (id: string) =>
        isOnlineClient
          ? request(`/api/docs/lab-report/${encodeURIComponent(id)}`, { method: 'DELETE' })
          : ipc('docs:lab:delete', id),
      open: async (id: string) => {
        if (!isOnlineClient) return ipc('docs:lab:open', id);
        const report = await request<{
          name: string;
          mimeType: string;
          fileData: string | null;
        }>(`/api/docs/lab-report/${encodeURIComponent(id)}`);
        await ipc('docs:open-buffer', {
          name: report.name,
          mimeType: report.mimeType,
          fileData: report.fileData,
        });
      },
    },
  },
  tokens: {
    getForPatient: (patientId: string, date: string) =>
      call(
        () => request(`/api/tokens/for-patient?patientId=${patientId}&date=${date}`),
        'tokens:get-for-patient', patientId, date,
      ),
    list: (date: string) =>
      call(
        () => request(`/api/tokens?date=${date}`),
        'tokens:list', date,
      ),
    listPrescriptions: (date: string) =>
      call(
        () => request(`/api/tokens/prescriptions?date=${date}`),
        'tokens:list-prescriptions', date,
      ),
    pharmacyQueue: (date: string) =>
      call(
        () => request(`/api/tokens/pharmacy-queue?date=${date}`),
        'tokens:pharmacy-queue', date,
      ),
    pharmacyDispense: (tokenId: string, options?: { invoiceId?: string | null }) =>
      call(
        () =>
          request(`/api/tokens/${tokenId}/pharmacy-dispense`, {
            method: 'POST',
            body: JSON.stringify(options ?? {}),
          }),
        'tokens:pharmacy-dispense',
        tokenId,
        options,
      ),
    getById: (tokenId: string) =>
      call(
        () => request(`/api/tokens/${tokenId}`),
        'tokens:get-by-id', tokenId,
      ),
    doctors: () => call(() => request('/api/tokens/doctors'), 'tokens:doctors'),
    patients: () => call(() => request('/api/tokens/patients'), 'tokens:patients'),
    create: (input: unknown) =>
      call(
        () => request('/api/tokens', { method: 'POST', body: JSON.stringify(input) }),
        'tokens:create', input,
      ),
    updateStatus: (id: string, status: string) =>
      call(
        () => request(`/api/tokens/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
        'tokens:update-status', id, status,
      ),
    delete: (id: string) =>
      call(
        () => request(`/api/tokens/${id}`, { method: 'DELETE' }),
        'tokens:delete', id,
      ),
    upsertPrescription: (tokenId: string, input: unknown) =>
      call(
        () => request(`/api/tokens/${tokenId}/prescription`, { method: 'PUT', body: JSON.stringify(input) }),
        'tokens:upsert-prescription', tokenId, input,
      ),
  },
  lab: {
    list: () => call(() => request('/api/lab'), 'lab:list'),
    listByToken: (tokenId: string) =>
      call(
        () => request(`/api/lab/by-token/${encodeURIComponent(tokenId)}`),
        'lab:list-by-token', tokenId,
      ),
    patients: () => call(() => request('/api/lab/patients'), 'lab:patients'),
    create: (input: unknown) =>
      call(
        () => request('/api/lab', { method: 'POST', body: JSON.stringify(input) }),
        'lab:create', input,
      ),
    updateStatus: (id: string, status: string) =>
      call(
        () => request(`/api/lab/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
        'lab:update-status', id, status,
      ),
    saveResult: (id: string, result: string) =>
      call(
        () => request(`/api/lab/${id}/result`, { method: 'PATCH', body: JSON.stringify({ result }) }),
        'lab:save-result', id, result,
      ),
  },
  realtime: {
    connect: async () => {
      await settingsReady;
      const activeSocket = await ensureSocket();
      const { token } = getAuthContext();
      activeSocket.auth = {
        ...(token ? { token } : {}),
        ...(isOnlineClient && onlineSchemaId ? { schemaId: onlineSchemaId } : {}),
        ...(isOnlineClient && onlineLicenseKey ? { licenseKey: onlineLicenseKey } : {}),
      };
      if (!activeSocket.connected) activeSocket.connect();
    },
    disconnect: () => {
      socket?.disconnect();
    },
    onDataChanged: (handler: (e: { entity: string; action: string }) => void) => {
      let active: Socket | undefined;
      let cancelled = false;
      void ensureSocket().then((s) => {
        if (cancelled) return;
        active = s;
        s.on('data:changed', handler);
      });
      return () => {
        cancelled = true;
        active?.off('data:changed', handler);
      };
    },
    onNotification: (handler: (notification: unknown) => void) => {
      let active: Socket | undefined;
      let cancelled = false;
      void ensureSocket().then((s) => {
        if (cancelled) return;
        active = s;
        s.on('notification:new', handler);
      });
      return () => {
        cancelled = true;
        active?.off('notification:new', handler);
      };
    },
  },
  schedule: {
    get: (doctorId: string) =>
      call(
        () => request(`/api/schedule/${doctorId}`),
        'schedule:get', doctorId,
      ),
    upsert: (doctorId: string, slots: unknown[]) =>
      call(
        () => request(`/api/schedule/${doctorId}`, { method: 'PUT', body: JSON.stringify(slots) }),
        'schedule:upsert', doctorId, slots,
      ),
  },
  print: {
    /** Base64 PDF — Chromium print (preview often unavailable for PDFs). */
    pdf: (base64: string, options?: { printDialog?: boolean; paper?: 'pos80' | 'A4' }) =>
      ipc<{ ok: boolean; error?: string }>('print:pdf', base64, options),
    /** HTML receipt — Chromium print dialog with live preview. */
    html: (html: string, options?: { printDialog?: boolean; paper?: 'pos80' | 'A4' }) =>
      ipc<{ ok: boolean; error?: string }>('print:html', html, options),
    /** Offscreen HTML → PNG base64 (prescription list thumbnails). */
    captureHtml: (html: string, options?: { width?: number; height?: number }) =>
      ipc<{ ok: boolean; base64?: string; error?: string }>('print:captureHtml', html, options),
  },
  ai: {
    suggestPrescription: (
      input: {
        diagnosis?: string;
        age?: string;
        sex?: string;
        currentText?: string;
        patientName?: string;
      },
      onDelta?: (delta: string) => void,
    ) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const listener = (_e: unknown, msg: { requestId?: string; delta?: string }) => {
        if (msg?.requestId === requestId && msg.delta) onDelta?.(msg.delta);
      };
      if (onDelta) ipcRenderer.on('ai:suggestPrescription:delta', listener);
      return ipc<{ ok: boolean; html?: string; error?: string }>('ai:suggestPrescription', {
        ...input,
        requestId,
      }).finally(() => {
        if (onDelta) ipcRenderer.removeListener('ai:suggestPrescription:delta', listener);
      });
    },
    summarizePatient: (
      input: {
        patientName?: string;
        visits: Array<{ date?: string; diagnosis?: string; advice?: string }>;
      },
      onDelta?: (delta: string) => void,
    ) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const listener = (_e: unknown, msg: { requestId?: string; delta?: string }) => {
        if (msg?.requestId === requestId && msg.delta) onDelta?.(msg.delta);
      };
      if (onDelta) ipcRenderer.on('ai:summarizePatient:delta', listener);
      return ipc<{ ok: boolean; summary?: string; error?: string }>('ai:summarizePatient', {
        ...input,
        requestId,
      }).finally(() => {
        if (onDelta) ipcRenderer.removeListener('ai:summarizePatient:delta', listener);
      });
    },
  },
  whatsapp: {
    status: () =>
      ipc<{ enabled: boolean; configured: boolean; displayNumber: string }>('whatsapp:status'),
    embeddedConfig: () =>
      ipc<{ configured: boolean; appId: string; configId: string }>('whatsapp:embeddedConfig'),
    embeddedExchange: (input: {
      code: string;
      phoneNumberId?: string | null;
      wabaId?: string | null;
    }) =>
      ipc<{
        success: boolean;
        token?: string;
        phoneNumberId?: string;
        displayNumber?: string;
        wabaId?: string;
        error?: string;
      }>('whatsapp:embeddedExchange', input),
    test: () =>
      ipc<{ ok: boolean; name?: string; phone?: string; error?: string }>('whatsapp:test'),
    campaign: (input: {
      text: string;
      phones: string[];
      imageBase64?: string;
      imageMime?: string;
      imageName?: string;
    }) =>
      ipc<{ sent: number; failed: number; skipped: number; errors: string[] }>(
        'whatsapp:campaign',
        input,
      ),
    sendMessage: (input: { phone?: string; text: string }) =>
      ipc<{ success: boolean; error?: string }>('whatsapp:sendMessage', input),
  },
  settings: {
    get: async () => {
      const local = await ipc<Record<string, unknown>>('settings:get');
      if (!isOnlineClient) return local;
      try {
        const meta = await request<{
          clinicName?: string;
          clinicAddress?: string;
          clinicPhone?: string;
        }>('/api/clinic/meta');
        return {
          ...local,
          clinicName: meta.clinicName || local.clinicName || '',
          clinicAddress: meta.clinicAddress || local.clinicAddress || '',
          clinicPhone: meta.clinicPhone || local.clinicPhone || '',
        };
      } catch {
        return local;
      }
    },
    save: async (patch: unknown) => {
      const saved = await ipc<Record<string, unknown>>('settings:save', patch);
      if (isOnlineClient && patch && typeof patch === 'object') {
        const p = patch as Record<string, unknown>;
        try {
          await request('/api/clinic/meta', {
            method: 'PUT',
            body: JSON.stringify({
              clinicName: p.clinicName ?? saved.clinicName ?? '',
              clinicAddress: p.clinicAddress ?? saved.clinicAddress ?? '',
              clinicPhone: p.clinicPhone ?? saved.clinicPhone ?? '',
            }),
          });
        } catch {
          /* local save still succeeded */
        }
      }
      return saved;
    },
    relaunch: () => ipc('settings:relaunch'),
    lanIp: () => ipc('settings:lan-ip'),
    testConnection: (url: string) => ipc('settings:test-connection', url),
    scan: () => ipc('settings:scan'),
    onServerFound: (handler: (server: unknown) => void) => {
      ipcRenderer.on('discovery:server-found', (_e, server) => handler(server));
      return () => ipcRenderer.removeAllListeners('discovery:server-found');
    },
    onLanReconnected: (handler: (url: string) => void) => {
      const listener = (_e: unknown, url: string) => {
        apiUrl = url;
        isLanClient = true;
        handler(url);
      };
      ipcRenderer.on('lan:server-reconnected', listener);
      return () => ipcRenderer.removeListener('lan:server-reconnected', listener);
    },
  },
  license: {
    status: () => ipc('license:status'),
    activate: (key: string) => ipc('license:activate', key),
    modules: () => ipc<Record<string, boolean>>('license:modules'),
    databaseMode: () =>
      ipc<{ databaseMode: 'local' | 'online'; clinicalApiUrl: string; schemaId: string }>('license:database-mode'),
  },
  medicines: {
    search: (query: string) =>
      call(
        () => request(`/api/medicines?q=${encodeURIComponent(query)}`),
        'medicines:search', query,
      ),
    list: () =>
      call(
        () => request('/api/medicines'),
        'medicines:list',
      ),
    create: (name: string, price: number) =>
      call(
        () => request('/api/medicines', { method: 'POST', body: JSON.stringify({ name, price }) }),
        'medicines:create', name, price,
      ),
    updatePrice: (id: string, price: number) =>
      call(
        () => request(`/api/medicines/${id}/price`, { method: 'PUT', body: JSON.stringify({ price }) }),
        'medicines:update-price', id, price,
      ),
  },
  // ==========================================
  // COMPLETE INVENTORY MODULE API (LAN & IPC)
  // ==========================================
  inventory: {
    categories: {
      list: () => call(() => request('/api/inventory/categories'), 'inventory:categories:list'),
      create: (input: unknown) =>
        call(
          () => request('/api/inventory/categories', { method: 'POST', body: JSON.stringify(input) }),
          'inventory:categories:create', input,
        ),
    },
    medicines: {
      list: () => call(() => request('/api/inventory/medicines'), 'inventory:medicines:list'),
      create: (input: unknown) =>
        call(
          () => request('/api/inventory/medicines', { method: 'POST', body: JSON.stringify(input) }),
          'inventory:medicines:create', input,
        ),
      update: (id: string, input: unknown) =>
        call(
          () => request(`/api/inventory/medicines/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
          'inventory:medicines:update', { id, data: input },
        ),
      delete: (id: string) =>
        call(
          () => request(`/api/inventory/medicines/${id}`, { method: 'DELETE' }),
          'inventory:medicines:delete', id,
        ),
      lowStock: () =>
        call(
          () => request('/api/inventory/medicines/low-stock'),
          'inventory:medicines:low-stock',
        ),
      upsertWithStock: (input: unknown) =>
        call(
          () => request('/api/inventory/medicines/upsert-with-stock', { method: 'POST', body: JSON.stringify(input) }),
          'inventory:medicines:upsert-with-stock', input,
        ),
    },
    batches: {
      list: () => call(() => request('/api/inventory/batches'), 'inventory:batches:list'),
      create: (input: unknown) =>
        call(
          () => request('/api/inventory/batches', { method: 'POST', body: JSON.stringify(input) }),
          'inventory:batches:create', input,
        ),
      expiringSoon: (daysAhead = 60) =>
        call(
          () => request(`/api/inventory/batches/expiring-soon?days=${daysAhead}`),
          'inventory:batches:expiring-soon', daysAhead,
        ),
    },
    suppliers: {
      list: () => call(() => request('/api/inventory/suppliers'), 'inventory:suppliers:list'),
      create: (input: unknown) =>
        call(
          () => request('/api/inventory/suppliers', { method: 'POST', body: JSON.stringify(input) }),
          'inventory:suppliers:create', input,
        ),
    },
    purchases: {
      list: () => call(() => request('/api/inventory/purchases'), 'inventory:purchases:list'),
      create: (input: unknown) =>
        call(
          () => request('/api/inventory/purchases', { method: 'POST', body: JSON.stringify(input) }),
          'inventory:purchases:create', input,
        ),
    },
    movements: {
      list: () => call(() => request('/api/inventory/movements'), 'inventory:movements:list'),
      record: (input: unknown) =>
        call(
          () => request('/api/inventory/movements', { method: 'POST', body: JSON.stringify(input) }),
          'inventory:movements:record', input,
        ),
    },
  },
  search: {
    global: (query: string) =>
      call(
        () => request(`/api/search?q=${encodeURIComponent(query)}`),
        'search:global', query,
      ),
  },
  update: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    check: () => ipcRenderer.invoke('app:check-for-updates'),
    install: () => ipcRenderer.invoke('app:install-update'),

    onAvailable: (handler: (version?: string) => void) => {
      const listener = (_: unknown, version?: string) => handler(version);
      ipcRenderer.on('app:update-available', listener);
      return () => {
        ipcRenderer.removeListener('app:update-available', listener);
      };
    },

    onProgress: (handler: (progress: number | {
      percent: number;
      transferred?: number;
      total?: number;
      bytesPerSecond?: number;
      phase?: string;
      label?: string;
    }) => void) => {
      const listener = (_: unknown, progress: number | Record<string, unknown>) => handler(progress as any);
      ipcRenderer.on('app:update-progress', listener);
      return () => {
        ipcRenderer.removeListener('app:update-progress', listener);
      };
    },

    onReady: (handler: () => void) => {
      const listener = () => handler();
      ipcRenderer.on('app:update-ready', listener);
      return () => {
        ipcRenderer.removeListener('app:update-ready', listener);
      };
    },

    onError: (handler: (err: string) => void) => {
      const listener = (_: unknown, err: string) => handler(err);
      ipcRenderer.on('app:update-error', listener);
      return () => {
        ipcRenderer.removeListener('app:update-error', listener);
      };
    },
  },
  auth: {
    login: async (email: string, password: string) => {
      await settingsReady;
      if (isLanClient) {
        return request<{ id: string; name: string; email: string; role: string; avatar: string; token?: string } | null>(
          '/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
        ).catch(() => null);
      }
      return ipc('auth:login', email, password);
    },
    changePassword: async (userId: string, current: string, next: string) => {
      await settingsReady;
      if (isLanClient) {
        return request<{ ok: boolean; error?: string }>(
          '/api/auth/change-password', { method: 'POST', body: JSON.stringify({ userId, currentPassword: current, newPassword: next }) }
        ).catch(() => ({ ok: false, error: 'Request failed.' }));
      }
      return ipc('auth:change-password', userId, current, next);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);
contextBridge.exposeInMainWorld('clinic', api);