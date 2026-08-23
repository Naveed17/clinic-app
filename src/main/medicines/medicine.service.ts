import {
  searchCatalogMedicines,
  listCatalogMedicines,
  createCatalogMedicine,
  updateCatalogMedicinePrice,
  updateCatalogMedicine,
  deleteCatalogMedicine,
} from '../inventory/inventory.service';

export async function searchMedicines(query: string) {
  return searchCatalogMedicines(query);
}

export async function createMedicine(
  name: string,
  price: number,
  type?: string,
  mg?: number | null,
) {
  return createCatalogMedicine(name, price, type, mg);
}

export async function updateMedicinePrice(id: string, price: number) {
  return updateCatalogMedicinePrice(id, price);
}

export async function updateMedicine(
  id: string,
  name: string,
  price: number,
  type?: string,
  mg?: number | null,
) {
  return updateCatalogMedicine(id, name, price, type, mg);
}

export async function deleteMedicine(id: string) {
  return deleteCatalogMedicine(id);
}

export async function listMedicines() {
  return listCatalogMedicines();
}
