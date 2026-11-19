import type { WorkBook, ParsingOptions } from 'xlsx';
import { dropFile, exec, query, registerFileHandle, registerText } from './db';
import { castExpr, lit, q } from './sql';
import type { ColType, ColumnInfo, Dataset } from './types';

const FICHIER = 'donnees_importees.csv';

export type Progress = (message: string) => void;

/* ---------------------------------------------------------------- Excel */

let cache: { file: File; workbook: WorkBook } | null = null;

async function workbook(file: File): Promise<WorkBook> {
  if (cache?.file === file) return cache.workbook;
  const XLSX = await import('xlsx');
  const options: ParsingOptions = { type: 'array', cellDates: true, dense: true };
  const wb = XLSX.read(await file.arrayBuffer(), options);
  cache = { file, workbook: wb };
  return wb;
}

export const isExcel = (file: File): boolean => /\.(xlsx|xlsm|xls)$/i.test(file.name);

export async function sheetNames(file: File): Promise<string[]> {
  return (await workbook(file)).SheetNames;
}

const two = (n: number) => String(n).padStart(2, '0');

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // SheetJS construit la date pour que les composantes locales soient celles affichées dans la cellule
    const day = `${value.getFullYear()}-${two(value.getMonth() + 1)}-${two(value.getDate())}`;
    const time = `${two(value.getHours())}:${two(value.getMinutes())}:${two(value.getSeconds())}`;
    return time === '00:00:00' ? day : `${day} ${time}`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

const csvField = (text: string): string =>
  /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

