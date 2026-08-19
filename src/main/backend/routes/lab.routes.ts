import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { emitDataChange, emitNotification } from '../realtime';
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
  /** Lab page work: status, results, patient picker for new orders. */
  const labStaff = requireRole(['admin', 'lab_technician']);
  /** Read lab records (history / search / token) — not the Lab page. */
  const labRecordReaders = requireRole(['admin', 'doctor', 'receptionist', 'lab_technician']);
  /** Create orders from doctor/lab workflows. */
  const labOrderers = requireRole(['admin', 'doctor', 'lab_technician']);

  router.get('/', labRecordReaders, async (_req, res) => {
    res.json(await listLabOrders());
  });

  router.get('/patients', labStaff, async (_req, res) => {
    res.json(await labPatients());
  });

  router.get('/by-token/:tokenId', labRecordReaders, async (req, res) => {
    res.json(await listLabOrdersByToken(String(req.params.tokenId)));
  });

  router.post('/', labOrderers, async (req, res) => {
    const order = await createLabOrder(req.body);
    emitDataChange(io, 'lab', 'created');
    emitNotification(io, {
      kind: 'success',
      title: 'New lab order',
      message: `${order.test} — ${order.patientName} · ${order.orderedByName}`,
      payload: {
        entity: 'lab',
        id: order.id,
        patientId: order.patientId,
        orderedById: order.orderedById,
      },
    });
    res.status(201).json(order);
  });

  router.patch('/:id/status', labStaff, async (req, res) => {
    const order = await updateLabOrderStatus(String(req.params.id), req.body.status);
    emitDataChange(io, 'lab', 'updated');
    res.json(order);
  });

  router.patch('/:id/result', labStaff, async (req, res) => {
    const order = await saveLabResult(String(req.params.id), req.body.result);
    emitDataChange(io, 'lab', 'updated');
    emitNotification(io, {
      kind: 'success',
      title: 'Lab result ready',
      message: `${order.test} — ${order.patientName}`,
      payload: {
        entity: 'lab',
        id: order.id,
        orderedById: order.orderedById,
      },
    });
    res.json(order);
  });

  return router;
}
