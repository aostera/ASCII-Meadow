#!/usr/bin/env node
// Install the exact map.js exported by the in-game editor. Never recreate it procedurally.
// Preview: node tools/map/import.cjs /path/to/map.js
// Install: node tools/map/import.cjs /path/to/map.js --apply
// CI:      node tools/map/import.cjs --check
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TARGET = path.resolve(__dirname, '../../src/data/map.js');
const CODES = { paint: '.gtserfpxwm', fog: '.cld' };
const REQUIRED = ['v', 'res', 'castle', 'start', 'fires', 'trail', 'cows', 'toads', 'events', 'flora', 'paint', 'fog'];
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function pair(p, name) {
  if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) throw new Error(name + ': expected [x, z] with finite numbers');
}
function maybeArray(a, name, check) {
  if (a === null) return;
  if (!Array.isArray(a)) throw new Error(name + ': expected array or null');
  a.forEach((item, i) => check(item, name + '[' + i + ']'));
}
function checkRleLayer(layer, name) {
  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) throw new Error(name + ': expected an object of RLE chunks');
  const codes = CODES[name];
  for (const [key, value] of Object.entries(layer)) {
    if (!/^-?\d+,-?\d+$/.test(key) || typeof value !== 'string') throw new Error(name + '[' + key + ']: invalid chunk');
    let p = 0, covered = 0;
    while (p < value.length) {
      if (!codes.includes(value[p++])) throw new Error(name + '[' + key + ']: unknown cell code');
      const start = p;
      while (p < value.length && value[p] >= '0' && value[p] <= '9') p++;
      const count = p === start ? 1 : Number(value.slice(start, p));
      if (!Number.isSafeInteger(count) || count < 1) throw new Error(name + '[' + key + ']: invalid run length');
      covered += count;
      if (covered > 1024) throw new Error(name + '[' + key + ']: exceeds 32x32 cells');
    }
    if (covered !== 1024) throw new Error(name + '[' + key + ']: has ' + covered + ' cells, expected 1024');
  }
}
function parseExport(raw) {
  // Only comments plus a single JSON literal assigned to MEADOW_MAP are accepted.
  // Do not evaluate untrusted JavaScript.
  const text = raw.toString('utf8');
  if (/<\/script/i.test(text)) throw new Error('file contains </script and cannot be safely bundled');
  const body = text.replace(/^(?:\s*\/\/[^\r\n]*(?:\r?\n|$))*/, '');
  const match = body.match(/^\s*const\s+MEADOW_MAP\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  if (!match) throw new Error('expected editor-exported map.js (one MEADOW_MAP assignment, no extra code)');
  let map;
  try { map = JSON.parse(match[1]); }
  catch (e) { throw new Error('map is not valid JSON: ' + e.message); }
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('map data must be an object');
  for (const key of REQUIRED) if (!Object.hasOwn(map, key)) throw new Error('missing field: ' + key);
  if (map.v !== 1 || map.res !== 4) throw new Error('unsupported map format v=' + map.v + ', res=' + map.res);
  if (map.castle !== null) pair(map.castle, 'castle');
  if (map.start !== null) pair(map.start, 'start');
  if (map.trail !== null && map.trail !== false) throw new Error('trail must be null or false');
  maybeArray(map.cows, 'cows', pair);
  maybeArray(map.fires, 'fires', (e, name) => {
    if (!Array.isArray(e) || e.length < 2 || e.length > 4) throw new Error(name + ': invalid fire');
    pair(e.slice(0, 2), name);
    if (e.length >= 3 && !Number.isFinite(e[2])) throw new Error(name + ': invalid height');
    if (e.length === 4 && e[3] !== 'cook') throw new Error(name + ': unknown fire kind');
  });
  maybeArray(map.toads, 'toads', (e, name) => {
    if (!Array.isArray(e) || (e.length !== 2 && e.length !== 3)) throw new Error(name + ': invalid toad');
    pair(e.slice(0, 2), name);
    if (e.length === 3 && e[2] !== 'frog') throw new Error(name + ': unknown toad kind');
  });
  maybeArray(map.events, 'events', (e, name) => {
    if (!Array.isArray(e) || e.length !== 3 || typeof e[0] !== 'string') throw new Error(name + ': invalid event');
    pair(e.slice(1), name);
  });
  maybeArray(map.flora, 'flora', (e, name) => {
    if (!Array.isArray(e) || e.length !== 4 || typeof e[0] !== 'string' || !Number.isInteger(e[1])) throw new Error(name + ': invalid flora');
    pair(e.slice(2), name);
  });
  checkRleLayer(map.paint, 'paint');
  checkRleLayer(map.fog, 'fog');
  return map;
}
function summary(m) {
  const count = k => m[k] === null ? 'generated (null)' : m[k].length;
  return 'start=' + JSON.stringify(m.start) + ', fires=' + count('fires') + ', cows=' + count('cows') +
    ', toads=' + count('toads') + ', events=' + count('events') + ', flora=' + count('flora') +
    ', paint chunks=' + Object.keys(m.paint).length + ', fog chunks=' + Object.keys(m.fog).length;
}
function main() {
  const args = process.argv.slice(2), apply = args.includes('--apply'), check = args.includes('--check');
  const inputs = args.filter(s => !s.startsWith('--'));
  if ((apply && check) || inputs.length > 1 || (!check && inputs.length !== 1) || (check && inputs.length) ||
      args.some(s => s.startsWith('--') && !['--apply', '--check'].includes(s))) {
    throw new Error('usage: node tools/map/import.cjs <exported-map.js> [--apply] OR --check');
  }
  const source = check ? TARGET : path.resolve(inputs[0]);
  const raw = fs.readFileSync(source), m = parseExport(raw), hash = digest(raw);
  console.log('source: ' + source + '\nSHA-256: ' + hash + '\n' + summary(m));
  if (check) { console.log('OK: installed map is valid'); return; }
  const before = fs.existsSync(TARGET) ? fs.readFileSync(TARGET) : null;
  const old = before ? parseExport(before) : null;
  if (old) console.log('currently installed: SHA-256 ' + digest(before) + '\n' + summary(old));
  if (before && digest(before) === hash) { console.log('Same file already installed. No changes.'); return; }
  if (!apply) { console.log('PREVIEW ONLY: to install the exact file, add --apply'); return; }
  if (source === TARGET) throw new Error('source is already the installed map');
  // Preserve exact bytes. Do not call compose.cjs or JSON.stringify() on the supplied file.
  const tmp = TARGET + '.import-' + process.pid;
  try { fs.writeFileSync(tmp, raw); fs.renameSync(tmp, TARGET); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  if (digest(fs.readFileSync(TARGET)) !== hash) throw new Error('installed map differs from exported file');
  console.log('INSTALLED: ' + TARGET + '\nVerified SHA-256: ' + hash);
}
if (require.main === module) {
  try { main(); } catch (e) { console.error('Map import failed: ' + e.message); process.exitCode = 1; }
}
module.exports = { parseExport, summary, digest };
