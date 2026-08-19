import careflowLogo from '@/assets/careflow-logo.png';
import { useEffect, useState } from 'react';

export const DEFAULT_CLINIC_LOGO = careflowLogo;
export const CLINIC_BRAND_EVENT = 'clinic-brand-changed';

export function notifyClinicBrandChanged(): void {
  window.dispatchEvent(new Event(CLINIC_BRAND_EVENT));
}

function isCustomClinicLogo(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const custom = value.trim();
  return custom.startsWith('data:image/') && custom.includes('base64,') && custom.length > 40;
}

/** Custom upload if valid; otherwise CareFlow. */
export function resolveClinicLogoSrc(custom?: string | null): string {
  return isCustomClinicLogo(custom) ? custom.trim() : careflowLogo;
}

export async function getClinicBrandLogoSrc(): Promise<string> {
  try {
    const settings = await window.clinic?.settings.get();
    if (isCustomClinicLogo(settings?.clinicLogo)) return settings.clinicLogo.trim();
  } catch {
    /* use CareFlow */
  }
  return careflowLogo;
}

let dataUrlCache: string | null = null;
let dataUrlKey = '';

export function invalidateClinicLogoCache(): void {
  dataUrlCache = null;
  dataUrlKey = '';
}

/** Embeddable logo for HTML / thermal print (clinic logo, else CareFlow). Never empty. */
export async function getClinicLogoDataUrl(): Promise<string> {
  const src = await getClinicBrandLogoSrc();
  if (src.startsWith('data:image/')) return src;
  if (dataUrlCache && dataUrlKey === src) return dataUrlCache;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (dataUrl.startsWith('data:image/')) {
      dataUrlCache = dataUrl;
      dataUrlKey = src;
      return dataUrl;
    }
  } catch {
    /* fall back to CareFlow asset URL */
  }
  return careflowLogo;
}

export function useClinicBrandLogo(): string {
  const [src, setSrc] = useState(careflowLogo);
  useEffect(() => {
    const apply = (next: string) => setSrc(next || careflowLogo);
    void getClinicBrandLogoSrc().then(apply);
    const refresh = () => {
      invalidateClinicLogoCache();
      void getClinicBrandLogoSrc().then(apply);
    };
    window.addEventListener(CLINIC_BRAND_EVENT, refresh);
    return () => window.removeEventListener(CLINIC_BRAND_EVENT, refresh);
  }, []);
  return src || careflowLogo;
}
