export const MEDICINE_TYPES = ['Tab', 'Injection', 'Syrup', 'D/W', 'D/S', 'Capsule'] as const;
export type MedicineType = (typeof MEDICINE_TYPES)[number];

export const MEDICINE_TYPES_WITH_MG = ['Tab', 'Capsule', 'Injection'] as const;
export type MedicineTypeWithMg = (typeof MEDICINE_TYPES_WITH_MG)[number];

export const DEFAULT_MEDICINE_TYPE: MedicineType = 'Tab';

export function medicineTypeUsesMg(type: string): boolean {
  return (MEDICINE_TYPES_WITH_MG as readonly string[]).includes(type);
}
