/**
 * Digits-only E.164 without '+'. Keeps incomplete numbers so the phone input can type.
 * Pass `countryCallingCode` from the phone input country selector (e.g. "92", "971", "1").
 */
export function toPhoneDigits(
  raw: string | null | undefined,
  countryCallingCode?: string | null,
): string {
  let n = String(raw || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);

  const cc = String(countryCallingCode || '').replace(/\D/g, '');
  if (cc) {
    if (n.startsWith('0')) n = n.replace(/^0+/, '');
    if (!n.startsWith(cc)) n = `${cc}${n}`;
    if (n === cc) return '';
  }
  return n;
}

/**
 * WhatsApp Cloud API `to` value: digits-only E.164 (no +).
 * Rejects incomplete / invalid lengths. Pass `countryCallingCode` from the selector.
 */
export function toWhatsAppNumber(
  raw: string | null | undefined,
  countryCallingCode?: string | null,
): string | null {
  const n = toPhoneDigits(raw, countryCallingCode);
  if (!n) return null;
  if (!countryCallingCode && n.startsWith('0')) return null;
  if (n.length < 8 || n.length > 15) return null;
  return n;
}
