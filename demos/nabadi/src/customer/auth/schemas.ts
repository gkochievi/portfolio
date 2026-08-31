import { z } from 'zod';

export const loginSchema = z.object({
  phone: z.string().min(9, 'phone_invalid'),
  password: z.string().min(1, 'validation_error'),
});

export const registerSchema = z.object({
  first_name: z.string().min(1, 'validation_error'),
  last_name: z.string().min(1, 'validation_error'),
  phone: z.string().min(9, 'phone_invalid'),
  email: z.string().email('validation_error').optional().or(z.literal('')),
  password: z.string().min(8, 'password_weak'),
});

export const meUpdateSchema = z.object({
  first_name: z.string().min(1, 'validation_error'),
  last_name: z.string().min(1, 'validation_error'),
  email: z.string().email('validation_error').optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'validation_error'),
  new_password: z.string().min(8, 'password_weak'),
});

export const forgotPasswordSchema = z.object({
  phone: z.string().min(9, 'phone_invalid'),
});

export const resetPasswordSchema = z.object({
  phone: z.string().min(9, 'phone_invalid'),
  code: z.string().regex(/^\d{6}$/, 'otp_invalid'),
  new_password: z.string().min(8, 'password_weak'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type MeUpdateInput = z.infer<typeof meUpdateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
