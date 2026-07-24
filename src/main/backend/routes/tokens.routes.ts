import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { asyncHandler } from '../utils/async-handler';
import { emitDataChange } from '../realtime';
import {
  createToken,
  deleteToken,
  listTokenDoctors,
  listTokenPatients,
  listTokens,
  updateTokenStatus,
} from '../../tokens/token.service';
import type { TokenStatus } from '@prisma/client';

export function createTokensRouter(io: SocketIOServer): Router {
  const router = Router();
  router.get('/', asyncHandler(async (req, res) => {
    const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    res.json(await listTokens(date));
  }));
  router.get('/doctors', asyncHandler(async (_req, res) => res.json(await listTokenDoctors())));
  router.get('/patients', asyncHandler(async (_req, res) => res.json(await listTokenPatients())));
  router.post('/', asyncHandler(async (req, res) => {
    const token = await createToken(req.body);
    emitDataChange(io, 'token', 'created');
    res.status(201).json(token);
  }));
  router.patch('/:id/status', asyncHandler(async (req, res) => {
    const token = await updateTokenStatus(String(req.params.id), req.body.status as TokenStatus);
    emitDataChange(io, 'token', 'updated');
    res.json(token);
  }));
  router.delete('/:id', asyncHandler(async (req, res) => {
    await deleteToken(String(req.params.id));
    emitDataChange(io, 'token', 'deleted');
    res.status(204).end();
  }));
  return router;
}
