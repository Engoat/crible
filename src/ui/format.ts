export const pct = (x: number): string =>
  `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

export const nombre = (x: number): string => x.toLocaleString('fr-FR');

export function mesureValeur(v: string | number | null): string {
  if (v === null) return '—';
  if (typeof v === 'number') return v.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
  return v;
}

export const nomMesure = (nom: string): string => nom.replaceAll('_', ' ');

export function duree(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
}
