/**
 * WhatsApp Cloud API `to` value: digits-only E.164 (no +).
 * Pass `countryCallingCode` from the phone input country selector (e.g. "92", "971", "1").
 */
export function toWhatsAppNumber(
  raw: string | null | undefined,
  countryCallingCode?: string | null,
): string | null {
  let n = String(raw || '').replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('00')) n = n.slice(2);

  const cc = String(countryCallingCode || '').replace(/\D/g, '');
  if (cc) {
    if (n.startsWith('0')) n = n.replace(/^0+/, '');
    if (!n.startsWith(cc)) n = `${cc}${n}`;
  } else if (n.startsWith('0')) {
    return null;
  }

  if (n.length < 8 || n.length > 15) return null;
  return n;
}
