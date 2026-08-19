import { getClinicLogoDataUrl } from '@/utils/clinicBrandLogo';

/** Print helpers: clinic logo if set, otherwise CareFlow. */
export async function getCareflowLogoDataUrl(): Promise<string> {
  return getClinicLogoDataUrl();
}
