import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer } from 'electron';
import { io, type Socket } from 'socket.io-client';

let apiUrl = '';
let isLanClient = false;

const settingsReady = ipcRenderer
  .invoke('settings:get')
  .then(async (s: { serverMode: string; clientApiUrl: string }) => {
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
  const { token } = getAuthContext();
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    list: (input: unknown) => ipc('users:list', input),
    create: (input: unknown) => ipc('users:create', input),
    update: (id: string, input: unknown) => ipc('users:update', id, input),
    delete: (id: string) => ipc('users:delete', id),
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
      list: (patientId: string) => ipc('docs:patient:list', patientId),
      upload: (patientId: string) => ipc('docs:patient:upload', patientId),
      delete: (id: string) => ipc('docs:patient:delete', id),
      open: (id: string) => ipc('docs:patient:open', id),
      whatsapp: (id: string, phone?: string) => ipc('docs:patient:whatsapp', id, phone),
    },
    lab: {
      list: (labOrderId: string) => ipc('docs:lab:list', labOrderId),
      upload: (labOrderId: string) => ipc('docs:lab:upload', labOrderId),
      delete: (id: string) => ipc('docs:lab:delete', id),
      open: (id: string) => ipc('docs:lab:open', id),
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
    listByToken: (tokenId: string) => ipc('lab:list-by-token', tokenId),
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
      const activeSocket = await ensureSocket();
      const { token } = getAuthContext();
      activeSocket.auth = token ? { token } : {};
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
  settings: {
    get: () => ipc('settings:get'),
    save: (patch: unknown) => ipc('settings:save', patch),
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