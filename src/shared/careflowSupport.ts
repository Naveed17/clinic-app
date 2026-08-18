export const CAREFLOW_BRAND = 'CareFlow';

export type CareFlowSupportContact = {
  phone: string;
  email: string;
};

export function supportPhoneDigits(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export function supportTelHref(raw: string): string {
  const digits = supportPhoneDigits(raw);
  if (!digits) return '';
  return `tel:+${digits.replace(/^0+/, '')}`;
}

export function supportWhatsAppHref(raw: string): string {
  let digits = supportPhoneDigits(raw);
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}
