# Crible — plan complet

**État : fixé le 2026-11-05. Étapes 0 à 11 faites et vérifiées le 2026-11-05 (voir `tests/resultats.md`). La mise en ligne reste à faire par Enzo (voir le README).** Chaque choix renvoie à sa décision dans `decision.md` (D-xxx).
Une étape n'est terminée que lorsque son critère de fin est vérifié. Pas d'échéance (D-024).

---

## 1. Ce que fait Crible

Crible lit un fichier CSV ou Excel (jusqu'à quelques millions de lignes), applique un ensemble de
règles écrites par l'utilisateur, et montre ce qui
ne va pas avant qu'on exploite les données en analyse ou en machine learning. Il produit une
interface d'exploration et un rapport exportable. Tout se passe dans le navigateur : les données
ne quittent jamais la machine (D-001, D-012).

**Public** : analystes et data scientists confirmés. L'interface est dense et rapide ; les
explications sont regroupées dans une page d'aide (D-003, D-013).

**Usage** : audit ponctuel d'un fichier (D-004).

**Ce que Crible ne fait pas** : il ne corrige pas les données, ne donne pas de score global et ne
recommande pas de correction (D-010).

## 2. Seules les règles mesurent (D-023)

Crible ne calcule rien d'office. Une colonne affiche seulement son type, quelques valeurs
d'exemple et le nombre de lignes. **Toute mesure vient d'une règle** : « âge entre 0 et 120 »,
« manquants ≤ 5 % », « identifiant unique », « au plus 1 % de valeurs aberrantes ». Chaque règle
réussit ou échoue, et le tableau de bord ne montre que ces résultats. L'analyste décide de ce qu'il
contrôle et de ses seuils ; l'outil ne juge jamais à sa place.

## 3. Architecture (D-012, D-017)

```
navigateur
├── fil principal : React + TypeScript (interface)
│     └── appelle le worker par messages typés
└── Web Worker : DuckDB-WASM (calcul)
      ├── table `donnees` : le fichier chargé
      ├── exemples et types des colonnes
      └── requêtes de règles
IndexedDB : ensembles de règles sauvegardés (jamais les données)
```

- **Aucun serveur.** Le site est statique, hébergeable gratuitement.
- **DuckDB-WASM dans un Web Worker**, pour que l'interface reste fluide pendant les calculs. Toutes
  les mesures et tous les contrôles sont traduits en requêtes SQL.
- **Le fichier est lu sur place** : il est enregistré auprès de DuckDB sans copie inutile en
  mémoire JavaScript.
- **Limite de mémoire** : DuckDB-WASM dispose d'environ 4 Go dans un onglet. Au-delà de quelques
  millions de lignes larges, Crible prévient l'utilisateur au lieu de planter (voir l'étape 0).

### Pile technique
| Rôle | Outil |
|---|---|
| Application | React 19, TypeScript (strict), Vite |
| Calcul | DuckDB-WASM |
| Lecture Excel | à trancher à l'étape 0 : extension Excel de DuckDB, ou SheetJS Community Edition (licence Apache 2.0, distribuée par cdn.sheetjs.com, pas par npm) |
| Statistiques non disponibles en SQL | petites fonctions TypeScript, vérifiées contre SciPy (loi de Kolmogorov, loi du χ²) |
| Graphiques | SVG écrit à la main (histogrammes, barres) : pas de bibliothèque lourde pour quelques formes |
| Stockage local | IndexedDB |
| Vérifications | à l'étape 11 : Vitest pour le moteur et les statistiques, Playwright pour les parcours d'interface |

### Arborescence prévue
```
crible/
├── decision.md · plan.md · README.md
├── design/logo/            logos définitifs (SVG vectorisés)
├── src/
│   ├── engine/             tout ce qui tourne dans le worker
│   │   ├── worker.ts       point d'entrée, protocole de messages
│   │   ├── load.ts         lecture CSV / Excel, détection des types
│   │   ├── columns.ts      types et valeurs d'exemple
│   │   ├── rules/          un fichier par type de règle → SQL
│   │   ├── ml/             contrôles machine learning
│   │   └── stats.ts        lois statistiques en TypeScript
│   ├── rules-store/        ensembles de règles : format, IndexedDB, import/export
│   ├── ui/                 écrans et composants React
│   ├── report/             rapport HTML autonome
│   └── help/               contenu de la page d'aide
├── public/demo/            Titanic, Wine Quality (avec leur licence)
└── tests/                  fichiers piégés et valeurs de référence
```

