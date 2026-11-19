// Vérification finale (étape 11) : lance Crible dans un vrai navigateur et compare ses chiffres
// aux valeurs calculées par pandas et SciPy (tests/fixtures.py).
// Usage : python tests/fixtures.py && node tests/verifier.mjs [--gros] [--captures]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const ref = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/reference.json'), 'utf8'));
const GROS = process.argv.includes('--gros');
const CAP = path.join(ROOT, 'tests/captures');
fs.mkdirSync(CAP, { recursive: true });

const lignes = [];
let ko = 0;
function check(nom, ok, detail = '') {
  if (!ok) ko++;
  lignes.push({ nom, ok, detail });
  console.log(`${ok ? 'OK ' : 'KO '} ${nom}${detail ? '  — ' + detail : ''}`);
}
const egal = (nom, obtenu, attendu) => check(nom, obtenu === attendu, `obtenu ${obtenu}, attendu ${attendu}`);
const proche = (nom, obtenu, attendu, tol = 1e-6) =>
  check(nom, Math.abs(obtenu - attendu) <= tol * Math.max(1, Math.abs(attendu)), `obtenu ${obtenu}, attendu ${attendu}`);

// ------------------------------------------------------------------ serveur de développement
const vite = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort', '--logLevel', 'error'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
vite.stderr.on('data', (d) => process.stderr.write(d));
async function attendreServeur() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Le serveur de développement ne répond pas.');
}

