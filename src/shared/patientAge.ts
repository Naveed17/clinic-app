export type AgeUnit = 'years' | 'months' | 'days';

export interface FormattedAge {
  value: number;
  unit: AgeUnit;
  label: string;
}

export interface AgeDisplayParts {
  dateStr: string;
  ageText: string;
}

/** Formats singular vs plural unit string with context, e.g. "1 year old" vs "3 months old". */
export function formatAgeWithUnit(age: number, rawUnit: string, includeOld = true): string {
  const cleanUnit = rawUnit.toLowerCase().replace(/s$/, '');
  const displayUnit = age === 1 ? cleanUnit : `${cleanUnit}s`;
  const base = `${age} ${displayUnit}`;
  return includeOld ? `${base} old` : base;
}

/**
  Generate future date format YYYY-MM-DD X units old.
 */
export function generateFutureDateFormat(age: number | string, unit: string): string {
  const n = typeof age === 'string' ? parseFloat(age) : age;
  if (n == null || !Number.isFinite(n) || n < 0) return '';
  const d = new Date();
  const cleanUnit = unit.toLowerCase().replace(/s$/, '');

  if (cleanUnit === 'day') {
    d.setDate(d.getDate() + Math.floor(n));
  } else if (cleanUnit === 'month') {
    d.setMonth(d.getMonth() + Math.floor(n));
  } else {
    d.setFullYear(d.getFullYear() + Math.floor(n));
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}-${mm}-${dd}`;

  const ageText = formatAgeWithUnit(n, unit);
  return `${formattedDate} ${ageText}`;
}

/** Convert age + unit to precise date of birth. */
export function ageToDateOfBirth(
  age: number | string | null | undefined,
  unit: AgeUnit = 'years',
): Date | null {
  const n = typeof age === 'string' ? parseFloat(age) : age;
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  const d = new Date();
  const cleanUnit = unit.toLowerCase().replace(/s$/, '');

  if (cleanUnit === 'day') {
    d.setDate(d.getDate() - Math.floor(n));
  } else if (cleanUnit === 'month') {
    d.setMonth(d.getMonth() - Math.floor(n));
  } else {
    d.setFullYear(d.getFullYear() - Math.floor(n));
  }
  return d;
}

/** Calculate age value, unit, and label from DOB. */
export function dateOfBirthToAgeParts(dob: Date | string | null | undefined): FormattedAge | null {
  if (!dob) return null;
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  const diffTime = today.getTime() - d.getTime();
  if (diffTime < 0) return { value: 0, unit: 'years', label: '0 years old' };

  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Under 30 days old -> Days
  if (diffDays < 30) {
    const days = Math.max(diffDays, 1);
    return { value: days, unit: 'days', label: formatAgeWithUnit(days, 'day') };
  }

  // Under 24 months old -> Months
  let months = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
  if (today.getDate() < d.getDate()) months -= 1;

  if (months < 24) {
    const m = Math.max(months, 1);
    return { value: m, unit: 'months', label: formatAgeWithUnit(m, 'month') };
  }

  // 2+ years old -> Years
  let years = today.getFullYear() - d.getFullYear();
  const mDiff = today.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < d.getDate())) years -= 1;
  const y = Math.max(years, 0);
  return { value: y, unit: 'years', label: formatAgeWithUnit(y, 'year') };
}

export function dateOfBirthToAge(dob: Date | string | null | undefined): number | null {
  const parts = dateOfBirthToAgeParts(dob);
  return parts ? parts.value : null;
}

export function getAgeDisplayParts(
  dob: Date | string | null | undefined,
  fallbackAge?: number | string | null,
): AgeDisplayParts | null {
  if (dob) {
    const d = typeof dob === 'string' ? new Date(dob) : dob;
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;

      const parts = dateOfBirthToAgeParts(dob);
      if (parts) {
        return { dateStr: formattedDate, ageText: parts.label };
      }
    }
  }
  if (fallbackAge != null && fallbackAge !== '') {
    const n = typeof fallbackAge === 'string' ? parseFloat(fallbackAge) : fallbackAge;
    if (Number.isFinite(n)) {
      return { dateStr: '', ageText: formatAgeWithUnit(n, 'year') };
    }
  }
  return null;
}

export function calcAgeLabel(
  dob: Date | string | null | undefined,
  fallbackAge?: number | string | null,
): string {
  const parts = getAgeDisplayParts(dob, fallbackAge);
  if (!parts) return '—';
  return parts.dateStr ? `${parts.dateStr} ${parts.ageText}` : parts.ageText;
}
