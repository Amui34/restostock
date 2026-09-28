#!/usr/bin/env python3
"""
Régénère les captures d'écran du guide de l'équipe.

Chrome headless part d'un profil vierge : il tomberait donc sur l'écran de
premier lancement à chaque fois. On construit donc une version temporaire dont
les données de départ portent déjà un nom d'établissement et le thème clair,
on photographie les écrans, puis on restaure les données d'origine.

Usage :
    python3 source/captures.py            # toutes les captures
    python3 source/captures.py reception  # une seule
"""
import json
import pathlib
import random
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = pathlib.Path(__file__).parent.parent
DB = ROOT / "data" / "db_seed_all.json"
IMAGES = ROOT / "docs" / "images"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 8790

# nom de fichier -> (adresse de l'écran, hauteur de la fenêtre)
SHOTS = {
    "01-tableau-de-bord":   ("dashboard", 1000),
    "02-fiches-cocktails":  ("recipes-bar", 1000),
    "03-fiche-detail":      ("recipe-detail/r20", 1250),
    "04-produits-et-prix":  ("products", 1000),
    "05-fiche-produit":     ("product-detail/p21", 1150),
    "06-niveaux-de-stock":  ("stock", 1000),
    "07-inventaires":       ("inventory-list", 700),
    "08-inventaire-detail": ("inventory-detail/inv_import_bar", 1000),
    "09-fournisseurs":      ("suppliers", 900),
    "10-marges":            ("margins", 1000),
    "11-reglages":          ("settings", 1250),
    "12-reception-du-jour": ("reception", 1000),
    "13-ventes-du-service": ("sales", 1000),
    "14-a-verifier":        ("review", 1150),
}
WIDTH = 1400


def build(preset_name):
    """Construit la version hors-ligne, avec ou sans établissement pré-rempli."""
    original = DB.read_text(encoding="utf-8")
    try:
        if preset_name:
            data = json.loads(original)
            data["settings"]["establishment_name"] = preset_name
            data["settings"]["theme"] = "light"
            DB.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        subprocess.run([sys.executable, str(ROOT / "source" / "build.py"), "offline"],
                       check=True, capture_output=True)
        return (ROOT / "app" / "livre-de-prix-hors-ligne.html").read_text(encoding="utf-8")
    finally:
        DB.write_text(original, encoding="utf-8")


def shoot(serve_dir, page, name, view, height):
    """Chrome headless écrit bien le PNG mais ne rend pas toujours la main : on le
    tue au bout du délai et on juge sur le fichier produit, pas sur le code de
    sortie. Sans ça, un seul blocage interrompt toute la série."""
    out = IMAGES / (name + ".png")
    before = out.stat().st_mtime if out.exists() else 0
    profile = tempfile.mkdtemp()
    proc = None
    try:
        proc = subprocess.Popen([
            CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--no-first-run", "--no-default-browser-check",
            f"--user-data-dir={profile}",
            f"--screenshot={out}",
            f"--window-size={WIDTH},{height}",
            "--virtual-time-budget=6000",
            f"http://localhost:{PORT}/{page}?n={random.randint(1,10**6)}#{view}",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            proc.wait(timeout=45)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)
    finally:
        if proc and proc.poll() is None:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)
    ok = out.exists() and out.stat().st_mtime > before
    print(f"  {'✓' if ok else '✗'} {name}.png"
          + (f"  ({out.stat().st_size // 1024} Ko)" if ok else "  — non régénérée"))
    return ok


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    IMAGES.mkdir(parents=True, exist_ok=True)
    serve = pathlib.Path(tempfile.mkdtemp())

    # Deux versions : l'une déjà configurée pour les écrans, l'autre vierge pour
    # photographier justement l'écran de premier lancement.
    (serve / "app.html").write_text(build("Le Comptoir"), encoding="utf-8")
    (serve / "vierge.html").write_text(build(None), encoding="utf-8")

    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                              cwd=serve, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        if not only or only == "premier-lancement":
            shoot(serve, "vierge.html", "00-premier-lancement", "", 900)
        for name, (view, height) in SHOTS.items():
            if only and only not in name:
                continue
            shoot(serve, "app.html", name, view, height)
    finally:
        server.terminate()
        shutil.rmtree(serve, ignore_errors=True)
        # On reconstruit les livrables à partir des vraies données.
        subprocess.run([sys.executable, str(ROOT / "source" / "build.py")],
                       capture_output=True)
    print("\nLivrables reconstruits depuis les données réelles.")


if __name__ == "__main__":
    main()
