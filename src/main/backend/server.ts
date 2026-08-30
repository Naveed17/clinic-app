import cors from 'cors';
import express from 'express';
import { createServer, type Server as HttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import type { AddressInfo } from 'node:net';
import { Server as SocketIOServer } from 'socket.io';
import { errorHandler } from './middleware/error-handler';
import { registerRealtimeSocket } from './realtime';
import { registerRoutes } from './routes';

function getLanIp(): string {
  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

export interface BackendServer {
  url: string;
  io: SocketIOServer;
  close: () => Promise<void>;
}

async function listen(httpServer: HttpServer, port: number, host: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      const address = httpServer.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine backend port.'));
        return;
      }
      resolve((address as AddressInfo).port);
    });
  });
}

import { getSettings } from '../config/settings';

export async function startBackendServer(port = Number(process.env.CLINIC_API_PORT ?? 0)): Promise<BackendServer> {
  const settings = getSettings();
  const isLanServer = settings.serverMode === 'lan-server';
  const host = isLanServer ? '0.0.0.0' : '127.0.0.1';
  const resolvedPort = settings.lanPort || port;
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'clinic-backend' });
  });

  registerRoutes(app, io);
  registerRealtimeSocket(io);
  app.use(errorHandler);

  const actualPort = await listen(httpServer, resolvedPort, host);

  const bindHost = host === '0.0.0.0' ? getLanIp() : '127.0.0.1';
  return {
    url: `http://${bindHost}:${actualPort}`,
    io,
    close: async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
