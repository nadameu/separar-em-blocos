import { assert, isAnyOf, isUndefined, NonEmptyString, NonNegativeInteger } from './lib/predicates';
import { Bloco, isBloco, isIdBloco } from './types/Bloco';

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.addEventListener('error', onError);
    req.addEventListener('success', onSuccess);

    function onError() {
      rej(req.error);
      removeEventListeners();
    }

    function onSuccess() {
      res(req.result);
      removeEventListeners();
    }

    function removeEventListeners() {
      req.addEventListener('error', onError);
      req.addEventListener('success', onSuccess);
    }
  });
}

export function open() {
  const req = indexedDB.open('gm-blocos', 4);
  req.addEventListener('upgradeneeded', onUpgradeNeeded);

  return promisifyRequest(req).finally(() => {
    req.removeEventListener('upgradeneeded', onUpgradeNeeded);
  });

  function onUpgradeNeeded({ oldVersion }: IDBVersionChangeEvent) {
    const db = req.result;
    const transaction = req.transaction!;
    let store: IDBObjectStore;
    if (oldVersion < 1) {
      store = db.createObjectStore('blocos', { keyPath: 'id' });
    } else {
      store = transaction.objectStore('blocos');
    }
    if (oldVersion < 2) {
      store.createIndex('nome', ['nome'], { unique: true });
    }
    if (oldVersion < 3) {
      store.deleteIndex('nome');
      store.createIndex('nome', 'nome', { unique: true });
    }
    if (oldVersion < 4) {
      store.createIndex('processos', 'processos', { multiEntry: true });
    }
  }
}

async function makeRequest<T>(
  mode: 'readonly' | 'readwrite',
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return promisifyRequest(createRequest(db.transaction('blocos', mode).objectStore('blocos')));
}

export function deleteBlocos() {
  return promisifyRequest(indexedDB.deleteDatabase('gm-blocos'));
}

export async function getBlocos() {
  const blocos = await makeRequest('readonly', (store) => store.getAll());
  assert(blocos.every(isBloco), 'Formato do banco de dados desconhecido.');
  return blocos.sort((a, b) => {
    const [c, d] = [a, b].map((x) => x.nome) as [NonEmptyString, NonEmptyString];
    const [e, f] = [c, d].map((x) => x.toLowerCase()) as [NonEmptyString, NonEmptyString];
    if (e < f) return -1;
    if (e > f) return +1;
    if (c < d) return -1;
    if (c > d) return +1;
    throw new Error(`Há dois blocos com o mesmo nome: ${JSON.stringify(c)}.`);
  });
}

export async function getBloco(id: NonNegativeInteger) {
  const bloco = await makeRequest('readonly', (store) => store.get(id));
  assert(isAnyOf(isBloco, isUndefined)(bloco));
  return bloco;
}

export function createBloco(bloco: Bloco) {
  return writeBloco('add', bloco);
}

export async function deleteBloco(id: Bloco['id']) {
  await makeRequest('readwrite', (store) => store.delete(id));
}

export function updateBloco(bloco: Bloco) {
  return writeBloco('put', bloco);
}

async function writeBloco(method: 'add' | 'put', bloco: Bloco) {
  const result = await makeRequest('readwrite', (store) => store[method](bloco));
  assert(isIdBloco(result));
  return result;
}
