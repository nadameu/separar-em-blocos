import * as p from '../lib/predicates';
import { isNumProc } from './NumProc';

export const isIdBloco = p.isNonNegativeInteger;

export const isNomeBloco = p.isNonEmptyString;

export const isBloco = p.hasShape({
  id: isIdBloco,
  nome: isNomeBloco,
  processos: p.isArray(isNumProc),
});
export interface Bloco extends p.Static<typeof isBloco> {}

export const isBlocoProcesso = p.hasShape({
  id: isIdBloco,
  nome: isNomeBloco,
  inserido: p.isBoolean,
});
export interface BlocoProcesso extends p.Static<typeof isBlocoProcesso> {}
