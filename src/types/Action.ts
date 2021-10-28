import * as p from '../lib/predicates';
import { Bloco, isBlocoProcesso, isIdBloco, isNomeBloco } from './Bloco';
import { isNumProc } from './NumProc';
import { ServerState } from './State';

export const isClientMessage = p.isAnyOf(
  p.hasShape({ type: p.isLiteral('ObterBlocosProcesso'), numproc: isNumProc }),
  p.hasShape({ type: p.isLiteral('InserirProcesso'), bloco: isIdBloco, numproc: isNumProc }),
  p.hasShape({ type: p.isLiteral('RemoverProcesso'), bloco: isIdBloco, numproc: isNumProc }),
);
export type ClientMessage = p.Static<typeof isClientMessage>;

export const isServerMessage = p.hasShape({
  type: p.isLiteral('FornecerBlocosProcesso'),
  blocos: p.isArray(isBlocoProcesso),
});
export type ServerMessage = p.Static<typeof isServerMessage>;

export type ServerAction =
  | { type: 'CriarBloco'; nome: p.NonEmptyString }
  | { type: 'AtualizarBlocos'; blocos: Bloco[] }
  | { type: 'DadosInvalidos'; motivo: string }
  | { type: 'Erro'; motivo: string }
  | { type: 'ExcluirBanco' }
  | { type: 'ExcluirBloco'; bloco: p.NonNegativeInteger }
  | { type: 'RenomearBloco'; bloco: p.NonNegativeInteger; nome: p.NonEmptyString }
  | { type: 'ObterDados' };
