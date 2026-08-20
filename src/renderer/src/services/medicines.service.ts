import type { Medicine } from '@/types/medicine';

export const medicinesService = {
  list: (): Promise<Medicine[]> => window.clinic.medicines.list(),
  create: (name: string, price: number): Promise<Medicine> =>
    window.clinic.medicines.create(name, price),
  update: (id: string, name: string, price: number): Promise<Medicine> =>
    window.clinic.medicines.update(id, name, price),
  delete: (id: string) => window.clinic.medicines.delete(id),
};
