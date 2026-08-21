import { supportMailtoHref, supportPhoneDisplay, supportWhatsAppHref } from '@shared/careflowSupport';
import { showAppToast } from '@/components/AppToast';

/** Copy support phone — clinic desktops usually have no tel: dialer. */
export async function copySupportPhone(raw: string): Promise<void> {
  const phone = supportPhoneDisplay(raw);
  if (!phone) return;
  try {
    await navigator.clipboard.writeText(phone);
    showAppToast({ type: 'success', message: 'Phone number copied' });
  } catch {
    showAppToast({ type: 'error', message: 'Could not copy phone number' });
  }
}

/** Open default mail app via Electron shell (mailto through window.open). */
export function openSupportEmail(raw: string): void {
  const href = supportMailtoHref(raw);
  if (!href) return;
  window.open(href, '_blank', 'noopener,noreferrer');
}

/** Open WhatsApp Desktop / Web via system browser (same as patient WhatsApp). */
export function openSupportWhatsApp(raw: string): void {
  const href = supportWhatsAppHref(raw);
  if (!href) return;
  window.open(href, '_blank', 'noopener,noreferrer');
}