## 4. Chargement du fichier (D-005, D-006)

- **Entrée** : glisser-déposer ou sélection de fichier, `.csv` ou `.xlsx`.
- **CSV** :
  - détection du séparateur (`,` `;` tabulation `|`), de l'encodage (UTF-8, ou Windows-1252 en
    secours) et de la ligne d'en-tête ;
  - nombres à virgule décimale (« 3,14 ») reconnus quand le séparateur est le point-virgule.
- **Excel** : l'utilisateur choisit la feuille si le classeur en contient plusieurs ; les cellules
  fusionnées et les lignes vides de tête sont signalées.
- **Types détectés** par colonne : entier, décimal, booléen, date, date et heure, texte. Chacun est
  modifiable à la main, et les règles de la colonne se recalculent.
- **Les échecs de conversion font partie du diagnostic.** Si une colonne est déclarée numérique,
  les valeurs qui ne s'y convertissent pas sont comptées et montrées, pas jetées : c'est l'un des
  problèmes de validité (D-007).
- **Volume** : une barre de progression pendant la lecture, et un avertissement explicite si la
  mémoire disponible ne suffit pas.

## 5. Ce qu'affiche une colonne (D-023)

- Nom, type détecté (modifiable), nombre de lignes, et dix valeurs d'exemple tirées du fichier.
- Les règles de la colonne avec leur verdict, et **les mesures que ces règles ont calculées** : une
  règle de plage montre le minimum et le maximum observés, une règle « non vide » la part de
  manquants, une règle « valeurs aberrantes » les bornes de Tukey, etc.
- Aucune autre mesure n'est calculée.

## 6. Les règles (D-008, D-018)

### Types de règles
| Type | S'applique à | Contrôle |
|---|---|---|
| Non vide | une colonne | part de manquants ≤ seuil (0 % par défaut) |
| Unique | une colonne ou un groupe de colonnes | aucune valeur (ou combinaison) répétée |
| Plage | colonne numérique ou date | valeur dans [min ; max], bornes optionnelles, incluses ou non |
| Format | colonne texte | e-mail, numéro de téléphone, code postal, date selon un format donné, nombre, ou motif personnalisé (expression régulière) |
| Valeurs autorisées | une colonne | valeur dans une liste, avec ou sans respect de la casse |
| Entre colonnes | deux colonnes | `a ≥ b`, `a > b`, `a = b`, `a ≠ b`, et « si `a` est renseigné, `b` aussi » |
| Type | une colonne | toutes les valeurs se convertissent dans le type attendu |
| Doublons | le jeu | part de lignes en double (toutes colonnes identiques) ≤ seuil |
| Valeurs aberrantes | colonne numérique | part de valeurs hors [Q1 − 1,5·IQR ; Q3 + 1,5·IQR] ≤ seuil (méthode de Tukey, IQR = Q3 − Q1) |
| Non constante | une colonne | au moins N valeurs distinctes, et la valeur la plus fréquente ≤ seuil (99 % par défaut) |
| Distribution | colonne catégorielle ou numérique | modalité dominante ≤ seuil (catégorielle), coefficient d'asymétrie ≤ seuil en valeur absolue (numérique) |
| Texte propre | colonne texte | pas d'espace en début ou en fin de valeur, pas de variantes de casse d'une même valeur |

Chaque règle a :
- une **gravité** : bloquante ou avertissement ;
- une **tolérance** facultative, exprimée en part de lignes en défaut acceptée.

### Comment une règle s'exécute
Les douze types couvrent toutes les dimensions de D-007. Chaque type de règle se traduit en une requête SQL qui compte les lignes en défaut et en extrait un
échantillon. Exemple pour une plage :

```sql
SELECT count(*) FILTER (WHERE "age" < 0 OR "age" > 120) AS en_defaut,
       count(*) FILTER (WHERE "age" IS NOT NULL)        AS evaluees
FROM donnees;
```

