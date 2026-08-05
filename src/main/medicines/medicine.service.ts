import {
  searchCatalogMedicines,
  createCatalogMedicine,
  updateCatalogMedicinePrice,
} from '../inventory/inventory.service';

export async function searchMedicines(query: string) {
  return searchCatalogMedicines(query);
}

export async function createMedicine(name: string, price: number) {
  return createCatalogMedicine(name, price);
}

export async function updateMedicinePrice(id: string, price: number) {
  return updateCatalogMedicinePrice(id, price);
}

export async function listMedicines() {
  return searchCatalogMedicines('');
}
