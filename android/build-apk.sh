#!/bin/bash
# Builds the Android APK from the current web build.
#   android/build-apk.sh            → release APK (signed if android/keystore.properties exists)
# Needs: JDK 17, Android SDK (local.properties), Gradle 8.7, and the web app's node_modules.
# Builds the web app itself (same as the GitHub Pages build, base /wedding-planner/) into build/www, with the
# JavaScript/CSS syntax lowered to Chrome 74 so phones whose Android System WebView hasn't been updated still
# run it (bridge.js polyfills the few newer built-ins).
set -euo pipefail
cd "$(dirname "$0")"
export JAVA_HOME=${JAVA_HOME:-/workspace/jdk17}
export PATH=$JAVA_HOME/bin:$PATH
GRADLE=${GRADLE:-/workspace/gradle-8.7/bin/gradle}
(cd .. && GITHUB_PAGES=true npx vite build --logLevel warn --outDir android/build/www --emptyOutDir --target chrome74)
grep -q '/wedding-planner/assets/' build/www/index.html || { echo "web build has the wrong base path"; exit 1; }
rm -rf app/src/main/assets && mkdir -p app/src/main/assets/www
cp -a build/www/. app/src/main/assets/www/
# Not needed inside the app: the service worker, iPhone splash screens and the Pages 404 redirect.
rm -rf app/src/main/assets/www/sw.js app/src/main/assets/www/workbox-*.js app/src/main/assets/www/splash app/src/main/assets/www/404.html
cp bridge.js app/src/main/assets/bridge.js
"$GRADLE" -q assembleRelease
ls -la app/build/outputs/apk/release/
