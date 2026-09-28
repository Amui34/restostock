# Notes techniques

Pour la personne qui modifie le code. L'équipe du bar n'a pas besoin de lire
ce document — le sien est [guide-equipe.md](guide-equipe.md).

## Le principe du build

L'application est **un seul fichier de code**, `source/core.html` (~2 900
lignes : HTML, CSS et JavaScript sans dépendance ni outil de compilation).

Ce fichier ne sait rien de la façon dont les données sont stockées. Partout où
le stockage intervient, il laisse un marqueur `__NOM__`. Le script de build
remplace chaque marqueur par le fragment correspondant de la cible choisie :

```
source/core.html                    le code de l'appli, écrit une seule fois
source/targets/online/*.frag        comment la version en ligne sauvegarde
source/targets/offline/*.frag       comment la version hors-ligne sauvegarde
data/db_seed_all.json               les données, injectées à la place de __SEED_JSON__
        ↓  python3 source/build.py
app/livre-de-prix.html
app/livre-de-prix-hors-ligne.html
```

**Pourquoi.** Les deux versions étaient auparavant deux fichiers complets de
3 000 lignes, identiques à 95 %. Chaque correction devait être faite deux fois,
et elles avaient déjà commencé à diverger (les gestionnaires de filtres de
stock n'étaient plus au même endroit dans les deux). Une seule source supprime
la classe entière de ce problème.

## Commandes

```bash
python3 source/build.py            # régénère les deux fichiers de app/
python3 source/build.py offline    # une seule cible
python3 source/build.py --check    # compare sans écrire
python3 source/build_guide.py      # regénère docs/guide-equipe.html
```

Le guide de l'équipe suit le même principe : la source est
`docs/guide-equipe.md`, et `build_guide.py` en tire une page HTML autonome
avec les captures encastrées — un seul fichier à copier sur une tablette,
sans dossier d'images à transporter. Modifier le Markdown, jamais le HTML.

Les captures elles-mêmes sont régénérables en série : servir
`app/livre-de-prix-hors-ligne.html` en local, puis appeler Chrome headless sur
chaque adresse d'écran (`#stock`, `#recipe-detail/r20`…).

Toute modification du code passe par `source/core.html`, jamais par les
fichiers de `app/` — ils sont écrasés à chaque build.

## Les marqueurs

| Marqueur | Ce qu'il contient |
|---|---|
| `__HEAD__` | Début du document (la version en ligne est enveloppée par l'Artifact, l'autre non) |
| `__BODY_OPEN__`, `__DOC_CLOSE__` | Balises d'ouverture/fermeture propres au hors-ligne |
| `__BRAND_SUB__`, `__SIDEBAR_NOTE__` | Mentions du bandeau latéral |
| `__PERSIST_VARS__`, `__PERSIST_JS__` | **Le cœur de la différence** : chargement et sauvegarde |
| `__SETTINGS_STORAGE__` | Bloc « sauvegarde » de l'écran Réglages (export/import en hors-ligne) |
| `__EXTRA_ACTIONS__`, `__EXTRA_CHANGE__` | Gestionnaires supplémentaires propres à une cible |
| `__BOOT__` | Démarrage (asynchrone en ligne, synchrone hors-ligne) |
| `__SEED_JSON__` | Les données de `data/db_seed_all.json` |

Ajouter une cible = créer `source/targets/<nom>/` avec les onze fragments et
déclarer le nom dans `TARGETS` de `build.py`.

## Vérifier une modification

Il n'y a pas de suite de tests. Le contrôle minimal après changement :

```bash
python3 source/build.py
# la syntaxe JavaScript du fichier produit doit être valide
python3 - <<'PY' > /tmp/check.js
import re; print(re.search(r'<script>\n(.*)\n</script>', open('app/livre-de-prix-hors-ligne.html').read(), re.S).group(1))
PY
node --check /tmp/check.js
```

Puis ouvrir `app/livre-de-prix-hors-ligne.html` dans un navigateur et parcourir
les écrans. Chaque écran a sa propre adresse (`#stock`, `#products`,
`#recipe-detail/r20`), ce qui permet aussi de générer des captures en série
avec Chrome headless — c'est ainsi que les images du guide ont été produites.

## Le modèle de données

Un seul objet, sauvegardé en bloc :

- `products[]` — nom, `unit_label` (format d'achat brut), `base_unit` +
  `purchase_size` (format normalisé, qui permet le prix au cl/g/unité),
  `suppliers[].history[]` (prix datés), stock et mouvements.
- `recipes[]` — `ingredients[]` référençant un produit par `product_id`,
  `pv_ttc`, `tva_rate`, indicateurs de lot.
- `inventories[]` — sessions de comptage et écarts.
- `settings` — seuil d'alerte de marge, TVA par défaut, zones de rangement.

Les prix ne sont jamais stockés calculés : tout est recalculé à l'affichage à
partir de l'historique fournisseur. C'est ce qui permet de reconstituer
l'historique complet sans avoir instrumenté quoi que ce soit.

## État connu des données

Audit du jeu importé depuis les tableurs Numbers (477 produits, 86 fiches) :

| Constat | Nombre | Conséquence |
|---|---|---|
| Produits sans `base_unit` | 94 | Prix unitaire incalculable — **42 fiches sur 86** ont au moins un ingrédient non chiffré (d'où la « paille » à 481 €) |
| Lignes de notes du tableur importées comme produits | ~15 | « PR pour 4 pax = 600 gr », « cuisson basse température » polluent le catalogue |
| `stock_low_threshold` non renseigné | 477 / 477 | L'écran « Suggestions de commande » ne peut rien afficher |
| Doublons de fournisseurs | `aristide`/`Aristide`, `Avidoc`/`Mericq`/`Avidoc /Mericq` | Comptes éclatés |
| Produits sans aucun prix | 49 | Dont des garnitures légitimes (paille, glace, zeste) |
| Produits sans famille | 209 (dont **173 en cuisine sur 301**) | La fiche d'inventaire pré-remplie et la réception groupent par famille : ces produits atterrissent tous dans un bloc « Non classé » |

Sur les 94 unités manquantes, **23 sont récupérables automatiquement** : le
format figure dans le *nom* du produit (« Guiness 50cl », « fut karmeliet
30L ») alors que le parseur ne lit que `unit_label`. Un repli sur le nom les
débloque.

## Saisie quotidienne : réception et inventaire

Deux écrans partagent un principe : **ne jamais rappeler `render()` pendant une
saisie**. Sur une fiche d'inventaire pré-remplie de 300 lignes, un rendu complet
par quantité tapée détruit l'`<input>` en cours et casse la tabulation. Les
fonctions `refreshReception()` et `refreshInventoryRow()` ne retouchent que les
cellules concernées, le compteur et le total.

- **`viewReception()`** — n'ajoute que du stock (`type:'reception'`). Le
  périmètre est délibérément étroit : pertes, casses et corrections gardent
  leurs propres écrans, pour qu'on ne puisse pas corriger un stock en croyant
  saisir une livraison. La saisie vit dans `ui.recDraft`, rien n'est écrit
  avant validation. Sans recherche ni filtre fournisseur, l'écran n'affiche
  que les 40 produits qui bougent le plus, plutôt que de déverser les 477.
- **Inventaire pré-rempli** — `productsForInventory(category, zone)` remplit
  `counts` à la création. Les lignes laissées à `counted_qty === null` sont
  ignorées à la validation : lister large ne fausse donc rien. Le mode « vide »
  d'origine reste disponible dans la modale.

## Reste à faire

1. **Partage en équipe** — voir [mise-en-ligne.md](mise-en-ligne.md). C'est la
   priorité : la version en ligne actuelle sauvegarde en republiant la page
   entière, donc deux personnes qui saisissent en même temps provoquent un
   conflit et l'une des deux perd son travail.
2. **Nettoyage des données** — les six points du tableau ci-dessus. Les
   familles manquantes sont devenues prioritaires : elles conditionnent la
   lisibilité de la fiche d'inventaire pré-remplie.
3. **Catégories configurables** — `bar` et `cuisine` sont écrits en dur à 35
   endroits. Les remplacer par une liste modifiable dans les Réglages est ce
   qui permettra d'ouvrir l'outil à une boulangerie sans le réécrire.
