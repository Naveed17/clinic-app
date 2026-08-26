/** Convert age (years) to approximate date of birth (Jan 1 of birth year). */
export function ageToDateOfBirth(age: number | string | null | undefined): Date | null {
  const n = typeof age === 'string' ? parseInt(age, 10) : age;
  if (n == null || !Number.isFinite(n) || n < 0 || n > 150) return null;
  const year = new Date().getFullYear() - Math.floor(n);
  return new Date(`${year}-01-01T00:00:00.000Z`);
}

export function dateOfBirthToAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function calcAgeLabel(dob: Date | string | null | undefined): string {
  const age = dateOfBirthToAge(dob);
  return age != null ? String(age) : '';
}
