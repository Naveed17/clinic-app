import { ipcMain, app } from 'electron';
import { networkInterfaces } from 'node:os';
import { request as httpRequest } from 'node:http';
import { getSettings, saveSettings, type AppSettings } from '../config/settings';
import type { DiscoveredServer } from '../discovery/discovery.client';
import { sendProbe } from '../discovery/discovery.client';

function getLanIp(): string {
  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const discoveredServers = new Map<string, DiscoveredServer>();

export function trackDiscoveredServer(server: DiscoveredServer): void {
  discoveredServers.set(server.ip, server);
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:save', (_e, patch: Partial<AppSettings>) => saveSettings(patch));
  ipcMain.handle('settings:relaunch', () => {
    // Relaunch so serverMode / lanPort / clientApiUrl take effect in main process
    app.relaunch();
    app.exit(0);
  });
  ipcMain.handle('settings:lan-ip', () => getLanIp());
  ipcMain.handle('settings:discovered-servers', () => Array.from(discoveredServers.values()));
  ipcMain.handle('settings:scan', () => {
    discoveredServers.clear();
    sendProbe();
    // Retry probe after 1.5s in case first packet was lost on the network
    const retryTimer = setTimeout(() => sendProbe(), 1500);
    return new Promise<DiscoveredServer[]>((resolve) => {
      setTimeout(() => {
        clearTimeout(retryTimer);
        resolve(Array.from(discoveredServers.values()));
      }, 5000);
    });
  });
  ipcMain.handle('settings:test-connection', (_e, url: string) =>
    new Promise<boolean>((resolve) => {
      const req = httpRequest(`${url}/health`, { timeout: 4000 }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try { resolve((JSON.parse(data) as { ok: boolean }).ok === true); }
          catch { resolve(false); }
        });
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    }),
  );
}
