import { toWhatsAppNumber } from '@shared/whatsappPhone';

/** WhatsApp Web / app chat URL (opens like an external browser link). */
export function whatsAppWebUrl(phone: string, text?: string): string | null {
  const digits = toWhatsAppNumber(phone) || String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text.trim())}`;
}

/** Open the patient's WhatsApp chat in the system browser / WhatsApp app. */
export function openWhatsAppWeb(phone: string, text?: string): boolean {
  const url = whatsAppWebUrl(phone, text);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
