import { z } from 'zod';
import { isBlocoProcesso } from './Bloco';
import { isNumProc } from './NumProc';

export const isClientMessage = z.object({
  type: z.literal('ObterBlocosProcesso'),
  numproc: isNumProc,
});
export type ClientMessage = z.infer<typeof isClientMessage>;

export const isServerMessage = z.object({
  type: z.literal('FornecerBlocosProcesso'),
  blocos: z.array(isBlocoProcesso),
});
export type ServerMessage = z.infer<typeof isServerMessage>;
