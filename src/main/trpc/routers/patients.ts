import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
} from '../../patients/patient.service';

const patientInputSchema = z.object({
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

export const patientsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        search: z.string().default(''),
        providerId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return listPatients(input);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getPatient(input.id);
    }),

  create: publicProcedure
    .input(patientInputSchema)
    .mutation(async ({ input }) => {
      return createPatient(input);
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: patientInputSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return updatePatient(input.id, input.data);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await deletePatient(input.id);
      return { success: true };
    }),
});
