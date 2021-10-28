import type { DBSchema } from 'idb';
import { assert, NonEmptyString, NonNegativeInteger } from './lib/predicates';
import { Bloco, isBloco } from './types/Bloco';

interface Dados extends DBSchema {
  blocos: { key: Bloco['id']; value: Bloco; indexes: { nome: 'nome'; processos: 'processos' } };
}

export function open() {
  return idb.openDB<Dados>('gm-blocos', 4, {
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

export function openBlocos<Mode extends IDBTransactionMode = 'readonly'>(mode?: Mode) {
  return open().then(db => db.transaction('blocos', mode).store);
}

export function deleteBlocos() {
  return idb.deleteDB('gm-blocos', {
    blocked() {},
  });
}

export function getBlocos() {
  return openBlocos()
    .then(store => store.getAll())
    .then(blocos => {
      assert(blocos.every(isBloco), 'Formato do banco de dados desconhecido.');
      return blocos;
    });
}

export function getBloco(id: NonNegativeInteger) {
  return openBlocos().then(store => store.get(id));
}

export function createBloco(bloco: Bloco) {
  return openBlocos('readwrite').then(store => store.add(bloco));
}

export function deleteBloco(id: Bloco['id']) {
  return openBlocos('readwrite').then(store => store.delete(id));
}

export function updateBloco(bloco: Bloco) {
  return openBlocos('readwrite').then(store => store.put(bloco));
}
