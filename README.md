# RestoStock

Suivi des coûts et des stocks en restauration. Chaque établissement crée son
espace : prix d'achat par fournisseur, coût et food cost de chaque fiche
technique, stock, inventaires, et mesure des pertes réelles en fin de mois.

**restostock.fr** — la vitrine publique · **restostock.fr/app/** — l'application

## Par où commencer

- **Tu travailles au bar ou en cuisine** → ouvre `docs/guide-equipe.html`
  d'un double-clic. Comment ouvrir l'appli, lire une fiche, mettre à jour un
  prix, faire un inventaire. Aucune connaissance technique nécessaire, et le
  fichier se copie tel quel sur une tablette (captures incluses).
- **Tu modifies le code** → [docs/developpement.md](docs/developpement.md)
- **Tu mets l'appli à disposition de l'équipe** → [docs/mise-en-ligne.md](docs/mise-en-ligne.md)

## Structure du dossier

```
app/        Les fichiers à ouvrir. Générés — ne pas les modifier à la main.
source/     Le code de l'application (core.html) et les scripts de build.
data/       Les données : produits, fiches, fournisseurs, inventaires.
docs/       Les guides (source .md + page .html) et les captures d'écran.
```

Tout ce qui se trouve dans `app/` et `docs/guide-equipe.html` est **généré**.
On modifie `source/` et `docs/*.md`, puis on régénère.

## Les deux versions

| Fichier | Usage | Sauvegarde |
|---|---|---|
| `app/index.html` | **La vitrine publique** — explique l'outil, généré depuis `source/landing.html` | — |
| `app/app/index.html` | **L'application d'équipe**, servie sous `/app/` | Base partagée Supabase, en direct |
| `app/livre-de-prix-hors-ligne.html` | Filet de secours : s'ouvre sans connexion, sur la tablette | Dans ce navigateur, sur cet appareil uniquement |
| `app/livre-de-prix.html` | Version Artifact Claude, héritée du démarrage du projet | Dans l'Artifact |

La mise en ligne se fait en cinq étapes décrites dans
[docs/mise-en-ligne.md](docs/mise-en-ligne.md) — environ 35 minutes, sans
connaissance technique.

Pense à exporter régulièrement une sauvegarde depuis l'écran **Réglages**.

## Modifier l'application

Le code n'existe qu'à un seul endroit, `source/core.html`. Le build en tire
les deux versions, qui ne diffèrent que par leur façon de sauvegarder — il
n'y a donc plus rien à tenir en double.

```bash
python3 source/build.py            # les trois versions
python3 source/build.py supabase   # seulement celle de l'équipe
```

Les fichiers de `app/` sont écrasés à chaque build : ne jamais y modifier quoi
que ce soit directement.
