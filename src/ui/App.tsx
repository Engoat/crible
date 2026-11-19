import { useCallback, useRef, useState } from 'react';
import logo from '../../design/logo/crible.svg';
import { applyTypes, isExcel, loadFile, sheetNames } from '../engine/load';
import { ROLES_VIDES } from '../engine/ml/model';
import type { MlResult, MlRoles } from '../engine/ml/model';
import { newRule } from '../engine/rules/model';
import type { Rule, RuleResult } from '../engine/rules/model';
import { absentColumns, runRule } from '../engine/rules/run';
import { TYPE_OPTIONS, typeLabel } from '../engine/types';
import type { Dataset } from '../engine/types';
import { downloadReport } from '../report/build';
import type { RuleSet } from '../rules-store/ruleset';
import { ColumnPanel } from './ColumnPanel';
import { Dashboard } from './Dashboard';
import { Dropzone } from './Dropzone';
import { EnsemblesBar } from './EnsemblesBar';
import { FaultyRows } from './FaultyRows';
import { duree, nombre } from './format';
import { HelpView } from './HelpView';
import { MlView } from './MlView';

type Vue = 'tableau' | 'colonnes' | 'ml' | 'aide';

export function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [etape, setEtape] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [feuilles, setFeuilles] = useState<{ file: File; noms: string[] } | null>(null);
  const [regles, setRegles] = useState<Rule[]>([]);
  const [roles, setRoles] = useState<MlRoles>(ROLES_VIDES);
  const [mlResultat, setMlResultat] = useState<MlResult | null>(null);
  const [nomEnsemble, setNomEnsemble] = useState('Nouvel ensemble');
  const [resultats, setResultats] = useState<Record<string, RuleResult>>({});
  const [calcul, setCalcul] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>('tableau');
  const [fautives, setFautives] = useState<Rule | null>(null);
  const [aide, setAide] = useState<string | null>(null);
  const [aideSeule, setAideSeule] = useState(false);
  const passe = useRef(0);

  const lancer = useCallback(async (liste: Rule[], ds: Dataset, seulement?: string) => {
    const mine = ++passe.current;
    setCalcul(true);
    const aCalculer = liste.filter(
      (r) => r.actif && absentColumns(r, ds.columns).length === 0 && (!seulement || r.id === seulement),
    );
    for (const rule of aCalculer) {
      const result = await runRule(rule, ds.columns);
      if (mine !== passe.current) return;
      setResultats((prev) => ({ ...prev, [rule.id]: result }));
    }
    if (mine === passe.current) setCalcul(false);
  }, []);

  async function charger(file: File, feuille: string | null) {
    setErreur(null);
    setFeuilles(null);
    setAideSeule(false);
    try {
      const ds = await loadFile(file, feuille, setEtape);
      setDataset(ds);
      setSelection(ds.columns[0]?.name ?? null);
      setVue(regles.length > 0 ? 'tableau' : 'colonnes');
      setResultats({});
      setMlResultat(null);
      setFautives(null);
      setEtape(null);
      lancer(regles, ds);
    } catch (e) {
      setEtape(null);
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function choisirFichier(file: File) {
    setErreur(null);
    if (isExcel(file)) {
      try {
        setEtape('Lecture du classeur…');
        const noms = await sheetNames(file);
        setEtape(null);
        if (noms.length > 1) return setFeuilles({ file, noms });
        return charger(file, noms[0] ?? null);
      } catch (e) {
        setEtape(null);
        return setErreur(e instanceof Error ? e.message : String(e));
      }
    }
    return charger(file, null);
  }

  async function changerType(name: string, id: string) {
    if (!dataset) return;
    const option = TYPE_OPTIONS.find((o) => o.id === id);
    if (!option) return;
    const columns = dataset.columns.map((c) => (c.name === name ? { ...c, type: option.type } : c));
    const ds = { ...dataset, columns };
    await applyTypes(columns);
    setDataset(ds);
    setResultats({});
    setMlResultat(null);
    lancer(regles, ds);
  }

  function enregistrerRegle(rule: Rule) {
    const existe = regles.some((r) => r.id === rule.id);
    const liste = existe ? regles.map((r) => (r.id === rule.id ? rule : r)) : [...regles, rule];
    setRegles(liste);
    if (dataset) lancer(liste, dataset, rule.id);
  }

  function basculer(id: string) {
    const liste = regles.map((r) => (r.id === id ? { ...r, actif: !r.actif } : r));
    setRegles(liste);
    if (dataset) lancer(liste, dataset, id);
  }

  function supprimer(id: string) {
    setRegles(regles.filter((r) => r.id !== id));
    setResultats((prev) => {
      const { [id]: _retiree, ...reste } = prev;
      return reste;
    });
    if (fautives?.id === id) setFautives(null);
  }

  function ouvrirEnsemble(set: RuleSet) {
    setNomEnsemble(set.nom);
    setRegles(set.regles);
    setRoles(set.roles ?? ROLES_VIDES);
    setResultats({});
    setMlResultat(null);
    setFautives(null);
    if (dataset) lancer(set.regles, dataset);
  }

  function nouvelEnsemble() {
    passe.current++;
    setCalcul(false);
    setNomEnsemble('Nouvel ensemble');
    setRegles([]);
    setRoles(ROLES_VIDES);
    setResultats({});
    setMlResultat(null);
    setFautives(null);
  }

  function ouvrirAide(id: string) {
    setAide(id);
    setVue('aide');
    setAideSeule(true);
  }

  const colonne = dataset?.columns.find((c) => c.name === selection) ?? null;
  const enEchec = (nom: string) =>
    regles.filter((r) => r.actif && resultats[r.id]?.verdict === 'echouee' && 'colonne' in r && r.colonne === nom).length;
  const absentes = dataset ? regles.filter((r) => absentColumns(r, dataset.columns).length > 0) : [];
  const echouees = regles.filter((r) => r.actif && resultats[r.id]?.verdict === 'echouee').length;

  return (
    <div className="app">
      <a className="evitement" href="#contenu">Aller au contenu</a>
      <header className="entete">
        <img src={logo} alt="Crible" className="logo" />
        {dataset && (
          <p className="fichier">
            <strong>{dataset.fileName}</strong>
            {dataset.sheet ? ` · feuille « ${dataset.sheet} »` : ''} · {nombre(dataset.rows)} lignes ·{' '}
            {dataset.columns.length} colonnes · chargé en {duree(dataset.loadMs)}
          </p>
        )}
        {dataset && (
          <button
            type="button"
            className="rapport"
            onClick={() => downloadReport({ dataset, nomEnsemble, regles, resultats, roles, ml: mlResultat })}
          >
            Exporter le rapport
          </button>
        )}
      </header>

      <main id="contenu">
        {etape && <p className="etat" role="status">{etape}</p>}
        {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

        {feuilles && (
          <section className="feuilles">
            <p>Ce classeur contient plusieurs feuilles. Laquelle analyser ?</p>
            {feuilles.noms.map((n) => (
              <button key={n} type="button" onClick={() => charger(feuilles.file, n)}>{n}</button>
            ))}
          </section>
        )}

        {!dataset && !etape && !feuilles && !aideSeule && (
          <>
            <p className="accroche">
              Charge un fichier, écris les règles que tes données doivent respecter, et vois ce qui ne va pas avant
              de les exploiter.
            </p>
            <Dropzone onFile={choisirFichier} />
            <div className="aide-vide">
              <h2>Comment ça marche</h2>
              <ol>
                <li>Charge un fichier CSV ou Excel.</li>
                <li>Ouvre une colonne et ajoute des règles : plage de valeurs, format, unicité…</li>
                <li>Consulte le tableau de bord, remonte aux lignes fautives, exporte le rapport.</li>
              </ol>
              <p className="doux">
                <button type="button" className="lien" onClick={() => ouvrirAide('types')}>Lire l'aide</button>{' '}
                pour savoir comment chaque mesure est calculée.
              </p>
            </div>
          </>
        )}

        {!dataset && aideSeule && (
          <>
            <button type="button" onClick={() => setAideSeule(false)}>← Retour</button>
            <HelpView entree={aide} />
          </>
        )}

        {dataset && (
          <>
            <div className="barre">
              <Dropzone onFile={choisirFichier} compact />
              <EnsemblesBar
                nom={nomEnsemble}
                rules={regles}
                roles={roles}
                onNom={setNomEnsemble}
                onLoad={ouvrirEnsemble}
                onNew={nouvelEnsemble}
              />
            </div>

            {absentes.length > 0 && (
              <p className="avertissement" role="status">
                {absentes.length} règle{absentes.length > 1 ? 's' : ''} de l'ensemble concerne{absentes.length > 1 ? 'nt' : ''} des
                colonnes absentes de ce fichier : mise{absentes.length > 1 ? 's' : ''} de côté, pas supprimée{absentes.length > 1 ? 's' : ''}.
              </p>
            )}

            <nav className="onglets" aria-label="Vues">
              <button type="button" aria-pressed={vue === 'tableau'} onClick={() => setVue('tableau')}>
                Tableau de bord{regles.length > 0 ? ` (${echouees} échouée${echouees > 1 ? 's' : ''})` : ''}
                {calcul ? ' · calcul…' : ''}
              </button>
              <button type="button" aria-pressed={vue === 'colonnes'} onClick={() => setVue('colonnes')}>Colonnes</button>
              <button type="button" aria-pressed={vue === 'ml'} onClick={() => setVue('ml')}>Machine learning</button>
              <button type="button" aria-pressed={vue === 'aide'} onClick={() => setVue('aide')}>Aide</button>
            </nav>

            {vue === 'tableau' && (
              <Dashboard
                dataset={dataset}
                regles={regles}
                resultats={resultats}
                calcul={calcul}
                onToggle={basculer}
                onRemove={supprimer}
                onGoColumn={(n) => {
                  setSelection(n);
                  setVue('colonnes');
                }}
                onRows={setFautives}
                onHelp={ouvrirAide}
                onAddDoublons={() => enregistrerRegle(newRule('doublons', ''))}
              />
            )}

            {vue === 'colonnes' && (
              <div className="deux-volets">
                <div className="liste">
                  <table>
                    <thead>
                      <tr>
                        <th>Colonne</th>
                        <th>Type</th>
                        <th>Règles en échec</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.columns.map((c) => (
                        <tr key={c.name} className={c.name === selection ? 'choisie' : ''}>
                          <td>
                            <button type="button" className="lien" onClick={() => setSelection(c.name)}>{c.name}</button>
                          </td>
                          <td>{typeLabel(c.type)}</td>
                          <td>{enEchec(c.name) > 0 ? <span className="pastille ko">{enEchec(c.name)}</span> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {colonne && (
                  <ColumnPanel
                    dataset={dataset}
                    column={colonne}
                    rules={regles}
                    results={resultats}
                    calcul={calcul}
                    onType={changerType}
                    onSaveRule={enregistrerRegle}
                    onToggle={basculer}
                    onRemove={supprimer}
                    onRows={setFautives}
                    onHelp={ouvrirAide}
                  />
                )}
              </div>
            )}

            {vue === 'ml' && (
              <MlView
                columns={dataset.columns}
                roles={roles}
                resultat={mlResultat}
                onResultat={setMlResultat}
                onRoles={setRoles}
                onHelp={ouvrirAide}
              />
            )}

            {vue === 'aide' && <HelpView entree={aide} />}

            {fautives && resultats[fautives.id] && (
              <FaultyRows
                rule={fautives}
                columns={dataset.columns}
                total={resultats[fautives.id].enDefaut}
                onClose={() => setFautives(null)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
