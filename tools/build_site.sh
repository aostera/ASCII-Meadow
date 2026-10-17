#!/bin/sh
# Build a versioned Cloudflare static site. The source HTML remains unchanged,
# while every release requests its own JS/CSS URLs so a browser cannot reuse
# an obsolete map or grass renderer across deployments.
set -eu
out=${1:?usage: sh tools/build_site.sh dist}
# Fail closed: never clean arbitrary paths, follow symlinks or publish unapproved sources.
case "$out" in
  dist|/tmp/site/ASCII-Meadow) ;;
  /tmp/ascii-meadow-assets-*)
    suffix=${out#/tmp/ascii-meadow-assets-}
    case "$suffix" in ''|*[!a-zA-Z0-9_-]*) echo 'Security: unsafe temporary output path' >&2; exit 1 ;; esac
    ;;
  *) echo 'Security: unexpected deployment output path' >&2; exit 1 ;;
esac
if [ -L "$out" ]; then
  echo 'Security: deployment output cannot be a symlink' >&2
  exit 1
fi
node tools/check/deploy-surface.cjs --source
if [ "$out" = "dist" ]; then
  rm -rf -- "$out"
elif [ -d "$out" ] && [ -n "$(ls -A "$out")" ]; then
  echo 'Security: refusing to overwrite a non-empty temporary output directory' >&2
  exit 1
fi
mkdir -p "$out"
cp -r index.html styles src "$out"/
if [ -d assets/npc ]; then
  mkdir -p "$out/assets"
  cp -r assets/npc "$out/assets/"
fi

# Preview branches contain a full playable native Three.js game. Publish
# ONLY its runtime modules and native.html, never markdown, concepts, keys,
# GLB drafts or unrelated experiments.
if [ -f experiments/three/native.html ]; then
  mkdir -p "$out/experiments/three"
  cp experiments/three/native.html "$out/experiments/three/"
  for file in experiments/three/*.js experiments/three/*.mjs experiments/three/*.css; do
    [ -f "$file" ] || continue
    cp "$file" "$out/experiments/three/"
  done
fi

# The checkout commit is the single source of truth for the release revision.
rev=$(git rev-parse --verify --short=12 HEAD 2>/dev/null || printf 'local')
node - "$out/index.html" "$rev" <<'NODE'
const fs = require('node:fs');
const [file, rev] = process.argv.slice(2);
const html = fs.readFileSync(file, 'utf8');
let scripts = 0;
const versioned = html
  .replace(/(<script\s+src="src\/[^"?]+\.js)(")/g, (_, a, b) => {
    scripts++; return a + '?v=' + rev + b;
  })
  .replace(/(href="styles\/[^"?]+\.css)(")/g, (_, a, b) => a + '?v=' + rev + b);
if (scripts < 20 || !versioned.includes('styles/main.css?v=')) {
  throw new Error('Release asset versioning failed: original HTML structure changed');
}
fs.writeFileSync(file, versioned);
NODE

printf '{"revision":"%s"}\n' "$rev" > "$out/build.json"
cat > "$out/_headers" <<'HEADERS'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; media-src 'self'; worker-src 'self'
/
  Cache-Control: no-store
/index.html
  Cache-Control: no-store
/build.json
  Cache-Control: no-store
/src/*
  Cache-Control: no-store
/styles/*
  Cache-Control: no-store
HEADERS
# Scoped CSP for the standalone Three.js game. Importmaps require an inline
# hash but NEVER global unsafe-inline. Production game's default CSP stays
# self-only. The single approved external runtime dependency is pinned Three.
if [ -f "$out/experiments/three/native.html" ]; then
  map_hash=$(node - <<'NODE'
const fs=require('node:fs'),crypto=require('node:crypto');
const html=fs.readFileSync('experiments/three/native.html','utf8');
const m=html.match(/<script type="importmap">([\\s\\S]*?)<\\/script>/);
if(!m)throw Error('Missing approved Three.js import map');
process.stdout.write(crypto.createHash('sha256').update(m[1]).digest('base64'));
NODE
)
  cat >> "$out/_headers" <<HEADERS
/experiments/three/*
  Cache-Control: no-store
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self' https://cdn.jsdelivr.net 'sha256-$map_hash'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net; media-src 'self'; worker-src 'self'
HEADERS
fi
touch "$out/.nojekyll"
node tools/check/deploy-surface.cjs --dist "$out"
