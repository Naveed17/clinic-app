/** Doctor consultation fee helpers — gross, follow-up discount, refund, net. */

export function roundMoney(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function mapTokenFee(value: unknown): number {
  const n = roundMoney(value);
  return n < 0 ? 0 : n;
}

export function clampFeeDiscount(discount: unknown, consultationFee: number): number {
  return Math.min(mapTokenFee(discount), mapTokenFee(consultationFee));
}

/** Amount charged at the counter after discount. */
export function tokenChargedFee(consultationFee: unknown, feeDiscount: unknown): number {
  return Math.max(0, mapTokenFee(consultationFee) - mapTokenFee(feeDiscount));
}

/** Amount still held after discount and refunds. */
export function tokenNetFee(
  consultationFee: unknown,
  feeDiscount: unknown,
  feeRefunded: unknown,
): number {
  return Math.max(0, tokenChargedFee(consultationFee, feeDiscount) - mapTokenFee(feeRefunded));
}

/** Inclusive start of the rolling 7-day window for a visit date (YYYY-MM-DD). */
export function weekVisitFromDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y || 1970, (m || 1) - 1, (d || 1) - 6);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}
