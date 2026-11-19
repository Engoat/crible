import { castExpr, lit, num, q } from '../sql';
import { isNumeric, isTemporal } from '../types';
import type { ColumnInfo } from '../types';
import type { Rule } from './model';

/** Ce qu'il faut pour exécuter une règle : une relation, qui est évaluée, qui est en défaut. */
export interface Plan {
  from: string;
  evaluee: string;
  defaut: string;
  mesures: Record<string, string>;
  /** colonnes montrées dans l'échantillon (expressions SQL déjà prêtes) ; absent = pas d'échantillon */
  echantillon?: { alias: string; expr: string }[];
}

export class ColonneAbsente extends Error {
  constructor(public readonly colonne: string) {
    super(`Colonne absente : « ${colonne} »`);
  }
}

const normal = (s: string) => s.trim().toLowerCase();

export function findColumn(columns: ColumnInfo[], name: string): ColumnInfo | undefined {
  return columns.find((c) => c.name === name) ?? columns.find((c) => normal(c.name) === normal(name));
}

const FORMAT_TESTS: Record<string, (v: string) => string> = {
  email: (v) => `regexp_matches(trim(${v}), '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')`,
  telephone: (v) =>
    `(regexp_matches(trim(${v}), '^\\+?[0-9 .()-]{6,20}$') AND length(regexp_replace(${v}, '[^0-9]', '', 'g')) >= 6)`,
  code_postal_fr: (v) => `regexp_matches(trim(${v}), '^[0-9]{5}$')`,
  nombre: (v) => `TRY_CAST(replace(trim(${v}), ',', '.') AS DOUBLE) IS NOT NULL`,
};

const OPERATEURS: Record<string, string> = { '>=': '>=', '>': '>', '=': '=', '!=': '<>', '<=': '<=', '<': '<' };

function borne(value: string, type: ColumnInfo['type']): string {
  if (isNumeric(type)) return `CAST(${num(value)} AS DOUBLE)`;
  if (type.kind === 'date') return `CAST(${lit(value.trim())} AS DATE)`;
  return `CAST(${lit(value.trim())} AS TIMESTAMP)`;
}

