import * as p from '../lib/predicates';
import { isBloco, isBlocoProcesso, isIdBloco, isNomeBloco } from './Bloco';
import { isNumProc } from './NumProc';

export const isClientMessage = p.isTaggedUnion('type', {
  ObterBlocosProcesso: { numproc: isNumProc },
  InserirProcesso: { bloco: isIdBloco, numproc: isNumProc },
  RemoverProcesso: { bloco: isIdBloco, numproc: isNumProc },
});
export type ClientMessage = p.Static<typeof isClientMessage>;

export const isServerMessage = p.isTaggedUnion('type', {
  FornecerBlocosProcesso: {
    blocos: p.isArray(isBlocoProcesso),
  },
});
export type ServerMessage = p.Static<typeof isServerMessage>;

export const isServerLoadingAction = p.isTaggedUnion('type', {
  AtualizarBlocos: { blocos: p.isArray(isBloco) },
  DadosInvalidos: { motivo: p.isString },
  Erro: { motivo: p.isString },
  ObterDados: {},
});
export type ServerLoadingAction = p.Static<typeof isServerLoadingAction>;

export const isServerLoadedAction = p.isTaggedUnion('type', {
  CriarBloco: { nome: isNomeBloco },
  Erro: { motivo: p.isString },
  ExcluirBloco: { bloco: isIdBloco },
  RenomearBloco: { bloco: isIdBloco, nome: isNomeBloco },
});
export type ServerLoadedAction = p.Static<typeof isServerLoadedAction>;

export const isServerErrorAction = p.isTaggedUnion('type', {
  Erro: { motivo: p.isString },
  ExcluirBanco: {},
  ObterDados: {},
});
export type ServerErrorAction = p.Static<typeof isServerErrorAction>;

export type ServerAction = ServerLoadingAction | ServerLoadedAction | ServerErrorAction;
