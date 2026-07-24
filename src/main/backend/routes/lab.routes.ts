import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { emitDataChange } from '../realtime';
import { createLabOrder, labPatients, listLabOrders, saveLabResult, updateLabOrderStatus } from '../../lab/lab.service';

export function createLabRouter(io: SocketIOServer): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await listLabOrders());
  });

  router.get('/patients', async (_req, res) => {
    res.json(await labPatients());
  });

  router.post('/', async (req, res) => {
    const order = await createLabOrder(req.body);
    emitDataChange(io, 'lab', 'created');
    res.status(201).json(order);
  });

  router.patch('/:id/status', async (req, res) => {
    const order = await updateLabOrderStatus(req.params.id, req.body.status);
    emitDataChange(io, 'lab', 'updated');
    res.json(order);
  });

  router.patch('/:id/result', async (req, res) => {
    const order = await saveLabResult(req.params.id, req.body.result);
    emitDataChange(io, 'lab', 'updated');
    res.json(order);
  });

  return router;
}
