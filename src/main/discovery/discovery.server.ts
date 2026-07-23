import { createSocket } from 'node:dgram';
import { networkInterfaces } from 'node:os';

export const DISCOVERY_PORT = 41234;
export const DISCOVERY_MAGIC = 'CLINIC_DISCOVERY';
const PROBE_MAGIC = 'CLINIC_PROBE';

let intervalId: ReturnType<typeof setInterval> | undefined;
let udpSocket: ReturnType<typeof createSocket> | undefined;

function getLanIp(): string {
  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

export function startDiscoveryBroadcast(port: number): void {
  udpSocket = createSocket({ type: 'udp4', reuseAddr: true });
  const ip = getLanIp();
  const payload = Buffer.from(
    JSON.stringify({ magic: DISCOVERY_MAGIC, ip, port, name: 'Clinic Server' }),
  );

  udpSocket.bind(DISCOVERY_PORT, () => {
    udpSocket!.setBroadcast(true);
    udpSocket!.send(payload, 0, payload.length, DISCOVERY_PORT, '255.255.255.255');
  });

  // Also respond to probe packets from clients
  udpSocket.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString()) as { magic: string };
      if (data.magic === PROBE_MAGIC) {
        udpSocket?.send(payload, 0, payload.length, DISCOVERY_PORT, rinfo.address);
      }
    } catch { /* ignore */ }
  });

  intervalId = setInterval(() => {
    udpSocket?.send(payload, 0, payload.length, DISCOVERY_PORT, '255.255.255.255');
  }, 3000);
}

export function stopDiscoveryBroadcast(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = undefined; }
  udpSocket?.close();
  udpSocket = undefined;
}
