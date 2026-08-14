import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { createInvoice, invoicePatients, listInvoices, addPayment, voidInvoice, deleteInvoice, getPayments } from '../../invoices/invoice.service';
import type { InvoiceInput } from '../../invoices/invoice.service';
import { asyncHandler } from '../utils/async-handler';
import { requireRole } from '../middleware/auth';
import { emitNotification, emitDataChange } from '../realtime';

export function createInvoicesRouter(io: SocketIOServer): Router {
  const router = Router();

  router.get(
    '/',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (_req, res) => {
      res.json(await listInvoices());
    }),
  );

  router.get(
    '/patients',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (_req, res) => {
      res.json(await invoicePatients());
    }),
  );

  router.post(
    '/',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const invoice = await createInvoice(req.body as InvoiceInput);
      emitNotification(io, {
        kind: 'success',
        title: 'Invoice created',
        message: `Invoice ${invoice.invoiceNumber} was created.`,
        payload: { entity: 'invoice', id: invoice.id },
      });
      emitDataChange(io, 'invoice', 'created');
      res.status(201).json(invoice);
    }),
  );

  router.post(
    '/:id/payment',
    requireRole(['admin', 'receptionist', 'pharmacist']),
    asyncHandler(async (req, res) => {
      const { amount, method, reference } = req.body as { amount: number; method: string; reference?: string };
      const invoice = await addPayment(req.params['id'] as string, amount, method, reference);
      emitNotification(io, { kind: 'success', title: 'Payment recorded', message: `Payment of ${amount} recorded.`, payload: { entity: 'invoice', id: invoice.id } });
      emitDataChange(io, 'invoice', 'updated');
      res.json(invoice);
    }),
  );

  router.post(
    '/:id/void',
    requireRole(['admin', 'receptionist']),
    asyncHandler(async (req, res) => {
      const invoice = await voidInvoice(req.params['id'] as string);
      emitNotification(io, { kind: 'warning', title: 'Invoice voided', message: `Invoice ${invoice.invoiceNumber} was voided.`, payload: { entity: 'invoice', id: invoice.id } });
      emitDataChange(io, 'invoice', 'deleted');
      res.json(invoice);
    }),
  );

  router.delete(
    '/:id',
    requireRole(['admin', 'receptionist']),
    asyncHandler(async (req, res) => {
      const id = req.params['id'] as string;
      await deleteInvoice(id);
      emitNotification(io, {
        kind: 'warning',
        title: 'Invoice deleted',
        message: 'An invoice was permanently removed.',
        payload: { entity: 'invoice', id },
      });
      emitDataChange(io, 'invoice', 'deleted');
      res.status(204).send();
    }),
  );

  router.get(
    '/:id/payments',
    requireRole(['admin', 'receptionist']),
    asyncHandler(async (req, res) => {
      res.json(await getPayments(req.params['id'] as string));
    }),
  );

  return router;
}
