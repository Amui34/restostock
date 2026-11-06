import { api, APP, VERSION, INFO } from './asc.mjs';

let r = await api('GET', `/v1/appStoreVersions/${VERSION}/appStoreVersionLocalizations`);
const loc = (r.body?.data || []).find(l => l.attributes.locale.startsWith('fr'));
const a = loc.attributes;
console.log('=== TEXTES ===');
console.log('  description :', (a.description || '').length, 'caractères');
console.log('  mots-clés   :', a.keywords || '—');
console.log('  assistance  :', a.supportUrl || '—');

r = await api('GET', `/v1/appInfos/${INFO}/appInfoLocalizations`);
const il = (r.body?.data || []).find(l => l.attributes.locale.startsWith('fr'));
console.log('  sous-titre  :', il?.attributes?.subtitle || '—');

r = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots`);
const shots = (r.body?.included || []).filter(x => x.type === 'appScreenshots');
console.log('\n=== CAPTURES ===');
for (const s of shots) {
  const at = s.attributes;
  const etat = at.assetDeliveryState?.state || '?';
  const souci = (at.assetDeliveryState?.errors || []).map(e => e.description).join(' · ');
  console.log(`  ${at.fileName} — ${etat} ${souci}`);
}
