import { router, publicProcedure } from './trpc';
import { patientsRouter } from './routers/patients';

export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    service: 'careflow-trpc',
    timestamp: new Date().toISOString(),
  })),
  patients: patientsRouter,
});

export type AppRouter = typeof appRouter;
