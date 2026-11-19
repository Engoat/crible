import { useEffect, useState } from 'react';
import { distinctValues, runMl } from '../engine/ml/run';
import { SEUILS_DEFAUT } from '../engine/ml/model';
import type { MlFinding, MlResult, MlRoles, MlSeuils } from '../engine/ml/model';
import type { ColumnInfo } from '../engine/types';
import { findColumn } from '../engine/rules/build';
import { nombre } from './format';

interface Props {
  columns: ColumnInfo[];
  roles: MlRoles;
  resultat: MlResult | null;
  onResultat(r: MlResult | null): void;
  onRoles(roles: MlRoles): void;
  onHelp(entree: string): void;
}

const num = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const pval = (p: number | null) => (p === null ? '' : p < 0.0001 ? 'p < 0,0001' : `p = ${num(p)}`);

function Findings({ titre, intro, items, aide, onHelp, vide }: {
  titre: string;
  intro: string;
  items: MlFinding[];
  aide: string;
  onHelp(entree: string): void;
  vide: string;
}) {
  return (
    <section className="ml-bloc">
      <h3>
        {titre}{' '}
        <button type="button" className="lien" onClick={() => onHelp(aide)}>comment c'est calculé</button>
      </h3>
      <p className="doux">{intro}</p>
      {items.length === 0 ? (
        <p className="doux">{vide}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Colonne(s)</th>
              <th>Mesure</th>
              <th>Valeur</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 40).map((f, i) => (
              <tr key={i}>
                <td>{f.colonnes.join(' et ')}</td>
                <td>{f.methode}</td>
                <td>
                  {num(f.valeur)} {f.p !== null && <span className="doux">({pval(f.p)})</span>}
                  {f.detail && <div className="doux">{f.detail}</div>}
                </td>
                <td>{f.signale ? <span className="pastille ko">À vérifier</span> : <span className="pastille ok">Sous le seuil</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function MlView({ columns, roles, resultat, onResultat, onRoles, onHelp }: Props) {
  const [valeursSep, setValeursSep] = useState<string[]>([]);
  const [calcul, setCalcul] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const cible = roles.cible ? findColumn(columns, roles.cible) : undefined;
  const sepCol = roles.separation ? findColumn(columns, roles.separation.colonne) : undefined;

  useEffect(() => {
    let actif = true;
    if (sepCol) distinctValues(sepCol.name).then((v) => actif && setValeursSep(v));
    else setValeursSep([]);
    return () => {
      actif = false;
    };
  }, [sepCol?.name]);

  const set = (patch: Partial<MlRoles>) => onRoles({ ...roles, ...patch });
  const setSeuil = (k: keyof MlSeuils, text: string) => {
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n)) set({ seuils: { ...roles.seuils, [k]: n } });
  };

  async function lancer() {
    setErreur(null);
    onResultat(null);
    try {
      onResultat(await runMl(roles, columns, setCalcul));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setCalcul(null);
    }
  }

  const rien = !roles.cible && !roles.separation;

  return (
    <section className="ml">
      <p className="doux">
        Ces contrôles ne s'activent que pour les rôles déclarés ci-dessous. Ils sont enregistrés avec l'ensemble de
        règles.
      </p>

      <div className="grille">
        <label className="champ">
          Colonne cible
          <select value={roles.cible ?? ''} onChange={(e) => set({ cible: e.target.value || null })}>
            <option value="">— aucune —</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          {roles.cible && !cible && <span className="message-erreur">Colonne absente de ce fichier.</span>}
        </label>

        <label className="champ">
          Colonne de séparation entraînement / test
          <select
            value={roles.separation?.colonne ?? ''}
            onChange={(e) =>
              set({ separation: e.target.value ? { colonne: e.target.value, entrainement: '', test: '' } : null })
            }
          >
            <option value="">— aucune —</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>

        {roles.separation && sepCol && (
          <>
            <label className="champ">
              Valeur « entraînement »
              <select
                value={roles.separation.entrainement}
                onChange={(e) => set({ separation: { ...roles.separation!, entrainement: e.target.value } })}
              >
                <option value="">— choisir —</option>
                {valeursSep.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="champ">
              Valeur « test »
              <select
                value={roles.separation.test}
                onChange={(e) => set({ separation: { ...roles.separation!, test: e.target.value } })}
              >
                <option value="">— choisir —</option>
                {valeursSep.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <details className="seuils">
        <summary>Seuils</summary>
        <div className="grille">
          {(
            [
              ['desequilibre', 'Déséquilibre : rapport classe rare / classe fréquente en dessous de'],
              ['fuite', 'Fuite de cible : lien avec la cible à partir de'],
              ['redondance', 'Redondance : lien entre deux colonnes à partir de'],
              ['ecart', 'Écart entraînement / test : taille de l\'écart à partir de'],
            ] as [keyof MlSeuils, string][]
          ).map(([k, label]) => (
            <label key={k} className="champ">
              {label}
              <input value={String(roles.seuils[k])} onChange={(e) => setSeuil(k, e.target.value)} />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => set({ seuils: SEUILS_DEFAUT })}>Remettre les seuils par défaut</button>
      </details>

      <div className="boutons">
        <button type="button" className="primaire" onClick={lancer} disabled={calcul !== null}>
          Lancer les contrôles
        </button>
        {calcul && <span className="doux" role="status">{calcul}</span>}
      </div>
      {rien && (
        <p className="doux">Sans rôle déclaré, seule la redondance entre colonnes est contrôlée.</p>
      )}
      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

      {resultat && (
        <div className="ml-resultats">
          {resultat.avertissements.length > 0 && (
            <ul className="notes">
              {resultat.avertissements.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}

          {roles.cible && (
            <section className="ml-bloc">
              <h3>
                Déséquilibre de la cible{' '}
                <button type="button" className="lien" onClick={() => onHelp('ml_desequilibre')}>comment c'est calculé</button>
              </h3>
              {resultat.desequilibre ? (
                <>
                  <table>
                    <thead>
                      <tr><th>Classe</th><th>Lignes</th></tr>
                    </thead>
                    <tbody>
                      {resultat.desequilibre.classes.map((c) => (
                        <tr key={c.valeur}><td>{c.valeur}</td><td>{nombre(c.n)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {resultat.desequilibre.ratio !== null && (
                    <p>
                      Rapport classe la plus rare / classe la plus fréquente : <strong>{num(resultat.desequilibre.ratio)}</strong>{' '}
                      {resultat.desequilibre.signale ? (
                        <span className="pastille ko">À vérifier</span>
                      ) : (
                        <span className="pastille ok">Au-dessus du seuil</span>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <p className="doux">Non calculé (voir les notes).</p>
              )}
            </section>
          )}

          {roles.cible && (
            <Findings
              titre="Fuite de cible possible"
              intro="Une colonne très liée à la cible peut la contenir sans le dire. Crible la signale ; c'est à toi de juger si elle est légitime."
              items={resultat.fuite}
              aide="ml_fuite"
              onHelp={onHelp}
              vide="Aucune colonne comparée."
            />
          )}

          <Findings
            titre="Colonnes redondantes"
            intro="Paires de colonnes explicatives dont le lien dépasse le seuil."
            items={resultat.redondance}
            aide="ml_redondance"
            onHelp={onHelp}
            vide="Aucune paire au-dessus du seuil."
          />

          {roles.separation && (
            <Findings
              titre="Écart entre entraînement et test"
              intro="Pour chaque colonne, la distribution dans le jeu d'entraînement est comparée à celle du jeu de test. On juge la taille de l'écart ; la valeur p n'est qu'indicative, car sur de gros effectifs presque tout écart devient significatif."
              items={resultat.ecart}
              aide="ml_ecart"
              onHelp={onHelp}
              vide="Aucun écart calculé."
            />
          )}
        </div>
      )}
    </section>
  );
}
