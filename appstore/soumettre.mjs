/* Envoie la version en vérification chez Apple.
 *
 * ACTION PUBLIQUE : ne se lance qu'avec l'accord explicite de Noa.
 *
 * Trois gestes qu'Apple veut dans cet ordre : une soumission, la version
 * dedans, puis l'envoi. Une soumission refusée doit être annulée — et close —
 * avant d'en créer une nouvelle, sinon Apple refuse la seconde.
 *
 *   usage : node appstore/soumettre.mjs <numéro de build>     ex. : 3
 */
import { readFileSync } from 'node:fs';
import { api, APP, VERSION, erreur } from './asc.mjs';

const numero = process.argv[2];
if (!numero) { console.error('usage : node appstore/soumettre.mjs <numéro de build>'); process.exit(1); }

const ident = JSON.parse(readFileSync(new URL('./identite.json', import.meta.url), 'utf8'));
if (!ident.contact) {
  console.error('Soumission bloquée : pas d’adresse de contact publique dans appstore/identite.json.');
  console.error('La page d’assistance afficherait « adresse de contact à venir » au testeur d’Apple.');
  process.exit(1);
}

async function etape(libelle, promesse) {
  const r = await promesse;
  const ok = r.status >= 200 && r.status < 300;
  console.log(ok ? '  ✓' : '  ✗', libelle, ok ? '' : erreur(r));
  if (!ok) process.exit(1);
  return r;
}

// --- Le build -------------------------------------------------------------
let r = await api('GET', `/v1/builds?filter[app]=${APP}&filter[version]=${numero}`);
const build = r.body?.data?.[0];
if (!build) { console.error(`Build ${numero} introuvable.`); process.exit(1); }
if (build.attributes.processingState !== 'VALID') {
  console.error(`Build ${numero} pas encore prêt (${build.attributes.processingState}).`); process.exit(1);
}
if (build.attributes.usesNonExemptEncryption === null) {
  await etape('conformité export déclarée', api('PATCH', `/v1/builds/${build.id}`, {
    data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } }));
}
await etape(`build ${numero} rattaché à la version`, api('PATCH', `/v1/appStoreVersions/${VERSION}`, {
  data: { type: 'appStoreVersions', id: VERSION,
    relationships: { build: { data: { type: 'builds', id: build.id } } } } }));

// --- Une soumission refusée bloque la suivante ----------------------------
r = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP}&filter[state]=UNRESOLVED_ISSUES`);
const refusee = r.body?.data?.[0];
if (refusee) {
  await etape('ancienne soumission refusée annulée', api('PATCH', `/v1/reviewSubmissions/${refusee.id}`, {
    data: { type: 'reviewSubmissions', id: refusee.id, attributes: { canceled: true } } }));
  for (let i = 0; i < 30; i++) {
    const s = await api('GET', `/v1/reviewSubmissions/${refusee.id}`);
    if (s.body?.data?.attributes?.state === 'COMPLETE') break;
    await new Promise(r => setTimeout(r, 5000));
  }
}

// --- La soumission --------------------------------------------------------
r = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP}&filter[state]=READY_FOR_REVIEW`);
let soumission = r.body?.data?.[0];
if (!soumission) {
  soumission = (await etape('soumission créée', api('POST', '/v1/reviewSubmissions', {
    data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP } } } } }))).body.data;
} else {
  console.log('  ✓ soumission ouverte réutilisée');
}

r = await api('GET', `/v1/reviewSubmissions/${soumission.id}/items`);
if (!(r.body?.data || []).length) {
  await etape('version ajoutée à la soumission', api('POST', '/v1/reviewSubmissionItems', {
    data: { type: 'reviewSubmissionItems', relationships: {
      reviewSubmission: { data: { type: 'reviewSubmissions', id: soumission.id } },
      appStoreVersion:  { data: { type: 'appStoreVersions',  id: VERSION } } } } }));
}

const envoi = await etape('envoyée à Apple', api('PATCH', `/v1/reviewSubmissions/${soumission.id}`, {
  data: { type: 'reviewSubmissions', id: soumission.id, attributes: { submitted: true } } }));
console.log('\n  état de la soumission :', envoi.body.data.attributes.state);
