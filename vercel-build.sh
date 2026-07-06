#!/bin/bash
set -e
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Working dir: $(pwd)"
cd KnittingPatternMaker
echo "Changed to: $(pwd)"
npm install
echo "Deps installed"
npx expo export --platform web
echo "Expo export done"
mkdir -p ../dist
cp -r dist/* ../dist/
echo "Build complete"
