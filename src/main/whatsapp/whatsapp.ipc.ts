import { ipcMain } from 'electron';
import {
  getWhatsAppConfig,
  testWhatsAppConnection,
  getHostedWhatsAppStatus,
  sendWhatsAppCampaign,
  sendWhatsAppText,
  getMetaEmbeddedSignupPublicConfig,
  exchangeEmbeddedSignupCode,
  type WhatsAppCampaignInput,
  type EmbeddedExchangeInput,
} from './whatsapp.service';

export function registerWhatsAppIpc(): void {
  ipcMain.handle('whatsapp:status', async () => {
    const config = getWhatsAppConfig();
    if (!config.enabled) {
      return { enabled: false, configured: false, displayNumber: config.displayNumber };
    }
    const hosted = await getHostedWhatsAppStatus();
    return {
      enabled: true,
      configured: hosted.configured,
      displayNumber: hosted.phone || config.displayNumber,
    };
  });

  ipcMain.handle('whatsapp:embeddedConfig', () => getMetaEmbeddedSignupPublicConfig());

  ipcMain.handle('whatsapp:embeddedExchange', (_e, input: EmbeddedExchangeInput) =>
    exchangeEmbeddedSignupCode(input),
  );

  ipcMain.handle('whatsapp:test', () => testWhatsAppConnection());
  ipcMain.handle('whatsapp:campaign', (_e, input: WhatsAppCampaignInput) => sendWhatsAppCampaign(input));
  ipcMain.handle('whatsapp:sendMessage', (_e, input: { phone?: string; text: string }) =>
    sendWhatsAppText(input),
  );
}
