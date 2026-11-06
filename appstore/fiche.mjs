/* Remplit la fiche App Store depuis fiche.md — une seule source de vérité.
 * Les textes se relisent dans le Markdown ; ce script ne fait que les poser.
 */
import { readFileSync } from 'node:fs';
import { api, APP, VERSION, INFO, erreur } from './asc.mjs';

const md = readFileSync(new URL('./fiche.md', import.meta.url), 'utf8');
const bloc = (titre) => {
  const m = md.match(new RegExp(`## ${titre}[^\\n]*\\n+\`\`\`\\n([\\s\\S]*?)\\n\`\`\``));
  if (!m) throw new Error(`section « ${titre} » introuvable dans fiche.md`);
  return m[1];
};

const description = bloc('Description');
const sousTitre   = bloc('Sous-titre');
const motsCles    = bloc('Mots-clés');
const assistance  = bloc("URL d'assistance");
const marketing   = bloc('URL marketing');

console.log(`  description ${description.length}/4000 · sous-titre ${sousTitre.length}/30 · mots-clés ${motsCles.length}/100`);

// --- Les textes de la version (description, mots-clés, nouveautés) ---------
let r = await api('GET', `/v1/appStoreVersions/${VERSION}/appStoreVersionLocalizations`);
const locs = r.body?.data || [];
const fr = locs.find(l => l.attributes.locale.startsWith('fr')) || locs[0];
if (!fr) { console.log('  aucune localisation trouvée'); process.exit(1); }
console.log(`  localisation : ${fr.attributes.locale}`);

r = await api('PATCH', `/v1/appStoreVersionLocalizations/${fr.id}`, {
  data: { type: 'appStoreVersionLocalizations', id: fr.id, attributes: {
    description, keywords: motsCles, supportUrl: assistance, marketingUrl: marketing,
    // Pas de « Quoi de neuf » sur une première version : Apple le refuse.
  } },
});
console.log('  textes de version :', r.status === 200 ? 'posés' : erreur(r));

// --- Le sous-titre vit sur appInfo, pas sur la version --------------------
r = await api('GET', `/v1/appInfos/${INFO}/appInfoLocalizations`);
const il = (r.body?.data || []).find(l => l.attributes.locale.startsWith('fr')) || r.body?.data?.[0];
if (il) {
  const r2 = await api('PATCH', `/v1/appInfoLocalizations/${il.id}`, {
    data: { type: 'appInfoLocalizations', id: il.id, attributes: { subtitle: sousTitre } },
  });
  console.log('  sous-titre :', r2.status === 200 ? 'posé' : erreur(r2));
}
