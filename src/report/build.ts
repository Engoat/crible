import logo from '../../design/logo/crible.svg?raw';
import type { MlResult, MlRoles } from '../engine/ml/model';
import { describeRule } from '../engine/rules/describe';
import { ruleTypeInfo } from '../engine/rules/model';
import type { Rule, RuleResult } from '../engine/rules/model';
import { absentColumns } from '../engine/rules/run';
import type { Dataset } from '../engine/types';
import { mesureValeur, nomMesure, nombre, pct } from '../ui/format';

export interface ReportInput {
  dataset: Dataset;
  nomEnsemble: string;
  regles: Rule[];
  resultats: Record<string, RuleResult>;
  roles: MlRoles;
  ml: MlResult | null;
}

const esc = (value: unknown): string =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const num = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const SAMPLE = 10;

function ruleBlock(rule: Rule, result: RuleResult | undefined, dataset: Dataset): string {
  const absentes = absentColumns(rule, dataset.columns);
  const global = ruleTypeInfo(rule.type).global;
  let etat: string;
  let classe: string;
  if (absentes.length > 0) [etat, classe] = [`Mise de côté : colonne absente (${absentes.join(', ')})`, 'neutre'];
  else if (!rule.actif) [etat, classe] = ['Désactivée', 'neutre'];
  else if (!result) [etat, classe] = ['Non calculée', 'neutre'];
  else if (result.verdict === 'erreur') [etat, classe] = [`Erreur : ${result.erreur ?? ''}`, 'ko'];
  else if (result.verdict === 'reussie') [etat, classe] = ['Réussie', 'ok'];
  else [etat, classe] = ['Échouée', 'ko'];

  const chiffres =
    result && !global && result.verdict !== 'erreur'
      ? `<p class="chiffres">${nombre(result.enDefaut)} en défaut sur ${nombre(result.evaluees)} lignes évaluées (${pct(result.part)})</p>`
      : '';
  const mesures =
    result && result.mesures.length > 0
      ? `<dl>${result.mesures.map((m) => `<div><dt>${esc(nomMesure(m.nom))}</dt><dd>${esc(mesureValeur(m.valeur))}</dd></div>`).join('')}</dl>`
      : '';
  const rows = result?.echantillon.slice(0, SAMPLE) ?? [];
  const exemple =
    rows.length > 0 && result
      ? `<table><thead><tr><th>Ligne</th>${result.colonnesEchantillon.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr><td>${esc(r._ligne)}</td>${result.colonnesEchantillon.map((c) => `<td>${r[c] === null ? '<em>vide</em>' : esc(r[c])}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>${(result.enDefaut > rows.length ? `<p class="chiffres">${rows.length} premières lignes en défaut sur ${nombre(result.enDefaut)}.</p>` : '')}`
      : '';

  return `<article class="regle ${classe}">
    <h3><span class="badge ${classe}">${esc(etat)}</span> ${esc(describeRule(rule))}</h3>
    <p class="gravite">Gravité : ${rule.gravite === 'bloquante' ? 'bloquante' : 'avertissement'}</p>
    ${chiffres}${mesures}${exemple}
  </article>`;
}

function mlBlock(ml: MlResult, roles: MlRoles): string {
  const parts: string[] = ['<h2>Contrôles machine learning</h2>'];
  if (ml.avertissements.length > 0) parts.push(`<ul class="notes">${ml.avertissements.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`);
  const findings = (titre: string, items: ML) =>
    `<h3>${titre}</h3>${
      items.length === 0
        ? '<p class="chiffres">Rien à signaler.</p>'
        : `<table><thead><tr><th>Colonne(s)</th><th>Mesure</th><th>Valeur</th><th>Verdict</th></tr></thead><tbody>${items
            .slice(0, 40)
            .map(
              (f) =>
                `<tr><td>${esc(f.colonnes.join(' et '))}</td><td>${esc(f.methode)}</td><td>${num(f.valeur)}${f.p !== null ? ` (p = ${f.p < 0.0001 ? '&lt; 0,0001' : num(f.p)})` : ''}</td><td>${f.signale ? 'À vérifier' : 'Sous le seuil'}</td></tr>`,
            )
            .join('')}</tbody></table>`
    }`;
  type ML = MlResult['fuite'];
  if (roles.cible && ml.desequilibre) {
    const d = ml.desequilibre;
    parts.push(
      `<h3>Déséquilibre de la cible « ${esc(roles.cible)} »</h3><table><thead><tr><th>Classe</th><th>Lignes</th></tr></thead><tbody>${d.classes
        .map((c) => `<tr><td>${esc(c.valeur)}</td><td>${nombre(c.n)}</td></tr>`)
        .join('')}</tbody></table>${d.ratio !== null ? `<p>Rapport classe rare / classe fréquente : ${num(d.ratio)} (seuil ${num(roles.seuils.desequilibre)}) : ${d.signale ? 'à vérifier' : 'au-dessus du seuil'}.</p>` : ''}`,
    );
  }
  if (roles.cible) parts.push(findings(`Fuite de cible possible (seuil ${num(roles.seuils.fuite)})`, ml.fuite));
  parts.push(findings(`Colonnes redondantes (seuil ${num(roles.seuils.redondance)})`, ml.redondance));
  if (roles.separation) parts.push(findings(`Écart entraînement / test (seuil ${num(roles.seuils.ecart)})`, ml.ecart));
  return parts.join('');
}

export function buildReport(input: ReportInput): string {
  const { dataset, nomEnsemble, regles, resultats, roles, ml } = input;
  const actives = regles.filter((r) => r.actif && absentColumns(r, dataset.columns).length === 0);
  const echouees = actives.filter((r) => resultats[r.id]?.verdict === 'echouee');
  const date = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport Crible · ${esc(dataset.fileName)}</title>
<style>
  :root{--encre:#1c1412;--doux:#5f524a;--trait:#ddd3c8;--fond:#f6f1ec}
  *{box-sizing:border-box}
  body{margin:0;background:var(--fond);color:var(--encre);font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
  main{max-width:980px;margin:0 auto;padding:32px 24px 64px;background:#fff}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid var(--encre);padding-bottom:16px;margin-bottom:24px}
  header svg{height:40px;width:auto}
  h1{margin:0 0 4px;font-size:26px} h2{margin:32px 0 8px;font-size:20px} h3{margin:0 0 4px;font-size:15px}
  .meta{color:var(--doux);margin:0}
  .synthese{display:flex;gap:24px;flex-wrap:wrap;margin:16px 0}
  .synthese div{display:grid}.synthese strong{font-size:26px}
  .regle{border:1px solid var(--trait);border-left:4px solid var(--trait);border-radius:6px;padding:10px 14px;margin:10px 0;break-inside:avoid}
  .regle.ok{border-left-color:#2f7d4a}.regle.ko{border-left-color:#e8432a}
  .badge{display:inline-block;font-size:12px;padding:1px 8px;border-radius:999px;background:#eee}
  .badge.ok{background:#dff0e4;color:#1f5a35}.badge.ko{background:#fbe1db;color:#8a2412}
  .chiffres,.gravite{margin:2px 0;color:var(--doux);font-size:13px}
  dl{display:flex;flex-wrap:wrap;gap:6px 24px;margin:6px 0}dl div{display:grid}dt{font-size:12px;color:var(--doux)}dd{margin:0;font-family:ui-monospace,Consolas,monospace;font-weight:600}
  table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}
  th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--trait);font-family:ui-monospace,Consolas,monospace}
  th{font-family:inherit;font-size:11px;text-transform:uppercase;color:var(--doux)}
  .notes{color:var(--doux);font-size:13px}
  footer{margin-top:32px;color:var(--doux);font-size:12px;border-top:1px solid var(--trait);padding-top:12px}
  @media print{body{background:#fff}main{padding:0}}
</style></head><body><main>
<header><div><h1>Rapport de qualité des données</h1>
<p class="meta"><strong>${esc(dataset.fileName)}</strong>${dataset.sheet ? ` · feuille « ${esc(dataset.sheet)} »` : ''}</p>
<p class="meta">${nombre(dataset.rows)} lignes · ${dataset.columns.length} colonnes · analysé le ${esc(date)}</p>
<p class="meta">Ensemble de règles : <strong>${esc(nomEnsemble)}</strong></p></div>${logo}</header>

<div class="synthese">
  <div><strong>${actives.length}</strong><span>règles appliquées</span></div>
  <div><strong>${echouees.length}</strong><span>échouées</span></div>
  <div><strong>${actives.length - echouees.length - actives.filter((r) => resultats[r.id]?.verdict === 'erreur').length}</strong><span>réussies</span></div>
</div>

<h2>Règles</h2>
${regles.length === 0 ? '<p class="chiffres">Aucune règle dans cet ensemble.</p>' : regles.map((r) => ruleBlock(r, resultats[r.id], dataset)).join('')}
${ml ? mlBlock(ml, roles) : ''}
<footer>Rapport produit par Crible. Les données n'ont pas quitté l'ordinateur de l'utilisateur ; ce rapport ne contient que des exemples de lignes en défaut (${SAMPLE} au plus par règle).</footer>
</main></body></html>`;
}

export function downloadReport(input: ReportInput): void {
  const blob = new Blob([buildReport(input)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-crible-${input.dataset.fileName.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
