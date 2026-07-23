import { createSocket } from 'node:dgram';
import { BrowserWindow } from 'electron';
import { DISCOVERY_PORT, DISCOVERY_MAGIC } from './discovery.server';
import { trackDiscoveredServer } from '../settings/settings.ipc';

let udpSocket: ReturnType<typeof createSocket> | undefined;

export interface DiscoveredServer {
  ip: string;
  port: number;
  name: string;
}

const PROBE_MAGIC = 'CLINIC_PROBE';

export function startDiscoveryListener(): void {
  if (udpSocket) return;
  udpSocket = createSocket({ type: 'udp4', reuseAddr: true });

  udpSocket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString()) as { magic: string; ip: string; port: number; name: string };
      if (data.magic !== DISCOVERY_MAGIC) return;
      const server: DiscoveredServer = { ip: data.ip, port: data.port, name: data.name };
      trackDiscoveredServer(server);
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('discovery:server-found', server);
      });
    } catch { /* ignore malformed packets */ }
  });

  udpSocket.bind({ port: DISCOVERY_PORT, exclusive: false }, () => {
    try { (udpSocket as any).setMulticastLoopback?.(false); } catch { /* ignore */ }
  });
}

/** Send a probe broadcast — lan-server machines will respond with their info */
export function sendProbe(): void {
  const probe = Buffer.from(JSON.stringify({ magic: PROBE_MAGIC }));
  const sock = createSocket('udp4');
  sock.bind(() => {
    sock.setBroadcast(true);
    sock.send(probe, 0, probe.length, DISCOVERY_PORT, '255.255.255.255', () => sock.close());
  });
}

export function stopDiscoveryListener(): void {
  udpSocket?.close();
  udpSocket = undefined;
}
