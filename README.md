# Crible

Crible contrôle la qualité d'un jeu de données (CSV ou Excel) avant qu'on l'exploite. On écrit les
règles que les données doivent respecter, et Crible montre ce qui ne va pas, jusqu'aux lignes en
défaut. Tout se passe dans le navigateur : les données ne quittent jamais l'ordinateur, il n'y a pas de
serveur.

## Lancer

```
npm install
npm run dev        # développement, sur http://localhost:5173
npm run build      # vérifie les types et produit le site statique dans dist/
```

## Utiliser

1. Charge un fichier CSV ou Excel, ou ouvre un jeu de démonstration (Titanic, vins).
2. Ouvre une colonne et ajoute des règles : non vide, unique, plage, format, valeurs autorisées, entre
   deux colonnes, type, doublons, valeurs aberrantes, colonne non constante, distribution, texte propre.
3. Le tableau de bord montre le verdict de chaque règle ; « Toutes les lignes » ouvre les lignes en
   défaut, avec la cellule en cause mise en évidence.
4. L'onglet Machine learning contrôle le déséquilibre de la cible, la fuite de cible, les colonnes
   redondantes et l'écart entre entraînement et test, pour les rôles que tu déclares.
5. « Exporter le rapport » produit un fichier HTML autonome, imprimable en PDF.

Un ensemble de règles se sauvegarde sous un nom dans le navigateur, et s'exporte en `.json` pour être
appliqué à un autre fichier : les colonnes sont retrouvées par leur nom. L'onglet Aide explique chaque
mesure.

## Mettre en ligne

`npm run build` produit `dist/`, un site statique qu'on peut déposer tel quel sur n'importe quel
hébergeur de fichiers (GitHub Pages, Netlify, Cloudflare Pages…). Les chemins sont relatifs.

## Limites connues

- Les fichiers sont lus en entier dans la mémoire du navigateur (environ 4 Go au plus pour DuckDB).
  Les mesures faites sur ce poste sont dans `tests/resultats.md`.
- Le type d'une colonne est deviné sur les 50 000 premières lignes ; il se corrige à la main.
- Les feuilles Excel sont lues avec leur première ligne comme en-tête.
- Redondance : les colonnes numériques sont comparées entre elles, les catégorielles entre elles, pas
  une numérique avec une catégorielle.
- La valeur p du test de Kolmogorov-Smirnov est approchée (à 0,002 près de SciPy sur les essais). C'est
  la taille de l'écart qui décide, pas la valeur p.

## Vérifier

```
python tests/fixtures.py        # fabrique les fichiers piégés et les valeurs de référence (pandas, SciPy)
node tests/verifier.mjs         # lance Crible dans un navigateur et compare les chiffres
python tests/fixtures.py --gros && node tests/verifier.mjs --gros   # ajoute les fichiers de 1 et 3 millions de lignes
```

Le résultat s'écrit dans `tests/resultats.md`.

## Données de démonstration et licences

Voir `public/demo/SOURCES.md`. Le jeu Titanic vient d'un dépôt public qui n'indique pas de licence.
Bibliothèques : DuckDB-WASM (MIT), SheetJS Community Edition (Apache 2.0), React (MIT), polices
Instrument Sans et IBM Plex Mono (SIL OFL).

## Licence

Code sous licence MIT (voir `LICENSE`). © 2026 Enzo Dylan.
