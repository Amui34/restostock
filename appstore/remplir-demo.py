#!/usr/bin/env python3
"""Remplit le compte de démonstration que la revue d'Apple utilisera.

Apple refuse une application à connexion sans identifiants de test : le
testeur verrait l'écran de connexion et s'arrêterait là. Ce compte doit donc
contenir un établissement déjà rempli, pour que toutes les fonctions soient
accessibles du premier coup.

Le script refait exactement ce que fait le bouton « Importer une sauvegarde »
de l'application : il découpe l'état en lignes, et sépare les prix dans des
lignes à part — c'est cette séparation qui permet à la base de les refuser à
un équipier. Reproduire la même structure évite un compte de démonstration
qui se comporterait autrement que les vrais.

Les identifiants vivent dans ~/.restostock-demo, jamais dans le dépôt :
celui-ci est public.

    usage : python3 appstore/remplir-demo.py
"""
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
CONF = json.loads((RACINE / "data" / "supabase.json").read_text(encoding="utf-8"))
URL = CONF["url"].rstrip("/")
CLE = CONF.get("anon_key") or CONF.get("key")

fiche = pathlib.Path.home() / ".restostock-demo"
if not fiche.exists():
    sys.exit("~/.restostock-demo absent : le compte n'a pas été créé.")
texte = fiche.read_text(encoding="utf-8")
EMAIL = re.search(r"adresse\s*:\s*(\S+)", texte).group(1)
MDP = re.search(r"mot de passe\s*:\s*(\S+)", texte).group(1)


def appel(chemin, corps=None, jeton=None, methode=None):
    entetes = {"apikey": CLE, "Content-Type": "application/json"}
    if jeton:
        entetes["Authorization"] = "Bearer " + jeton
    req = urllib.request.Request(
        URL + chemin,
        data=json.dumps(corps).encode() if corps is not None else None,
        headers=entetes,
        method=methode or ("POST" if corps is not None else "GET"),
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            brut = r.read().decode()
            return json.loads(brut) if brut.strip() else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{chemin} → {e.code} {e.read().decode()[:300]}")


# ---- Connexion -------------------------------------------------------------
session = appel("/auth/v1/token?grant_type=password", {"email": EMAIL, "password": MDP})
jeton = session.get("access_token")
if not jeton:
    sys.exit("Connexion refusée — l'adresse n'a probablement pas encore été confirmée.")
print(f"  connecté : {EMAIL}")

# ---- L'établissement -------------------------------------------------------
deja = appel("/rest/v1/rpc/my_companies", {}, jeton)
if deja:
    cid = deja[0]["company_id"]
    print(f"  établissement déjà présent : {deja[0]['company_name']}")
else:
    cid = appel("/rest/v1/rpc/create_company",
                {"company_name": "Restaurant de démonstration", "who": "Compte de démonstration"},
                jeton)
    print(f"  établissement créé : {cid}")

# ---- Les données -----------------------------------------------------------
etat = json.loads((RACINE / "data" / "sauvegarde-bivouak.json").read_text(encoding="utf-8"))

lignes = []
def poser(ident, genre, donnees, ordre=0):
    lignes.append({"company_id": cid, "id": ident, "kind": genre, "data": donnees, "ord": ordre})

poser("meta/main", "meta", etat.get("meta") or {})
poser("settings/main", "settings", etat.get("settings") or {})
for i, p in enumerate(etat.get("products") or []):
    sans_prix = {k: v for k, v in p.items() if k not in ("suppliers", "primary_supplier_id")}
    poser(f"product/{p['id']}", "product", sans_prix, i)
    # Les prix vivent à part : c'est ce qui permet de les refuser à un équipier.
    poser(f"price/{p['id']}", "price",
          {"suppliers": p.get("suppliers") or [], "primary_supplier_id": p.get("primary_supplier_id")}, i)
for i, r in enumerate(etat.get("recipes") or []):
    poser(f"recipe/{r['id']}", "recipe", r, i)
for i, v in enumerate(etat.get("inventories") or []):
    poser(f"inventory/{v['id']}", "inventory", v, i)
for i, s in enumerate(etat.get("salesLog") or []):
    poser(f"sale/{s['id']}", "sale", s, i)

# Par paquets : une requête de 1000 lignes dépasse la taille acceptée.
TAILLE = 150
for i in range(0, len(lignes), TAILLE):
    appel("/rest/v1/documents?on_conflict=company_id,id", lignes[i:i + TAILLE], jeton)
    print(f"    {min(i + TAILLE, len(lignes))} / {len(lignes)} lignes", end="\r")

print(f"\n  {len(lignes)} lignes installées")
print(f"    produits    {len(etat.get('products') or [])}")
print(f"    fiches      {len(etat.get('recipes') or [])}")
print(f"    inventaires {len(etat.get('inventories') or [])}")
