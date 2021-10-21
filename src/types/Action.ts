import * as p from '../lib/predicates';
import { isBlocoProcesso, isIdBloco } from './Bloco';
import { isNumProc } from './NumProc';

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
