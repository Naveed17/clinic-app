import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer } from 'electron';
import { io, type Socket } from 'socket.io-client';

let apiUrl = '';
let isLanClient = false;

const settingsReady = ipcRenderer
  .invoke('settings:get')
  .then(async (s: { serverMode: string; clientApiUrl: string }) => {
    if (s.serverMode === 'lan-client' && s.clientApiUrl) {
      apiUrl = s.clientApiUrl;
      isLanClient = true;
    } else {
      const url = await ipcRenderer.invoke('app:get-api-url').catch(() => null);
      if (url) apiUrl = url as string;
    }
  })
  .catch(() => {});

let socket: Socket | undefined;

function getAuthContext(): { token?: string } {
  try {
    const token = window.localStorage.getItem('clinic-auth-token');
    return token ? { token } : {};
  } catch {
    return {};
  }
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

function ensureSocket(): Socket {
  if (!socket) {
    socket = io(apiUrl || 'http://127.0.0.1:3333', {
      autoConnect: false,
      transports: ['websocket'],
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
    print: () => {
      if (isLanClient) { window.print(); return Promise.resolve(true); }
      return ipc('invoices:print');
    },
  },
  reports: {
    summary: () => call(() => request('/api/reports/summary'), 'reports:summary'),
    detailed: (from: string, to: string) =>
      call(
        () => request(`/api/reports/detailed?from=${from}&to=${to}`),
        'reports:detailed', from, to,
      ),
    doctorRevenue: (from: string, to: string) =>
      call(
        () => request(`/api/reports/doctor-revenue?from=${from}&to=${to}`),
        'reports:doctor-revenue', from, to,
      ),
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
      ipc('tokens:upsert-prescription', tokenId, input),
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
    connect: () => {
      const activeSocket = ensureSocket();
      const { token } = getAuthContext();
      activeSocket.auth = token ? { token } : {};
      if (!activeSocket.connected) activeSocket.connect();
      return Promise.resolve();
    },
    disconnect: () => { socket?.disconnect(); },
    onDataChanged: (handler: (e: { entity: string; action: string }) => void) => {
      const activeSocket = ensureSocket();
      activeSocket.on('data:changed', handler);
      return () => activeSocket.off('data:changed', handler);
    },
    onNotification: (handler: (notification: unknown) => void) => {
      const activeSocket = ensureSocket();
      activeSocket.on('notification:new', handler);
      return () => activeSocket.off('notification:new', handler);
    },
    onChatMessage: (handler: (message: unknown) => void) => {
      const activeSocket = ensureSocket();
      activeSocket.on('chat:message', handler);
      return () => activeSocket.off('chat:message', handler);
    },
    sendChatMessage: (message: unknown) => {
      const activeSocket = ensureSocket();
      if (!activeSocket.connected) activeSocket.connect();
      activeSocket.emit('chat:message', message);
      return Promise.resolve(true);
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
    lanIp: () => ipc('settings:lan-ip'),
    discoveredServers: () => ipc('settings:discovered-servers'),
    testConnection: (url: string) => ipc('settings:test-connection', url),
    scan: () => ipc('settings:scan'),
    onServerFound: (handler: (server: unknown) => void) => {
      ipcRenderer.on('discovery:server-found', (_e, server) => handler(server));
      return () => ipcRenderer.removeAllListeners('discovery:server-found');
    },
  },
  print: {
    html: (html: string) => ipc('print:html', html),
  },
  license: {
    status: () => ipc('license:status'),
    activate: (key: string) => ipc('license:activate', key),
    modules: () => ipc<Record<string, boolean>>('license:modules'),
  },
  medicines: {
    search: (query: string) => ipc('medicines:search', query),
    list: () => ipc('medicines:list'),
    create: (name: string, price: number) => ipc('medicines:create', name, price),
    updatePrice: (id: string, price: number) => ipc('medicines:update-price', id, price),
  },
  search: {
    global: (query: string) =>
      call(
        () => request(`/api/search?q=${encodeURIComponent(query)}`),
        'search:global', query,
      ),
  },
 update: {
  check: () => ipc<'available' | 'latest' | 'error'>('app:check-for-updates'),
  install: () => ipc('app:install-update'),
  
  onProgress: (handler: (percent: number) => void) => {
    const listener = (_: unknown, percent: number) => handler(percent);
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