async function excelAsCsv(file: File, sheet: string): Promise<string> {
  const XLSX = await import('xlsx');
  const sheetData = (await workbook(file)).Sheets[sheet];
  if (!sheetData) throw new Error(`La feuille « ${sheet} » est introuvable.`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheetData, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  if (rows.length === 0) throw new Error('La feuille est vide.');
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const seen = new Map<string, number>();
  const header = Array.from({ length: width }, (_, i) => {
    const base = cellText(rows[0][i]).trim() || `colonne_${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
  const lines = [header.map(csvField).join(',')];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const cells: string[] = [];
    for (let c = 0; c < width; c++) cells.push(csvField(cellText(row[c])));
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

/* ---------------------------------------------------------------- CSV */

async function isUtf8(file: File): Promise<boolean> {
  const bytes = await file.slice(0, 1 << 20).arrayBuffer();
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true });
    return true;
  } catch {
    return false;
  }
}

async function registerCsv(file: File): Promise<void> {
  if (await isUtf8(file)) {
    await registerFileHandle(FICHIER, file);
    return;
  }
  // encodage Windows-1252 : on transcode en UTF-8 avant de donner le texte à DuckDB
  const text = new TextDecoder('windows-1252').decode(await file.arrayBuffer());
  await registerText(FICHIER, text);
}

async function createBrut(): Promise<boolean> {
  let args = 'header=true';
  let hasHeader = true;
  try {
    const [s] = await query<{ Delimiter: string; Quote: string; HasHeader: boolean; SkipRows: number }>(
      `SELECT Delimiter, Quote, HasHeader, SkipRows FROM sniff_csv(${lit(FICHIER)})`,
    );
    hasHeader = Boolean(s.HasHeader);
    const quote = s.Quote === '(empty)' ? '' : s.Quote;
    args = `delim=${lit(s.Delimiter)}, quote=${lit(quote)}, header=${hasHeader}, skip=${Number(s.SkipRows)}`;
  } catch {
    // l'analyse automatique a échoué : on lit avec les réglages par défaut
  }
  await exec(
    `CREATE TABLE brut AS SELECT row_number() OVER () AS _ligne, * FROM read_csv(${lit(FICHIER)}, ${args}, all_varchar=true, null_padding=true)`,
  );
  return hasHeader;
}

/* ---------------------------------------------------------------- types */

const DATE_FORMATS = ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y'];
const TS_FORMATS = ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M'];
const SAMPLE = 50_000;
const SHARE = 0.9;
const DATE_LIKE = `^[0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4}([ T][0-9]{1,2}:[0-9]{2}(:[0-9]{2})?)?$`;

// première passe : sondes peu coûteuses, pour toutes les colonnes
function probe(name: string, i: number): string {
  const t = `trim(${q(name)})`;
  return [
    `count(*) FILTER (WHERE ${t} <> '') AS n${i}`,
    `count(*) FILTER (WHERE regexp_matches(${t}, '^[+-]?[0-9]+$')) AS i${i}`,
    `count(TRY_CAST(${t} AS DOUBLE)) AS d${i}`,
    `count(TRY_CAST(replace(${t}, ',', '.') AS DOUBLE)) AS c${i}`,
    `count(*) FILTER (WHERE lower(${t}) IN ('true','false','vrai','faux','oui','non','yes','no')) AS b${i}`,
    `count(*) FILTER (WHERE regexp_matches(${t}, '^0[0-9]+$')) AS z${i}`,
    `count(*) FILTER (WHERE regexp_matches(${t}, '^[+-]?[0-9]*[.][0-9]+$')) AS p${i}`,
    `count(*) FILTER (WHERE regexp_matches(${t}, '^[+-]?[0-9]*,[0-9]+$')) AS v${i}`,
    `count(*) FILTER (WHERE regexp_matches(${t}, '${DATE_LIKE}')) AS dl${i}`,
  ].join(', ');
}

// seconde passe, seulement pour les colonnes qui ressemblent à des dates
function probeDates(name: string, i: number): string {
  const t = `trim(${q(name)})`;
  return [
    ...DATE_FORMATS.map((f, k) => `count(TRY_STRPTIME(${t}, ${lit(f)})) AS date${k}_${i}`),
    ...TS_FORMATS.map((f, k) => `count(TRY_STRPTIME(${t}, ${lit(f)})) AS ts${k}_${i}`),
  ].join(', ');
}

function decide(r: Record<string, number>, i: number): ColType | 'date?' {
  const n = r[`n${i}`];
  if (!n) return { kind: 'text' };
  const ok = (count: number) => count / n >= SHARE;
  if (ok(r[`b${i}`])) return { kind: 'bool' };
  if (r[`z${i}`] / n >= 0.05) return { kind: 'text' };
  // des décimaux, même rares, font un décimal ; un seul « 3.5 » égaré dans des entiers reste un entier
  // (la règle « type respecté » le trouvera)
  const point = r[`p${i}`];
  const virgule = r[`v${i}`];
  if ((point + virgule) / n >= 0.01) {
    if (virgule > point && ok(r[`c${i}`])) return { kind: 'double', virgule: true };
    if (point >= virgule && ok(r[`d${i}`])) return { kind: 'double', virgule: false };
  }
  if (ok(r[`i${i}`])) return { kind: 'int' };
  if (ok(r[`d${i}`])) return { kind: 'double', virgule: false };
  if (ok(r[`c${i}`]) && r[`d${i}`] / n < 0.5) return { kind: 'double', virgule: true };
  if (ok(r[`dl${i}`])) return 'date?';
  return { kind: 'text' };
}

function decideDate(r: Record<string, number>, i: number, n: number): ColType {
  const ok = (count: number) => count / n >= SHARE;
  for (let k = 0; k < TS_FORMATS.length; k++) {
    if (ok(r[`ts${k}_${i}`])) return { kind: 'timestamp', format: TS_FORMATS[k] };
  }
  for (let k = 0; k < DATE_FORMATS.length; k++) {
    if (ok(r[`date${k}_${i}`])) return { kind: 'date', format: DATE_FORMATS[k] };
  }
  return { kind: 'text' };
}

async function inferTypes(names: string[], progress: Progress): Promise<ColumnInfo[]> {
  const BATCH = 20;
  const sample = `(SELECT * FROM brut LIMIT ${SAMPLE})`;
  const decided: (ColType | 'date?')[] = [];
  const counts: number[] = [];
  for (let start = 0; start < names.length; start += BATCH) {
    progress(`Détection des types… ${Math.min(start + BATCH, names.length)} / ${names.length} colonnes`);
    const group = names.slice(start, start + BATCH);
    const [row] = await query<Record<string, number>>(
      `SELECT ${group.map((name, i) => probe(name, i)).join(', ')} FROM ${sample}`,
    );
    group.forEach((_, i) => {
      decided.push(decide(row, i));
      counts.push(row[`n${i}`]);
    });
  }
  const dates = names.map((_, k) => k).filter((k) => decided[k] === 'date?');
  for (let start = 0; start < dates.length; start += BATCH) {
    progress('Détection des dates…');
    const group = dates.slice(start, start + BATCH);
    const [row] = await query<Record<string, number>>(
      `SELECT ${group.map((k, i) => probeDates(names[k], i)).join(', ')} FROM ${sample}`,
    );
    group.forEach((k, i) => {
      decided[k] = decideDate(row, i, counts[k]);
    });
  }
  return names.map((name, k) => ({ name, type: decided[k] === 'date?' ? { kind: 'text' } : decided[k] }));
}

/* ---------------------------------------------------------------- vue typée */

export async function applyTypes(columns: ColumnInfo[]): Promise<void> {
  const cols = columns.map((c) => `${castExpr(q(c.name), c.type)} AS ${q(c.name)}`);
  await exec(`CREATE OR REPLACE VIEW donnees AS SELECT _ligne, ${cols.join(', ')} FROM brut`);
}

async function reset(): Promise<void> {
  await exec('DROP VIEW IF EXISTS donnees');
  await exec('DROP TABLE IF EXISTS brut');
  await dropFile(FICHIER);
}

/* ---------------------------------------------------------------- chargement */

export async function loadFile(file: File, sheet: string | null, progress: Progress): Promise<Dataset> {
  const started = performance.now();
  await reset();

  progress('Lecture du fichier…');
  let usedSheet: string | null = null;
  if (isExcel(file)) {
    usedSheet = sheet ?? (await sheetNames(file))[0];
    await registerText(FICHIER, await excelAsCsv(file, usedSheet));
  } else {
    await registerCsv(file);
  }

  progress('Analyse de la structure…');
  const hasHeader = await createBrut();
  const [{ n }] = await query<{ n: number }>('SELECT count(*) AS n FROM brut');
  const names = (
    await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'brut' AND column_name <> '_ligne' ORDER BY ordinal_position`,
    )
  ).map((r) => r.column_name);

  const columns = await inferTypes(names, progress);
  progress('Préparation des données…');
  await applyTypes(columns);

  return {
    fileName: file.name,
    sheet: usedSheet,
    rows: n,
    columns,
    hasHeader,
    loadMs: performance.now() - started,
  };
}

export async function examples(column: string): Promise<string[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${q(column)} AS v FROM brut WHERE ${q(column)} IS NOT NULL AND trim(${q(column)}) <> '' LIMIT 10`,
  );
  return rows.map((r) => String(r.v));
}
