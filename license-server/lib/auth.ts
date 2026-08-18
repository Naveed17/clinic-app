import { HttpError } from './http';

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function licenseOrigin(): string {
  const fromEnv = String(process.env.LICENSE_API_ORIGIN || '').trim();
  if (fromEnv) return stripSlash(fromEnv);
  const vercel = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim();
  if (vercel) return stripSlash(vercel.startsWith('http') ? vercel : `https://${vercel}`);
  return 'https://clinic-license-six.vercel.app';
}

async function postJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function requireClinicModule(
  body: Record<string, unknown>,
  moduleKey: 'ai' | 'whatsapp',
): Promise<{ key: string; hwid: string }> {
  const key = String(body.key || '').trim();
  const hwid = String(body.hwid || '').trim();
  if (!key) throw new HttpError('License key required.', 401);
  if (!hwid) throw new HttpError('Device id required.', 401);

  const origin = licenseOrigin();
  const validated = await postJson(`${origin}/api/license/validate`, { key, hwid });
  if (validated.valid !== true) {
    throw new HttpError('Invalid or inactive license.', 401);
  }

  const modulesRes = await postJson(`${origin}/api/license/modules`, { key });
  const modules = (modulesRes.modules || {}) as Record<string, boolean>;
  if (modules[moduleKey] !== true) {
    throw new HttpError(
      `${moduleKey === 'ai' ? 'AI' : 'WhatsApp Cloud API'} add-on is not enabled for this license.`,
      403,
    );
  }

  return { key, hwid };
}
