import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1),
});

export const loginGoogleSchema = z.object({
  idToken: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginGoogleInput = z.infer<typeof loginGoogleSchema>;
