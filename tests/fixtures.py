"""Fabrique les fichiers de vérification et calcule, avec pandas et SciPy, les valeurs que Crible doit retrouver.

Usage : python tests/fixtures.py [--gros]
Écrit tests/fixtures/*.csv|xlsx et tests/fixtures/reference.json
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import contingency

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "fixtures"
OUT.mkdir(exist_ok=True)
ref: dict = {}

# ------------------------------------------------------------------ Titanic
titanic = pd.read_csv(ROOT.parent / "public" / "demo" / "titanic.csv")
t = {"lignes": len(titanic), "colonnes": titanic.shape[1]}
for col in ["Age", "Cabin", "Embarked"]:
    t[f"manquants_{col}"] = int(titanic[col].isna().sum())
age = titanic["Age"].dropna()
t["plage_age_0_60"] = int(((age < 0) | (age > 60)).sum())
counts = titanic["Ticket"].value_counts()
t["unique_ticket_lignes"] = int(counts[counts > 1].sum())
t["unique_ticket_valeurs"] = int((counts > 1).sum())
t["unique_passengerid"] = 0
t["doublons"] = int(titanic.duplicated().sum())
fare = titanic["Fare"].dropna()
q1, q3 = fare.quantile([0.25, 0.75])
low, high = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
t["aberrantes_fare"] = {"q1": float(q1), "q3": float(q3), "bas": float(low), "haut": float(high),
                        "n": int(((fare < low) | (fare > high)).sum())}
t["autorisees_sex_male"] = int((titanic["Sex"] != "male").sum())
ticket = titanic["Ticket"].dropna().astype(str).str.strip()
t["format_cp_ticket"] = int((~ticket.str.fullmatch(r"[0-9]{5}")).sum())
both = titanic[["SibSp", "Parch"]].dropna()
t["entre_sibsp_ge_parch"] = int((~(both["SibSp"] >= both["Parch"])).sum())
t["fare_sup_300"] = int((titanic["Fare"] > 300).sum())
t["skew_fare"] = float(stats.skew(fare, bias=False))
t["skew_age"] = float(stats.skew(age, bias=False))
ref["titanic"] = t

# ------------------------------------------------------------------ fichier piégé
rows = 400
rng = np.random.default_rng(7)
ids = list(range(1, rows + 1))
noms = [f"Élodie Müller {i}" for i in ids]
villes = ["Paris", "Lyon", "Marseille", "Lille"]
data = {
    "id": ids,
    "nom": noms,
    "prix": [f"{rng.uniform(1, 500):.2f}".replace(".", ",") for _ in ids],
    "date": [f"{(i % 28) + 1:02d}/{(i % 12) + 1:02d}/2024" for i in ids],
    "cp": [f"{rng.integers(1000, 99999):05d}" for _ in ids],
    "ville": [villes[i % 4] for i in ids],
    "email": [f"user{i}@exemple.fr" for i in ids],
    "statut": ["actif" if i % 3 else "inactif" for i in ids],
    "quantite": [int(rng.integers(0, 50)) for _ in ids],
}
df = pd.DataFrame(data)
piege = {}
# défauts injectés, tous dénombrés
bad_prix = [5, 17, 40, 41, 300]
for i in bad_prix:
    df.loc[i, "prix"] = "n/a"
piege["type_prix"] = len(bad_prix)
bad_date = [3, 9, 120]
for i in bad_date:
    df.loc[i, "date"] = "31/02/2024"
piege["type_date"] = len(bad_date)
vides = [0, 10, 11, 250, 251, 252]
for i in vides:
    df.loc[i, "nom"] = ""
piege["manquants_nom"] = len(vides)
espaces = [20, 21]
for i in espaces:
    df.loc[i, "nom"] = df.loc[i, "nom"] + "  "
piege["espaces_nom"] = len(espaces)
for i in [30, 34]:
    df.loc[i, "ville"] = "PARIS"
for i in [31]:
    df.loc[i, "ville"] = "paris"
piege["casse_ville_lignes"] = int((df["ville"].str.lower().map(df.groupby(df["ville"].str.lower())["ville"].nunique()) > 1).sum())
bad_mail = [60, 61, 62, 63]
df.loc[60, "email"] = "sans-arobase.fr"
df.loc[61, "email"] = "jean@gmail"
df.loc[62, "email"] = "a b@exemple.fr"
df.loc[63, "email"] = "@exemple.fr"
piege["format_email"] = len(bad_mail)
bad_statut = [70, 71, 72]
for i in bad_statut:
    df.loc[i, "statut"] = "?"
piege["autorisees_statut"] = len(bad_statut)
neg = [90, 91]
for i in neg:
    df.loc[i, "quantite"] = -3
piege["plage_quantite_min0"] = len(neg)
# deux lignes recopiées à l'identique, à la fin
extra = df.iloc[[100, 200]].copy()
df = pd.concat([df, extra], ignore_index=True)
piege["doublons"] = 2
piege["unique_id_lignes"] = 4  # les deux originaux et leurs copies
piege["lignes"] = len(df)
cp_text = df["cp"].str.startswith("0").sum()
piege["cp_avec_zero_initial"] = int(cp_text)
df.to_csv(OUT / "pieges.csv", sep=";", index=False, encoding="cp1252")
ref["pieges"] = piege

# ------------------------------------------------------------------ Excel
dates = pd.date_range("2024-01-01", periods=60, freq="D")
vente = pd.DataFrame({
    "Produit": [f"P{i % 5}" for i in range(60)],
    "Date": dates,
    "Montant": np.round(rng.uniform(5, 300, 60), 2),
    "Quantité": rng.integers(1, 9, 60),
    "Payé": [i % 2 == 0 for i in range(60)],
})
with pd.ExcelWriter(OUT / "classeur.xlsx") as xl:
    pd.DataFrame({"note": ["feuille d'introduction"]}).to_excel(xl, sheet_name="Lisez-moi", index=False)
    vente.to_excel(xl, sheet_name="Ventes", index=False)
ref["excel"] = {"lignes": 60, "montant_total": float(vente["Montant"].sum()), "quantite_total": int(vente["Quantité"].sum())}

# ------------------------------------------------------------------ apprentissage : cibles, fuites, séparations
ml = titanic.copy()
ml["fuite"] = ml["Survived"] * 1.0 + rng.normal(0, 0.001, len(ml))  # colonne qui contient la cible
ml["jeu_aleatoire"] = np.where(rng.random(len(ml)) < 0.8, "train", "test")
ml["jeu_biaise"] = np.where(ml["Sex"] == "female", "train", "test")
ml.to_csv(OUT / "titanic_ml.csv", index=False)
mlref = {}


def cramer_bergsma(tab):
    # le χ² vient de SciPy (sans correction de Yates) ; la correction du biais est celle de Bergsma (2013)
    n = tab.sum()
    r, c = tab.shape
    chi2 = stats.chi2_contingency(tab, correction=False)[0]
    phi2 = max(0.0, chi2 / n - (r - 1) * (c - 1) / (n - 1))
    rc = r - (r - 1) ** 2 / (n - 1)
    cc = c - (c - 1) ** 2 / (n - 1)
    return float(np.sqrt(phi2 / min(rc - 1, cc - 1)))


# V de Cramér corrigé (SciPy) : Sex et Pclass contre Survived
for col in ["Sex", "Pclass", "Embarked"]:
    sub = ml[[col, "Survived"]].dropna()
    tab = pd.crosstab(sub[col], sub["Survived"]).to_numpy()
    mlref[f"cramer_survived_{col}"] = cramer_bergsma(tab)
# rapport de corrélation η de Fare et Age avec Survived (cible catégorielle)
def eta(cat, num):
    sub = pd.concat([cat, num], axis=1).dropna()
    gm = sub.iloc[:, 1].mean()
    between = sum(len(g) * (g.mean() - gm) ** 2 for _, g in sub.groupby(sub.columns[0])[sub.columns[1]])
    total = ((sub.iloc[:, 1] - gm) ** 2).sum()
    return float(np.sqrt(between / total))
for col in ["Fare", "Age", "Pclass"]:
    mlref[f"eta_survived_{col}"] = eta(ml["Survived"], ml[col])
mlref["eta_survived_fuite"] = eta(ml["Survived"], ml["fuite"])
# Pearson entre colonnes numériques
mlref["pearson_sibsp_parch"] = float(ml["SibSp"].corr(ml["Parch"]))
mlref["pearson_pclass_fare"] = float(ml["Pclass"].corr(ml["Fare"]))
# déséquilibre
vc = ml["Survived"].value_counts()
mlref["desequilibre_ratio"] = float(vc.min() / vc.max())
# écarts entraînement / test (valeur p asymptotique de SciPy)
def ks(col, split):
    a = ml.loc[ml[split] == "train", col].dropna()
    b = ml.loc[ml[split] == "test", col].dropna()
    r = stats.ks_2samp(a, b, method="asymp")
    return {"d": float(r.statistic), "p": float(r.pvalue), "n": int(len(a)), "m": int(len(b))}
def chi(col, split):
    sub = ml[[col, split]].dropna()
    tab = pd.crosstab(sub[split], sub[col]).to_numpy()
    c2, p, dof, _ = stats.chi2_contingency(tab, correction=False)
    return {"v": float(np.sqrt(c2 / tab.sum())), "p": float(p), "chi2": float(c2)}
for split in ["jeu_aleatoire", "jeu_biaise"]:
    for col in ["Age", "Fare", "Pclass"]:
        mlref[f"ks_{col}_{split}"] = ks(col, split)
    for col in ["Embarked"]:
        mlref[f"chi_{col}_{split}"] = chi(col, split)
mlref["chi_sex_jeu_aleatoire"] = chi("Sex", "jeu_aleatoire")
ref["ml"] = mlref

# ------------------------------------------------------------------ gros fichiers (facultatif)
if "--gros" in sys.argv:
    for n in (1_000_000, 3_000_000):
        g = np.random.default_rng(n)
        big = {f"entier_{i}": g.integers(0, 10_000, n) for i in range(8)}
        big.update({f"decimal_{i}": np.round(g.normal(50, 12, n), 3) for i in range(8)})
        big.update({f"texte_{i}": g.choice(["alpha", "beta", "gamma", "delta", "epsilon"], n) for i in range(4)})
        pd.DataFrame(big).to_csv(OUT / f"gros_{n // 1_000_000}m.csv", index=False)
        print("écrit", n)

(OUT / "reference.json").write_text(json.dumps(ref, indent=2, ensure_ascii=False), encoding="utf-8")
print("fixtures et références écrites dans", OUT)
