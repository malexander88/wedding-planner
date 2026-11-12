#!/bin/bash
# Builds the Android APK from the current web build.
#   android/build-apk.sh            → release APK (signed if android/keystore.properties exists)
# Needs: JDK 17, Android SDK (local.properties), Gradle 8.7. Run `npm run build` with the same flags as the
# GitHub Pages deploy first (VITE_PLACES_ENABLED=true GITHUB_PAGES=true), so the base path is /wedding-planner/.
set -euo pipefail
cd "$(dirname "$0")"
export JAVA_HOME=${JAVA_HOME:-/workspace/jdk17}
export PATH=$JAVA_HOME/bin:$PATH
GRADLE=${GRADLE:-/workspace/gradle-8.7/bin/gradle}
test -f ../dist/index.html || { echo "no ../dist — run the web build first"; exit 1; }
grep -q '/wedding-planner/assets/' ../dist/index.html || { echo "dist was not built with GITHUB_PAGES=true"; exit 1; }
rm -rf app/src/main/assets && mkdir -p app/src/main/assets/www
cp -a ../dist/. app/src/main/assets/www/
# Not needed inside the app: the service worker, iPhone splash screens and the Pages 404 redirect.
rm -rf app/src/main/assets/www/sw.js app/src/main/assets/www/workbox-*.js app/src/main/assets/www/splash app/src/main/assets/www/404.html
cp bridge.js app/src/main/assets/bridge.js
"$GRADLE" -q assembleRelease
ls -la app/build/outputs/apk/release/
