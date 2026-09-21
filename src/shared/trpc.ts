import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const patientInputSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().nullable().optional(),
  weight: z.union([z.number(), z.string()]).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  age: z.union([z.number(), z.string()]).nullable().optional(),
  gender: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
  chronicConditions: z.string().nullable().optional(),
  primaryDoctorId: z.string().nullable().optional(),
});

export type PatientInputType = z.infer<typeof patientInputSchema>;

export interface PatientRecord {
  id: string;
  mrNumber: string;
  firstName: string;
  lastName: string | null;
  weight: number | null;
  dateOfBirth: Date | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  primaryDoctorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const patientsRouterDefinition = router({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        search: z.string().default(''),
        providerId: z.string().optional(),
      }),
    )
    .query(
      () =>
        ({} as {
          data: PatientRecord[];
          total: number;
        }),
    ),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(() => ({} as PatientRecord | null)),

  create: publicProcedure
    .input(patientInputSchema)
    .mutation(() => ({} as PatientRecord)),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: patientInputSchema,
      }),
    )
    .mutation(() => ({} as PatientRecord)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => ({ success: true })),
});

export const appRouterDefinition = router({
  health: publicProcedure.query(() => ({
    ok: true,
    service: 'careflow-trpc',
    timestamp: '',
  })),
  patients: patientsRouterDefinition,
});

export type AppRouter = typeof appRouterDefinition;
