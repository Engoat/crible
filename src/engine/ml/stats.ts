// Fonctions statistiques qui n'existent pas en SQL : lois du χ² et de Kolmogorov, V de Cramér.

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let a = 0.99999999999980993;
  const t = z + 7.5;
  for (let i = 0; i < LANCZOS.length; i++) a += LANCZOS[i] / (z + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Q(a, x) : fonction gamma incomplète régularisée supérieure. */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Valeur p d'un test du χ² : probabilité d'une statistique au moins aussi grande. */
export function chi2PValue(statistic: number, df: number): number {
  if (df <= 0) return 1;
  return Math.min(1, Math.max(0, gammaQ(df / 2, statistic / 2)));
}

export interface Contingence {
  lignes: string[];
  colonnes: string[];
  n: number[][];
}

export function contingence(cells: { a: string; b: string; n: number }[]): Contingence {
  const lignes = [...new Set(cells.map((c) => c.a))];
  const colonnes = [...new Set(cells.map((c) => c.b))];
  const li = new Map(lignes.map((v, i) => [v, i]));
  const ci = new Map(colonnes.map((v, i) => [v, i]));
  const n = lignes.map(() => colonnes.map(() => 0));
  for (const c of cells) n[li.get(c.a) as number][ci.get(c.b) as number] += c.n;
  return { lignes, colonnes, n };
}

export interface Chi2 {
  statistique: number;
  ddl: number;
  p: number;
  total: number;
}

export function chi2Independance(t: Contingence): Chi2 {
  const r = t.lignes.length;
  const c = t.colonnes.length;
  const rows = t.n.map((row) => row.reduce((s, v) => s + v, 0));
  const cols = t.colonnes.map((_, j) => t.n.reduce((s, row) => s + row[j], 0));
  const total = rows.reduce((s, v) => s + v, 0);
  let stat = 0;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const expected = (rows[i] * cols[j]) / total;
      if (expected > 0) stat += (t.n[i][j] - expected) ** 2 / expected;
    }
  }
  const ddl = (r - 1) * (c - 1);
  return { statistique: stat, ddl, p: chi2PValue(stat, ddl), total };
}

/** V de Cramér corrigé du biais (Bergsma, 2013). Renvoie null si le tableau est trop petit. */
export function cramerV(t: Contingence): number | null {
  const r = t.lignes.length;
  const c = t.colonnes.length;
  if (r < 2 || c < 2) return null;
  const { statistique, total } = chi2Independance(t);
  if (total < 2) return null;
  const phi2 = Math.max(0, statistique / total - ((r - 1) * (c - 1)) / (total - 1));
  const rc = r - (r - 1) ** 2 / (total - 1);
  const cc = c - (c - 1) ** 2 / (total - 1);
  const denominator = Math.min(rc - 1, cc - 1);
  if (denominator <= 0) return null;
  return Math.sqrt(phi2 / denominator);
}

/** Valeur p approchée du test de Kolmogorov-Smirnov à deux échantillons (série asymptotique, correction de Stephens). */
export function ksPValue(d: number, n: number, m: number): number {
  const ne = (n * m) / (n + m);
  const root = Math.sqrt(ne);
  const lambda = (root + 0.12 + 0.11 / root) * d;
  if (lambda < 0.2) return 1;
  let sum = 0;
  for (let k = 1; k <= 100; k++) {
    const term = Math.exp(-2 * k * k * lambda * lambda);
    sum += (k % 2 === 1 ? 1 : -1) * term;
    if (term < 1e-16) break;
  }
  return Math.min(1, Math.max(0, 2 * sum));
}
