#!/bin/sh
# The published site: the page, its styles and its scripts as they are (no build). Used by the Pages
# deployment and by CI, which serves the same folder under /ASCII-Meadow/ like GitHub Pages does.
# usage: sh tools/build_site.sh <out dir>
set -e
out=${1:?usage: sh tools/build_site.sh <out dir>}
mkdir -p "$out"
cp -r index.html styles src "$out"/
touch "$out/.nojekyll"
