import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { emitDataChange } from '../realtime';
import { requireRole } from '../middleware/auth';
import {
  createLabOrder,
  labPatients,
  listLabOrders,
  listLabOrdersByToken,
  saveLabResult,
  updateLabOrderStatus,
} from '../../lab/lab.service';

export function createLabRouter(io: SocketIOServer): Router {
  const router = Router();
  const labStaff = requireRole(['admin', 'lab_technician']);
  const labReaders = requireRole(['admin', 'doctor', 'lab_technician']);

  router.get('/', labReaders, async (_req, res) => {
    res.json(await listLabOrders());
  });

  router.get('/patients', labStaff, async (_req, res) => {
    res.json(await labPatients());
  });

  router.get('/by-token/:tokenId', labReaders, async (req, res) => {
    res.json(await listLabOrdersByToken(String(req.params.tokenId)));
  });

  router.post('/', labReaders, async (req, res) => {
    const order = await createLabOrder(req.body);
    emitDataChange(io, 'lab', 'created');
    res.status(201).json(order);
  });

  router.patch('/:id/status', labStaff, async (req, res) => {
    const order = await updateLabOrderStatus(req.params.id, req.body.status);
    emitDataChange(io, 'lab', 'updated');
    res.json(order);
  });

  router.patch('/:id/result', labStaff, async (req, res) => {
    const order = await saveLabResult(req.params.id, req.body.result);
    emitDataChange(io, 'lab', 'updated');
    res.json(order);
  });

  return router;
}
