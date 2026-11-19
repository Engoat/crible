import type { RuleSet } from './ruleset';

const DB_NAME = 'crible';
const STORE = 'ensembles';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'nom' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const listRuleSets = async (): Promise<RuleSet[]> => {
  const all = await run('readonly', (s) => s.getAll() as IDBRequest<RuleSet[]>);
  return all.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
};

export const saveRuleSet = (set: RuleSet): Promise<IDBValidKey> => run('readwrite', (s) => s.put(set));

export const deleteRuleSet = (nom: string): Promise<undefined> => run('readwrite', (s) => s.delete(nom));
