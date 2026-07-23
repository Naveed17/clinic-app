import type { Server as SocketIOServer } from 'socket.io';
import type { Express } from 'express';
import { createTokensRouter } from './tokens.routes';
import { createLabRouter } from './lab.routes';
import { createAuthRouter } from './auth.routes';
import { createAppointmentsRouter } from './appointments.routes';
import { createChatRouter } from './chat.routes';
import { createDoctorsRouter } from './doctors.routes';
import { createInvoicesRouter } from './invoices.routes';
import { createPatientsRouter } from './patients.routes';
import { createReportsRouter } from './reports.routes';
import { createScheduleRouter } from './schedule.routes';

export function registerRoutes(app: Express, io: SocketIOServer): void {
  app.use('/api/tokens', createTokensRouter());
  app.use('/api/lab', createLabRouter());
  app.use('/api/auth', createAuthRouter());
  app.use('/api/patients', createPatientsRouter(io));
  app.use('/api/appointments', createAppointmentsRouter(io));
  app.use('/api/invoices', createInvoicesRouter(io));
  app.use('/api/reports', createReportsRouter());
  app.use('/api/chat', createChatRouter(io));
  app.use('/api/doctors', createDoctorsRouter(io));
  app.use('/api/schedule', createScheduleRouter());
}