export function buildPlan(rule: Rule, columns: ColumnInfo[]): Plan {
  const col = (name: string): ColumnInfo => {
    const found = findColumn(columns, name);
    if (!found) throw new ColonneAbsente(name);
    return found;
  };
  const typed = (name: string) => q(col(name).name);
  const sample = (names: string[], source: 'typed' | 'raw') =>
    names.map((n) => {
      const real = col(n).name;
      return { alias: real, expr: source === 'typed' ? `CAST(${q(real)} AS VARCHAR)` : q(real) };
    });

  switch (rule.type) {
    case 'non_vide': {
      const c = typed(rule.colonne);
      return {
        from: 'donnees',
        evaluee: 'TRUE',
        defaut: `${c} IS NULL`,
        mesures: { manquants: `count(*) FILTER (WHERE ${c} IS NULL)`, valeurs_distinctes: `count(DISTINCT ${c})` },
        echantillon: sample([rule.colonne], 'typed'),
      };
    }

    case 'unique': {
      if (rule.colonnes.length === 0) throw new Error('Choisis au moins une colonne.');
      const keys = rule.colonnes.map(typed);
      const present = keys.map((k) => `${k} IS NOT NULL`).join(' AND ');
      const tuple = keys.length === 1 ? keys[0] : `(${keys.join(', ')})`;
      return {
        from: `(SELECT _ligne, ${keys.join(', ')}, count(*) OVER (PARTITION BY ${keys.join(', ')}) AS _n FROM donnees WHERE ${present}) t`,
        evaluee: 'TRUE',
        defaut: '_n > 1',
        mesures: { valeurs_repetees: `count(DISTINCT ${tuple}) FILTER (WHERE _n > 1)` },
        echantillon: sample(rule.colonnes, 'typed'),
      };
    }

    case 'plage': {
      const info = col(rule.colonne);
      if (!isNumeric(info.type) && !isTemporal(info.type)) {
        throw new Error('La plage s\'applique à une colonne numérique ou à une date.');
      }
      if (!rule.min?.trim() && !rule.max?.trim()) throw new Error('Renseigne au moins une borne.');
      const c = q(info.name);
      const conditions: string[] = [];
      if (rule.min?.trim()) conditions.push(`${c} ${rule.minExclu ? '<=' : '<'} ${borne(rule.min, info.type)}`);
      if (rule.max?.trim()) conditions.push(`${c} ${rule.maxExclu ? '>=' : '>'} ${borne(rule.max, info.type)}`);
      return {
        from: 'donnees',
        evaluee: `${c} IS NOT NULL`,
        defaut: conditions.join(' OR '),
        mesures: { minimum_observe: `CAST(min(${c}) AS VARCHAR)`, maximum_observe: `CAST(max(${c}) AS VARCHAR)` },
        echantillon: sample([rule.colonne], 'typed'),
      };
    }

    case 'format': {
      const v = q(col(rule.colonne).name);
      let test: string;
      if (rule.format === 'date') test = `TRY_STRPTIME(trim(${v}), ${lit(rule.formatDate)}) IS NOT NULL`;
      else if (rule.format === 'motif') {
        if (!rule.motif) throw new Error('Saisis un motif (expression régulière).');
        test = `regexp_full_match(${v}, ${lit(rule.motif)})`;
      } else test = FORMAT_TESTS[rule.format](v);
      return {
        from: 'brut',
        evaluee: `${v} IS NOT NULL AND trim(${v}) <> ''`,
        defaut: `NOT (${test})`,
        mesures: { valeurs_invalides_distinctes: `count(DISTINCT ${v}) FILTER (WHERE NOT (${test}))` },
        echantillon: sample([rule.colonne], 'raw'),
      };
    }

    case 'valeurs_autorisees': {
      const v = q(col(rule.colonne).name);
      const values = rule.valeurs.map((s) => s.trim()).filter(Boolean);
      if (values.length === 0) throw new Error('Saisis au moins une valeur autorisée.');
      const list = values.map((s) => lit(rule.casse ? s : s.toLowerCase())).join(', ');
      const subject = rule.casse ? `trim(${v})` : `lower(trim(${v}))`;
      return {
        from: 'brut',
        evaluee: `${v} IS NOT NULL AND trim(${v}) <> ''`,
        defaut: `${subject} NOT IN (${list})`,
        mesures: { valeurs_hors_liste_distinctes: `count(DISTINCT ${v}) FILTER (WHERE ${subject} NOT IN (${list}))` },
        echantillon: sample([rule.colonne], 'raw'),
      };
    }

    case 'entre_colonnes': {
      if (!rule.colonneB) throw new Error('Choisis la seconde colonne.');
      const a = typed(rule.colonneA);
      const b = typed(rule.colonneB);
      const echantillon = sample([rule.colonneA, rule.colonneB], 'typed');
      if (rule.operateur === 'si_renseigne') {
        return { from: 'donnees', evaluee: `${a} IS NOT NULL`, defaut: `${b} IS NULL`, mesures: {}, echantillon };
      }
      return {
        from: 'donnees',
        evaluee: `${a} IS NOT NULL AND ${b} IS NOT NULL`,
        defaut: `NOT (${a} ${OPERATEURS[rule.operateur]} ${b})`,
        mesures: {},
        echantillon,
      };
    }

    case 'type': {
      const info = col(rule.colonne);
      const v = q(info.name);
      return {
        from: 'brut',
        evaluee: `${v} IS NOT NULL AND trim(${v}) <> ''`,
        defaut: `${castExpr(v, info.type)} IS NULL`,
        mesures: { valeurs_invalides_distinctes: `count(DISTINCT ${v}) FILTER (WHERE ${castExpr(v, info.type)} IS NULL)` },
        echantillon: sample([rule.colonne], 'raw'),
      };
    }

    case 'doublons': {
      const all = columns.map((c) => q(c.name));
      if (all.length === 0) throw new Error('Aucune colonne.');
      return {
        from: `(SELECT _ligne, ${all.join(', ')}, row_number() OVER (PARTITION BY ${all.join(', ')} ORDER BY _ligne) AS _rang FROM donnees) t`,
        evaluee: 'TRUE',
        defaut: '_rang > 1',
        mesures: {},
        echantillon: columns.map((c) => ({ alias: c.name, expr: `CAST(${q(c.name)} AS VARCHAR)` })),
      };
    }

    case 'aberrantes': {
      const info = col(rule.colonne);
      if (!isNumeric(info.type)) throw new Error('Les valeurs aberrantes s\'appliquent à une colonne numérique.');
      const c = q(info.name);
      const k = Number(rule.facteur);
      if (!Number.isFinite(k) || k <= 0) throw new Error('Le facteur doit être un nombre positif.');
      return {
        from: `(SELECT d._ligne, d.${c} AS ${c}, s.q1, s.q3 FROM donnees d CROSS JOIN (SELECT quantile_cont(${c}, 0.25) AS q1, quantile_cont(${c}, 0.75) AS q3 FROM donnees) s WHERE d.${c} IS NOT NULL) t`,
        evaluee: 'TRUE',
        defaut: `${c} < q1 - ${k} * (q3 - q1) OR ${c} > q3 + ${k} * (q3 - q1)`,
        mesures: {
          premier_quartile: 'CAST(any_value(q1) AS DOUBLE)',
          troisieme_quartile: 'CAST(any_value(q3) AS DOUBLE)',
          borne_basse: `CAST(any_value(q1 - ${k} * (q3 - q1)) AS DOUBLE)`,
          borne_haute: `CAST(any_value(q3 + ${k} * (q3 - q1)) AS DOUBLE)`,
        },
        echantillon: sample([rule.colonne], 'typed'),
      };
    }

    case 'non_constante': {
      const c = typed(rule.colonne);
      return {
        from: `(SELECT 0 AS _ligne, count(*) AS distincts, coalesce(sum(n), 0) AS total, coalesce(max(n), 0) AS top, CAST(arg_max(v, n) AS VARCHAR) AS dominante FROM (SELECT ${c} AS v, count(*) AS n FROM donnees WHERE ${c} IS NOT NULL GROUP BY 1)) t`,
        evaluee: 'total > 0',
        defaut: `distincts < ${Math.max(1, Math.floor(rule.minDistincts))} OR top * 1.0 / total > ${rule.partMax}`,
        mesures: {
          valeurs_distinctes: 'max(distincts)',
          valeur_dominante: 'max(dominante)',
          part_dominante: 'CAST(max(top) * 1.0 / nullif(max(total), 0) AS DOUBLE)',
        },
      };
    }

    case 'distribution': {
      const info = col(rule.colonne);
      const c = q(info.name);
      if (isNumeric(info.type)) {
        return {
          from: `(SELECT 0 AS _ligne, count(${c}) AS total, skewness(${c}) AS asym FROM donnees) t`,
          evaluee: 'total > 2 AND asym IS NOT NULL',
          defaut: `abs(asym) > ${rule.asymetrieMax}`,
          mesures: { asymetrie: 'CAST(max(asym) AS DOUBLE)' },
        };
      }
      return {
        from: `(SELECT 0 AS _ligne, coalesce(sum(n), 0) AS total, coalesce(max(n), 0) AS top, CAST(arg_max(v, n) AS VARCHAR) AS dominante FROM (SELECT ${c} AS v, count(*) AS n FROM donnees WHERE ${c} IS NOT NULL GROUP BY 1)) t`,
        evaluee: 'total > 0',
        defaut: `top * 1.0 / total > ${rule.partMax}`,
        mesures: {
          valeur_dominante: 'max(dominante)',
          part_dominante: 'CAST(max(top) * 1.0 / nullif(max(total), 0) AS DOUBLE)',
        },
      };
    }

    case 'texte_propre': {
      if (!rule.espaces && !rule.casse) throw new Error('Coche au moins un contrôle.');
      const v = q(col(rule.colonne).name);
      const parts: string[] = [];
      if (rule.espaces) parts.push(`v <> trim(v)`);
      if (rule.casse) parts.push('_formes > 1');
      return {
        from: `(SELECT _ligne, ${v} AS v, count(DISTINCT ${v}) OVER (PARTITION BY lower(trim(${v}))) AS _formes FROM brut WHERE ${v} IS NOT NULL AND trim(${v}) <> '') t`,
        evaluee: 'TRUE',
        defaut: parts.join(' OR '),
        mesures: {
          avec_espaces_parasites: `count(*) FILTER (WHERE v <> trim(v))`,
          valeurs_ecrites_de_plusieurs_facons: `count(DISTINCT lower(trim(v))) FILTER (WHERE _formes > 1)`,
        },
        echantillon: [{ alias: col(rule.colonne).name, expr: 'v' }],
      };
    }
  }
}
