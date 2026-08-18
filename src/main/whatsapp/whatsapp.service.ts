import { readFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';
import { getSettings } from '../config/settings';
import { isLicenseModuleEnabled } from '../license/license.ipc';
import { licenseApi, LicenseApiError } from '../license/licenseApi';
import { toWhatsAppNumber } from '../../shared/whatsappPhone';

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
    enabled: licenseOk,
    token: '',
    phoneNumberId: '',
    displayNumber: toWhatsAppNumber(s.whatsappDisplayNumber) || s.whatsappDisplayNumber.trim(),
  };
}

export function isWhatsAppReady(config = getWhatsAppConfig()): boolean {
  return config.enabled;
}

function whatsappNotReadyError(): string {
  return 'WhatsApp Cloud API add-on is not enabled for this license.';
}

function friendlyWhatsAppError(message: string | undefined, fallback: string): string {
  const raw = (message || '').trim();
  if (
    /session has expired|access token expire|token expired|expire ho gaya|naya token paste|connect with meta dubara/i.test(
      raw,
    )
  ) {
    return 'WhatsApp access token has expired. Contact CareFlow support to refresh it.';
  }
  return raw || fallback;
}

function hostedError(err: unknown, fallback: string): string {
  if (err instanceof LicenseApiError) return friendlyWhatsAppError(err.message, fallback);
  if (err instanceof Error && err.message) return friendlyWhatsAppError(err.message, fallback);
  return fallback;
}

export async function getHostedWhatsAppStatus(): Promise<{
  configured: boolean;
  name?: string;
  phone?: string;
  error?: string;
}> {
  if (!isLicenseModuleEnabled('whatsapp')) {
    return { configured: false, error: 'WhatsApp Cloud API add-on is not enabled for this license.' };
  }
  try {
    const data = await licenseApi<{
      ok?: boolean;
      configured?: boolean;
      name?: string;
      phone?: string;
    }>('/whatsapp/status');
    return {
      configured: Boolean(data.configured),
      name: data.name,
      phone: data.phone,
    };
  } catch (err) {
    return { configured: false, error: hostedError(err, 'Cannot reach CareFlow WhatsApp.') };
  }
}

export async function testWhatsAppConnection(): Promise<{
  ok: boolean;
  name?: string;
  phone?: string;
  error?: string;
}> {
  const config = getWhatsAppConfig();
  if (!config.enabled) {
    return { ok: false, error: whatsappNotReadyError() };
  }
  const status = await getHostedWhatsAppStatus();
  if (!status.configured) {
    return { ok: false, error: status.error || 'CareFlow WhatsApp is not configured yet.' };
  }
  return { ok: true, name: status.name, phone: status.phone };
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
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

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
  const lines = ['Hello,', '', `*${clinic}*`];
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
  lines.push('Your document is attached to this message.');
  lines.push('Thank you.');
  return lines.join('\n').slice(0, 1024);
}

async function uploadHostedMedia(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ id?: string; error?: string }> {
  if (fileBuffer.length > MAX_MEDIA_BYTES) {
    return { error: 'File is too large to send through CareFlow WhatsApp (max 4 MB).' };
  }
  try {
    const data = await licenseApi<{ ok?: boolean; mediaId?: string }>('/whatsapp/upload', {
      base64: fileBuffer.toString('base64'),
      mime: mimeType,
      filename: fileName,
    });
    if (!data.mediaId) return { error: 'Upload failed.' };
    return { id: data.mediaId };
  } catch (err) {
    return { error: hostedError(err, 'Upload failed.') };
  }
}

async function sendHostedPayload(input: {
  to: string;
  text?: string;
  mediaId?: string;
  caption?: string;
  asImage?: boolean;
  filename?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await licenseApi('/whatsapp/send', input);
    return { success: true };
  } catch (err) {
    return { success: false, error: hostedError(err, 'Send failed.') };
  }
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
  const uploaded = await uploadHostedMedia(fileBuffer, mimeType, genericName);
  if (!uploaded.id) {
    return { success: false, error: uploaded.error || 'Upload failed.' };
  }

  return sendHostedPayload({
    to: cleaned,
    mediaId: uploaded.id,
    caption,
    asImage,
    filename: genericName,
  });
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
  return sendHostedPayload({ to: cleaned, text: text.slice(0, 4096) });
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
    const uploaded = await uploadHostedMedia(buffer, mime, input.imageName || 'campaign.jpg');
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
    const result = mediaId
      ? await sendHostedPayload({ to: phone, mediaId, caption, asImage: true, filename: input.imageName || 'campaign.jpg' })
      : await sendHostedPayload({ to: phone, text: text.slice(0, 4096) });
    if (result.success) sent += 1;
    else {
      failed += 1;
      if (errors.length < 8) errors.push(`${phone}: ${result.error}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return { sent, failed, skipped: 0, errors };
}

export function getMetaEmbeddedSignupPublicConfig(): {
  configured: boolean;
  appId: string;
  configId: string;
} {
  return { configured: false, appId: '', configId: '' };
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

export async function exchangeEmbeddedSignupCode(
  _input: EmbeddedExchangeInput,
): Promise<EmbeddedExchangeResult> {
  return {
    success: false,
    error: 'WhatsApp is hosted by CareFlow. Clinics do not connect their own Meta number.',
  };
}
