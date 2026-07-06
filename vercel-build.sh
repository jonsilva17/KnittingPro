#!/bin/bash
set -e
cd KnittingPatternMaker
npm install 2>&1
npx expo export --platform web
mkdir -p ../dist
cp -r dist/* ../dist/
