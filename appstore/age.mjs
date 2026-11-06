import { api, INFO, erreur } from './asc.mjs';
const r = await api('GET', `/v1/appInfos/${INFO}/ageRatingDeclaration`);
const id = r.body?.data?.id;
if (!id) { console.log('  déclaration introuvable'); process.exit(1); }

/* Un outil de gestion pour professionnels : rien de sensible, aucun contenu
   produit par les utilisateurs qui serait publié, aucune publicité. Le web
   sans restriction est à « false » : l'application n'ouvre pas de navigateur. */
const attributs = {
  violenceCartoonOrFantasy: 'NONE', violenceRealisticProlongedGraphicOrSadistic: 'NONE',
  violenceRealistic: 'NONE', profanityOrCrudeHumor: 'NONE', matureOrSuggestiveThemes: 'NONE',
  horrorOrFearThemes: 'NONE', medicalOrTreatmentInformation: 'NONE',
  alcoholTobaccoOrDrugUseOrReferences: 'NONE', gamblingSimulated: 'NONE',
  sexualContentOrNudity: 'NONE', sexualContentGraphicAndNudity: 'NONE',
  gunsOrOtherWeapons: 'NONE', contests: 'NONE', healthOrWellnessTopics: false,
  gambling: false, unrestrictedWebAccess: false,
  advertising: false, messagingAndChat: false, socialMedia: false,
  userGeneratedContent: false, parentalControls: false, lootBox: false,
  ageAssurance: false,
};
let r2 = await api('PATCH', `/v1/ageRatingDeclarations/${id}`, {
  data: { type: 'ageRatingDeclarations', id, attributes: attributs },
});
console.log("  classification d'âge :", r2.status === 200 ? 'déclarée (4+)' : erreur(r2));
