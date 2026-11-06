/* Gratuit, partout. Le prix se pose via un « appPriceSchedule » dont la
 * base est un pays de référence — la France, puisque c'est le marché. */
import { api, APP, erreur } from './asc.mjs';

let r = await api('GET', `/v1/apps/${APP}/appPriceSchedule`);
if (r.body?.data) { console.log('  un calendrier de prix existe déjà'); }

// Le palier gratuit, pour la France
r = await api('GET', '/v2/appPricePoints?filter[app]=' + APP + '&filter[territory]=FRA&limit=200');
const gratuit = (r.body?.data || []).find(p => p.attributes?.customerPrice === '0.00');
console.log('  palier gratuit :', gratuit ? 'trouvé' : 'INTROUVABLE');

if (gratuit) {
  const res = await api('POST', '/v1/appPriceSchedules', {
    data: { type: 'appPriceSchedules',
      relationships: {
        app: { data: { type: 'apps', id: APP } },
        baseTerritory: { data: { type: 'territories', id: 'FRA' } },
        manualPrices: { data: [{ type: 'appPrices', id: '${price}' }] },
      } },
    included: [{ type: 'appPrices', id: '${price}',
      attributes: { startDate: null, endDate: null },
      relationships: { appPricePoint: { data: { type: 'appPricePoints', id: gratuit.id } } } }],
  });
  console.log('  prix :', res.status < 300 ? 'gratuit, base France' : erreur(res));
}

// Disponibilité : tous les pays
r = await api('GET', '/v1/territories?limit=200');
const pays = (r.body?.data || []).map(t => ({ type: 'territories', id: t.id }));
console.log('  pays disponibles :', pays.length);
const dispo = await api('POST', '/v1/appAvailabilitiesV2', {
  data: { type: 'appAvailabilities',
    attributes: { availableInNewTerritories: true },
    relationships: { app: { data: { type: 'apps', id: APP } },
                     territoryAvailabilities: { data: pays.map((p, i) => ({ type: 'territoryAvailabilities', id: `${'$'}{t${i}}` })) } } },
  included: pays.map((p, i) => ({ type: 'territoryAvailabilities', id: `${'$'}{t${i}}`,
    attributes: { available: true },
    relationships: { territory: { data: p } } })),
});
console.log('  disponibilité :', dispo.status < 300 ? `${pays.length} pays` : erreur(dispo));
