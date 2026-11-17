/* Les calculs sur lesquels RestoStock engage un restaurant : le prix de
 * revient, la marge, le food cost, la valorisation du stock.
 *
 * Ce sont les seuls chiffres que personne ne peut vérifier de tête en service.
 * Une erreur de facteur 100 sur un prix au centilitre ne se voit pas à l'écran
 * — elle se voit en fin de mois, sur la marge.
 *
 *   usage : node --test tests/
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { chargerCalculs } from './charger.mjs';

let c;
before(() => { c = chargerCalculs(); });

/* Un produit minimal : le gin, acheté à la bouteille de 70 cl, stocké en cl. */
function gin(historique) {
  return {
    id: 'p1', name: 'Gin', base_unit: 'cl', purchase_size: 70,
    primary_supplier_id: 'f1',
    suppliers: [{ id: 'f1', name: 'Fournisseur', history: historique }],
  };
}

describe('Saisie des nombres', () => {
  /* Sur un clavier français on tape « 1,5 ». Un champ numérique renvoie alors
     une chaîne vide, sans message : la quantité est perdue en silence. C'est le
     bug le plus coûteux de l'application, parce qu'il ne se voit pas. */
  test('la virgule française est comprise', () => {
    assert.equal(c.parseNum('1,5'), 1.5);
    assert.equal(c.parseNum('1.5'), 1.5);
  });

  test('les séparateurs de milliers ne cassent pas la saisie', () => {
    assert.equal(c.parseNum('1 250,75'), 1250.75);
    assert.equal(c.parseNum('1 250,75'), 1250.75, 'espace insécable');
    assert.equal(c.parseNum('1 250,75'), 1250.75, 'espace fine insécable');
  });

  test('une saisie vide ou absurde ne devient pas zéro', () => {
    // Zéro voudrait dire « j'ai compté, il n'y a rien ». Ce n'est pas pareil.
    assert.ok(Number.isNaN(c.parseNum('')));
    assert.ok(Number.isNaN(c.parseNum('   ')));
    assert.ok(Number.isNaN(c.parseNum('abc')));
    assert.ok(Number.isNaN(c.parseNum(null)));
    assert.ok(Number.isNaN(c.parseNum(undefined)));
  });

  test('zéro saisi reste zéro', () => {
    assert.equal(c.parseNum('0'), 0);
    assert.equal(c.parseNum('0,0'), 0);
  });
});

describe('Prix moyen pondéré', () => {
  test('en dessous de deux livraisons, pas de moyenne', () => {
    // Une seule livraison n'est pas une moyenne : c'est un prix.
    assert.equal(c.averagePrice(gin([{ price: 10, qty: 6, date: '2026-01-01' }])), null);
    assert.equal(c.averagePrice(gin([])), null);
  });

  test('la moyenne est pondérée par les quantités, pas par le nombre de lignes', () => {
    // 6 bouteilles à 10 € puis 2 à 20 € : la moyenne arithmétique dirait 15 €.
    // La bonne réponse est 12,50 € — sinon le dépannage de 2 bouteilles pèse
    // autant que la livraison principale.
    const p = gin([
      { price: 10, qty: 6, date: '2026-01-01' },
      { price: 20, qty: 2, date: '2026-02-01' },
    ]);
    assert.equal(c.averagePrice(p), (10 * 6 + 20 * 2) / 8);
    assert.equal(c.averagePrice(p), 12.5);
  });

  test('les lignes sans quantité sont ignorées', () => {
    /* L'historique importé des tableurs mélange des conditionnements : le sel à
       5,05 € et à 0,44 € n'est pas une baisse de prix, ce sont deux formats. En
       faire une moyenne inventerait une précision qu'on n'a pas. */
    const p = gin([
      { price: 99, date: '2025-01-01' },            // importée, sans quantité
      { price: 10, qty: 6, date: '2026-01-01' },
      { price: 20, qty: 2, date: '2026-02-01' },
    ]);
    assert.equal(c.weighedEntries(p).length, 2);
    assert.equal(c.averagePrice(p), 12.5);
  });

  test('sans moyenne fiable, on retombe sur le dernier prix connu', () => {
    const p = gin([{ price: 99, date: '2025-01-01' }, { price: 11, date: '2026-01-01' }]);
    const base = c.priceBasis(p);
    assert.equal(base.kind, 'dernier');
    assert.equal(base.price, 11);
    assert.equal(c.currentPrice(p), 11);
  });

  test('dès que la moyenne existe, c’est elle qui sert de base', () => {
    const p = gin([
      { price: 10, qty: 6, date: '2026-01-01' },
      { price: 20, qty: 2, date: '2026-02-01' },
    ]);
    const base = c.priceBasis(p);
    assert.equal(base.kind, 'moyen');
    assert.equal(c.currentPrice(p), 12.5);
    assert.notEqual(c.currentPrice(p), 20, 'le dernier prix ne doit pas primer');
  });
});

