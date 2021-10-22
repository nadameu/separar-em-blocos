import * as p from '../lib/predicates';
import { isNumProc } from './NumProc';

export const isIdBloco = p.isNonNegativeInteger;

export const isNomeBloco = p.isNonEmptyString;

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
