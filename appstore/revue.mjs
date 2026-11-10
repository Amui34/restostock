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

/* Apple reclame souvent, pour une premiere application, bien plus que les
 * identifiants : a quoi elle sert, pour qui, comment s'en servir, quels
 * services externes, et d'ou vient le contenu. Le dire des la premiere
 * soumission evite un refus 2.1 « Information Needed » et deux semaines. */
const notes = `OBJET ET PUBLIC

RestoStock est un outil de gestion pour les professionnels de la
restauration : restaurants et bars. Il calcule le cout de revient de
chaque plat a partir des prix d'achat reellement payes, suit les stocks,
et chiffre les pertes en fin de mois en comparant ce qui est sorti du
stock a ce que les ventes auraient du consommer.

Il n'y a aucun achat integre, aucune publicite et aucun suivi
publicitaire. L'application est gratuite et identique dans tous les pays.
L'interface est en francais uniquement.

COMPTE DE DEMONSTRATION

Un compte est necessaire pour acceder a l'application. Le compte ci-dessous
contient un etablissement deja rempli (produits, fiches techniques,
inventaires, ventes) afin que toutes les fonctions soient accessibles
immediatement, sans rien saisir.

COMMENT S'EN SERVIR

1. Se connecter avec les identifiants fournis.
2. « Tableau de bord » : la vue d'ensemble, food cost et valeur du stock.
3. « Fiches cocktails » ou « Fiches cuisine » : le cout et la marge de
   chaque recette ; toucher une fiche pour voir le detail.
4. « Controle des pertes » : choisir un inventaire de fin de periode dans
   la liste pour voir la perte chiffree, produit par produit.
5. « Inventaires » : ouvrir celui du 6 novembre pour voir un comptage en
   cours et saisir une quantite.
6. « Reception du jour » : saisir une livraison ; le stock et les couts se
   recalculent seuls.

SERVICES EXTERNES

Un seul : Supabase (hebergement de la base de donnees et authentification,
serveurs dans l'Union europeenne). L'application ne contacte aucun autre
service ; les polices sont embarquees dans l'application.

CONTENU

Tout le contenu est cree par l'editeur ou saisi par l'utilisateur. Aucun
contenu de tiers, aucune donnee achetee ou importee d'un service externe.
Les noms de produits visibles dans le compte de demonstration sont des
donnees d'exemple.

AUTRES ACCES

L'application est egalement accessible depuis un navigateur a l'adresse
https://restostock.fr/app/ avec les memes identifiants.
Assistance : https://restostock.fr/assistance.html`;

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
