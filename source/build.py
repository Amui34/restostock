#!/usr/bin/env python3
"""
Assemble les fichiers livrables du Grimoire à prix.

Un seul fichier contient le code de l'application : core.html. Il ne connaît
rien à la façon dont les données sont stockées — il laisse des marqueurs
__NOM__ que le build remplace par les fragments de la cible choisie
(targets/<cible>/NOM.frag). C'est ce qui permet d'avoir une version en ligne
et une version hors-ligne sans jamais dupliquer les 2 900 lignes d'appli.

Usage :
    python3 build.py            # construit toutes les cibles
    python3 build.py offline    # construit une seule cible
    python3 build.py --check    # vérifie sans écrire (utilisé par les tests)
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent
CORE = HERE / "core.html"
TARGETS_DIR = HERE / "targets"
SEED = ROOT / "data" / "db_seed_all.json"
OUT_DIR = ROOT / "app"

# cible -> nom du fichier produit
TARGETS = {
    "online": "livre-de-prix.html",
    "offline": "livre-de-prix-hors-ligne.html",
    # La vitrine occupe la racine du site ; l'application vit sous /app/,
    # comme chez oplaa (vitrine + app séparées).
    "supabase": "app/index.html",
}

# Page publique, copiée telle quelle : pas de données ni de marqueurs à injecter.
LANDING_SRC = HERE / "landing.html"
LANDING_OUT = "index.html"

# Coordonnées du projet Supabase. Ces deux valeurs sont publiques par conception
# (elles sont destinées à figurer dans la page) ; la clé « service_role », elle,
# ne doit jamais approcher ce fichier.
SUPABASE_CONF = ROOT / "data" / "supabase.json"


def seed_json():
    """Données de démarrage, cherchées dans data/ puis à côté du build."""
    for candidate in (SEED, HERE / "db_seed_all.json"):
        if candidate.exists():
            return candidate.read_text(encoding="utf-8")
    raise SystemExit(f"Données de démarrage introuvables (cherché : {SEED})")


def assemble(target):
    core = CORE.read_text(encoding="utf-8")
    frag_dir = TARGETS_DIR / target
    if not frag_dir.is_dir():
        raise SystemExit(f"Cible inconnue : {target} (pas de dossier {frag_dir})")

    for frag in sorted(frag_dir.glob("*.frag")):
        marker = f"__{frag.stem}__"
        if marker not in core:
            raise SystemExit(f"{target}/{frag.name} : marqueur {marker} absent de core.html")
        # Un fragment vide doit faire disparaître sa ligne, pas laisser un blanc.
        content = frag.read_text(encoding="utf-8")
        core = core.replace(marker + "\n", content + "\n" if content else "")
        core = core.replace(marker, content)

    # Les données de départ n'ont de sens que pour les versions mono-poste.
    # En ligne, chaque établissement remplit son espace lui-même : embarquer le
    # catalogue d'un restaurant dans le fichier servi à tous serait à la fois
    # inutile, encombrant (534 Ko) et indiscret.
    core = core.replace("__SEED_JSON__", "{}" if target == "supabase" else seed_json())

    if target == "supabase":
        conf = {}
        if SUPABASE_CONF.exists():
            import json
            conf = json.loads(SUPABASE_CONF.read_text(encoding="utf-8"))
        url = conf.get("url", "")
        key = conf.get("anon_key", "")
        if not url or not key:
            print(f"  ⚠ {SUPABASE_CONF.name} absent ou incomplet : le fichier produit "
                  f"affichera « Application non configurée ». Renseignez url + anon_key.")
        core = core.replace("__SUPABASE_URL__", url).replace("__SUPABASE_ANON_KEY__", key)

    leftovers = [m for m in ("__PERSIST_JS__", "__BOOT__", "__HEAD__", "__SEED_JSON__") if m in core]
    if leftovers:
        raise SystemExit(f"{target} : marqueurs non remplacés {leftovers}")
    return core


def copy_landing(check_only):
    """La vitrine n'a pas besoin du moteur de build : on la recopie."""
    if not LANDING_SRC.exists():
        return
    html = LANDING_SRC.read_text(encoding="utf-8")
    # Les captures de la vitrine voyagent avec elle.
    img_src, img_out = HERE / "img", OUT_DIR / "img"
    if img_src.is_dir() and not check_only:
        img_out.mkdir(parents=True, exist_ok=True)
        for f in img_src.glob("*.png"):
            (img_out / f.name).write_bytes(f.read_bytes())
    out = OUT_DIR / LANDING_OUT
    if check_only:
        etat = "identique" if out.exists() and out.read_text(encoding="utf-8") == html else "DIFFÉRENT"
        print(f"{LANDING_OUT} : {etat} ({len(html)} caractères)")
    else:
        out.write_text(html, encoding="utf-8")
        print(f"{LANDING_OUT} généré ({len(html)} caractères) — vitrine")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    check_only = "--check" in sys.argv
    names = args or list(TARGETS)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in names:
        if name not in TARGETS:
            raise SystemExit(f"Cible inconnue : {name}. Choix : {', '.join(TARGETS)}")
        html = assemble(name)
        out = OUT_DIR / TARGETS[name]
        out.parent.mkdir(parents=True, exist_ok=True)
        if check_only:
            status = "identique" if out.exists() and out.read_text(encoding="utf-8") == html else "DIFFÉRENT"
            print(f"{out.name} : {status} ({len(html)} caractères)")
        else:
            out.write_text(html, encoding="utf-8")
            print(f"{TARGETS[name]} généré ({len(html)} caractères)")

    if not args or "supabase" in names:
        copy_landing(check_only)


if __name__ == "__main__":
    main()
