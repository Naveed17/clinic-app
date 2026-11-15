// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
import type { Request, RequestHandler } from 'express';
import type { AppRole } from '../types';

import { app } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const INSECURE_DEFAULT = 'clinic-secret-key';
let cachedSecret: string | null = null;

/**
 * Per-installation JWT secret (userData/jwt-secret.key), created on first use.
 * The old shared default let anyone forge an admin token for a LAN server.
 * JWT_SECRET env still wins when set (dev).
 */
export function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = String(process.env.JWT_SECRET || '').trim();
  if (fromEnv && fromEnv !== INSECURE_DEFAULT) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  const file = join(app.getPath('userData'), 'jwt-secret.key');
  try {
    if (existsSync(file)) {
      const saved = readFileSync(file, 'utf-8').trim();
      if (saved.length >= 32) {
        cachedSecret = saved;
        return cachedSecret;
      }
    }
    const created = randomBytes(48).toString('hex');
    writeFileSync(file, created, 'utf-8');
    cachedSecret = created;
  } catch (err) {
    // Never block login: fall back to an in-memory secret (sessions reset on restart).
    console.warn('[auth] Could not persist JWT secret:', err);
    cachedSecret = randomBytes(48).toString('hex');
  }
  return cachedSecret;
}
export const JWT_EXPIRES_IN = '8h';

export interface JwtPayload {
  userId: string;
  role: AppRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export const authenticate: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }
  try {
    req.user = jwt.verify(header.slice(7), getJwtSecret()) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export function requireRole(allowedRoles: AppRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'You are not allowed to access this resource.' });
      return;
    }
    next();
  };
}
