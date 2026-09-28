# Feuille de route

## L'objectif n°1 : mesurer les pertes réelles

Par produit, sur un mois :

```
Consommation RÉELLE    = stock de début + réceptions − inventaire de fin
Consommation THÉORIQUE = fiches vendues × quantité par fiche
─────────────────────────────────────────────────────────────────────
PERTE                  = réelle − théorique
```

| Écart | Ce que ça veut dire |
|---|---|
| **Positif** | Il a disparu plus que les ventes ne le justifient : casse, vol, sur-dosage, ou réception non saisie |
| **Proche de zéro** | Les fiches techniques sont justes et le service est maîtrisé |
| **Négatif** | Réception oubliée, inventaire mal compté, ou fiche technique sous-dosée |

## Qui fait quoi

| Quand | Qui | Quoi |
|---|---|---|
| **Chaque jour** | Chef barman, chef de cuisine | Saisir les arrivages, tenir les fiches techniques à jour |
| **Chaque mois** | Chef barman, chef de cuisine | Inventaire physique, produit par produit |
| **Chaque mois, ensuite** | Gérante | Saisir ce qui a été vendu, lire le contrôle des pertes |

Le principe : **la charge quotidienne repose sur les chefs et reste légère ; le
contrôle est automatique.** Toute fonctionnalité qui alourdit le geste quotidien
se juge à cette aune.

## Les tâches

### En cours

- [ ] **0. Mise en ligne** — il me manque deux valeurs de ton projet Supabase
      (étape 4 du guide). Tout le reste est prêt et testé.
- [ ] **1. Nettoyage des données** — bloquant : les ventes écrivent maintenant de
      vrais mouvements de stock, donc un format d'achat faux creuse le stock pour
      de bon.
  - [x] 1a. Unités déduites du nom du produit — 23 corrigés
  - [x] 1b. Fournisseurs en double — `aristide`/`Aristide` unifiés sur 25 produits
  - [x] 1d. Garnitures sans format → 41 passées à l'unité
  - [x] Contrôle d'innocuité : les 86 coûts de fiche recalculés, aucun n'a bougé
        (`source/nettoyage.py`, refuse d'écrire si un coût change)
  - [x] 1e. **Écran « À vérifier »** — construit et testé, accessible dans le
        menu **Données**. Le compteur dans la navigation indique ce qui reste.

### Les arbitrages à faire dans l'écran « À vérifier »

Je ne les tranche pas : ils changent les prix de revient. Chaque point offre
une réponse « c'est normal » qui le fait disparaître sans rien modifier.

| Nombre | Quoi | Ce qu'on répond |
|---|---|---|
| **4** | Préparations sans rendement | « Cette préparation fait combien de portions ? » |
| **32** | Anciens facteurs de correction | Idem — ils marchent aujourd'hui mais se dérèglent dès qu'on modifie la fiche |
| **13** | Lignes de récapitulatif | « Retirer la ligne » ou « c'est un vrai coût » (emballage, cuisson) |
| **30** | Formats d'achat manquants | Ce que contient le conditionnement : un carton de 500 pailles = « 500 unités » |
| **29** | Produits quasi identiques | « Tout garder sous A / sous B » ou « produits différents » |
| **1** | Prix d'achat aberrant | La « paille » à 481,20 € |

**Ordre conseillé** : les facteurs de correction *avant* les lignes de
récapitulatif — un facteur a été calibré avec la ligne en place, le retirer
d'abord fausse le résultat. L'écran le signale sur les fiches concernées.

### Ensuite

- [ ] **2. Familles manquantes** (209 produits) — sans elles, l'inventaire cuisine
      affiche un bloc de 173 lignes « Non classé »
- [ ] **3. Écran Contrôle des pertes** — l'objectif n°1, calculé entre deux
      inventaires validés
- [ ] **4. Écran Entrées / Sorties** sur une période

### Plus tard

- [ ] 5. Grimoire : historique des versions de fiche, anciennes fiches consultables
- [ ] 6. Photos sur les fiches techniques
- [x] 7. Partage en équipe — **code terminé**, en attente du projet Supabase :
      cible `supabase` (sauvegarde ligne par ligne, connexion d'équipe, mise à
      jour en direct), script SQL, guide en cinq étapes. Voir
      [mise-en-ligne.md](mise-en-ligne.md)
- [ ] 8. Photo du bon de livraison → pré-remplissage automatique **(dépend de la 7 :
      la clé d'accès à l'IA ne peut pas vivre dans une page publique)**
- [ ] 9. Modularité par métier (boulangerie…) — les catégories sont déjà
      configurables dans les Réglages ; le reste attendra

## Fait

- [x] Code dédoublonné : un seul `core.html` génère les deux versions
- [x] Réception du jour : fournisseur → quantité + prix au kilo, comparaison
      automatique entre fournisseurs
- [x] Ventes du service : les fiches techniques déduisent le stock
- [x] Inventaire pré-rempli, rangé par famille
- [x] Unité de stock corrigée sur 283 produits qui affichaient « 100 litre » pour 100 cl
- [x] Catégories configurables
- [x] **Prix moyen pondéré** — les coûts sont chiffrés sur la moyenne de ce qu'on
      a réellement payé, pondérée par les quantités reçues, au lieu du dernier
      prix qui saute à chaque livraison
- [x] **Convertisseur de quantité** — saisir « 6 bouteilles » ou « 2 kg » au lieu
      de convertir de tête ; l'équivalence s'affiche avant validation
- [x] **Navigation regroupée par moment d'usage** — Tous les jours / Chaque mois /
      Piloter / Données
- [x] **Tableau de bord recentré** — un encadré « À faire » actionnable, et trois
      chiffres au lieu de sept compteurs
- [x] Guide de l'équipe illustré
