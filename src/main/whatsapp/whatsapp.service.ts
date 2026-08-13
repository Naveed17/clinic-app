import { readFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';
import { getSettings } from '../config/settings';
import { isLicenseModuleEnabled } from '../license/license.ipc';
import { toWhatsAppNumber } from '../../shared/whatsappPhone';

const GRAPH = 'https://graph.facebook.com/v21.0';

export type WhatsAppConfig = {
  enabled: boolean;
  token: string;
  phoneNumberId: string;
  displayNumber: string;
};

export function getWhatsAppConfig(): WhatsAppConfig {
  const s = getSettings();
  const licenseOk = isLicenseModuleEnabled('whatsapp');
  return {
    enabled: licenseOk && Boolean(s.whatsappEnabled),
    token: (s.whatsappToken || process.env.WHATSAPP_TOKEN || '').trim(),
    phoneNumberId: (s.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    displayNumber: toWhatsAppNumber(s.whatsappDisplayNumber) || s.whatsappDisplayNumber.trim(),
  };
}

export function isWhatsAppReady(config = getWhatsAppConfig()): boolean {
  return config.enabled && Boolean(config.token && config.phoneNumberId);
}

function whatsappNotReadyError(): string {
  return isLicenseModuleEnabled('whatsapp')
    ? 'WhatsApp API not configured. Open Settings → WhatsApp.'
    : 'WhatsApp is not enabled for this license.';
}

export async function testWhatsAppConnection(): Promise<{
  ok: boolean;
  name?: string;
  phone?: string;
  error?: string;
}> {
  const config = getWhatsAppConfig();
  if (!config.enabled) {
    return {
      ok: false,
      error: isLicenseModuleEnabled('whatsapp')
        ? 'WhatsApp is disabled in Settings.'
        : 'WhatsApp is not enabled for this license.',
    };
  }
  if (!config.token || !config.phoneNumberId) {
    return { ok: false, error: 'Access token and Phone Number ID are required.' };
  }
  try {
    const url = `${GRAPH}/${config.phoneNumberId}?fields=display_phone_number,verified_name`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${config.token}` } });
    const json = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: friendlyWhatsAppError(json.error?.message, res.status) };
    }
    return {
      ok: true,
      name: json.verified_name,
      phone: json.display_phone_number,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed.' };
  }
}

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export type WhatsAppDocumentContext = {
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  patientName?: string | null;
  mrNumber?: string | null;
  doctorName?: string | null;
  visitDate?: string | null;
  tokenNumber?: number | string | null;
};

export function buildDocumentCaption(ctx: WhatsAppDocumentContext): string {
  const clinic = (ctx.clinicName || 'Clinic').trim();
  const lines = ['Assalam o Alaikum,', '', `*${clinic}*`];
  if (ctx.clinicAddress?.trim()) lines.push(ctx.clinicAddress.trim());
  if (ctx.clinicPhone?.trim()) lines.push(`Tel: ${ctx.clinicPhone.trim()}`);
  lines.push('', '*Patient Document*');
  if (ctx.patientName?.trim()) lines.push(`Patient: ${ctx.patientName.trim()}`);
  if (ctx.mrNumber?.trim()) lines.push(`MR #: ${ctx.mrNumber.trim()}`);
  if (ctx.doctorName?.trim()) lines.push(`Doctor: ${ctx.doctorName.trim()}`);
  if (ctx.visitDate?.trim()) lines.push(`Visit: ${ctx.visitDate.trim()}`);
  if (ctx.tokenNumber != null && String(ctx.tokenNumber).trim()) {
    lines.push(`Token #: ${String(ctx.tokenNumber).trim()}`);
  }
  lines.push('');
  lines.push('Aap ka document is message ke sath attach hai.');
  lines.push('Shukriya.');
  return lines.join('\n').slice(0, 1024);
}

export async function sendWhatsAppDocument(input: {
  filePath: string;
  fileName: string;
  phone?: string | null;
  context?: WhatsAppDocumentContext;
}): Promise<{ success: boolean; error?: string }> {
  const config = getWhatsAppConfig();
  if (!isWhatsAppReady(config)) {
    return { success: false, error: whatsappNotReadyError() };
  }
  if (!existsSync(input.filePath)) {
    return { success: false, error: 'File not found.' };
  }
  const cleaned = toWhatsAppNumber(input.phone);
  if (!cleaned) {
    return { success: false, error: 'No valid WhatsApp phone number.' };
  }

  const settings = getSettings();
  const caption = buildDocumentCaption({
    clinicName: input.context?.clinicName || settings.clinicName,
    clinicAddress: input.context?.clinicAddress || settings.clinicAddress,
    clinicPhone: input.context?.clinicPhone || settings.clinicPhone,
    patientName: input.context?.patientName,
    mrNumber: input.context?.mrNumber,
    doctorName: input.context?.doctorName,
    visitDate: input.context?.visitDate,
    tokenNumber: input.context?.tokenNumber,
  });

  const ext = extname(input.filePath).toLowerCase() || extname(input.fileName).toLowerCase();
  const mimeType = MIME[ext] ?? 'application/octet-stream';
  const asImage = IMAGE_EXT.has(ext);
  const fileBuffer = readFileSync(input.filePath);
  const genericName = asImage ? `document${ext || '.png'}` : `Document${ext || '.pdf'}`;
  const uploaded = await uploadWhatsAppMedia(config, fileBuffer, mimeType, genericName);
  if (!uploaded.id) {
    return { success: false, error: uploaded.error || 'Upload failed.' };
  }

  const payload = asImage
    ? { type: 'image', image: { id: uploaded.id, caption } }
    : {
        type: 'document',
        document: {
          id: uploaded.id,
          filename: genericName,
          caption,
        },
      };
  return sendWhatsAppPayload(config, cleaned, payload);
}

function friendlyWhatsAppError(message: string | undefined, status?: number): string {
  const raw = (message || '').trim();
  if (/session has expired|expired/i.test(raw)) {
    return 'Access token expire ho gaya. Connect with Meta dubara chalao, ya Meta se naya token paste karke Save Settings karo.';
  }
  if (/invalid.*token|error validating access token/i.test(raw)) {
    return 'Access token invalid hai. Connect with Meta dubara chalao, ya naya token paste karo.';
  }
  return raw || (status ? `WhatsApp API error (${status}).` : 'WhatsApp API error.');
}

function apiError(err: { message?: string } | string | undefined, fallback: string): string {
  if (typeof err === 'object' && err?.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

async function uploadWhatsAppMedia(
  config: WhatsAppConfig,
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ id?: string; error?: string }> {
  const kind = mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('audio/')
      ? 'audio'
      : mimeType.startsWith('video/')
        ? 'video'
        : 'document';
  const safeName = fileName.replace(/[^\w.\-()+ ]+/g, '_') || `file.${kind}`;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType.startsWith('image/') ? mimeType : kind);
  form.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), safeName);
  const uploadRes = await fetch(`${GRAPH}/${config.phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}` },
    body: form,
  });
  const uploadJson = (await uploadRes.json()) as { id?: string; error?: { message?: string } | string };
  if (!uploadRes.ok || !uploadJson.id) {
    return { error: apiError(uploadJson.error, 'Media upload failed.') };
  }
  return { id: uploadJson.id };
}

