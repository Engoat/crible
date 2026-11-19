// Contraste WCAG des couples texte / fond de l'interface. Usage : node scripts/contraste.mjs
const srgbToLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function oklch(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180, a = c * Math.cos(h), b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_];
  return lin.map((x) => Math.min(1, Math.max(0, x)));
}
const lumFromLin = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const lumHex = (h) => lumFromLin(hex(h).map(srgbToLin));
const lumOk = (...a) => lumFromLin(oklch(...a));
const ratio = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ['encre sur fond', lumHex('#1c1412'), lumHex('#f6f1ec')],
  ['encre sur papier', lumHex('#1c1412'), lumHex('#ffffff')],
  ['texte doux sur fond', lumHex(process.argv[2] ?? '#6b5d55'), lumHex('#f6f1ec')],
  ['texte doux sur papier', lumHex(process.argv[2] ?? '#6b5d55'), lumHex('#ffffff')],
  ['blanc sur bouton', lumHex('#ffffff'), lumHex(process.argv[3] ?? '#e8432a')],
  ['pastille ok', lumOk(0.35, 0.1, 150), lumOk(0.93, 0.05, 150)],
  ['pastille ko', lumOk(0.42, 0.17, 33), lumOk(0.93, 0.05, 33)],
  ['erreur sur fond ko', lumOk(0.42, 0.17, 33), lumOk(0.93, 0.05, 33)],
  ['cellule cause', lumHex('#1c1412'), lumHex('#fbd9d2')],
];
let bad = 0;
for (const [n, a, b] of pairs) { const r = ratio(a, b); if (r < 4.5) bad++; console.log(`${r.toFixed(2).padStart(6)}:1  ${r >= 4.5 ? 'ok ' : 'KO '} ${n}`); }
process.exit(bad ? 1 : 0);
