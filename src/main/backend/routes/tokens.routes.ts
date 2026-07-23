import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import {
  createToken,
  deleteToken,
  listTokenDoctors,
  listTokenPatients,
  listTokens,
  updateTokenStatus,
} from '../../tokens/token.service';
import type { TokenStatus } from '@prisma/client';

export function createTokensRouter(): Router {
  const router = Router();
  router.get('/', asyncHandler(async (req, res) => {
    const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    res.json(await listTokens(date));
  }));
  router.get('/doctors', asyncHandler(async (_req, res) => res.json(await listTokenDoctors())));
  router.get('/patients', asyncHandler(async (_req, res) => res.json(await listTokenPatients())));
  router.post('/', asyncHandler(async (req, res) => res.status(201).json(await createToken(req.body))));
  router.patch('/:id/status', asyncHandler(async (req, res) => {
    res.json(await updateTokenStatus(String(req.params.id), req.body.status as TokenStatus));
  }));
  router.delete('/:id', asyncHandler(async (req, res) => {
    await deleteToken(String(req.params.id));
    res.status(204).end();
  }));
  return router;
}
