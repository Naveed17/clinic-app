export const CAREFLOW_BRAND = 'CareFlow';

export type CareFlowSupportContact = {
  phone: string;
  email: string;
};

export function supportPhoneDigits(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

/** Display / clipboard value — desktop has no phone dialer, so we copy instead of tel:. */
export function supportPhoneDisplay(raw: string): string {
  return String(raw || '').trim();
}

export function supportMailtoHref(raw: string): string {
  const email = String(raw || '').trim();
  if (!email) return '';
  return `mailto:${email}`;
}

export function supportWhatsAppHref(raw: string): string {
  let digits = supportPhoneDigits(raw);
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}
