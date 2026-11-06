import { api, APP, erreur } from './asc.mjs';

// Les paliers de prix se demandent sans filtre d'app tant qu'elle n'en a pas.
let r = await api('GET', '/v2/appPricePoints?filter[territory]=FRA&filter[app]=' + APP + '&limit=5');
if (!(r.body?.data || []).length) {
  r = await api('GET', `/v1/apps/${APP}/appPricePoints?filter[territory]=FRA&limit=5`);
}
const points = r.body?.data || [];
console.log('  paliers obtenus :', points.length, points.length ? '→ ' + points.slice(0,3).map(p => p.attributes?.customerPrice).join(', ') : erreur(r));
