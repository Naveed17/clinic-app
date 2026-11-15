import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getSavedKey } from '../license/license.ipc';

/**
 * LAN sync authorization.
 * All PCs of one clinic share the same CareFlow license key, so each request carries an
 * HMAC derived from that key. A device on the same Wi-Fi without the key cannot read the
 * clinic database through /api/sync/* (which includes users and patient records).
 */
export const LAN_AUTH_HEADER = 'x-careflow-lan';

export function lanAuthToken(): string | null {
  const key = getSavedKey();
  if (!key) return null;
  return createHmac('sha256', key.trim().toUpperCase()).update('careflow-lan-sync-v1').digest('hex');
}

/** fetch() to a LAN peer with the auth header attached. */
export function lanFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = lanAuthToken();
  if (token) headers.set(LAN_AUTH_HEADER, token);
  return fetch(url, { ...init, headers });
}

/** Express guard for LAN sync routes. */
export const requireLanAuth: RequestHandler = (req, res, next) => {
  const expected = lanAuthToken();
  // No license on this machine yet → the app is locked anyway; nothing to protect.
  if (!expected) {
    next();
    return;
  }
  const got = String(req.headers[LAN_AUTH_HEADER] || '');
  if (got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    next();
    return;
  }
  res.status(401).json({
    ok: false,
    error: 'LAN sync not authorized. Make sure every PC uses the same CareFlow license and the latest app version.',
  });
};

/** Only requests from this same PC (e.g. a local AI tool), never from the LAN. */
export const loopbackOnly: RequestHandler = (req, res, next) => {
  const ip = req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    next();
    return;
  }
  res.status(403).json({ ok: false, error: 'This endpoint is only available on this PC.' });
};
