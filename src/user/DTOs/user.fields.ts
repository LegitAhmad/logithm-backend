import { z } from 'zod';

export const username = z.string().min(3).max(20);
export const email = z.email();
export const passwordHash = z.string();
export const password = z.string().min(8);
export const isVerified = z.boolean().default(false);
export const firstName = z.string().min(3).max(20);
export const lastName = z.string().min(3).max(20);
