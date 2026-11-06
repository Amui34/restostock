import { api, APP } from './asc.mjs';
let r = await api('GET', `/v1/apps/${APP}/appPriceSchedule?include=manualPrices,baseTerritory`);
const prix = (r.body?.included || []).filter(x => x.type === 'appPrices');
console.log('  calendrier de prix :', r.body?.data ? 'présent' : 'absent', '·', prix.length, 'palier(s)');
for (const p of prix.slice(0, 3)) {
  const pp = await api('GET', `/v1/appPrices/${p.id}?include=appPricePoint`);
  const pt = (pp.body?.included || [])[0];
  console.log('    prix client :', pt?.attributes?.customerPrice ?? '—');
}
r = await api('GET', `/v1/apps/${APP}/appAvailabilityV2?include=territoryAvailabilities&limit[territoryAvailabilities]=200`);
const ta = (r.body?.included || []).filter(x => x.type === 'territoryAvailabilities');
const ouverts = ta.filter(t => t.attributes?.available).length;
console.log('  disponibilité :', r.body?.data ? `${ouverts} pays ouverts sur ${ta.length}` : 'non définie');
console.log('  nouveaux pays automatiques :', r.body?.data?.attributes?.availableInNewTerritories ?? '—');
