/* Prépare une version « vitrine » pour les captures de l'App Store.
 *
 * L'application réelle demande une connexion : impossible de capturer des
 * écrans remplis sans compte. On empaquette donc la version hors ligne, qui
 * est EXACTEMENT la même interface, avec les données du Bivouak en jeu
 * d'exemple. Les captures montrent donc l'application telle qu'elle est —
 * seules les données sont de démonstration, ce qui est l'usage normal.
 *
 * À ne jamais envoyer à l'App Store : c'est ios-ship.sh qui construit la
 * vraie application. Ce script ne sert qu'aux captures.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici    = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..', '..');
const www    = join(ici, '..', 'www');

const src = join(racine, 'app', 'livre-de-prix-hors-ligne.html');
if (!existsSync(src)) { console.error('Build hors ligne absent.'); process.exit(1); }

let html = readFileSync(src, 'utf8');
const graine = JSON.parse(readFileSync(join(racine, 'data', 'db_seed_all.json'), 'utf8'));
graine.salesLog = graine.salesLog || [];
graine.settings = { ...(graine.settings || {}), establishment_name: 'Bivouak', theme: 'light' };

// Un inventaire en cours : c'est l'ecran le plus parlant de l'application.
const bar = graine.products.filter(p => p.category === 'bar' && p.base_unit).slice(0, 16);
graine.inventories.push({
  id: 'inv_demo', date: '2026-11-06', category: 'bar', zone: 'all',
  status: 'in_progress', created_at: '2026-11-06', validated_at: null,
  counts: bar.map((p, i) => ({
    product_id: p.id,
    theoretical_qty: Math.round((p.purchase_size || 1) * 9.3 * 10) / 10,
    counted_qty: i < 6 ? Math.round((p.purchase_size || 1) * 8.7 * 10) / 10 : null,
  })),
});

// Un mois complet de bar : receptions, ventes, puis deux inventaires valides.
// Sans ventes enregistrees, l'ecran des pertes affiche (a juste titre) son
// avertissement au lieu du calcul : ce serait une mauvaise vitrine pour la
// fonction la plus importante de l'application.
const DEBUT = '2026-09-30', FIN = '2026-10-31';
const mois = graine.products.filter(p => p.category === 'bar' && p.base_unit && p.purchase_size > 1).slice(0, 10);
const ecarts = [-82, -45, -310, -128, -21, 0, -64, -17, 12, -8];
const cJuin = [], cOct = [];
mois.forEach((p, i) => {
  const t = p.purchase_size;
  const debut = Math.round(t * 14 * 10) / 10;
  const recu  = Math.round(t * 11 * 10) / 10;
  const vendu = Math.round(t * 9.3 * 10) / 10;
  const prevu = Math.round((debut + recu - vendu) * 1000) / 1000;
  const ec = ecarts[i] || 0;
  p.stock_qty = Math.round((prevu + ec) * 1000) / 1000;
  p.stock_movements = [
    { id: 'd' + p.id, date: DEBUT, type: 'inventaire', qty: 0,      note: 'Cloture septembre' },
    { id: 'r' + p.id, date: '2026-10-06', type: 'reception', qty: recu,  note: 'Reception du 06/10/2026' },
    { id: 'v' + p.id, date: '2026-10-12', type: 'vente', qty: -Math.round(vendu * 0.45 * 1000) / 1000, note: 'Ventes du 12/10/2026' },
    { id: 'w' + p.id, date: '2026-10-26', type: 'vente', qty: -Math.round(vendu * 0.55 * 1000) / 1000, note: 'Ventes du 26/10/2026' },
    { id: 'i' + p.id, date: FIN, type: 'inventaire', qty: ec, note: 'Ecart inventaire du 31/10/2026' },
  ];
  cJuin.push({ product_id: p.id, theoretical_qty: debut, counted_qty: debut });
  cOct .push({ product_id: p.id, theoretical_qty: prevu, counted_qty: Math.round((prevu + ec) * 1000) / 1000 });
});
graine.inventories.push(
  { id: 'inv_sept', date: DEBUT, category: 'bar', zone: 'all', status: 'validated',
    created_at: DEBUT, validated_at: DEBUT, counts: cJuin },
  { id: 'inv_oct',  date: FIN,   category: 'bar', zone: 'all', status: 'validated',
    created_at: FIN,   validated_at: FIN,   counts: cOct });

const bal = '<script type="application/json" id="seed-data">';
const [avant, ...reste] = html.split(bal);
const apres = reste.join(bal);
const fin = apres.indexOf('</script>');
html = avant + bal + '\n' + JSON.stringify(graine) + '\n' + apres.slice(fin);

mkdirSync(www, { recursive: true });
writeFileSync(join(www, 'index.html'), html);
for (const f of ['manifest.webmanifest']) {
  const s = join(racine, 'app', 'app', f);
  if (existsSync(s)) cpSync(s, join(www, f));
}
const icons = join(racine, 'app', 'app', 'icons');
if (existsSync(icons)) cpSync(icons, join(www, 'icons'), { recursive: true });
console.log(`✓ www prepare pour les captures — ${graine.products.length} produits, ${graine.recipes.length} fiches`);
