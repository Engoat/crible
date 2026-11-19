import { isNumeric, isTemporal } from '../types';
import type { ColType } from '../types';

export type Gravite = 'bloquante' | 'avertissement';
export type FormatId = 'email' | 'telephone' | 'code_postal_fr' | 'nombre' | 'date' | 'motif';
export type Operateur = '>=' | '>' | '=' | '!=' | '<=' | '<' | 'si_renseigne';

interface Base {
  id: string;
  gravite: Gravite;
  /** part de lignes en défaut acceptée, entre 0 et 1 */
  tolerance: number;
  actif: boolean;
}

export type Rule =
  | (Base & { type: 'non_vide'; colonne: string })
  | (Base & { type: 'unique'; colonnes: string[] })
  | (Base & {
      type: 'plage';
      colonne: string;
      min: string | null;
      max: string | null;
      minExclu: boolean;
      maxExclu: boolean;
    })
  | (Base & { type: 'format'; colonne: string; format: FormatId; motif: string; formatDate: string })
  | (Base & { type: 'valeurs_autorisees'; colonne: string; valeurs: string[]; casse: boolean })
  | (Base & { type: 'entre_colonnes'; colonneA: string; operateur: Operateur; colonneB: string })
  | (Base & { type: 'type'; colonne: string })
  | (Base & { type: 'doublons' })
  | (Base & { type: 'aberrantes'; colonne: string; facteur: number })
  | (Base & { type: 'non_constante'; colonne: string; minDistincts: number; partMax: number })
  | (Base & { type: 'distribution'; colonne: string; partMax: number; asymetrieMax: number })
  | (Base & { type: 'texte_propre'; colonne: string; espaces: boolean; casse: boolean });

export type RuleType = Rule['type'];

export interface RuleTypeInfo {
  type: RuleType;
  label: string;
  portee: 'colonne' | 'colonnes' | 'deux' | 'jeu';
  /** vrai si le contrôle porte sur la colonne entière, pas sur des lignes */
  global?: boolean;
  applicable: (t: ColType) => boolean;
}

export const RULE_TYPES: RuleTypeInfo[] = [
  { type: 'non_vide', label: 'Non vide', portee: 'colonne', applicable: () => true },
  { type: 'unique', label: 'Unique', portee: 'colonnes', applicable: () => true },
  {
    type: 'plage',
    label: 'Plage de valeurs',
    portee: 'colonne',
    applicable: (t) => isNumeric(t) || isTemporal(t),
  },
  { type: 'format', label: 'Format', portee: 'colonne', applicable: () => true },
  { type: 'valeurs_autorisees', label: 'Valeurs autorisées', portee: 'colonne', applicable: () => true },
  { type: 'entre_colonnes', label: 'Entre deux colonnes', portee: 'deux', applicable: () => true },
  { type: 'type', label: 'Type respecté', portee: 'colonne', applicable: (t) => t.kind !== 'text' },
  { type: 'doublons', label: 'Lignes en double', portee: 'jeu', applicable: () => false },
  { type: 'aberrantes', label: 'Valeurs aberrantes', portee: 'colonne', applicable: isNumeric },
  { type: 'non_constante', label: 'Colonne non constante', portee: 'colonne', global: true, applicable: () => true },
  { type: 'distribution', label: 'Distribution équilibrée', portee: 'colonne', global: true, applicable: () => true },
  { type: 'texte_propre', label: 'Texte propre', portee: 'colonne', applicable: (t) => t.kind === 'text' },
];

export const ruleTypeInfo = (type: RuleType): RuleTypeInfo =>
  RULE_TYPES.find((t) => t.type === type) as RuleTypeInfo;

export function refColumns(rule: Rule): string[] {
  switch (rule.type) {
    case 'unique':
      return rule.colonnes;
    case 'entre_colonnes':
      return [rule.colonneA, rule.colonneB];
    case 'doublons':
      return [];
    default:
      return [rule.colonne];
  }
}

export function newId(): string {
  return `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function newRule(type: RuleType, colonne: string): Rule {
  const base = { id: newId(), gravite: 'bloquante' as Gravite, tolerance: 0, actif: true };
  switch (type) {
    case 'non_vide':
    case 'type':
      return { ...base, type, colonne };
    case 'unique':
      return { ...base, type, colonnes: [colonne] };
    case 'plage':
      return { ...base, type, colonne, min: null, max: null, minExclu: false, maxExclu: false };
    case 'format':
      return { ...base, type, colonne, format: 'email', motif: '', formatDate: '%Y-%m-%d' };
    case 'valeurs_autorisees':
      return { ...base, type, colonne, valeurs: [], casse: true };
    case 'entre_colonnes':
      return { ...base, type, colonneA: colonne, operateur: '>=', colonneB: '' };
    case 'doublons':
      return { ...base, type };
    case 'aberrantes':
      return { ...base, type, colonne, facteur: 1.5 };
    case 'non_constante':
      return { ...base, type, colonne, minDistincts: 2, partMax: 0.99 };
    case 'distribution':
      return { ...base, type, colonne, partMax: 0.95, asymetrieMax: 1 };
    case 'texte_propre':
      return { ...base, type, colonne, espaces: true, casse: true };
  }
}

export type Verdict = 'reussie' | 'echouee' | 'erreur';

export interface RuleResult {
  ruleId: string;
  verdict: Verdict;
  evaluees: number;
  enDefaut: number;
  part: number;
  global: boolean;
  mesures: { nom: string; valeur: string | number | null }[];
  colonnesEchantillon: string[];
  echantillon: Record<string, string | null>[];
  erreur?: string;
}
