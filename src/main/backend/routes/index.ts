import type { Server as SocketIOServer } from 'socket.io';
import type { Express } from 'express';
import { authenticate } from '../middleware/auth';
import { createTokensRouter } from './tokens.routes';
import { createLabRouter } from './lab.routes';
import { createAuthRouter } from './auth.routes';
import { createAppointmentsRouter } from './appointments.routes';
import { createDoctorsRouter } from './doctors.routes';
import { createInvoicesRouter } from './invoices.routes';
import { createPatientsRouter } from './patients.routes';
import { createReportsRouter } from './reports.routes';
import { createScheduleRouter } from './schedule.routes';
import { createSearchRouter } from './search.routes';
import { createChatRouter } from './chat.routes';
import { createMedicinesRouter } from './medicines.routes';

export function registerRoutes(app: Express, io: SocketIOServer): void {
  app.use('/api/auth', createAuthRouter());
  app.use(authenticate);
  app.use('/api/tokens', createTokensRouter(io));
  app.use('/api/lab', createLabRouter(io));
  app.use('/api/patients', createPatientsRouter(io));
  app.use('/api/appointments', createAppointmentsRouter(io));
  app.use('/api/invoices', createInvoicesRouter(io));
  app.use('/api/reports', createReportsRouter());
  app.use('/api/doctors', createDoctorsRouter(io));
  app.use('/api/schedule', createScheduleRouter());
  app.use('/api/search', createSearchRouter());
  app.use('/api/chat', createChatRouter(io));
  app.use('/api/medicines', createMedicinesRouter());
}
