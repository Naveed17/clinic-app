export const money = (n: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(Number(n) || 0)}`;

export const UNITS = ['Tablet', 'Capsule', 'Syrup (ml)', 'Injection', 'Sachet', 'Strip', 'Bottle', 'Box', 'Piece', 'Other'];

export const MOVEMENT_TYPES = [
  { value: 'PURCHASE', label: 'Purchase (+)' },
  { value: 'RETURN', label: 'Return (+)' },
  { value: 'ADJUSTMENT', label: 'Adjustment (+/-)' },
  { value: 'EXPIRED', label: 'Expired (−)' },
  { value: 'DAMAGE', label: 'Damage (−)' },
  { value: 'DISPENSE', label: 'Dispense (−)' },
] as const;

export const INVENTORY_QUERY_KEYS = [
  'inventory-medicines',
  'inventory-low-stock',
  'inventory-batches',
  'inventory-expiring',
  'inventory-suppliers',
  'inventory-purchases',
  'inventory-movements',
  'inventory-categories',
  'medicines',
] as const;

export function medicineStock(med: InventoryMedicine): number {
  return (med.batches ?? []).reduce((sum, b) => sum + Number(b.quantity ?? 0), 0);
}

export function medicinePrice(med: InventoryMedicine): number {
  const batches = med.batches ?? [];
  const priced = batches.find((b) => Number(b.salePrice) > 0) ?? batches[0];
  return Number(priced?.salePrice ?? 0);
}

export function daysUntil(date: string | Date): number {
  const t = new Date(date).getTime();
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}
