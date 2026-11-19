import type { ColType } from './types';

export const q = (name: string): string => `"${name.replaceAll('"', '""')}"`;

export const lit = (text: string): string => `'${text.replaceAll("'", "''")}'`;

export function num(value: string): string {
  const n = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`« ${value} » n'est pas un nombre.`);
  return String(n);
}

// Convertit une valeur brute (texte) vers le type choisi ; NULL quand la conversion échoue.
export function castExpr(expr: string, type: ColType): string {
  const t = `trim(${expr})`;
  switch (type.kind) {
    case 'int':
      return `CASE WHEN regexp_matches(${t}, '^[+-]?[0-9]+$') THEN TRY_CAST(${t} AS BIGINT) END`;
    case 'double':
      return type.virgule
        ? `TRY_CAST(replace(${t}, ',', '.') AS DOUBLE)`
        : `TRY_CAST(${t} AS DOUBLE)`;
    case 'bool':
      return `CASE WHEN lower(${t}) IN ('true','vrai','oui','yes','1') THEN TRUE WHEN lower(${t}) IN ('false','faux','non','no','0') THEN FALSE END`;
    case 'date':
      return `CAST(TRY_STRPTIME(${t}, ${lit(type.format)}) AS DATE)`;
    case 'timestamp':
      return `TRY_STRPTIME(${t}, ${lit(type.format)})`;
    case 'text':
      return `CASE WHEN ${t} = '' THEN NULL ELSE ${expr} END`;
  }
}
