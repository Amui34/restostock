import { api, APP, VERSION, INFO } from './asc.mjs';
const ok = v => v ? '✓' : '✗';

let r = await api('GET', `/v1/appStoreVersions/${VERSION}?include=build,appStoreReviewDetail`);
const v = r.body?.data?.attributes || {};
console.log('=== VERSION ===');
console.log(`  ${v.versionString} — ${v.appStoreState} — mise en vente ${v.releaseType}`);
const build = (r.body?.included || []).find(x => x.type === 'builds');
console.log(`  ${ok(build)} build rattaché ${build ? '(' + build.attributes.version + ')' : ''}`);
const rd = (r.body?.included || []).find(x => x.type === 'appStoreReviewDetails');
console.log(`  ${ok(rd?.attributes?.demoAccountName)} compte de démonstration déclaré`);
console.log(`  ${ok(rd?.attributes?.contactPhone)} contact de vérification`);

r = await api('GET', `/v1/appStoreVersions/${VERSION}/appStoreVersionLocalizations`);
const loc = (r.body?.data || []).find(l => l.attributes.locale.startsWith('fr'));
const a = loc?.attributes || {};
console.log('\n=== TEXTES (fr-FR) ===');
console.log(`  ${ok(a.description)} description (${(a.description||'').length} car.)`);
console.log(`  ${ok(a.keywords)} mots-clés`);
console.log(`  ${ok(a.supportUrl)} URL d'assistance`);

r = await api('GET', `/v1/appInfos/${INFO}?include=primaryCategory,secondaryCategory,ageRatingDeclaration`);
const cats = (r.body?.included || []).filter(x => x.type === 'appCategories').map(c => c.id);
console.log(`  ${ok(cats.length)} catégories : ${cats.join(' / ') || '—'}`);
const ar = (r.body?.included || []).find(x => x.type === 'ageRatingDeclarations');
console.log(`  ${ok(ar)} classification d'âge`);

r = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots`);
const shots = (r.body?.included || []).filter(x => x.type === 'appScreenshots');
const pretes = shots.filter(s => s.attributes?.assetDeliveryState?.state === 'COMPLETE').length;
console.log(`  ${ok(pretes === shots.length && shots.length >= 3)} captures : ${pretes}/${shots.length} prêtes`);

r = await api('GET', `/v1/apps/${APP}/appPriceSchedule`);
console.log(`  ${ok(r.body?.data)} prix`);
r = await api('GET', `/v1/apps/${APP}/appAvailabilityV2`);
console.log(`  ${ok(r.status < 300)} disponibilité`);

r = await api('GET', `/v1/apps/${APP}`);
console.log(`  ${ok(r.body?.data?.attributes?.contentRightsDeclaration)} droits de contenu`);
