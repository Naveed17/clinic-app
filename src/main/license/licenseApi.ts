import { getLicenseApiBase, getLicenseAuth } from './license.ipc';

export class LicenseApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LicenseApiError';
    this.status = status;
  }
}

export async function licenseApi<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const auth = getLicenseAuth();
  if (!auth) {
    throw new LicenseApiError('Activate your license to use this feature.', 401);
  }

  const url = `${getLicenseApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, key: auth.key, hwid: auth.hwid }),
    });
  } catch {
    throw new LicenseApiError(
      'Cannot reach CareFlow license server. Check internet connection.',
    );
  }

  const json = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    console.warn(`[License API] ${res.status} ${url}`);
    throw new LicenseApiError(licenseApiErrorMessage(json, res.status, path), res.status);
  }
  return json;
}

function licenseApiErrorMessage(
  json: { error?: string; message?: string },
  status: number,
  path: string,
): string {
  if (status === 404) {
    if (path.startsWith('/ai')) {
      return 'CareFlow AI is not on the license server yet. Deploy the latest license-server, then connect Groq in admin Settings → AI.';
    }
    if (path.startsWith('/whatsapp')) {
      return 'CareFlow WhatsApp is not on the license server yet. Deploy the latest license-server, then connect Meta in admin Settings → WhatsApp.';
    }
    return 'License server route not found. Deploy the latest license-server.';
  }
  const raw = String(json.error || json.message || '').trim();
  if (raw && !/^not found$/i.test(raw)) return raw;
  return `License server error (${status}).`;
}
