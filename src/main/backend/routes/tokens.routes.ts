import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { asyncHandler } from '../utils/async-handler';
import { emitDataChange, emitNotification } from '../realtime';
import { getPrisma } from '../../database/client';
import {
  createToken,
  deleteToken,
  listTokenDoctors,
  listTokenPatients,
  listPrescriptionFeed,
  listTokens,
  updateTokenStatus,
  upsertPrescription,
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
  router.get('/prescriptions', asyncHandler(async (req, res) => {
    const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    res.json(await listPrescriptionFeed(date));
  }));
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
  router.put('/:id/prescription', asyncHandler(async (req, res) => {
    const tokenId = String(req.params.id);
    const id = await upsertPrescription(tokenId, req.body);
    const rows = await getPrisma().$queryRaw<
      Array<{ tokenNumber: number; firstName: string; lastName: string }>
    >`
      SELECT t.tokenNumber, p.firstName, p.lastName
      FROM "Token" t
      JOIN "Patient" p ON p.id = t.patientId
      WHERE t.id = ${tokenId}
      LIMIT 1
    `;
    if (rows[0]) {
      const row = rows[0];
      emitNotification(io, {
        kind: 'success',
        title: 'Prescription Added',
        message: `Prescription written for ${row.firstName} ${row.lastName} (Token #${String(row.tokenNumber).padStart(3, '0')}).`,
        payload: { entity: 'prescription', tokenId },
      });
    }
    emitDataChange(io, 'prescription', 'upserted');
    res.json({ id });
  }));
  return router;
}
