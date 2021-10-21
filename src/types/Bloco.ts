import * as p from '../lib/predicates';
import { isNumProc } from './NumProc';

export const isIdBloco = p.refine(p.isNumber, (x): x is number => Number.isInteger(x) && x >= 0);

export const isNomeBloco = p.refine(p.isString, (x): x is string => x.trim() !== '');

export const isBloco = p.hasShape({
  id: isIdBloco,
  nome: isNomeBloco,
  processos: p.isArray(isNumProc),
});
export type Bloco = p.Static<typeof isBloco>;

export const isBlocoProcesso = p.hasShape({
  id: isIdBloco,
  nome: isNomeBloco,
  inserido: p.isBoolean,
});
export type BlocoProcesso = p.Static<typeof isBlocoProcesso>;
