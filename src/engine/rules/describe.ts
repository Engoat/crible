import type { Operateur, Rule } from './model';

const OPS: Record<Operateur, string> = {
  '>=': 'supérieur ou égal à',
  '>': 'strictement supérieur à',
  '=': 'égal à',
  '!=': 'différent de',
  '<=': 'inférieur ou égal à',
  '<': 'strictement inférieur à',
  si_renseigne: 'renseigné quand l\'autre l\'est :',
};

export const OPERATEURS: { id: Operateur; label: string }[] = [
  { id: '>=', label: 'est ≥' },
  { id: '>', label: 'est >' },
  { id: '=', label: 'est =' },
  { id: '!=', label: 'est ≠' },
  { id: '<=', label: 'est ≤' },
  { id: '<', label: 'est <' },
  { id: 'si_renseigne', label: 'est renseignée si l\'autre colonne l\'est' },
];

const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

export function describeRule(rule: Rule): string {
  const t = rule.tolerance ? ` (tolérance ${pct(rule.tolerance)})` : '';
  switch (rule.type) {
    case 'non_vide':
      return `« ${rule.colonne} » est renseignée${t}`;
    case 'unique':
      return `${rule.colonnes.map((c) => `« ${c} »`).join(' + ')} sans répétition${t}`;
    case 'plage': {
      const lo = rule.min?.trim() ? `${rule.minExclu ? '>' : '≥'} ${rule.min}` : '';
      const hi = rule.max?.trim() ? `${rule.maxExclu ? '<' : '≤'} ${rule.max}` : '';
      return `« ${rule.colonne} » ${[lo, hi].filter(Boolean).join(' et ')}${t}`;
    }
    case 'format': {
      const nom: Record<string, string> = {
        email: 'une adresse e-mail',
        telephone: 'un numéro de téléphone',
        code_postal_fr: 'un code postal français',
        nombre: 'un nombre',
        date: `une date au format ${rule.formatDate}`,
        motif: `le motif ${rule.motif}`,
      };
      return `« ${rule.colonne} » est ${nom[rule.format]}${t}`;
    }
    case 'valeurs_autorisees':
      return `« ${rule.colonne} » parmi ${rule.valeurs.length} valeur${rule.valeurs.length > 1 ? 's' : ''} autorisée${rule.valeurs.length > 1 ? 's' : ''}${t}`;
    case 'entre_colonnes':
      return rule.operateur === 'si_renseigne'
        ? `« ${rule.colonneB} » est renseignée quand « ${rule.colonneA} » l'est${t}`
        : `« ${rule.colonneA} » ${OPS[rule.operateur]} « ${rule.colonneB} »${t}`;
    case 'type':
      return `« ${rule.colonne} » respecte son type${t}`;
    case 'doublons':
      return `Pas de ligne en double${t}`;
    case 'aberrantes':
      return `« ${rule.colonne} » sans valeur aberrante (Tukey, facteur ${rule.facteur})${t}`;
    case 'non_constante':
      return `« ${rule.colonne} » non constante (au moins ${rule.minDistincts} valeurs, dominante ≤ ${pct(rule.partMax)})`;
    case 'distribution':
      return `« ${rule.colonne} » : modalité dominante ≤ ${pct(rule.partMax)}, asymétrie ≤ ${rule.asymetrieMax}`;
    case 'texte_propre': {
      const what = [rule.espaces && 'sans espace parasite', rule.casse && 'une seule casse par valeur'].filter(Boolean);
      return `« ${rule.colonne} » : ${what.join(', ')}${t}`;
    }
  }
}
