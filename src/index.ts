import { createBloco, deleteBloco, getBlocos, open, openBlocos, updateBloco } from './database';
import {
  assert,
  isNonNegativeInteger,
  isNumber,
  NonEmptyString,
  NonNegativeInteger,
} from './lib/predicates';
import { LocalizadorProcessoLista } from './paginas/LocalizadorProcessoLista';
import { Bloco } from './types/Bloco';

function createIncrementId(lastId?: number) {
  let current = isNumber(lastId) ? lastId + 1 : 0;
  assert(isNonNegativeInteger(current), `${lastId} inválido.`);
  return () => current++ as NonNegativeInteger;
}

async function main() {
  const url = new URL(document.location.href);
  const params = url.searchParams;
  const acao = params.get('acao');
  switch (acao) {
    case 'localizador_processos_lista':
      return LocalizadorProcessoLista();
  }
}

main().catch(e => {
  console.error(e);
});