let browser;
try {
  await attendreServeur();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const erreursPage = [];
  page.on('pageerror', (e) => erreursPage.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreursPage.push(m.text()));
  await page.goto(BASE);

  const installer = async () => {
    await page.evaluate(async () => {
      const t = {};
      t.load = await import('/src/engine/load.ts');
      t.run = await import('/src/engine/rules/run.ts');
      t.model = await import('/src/engine/rules/model.ts');
      t.ml = await import('/src/engine/ml/run.ts');
      t.mlm = await import('/src/engine/ml/model.ts');
      t.report = await import('/src/report/build.ts');
      t.store = await import('/src/rules-store/storage.ts');
      t.rset = await import('/src/rules-store/ruleset.ts');
      t.db = await import('/src/engine/db.ts');
      t.file = async (url, name) => new File([await (await fetch(url)).arrayBuffer()], name);
      t.open = async (url, name, sheet = null) => {
        t.etapes = [];
        const t0 = performance.now();
        t.ds = await t.load.loadFile(await t.file(url, name), sheet, (m) => t.etapes.push([m, Math.round(performance.now() - t0)]));
        return t.ds;
      };
      t.rule = async (type, col, patch = {}) => {
        const r = Object.assign(t.model.newRule(type, col), patch);
        t.lastRule = r;
        return t.run.runRule(r, t.ds.columns);
      };
      window.__t = t;
    });
  };
  await installer();
  const open = (url, name, sheet) => page.evaluate(([u, n, s]) => window.__t.open(u, n, s), [url, name, sheet ?? null]);
  const rule = (type, col, patch) => page.evaluate(([a, b, c]) => window.__t.rule(a, b, c), [type, col, patch ?? {}]);
  const mesure = (r, nom) => r.mesures.find((m) => m.nom === nom)?.valeur;
  const kind = (ds, name) => ds.columns.find((c) => c.name === name)?.type;

  /* ============================================================ 1. Titanic */
  console.log('\n— Titanic');
  const T = ref.titanic;
  let ds = await open('/public/demo/titanic.csv', 'titanic.csv');
  egal('Titanic : lignes', ds.rows, T.lignes);
  egal('Titanic : colonnes', ds.columns.length, T.colonnes);
  const attendus = { PassengerId: 'int', Survived: 'int', Pclass: 'int', Name: 'text', Sex: 'text', Age: 'double', SibSp: 'int', Parch: 'int', Ticket: 'text', Fare: 'double', Cabin: 'text', Embarked: 'text' };
  for (const [col, k] of Object.entries(attendus)) egal(`Titanic : type de ${col}`, kind(ds, col)?.kind, k);

  let r = await rule('non_vide', 'Age');
  egal('non_vide Age : lignes en défaut', r.enDefaut, T.manquants_Age);
  egal('non_vide Age : lignes évaluées', r.evaluees, T.lignes);
  egal('non_vide Cabin', (await rule('non_vide', 'Cabin')).enDefaut, T.manquants_Cabin);
  egal('non_vide Embarked', (await rule('non_vide', 'Embarked')).enDefaut, T.manquants_Embarked);

  r = await rule('plage', 'Age', { min: '0', max: '60' });
  egal('plage Age [0 ; 60] : en défaut', r.enDefaut, T.plage_age_0_60);
  egal('plage Age : évaluées', r.evaluees, 714);

  r = await rule('unique', '', { colonnes: ['Ticket'] });
  egal('unique Ticket : lignes concernées', r.enDefaut, T.unique_ticket_lignes);
  egal('unique Ticket : valeurs répétées', mesure(r, 'valeurs_repetees'), T.unique_ticket_valeurs);
  egal('unique PassengerId', (await rule('unique', '', { colonnes: ['PassengerId'] })).enDefaut, T.unique_passengerid);
  egal('doublons', (await rule('doublons', '')).enDefaut, T.doublons);

  r = await rule('aberrantes', 'Fare', { facteur: 1.5 });
  egal('aberrantes Fare : en défaut', r.enDefaut, T.aberrantes_fare.n);
  proche('aberrantes Fare : Q1', mesure(r, 'premier_quartile'), T.aberrantes_fare.q1);
  proche('aberrantes Fare : Q3', mesure(r, 'troisieme_quartile'), T.aberrantes_fare.q3);
  proche('aberrantes Fare : borne basse', mesure(r, 'borne_basse'), T.aberrantes_fare.bas);
  proche('aberrantes Fare : borne haute', mesure(r, 'borne_haute'), T.aberrantes_fare.haut);

  egal('valeurs_autorisees Sex = male', (await rule('valeurs_autorisees', 'Sex', { valeurs: ['male'] })).enDefaut, T.autorisees_sex_male);
  egal('format code postal sur Ticket', (await rule('format', 'Ticket', { format: 'code_postal_fr' })).enDefaut, T.format_cp_ticket);
  egal('entre colonnes SibSp ≥ Parch', (await rule('entre_colonnes', 'SibSp', { colonneB: 'Parch', operateur: '>=' })).enDefaut, T.entre_sibsp_ge_parch);
  proche('distribution Fare : asymétrie (SciPy, biais corrigé)', mesure(await rule('distribution', 'Fare'), 'asymetrie'), T.skew_fare);
  proche('distribution Age : asymétrie', mesure(await rule('distribution', 'Age'), 'asymetrie'), T.skew_age);

  /* ============================================================ 2. fichier piégé */
  console.log('\n— Fichier piégé (Windows-1252, point-virgule, virgule décimale)');
  const P = ref.pieges;
  ds = await open('/tests/fixtures/pieges.csv', 'pieges.csv');
  egal('piégé : lignes', ds.rows, P.lignes);
  egal('piégé : colonnes', ds.columns.length, 9);
  egal('piégé : id entier', kind(ds, 'id')?.kind, 'int');
  egal('piégé : prix décimal à virgule', JSON.stringify(kind(ds, 'prix')), JSON.stringify({ kind: 'double', virgule: true }));
  egal('piégé : date JJ/MM/AAAA', JSON.stringify(kind(ds, 'date')), JSON.stringify({ kind: 'date', format: '%d/%m/%Y' }));
  egal('piégé : code postal reste du texte (zéros initiaux)', kind(ds, 'cp')?.kind, 'text');
  egal('piégé : quantité entière', kind(ds, 'quantite')?.kind, 'int');
  const exemples = await page.evaluate(() => window.__t.load.examples('nom'));
  check('piégé : accents correctement lus', exemples.some((e) => e.includes('Élodie Müller')), exemples[0]);

  egal('type prix : valeurs non convertibles', (await rule('type', 'prix')).enDefaut, P.type_prix);
  egal('type date : dates impossibles', (await rule('type', 'date')).enDefaut, P.type_date);
  egal('non_vide nom', (await rule('non_vide', 'nom')).enDefaut, P.manquants_nom);
  egal('texte propre : espaces', (await rule('texte_propre', 'nom', { espaces: true, casse: false })).enDefaut, P.espaces_nom);
  egal('texte propre : variantes de casse', (await rule('texte_propre', 'ville', { espaces: false, casse: true })).enDefaut, P.casse_ville_lignes);
  egal('format e-mail', (await rule('format', 'email', { format: 'email' })).enDefaut, P.format_email);
  egal('valeurs autorisées statut', (await rule('valeurs_autorisees', 'statut', { valeurs: ['actif', 'inactif'] })).enDefaut, P.autorisees_statut);
  egal('plage quantité ≥ 0', (await rule('plage', 'quantite', { min: '0' })).enDefaut, P.plage_quantite_min0);
  egal('unique id : lignes concernées', (await rule('unique', '', { colonnes: ['id'] })).enDefaut, P.unique_id_lignes);
  egal('doublons de lignes', (await rule('doublons', '')).enDefaut, P.doublons);
  r = await rule('doublons', '');
  check('doublons : lignes fautives avec numéro de ligne', r.echantillon.length === 2 && r.echantillon.every((x) => Number(x._ligne) > 400), JSON.stringify(r.echantillon.map((x) => x._ligne)));

  // changer un type : la règle « type » se recalcule sur le nouveau type
  const apres = await page.evaluate(async () => {
    const t = window.__t;
    const cols = t.ds.columns.map((c) => (c.name === 'prix' ? { ...c, type: { kind: 'text' } } : c));
    await t.load.applyTypes(cols);
    t.ds = { ...t.ds, columns: cols };
    return (await t.rule('type', 'prix')).enDefaut;
  });
  egal('type prix repassé en texte : plus de défaut', apres, 0);

  /* ============================================================ 3. Excel */
  console.log('\n— Excel');
  const noms = await page.evaluate(async () => window.__t.load.sheetNames(await window.__t.file('/tests/fixtures/classeur.xlsx', 'classeur.xlsx')));
  check('feuilles du classeur', JSON.stringify(noms) === JSON.stringify(['Lisez-moi', 'Ventes']), JSON.stringify(noms));
  ds = await open('/tests/fixtures/classeur.xlsx', 'classeur.xlsx', 'Ventes');
  egal('Excel : lignes', ds.rows, ref.excel.lignes);
  egal('Excel : type Date', kind(ds, 'Date')?.kind, 'date');
  egal('Excel : type Montant', kind(ds, 'Montant')?.kind, 'double');
  egal('Excel : type Quantité', kind(ds, 'Quantité')?.kind, 'int');
  egal('Excel : type Payé', kind(ds, 'Payé')?.kind, 'bool');
  const sums = await page.evaluate(async () => (await window.__t.db.query('SELECT CAST(sum("Montant") AS DOUBLE) AS m, CAST(sum("Quantité") AS DOUBLE) AS q FROM donnees'))[0]);
  proche('Excel : somme des montants', sums.m, ref.excel.montant_total);
  egal('Excel : somme des quantités', sums.q, ref.excel.quantite_total);

  /* ============================================================ 4. machine learning */
  console.log('\n— Machine learning');
  const M = ref.ml;
  ds = await open('/tests/fixtures/titanic_ml.csv', 'titanic_ml.csv');
  const runMl = (separation) =>
    page.evaluate(
      async ([sep]) => {
        const t = window.__t;
        const roles = { cible: 'Survived', separation: sep, seuils: { desequilibre: 0.5, fuite: 0.95, redondance: 0.1, ecart: 0.1 } };
        return t.ml.runMl(roles, t.ds.columns, () => {});
      },
      [separation],
    );
  let res = await runMl({ colonne: 'jeu_aleatoire', entrainement: 'train', test: 'test' });
  proche('déséquilibre : rapport', res.desequilibre.ratio, M.desequilibre_ratio);
  const f = (col) => res.fuite.find((x) => x.colonnes[0] === col);
  proche('fuite : V de Cramér Sex / Survived (SciPy)', f('Sex').valeur, M.cramer_survived_Sex);
  proche('fuite : V de Cramér Embarked / Survived', f('Embarked').valeur, M.cramer_survived_Embarked);
  proche('fuite : η Fare / Survived', f('Fare').valeur, M.eta_survived_Fare);
  proche('fuite : η Age / Survived', f('Age').valeur, M.eta_survived_Age);
  proche('fuite : η Pclass / Survived', f('Pclass').valeur, M.eta_survived_Pclass);
  check('fuite injectée détectée et signalée', f('fuite')?.signale === true && f('fuite').valeur > 0.99, `valeur ${f('fuite')?.valeur}`);
  check('aucune autre colonne signalée comme fuite', res.fuite.filter((x) => x.signale).length === 1, res.fuite.filter((x) => x.signale).map((x) => x.colonnes[0]).join(', '));
  const pair = (a, b) => res.redondance.find((x) => x.colonnes.includes(a) && x.colonnes.includes(b));
  proche('redondance : Pearson SibSp / Parch', pair('SibSp', 'Parch').valeur, M.pearson_sibsp_parch);
  proche('redondance : Pearson Pclass / Fare', pair('Pclass', 'Fare').valeur, M.pearson_pclass_fare);

  const e = (col) => res.ecart.find((x) => x.colonnes[0] === col);
  for (const col of ['Age', 'Fare', 'Pclass']) {
    const s = M[`ks_${col}_jeu_aleatoire`];
    proche(`écart KS ${col} : D`, e(col).valeur, s.d, 1e-9);
    check(`écart KS ${col} : valeur p proche de SciPy (à 0,002 près)`, Math.abs(e(col).p - s.p) < 2e-3, `obtenu ${e(col).p}, SciPy ${s.p}`);
  }
  proche('écart χ² Embarked : V', e('Embarked').valeur, M.chi_Embarked_jeu_aleatoire.v, 1e-9);
  proche('écart χ² Embarked : valeur p', e('Embarked').p, M.chi_Embarked_jeu_aleatoire.p, 1e-6);
  proche('écart χ² Sex : V', e('Sex').valeur, M.chi_sex_jeu_aleatoire.v, 1e-9);
  check('séparation aléatoire : aucune colonne signalée', res.ecart.every((x) => !x.signale), res.ecart.filter((x) => x.signale).map((x) => `${x.colonnes[0]} D=${x.valeur.toFixed(3)}`).join(', ') || 'aucune');

  res = await runMl({ colonne: 'jeu_biaise', entrainement: 'train', test: 'test' });
  check('séparation biaisée : Sex signalée', res.ecart.find((x) => x.colonnes[0] === 'Sex')?.signale === true, `V = ${res.ecart.find((x) => x.colonnes[0] === 'Sex')?.valeur}`);
  proche('séparation biaisée : V Embarked', res.ecart.find((x) => x.colonnes[0] === 'Embarked').valeur, M.chi_Embarked_jeu_biaise.v, 1e-9);
  proche('séparation biaisée : KS Age D', res.ecart.find((x) => x.colonnes[0] === 'Age').valeur, M.ks_Age_jeu_biaise.d, 1e-9);

  /* ============================================================ 5. ensembles de règles */
  console.log('\n— Ensembles de règles');
  ds = await open('/public/demo/titanic.csv', 'titanic.csv');
  await page.evaluate(async () => {
    const t = window.__t;
    const regles = [
      Object.assign(t.model.newRule('non_vide', 'Age'), { id: 'a' }),
      Object.assign(t.model.newRule('plage', 'Fare'), { id: 'b', min: '0', max: '300' }),
      Object.assign(t.model.newRule('valeurs_autorisees', 'Sex'), { id: 'c', valeurs: ['male', 'female'] }),
    ];
    await t.store.saveRuleSet(t.rset.makeRuleSet('Titanic · contrôle de base', regles, { cible: 'Survived', separation: null, seuils: t.mlm.SEUILS_DEFAUT }));
  });
  await page.reload();
  const sauve = await page.evaluate(async () => {
    const t = {};
    t.store = await import('/src/rules-store/storage.ts');
    t.rset = await import('/src/rules-store/ruleset.ts');
    const liste = await t.store.listRuleSets();
    const json = JSON.stringify(liste[0]);
    return { n: liste.length, nom: liste[0]?.nom, regles: liste[0]?.regles.length, cible: liste[0]?.roles?.cible, aller: t.rset.parseRuleSet(json).regles.length };
  });
  check('ensemble retrouvé après rechargement de la page', sauve.n >= 1 && sauve.nom === 'Titanic · contrôle de base' && sauve.regles === 3, JSON.stringify(sauve));
  egal('rôle cible conservé avec l\'ensemble', sauve.cible, 'Survived');
  egal('export puis import : même nombre de règles', sauve.aller, 3);

  // copie de Titanic avec deux colonnes renommées (Age → age_passager, Sex → sex en minuscules)
  const csv = (await (await fetch(`${BASE}/public/demo/titanic.csv`)).text()).replace(/^([^\n]*)/, (h) => h.replace('Age', 'age_passager').replace('Sex', 'sex'));
  const appl = await page.evaluate(async (texte) => {
    const t = {};
    t.load = await import('/src/engine/load.ts');
    t.run = await import('/src/engine/rules/run.ts');
    t.store = await import('/src/rules-store/storage.ts');
    const ds = await t.load.loadFile(new File([texte], 'copie.csv'), null, () => {});
    const set = (await t.store.listRuleSets())[0];
    const out = [];
    for (const regle of set.regles) {
      const absentes = t.run.absentColumns(regle, ds.columns);
      const res = absentes.length ? null : await t.run.runRule(regle, ds.columns);
      out.push({ id: regle.id, absentes, enDefaut: res?.enDefaut ?? null });
    }
    return out;
  }, csv);
  check('ensemble sur copie : règle Age signalée comme absente', JSON.stringify(appl[0].absentes) === JSON.stringify(['Age']), JSON.stringify(appl[0]));
  egal('ensemble sur copie : la règle Fare [0 ; 300] s\'applique', appl[1].enDefaut, T.fare_sup_300);
  check('ensemble sur copie : colonne retrouvée sans tenir compte de la casse (Sex → sex)', appl[2].absentes.length === 0 && appl[2].enDefaut === 0, JSON.stringify(appl[2]));

  /* ============================================================ 6. rapport */
  console.log('\n— Rapport');
  const rapport = await page.evaluate(async () => {
    const t = {};
    t.load = await import('/src/engine/load.ts');
    t.run = await import('/src/engine/rules/run.ts');
    t.model = await import('/src/engine/rules/model.ts');
    t.report = await import('/src/report/build.ts');
    t.mlm = await import('/src/engine/ml/model.ts');
    const ds = await t.load.loadFile(await (async () => new File([await (await fetch('/public/demo/titanic.csv')).arrayBuffer()], 'titanic.csv'))(), null, () => {});
    const regles = [
      Object.assign(t.model.newRule('non_vide', 'Age'), { id: 'a' }),
      Object.assign(t.model.newRule('plage', 'Age'), { id: 'b', min: '0', max: '60' }),
    ];
    const resultats = {};
    for (const r of regles) resultats[r.id] = await t.run.runRule(r, ds.columns);
    const html = t.report.buildReport({ dataset: ds, nomEnsemble: 'Essai', regles, resultats, roles: t.mlm.ROLES_VIDES, ml: null });
    return { html, a: resultats.a.enDefaut, b: resultats.b.enDefaut };
  });
  check('rapport : autonome (aucune ressource externe)', !/(src|href)=["']https?:/.test(rapport.html) && !/<script/i.test(rapport.html));
  check('rapport : chiffres identiques à ceux de l\'interface', rapport.html.includes(`${rapport.a} en défaut`) && rapport.html.includes(`${rapport.b} en défaut`), `${rapport.a} et ${rapport.b}`);
  check('rapport : nom du fichier et de l\'ensemble', rapport.html.includes('titanic.csv') && rapport.html.includes('Essai'));

  /* ============================================================ 7. interface, au clavier */
  console.log('\n— Interface');
  await page.goto(BASE);
  await page.waitForSelector('text=Comment ça marche');
  await page.screenshot({ path: path.join(CAP, '01-accueil.png') });
  // parcours au clavier : Tab jusqu'au bouton « Titanic », Entrée
  let atteint = false;
  for (let i = 0; i < 15 && !atteint; i++) {
    await page.keyboard.press('Tab');
    atteint = await page.evaluate(() => document.activeElement?.textContent === 'Titanic');
  }
  check('clavier : bouton de démonstration atteint avec Tab', atteint);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.fichier', { timeout: 60000 });
  check('clavier : jeu de démonstration chargé avec Entrée', (await page.textContent('.fichier')).includes('891 lignes'));

  // ajouter une règle depuis la fiche de colonne
  await page.getByRole('button', { name: 'Age', exact: true }).click();
  await page.getByLabel('Ajouter une règle').selectOption('plage');
  await page.getByLabel('Minimum', { exact: true }).fill('0');
  await page.getByLabel('Maximum', { exact: true }).fill('60');
  await page.getByRole('button', { name: 'Enregistrer la règle' }).click();
  await page.waitForSelector('.regle .pastille.ko', { timeout: 30000 });
  check('interface : la règle de plage s\'affiche avec son verdict', (await page.textContent('.regle .pastille')).includes('Échouée'));
  await page.screenshot({ path: path.join(CAP, '02-colonne.png') });

  await page.getByRole('button', { name: /Tableau de bord/ }).click();
  await page.waitForSelector('.synthese');
  await page.getByRole('button', { name: 'Toutes les lignes' }).click();
  await page.waitForSelector('.fautives td.cause');
  check('interface : lignes fautives avec la cellule en cause mise en évidence', (await page.locator('.fautives td.cause').count()) > 0);
  check('interface : pagination des lignes fautives', (await page.textContent('.pagination')).includes('sur 22'));
  await page.screenshot({ path: path.join(CAP, '03-tableau-de-bord.png') });

  await page.getByRole('button', { name: 'Machine learning' }).click();
  await page.getByLabel('Colonne cible').selectOption('Survived');
  await page.getByRole('button', { name: 'Lancer les contrôles' }).click();
  await page.waitForSelector('.ml-bloc table', { timeout: 120000 });
  await page.screenshot({ path: path.join(CAP, '04-machine-learning.png') });

  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  await page.waitForSelector('.aide-entree');
  const entrees = await page.locator('.aide-entree').count();
  egal('aide : une entrée par type de règle, contrôle ML et notion', entrees, 12 + 4 + 5);
  await page.screenshot({ path: path.join(CAP, '05-aide.png') });

  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter le rapport' }).click()]);
  const contenu = fs.readFileSync(await dl.path(), 'utf8');
  check('rapport téléchargé depuis l\'interface', contenu.includes('Rapport de qualité des données') && contenu.includes('titanic.csv'));

  check('aucune erreur dans la console du navigateur', erreursPage.length === 0, erreursPage.slice(0, 3).join(' | '));

  /* ============================================================ 8. gros fichiers */
  if (GROS) {
    console.log('\n— Gros fichiers');
    await page.goto(BASE);
    await installer();
    for (const n of ['1m', '3m']) {
      const fichier = path.join(ROOT, `tests/fixtures/gros_${n}.csv`);
      if (!fs.existsSync(fichier)) {
        console.log(`(absent : ${fichier})`);
        continue;
      }
      const t0 = Date.now();
      const out = await page
        .evaluate(async (url) => {
          const t = window.__t;
          const ds = await t.open(url, 'gros.csv');
          const mesures = { chargementMs: ds.loadMs, lignes: ds.rows, colonnes: ds.columns.length, etapes: t.etapes.filter((_, i, a) => i === a.length - 1 || a[i + 1][0].slice(0, 12) !== _[0].slice(0, 12)) };
          for (const [nom, type, col, patch] of [
            ['non_vide', 'non_vide', 'entier_0', {}],
            ['plage', 'plage', 'decimal_0', { min: '0', max: '100' }],
            ['aberrantes', 'aberrantes', 'decimal_0', {}],
            ['unique', 'unique', '', { colonnes: ['entier_0'] }],
          ]) {
            const d0 = performance.now();
            const r = await t.rule(type, col, patch);
            mesures[nom] = { ms: Math.round(performance.now() - d0), enDefaut: r.enDefaut, erreur: r.erreur ?? null };
          }
          return mesures;
        }, `/tests/fixtures/gros_${n}.csv`)
        .catch((err) => ({ erreur: String(err).slice(0, 200) }));
      console.log(`gros_${n} : `, JSON.stringify(out), `(${Math.round((Date.now() - t0) / 1000)} s au total)`);
      if (out.erreur) check(`gros fichier ${n} : chargement`, false, out.erreur);
      else check(`gros fichier ${n} : ${out.lignes.toLocaleString('fr-FR')} lignes chargées en ${(out.chargementMs / 1000).toFixed(1)} s`, out.lignes > 0, JSON.stringify(out));
    }
  }
} catch (e) {
  ko++;
  console.error('ERREUR DU TEST :', e);
} finally {
  await browser?.close();
  vite.kill();
}

const total = lignes.length;
const md = ['# Vérification de Crible', '', `Résultat : ${total - ko} vérifications réussies sur ${total}.`, '', '| | Vérification | Détail |', '|---|---|---|', ...lignes.map((l) => `| ${l.ok ? 'OK' : '**KO**'} | ${l.nom} | ${l.detail.replaceAll('|', '/')} |`)].join('\n');
fs.writeFileSync(path.join(ROOT, 'tests/resultats.md'), md + '\n');
console.log(`\n${total - ko} / ${total} vérifications réussies.`);
process.exit(ko ? 1 : 0);
