import { Router } from 'express';
import { createLabOrder, labPatients, listLabOrders, saveLabResult, updateLabOrderStatus } from '../../lab/lab.service';

export function createLabRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await listLabOrders());
  });

  router.get('/patients', async (_req, res) => {
    res.json(await labPatients());
  });

  router.post('/', async (req, res) => {
    const order = await createLabOrder(req.body);
    res.status(201).json(order);
  });

  router.patch('/:id/status', async (req, res) => {
    const order = await updateLabOrderStatus(req.params.id, req.body.status);
    res.json(order);
  });

  router.patch('/:id/result', async (req, res) => {
    const order = await saveLabResult(req.params.id, req.body.result);
    res.json(order);
  });

  return router;
}
