import { useState } from 'react';
import { RULE_TYPES, refColumns } from '../engine/rules/model';
import type { Rule, RuleResult, RuleType } from '../engine/rules/model';
import { absentColumns } from '../engine/rules/run';
import type { Dataset } from '../engine/types';
import { RuleRow } from './RuleRow';

interface Props {
  dataset: Dataset;
  regles: Rule[];
  resultats: Record<string, RuleResult>;
  calcul: boolean;
  onToggle(id: string): void;
  onRemove(id: string): void;
  onGoColumn(name: string): void;
  onRows(rule: Rule): void;
  onHelp(id: string): void;
  onAddDoublons(): void;
}

type FiltreVerdict = 'tous' | 'echouee' | 'reussie' | 'erreur' | 'autre';

export function Dashboard({ dataset, regles, resultats, calcul, onToggle, onRemove, onGoColumn, onRows, onHelp, onAddDoublons }: Props) {
  const [verdict, setVerdict] = useState<FiltreVerdict>('tous');
  const [gravite, setGravite] = useState('toutes');
  const [colonne, setColonne] = useState('toutes');
  const [type, setType] = useState<RuleType | 'tous'>('tous');

  const etat = (r: Rule): FiltreVerdict => {
    if (!r.actif || absentColumns(r, dataset.columns).length > 0) return 'autre';
    return resultats[r.id]?.verdict ?? 'autre';
  };

  const compte = (fn: (r: Rule) => boolean) => regles.filter(fn).length;
  const echouees = compte((r) => etat(r) === 'echouee');
  const bloquantes = compte((r) => etat(r) === 'echouee' && r.gravite === 'bloquante');
  const reussies = compte((r) => etat(r) === 'reussie');
  const erreurs = compte((r) => etat(r) === 'erreur');
  const misesDeCote = compte((r) => !r.actif || absentColumns(r, dataset.columns).length > 0);

  const visibles = regles.filter(
    (r) =>
      (verdict === 'tous' || etat(r) === verdict) &&
      (gravite === 'toutes' || r.gravite === gravite) &&
      (colonne === 'toutes' || refColumns(r).includes(colonne)) &&
      (type === 'tous' || r.type === type),
  );

  return (
    <section className="tableau">
      <div className="synthese" role="group" aria-label="Synthèse des règles">
        <div><strong>{regles.length}</strong><span>règles</span></div>
        <div className="ko"><strong>{echouees}</strong><span>échouées dont {bloquantes} bloquante{bloquantes > 1 ? 's' : ''}</span></div>
        <div className="ok"><strong>{reussies}</strong><span>réussies</span></div>
        <div><strong>{erreurs}</strong><span>en erreur</span></div>
        <div><strong>{misesDeCote}</strong><span>désactivées ou mises de côté</span></div>
      </div>

      <div className="filtres">
        <label className="champ">
          Résultat
          <select value={verdict} onChange={(e) => setVerdict(e.target.value as FiltreVerdict)}>
            <option value="tous">Tous</option>
            <option value="echouee">Échouées</option>
            <option value="reussie">Réussies</option>
            <option value="erreur">En erreur</option>
            <option value="autre">Désactivées ou mises de côté</option>
          </select>
        </label>
        <label className="champ">
          Gravité
          <select value={gravite} onChange={(e) => setGravite(e.target.value)}>
            <option value="toutes">Toutes</option>
            <option value="bloquante">Bloquantes</option>
            <option value="avertissement">Avertissements</option>
          </select>
        </label>
        <label className="champ">
          Colonne
          <select value={colonne} onChange={(e) => setColonne(e.target.value)}>
            <option value="toutes">Toutes</option>
            {dataset.columns.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="champ">
          Type de règle
          <select value={type} onChange={(e) => setType(e.target.value as RuleType | 'tous')}>
            <option value="tous">Tous</option>
            {RULE_TYPES.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onAddDoublons}>Ajouter « pas de ligne en double »</button>
      </div>

      {regles.length === 0 ? (
        <p className="doux">Aucune règle pour l'instant. Ouvre l'onglet Colonnes, choisis une colonne et ajoute une règle.</p>
      ) : visibles.length === 0 ? (
        <p className="doux">Aucune règle ne correspond à ces filtres.</p>
      ) : (
        <ul className="regles">
          {visibles.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              result={resultats[r.id]}
              absentes={absentColumns(r, dataset.columns)}
              calcul={calcul}
              onEdit={() => {
                const premiere = refColumns(r)[0];
                if (premiere) onGoColumn(premiere);
              }}
              onRows={() => onRows(r)}
              onHelp={() => onHelp(r.type)}
              onToggle={() => onToggle(r.id)}
              onRemove={() => onRemove(r.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
