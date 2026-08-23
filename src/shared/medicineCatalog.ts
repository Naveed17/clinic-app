export function normalizeMedicineMg(mg?: number | string | null): number | null {
  if (mg == null || mg === '') return null;
  const n = typeof mg === 'string' ? parseInt(mg, 10) : mg;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function formatMedicineDisplayName(name: string, mg?: number | null): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const strength = normalizeMedicineMg(mg);
  return strength != null ? `${trimmed} ${strength}mg` : trimmed;
}

export function medicinesMatchCatalog(
  a: { name: string; mg?: number | null },
  b: { name: string; mg?: number | null },
): boolean {
  return (
    a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
    normalizeMedicineMg(a.mg) === normalizeMedicineMg(b.mg)
  );
}

export function findCatalogDuplicate<T extends { id: string; name: string; mg?: number | null }>(
  medicines: T[],
  name: string,
  mg: number | null | undefined,
  excludeId?: string,
): T | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return medicines.find(
    (m) => m.id !== excludeId && medicinesMatchCatalog(m, { name: trimmed, mg }),
  ) ?? null;
}