Le résultat d'une règle : lignes évaluées, lignes en défaut, part en défaut, verdict (réussie ou
échouée, compte tenu de la tolérance), et les 50 premières lignes fautives avec leur numéro dans
le fichier.

**Les manquants ne sont pas un défaut de plage ou de format** : ils relèvent de la règle « non
vide ». Ainsi, un même problème n'est jamais compté deux fois.

### Créer une règle (D-018)
- Sur la fiche d'une colonne, un menu « ajouter une règle » propose les types compatibles avec sa
  colonne. L'utilisateur saisit ses seuils ; la règle s'exécute dès qu'elle est enregistrée, avec
  les mesures qu'elle a calculées sous les yeux pour l'ajuster.
- Les règles entre colonnes se créent dans un petit éditeur : colonne A, opérateur, colonne B.
- Le résultat s'affiche dès que la règle est enregistrée.

### Ensembles de règles
Format JSON versionné :

```json
{
  "format": "crible/regles",
  "version": 1,
  "nom": "Titanic · contrôle de base",
  "roles": { "cible": "Survived", "separation": { "colonne": "jeu", "entrainement": "train", "test": "test" } },
  "regles": [
    { "id": "r1", "type": "plage", "colonne": "Age", "min": 0, "max": 120, "gravite": "bloquante" },
    { "id": "r2", "type": "non_vide", "colonne": "Embarked", "seuil": 0.01, "gravite": "avertissement" }
  ]
}
```

- **Sauvegarde** : les ensembles sont gardés dans le navigateur (IndexedDB), et s'exportent et
  s'importent en fichier `.json`.
- **Réutilisation** : appliqué à un autre jeu, un ensemble retrouve ses colonnes par leur nom. Les
  colonnes absentes sont signalées, et les règles concernées sont mises de côté, pas supprimées.
- **Rôles ML** : c'est l'ensemble de règles qui déclare la colonne cible et la séparation
  entraînement / test (D-009).

## 7. Les contrôles machine learning (D-009)

Ils s'activent seulement quand l'ensemble de règles déclare les rôles concernés. Leurs seuils sont
réglables et figurent dans le rapport.

| Contrôle | Méthode | Signal par défaut |
|---|---|---|
| Déséquilibre de la cible | effectif de chaque classe, rapport classe la plus rare / classe la plus fréquente | rapport < 0,1 |
| Fuite de cible | lien entre chaque colonne et la cible : corrélation de Spearman (numérique avec numérique), rapport de corrélation η (numérique avec catégorielle), V de Cramér corrigé du biais (catégorielle avec catégorielle) | lien ≥ 0,95 |
| Colonnes redondantes | corrélation de Pearson entre colonnes numériques ; V de Cramér corrigé entre colonnes catégorielles. Pas de comparaison entre une numérique et une catégorielle, et au plus 60 colonnes numériques et 15 catégorielles | lien ≥ 0,9 |
| Écart entre entraînement et test | colonnes numériques : statistique D de Kolmogorov-Smirnov à deux échantillons, valeur p approchée (série asymptotique, correction de Stephens) ; colonnes catégorielles : test du χ² et V de Cramér | D ≥ 0,1, ou V ≥ 0,1 |

Deux choix de méthode à noter :
- **Sur des millions de lignes, presque tout écart devient « statistiquement significatif ».**
  Crible juge donc sur la taille de l'écart (D, V), et affiche la valeur p à titre indicatif.
- **La fuite de cible ne se prouve pas par une mesure** : une colonne très liée à la cible peut
  être légitime. Crible signale la colonne, et c'est l'analyste qui tranche.

## 8. L'interface (D-003, D-010, D-015)

- **Accueil** : déposer un fichier, ou ouvrir un jeu de démonstration en un clic.
- **Vue du jeu** : une ligne par colonne, avec type, valeurs d'exemple et nombre de règles en
  échec. Le tableau se trie et se filtre.
- **Fiche de colonne** : type, exemples, les règles de la colonne avec leurs résultats et leurs
  mesures, et le menu « ajouter une règle ».
- **Règles** : la liste des règles de l'ensemble actif (modifier, désactiver, supprimer), les rôles
  ML, et la sauvegarde, l'export ou l'import de l'ensemble.
