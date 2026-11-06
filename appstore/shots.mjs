/* Envoie les captures d'écran. Apple veut un téléversement en trois temps :
 * on réserve l'emplacement, on envoie les octets à l'URL rendue, puis on
 * confirme avec l'empreinte du fichier. La confirmation est ce qui vérifie
 * que rien ne s'est perdu en route.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { api, VERSION, erreur } from './asc.mjs';

const DOSSIER = new URL('./shots/', import.meta.url);
const TYPE = 'APP_IPHONE_67';   // 6,9 pouces — 1320 x 2868

let r = await api('GET', `/v1/appStoreVersions/${VERSION}/appStoreVersionLocalizations`);
const loc = (r.body?.data || []).find(l => l.attributes.locale.startsWith('fr')) || r.body?.data?.[0];
console.log('  localisation :', loc.attributes.locale);

r = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
let set = (r.body?.data || []).find(s => s.attributes.screenshotDisplayType === TYPE);
if (!set) {
  r = await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets',
    attributes: { screenshotDisplayType: TYPE },
    relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } });
  set = r.body?.data;
  console.log('  jeu créé :', set ? set.id : erreur(r));
} else {
  console.log('  jeu existant :', set.id);
}

const fichiers = readdirSync(DOSSIER).filter(f => f.endsWith('.png')).sort();
for (const nom of fichiers) {
  const octets = readFileSync(new URL(nom, DOSSIER));

  // 1. réserver
  let a = await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots',
    attributes: { fileSize: octets.length, fileName: nom },
    relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } });
  if (a.status >= 300) { console.log(`  ${nom} : ${erreur(a)}`); continue; }
  const shot = a.body.data;

  // 2. envoyer les octets aux URL indiquées par Apple
  for (const op of shot.attributes.uploadOperations) {
    const entetes = {};
    for (const h of op.requestHeaders || []) entetes[h.name] = h.value;
    await fetch(op.url, { method: op.method, headers: entetes,
      body: octets.subarray(op.offset, op.offset + op.length) });
  }

  // 3. confirmer avec l'empreinte : c'est elle qui atteste de l'intégrité
  const md5 = createHash('md5').update(octets).digest('hex');
  const b = await api('PATCH', `/v1/appScreenshots/${shot.id}`, {
    data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
  console.log(`  ${nom} : ${b.status === 200 ? 'envoyée' : erreur(b)}`);
}
