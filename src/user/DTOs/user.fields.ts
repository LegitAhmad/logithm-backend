import { z } from 'zod';

export const username = z.string().min(3).max(16).regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers, and underscores');
export const email = z.email();
export const passwordHash = z.string();
export const password = z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');
export const isVerified = z.boolean().default(false);
export const firstName = z.string().trim().min(1).max(40);
export const lastName = z.string().trim().min(1).max(40);