async function sendWhatsAppPayload(
  config: WhatsAppConfig,
  to: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const sendRes = await fetch(`${GRAPH}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      ...payload,
    }),
  });
  const sendJson = (await sendRes.json()) as { error?: { message?: string } | string };
  if (!sendRes.ok) {
    return { success: false, error: apiError(sendJson.error, 'Send failed.') };
  }
  return { success: true };
}

export async function sendWhatsAppText(input: {
  phone?: string | null;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  const config = getWhatsAppConfig();
  if (!isWhatsAppReady(config)) {
    return { success: false, error: whatsappNotReadyError() };
  }
  const cleaned = toWhatsAppNumber(input.phone);
  if (!cleaned) {
    return { success: false, error: 'No valid WhatsApp phone number.' };
  }
  const text = String(input.text || '').trim();
  if (!text) {
    return { success: false, error: 'Message text is required.' };
  }
  return sendWhatsAppPayload(config, cleaned, {
    type: 'text',
    text: { body: text.slice(0, 4096) },
  });
}

export type WhatsAppCampaignInput = {
  text: string;
  phones: string[];
  imageBase64?: string;
  imageMime?: string;
  imageName?: string;
};

export async function sendWhatsAppCampaign(input: WhatsAppCampaignInput): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const config = getWhatsAppConfig();
  if (!isWhatsAppReady(config)) {
    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [whatsappNotReadyError()],
    };
  }

  const text = String(input.text || '').trim();
  if (!text) {
    return { sent: 0, failed: 0, skipped: 0, errors: ['Campaign text is required.'] };
  }

  const phones = [...new Set(
    (input.phones ?? []).map((p) => toWhatsAppNumber(p)).filter((p): p is string => Boolean(p)),
  )];
  if (phones.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, errors: ['No WhatsApp patient numbers to send.'] };
  }

  let mediaId: string | undefined;
  if (input.imageBase64) {
    const buffer = Buffer.from(input.imageBase64, 'base64');
    const mime = input.imageMime || 'image/jpeg';
    const uploaded = await uploadWhatsAppMedia(
      config,
      buffer,
      mime,
      input.imageName || 'campaign.jpg',
    );
    if (!uploaded.id) {
      return { sent: 0, failed: phones.length, skipped: 0, errors: [uploaded.error || 'Image upload failed.'] };
    }
    mediaId = uploaded.id;
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const caption = text.slice(0, 1024);

  for (const phone of phones) {
    const payload = mediaId
      ? { type: 'image', image: { id: mediaId, caption } }
      : { type: 'text', text: { body: text.slice(0, 4096) } };
    const result = await sendWhatsAppPayload(config, phone, payload);
    if (result.success) sent += 1;
    else {
      failed += 1;
      if (errors.length < 8) errors.push(`${phone}: ${result.error}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return { sent, failed, skipped: 0, errors };
}

function getMetaAppCredentials(): { appId: string; appSecret: string; configId: string } {
  return {
    appId: String(process.env.META_APP_ID || '').trim(),
    appSecret: String(process.env.META_APP_SECRET || '').trim(),
    configId: String(process.env.META_EMBEDDED_CONFIG_ID || '').trim(),
  };
}

export function getMetaEmbeddedSignupPublicConfig(): {
  configured: boolean;
  appId: string;
  configId: string;
} {
  const { appId, appSecret, configId } = getMetaAppCredentials();
  return {
    configured: Boolean(appId && appSecret && configId),
    appId,
    configId,
  };
}

export type EmbeddedExchangeInput = {
  code: string;
  phoneNumberId?: string | null;
  wabaId?: string | null;
};

export type EmbeddedExchangeResult = {
  success: boolean;
  token?: string;
  phoneNumberId?: string;
  displayNumber?: string;
  wabaId?: string;
  error?: string;
};

async function registerWhatsAppPhone(
  token: string,
  phoneNumberId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin: '000000' }),
    });
    const json = (await res.json()) as { success?: boolean; error?: { message?: string } | string };
    if (!res.ok) {
      // Already registered is fine for reconnect flows.
      const msg = apiError(json.error, '');
      if (/already|registered/i.test(msg)) return { ok: true };
      return { ok: false, error: msg || `Register failed (${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Register failed.' };
  }
}

async function fetchPhoneDisplayNumber(
  token: string,
  phoneNumberId: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = (await res.json()) as { display_phone_number?: string };
    if (!res.ok || !json.display_phone_number) return null;
    return toWhatsAppNumber(json.display_phone_number);
  } catch {
    return null;
  }
}

async function resolvePhoneNumberIdFromWaba(
  token: string,
  wabaId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      data?: Array<{ id?: string; display_phone_number?: string }>;
    };
    const first = json.data?.[0];
    return first?.id || null;
  } catch {
    return null;
  }
}

/** Exchange Embedded Signup code for a business token and resolve phone details. */
export async function exchangeEmbeddedSignupCode(
  input: EmbeddedExchangeInput,
): Promise<EmbeddedExchangeResult> {
  const { appId, appSecret, configId } = getMetaAppCredentials();
  if (!appId || !appSecret || !configId) {
    return {
      success: false,
      error: 'Meta Embedded Signup is not configured. Set META_APP_ID, META_APP_SECRET, META_EMBEDDED_CONFIG_ID in .env.',
    };
  }

  const code = String(input.code || '').trim();
  if (!code) {
    return { success: false, error: 'Missing authorization code from Meta login.' };
  }

  try {
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: { message?: string } | string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      return {
        success: false,
        error: apiError(tokenJson.error, 'Failed to exchange Meta code for access token.'),
      };
    }

    const token = tokenJson.access_token;
    let phoneNumberId = String(input.phoneNumberId || '').trim();
    const wabaId = String(input.wabaId || '').trim() || undefined;

    if (!phoneNumberId && wabaId) {
      phoneNumberId = (await resolvePhoneNumberIdFromWaba(token, wabaId)) || '';
    }
    if (!phoneNumberId) {
      return {
        success: false,
        error: 'Meta login succeeded but Phone Number ID was not returned. Complete the Embedded Signup phone step.',
      };
    }

    await registerWhatsAppPhone(token, phoneNumberId);
    const displayNumber = await fetchPhoneDisplayNumber(token, phoneNumberId);

    return {
      success: true,
      token,
      phoneNumberId,
      displayNumber: displayNumber || undefined,
      wabaId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Embedded Signup exchange failed.',
    };
  }
}

