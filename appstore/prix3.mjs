import { api, APP, erreur } from './asc.mjs';

let r = await api('GET', `/v1/apps/${APP}/appPricePoints?filter[territory]=FRA&limit=5`);
const gratuit = (r.body?.data || []).find(p => parseFloat(p.attributes?.customerPrice) === 0);
console.log('  palier gratuit :', gratuit ? gratuit.id.slice(0, 20) + '…' : 'INTROUVABLE');
if (!gratuit) process.exit(1);

const res = await api('POST', '/v1/appPriceSchedules', {
  data: { type: 'appPriceSchedules',
    relationships: {
      app:           { data: { type: 'apps', id: APP } },
      baseTerritory: { data: { type: 'territories', id: 'FRA' } },
      manualPrices:  { data: [{ type: 'appPrices', id: '${p0}' }] },
    } },
  included: [{ type: 'appPrices', id: '${p0}',
    attributes: { startDate: null, endDate: null },
    relationships: { appPricePoint: { data: { type: 'appPricePoints', id: gratuit.id } } } }],
});
console.log('  prix :', res.status < 300 ? 'gratuit, base France' : erreur(res));

// Disponibilité : tous les pays, et les futurs automatiquement.
const t = await api('GET', '/v1/territories?limit=200');
const pays = (t.body?.data || []).map(x => x.id);
const dispo = await api('POST', '/v2/appAvailabilities', {
  data: { type: 'appAvailabilities',
    attributes: { availableInNewTerritories: true },
    relationships: {
      app: { data: { type: 'apps', id: APP } },
      territoryAvailabilities: { data: pays.map((_, i) => ({ type: 'territoryAvailabilities', id: '${t' + i + '}' })) } } },
  included: pays.map((id, i) => ({ type: 'territoryAvailabilities', id: '${t' + i + '}',
    attributes: { available: true },
    relationships: { territory: { data: { type: 'territories', id } } } })),
});
console.log('  disponibilité :', dispo.status < 300 ? `${pays.length} pays` : erreur(dispo));
