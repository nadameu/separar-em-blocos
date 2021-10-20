import { z } from 'zod';
import { isNumProc } from './NumProc';

export const isId = z.number().int().nonnegative();

export const isNome = z.string().refine(x => x.trim() !== '');

export const isBloco = z.object({ id: isId, nome: isNome, processos: z.array(isNumProc) });
export type Bloco = z.infer<typeof isBloco>;

export const isBlocoProcesso = z.object({ id: isId, nome: isNome, inserido: z.boolean() });
export type BlocoProcesso = z.infer<typeof isBlocoProcesso>;
