#!/bin/bash
set -e
cd KnittingPatternMaker
npx expo export --platform web
mkdir -p ../dist
cp -r dist/* ../dist/
