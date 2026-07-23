import { z } from 'zod';

export const emptyFormSchema = z.object({});

export type EmptyFormValues = z.infer<typeof emptyFormSchema>;
