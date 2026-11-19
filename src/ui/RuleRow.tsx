import { useState } from 'react';
import { describeRule } from '../engine/rules/describe';
import { ruleTypeInfo } from '../engine/rules/model';
import type { Rule, RuleResult } from '../engine/rules/model';
import { mesureValeur, nomMesure, nombre, pct } from './format';

interface Props {
  rule: Rule;
  result: RuleResult | undefined;
  absentes: string[];
  calcul: boolean;
  onEdit(): void;
  onRows?(): void;
  onHelp?(): void;
  onToggle(): void;
  onRemove(): void;
}

function verdictText(rule: Rule, result: RuleResult | undefined, absentes: string[], calcul: boolean) {
  if (absentes.length > 0) return { cls: 'neutre', texte: `Colonne absente : ${absentes.join(', ')}` };
  if (!rule.actif) return { cls: 'neutre', texte: 'Désactivée' };
  if (!result) return { cls: 'neutre', texte: calcul ? 'Calcul…' : 'Pas encore calculée' };
  if (result.verdict === 'erreur') return { cls: 'erreur', texte: 'Erreur' };
  const global = ruleTypeInfo(rule.type).global;
  if (result.verdict === 'reussie') return { cls: 'ok', texte: 'Réussie' };
  return { cls: 'ko', texte: global ? 'Échouée' : `Échouée : ${nombre(result.enDefaut)} lignes (${pct(result.part)})` };
}

export function RuleRow({ rule, result, absentes, calcul, onEdit, onRows, onHelp, onToggle, onRemove }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const v = verdictText(rule, result, absentes, calcul);
  const detail = result && (result.erreur || result.mesures.length > 0 || result.echantillon.length > 0);
  return (
    <li className={`regle ${v.cls}`}>
      <div className="regle-tete">
        <span className={`pastille ${v.cls}`}>{v.texte}</span>
        <span className="regle-texte">{describeRule(rule)}</span>
        <span className="gravite">{rule.gravite === 'bloquante' ? 'bloquante' : 'avertissement'}</span>
        <span className="actions">
          {detail && (
            <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
              {ouvert ? 'Masquer' : 'Détails'}
            </button>
          )}
          {onRows && result && !ruleTypeInfo(rule.type).global && result.enDefaut > 0 && result.colonnesEchantillon.length > 0 && (
            <button type="button" onClick={onRows}>Toutes les lignes</button>
          )}
          {onHelp && <button type="button" onClick={onHelp}>Aide</button>}
          <button type="button" onClick={onEdit}>Modifier</button>
          <button type="button" onClick={onToggle}>{rule.actif ? 'Désactiver' : 'Activer'}</button>
          <button type="button" onClick={onRemove}>Supprimer</button>
        </span>
      </div>
      {result && !ruleTypeInfo(rule.type).global && result.verdict !== 'erreur' && (
        <div className="regle-chiffres">
          {nombre(result.enDefaut)} en défaut sur {nombre(result.evaluees)} lignes évaluées
        </div>
      )}
      {ouvert && result && (
        <div className="regle-detail">
          {result.erreur && <p className="message-erreur">{result.erreur}</p>}
          {result.mesures.length > 0 && (
            <dl className="mesures">
              {result.mesures.map((m) => (
                <div key={m.nom}>
                  <dt>{nomMesure(m.nom)}</dt>
                  <dd>{mesureValeur(m.valeur)}</dd>
                </div>
              ))}
            </dl>
          )}
          {result.echantillon.length > 0 && (
            <div className="echantillon">
              <p>Lignes en défaut ({result.echantillon.length} premières) :</p>
              <table>
                <thead>
                  <tr>
                    <th>Ligne</th>
                    {result.colonnesEchantillon.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.echantillon.map((row) => (
                    <tr key={row._ligne}>
                      <td>{row._ligne}</td>
                      {result.colonnesEchantillon.map((c) => (
                        <td key={c}>{row[c] ?? <em>vide</em>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
