import { RULE_TYPES } from '../engine/rules/model';
import type { Rule } from '../engine/rules/model';
import { ROLES_VIDES, SEUILS_DEFAUT } from '../engine/ml/model';
import type { MlRoles } from '../engine/ml/model';

export const FORMAT = 'crible/regles';
export const VERSION = 1;

export interface RuleSet {
  format: typeof FORMAT;
  version: typeof VERSION;
  nom: string;
  regles: Rule[];
  roles?: MlRoles;
}

export function makeRuleSet(nom: string, regles: Rule[], roles?: MlRoles): RuleSet {
  return { format: FORMAT, version: VERSION, nom, regles, roles };
}

function cleanRoles(value: unknown): MlRoles {
  const r = (value ?? {}) as Partial<MlRoles>;
  const sep = r.separation;
  return {
    cible: typeof r.cible === 'string' ? r.cible : null,
    separation:
      sep && typeof sep.colonne === 'string' && typeof sep.entrainement === 'string' && typeof sep.test === 'string'
        ? { colonne: sep.colonne, entrainement: sep.entrainement, test: sep.test }
        : null,
    seuils: { ...SEUILS_DEFAUT, ...(r.seuils ?? {}) },
  };
}

export function parseRuleSet(text: string): RuleSet {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n\'est pas du JSON valide.');
  }
  const obj = data as Partial<RuleSet> | null;
  if (!obj || obj.format !== FORMAT) throw new Error('Ce fichier n\'est pas un ensemble de règles Crible.');
  if (obj.version !== VERSION) throw new Error(`Version ${String(obj.version)} non prise en charge.`);
  if (typeof obj.nom !== 'string' || !Array.isArray(obj.regles)) throw new Error('Ensemble de règles incomplet.');
  const known = new Set(RULE_TYPES.map((t) => t.type));
  for (const r of obj.regles) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !known.has(r.type)) {
      throw new Error('Une règle de l\'ensemble est invalide.');
    }
  }
  return { format: FORMAT, version: VERSION, nom: obj.nom, regles: obj.regles, roles: obj.roles ? cleanRoles(obj.roles) : ROLES_VIDES };
}

export function downloadRuleSet(set: RuleSet): void {
  const blob = new Blob([JSON.stringify(set, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${set.nom.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'regles'}.crible.json`;
  a.click();
  URL.revokeObjectURL(url);
}
