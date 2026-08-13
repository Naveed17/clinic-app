/** Digits-only WhatsApp Cloud API `to` value (no +). Pakistan local numbers → 92… */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  let n = String(raw || '').replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0') && n.length === 11) n = `92${n.slice(1)}`;
  if (n.length === 10 && n.startsWith('3')) n = `92${n}`;
  if (n.length < 11 || n.length > 15) return null;
  return n;
}
