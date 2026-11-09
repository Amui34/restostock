/* Envoie les captures d'écran. Apple veut un téléversement en trois temps :
 * on réserve l'emplacement, on envoie les octets à l'URL rendue, puis on
 * confirme avec l'empreinte du fichier. La confirmation est ce qui vérifie
 * que rien ne s'est perdu en route.
 *
 * Deux jeux, parce que l'application est livrée pour iPhone ET pour iPad :
 * Apple réclame des captures pour chaque famille d'appareils déclarée, et
 * refuse la fiche s'il en manque une.
 *
 * Le jeu est vidé avant l'envoi : sans ça les nouvelles captures s'ajoutent
 * aux anciennes, et la fiche se retrouve avec deux générations d'écrans
 * mélangées — Apple en accepte dix, on ne s'en rend compte qu'au onzième.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { api, VERSION, erreur } from './asc.mjs';

const JEUX = [
  { type: 'APP_IPHONE_67',        dossier: './shots/',      quoi: 'iPhone 6,9 pouces — 1320 x 2868' },
  { type: 'APP_IPAD_PRO_3GEN_129', dossier: './shots-ipad/', quoi: 'iPad 13 pouces — 2064 x 2752' },
];

let r = await api('GET', `/v1/appStoreVersions/${VERSION}/appStoreVersionLocalizations`);
const loc = (r.body?.data || []).find(l => l.attributes.locale.startsWith('fr')) || r.body?.data?.[0];
console.log('  localisation :', loc.attributes.locale);

r = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
const jeuxExistants = r.body?.data || [];

for (const { type, dossier, quoi } of JEUX) {
  console.log(`\n  ${quoi}`);
  const DOSSIER = new URL(dossier, import.meta.url);

  let set = jeuxExistants.find(s => s.attributes.screenshotDisplayType === type);
  if (set) {
    console.log('    jeu existant :', set.id);
    // On vide : les captures d'hier montrent une interface qui n'existe plus.
    const d = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
    for (const vieille of d.body?.data || []) {
      const s = await api('DELETE', `/v1/appScreenshots/${vieille.id}`);
      console.log(`    retirée ${vieille.attributes.fileName} : ${s.status < 300 ? 'ok' : erreur(s)}`);
    }
  } else {
    const c = await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: type },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } });
    set = c.body?.data;
    if (!set) { console.log('    jeu impossible à créer :', erreur(c)); continue; }
    console.log('    jeu créé :', set.id);
  }

  for (const nom of readdirSync(DOSSIER).filter(f => f.endsWith('.png')).sort()) {
    const octets = readFileSync(new URL(nom, DOSSIER));

    // 1. réserver
    const a = await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots',
      attributes: { fileSize: octets.length, fileName: nom },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } });
    if (a.status >= 300) { console.log(`    ${nom} : ${erreur(a)}`); continue; }
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
    console.log(`    ${nom} : ${b.status === 200 ? 'envoyée' : erreur(b)}`);
  }
}
