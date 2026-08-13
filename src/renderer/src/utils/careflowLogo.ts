import careflowLogo from '@/assets/careflow-logo.png';

let logoDataUrlCache: string | null = null;

/** Embeddable CareFlow logo for HTML print (temp file:// pages cannot use Vite asset URLs). */
export async function getCareflowLogoDataUrl(): Promise<string> {
  if (logoDataUrlCache) return logoDataUrlCache;
  try {
    const res = await fetch(careflowLogo);
    const blob = await res.blob();
    logoDataUrlCache = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return logoDataUrlCache;
  } catch {
    return '';
  }
}
