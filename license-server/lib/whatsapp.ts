import { HttpError } from './http';

const GRAPH = 'https://graph.facebook.com/v21.0';

export function whatsappConfig(): { token: string; phoneNumberId: string } {
  const token = String(process.env.WHATSAPP_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  if (!token || !phoneNumberId) {
    throw new HttpError('CareFlow WhatsApp is not configured on the license server.', 503);
  }
  return { token, phoneNumberId };
}

function apiError(err: { message?: string } | string | undefined, fallback: string): string {
  const raw =
    typeof err === 'object' && err?.message
      ? err.message
      : typeof err === 'string'
        ? err
        : '';
  if (/session has expired|access token expire|token expired|expire ho gaya/i.test(raw)) {
    return 'WhatsApp access token has expired. Update WHATSAPP_TOKEN on the license server and redeploy.';
  }
  return raw.trim() || fallback;
}

export async function whatsappStatus(): Promise<{
  configured: boolean;
  name?: string;
  phone?: string;
}> {
  const token = String(process.env.WHATSAPP_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  if (!token || !phoneNumberId) {
    return { configured: false };
  }
  const res = await fetch(
    `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = (await res.json()) as {
    display_phone_number?: string;
    verified_name?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new HttpError(apiError(json.error, `WhatsApp status failed (${res.status}).`), 502);
  }
  return {
    configured: true,
    name: json.verified_name,
    phone: json.display_phone_number,
  };
}

export async function uploadWhatsAppMedia(input: {
  base64: string;
  mime: string;
  filename: string;
}): Promise<string> {
  const { token, phoneNumberId } = whatsappConfig();
  const mime = String(input.mime || 'application/octet-stream');
  const filename = String(input.filename || 'document.bin').replace(/[^\w.\-()+ ]+/g, '_') || 'document.bin';
  const buffer = Buffer.from(String(input.base64 || ''), 'base64');
  if (!buffer.length) throw new HttpError('Empty file.');
  if (buffer.length > 4 * 1024 * 1024) {
    throw new HttpError('File is too large to send through CareFlow WhatsApp (max 4 MB).');
  }

  const kind = mime.startsWith('image/')
    ? 'image'
    : mime.startsWith('audio/')
      ? 'audio'
      : mime.startsWith('video/')
        ? 'video'
        : 'document';

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mime.startsWith('image/') ? mime : kind);
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), filename);

  const res = await fetch(`${GRAPH}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } | string };
  if (!res.ok || !json.id) {
    throw new HttpError(apiError(json.error, 'Media upload failed.'), 502);
  }
  return json.id;
}

export async function sendWhatsAppMessage(input: {
  to: string;
  text?: string;
  mediaId?: string;
  caption?: string;
  asImage?: boolean;
  filename?: string;
}): Promise<void> {
  const { token, phoneNumberId } = whatsappConfig();
  const to = String(input.to || '').replace(/\D/g, '');
  if (!to) throw new HttpError('No valid WhatsApp phone number.');

  let payload: Record<string, unknown>;
  if (input.mediaId) {
    const caption = String(input.caption || '').slice(0, 1024);
    payload = input.asImage
      ? { type: 'image', image: { id: input.mediaId, caption } }
      : {
          type: 'document',
          document: {
            id: input.mediaId,
            filename: input.filename || 'Document.pdf',
            caption,
          },
        };
  } else {
    const text = String(input.text || '').trim().slice(0, 4096);
    if (!text) throw new HttpError('Message text is required.');
    payload = { type: 'text', text: { body: text } };
  }

  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      ...payload,
    }),
  });
  const json = (await res.json()) as { error?: { message?: string } | string };
  if (!res.ok) {
    throw new HttpError(apiError(json.error, 'Send failed.'), 502);
  }
}