describe('Valorisation du stock', () => {
  test('une quantité en unité de base est ramenée au format d’achat', () => {
    /* Le prix est celui de la bouteille de 70 cl ; le stock est compté en cl.
       Sans la division par purchase_size, 140 cl de gin vaudraient 1 400 € au
       lieu de 20 €. C'est l'erreur de facteur 100 qui ne se voit pas. */
    const p = gin([
      { price: 10, qty: 6, date: '2026-01-01' },
      { price: 10, qty: 6, date: '2026-02-01' },
    ]);
    assert.equal(c.currentPrice(p), 10, 'la bouteille vaut 10 €');
    assert.equal(c.valueForQty(p, 70), 10, '70 cl = une bouteille');
    assert.equal(c.valueForQty(p, 140), 20, '140 cl = deux bouteilles');
    assert.equal(c.valueForQty(p, 35), 5, 'une demi-bouteille');
  });

  test('sans format d’achat, le prix s’applique tel quel', () => {
    const colis = { id: 'p2', name: 'Colis', suppliers: [{ id: 'f1', history: [
      { price: 4, qty: 2, date: '2026-01-01' }, { price: 4, qty: 2, date: '2026-02-01' }] }] };
    assert.equal(c.valueForQty(colis, 3), 12);
  });

  test('un produit sans prix ne vaut pas zéro euro par erreur', () => {
    // valueForQty rend 0 faute de mieux ; ce qui compte est que currentPrice
    // dise clairement qu'il n'y a pas de prix, pour que l'écran le signale.
    const sansPrix = { id: 'p3', name: 'Inconnu', suppliers: [] };
    assert.equal(c.currentPrice(sansPrix), null);
    assert.equal(c.valueForQty(sansPrix, 10), 0);
  });

  test('les arrondis ne dérivent pas', () => {
    assert.equal(c.round3(0.1 + 0.2), 0.3);
    assert.equal(c.round3(1.23456), 1.235);
    assert.equal(c.round3(null), null);
  });
});

describe('Marge et food cost d’une fiche', () => {
  /* Une fiche vendue 10 € TTC à 20 % de TVA : 8,33 € HT. Avec 2 € de matière,
     la marge est de 6,33 € et le food cost de 24 %. */
  const fiche = {
    id: 'r1', name: 'Cocktail', pv_ttc: 10, tva_rate: 0.2,
    ingredients: [{ pr_base: 2, weight_coeff: 1 }],
  };

  test('la marge se calcule sur le prix hors taxe, jamais sur le TTC', () => {
    const t = c.recipeTotals(fiche);
    assert.ok(Math.abs(t.pv_ht - 10 / 1.2) < 1e-9);
    assert.ok(Math.abs(t.marge - (10 / 1.2 - 2)) < 1e-9);
    assert.ok(t.marge < 8, 'une marge calculée sur le TTC donnerait 8 €');
  });

  test('le food cost est la matière rapportée au HT', () => {
    const t = c.recipeTotals(fiche);
    assert.ok(Math.abs(t.foodPct - (2 / (10 / 1.2)) * 100) < 1e-9);
    assert.ok(Math.abs(t.foodPct - 24) < 0.01);
  });

  test('sans prix de vente, il n’y a pas de marge — et surtout pas zéro', () => {
    /* Zéro se lirait « cette fiche ne rapporte rien ». La vérité est qu'on ne
       sait pas : le prix de vente n'a pas été saisi. */
    const t = c.recipeTotals({ ...fiche, pv_ttc: 0 });
    assert.equal(t.marge, null);
    assert.equal(t.foodPct, null);
    assert.equal(t.coeff, null);
    assert.equal(t.prp, 2, 'le coût matière, lui, reste connu');
  });

  test('le coefficient de perte alourdit le coût, pas le prix de revient brut', () => {
    // 20 % de pertes au parage : 100 g achetés pour 80 g servis.
    const avecPerte = { ...fiche, ingredients: [{ pr_base: 2, weight_coeff: 1.25 }] };
    const t = c.recipeTotals(avecPerte);
    assert.equal(t.pr, 2, 'prix de revient brut inchangé');
    assert.equal(t.prp, 2.5, 'prix de revient pondéré majoré');
    assert.ok(t.marge < c.recipeTotals(fiche).marge, 'la perte mange la marge');
  });

  test('une préparation en lot se divise par son rendement', () => {
    /* Une fiche de sirop faite pour 4 bouteilles : les ingrédients sont saisis
       pour le lot entier, le coût d'une bouteille en est le quart. Sans la
       division, chaque cocktail porterait le coût de tout le lot. */
    const lot = { ...fiche, batch_yield: 4, ingredients: [{ pr_base: 8, weight_coeff: 1 }] };
    const t = c.recipeTotals(lot);
    assert.equal(t.pr, 2);
    assert.equal(t.prp, 2);
  });

  test('un rendement nul ou absent ne divise pas par zéro', () => {
    for (const rendement of [0, null, undefined]) {
      const t = c.recipeTotals({ ...fiche, batch_yield: rendement });
      assert.ok(Number.isFinite(t.prp), `batch_yield = ${rendement}`);
      assert.equal(t.prp, 2);
    }
  });

  test('un prix de vente forcé l’emporte sur celui de la fiche', () => {
    // C'est ce qui fait marcher la simulation de prix et le happy hour.
    const t = c.recipeTotals(fiche, 6);
    assert.equal(t.pv_ttc, 6);
    assert.ok(Math.abs(t.pv_ht - 5) < 1e-9);
  });
});
