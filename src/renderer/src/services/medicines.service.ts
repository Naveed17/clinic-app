import type { Medicine } from '@/types/medicine';

export const medicinesService = {
  list: (): Promise<Medicine[]> => window.clinic.medicines.list(),
  search: (query: string): Promise<Medicine[]> => window.clinic.medicines.search(query),
  create: (name: string, price: number, type?: string, mg?: number | null): Promise<Medicine> =>
    window.clinic.medicines.create(name, price, type, mg),
  update: (id: string, name: string, price: number, type?: string, mg?: number | null): Promise<Medicine> =>
    window.clinic.medicines.update(id, name, price, type, mg),
  delete: (id: string) => window.clinic.medicines.delete(id),
};

export type { Medicine };
