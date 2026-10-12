#!/bin/sh
# The published site: the page, its styles and its scripts as they are (no build). Run by `npm ci`
# (prepare) for the Cloudflare deployment, and by CI, which serves the folder under /ASCII-Meadow/
# to prove every path is relative.
# usage: sh tools/build_site.sh <out dir>
set -e
out=${1:?usage: sh tools/build_site.sh <out dir>}
mkdir -p "$out"
cp -r index.html styles src "$out"/
# Only optional authored NPC atlases need publishing; avoid copying the large concept/source sheets.
if [ -d assets/npc ]; then
  mkdir -p "$out/assets"
  cp -r assets/npc "$out/assets/"
fi
touch "$out/.nojekyll"
