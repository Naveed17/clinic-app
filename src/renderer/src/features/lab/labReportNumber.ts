/** Accession / report no. derived from the lab order id (unique per order). */
export function labReportNumber(orderId: string): string {
  return `LAB${orderId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}
