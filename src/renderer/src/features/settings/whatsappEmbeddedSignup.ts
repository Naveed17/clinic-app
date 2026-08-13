import { toWhatsAppNumber } from '@shared/whatsappPhone';

type FbAuthResponse = {
  code?: string;
  accessToken?: string;
};

type FbLoginResponse = {
  status?: string;
  authResponse?: FbAuthResponse | null;
};

type FbSdk = {
  init: (opts: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
  login: (
    callback: (response: FbLoginResponse) => void,
    options: Record<string, unknown>,
  ) => void;
};

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

export type EmbeddedSessionData = {
  phoneNumberId?: string;
  wabaId?: string;
  businessId?: string;
};

export type EmbeddedSignupClinic = {
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  email?: string | null;
  website?: string | null;
};

export type EmbeddedSignupLaunchResult =
  | { ok: true; code: string; session: EmbeddedSessionData }
  | { ok: false; error: string; canceled?: boolean };

function toHttpsUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/**
 * Prefill a NEW business portfolio. Meta only creates one when name + email + website
 * + address.country are all set and `id` is omitted (not an existing WABA id).
 * https://developers.facebook.com/docs/whatsapp/embedded-signup/pre-filled-data/
 */
export function buildEmbeddedSignupSetup(clinic: EmbeddedSignupClinic): Record<string, unknown> {
  const name = (clinic.clinicName || 'Clinic').trim() || 'Clinic';
  const email = (clinic.email || '').trim();
  const website = toHttpsUrl(clinic.website || '');
  const address = (clinic.clinicAddress || '').trim();
  const rawPhone = toWhatsAppNumber(clinic.clinicPhone) || String(clinic.clinicPhone || '').replace(/\D/g, '');
  const isPk = rawPhone.startsWith('92') && rawPhone.length >= 12;
  const isUs = rawPhone.startsWith('1') && rawPhone.length === 11 && !rawPhone.startsWith('1555');

  const business: Record<string, unknown> = {
    name,
    timezone: 'Asia/Karachi',
    address: {
      streetAddress1: address || name,
      country: isUs ? 'US' : 'PK',
    },
  };
  if (email) business.email = email;
  if (website) business.website = website;
  if (isPk) {
    business.phone = { code: 92, number: rawPhone.slice(2) };
  } else if (isUs) {
    business.phone = { code: 1, number: rawPhone.slice(1) };
  }

  const alreadyMentionsClinic = /clinic|hospital|medical|health/i.test(name);

  return {
    business,
    phone: {
      displayName: name.slice(0, 512),
      category: 'HEALTH',
      description: (alreadyMentionsClinic
        ? `${name} — appointments, reports and patient updates on WhatsApp.`
        : `${name} clinic — appointments, reports and patient updates on WhatsApp.`
      ).slice(0, 512),
    },
  };
}

const SDK_LOAD_MS = 15_000;
const LOGIN_WAIT_MS = 180_000;

let sdkLoading: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function loadFacebookSdk(appId: string): Promise<void> {
  if (window.FB) return Promise.resolve();
  if (sdkLoading) return sdkLoading;

  sdkLoading = withTimeout(
    new Promise<void>((resolve, reject) => {
      const finish = (): void => {
        try {
          window.FB?.init({
            appId,
            cookie: true,
            xfbml: false,
            version: 'v21.0',
          });
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error('FB.init failed.'));
        }
      };

      window.fbAsyncInit = finish;

      if (window.FB) {
        finish();
        return;
      }

      if (document.getElementById('facebook-jssdk')) {
        return;
      }

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.onerror = () => {
        sdkLoading = null;
        reject(new Error('Failed to load Facebook SDK. Check network / domain allowlist.'));
      };
      document.body.appendChild(script);
    }),
    SDK_LOAD_MS,
    'Facebook SDK timed out. Allow localhost in Meta App → Facebook Login → Allowed domains, then try again.',
  ).catch((err) => {
    sdkLoading = null;
    throw err;
  });

  return sdkLoading;
}

