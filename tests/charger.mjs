/* Charge les fonctions de calcul de l'application pour les tester.
 *
 * Le code vit dans une page HTML, enfermé dans une IIFE qui se termine par un
 * render() : impossible à importer tel quel depuis Node. Plutôt que recopier
 * les formules dans le test — où elles cesseraient d'être les vraies le jour
 * où quelqu'un corrige l'original — on exécute le script d'origine dans un bac
 * à sable, avec juste ce qu'il faut de faux DOM pour qu'il se charge.
 *
 * On lit la version HORS LIGNE construite plutôt que source/core.html : la
 * source contient des marqueurs de build (__PERSIST_JS__ et les autres) qui
 * ne sont pas du JavaScript valide. C'est donc aussi, accessoirement, un test
 * que le build produit quelque chose qui s'exécute.
 *
 * Chaque découpe est vérifiée : si le fichier change de forme, le chargement
 * échoue bruyamment. Un test qui passerait sur du code qu'il ne charge plus
 * serait pire que pas de test du tout.
 */
import { readFileSync, statSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const CONSTRUIT = new URL('../app/livre-de-prix-hors-ligne.html', import.meta.url);
const SOURCE    = new URL('../source/core.html', import.meta.url);

/* Les fonctions qu'on expose au test. Les nommer ici plutôt que tout exporter
   dit aussi ce qu'on considère comme le cœur du calcul. */
const EXPOSEES = [
  'parseNum', 'round3',
  'primarySupplier', 'lastPrice', 'weighedEntries', 'averagePrice', 'priceBasis', 'currentPrice',
  'valueForQty', 'refUnitOf',
  'liveIngredientPR', 'liveIngredientPRP', 'recipeTotals', 'recipeTVA',
];

export function chargerCalculs() {
  if (statSync(SOURCE).mtimeMs > statSync(CONSTRUIT).mtimeMs) {
    throw new Error('source/core.html est plus récent que le build : lancer « python3 source/build.py » avant les tests.');
  }

  const html = readFileSync(CONSTRUIT, 'utf8');
  const debut = html.indexOf('<script>');
  const fin = html.lastIndexOf('</script>');
  if (debut < 0 || fin < 0) throw new Error('charger.mjs : bloc <script> introuvable.');
  let js = html.slice(debut + '<script>'.length, fin);

  // boot() démarre l'interface : on le remplace par la sortie des fonctions.
  if (!js.includes('\nboot();')) {
    throw new Error('charger.mjs : appel « boot(); » introuvable — la page a changé de forme, adapter le harnais.');
  }
  js = js.replace('\nboot();',
    `\nglobalThis.__calculs = { ${EXPOSEES.join(', ')}, __etat: s => { state = s; } };`);

  const rien = () => {};
  const element = {
    textContent: '', innerHTML: '', value: '', dataset: {}, children: [],
    style: { setProperty: rien, removeProperty: rien, getPropertyValue: () => '' },
    classList: { add: rien, remove: rien, toggle: rien, contains: () => false },
    addEventListener: rien, removeEventListener: rien, appendChild: rien, remove: rien,
    setAttribute: rien, removeAttribute: rien, toggleAttribute: rien,
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    scrollWidth: 0, clientWidth: 0, focus: rien, blur: rien,
  };
  const neuf = () => ({ ...element, style: { setProperty: rien, removeProperty: rien, getPropertyValue: () => '' }, dataset: {}, classList: { ...element.classList } });

  /* Le script lit ses données de départ dans la page. On lui rend les vraies :
     un seed vide ferait passer des tests sur un état qui n'existe nulle part. */
  const seed = html.match(/<script type="application\/json" id="seed-data">([\s\S]*?)<\/script>/);
  if (!seed) throw new Error('charger.mjs : bloc « seed-data » introuvable.');

  const bac = {
    console,
    document: {
      getElementById: id => (id === 'seed-data' ? { ...neuf(), textContent: seed[1] } : neuf()),
      querySelector: () => null, querySelectorAll: () => [],
      createElement: neuf, addEventListener: rien, documentElement: neuf(), body: neuf(),
      head: neuf(), fonts: undefined,
    },
    localStorage: { getItem: () => null, setItem: rien, removeItem: rien },
    location: { hash: '', pathname: '/', origin: 'http://test', href: 'http://test/' },
    navigator: { userAgent: 'node' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: rien, cancelAnimationFrame: rien,
    matchMedia: () => ({ matches: false, addEventListener: rien, addListener: rien }),
    addEventListener: rien, removeEventListener: rien,
    alert: rien, confirm: () => false, prompt: () => null,
    Image: function () { return neuf(); },
  };
  bac.window = bac;
  bac.globalThis = bac;
  bac.self = bac;

  runInContext(js, createContext(bac), { filename: 'livre-de-prix-hors-ligne.html' });

  const calculs = bac.__calculs;
  if (!calculs) throw new Error('charger.mjs : les fonctions n’ont pas été exposées — le script a échoué avant la fin.');
  const manquantes = EXPOSEES.filter(n => typeof calculs[n] !== 'function');
  if (manquantes.length) throw new Error(`charger.mjs : fonctions absentes : ${manquantes.join(', ')}`);
  return calculs;
}
