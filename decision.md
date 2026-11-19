# Crible — décisions

Journal des choix arrêtés pour le projet. Une décision par entrée : ce qui est décidé, pourquoi,
et la date. On ne réécrit pas une décision passée : si elle change, on en ajoute une nouvelle qui
la remplace, et on le note.

> Le projet s'appelait d'abord « Data Quality Monitor » ; il s'appelle Crible depuis D-019.

## Décisions

### D-001 — Objet du projet (2026-11-05)
Outil d'évaluation de la qualité des données (*Data Quality Assessment*) : il aide un utilisateur
à examiner un jeu de données, à y détecter les problèmes de qualité et à comprendre son état
avant de l'exploiter dans une analyse ou un modèle de machine learning. Projet du portfolio
d'Enzo Dylan, dans son propre dossier.

### D-002 — Démarrage à partir de zéro (2026-11-05)
Construit de zéro, sans reprendre de code ni de structure d'un projet existant.

### D-003 — Public : analystes confirmés (2026-11-05)
L'outil s'adresse à des analystes et data scientists qui savent ce qu'ils cherchent. Priorité à
la vitesse et à la densité d'information plutôt qu'à l'accompagnement pas à pas.

### D-004 — Usage : audit ponctuel (2026-11-05)
On charge un fichier, on obtient son diagnostic. Le suivi d'un même jeu dans le temps
(comparaison de versions, dégradation) n'est pas dans le périmètre.

### D-005 — Sources : CSV et Excel (2026-11-05)
Formats d'entrée : CSV et Excel (.xlsx). Parquet, JSON et bases SQL sont hors périmètre.

### D-006 — Volume : jusqu'à quelques millions de lignes (2026-11-05)
L'outil doit rester fluide jusqu'à quelques millions de lignes, ce qui impose un moteur de calcul
colonnaire (DuckDB). Le traitement distribué est hors périmètre.

### D-007 — Problèmes détectés (2026-11-05)
Toutes les dimensions proposées sont retenues :
- valeurs manquantes (complétude) ;
- doublons (unicité) ;
- types et formats incorrects (validité) ;
- valeurs hors plage et valeurs aberrantes ;
- incohérences entre colonnes ;
- colonnes constantes ou presque vides ;
- distributions déséquilibrées.

### D-008 — Contrôles pilotés par des règles (2026-11-05)
Les contrôles sont définis par l'utilisateur sous forme de règles (« âge entre 0 et 120 »).
Deux exigences :
1. définir une règle doit être rapide et sans friction (mécanisme à choisir, voir point ouvert O-2) ;
2. un ensemble de règles se sauvegarde sous un nom et se réutilise plus tard sur d'autres jeux.

### D-009 — Contrôles machine learning, dès la première version (2026-11-05)
Déséquilibre des classes de la cible, fuite de cible, colonnes trop corrélées entre elles, écart
de distribution entre jeu d'entraînement et jeu de test. Ils s'appuient sur les règles : c'est
l'ensemble de règles qui déclare la colonne cible et la séparation entraînement / test, et ces
contrôles ne s'activent que lorsque ces rôles sont déclarés.

### D-010 — Rendu : interface web et rapport exportable (2026-11-05)
L'outil produit une interface web interactive pour explorer les problèmes, et un rapport
exportable. Pas de score de qualité global, pas de recommandations de correction, pas de
correction automatique des données.

### D-011 — Stack : React et API Python (2026-11-05)
Front en React, API en Python (FastAPI). **À concilier avec D-012** : voir point ouvert O-1.

### D-012 — Les données restent dans le navigateur (2026-11-05)
Les données ne quittent jamais la machine de l'utilisateur : le calcul se fait dans le navigateur.
Confidentialité par construction, et hébergement statique gratuit.

### D-013 — Explications dans une page d'aide (2026-11-05)
Les notions affichées (taux de complétude, fuite de cible…) sont expliquées dans une page d'aide
dédiée, pas sur chaque écran. C'est cohérent avec un public confirmé (D-003).

### D-014 — Jeux de démonstration publics (2026-11-05)
La démonstration utilise des jeux publics connus (Titanic, Wine Quality…).

### D-015 — Interface en français (2026-11-05)

### D-016 — Version complète d'emblée, nouveau nom (2026-11-05)
On vise directement une version complète couvrant D-005 à D-010, plutôt qu'une version minimale
enrichie ensuite. Le nom « Data Quality Monitor » est remplacé : choix en cours (point ouvert O-3).

### D-017 — Calcul dans le navigateur avec DuckDB, sans serveur (2026-11-05)
Remplace D-011. L'application est un front React (TypeScript) qui exécute les contrôles avec
DuckDB compilé pour le web (DuckDB-WASM). Pas d'API Python : elle ne pourrait pas lire des données
qui ne quittent pas le navigateur (D-012). Les contrôles sont écrits en SQL et en TypeScript.
Cela tient le volume visé (D-006) et permet un hébergement statique gratuit.

