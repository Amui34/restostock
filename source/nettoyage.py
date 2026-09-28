#!/usr/bin/env python3
"""
Nettoyage des données importées des tableurs Numbers.

Ne fait QUE les corrections mécaniquement sûres — celles dont on peut prouver
qu'elles ne changent aucun coût de fiche. Tout ce qui demande un arbitrage du
restaurant (fusionner deux produits, trancher une ligne de récapitulatif,
renseigner un rendement de lot) est laissé à l'écran « À vérifier » de
l'application.

Le script vérifie lui-même son innocuité : il recalcule le prix de revient des
86 fiches avant et après, et refuse d'écrire si un seul a bougé.

Usage :
    python3 source/nettoyage.py            # aperçu, n'écrit rien
    python3 source/nettoyage.py --appliquer
"""
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).parent.parent
DB = ROOT / "data" / "db_seed_all.json"

UNIT_PIECE_WORDS = [
    "piece", "pieces", "pces", "pce", "unite", "unites", "botte", "bottes", "oeuf", "oeufs",
    "gousses", "barquette", "boite", "boites", "sac", "sacs", "bidon", "bidons", "tube",
    "tubes", "bocal", "bocaux", "sachet", "sachets", "bouteille", "bouteilles", "bt",
    "carton", "cartons", "colis",
]


def strip_accents(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def parse_unit(label):
    """Même logique que parseUnitLabel() côté application : « 70cl » → (cl, 70)."""
    if not label:
        return None
    txt = strip_accents(label).replace(",", ".")
    patterns = [
        (r"(\d+\.?\d*)\s*kg\b", lambda q: ("g", q * 1000)),
        (r"(\d+\.?\d*)\s*gr?\b", lambda q: ("g", q)),
        (r"(\d+\.?\d*)\s*cl\b", lambda q: ("cl", q)),
        (r"(\d+\.?\d*)\s*ml\b", lambda q: ("cl", q / 10)),
        (r"(\d+\.?\d*)\s*litres?\b", lambda q: ("cl", q * 100)),
        (r"(\d+\.?\d*)\s*l\b", lambda q: ("cl", q * 100)),
    ]
    best, best_pos = None, None
    for pat, fn in patterns:
        m = re.search(pat, txt)
        if m and (best_pos is None or m.start() < best_pos):
            q = float(m.group(1))
            if q > 0:
                unit, size = fn(q)
                if size > 0:
                    best, best_pos = (unit, round(size, 4)), m.start()
    if best:
        return best
    if any(w in txt for w in UNIT_PIECE_WORDS):
        return ("unite", 1)
    return None


def current_price(p):
    sup = next((s for s in p.get("suppliers", []) if s["id"] == p.get("primary_supplier_id")), None)
    if sup is None:
        sup = (p.get("suppliers") or [None])[0]
    if not sup or not sup.get("history"):
        return None
    return sup["history"][-1].get("price")


def recipe_costs(db):
    """Prix de revient de chaque fiche, avec la même formule que l'application."""
    products = {p["id"]: p for p in db["products"]}
    out = {}
    for r in db["recipes"]:
        pr = 0.0
        for ing in r.get("ingredients", []):
            base = ing.get("pr_base") or 0
            p = products.get(ing.get("product_id"))
            cp = current_price(p) if p else None
            if p and cp is not None and ing.get("price_base"):
                base = base * (cp / ing["price_base"])
            pr += base
        out[r["id"]] = round(pr, 6)
    return out


def clean(db):
    """Applique les corrections sûres. Retourne la liste de ce qui a changé."""
    changes = []

    # --- 1a. Format d'achat déduit du NOM quand le champ dédié est vide ---
    # L'import ne lisait que `unit_label` ; or le format figure souvent dans le nom
    # (« Guiness 50cl », « fut karmeliet 30L »). Sans lui, aucun prix au litre,
    # et surtout aucune déduction de stock à la vente.
    for p in db["products"]:
        if p.get("base_unit"):
            continue
        parsed = parse_unit(p.get("name"))
        if not parsed:
            continue
        if (p.get("stock_qty") or 0) != 0:
            # Le stock serait relu dans une nouvelle unité : on ne touche pas.
            continue
        p["base_unit"], p["purchase_size"] = parsed
        p["unit_needs_review"] = False
        p["stock_unit"] = {"g": "g", "cl": "cl", "unite": "unité"}[parsed[0]]
        changes.append(("unité", p["name"], f"{parsed[1]} {parsed[0]}"))

    # --- 1b. Fournisseurs en double à la casse près ---
    # « aristide » et « Aristide » comptaient comme deux fournisseurs distincts,
    # ce qui éclatait l'historique de prix et faussait la comparaison.
    spellings = {}
    for p in db["products"]:
        for s in p.get("suppliers", []):
            spellings.setdefault(strip_accents(s["name"]).strip(), []).append(s["name"])
    canonical = {}
    for key, names in spellings.items():
        if len(set(names)) > 1:
            # On retient l'orthographe la plus fréquente, proprement capitalisée.
            best = max(set(names), key=names.count)
            canonical[key] = best[:1].upper() + best[1:]
    for p in db["products"]:
        for s in p.get("suppliers", []):
            key = strip_accents(s["name"]).strip()
            if key in canonical and s["name"] != canonical[key]:
                changes.append(("fournisseur", p["name"], f"{s['name']} → {canonical[key]}"))
                s["name"] = canonical[key]

    # --- 1d. Garnitures sans format ni prix ---
    # Paille, glace pilée, zeste : ce sont des unités, pas des volumes. Sans prix,
    # elles ne participent à aucun calcul ; leur donner une unité rend seulement
    # leur stock et leurs inventaires lisibles.
    for p in db["products"]:
        if p.get("base_unit"):
            continue
        has_price = any(s.get("history") for s in p.get("suppliers", []))
        if has_price or (p.get("stock_qty") or 0) != 0:
            continue
        p["base_unit"], p["purchase_size"] = "unite", 1
        p["unit_needs_review"] = False
        p["stock_unit"] = "unité"
        changes.append(("garniture", p["name"], "1 unité"))

    return changes


def main():
    apply = "--appliquer" in sys.argv
    db = json.loads(DB.read_text(encoding="utf-8"))
    before = recipe_costs(db)

    changes = clean(db)
    after = recipe_costs(db)

    moved = {k: (before[k], after[k]) for k in before if abs(before[k] - after[k]) > 1e-6}

    by_kind = {}
    for kind, name, detail in changes:
        by_kind.setdefault(kind, []).append((name, detail))
    for kind, items in by_kind.items():
        print(f"\n{kind.upper()} — {len(items)} correction(s)")
        for name, detail in items[:8]:
            print(f"   {detail:>16}  ←  {name[:52]}")
        if len(items) > 8:
            print(f"   … et {len(items)-8} autres")

    print(f"\nContrôle d'innocuité : {len(before)} fiches recalculées.")
    if moved:
        print(f"✗ REFUS D'ÉCRIRE — {len(moved)} fiche(s) ont changé de coût :")
        for rid, (b, a) in list(moved.items())[:10]:
            print(f"    {rid} : {b} → {a}")
        raise SystemExit(1)
    print("✓ aucun coût de fiche modifié.")

    if apply:
        db.setdefault("meta", {})["cleaned_at"] = "2026-09-09"
        DB.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\n✓ {len(changes)} corrections écrites dans {DB.relative_to(ROOT)}")
    else:
        print(f"\n(aperçu — {len(changes)} corrections prêtes. Relancer avec --appliquer)")


if __name__ == "__main__":
    main()