- **Tableau de bord** : chaque règle avec son verdict, sa gravité et sa part de lignes en défaut,
  filtrable par colonne, par type et par verdict. Un clic ouvre les lignes fautives.
- **Lignes fautives** : les lignes en défaut d'une règle, avec la cellule en cause mise en évidence.
- **Aide** : voir la section 10.
- **Langue** : tout en français (D-015).
- **Identité visuelle** : vermillon `#E8432A`, encre `#1C1412`, fond `#F6F1EC` (D-022). Le
  vermillon est réservé à ce qui est en défaut ; le vert de validation se construit en OKLCH à la
  même clarté que le vermillon, et les contrastes sont vérifiés.
- **Clavier et lecteur d'écran** : tous les écrans se parcourent au clavier, et les verdicts sont
  annoncés en texte, jamais par la couleur seule.

## 9. Le rapport exportable (D-010)

- Un **fichier HTML autonome**, sans dépendance externe, imprimable en PDF depuis le navigateur.
- **Contenu** :
  - le fichier analysé (nom, taille, nombre de lignes et de colonnes, date de l'analyse) ;
  - l'ensemble de règles appliqué ;
  - les seuils utilisés ;
  - le résultat de chaque règle et les mesures qu'elle a calculées ;
  - les contrôles ML ;
  - des exemples de lignes fautives.
- **Aucune donnée au-delà des exemples choisis**, pour que le rapport puisse être partagé sans
  diffuser le fichier entier.

## 10. La page d'aide (D-013)

Une entrée par type de règle et par contrôle ML, structurée en trois points :
- ce que ça mesure ;
- comment c'est calculé, avec la formule ;
- quand ça pose problème, avec un exemple chiffré.

Chaque terme affiché dans l'interface renvoie vers son entrée.

## 11. Vérifier que les chiffres sont justes (à la fin, étape 11)

Un outil de qualité des données qui se trompe dans ses comptes n'a aucune valeur. D'où trois
garde-fous, tous mis en place **à la fin du développement** (D-025) :
- **Valeurs de référence** : chaque mesure calculée par une règle est recalculée à part avec pandas
  sur Titanic et Wine Quality, puis comparée aux chiffres de Crible.
- **Fichiers piégés** : des CSV fabriqués avec des défauts connus et dénombrés (manquants, doublons,
  dates impossibles, nombres stockés en texte, séparateur point-virgule, encodage Windows-1252).
  Chaque règle doit retrouver le nombre exact de défauts.
- **Lois statistiques** : les valeurs p et les statistiques de Kolmogorov-Smirnov et du χ² sont
  comparées à SciPy.

## 12. Étapes

Pas de durées estimées et pas d'échéance (D-024, D-025). Chaque étape se termine quand ce qu'elle décrit fonctionne ; on ne fait pas de tests entre les étapes, ils sont regroupés à l'étape 11.

### Étape 0 — Socle et vérifications techniques  ✅ écrite
- Projet Vite + React + TypeScript, DuckDB-WASM dans un worker, protocole de messages typé.
- Mesurer, sur le PC d'Enzo, la lecture et l'agrégation d'un CSV de 1 et de 3 millions de lignes
  à 20 colonnes, ainsi que la consommation de mémoire.
- Choisir la lecture d'Excel (extension DuckDB ou SheetJS) et la consigner dans `decision.md`.
- **Terminée quand** : 1 M de lignes chargées et agrégées en moins de 10 s ; un `.xlsx` de 100 000 lignes
  chargé ; la limite de taille pratique mesurée et consignée.

### Étape 1 — Chargement et types  ✅ écrite
- Détection du séparateur, de l'encodage, de l'en-tête et des types ; correction manuelle des
  types ; comptage des échecs de conversion.
- **Terminée quand** : les fichiers piégés de chargement (point-virgule, Windows-1252, virgule décimale,
  en-tête absent) sont tous lus correctement.

### Étape 2 — Vue du jeu et fiche de colonne  ✅ écrite
- Type, exemples, nombre de lignes ; emplacement des règles et de leurs mesures.
- **Terminée quand** : Titanic et Wine Quality s'affichent, types corrects, exemples tirés du fichier.

### Étape 3 — Moteur de règles  ✅ écrite
- Les douze types de règles traduits en SQL, avec mesures, verdict, tolérance et échantillon de
  lignes fautives.
- **Terminée quand** : sur les fichiers piégés, chaque type de règle retrouve exactement le nombre de défauts
  attendu, et ses mesures correspondent aux valeurs calculées avec pandas.

### Étape 4 — Créer, sauvegarder, réutiliser les règles  ✅ écrite
- Menu « ajouter une règle », éditeur entre colonnes, liste des règles,
  ensembles nommés dans IndexedDB, export et import en `.json`, rapprochement des colonnes par
  leur nom.
- **Terminée quand** : un ensemble créé sur Titanic est retrouvé après fermeture du navigateur, puis appliqué
  à une copie de Titanic dont deux colonnes ont été renommées ; les deux colonnes absentes sont
  signalées.

### Étape 5 — Contrôles machine learning  ✅ faite
- Les quatre contrôles de la section 7 et leurs lois statistiques en TypeScript.
- **Terminée quand** : une fuite de cible injectée exprès dans Titanic est signalée ; une séparation
  entraînement / test biaisée exprès est signalée ; une séparation aléatoire ne l'est pas ; les
  statistiques correspondent à SciPy.

### Étape 6 — Tableau de bord et lignes fautives  ✅ faite
- Filtres, tris, accès aux lignes fautives, cellule en cause mise en évidence.
- **Terminée quand** : depuis le tableau de bord, on atteint en deux clics les lignes fautives de n'importe
  quelle règle, sur un fichier de 1 M de lignes, sans gel de l'interface.

### Étape 7 — Rapport exportable  ✅ faite
- **Terminée quand** : le rapport s'ouvre hors connexion, s'imprime en PDF lisible, et ses chiffres sont
  identiques à ceux de l'interface.

### Étape 8 — Page d'aide  ✅ faite
- **Terminée quand** : chaque terme affiché dans l'interface et dans le rapport a son entrée dans l'aide.

### Étape 9 — Identité visuelle et finitions  ✅ faite
- Logo et couleurs (D-021, D-022), états vides, messages d'erreur, navigation au clavier,
  contrastes.
- **Terminée quand** : parcours complet au clavier ; tous les couples texte / fond atteignent au moins 4,5:1.

### Étape 10 — Démonstration et mise en ligne  ✅ faite
- Titanic et Wine Quality en un clic, avec leur source et leur licence ; README en français ;
  mise en ligne statique.
- **Terminée quand** : la version en ligne charge les deux jeux de démonstration et produit leur rapport.


### Étape 11 — Vérification finale  ✅ faite
- Une fois toutes les fonctions faites : les trois garde-fous de la section 11 (valeurs de référence
  contre pandas, fichiers piégés, lois statistiques contre SciPy), et les critères « terminée
  quand » de chaque étape, vérifiés d'un seul bloc.
- Les mesures de taille (1 M et 3 M de lignes, mémoire) restent faites à l'étape 0, parce qu'elles
  décident de l'architecture.

## 13. Risques

| Risque | Conséquence | Parade |
|---|---|---|
| Mémoire du navigateur insuffisante sur les gros fichiers | onglet qui plante | limite mesurée à l'étape 0, avertissement avant chargement |
| Lecture d'Excel incomplète dans le navigateur | formats non lus | choix tranché à l'étape 0, cas difficiles listés dans l'aide |
| Détection de types trompeuse (codes postaux lus comme nombres) | faux défauts | type toujours modifiable à la main, règles recalculées |
| Contrôles ML mal interprétés (fuite « certaine ») | mauvaise décision de l'analyste | formulation prudente, méthode et seuil affichés, explication dans l'aide |
| Chiffres faux | outil sans valeur | valeurs de référence et fichiers piégés (section 11) |

## 14. Hors périmètre
- Suivi d'un jeu dans le temps (D-004).
- Parquet, JSON, bases SQL (D-005).
- Traitement distribué (D-006).
- Score global, recommandations, correction automatique (D-010).
- Règles suggérées automatiquement ou saisies en phrases (D-018).
- Serveur ou API (D-017).
- Présentation de Crible dans le portfolio : à décider une fois Crible terminé.

## 15. Points ouverts
Aucun.
