import { api, APP, VERSION, INFO, erreur } from './asc.mjs';

// --- Catégories -----------------------------------------------------------
let r = await api('PATCH', `/v1/appInfos/${INFO}`, {
  data: { type: 'appInfos', id: INFO, relationships: {
    primaryCategory:   { data: { type: 'appCategories', id: 'BUSINESS' } },
    secondaryCategory: { data: { type: 'appCategories', id: 'PRODUCTIVITY' } },
  } },
});
console.log('  catégories :', r.status === 200 ? 'Entreprise / Productivité' : erreur(r));

// --- Classification d'âge : rien de sensible dans un outil de gestion -----
r = await api('GET', `/v1/appInfos/${INFO}/ageRatingDeclaration`);
const age = r.body?.data?.id;
if (age) {
  const r2 = await api('PATCH', `/v1/ageRatingDeclarations/${age}`, {
    data: { type: 'ageRatingDeclarations', id: age, attributes: {
      violenceCartoonOrFantasy: 'NONE', violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      violenceRealistic: 'NONE', profanityOrCrudeHumor: 'NONE', matureOrSuggestiveThemes: 'NONE',
      horrorOrFearThemes: 'NONE', medicalOrTreatmentInformation: 'NONE', alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      gamblingSimulated: 'NONE', sexualContentOrNudity: 'NONE', sexualContentGraphicAndNudity: 'NONE',
      gambling: false, unrestrictedWebAccess: false, contests: 'NONE',
    } },
  });
  console.log("  classification d'âge :", r2.status === 200 ? '4+' : erreur(r2));
}

// --- Droits sur le contenu : rien qui appartienne à un tiers --------------
r = await api('PATCH', `/v1/apps/${APP}`, {
  data: { type: 'apps', id: APP, attributes: { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' } },
});
console.log('  droits de contenu :', r.status === 200 ? 'aucun contenu de tiers' : erreur(r));

// --- Mise en vente : manuelle, pour choisir le moment ---------------------
r = await api('PATCH', `/v1/appStoreVersions/${VERSION}`, {
  data: { type: 'appStoreVersions', id: VERSION, attributes: { releaseType: 'MANUAL' } },
});
console.log('  mise en vente :', r.status === 200 ? 'manuelle' : erreur(r));