### D-018 — Règles créées depuis la fiche de chaque colonne (2026-11-05)
Précise D-008. Sur la fiche d'une colonne, un menu « ajouter une règle » propose des types prêts
à l'emploi : non vide, unique, plage, format (e-mail, date…), liste de valeurs autorisées, motif.
Les règles entre colonnes passent par un petit éditeur du type « date_fin ≥ date_debut ».
Les règles suggérées automatiquement et la saisie en phrases ne sont pas retenues.
Sauvegarde : un ensemble de règles porte un nom, est conservé dans le navigateur et s'exporte en
fichier `.json`. Appliqué à un autre jeu, il retrouve ses colonnes par leur nom. L'ensemble de
règles déclare aussi les rôles utiles au machine learning (D-009) : colonne cible, séparation
entraînement / test.

### D-019 — Nom : Crible (2026-11-05)
Remplace « Data Quality Monitor ». *Passer au crible* : examiner dans le moindre détail. Le logo
comporte une loupe. Les propositions de logo sont dans `design/logos.html`.

### D-020 — Logo : le i loupe (2026-11-05)
Piste 1 de la deuxième série (`design/logos.html`). Le point du i de « crible » devient la
lentille d'une loupe, avec un grain rouge ; le fût du i devient le manche, incliné de 11°.
Police : Bricolage Grotesque 800. Encre `#16201d`, rouge `#d9472b`. L'icône est le i loupe seul.
Présentation et déclinaisons dans `design/logo-crible.html` (rendu : `design/logo-crible.png`).
Le texte du logo n'est pas encore vectorisé : il dépend de la police chargée, à corriger avant
de l'utiliser en dehors du navigateur.

### D-021 — Logo : la loupe devient le C (2026-11-05)
Remplace D-020. Le c du mot « crible » est une loupe : l'arc s'ouvre à droite et son bout bas se
prolonge en manche sous la ligne de base ; un grain est posé au centre de la lentille. Le reste du
mot est en Instrument Sans 600. Rendu : `C:\Users\HP\Downloads\portfolio\design\logos-serie4.png`.
La couleur reste à choisir parmi les palettes sourcées de
`C:\Users\HP\Downloads\portfolio\design\logos-couleurs.html`.

### D-022 — Couleur : vermillon de signalement (2026-11-05)
Couleur signature `#E8432A` (oklch(0.63 0.20 33)), le rouge franc de ce qui ne va pas. Encre
`#1C1412`, fond `#F6F1EC`. Dominante claire. Sur l'aplat vermillon, le logo est blanc (contraste
4,0:1 : correct pour un logo, insuffisant pour du texte courant). Fichiers définitifs dans
`design/logo/`.

### D-023 — Le profil ne mesure que ce que les règles demandent (2026-11-05)
Rien n'est calculé d'office : une colonne n'affiche que son type, quelques valeurs d'exemple et les
mesures exigées par ses règles. Les dimensions de D-007 sont donc couvertes par des types de règles
(dont valeurs aberrantes, colonne constante ou presque vide, distribution déséquilibrée).

### D-024 — Pas d'échéance (2026-11-05)
Les étapes suivent l'ordre du plan, sans date limite.

### D-025 — Tests regroupés à la fin, pas de durées estimées (2026-11-05)
Pas de tests entre les étapes : on développe, et tout se vérifie à la fin (étape 11 du plan). Seules
les mesures de taille de l'étape 0 restent faites tout de suite, car elles décident de
l'architecture. Les estimations en jours sont supprimées du plan.

### D-026 — Choix techniques des étapes 0 à 4 (2026-11-05)
- **Pas de worker supplémentaire** : DuckDB-WASM tourne déjà dans son propre Web Worker, donc les
  requêtes sont asynchrones et l'interface reste fluide. Le moteur est appelé directement.
- **Lecture d'Excel : SheetJS Community Edition 0.20.3** (licence Apache 2.0, installée depuis
  cdn.sheetjs.com), chargée à la demande. La feuille est convertie en CSV puis lue comme un CSV.
  L'extension Excel de DuckDB n'est pas utilisée.
- **Tout est lu en texte** (table `brut`), et une vue `donnees` convertit chaque colonne vers son
  type. Les valeurs qui ne se convertissent pas deviennent NULL dans la vue, mais restent dans
  `brut` : c'est ce qui permet de les compter et de les montrer. Changer le type d'une colonne
  recrée simplement la vue, sans recharger le fichier.
