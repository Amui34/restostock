/* Recopie l'application construite dans l'enveloppe iOS.
 *
 * Deux écarts volontaires avec la version web :
 *  - la bibliothèque Supabase est embarquée au lieu d'être chargée depuis un
 *    CDN. Une appli installée doit démarrer même si le CDN est lent ou bloqué ;
 *    c'est aussi ce qu'Apple vérifie au lancement pendant la revue.
 *  - les polices restent distantes : elles dégradent proprement, et les
 *    embarquer alourdirait le paquet pour un gain invisible.
 */
import { mkdirSync, readFileSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici    = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..', '..');
const src    = join(racine, 'app', 'app');
const www    = join(ici, '..', 'www');

if (!existsSync(join(src, 'index.html'))) {
  console.error('app/app/index.html absent — lancer d’abord : python3 source/build.py');
  process.exit(1);
}

mkdirSync(www, { recursive: true });
cpSync(src, www, { recursive: true });

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
const lib = join(ici, '..', 'vendor', 'supabase.min.js');
let html = readFileSync(join(www, 'index.html'), 'utf8');

if (existsSync(lib)) {
  cpSync(lib, join(www, 'supabase.min.js'));
  const avant = html;
  html = html.replace(CDN, 'supabase.min.js');
  if (html === avant) {
    console.error('Le script Supabase distant n’a pas été trouvé dans index.html — vérifier HEAD.frag.');
    process.exit(1);
  }
  writeFileSync(join(www, 'index.html'), html);
  console.log('✓ Supabase embarqué');
} else {
  console.error(`vendor/supabase.min.js absent — télécharger depuis ${CDN}`);
  process.exit(1);
}
console.log('✓ www synchronisé');
