import { query } from '../db';
import { findColumn } from '../rules/build';
import { lit, q } from '../sql';
import { isNumeric, isTemporal } from '../types';
import type { ColumnInfo } from '../types';
import type { MlFinding, MlResult, MlRoles } from './model';
import { chi2Independance, contingence, cramerV, ksPValue } from './stats';

export type MlProgress = (message: string) => void;

const MAX_CATEGORIES = 50;
const MAX_CLASSES_NUMERIC_TARGET = 10;
const MAX_NUMERIC_FOR_PAIRS = 60;
const MAX_CATEGORICAL_FOR_PAIRS = 15;

interface Feat {
  name: string;
  kind: 'num' | 'cat';
  /** expression SQL : un nombre pour `num`, une étiquette pour `cat` */
  expr: string;
}

function numExpr(col: ColumnInfo): string {
  const c = q(col.name);
  if (col.type.kind === 'date') return `epoch(CAST(${c} AS TIMESTAMP))`;
  if (col.type.kind === 'timestamp') return `epoch(${c})`;
  return `CAST(${c} AS DOUBLE)`;
}

async function distinctCounts(cols: ColumnInfo[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (cols.length === 0) return out;
  const [row] = await query<Record<string, number>>(
    `SELECT ${cols.map((c, i) => `approx_count_distinct(${q(c.name)}) AS d${i}`).join(', ')} FROM donnees`,
  );
  cols.forEach((c, i) => out.set(c.name, Number(row[`d${i}`])));
  return out;
}

async function classify(cols: ColumnInfo[], notes: string[]): Promise<Feat[]> {
  const texts = cols.filter((c) => c.type.kind === 'text');
  const counts = await distinctCounts(texts);
  const feats: Feat[] = [];
  const skipped: string[] = [];
  for (const c of cols) {
    if (isNumeric(c.type) || isTemporal(c.type)) feats.push({ name: c.name, kind: 'num', expr: numExpr(c) });
    else if (c.type.kind === 'bool') feats.push({ name: c.name, kind: 'cat', expr: `CAST(${q(c.name)} AS VARCHAR)` });
    else if ((counts.get(c.name) ?? 0) <= MAX_CATEGORIES) feats.push({ name: c.name, kind: 'cat', expr: q(c.name) });
    else skipped.push(c.name);
  }
  if (skipped.length > 0) {
    notes.push(`${skipped.length} colonne(s) texte à plus de ${MAX_CATEGORIES} valeurs ignorée(s) : ${skipped.join(', ')}.`);
  }
  return feats;
}

/* ------------------------------------------------------------- associations */

async function spearman(a: Feat, b: Feat): Promise<number | null> {
  const [row] = await query<{ v: number | null }>(
    `SELECT corr(ra, rb) AS v FROM (
       SELECT rank() OVER (ORDER BY x) + (count(*) OVER (PARTITION BY x) - 1) / 2.0 AS ra,
              rank() OVER (ORDER BY y) + (count(*) OVER (PARTITION BY y) - 1) / 2.0 AS rb
       FROM (SELECT ${a.expr} AS x, ${b.expr} AS y FROM donnees WHERE ${a.expr} IS NOT NULL AND ${b.expr} IS NOT NULL))`,
  );
  return row.v;
}

async function eta(cat: Feat, num: Feat): Promise<number | null> {
  const [row] = await query<{ v: number | null }>(
    `WITH base AS (SELECT ${cat.expr} AS g, ${num.expr} AS x FROM donnees WHERE ${cat.expr} IS NOT NULL AND ${num.expr} IS NOT NULL),
          t AS (SELECT avg(x) AS gm FROM base),
          grp AS (SELECT g, count(*) AS n, avg(x) AS m FROM base GROUP BY g)
     SELECT sqrt(coalesce((SELECT sum(n * (m - gm) * (m - gm)) FROM grp, t), 0)
                 / nullif((SELECT sum((x - gm) * (x - gm)) FROM base, t), 0)) AS v`,
  );
  return row.v;
}

async function cramer(a: Feat, b: Feat): Promise<number | null> {
  const cells = await query<{ a: string; b: string; n: number }>(
    `SELECT CAST(${a.expr} AS VARCHAR) AS a, CAST(${b.expr} AS VARCHAR) AS b, count(*) AS n
     FROM donnees WHERE ${a.expr} IS NOT NULL AND ${b.expr} IS NOT NULL GROUP BY 1, 2`,
  );
  return cramerV(contingence(cells.map((c) => ({ a: String(c.a), b: String(c.b), n: Number(c.n) }))));
}

async function association(a: Feat, b: Feat): Promise<{ valeur: number; methode: string } | null> {
  let v: number | null;
  let methode: string;
  if (a.kind === 'num' && b.kind === 'num') {
    v = await spearman(a, b);
    methode = 'corrélation de Spearman';
  } else if (a.kind === 'cat' && b.kind === 'cat') {
    v = await cramer(a, b);
    methode = 'V de Cramér';
  } else {
    v = await eta(a.kind === 'cat' ? a : b, a.kind === 'num' ? a : b);
    methode = 'rapport de corrélation η';
  }
  return v === null || Number.isNaN(v) ? null : { valeur: v, methode };
}

/* ------------------------------------------------------------- les quatre contrôles */

async function desequilibre(cible: ColumnInfo, notes: string[]) {
  const [{ d }] = await query<{ d: number }>(`SELECT approx_count_distinct(${q(cible.name)}) AS d FROM donnees`);
  const distincts = Number(d);
  if (distincts > MAX_CATEGORIES || (isNumeric(cible.type) && distincts > MAX_CLASSES_NUMERIC_TARGET && cible.type.kind === 'double')) {
    notes.push('La cible compte trop de valeurs pour être des classes : le déséquilibre n\'est pas calculé.');
    return null;
  }
  const classes = (
    await query<{ v: string; n: number }>(
      `SELECT CAST(${q(cible.name)} AS VARCHAR) AS v, count(*) AS n FROM donnees WHERE ${q(cible.name)} IS NOT NULL GROUP BY 1 ORDER BY n DESC`,
    )
  ).map((r) => ({ valeur: String(r.v), n: Number(r.n) }));
  if (classes.length < 2) return { classes, ratio: null, signale: false };
  const ratio = classes[classes.length - 1].n / classes[0].n;
  return { classes, ratio, signale: false };
}

export async function runMl(roles: MlRoles, columns: ColumnInfo[], progress: MlProgress): Promise<MlResult> {
  const notes: string[] = [];
  const result: MlResult = { desequilibre: null, fuite: [], redondance: [], ecart: [], avertissements: notes };
  const { seuils } = roles;

  const cible = roles.cible ? findColumn(columns, roles.cible) : undefined;
  const sep = roles.separation ? findColumn(columns, roles.separation.colonne) : undefined;
  if (roles.cible && !cible) notes.push(`Colonne cible absente : « ${roles.cible} ».`);
  if (roles.separation && !sep) notes.push(`Colonne de séparation absente : « ${roles.separation.colonne} ».`);

  const retenues = columns.filter((c) => c.name !== cible?.name && c.name !== sep?.name);
  progress('Classement des colonnes…');
  const features = await classify(retenues, notes);

  /* 1. déséquilibre de la cible */
  if (cible) {
    progress('Déséquilibre de la cible…');
    const d = await desequilibre(cible, notes);
    if (d) result.desequilibre = { ...d, signale: d.ratio !== null && d.ratio < seuils.desequilibre };
  }

  /* 2. fuite de cible */
  if (cible) {
    const [target] = await classify([cible], notes);
    let t = target;
    if (t && isNumeric(cible.type) && cible.type.kind === 'int') {
      const [{ d }] = await query<{ d: number }>(`SELECT approx_count_distinct(${q(cible.name)}) AS d FROM donnees`);
      if (Number(d) <= MAX_CLASSES_NUMERIC_TARGET) t = { name: cible.name, kind: 'cat', expr: `CAST(${q(cible.name)} AS VARCHAR)` };
    }
    if (t) {
      let i = 0;
      for (const f of features) {
        progress(`Fuite de cible… ${++i} / ${features.length} colonnes`);
        const a = await association(t, f);
        if (a) {
          result.fuite.push({
            colonnes: [f.name],
            methode: a.methode,
            valeur: a.valeur,
            signale: Math.abs(a.valeur) >= seuils.fuite,
            p: null,
            detail: null,
          });
        }
      }
      result.fuite.sort((x, y) => Math.abs(y.valeur) - Math.abs(x.valeur));
    }
  }

  /* 3. colonnes redondantes */
  {
    const nums = features.filter((f) => f.kind === 'num').slice(0, MAX_NUMERIC_FOR_PAIRS);
    const cats = features.filter((f) => f.kind === 'cat').slice(0, MAX_CATEGORICAL_FOR_PAIRS);
    if (features.filter((f) => f.kind === 'num').length > nums.length) {
      notes.push(`Redondance : seules les ${MAX_NUMERIC_FOR_PAIRS} premières colonnes numériques sont comparées.`);
    }
    if (features.filter((f) => f.kind === 'cat').length > cats.length) {
      notes.push(`Redondance : seules les ${MAX_CATEGORICAL_FOR_PAIRS} premières colonnes catégorielles sont comparées.`);
    }
    const pairs: [Feat, Feat][] = [];
    for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) pairs.push([nums[i], nums[j]]);
    const BATCH = 100;
    for (let s = 0; s < pairs.length; s += BATCH) {
      progress(`Redondance (numériques)… ${Math.min(s + BATCH, pairs.length)} / ${pairs.length} paires`);
      const group = pairs.slice(s, s + BATCH);
      const [row] = await query<Record<string, number | null>>(
        `SELECT ${group.map(([a, b], k) => `corr(${a.expr}, ${b.expr}) AS c${k}`).join(', ')} FROM donnees`,
      );
      group.forEach(([a, b], k) => {
        const v = row[`c${k}`];
        if (typeof v === 'number' && Math.abs(v) >= seuils.redondance) {
          result.redondance.push({ colonnes: [a.name, b.name], methode: 'corrélation de Pearson', valeur: v, signale: true, p: null, detail: null });
        }
      });
    }
    const catPairs: [Feat, Feat][] = [];
    for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) catPairs.push([cats[i], cats[j]]);
    let k = 0;
    for (const [a, b] of catPairs) {
      progress(`Redondance (catégorielles)… ${++k} / ${catPairs.length} paires`);
      const v = await cramer(a, b);
      if (v !== null && v >= seuils.redondance) {
        result.redondance.push({ colonnes: [a.name, b.name], methode: 'V de Cramér', valeur: v, signale: true, p: null, detail: null });
      }
    }
    result.redondance.sort((x, y) => Math.abs(y.valeur) - Math.abs(x.valeur));
    notes.push(`Redondance : ${pairs.length + catPairs.length} paires examinées.`);
  }

  /* 4. écart entre entraînement et test */
  if (sep && roles.separation) {
    const { entrainement, test } = roles.separation;
    const sepText = `CAST(${q(sep.name)} AS VARCHAR)`;
    const groupe = `CASE WHEN ${sepText} = ${lit(entrainement)} THEN 1 WHEN ${sepText} = ${lit(test)} THEN 2 END`;
    const [{ na, nb }] = await query<{ na: number; nb: number }>(
      `SELECT count(*) FILTER (WHERE ${groupe} = 1) AS na, count(*) FILTER (WHERE ${groupe} = 2) AS nb FROM donnees`,
    );
    if (Number(na) === 0 || Number(nb) === 0) {
      notes.push(`Écart : « ${entrainement} » compte ${na} ligne(s) et « ${test} » ${nb} : comparaison impossible.`);
    } else {
      const cibleFeat = cible ? await classify([cible], []) : [];
      const toCompare = [...cibleFeat, ...features];
      let i = 0;
      for (const f of toCompare) {
        progress(`Écart entraînement / test… ${++i} / ${toCompare.length} colonnes`);
        let finding: MlFinding | null = null;
        if (f.kind === 'num') {
          const [r] = await query<{ d: number | null; na: number; nb: number }>(
            `WITH v AS (SELECT ${f.expr} AS x, ${groupe} AS g FROM donnees WHERE ${f.expr} IS NOT NULL),
                  w AS (SELECT x, count(*) FILTER (WHERE g = 1) AS da, count(*) FILTER (WHERE g = 2) AS db FROM v WHERE g IS NOT NULL GROUP BY x),
                  tot AS (SELECT sum(da) AS na, sum(db) AS nb FROM w),
                  c AS (SELECT x, sum(da) OVER (ORDER BY x) AS ca, sum(db) OVER (ORDER BY x) AS cb FROM w)
             SELECT max(abs(ca * 1.0 / na - cb * 1.0 / nb)) AS d, any_value(na) AS na, any_value(nb) AS nb FROM c, tot`,
          );
          if (r.d !== null && Number(r.na) > 0 && Number(r.nb) > 0) {
            finding = {
              colonnes: [f.name],
              methode: 'statistique D de Kolmogorov-Smirnov',
              valeur: r.d,
              signale: r.d >= seuils.ecart,
              p: ksPValue(r.d, Number(r.na), Number(r.nb)),
              detail: `${Number(r.na)} lignes d'entraînement, ${Number(r.nb)} de test`,
            };
          }
        } else {
          const cells = await query<{ a: string; b: string; n: number }>(
            `SELECT CAST(g AS VARCHAR) AS a, CAST(x AS VARCHAR) AS b, count(*) AS n
             FROM (SELECT ${f.expr} AS x, ${groupe} AS g FROM donnees WHERE ${f.expr} IS NOT NULL) WHERE g IS NOT NULL GROUP BY 1, 2`,
          );
          const table = contingence(cells.map((c) => ({ a: String(c.a), b: String(c.b), n: Number(c.n) })));
          if (table.lignes.length === 2 && table.colonnes.length >= 2) {
            const chi = chi2Independance(table);
            const v = Math.sqrt(chi.statistique / chi.total);
            finding = {
              colonnes: [f.name],
              methode: 'V de Cramér (test du χ²)',
              valeur: v,
              signale: v >= seuils.ecart,
              p: chi.p,
              detail: `${table.colonnes.length} modalités`,
            };
          }
        }
        if (finding) result.ecart.push(finding);
      }
      result.ecart.sort((x, y) => y.valeur - x.valeur);
    }
  }
  return result;
}

export async function distinctValues(column: string): Promise<string[]> {
  const rows = await query<{ v: string }>(
    `SELECT DISTINCT CAST(${q(column)} AS VARCHAR) AS v FROM donnees WHERE ${q(column)} IS NOT NULL ORDER BY 1 LIMIT 51`,
  );
  return rows.map((r) => String(r.v));
}
