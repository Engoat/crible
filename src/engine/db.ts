import * as duckdb from '@duckdb/duckdb-wasm';
import wasmMvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import workerMvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import wasmEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import workerEh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

// DuckDB-WASM tourne déjà dans son propre Web Worker : les requêtes sont asynchrones et
// l'interface reste fluide, sans couche de messages supplémentaire.
const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: wasmMvp, mainWorker: workerMvp },
  eh: { mainModule: wasmEh, mainWorker: workerEh },
};

interface Handle {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}

let opened: Promise<Handle> | null = null;

function open(): Promise<Handle> {
  opened ??= (async () => {
    const bundle = await duckdb.selectBundle(BUNDLES);
    const worker = new Worker(bundle.mainWorker as string);
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const conn = await db.connect();
    return { db, conn };
  })();
  return opened;
}

function normalize(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  return value;
}

// une seule requête à la fois sur la connexion
let tail: Promise<unknown> = Promise.resolve();

export function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const run = tail.then(async () => {
    const { conn } = await open();
    const table = await conn.query(sql);
    const rows = table.toArray() as Array<{ toJSON(): Record<string, unknown> }>;
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row.toJSON())) out[key] = normalize(value);
      return out as T;
    });
  });
  tail = run.catch(() => undefined);
  return run;
}

export async function exec(sql: string): Promise<void> {
  await query(sql);
}

export async function registerFileHandle(name: string, file: File): Promise<void> {
  const { db } = await open();
  await db.registerFileHandle(name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
}

export async function registerText(name: string, text: string): Promise<void> {
  const { db } = await open();
  await db.registerFileText(name, text);
}

export async function dropFile(name: string): Promise<void> {
  const { db } = await open();
  try {
    await db.dropFile(name);
  } catch {
    // le fichier n'était pas enregistré
  }
}