- **Douze types de règles**, et non onze comme écrit par erreur dans le plan.
- Les mesures de taille (1 M et 3 M de lignes) n'ont pas été faites : la durée de chargement
  s'affiche en haut de l'écran pour chaque fichier ouvert.
- Rien n'a été exécuté dans un navigateur : le code compile (`tsc` et `vite build`), c'est tout.

### D-027 — Dossier renommé en `crible` (2026-11-05)
Le dossier du projet s'appelait `data-quality-monitor` (nom d'origine). Il est maintenant
`C:\Users\HP\Downloads\crible`.

### D-028 — Choix techniques des étapes 5 à 10 (2026-11-05)
- **Contrôles machine learning** : fuite de cible par corrélation de Spearman (numérique avec
  numérique), rapport de corrélation η (mixte) et V de Cramér corrigé du biais selon Bergsma
  (catégoriel avec catégoriel). Redondance : Pearson entre numériques (une seule requête pour
  100 paires), V de Cramér entre catégorielles ; pas de comparaison entre une numérique et une
  catégorielle, pour garder un coût raisonnable. Écart entraînement / test : D de
  Kolmogorov-Smirnov (calculé en SQL) avec une valeur p approchée, V de Cramér du tableau croisé
  pour les catégorielles. Les colonnes texte à plus de 50 valeurs sont ignorées.
- **Rôles machine learning** (cible, séparation, seuils) enregistrés avec l'ensemble de règles.
- **Tableau de bord** avec synthèse et filtres (résultat, gravité, colonne, type) ; **lignes
  fautives** paginées par 100, cellule en cause surlignée.
- **Rapport** : un seul fichier HTML sans script ni ressource externe, avec au plus 10 lignes
  d'exemple par règle.
- **Aide** : 21 entrées (12 types de règles, 4 contrôles ML, 5 notions), reliées depuis les écrans.
- **Identité** : vermillon `#E8432A` pour l'accent et les filets ; `#C8341D` pour les boutons pleins,
  car le blanc sur `#E8432A` n'atteint que 4,0:1 (5,3:1 avec `#C8341D`). Polices Instrument Sans et
  IBM Plex Mono, installées avec l'application. Le vert de validation est construit en OKLCH.
- **Démonstration** : Titanic, vins rouges et vins blancs (sources dans `public/demo/SOURCES.md`).
  La licence de Titanic n'est pas précisée par son dépôt d'origine.
- **Mise en ligne** : `npm run build` produit un site statique à chemins relatifs. La publication
  elle-même reste à faire par Enzo, car elle demande son compte d'hébergement.

### D-029 — Corrections trouvées à la vérification finale (2026-11-05)
- Un décimal passait pour un entier (le moteur arrondit « 35.5 » en 36 lors d'une conversion) :
  l'entier est maintenant reconnu par motif strict, et une colonne qui contient des décimaux, même
  rares, devient décimale.
- `sniff_csv` renvoie « (empty) » quand le fichier n'a pas de guillemets : traité comme absence de
  guillemet.
- Les dates Excel arrivaient avec une heure : on lit leurs composantes locales, qui sont celles de la
  cellule.
- Le V de Cramér de la référence SciPy n'était pas corrigé du biais (son option `correction` est la
  correction de Yates) : la référence applique maintenant la formule de Bergsma au χ² de SciPy.
- La valeur p de Kolmogorov-Smirnov n'est qu'approchée : SciPy utilise la loi exacte de rang fini.
  La série asymptotique avec correction de Stephens reste à 0,002 de SciPy sur les essais.
- La détection des types prenait 55 s sur 1 million de lignes : échantillon ramené à 50 000 lignes et
  sondes de dates réservées aux colonnes qui ressemblent à des dates.

### D-030 — Résultats de la vérification finale (2026-11-05)
104 vérifications sur 104 réussies (`tests/resultats.md`) : chiffres comparés à pandas et SciPy sur
Titanic, un fichier piégé en Windows-1252, un classeur Excel et des contrôles ML avec fuite et
séparations injectées ; parcours au clavier, rapport, ensembles de règles après rechargement. Mesures
de taille : 1 million de lignes à 20 colonnes chargé en 7,3 s, 3 millions en 11,7 s ; une règle
s'exécute en 0,2 à 1,5 s sur 1 million de lignes, jusqu'à 4,4 s pour l'unicité sur 3 millions.

### D-031 — Publication sur GitHub (2026-11-19)
Dépôt public `github.com/Engoat/crible`, sous licence MIT. Le jeu Titanic reste dans les
démonstrations : son dépôt d'origine n'indique pas de licence, Enzo choisit de le garder en connaissance
de cause (`public/demo/SOURCES.md` le dit).

## Points ouverts

Aucun. Le plan est fixé le 2026-11-05.
