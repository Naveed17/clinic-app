import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
import { JWT_SECRET, type JwtPayload } from '../backend/middleware/auth';

export interface Context {
  req: CreateExpressContextOptions['req'];
  res: CreateExpressContextOptions['res'];
  user?: JwtPayload;
}

export function createContext({ req, res }: CreateExpressContextOptions): Context {
  let user: JwtPayload | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      user = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    } catch {
      // Invalid/expired token: user remains undefined
    }
  }
  return { req, res, user };
}
