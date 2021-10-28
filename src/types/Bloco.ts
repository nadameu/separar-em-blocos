import * as p from '../lib/predicates';
import { isNumProc, NumProc } from './NumProc';

export const isIdBloco = p.isNonNegativeInteger;

export const isNomeBloco = p.isNonEmptyString;

export const isBloco: p.Predicate<Bloco> = p.hasShape({
  id: isIdBloco,
  nome: isNomeBloco,
  processos: p.isArray(isNumProc),
});
export interface Bloco {
  id: p.Static<typeof isIdBloco>;
  nome: p.Static<typeof isNomeBloco>;
  processos: NumProc[];
}

export const isBlocoProcesso: p.Predicate<BlocoProcesso> = p.hasShape({
  id: isIdBloco,
  nome: isNomeBloco,
  inserido: p.isBoolean,
});
export interface BlocoProcesso {
  id: p.Static<typeof isIdBloco>;
  nome: p.Static<typeof isNomeBloco>;
  inserido: boolean;
}
