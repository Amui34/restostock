#!/usr/bin/env bash
# Archive RestoStock signé pour l'App Store, exporte l'.ipa et l'envoie à
# App Store Connect — il apparaît ensuite dans TestFlight.
#
# Tout passe par la CLÉ API App Store Connect : ni compte Xcode, ni Xcode
# Cloud, ni certificat à installer. xcodebuild crée ce qu'il lui faut avec
# -allowProvisioningUpdates, et altool envoie avec la même clé.
#
#   usage : bash mobile/scripts/ios-ship.sh
set -uo pipefail

RACINE="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$RACINE/mobile"
IOS="$MOBILE/ios/App"
OUT="$MOBILE/build/release"
KEY=FJ7JL8VV39
ISSUER=fd850757-5b61-43a4-8f6e-99059e4a50f4
P8="$HOME/.appstoreconnect/private_keys/AuthKey_$KEY.p8"
AUTH=(-allowProvisioningUpdates -authenticationKeyID "$KEY" -authenticationKeyIssuerID "$ISSUER" -authenticationKeyPath "$P8")

[ -f "$P8" ] || { echo "Clé API absente : $P8"; exit 1; }

mkdir -p "$OUT" && rm -rf "$OUT/RestoStock.xcarchive" "$OUT/out"
cat > "$OUT/exportOptions.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>772LDD7BCT</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>destination</key><string>export</string>
</dict>
</plist>
PLIST

echo "== préparation du contenu web"
cd "$MOBILE"
node scripts/sync-www.mjs || exit 1
npx cap copy ios > /dev/null || exit 1

# Une coquille sans contenu web se lance sur un écran blanc : on refuse d'envoyer.
cd "$IOS"
echo "== archive"
xcodebuild -scheme App -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUT/RestoStock.xcarchive" archive "${AUTH[@]}" > "$OUT/archive.log" 2>&1 \
  || { grep -E "error:|FAILED" "$OUT/archive.log" | head -5; echo "ARCHIVE ÉCHOUÉE"; exit 1; }

[ -f "$OUT/RestoStock.xcarchive/Products/Applications/App.app/public/index.html" ] \
  || { echo "L'application web manque dans l'archive — elle s'ouvrirait sur un écran blanc."; exit 1; }

echo "== export"
xcodebuild -exportArchive -archivePath "$OUT/RestoStock.xcarchive" -exportOptionsPlist "$OUT/exportOptions.plist" \
  -exportPath "$OUT/out" "${AUTH[@]}" > "$OUT/export.log" 2>&1 \
  || { grep -E "error|FAILED" "$OUT/export.log" | head -5; echo "EXPORT ÉCHOUÉ"; exit 1; }

# Le fichier porte le nom d'affichage de l'app, pas celui de la cible Xcode :
# on le cherche plutot que de le supposer.
IPA="$(ls "$OUT/out/"*.ipa 2>/dev/null | head -1)"
[ -n "$IPA" ] || { echo "Aucun .ipa produit par l'export."; exit 1; }

echo "== envoi de $(basename "$IPA")"
xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$KEY" --apiIssuer "$ISSUER" 2>&1 | tail -6
