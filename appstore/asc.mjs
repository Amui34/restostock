/* Client App Store Connect pour RestoStock.
 *
 * La clé API fait tout : signature des builds, envoi, et la fiche. Elle vit
 * dans ~/.appstoreconnect et n'entre jamais dans ce dépôt — qui est public.
 *
 *   import { api, APP, VERSION, INFO } from './asc.mjs'
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_ID = 'FJ7JL8VV39';
const ISSUER = 'fd850757-5b61-43a4-8f6e-99059e4a50f4';
const PEM = readFileSync(`${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`, 'utf8');

export const APP     = '6830269654';
export const VERSION = 'd136a621-5ce8-4c9e-9714-b485090ab79d';
export const INFO    = '67184661-d6f5-4f7f-83c7-dfc69fb3a6dc';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

function jeton() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const b = b64({ iss: ISSUER, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const s = createSign('SHA256'); s.update(`${h}.${b}`); s.end();
  const der = s.sign(PEM);
  // DER -> JOSE : r et s sur 32 octets chacun, sans l'enrobage ASN.1.
  let i = 2; if (der[1] & 0x80) i += der[1] & 0x7f;
  const rl = der[i + 1], r = der.subarray(i + 2, i + 2 + rl);
  const j = i + 2 + rl, sl = der[j + 1], sv = der.subarray(j + 2, j + 2 + sl);
  const pad = x => x.length > 32 ? x.subarray(x.length - 32) : Buffer.concat([Buffer.alloc(32 - x.length), x]);
  return `${h}.${b}.${Buffer.concat([pad(r), pad(sv)]).toString('base64url')}`;
}

export async function api(methode, chemin, corps) {
  const res = await fetch('https://api.appstoreconnect.apple.com' + chemin, {
    method: methode,
    headers: { Authorization: 'Bearer ' + jeton(), 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const t = await res.text();
  return { status: res.status, body: t ? JSON.parse(t) : null };
}

export function erreur(r) {
  return r.body?.errors?.map(e => e.detail || e.title).join(' · ') || JSON.stringify(r.body).slice(0, 200);
}
