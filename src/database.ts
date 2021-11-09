import { DBSchema, deleteDB, openDB } from 'idb';
import { assert, NonEmptyString, NonNegativeInteger } from './lib/predicates';
import { Bloco, isBloco } from './types/Bloco';

interface Dados extends DBSchema {
  blocos: { key: Bloco['id']; value: Bloco; indexes: { nome: 'nome'; processos: 'processos' } };
}

export function open() {
  return openDB<Dados>('gm-blocos', 4, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        db.createObjectStore('blocos', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        transaction.objectStore('blocos').createIndex('nome', ['nome'], { unique: true });
      }
      if (oldVersion < 3) {
        const blocos = transaction.objectStore('blocos');
        blocos.deleteIndex('nome');
        blocos.createIndex('nome', 'nome', { unique: true });
      }
      if (oldVersion < 4) {
        const blocos = transaction.objectStore('blocos');
        blocos.createIndex('processos', 'processos', { multiEntry: true });
      }
    },
    blocked() {},
    blocking() {},
    terminated() {},
  });
}

export function deleteBlocos() {
  return deleteDB('gm-blocos', {
    blocked() {},
  });
}

export async function getBlocos() {
  const db = await open();
  const blocos = await db.getAll('blocos');
  assert(blocos.every(isBloco), 'Formato do banco de dados desconhecido.');
  return blocos.sort((a, b) => {
    const [c, d] = [a, b].map(x => x.nome) as [NonEmptyString, NonEmptyString];
    const [e, f] = [c, d].map(x => x.toLowerCase()) as [NonEmptyString, NonEmptyString];
    if (e < f) return -1;
    if (e > f) return +1;
    if (c < d) return -1;
    if (c > d) return +1;
    throw new Error(`Há dois blocos com o mesmo nome: ${JSON.stringify(c)}.`);
  });
}

export async function getBloco(id: NonNegativeInteger) {
  const db = await open();
  return db.get('blocos', id);
}

export async function createBloco(bloco: Bloco) {
  const db = await open();
  return db.add('blocos', bloco);
}

export async function deleteBloco(id: Bloco['id']) {
  const db = await open();
  await db.delete('blocos', id);
}

export async function updateBloco(bloco: Bloco) {
  const db = await open();
  await db.put('blocos', bloco);
}
