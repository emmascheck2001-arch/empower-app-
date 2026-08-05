#!/bin/sh

# Xcode Cloud post-clone script.
# Em~power is a Capacitor app: the iOS project ships a web build inside it. Xcode Cloud only
# clones the repo, so before Xcode compiles we must (1) install Node, (2) build the web app,
# and (3) copy that build into the iOS project with `cap sync`. Without this, the cloud would
# ship an empty or stale app. This runs from empower-react/ios/App/ci_scripts/.

set -e

echo "▸ Installing Node…"
brew install node

echo "▸ Building the web app + syncing into iOS…"
cd "$CI_PRIMARY_REPOSITORY_PATH/empower-react"
npm ci
npm run build
npx cap sync ios

echo "▸ Post-clone complete."
