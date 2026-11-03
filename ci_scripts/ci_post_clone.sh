#!/bin/sh
# =============================================================================
# Xcode Cloud — préparation de l'enveloppe iOS avant le build.
# Exécuté par Xcode Cloud juste après le clone du dépôt.
#
# RestoStock n'est pas un projet Capacitor ordinaire : le code de
# l'application vit dans source/ et se construit en app/app/ (versionné),
# l'enveloppe iOS n'étant qu'un dossier mobile/ qui l'empaquette. Ce script
# refait donc le chemin app/app → mobile/www → ios/App/App/public, qu'on ne
# versionne pas puisqu'il est entièrement dérivé.
# =============================================================================
set -e

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "→ Node : $(command -v node || echo 'absent, installation via Homebrew')"
if ! command -v node >/dev/null 2>&1; then
  brew install node
fi

echo "→ L'application web est-elle présente ?"
test -f app/app/index.html || {
  echo "app/app/index.html manquant : le build web n'a pas été commité." >&2
  exit 1
}

cd mobile

echo "→ Dépendances (npm ci)"
npm ci

echo "→ Copie de l'application dans l'enveloppe (www, puis public)"
node scripts/sync-www.mjs
npx cap copy ios

echo "✓ Préparation terminée — Xcode Cloud peut builder."
