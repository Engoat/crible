import { query } from '../db';
import { q } from '../sql';
import type { ColumnInfo } from '../types';
import { buildPlan, findColumn } from './build';
import { refColumns, ruleTypeInfo } from './model';
import type { Rule, RuleResult } from './model';

const SAMPLE_SIZE = 50;

export function absentColumns(rule: Rule, columns: ColumnInfo[]): string[] {
  return refColumns(rule).filter((name) => name && !findColumn(columns, name));
}

export async function runRule(rule: Rule, columns: ColumnInfo[]): Promise<RuleResult> {
  const info = ruleTypeInfo(rule.type);
  const empty: RuleResult = {
    ruleId: rule.id,
    verdict: 'erreur',
    evaluees: 0,
    enDefaut: 0,
    part: 0,
    global: Boolean(info.global),
    mesures: [],
    colonnesEchantillon: [],
    echantillon: [],
  };
  try {
    const plan = buildPlan(rule, columns);
    const measures = Object.entries(plan.mesures).map(([k, expr]) => `${expr} AS ${q('m_' + k)}`);
    const [row] = await query<Record<string, unknown>>(
      `SELECT count(*) FILTER (WHERE ${plan.evaluee}) AS evaluees, count(*) FILTER (WHERE (${plan.evaluee}) AND (${plan.defaut})) AS en_defaut${
        measures.length ? ', ' + measures.join(', ') : ''
      } FROM ${plan.from}`,
    );
    const evaluees = Number(row.evaluees);
    const enDefaut = Number(row.en_defaut);
    const part = evaluees > 0 ? enDefaut / evaluees : 0;
    const tolerance = info.global ? 0 : (rule as { tolerance: number }).tolerance;

    let echantillon: Record<string, string | null>[] = [];
    let colonnesEchantillon: string[] = [];
    if (plan.echantillon && enDefaut > 0) {
      colonnesEchantillon = plan.echantillon.map((c) => c.alias);
      const select = plan.echantillon.map((c) => `${c.expr} AS ${q(c.alias)}`).join(', ');
      const rows = await query<Record<string, unknown>>(
        `SELECT _ligne, ${select} FROM ${plan.from} WHERE (${plan.evaluee}) AND (${plan.defaut}) ORDER BY _ligne LIMIT ${SAMPLE_SIZE}`,
      );
      echantillon = rows.map((r) => {
        const out: Record<string, string | null> = { _ligne: String(r._ligne) };
        for (const alias of colonnesEchantillon) out[alias] = r[alias] === null || r[alias] === undefined ? null : String(r[alias]);
        return out;
      });
    }

    return {
      ...empty,
      verdict: part <= tolerance && !(info.global && enDefaut > 0) ? 'reussie' : 'echouee',
      evaluees,
      enDefaut,
      part,
      mesures: Object.keys(plan.mesures).map((k) => {
        const v = row['m_' + k];
        return { nom: k, valeur: v === null || v === undefined ? null : typeof v === 'number' ? v : String(v) };
      }),
      colonnesEchantillon,
      echantillon,
    };
  } catch (e) {
    return { ...empty, erreur: e instanceof Error ? e.message : String(e) };
  }
}

export interface DefectPage {
  colonnes: string[];
  lignes: Record<string, string | null>[];
}

/** Lignes en défaut d'une règle, par pages, pour l'écran « lignes fautives ». */
export async function fetchDefects(rule: Rule, columns: ColumnInfo[], offset: number, limit: number): Promise<DefectPage> {
  const plan = buildPlan(rule, columns);
  if (!plan.echantillon) return { colonnes: [], lignes: [] };
  const colonnes = plan.echantillon.map((c) => c.alias);
  const select = plan.echantillon.map((c) => `${c.expr} AS ${q(c.alias)}`).join(', ');
  const rows = await query<Record<string, unknown>>(
    `SELECT _ligne, ${select} FROM ${plan.from} WHERE (${plan.evaluee}) AND (${plan.defaut}) ORDER BY _ligne LIMIT ${limit} OFFSET ${offset}`,
  );
  return {
    colonnes,
    lignes: rows.map((r) => {
      const out: Record<string, string | null> = { _ligne: String(r._ligne) };
      for (const alias of colonnes) out[alias] = r[alias] === null || r[alias] === undefined ? null : String(r[alias]);
      return out;
    }),
  };
}
