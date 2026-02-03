import z from 'zod';

export const zObjectId = z
  .string()
  .or(z.unknown().transform((val) => String(val)));

export const zDateString = z.preprocess((val) => {
  if (val instanceof Date) return val.toISOString();
  return val;
}, z.string().datetime());
