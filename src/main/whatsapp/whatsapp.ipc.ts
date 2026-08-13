import { ipcMain } from 'electron';
import {
  getWhatsAppConfig,
  isWhatsAppReady,
  testWhatsAppConnection,
  sendWhatsAppCampaign,
  sendWhatsAppText,
  getMetaEmbeddedSignupPublicConfig,
  exchangeEmbeddedSignupCode,
  type WhatsAppCampaignInput,
  type EmbeddedExchangeInput,
} from './whatsapp.service';

export function registerWhatsAppIpc(): void {
  ipcMain.handle('whatsapp:status', () => {
    const config = getWhatsAppConfig();
    return {
      enabled: config.enabled,
      configured: isWhatsAppReady(config),
      displayNumber: config.displayNumber,
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
