import { z } from 'zod';

export const loginSchema = z.object({
  phone: z.string().min(9, 'phone_invalid'),
  password: z.string().min(1, 'validation_error'),
});

export type LoginInput = z.infer<typeof loginSchema>;
