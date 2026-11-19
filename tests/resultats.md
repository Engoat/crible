# Vérification de Crible

Résultat : 104 vérifications réussies sur 104.

| | Vérification | Détail |
|---|---|---|
| OK | Titanic : lignes | obtenu 891, attendu 891 |
| OK | Titanic : colonnes | obtenu 12, attendu 12 |
| OK | Titanic : type de PassengerId | obtenu int, attendu int |
| OK | Titanic : type de Survived | obtenu int, attendu int |
| OK | Titanic : type de Pclass | obtenu int, attendu int |
| OK | Titanic : type de Name | obtenu text, attendu text |
| OK | Titanic : type de Sex | obtenu text, attendu text |
| OK | Titanic : type de Age | obtenu double, attendu double |
| OK | Titanic : type de SibSp | obtenu int, attendu int |
| OK | Titanic : type de Parch | obtenu int, attendu int |
| OK | Titanic : type de Ticket | obtenu text, attendu text |
| OK | Titanic : type de Fare | obtenu double, attendu double |
| OK | Titanic : type de Cabin | obtenu text, attendu text |
| OK | Titanic : type de Embarked | obtenu text, attendu text |
| OK | non_vide Age : lignes en défaut | obtenu 177, attendu 177 |
| OK | non_vide Age : lignes évaluées | obtenu 891, attendu 891 |
| OK | non_vide Cabin | obtenu 687, attendu 687 |
| OK | non_vide Embarked | obtenu 2, attendu 2 |
| OK | plage Age [0 ; 60] : en défaut | obtenu 22, attendu 22 |
| OK | plage Age : évaluées | obtenu 714, attendu 714 |
| OK | unique Ticket : lignes concernées | obtenu 344, attendu 344 |
| OK | unique Ticket : valeurs répétées | obtenu 134, attendu 134 |
| OK | unique PassengerId | obtenu 0, attendu 0 |
| OK | doublons | obtenu 0, attendu 0 |
| OK | aberrantes Fare : en défaut | obtenu 116, attendu 116 |
| OK | aberrantes Fare : Q1 | obtenu 7.9104, attendu 7.9104 |
| OK | aberrantes Fare : Q3 | obtenu 31, attendu 31 |
| OK | aberrantes Fare : borne basse | obtenu -26.724, attendu -26.724 |
| OK | aberrantes Fare : borne haute | obtenu 65.6344, attendu 65.6344 |
| OK | valeurs_autorisees Sex = male | obtenu 314, attendu 314 |
| OK | format code postal sur Ticket | obtenu 760, attendu 760 |
| OK | entre colonnes SibSp ≥ Parch | obtenu 101, attendu 101 |
| OK | distribution Fare : asymétrie (SciPy, biais corrigé) | obtenu 4.787316519674892, attendu 4.787316519674893 |
| OK | distribution Age : asymétrie | obtenu 0.38910778230082954, attendu 0.38910778230082677 |
| OK | piégé : lignes | obtenu 402, attendu 402 |
| OK | piégé : colonnes | obtenu 9, attendu 9 |
| OK | piégé : id entier | obtenu int, attendu int |
| OK | piégé : prix décimal à virgule | obtenu {"kind":"double","virgule":true}, attendu {"kind":"double","virgule":true} |
| OK | piégé : date JJ/MM/AAAA | obtenu {"kind":"date","format":"%d/%m/%Y"}, attendu {"kind":"date","format":"%d/%m/%Y"} |
| OK | piégé : code postal reste du texte (zéros initiaux) | obtenu text, attendu text |
| OK | piégé : quantité entière | obtenu int, attendu int |
| OK | piégé : accents correctement lus | Élodie Müller 2 |
| OK | type prix : valeurs non convertibles | obtenu 5, attendu 5 |
| OK | type date : dates impossibles | obtenu 3, attendu 3 |
| OK | non_vide nom | obtenu 6, attendu 6 |
| OK | texte propre : espaces | obtenu 2, attendu 2 |
| OK | texte propre : variantes de casse | obtenu 102, attendu 102 |
| OK | format e-mail | obtenu 4, attendu 4 |
| OK | valeurs autorisées statut | obtenu 3, attendu 3 |
| OK | plage quantité ≥ 0 | obtenu 2, attendu 2 |
| OK | unique id : lignes concernées | obtenu 4, attendu 4 |
| OK | doublons de lignes | obtenu 2, attendu 2 |
| OK | doublons : lignes fautives avec numéro de ligne | ["401","402"] |
| OK | type prix repassé en texte : plus de défaut | obtenu 0, attendu 0 |
| OK | feuilles du classeur | ["Lisez-moi","Ventes"] |
| OK | Excel : lignes | obtenu 60, attendu 60 |
| OK | Excel : type Date | obtenu date, attendu date |
| OK | Excel : type Montant | obtenu double, attendu double |
| OK | Excel : type Quantité | obtenu int, attendu int |
| OK | Excel : type Payé | obtenu bool, attendu bool |
| OK | Excel : somme des montants | obtenu 9239.799999999997, attendu 9239.8 |
| OK | Excel : somme des quantités | obtenu 259, attendu 259 |
| OK | déséquilibre : rapport | obtenu 0.6229508196721312, attendu 0.6229508196721312 |
| OK | fuite : V de Cramér Sex / Survived (SciPy) | obtenu 0.5426213749215026, attendu 0.5426213749215026 |
| OK | fuite : V de Cramér Embarked / Survived | obtenu 0.16605833339661635, attendu 0.16605833339661635 |
| OK | fuite : η Fare / Survived | obtenu 0.2573065223849625, attendu 0.25730652238496243 |
| OK | fuite : η Age / Survived | obtenu 0.07722109457217761, attendu 0.07722109457217761 |
| OK | fuite : η Pclass / Survived | obtenu 0.3384810359610143, attendu 0.33848103596101525 |
| OK | fuite injectée détectée et signalée | valeur 0.9999977803490148 |
| OK | aucune autre colonne signalée comme fuite | fuite |
| OK | redondance : Pearson SibSp / Parch | obtenu 0.41483769862015635, attendu 0.41483769862015646 |
| OK | redondance : Pearson Pclass / Fare | obtenu -0.5494996199439076, attendu -0.5494996199439082 |
| OK | écart KS Age : D | obtenu 0.03398125172318722, attendu 0.03398125172318711 |
| OK | écart KS Age : valeur p proche de SciPy (à 0,002 près) | obtenu 0.9987355645257239, SciPy 0.9981414269625336 |
| OK | écart KS Fare : D | obtenu 0.024659312134977296, attendu 0.02465931213497735 |
| OK | écart KS Fare : valeur p proche de SciPy (à 0,002 près) | obtenu 0.9999770363561977, SciPy 0.9999540372126058 |
| OK | écart KS Pclass : D | obtenu 0.024183430672723327, attendu 0.024183430672723327 |
| OK | écart KS Pclass : valeur p proche de SciPy (à 0,002 près) | obtenu 0.99998590364221, SciPy 0.9999704966757755 |
| OK | écart χ² Embarked : V | obtenu 0.011385558001477515, attendu 0.011385558001477515 |
| OK | écart χ² Embarked : valeur p | obtenu 0.9440077068520943, attendu 0.9440077068520943 |
| OK | écart χ² Sex : V | obtenu 0.01593521918727161, attendu 0.01593521918727161 |
| OK | séparation aléatoire : aucune colonne signalée | aucune |
| OK | séparation biaisée : Sex signalée | V = 1 |
| OK | séparation biaisée : V Embarked | obtenu 0.12256919037251324, attendu 0.12256919037251322 |
| OK | séparation biaisée : KS Age D | obtenu 0.10380350663520335, attendu 0.10380350663520335 |
| OK | ensemble retrouvé après rechargement de la page | {"n":1,"nom":"Titanic · contrôle de base","regles":3,"cible":"Survived","aller":3} |
| OK | rôle cible conservé avec l'ensemble | obtenu Survived, attendu Survived |
| OK | export puis import : même nombre de règles | obtenu 3, attendu 3 |
| OK | ensemble sur copie : règle Age signalée comme absente | {"id":"a","absentes":["Age"],"enDefaut":null} |
| OK | ensemble sur copie : la règle Fare [0 ; 300] s'applique | obtenu 3, attendu 3 |
| OK | ensemble sur copie : colonne retrouvée sans tenir compte de la casse (Sex → sex) | {"id":"c","absentes":[],"enDefaut":0} |
| OK | rapport : autonome (aucune ressource externe) |  |
| OK | rapport : chiffres identiques à ceux de l'interface | 177 et 22 |
| OK | rapport : nom du fichier et de l'ensemble |  |
| OK | clavier : bouton de démonstration atteint avec Tab |  |
| OK | clavier : jeu de démonstration chargé avec Entrée |  |
| OK | interface : la règle de plage s'affiche avec son verdict |  |
| OK | interface : lignes fautives avec la cellule en cause mise en évidence |  |
| OK | interface : pagination des lignes fautives |  |
| OK | aide : une entrée par type de règle, contrôle ML et notion | obtenu 21, attendu 21 |
| OK | rapport téléchargé depuis l'interface |  |
| OK | aucune erreur dans la console du navigateur |  |
| OK | gros fichier 1m : 1 000 000 lignes chargées en 7.3 s | {"chargementMs":7273,"lignes":1000000,"colonnes":20,"etapes":[["Lecture du fichier…",3058],["Analyse de la structure…",3063],["Détection des types… 20 / 20 colonnes",7118],["Préparation des données…",8653]],"non_vide":{"ms":227,"enDefaut":0,"erreur":null},"plage":{"ms":499,"enDefaut":26,"erreur":null},"aberrantes":{"ms":815,"enDefaut":6893,"erreur":null},"unique":{"ms":1537,"enDefaut":1000000,"erreur":null}} |
| OK | gros fichier 3m : 3 000 000 lignes chargées en 11.7 s | {"chargementMs":11734.40000000596,"lignes":3000000,"colonnes":20,"etapes":[["Lecture du fichier…",4648],["Analyse de la structure…",4911],["Détection des types… 20 / 20 colonnes",15333],["Préparation des données…",16348]],"non_vide":{"ms":700,"enDefaut":0,"erreur":null},"plage":{"ms":1437,"enDefaut":83,"erreur":null},"aberrantes":{"ms":2079,"enDefaut":20794,"erreur":null},"unique":{"ms":4354,"enDefaut":3000000,"erreur":null}} |
