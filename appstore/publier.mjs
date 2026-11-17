/* Met en vente une version approuvée par Apple.
 *
 * ACTION PUBLIQUE : ne se lance qu'avec l'accord explicite de Noa.
 *
 * C'est le geste que remplace la mise en vente automatique. On la laisse en
 * manuel pour que la sortie soit une décision, pas une surprise un dimanche
 * matin — mais il faut alors ce bouton, et Apple ne l'expose que sous la forme
 * d'une « demande de mise en vente ».
 *
 *   usage : node appstore/publier.mjs
 */
import { api, VERSION, erreur } from './asc.mjs';

let r = await api('GET', `/v1/appStoreVersions/${VERSION}`);
const etat = r.body?.data?.attributes?.appStoreState;
console.log('  état :', etat);

if (etat === 'READY_FOR_SALE') {
  console.log('  déjà en vente — rien à faire.');
  process.exit(0);
}
if (etat !== 'PENDING_DEVELOPER_RELEASE') {
  console.error(`  Apple n'a pas (encore) approuvé cette version : ${etat}.`);
  process.exit(1);
}

r = await api('POST', '/v1/appStoreVersionReleaseRequests', {
  data: { type: 'appStoreVersionReleaseRequests',
    relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VERSION } } } } });
/* Apple répond parfois 500 alors qu'elle a bien enregistré la demande : vu le
 * 17 novembre 2026, la mise en vente était faite malgré l'erreur. On relit
 * donc l'état avant d'annoncer un échec, plutôt que de faire relancer un geste
 * déjà passé. */
const apres = await api('GET', `/v1/appStoreVersions/${VERSION}`);
const nouvel = apres.body?.data?.attributes?.appStoreState;
if (nouvel === 'READY_FOR_SALE' || nouvel === 'PROCESSING_FOR_DISTRIBUTION') {
  console.log('  ✓ mise en vente — état :', nouvel);
  if (r.status >= 300) console.log('    (Apple avait répondu une erreur ; elle avait pourtant enregistré la demande)');
  process.exit(0);
}
if (r.status >= 300) { console.error('  mise en vente refusée :', erreur(r)); process.exit(1); }
console.log('  ✓ mise en vente demandée — état :', nouvel);
