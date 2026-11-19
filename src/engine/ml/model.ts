export interface MlSeuils {
  /** rapport classe la plus rare / classe la plus fréquente en dessous duquel on signale */
  desequilibre: number;
  /** lien avec la cible à partir duquel on signale une fuite possible */
  fuite: number;
  /** lien entre deux colonnes à partir duquel on signale une redondance */
  redondance: number;
  /** taille de l'écart entre entraînement et test à partir de laquelle on signale */
  ecart: number;
}

export const SEUILS_DEFAUT: MlSeuils = { desequilibre: 0.1, fuite: 0.95, redondance: 0.9, ecart: 0.1 };

export interface MlRoles {
  cible: string | null;
  separation: { colonne: string; entrainement: string; test: string } | null;
  seuils: MlSeuils;
}

export const ROLES_VIDES: MlRoles = { cible: null, separation: null, seuils: SEUILS_DEFAUT };

export interface MlFinding {
  colonnes: string[];
  methode: string;
  valeur: number;
  signale: boolean;
  p: number | null;
  detail: string | null;
}

export interface MlResult {
  desequilibre: { classes: { valeur: string; n: number }[]; ratio: number | null; signale: boolean } | null;
  fuite: MlFinding[];
  redondance: MlFinding[];
  ecart: MlFinding[];
  avertissements: string[];
}
