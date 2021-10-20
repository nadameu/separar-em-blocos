import { z } from 'zod';

export const isNumProc = z.string().length(20);

export type NumProc = z.infer<typeof isNumProc>;