function parseSessionPayload(raw: unknown): EmbeddedSessionData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const phoneNumberId = String(
    data.phone_number_id || data.phoneNumberId || '',
  ).trim();
  const wabaId = String(data.waba_id || data.wabaId || '').trim();
  const businessId = String(
    data.business_id || data.businessId || '',
  ).trim();
  if (!phoneNumberId && !wabaId) return null;
  return {
    phoneNumberId: phoneNumberId || undefined,
    wabaId: wabaId || undefined,
    businessId: businessId || undefined,
  };
}

/**
 * Launch Meta WhatsApp Embedded Signup via FB.login popup.
 * Captures WA_EMBEDDED_SIGNUP session info + exchangeable code.
 */
export async function launchWhatsAppEmbeddedSignup(input: {
  appId: string;
  configId: string;
  clinic?: EmbeddedSignupClinic;
}): Promise<EmbeddedSignupLaunchResult> {
  const appId = input.appId.trim();
  const configId = input.configId.trim();
  if (!appId || !configId) {
    return {
      ok: false,
      error: 'META_APP_ID and META_EMBEDDED_CONFIG_ID are required in .env.',
    };
  }

  try {
    await loadFacebookSdk(appId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Facebook SDK failed to load.',
    };
  }

  if (!window.FB) {
    return { ok: false, error: 'Facebook SDK not available.' };
  }

  let session: EmbeddedSessionData = {};
  let flowError: string | null = null;

  const onMessage = (event: MessageEvent) => {
    if (typeof event.origin !== 'string' || !event.origin.endsWith('facebook.com')) return;
    try {
      const payload =
        typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!payload || payload.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (payload.event === 'FINISH' || payload.event === 'FINISH_ONLY_WABA') {
        const parsed = parseSessionPayload(payload.data);
        if (parsed) session = { ...session, ...parsed };
        return;
      }
      if (payload.event === 'ERROR' || payload.event === 'CANCEL') {
        const data = (payload.data || {}) as Record<string, unknown>;
        const msg = String(data.error_message || data.message || '').trim();
        const code = String(data.error_code || data.errorCode || '').trim();
        if (msg || code) {
          flowError = [code && `#${code}`, msg].filter(Boolean).join(' ');
        }
      }
    } catch {
      /* ignore non-JSON */
    }
  };

  window.addEventListener('message', onMessage);

  try {
    const loginResult = await withTimeout(
      new Promise<FbLoginResponse>((resolve) => {
        window.FB!.login((response) => resolve(response || {}), {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: buildEmbeddedSignupSetup(input.clinic || {}),
            sessionInfoVersion: '3',
          },
        });
      }),
      LOGIN_WAIT_MS,
      'Meta login timed out or the popup was blocked. Close the Facebook window and try again.',
    );

    if (flowError) {
      return {
        ok: false,
        error: /valid Business ID|1690130/i.test(flowError)
          ? 'Meta ne galat Business ID use ki. Popup mein CREATE a new business portfolio choose karo — existing WhatsApp/CareFlow account ko business mat banao. Phir asli number + OTP + card isi popup mein add karo.'
          : flowError,
      };
    }

    if (loginResult.status !== 'connected' || !loginResult.authResponse?.code) {
      return {
        ok: false,
        canceled: true,
        error: 'Meta login was canceled or did not return an authorization code.',
      };
    }

    if (!session.phoneNumberId && !session.wabaId) {
      await new Promise((r) => setTimeout(r, 400));
    }

    return {
      ok: true,
      code: loginResult.authResponse.code,
      session,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Meta login failed.',
    };
  } finally {
    window.removeEventListener('message', onMessage);
  }
}

/** Normalize any phone UI value to digits-only WhatsApp format (92300…). */
export function phoneInputToWhatsApp(value: string | null | undefined): string {
  return toWhatsAppNumber(value) || String(value || '').replace(/\D/g, '');
}
