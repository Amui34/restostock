/* Rattache le build à la version et remplit les informations de vérification.
 * Le téléphone de contact est repris d'une application déjà publiée plutôt
 * que redemandé : il n'a pas à transiter par une conversation.
 */
import { readFileSync } from 'node:fs';
import { api, APP, VERSION, erreur } from './asc.mjs';

// --- Le build -------------------------------------------------------------
let r = await api('GET', `/v1/builds?filter[app]=${APP}&limit=1&sort=-uploadedDate`);
const build = r.body?.data?.[0];
console.log('  build :', build ? `${build.attributes.version} (${build.attributes.processingState})` : 'aucun');
if (build) {
  const b = await api('PATCH', `/v1/appStoreVersions/${VERSION}`, {
    data: { type: 'appStoreVersions', id: VERSION,
      relationships: { build: { data: { type: 'builds', id: build.id } } } } });
  console.log('  rattaché à la version :', b.status === 200 ? 'oui' : erreur(b));
}

// --- Le téléphone, lu depuis une application déjà publiée ----------------
let tel = null, prenom = 'Noa', nom = 'Madar';
r = await api('GET', '/v1/apps?limit=20&fields[apps]=name');
for (const app of r.body?.data || []) {
  if (app.id === APP) continue;
  const v = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=1`);
  const vid = v.body?.data?.[0]?.id;
  if (!vid) continue;
  const d = await api('GET', `/v1/appStoreVersions/${vid}/appStoreReviewDetail`);
  const at = d.body?.data?.attributes;
  if (at?.contactPhone) { tel = at.contactPhone; prenom = at.contactFirstName || prenom; nom = at.contactLastName || nom; break; }
}
console.log('  téléphone de contact :', tel ? 'repris d’une app publiée' : 'INTROUVABLE');

// --- Les identifiants de démonstration, lus hors du dépôt ----------------
const texte = readFileSync(`${process.env.HOME}/.restostock-demo`, 'utf8');
const email = texte.match(/adresse\s*:\s*(\S+)/)[1];
const mdp   = texte.match(/mot de passe\s*:\s*(\S+)/)[1];

const notes = `Application de gestion pour les professionnels de la restauration.

Un compte est necessaire pour acceder a l'application. Le compte de
demonstration ci-dessous contient un etablissement deja rempli (produits,
fiches techniques, inventaires, ventes) afin que toutes les fonctions
soient accessibles immediatement.

L'application est egalement accessible depuis un navigateur a l'adresse
https://restostock.fr/app/ avec les memes identifiants.`;

const attributs = {
  contactFirstName: prenom, contactLastName: nom,
  contactEmail: 'noamadar.noa@gmail.com', contactPhone: tel,
  demoAccountName: email, demoAccountPassword: mdp, demoAccountRequired: true,
  notes,
};

r = await api('GET', `/v1/appStoreVersions/${VERSION}/appStoreReviewDetail`);
const dejaId = r.body?.data?.id;
const res = dejaId
  ? await api('PATCH', `/v1/appStoreReviewDetails/${dejaId}`, { data: { type: 'appStoreReviewDetails', id: dejaId, attributes: attributs } })
  : await api('POST', '/v1/appStoreReviewDetails', { data: { type: "appStoreReviewDetails", attributes: attributs,
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION } } } } });
console.log('  informations de vérification :', res.status < 300 ? 'posées' : erreur(res));
