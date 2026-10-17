#!/usr/bin/env node
// Prevent files or embedded credentials from reaching the public Cloudflare asset bundle.
// This gate intentionally uses only built-in Node modules (works during npm prepare).
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const mode = process.argv[2] ?? '--source';
const output = process.argv[3] ?? 'dist';
if (mode !== '--source' && mode !== '--dist') {
  console.error('Usage: node tools/check/deploy-surface.cjs [--source|--dist]');
  process.exit(2);
}
const root = path.resolve(__dirname, '../..');
const outputAbs = path.resolve(root, output);
if (mode === '--dist' && outputAbs !== path.join(root, 'dist') && outputAbs !== '/tmp/site/ASCII-Meadow' &&
    !/^\/tmp\/ascii-meadow-assets-[a-zA-Z0-9_-]+$/.test(outputAbs)) {
  console.error('BLOCKED DEPLOY: unexpected output directory');
  process.exit(2);
}
const assetExtensions = new Set(['.png', '.webp']);
const textExtensions = new Set(['.js', '.css', '.html', '.json', '.mjs']);
const blockers = [
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/i],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,})\b/],
  ['api-token', /\b(?:sk-proj-|sk-svcacct-|sk-admin-|sk-ant-)[A-Za-z0-9_-]{25,}\b|\bsk-[A-Za-z0-9]{32,}\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['google-api-key', /\bAIza[A-Za-z0-9_-]{35}\b/],
  ['stripe-live-key', /\b(?:sk_live_|rk_live_)[A-Za-z0-9]{20,}\b/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{30,}\b/],
  ['gitlab-token', /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{15,}\b/],
  ['telegram-token', /\b[0-9]{8,12}:AA[A-Za-z0-9_-]{30,}\b/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{10,}\b/],
  ['basic-auth-url', /https?:\/\/[^/\s:@]+:[^/\s@]{4,}@/i],
  ['authorization', /\bAuthorization\s*[:=]\s*['"]?Bearer\s+[A-Za-z0-9._~-]{20,}/i],
  ['url-credential', /[?&](?:access_token|api_key|secret|client_secret|auth_token)=[A-Za-z0-9_%-]{20,}/i],
];
const assignment = /(?:^|[^A-Za-z0-9_])(?:api[_-]?key|secret[_-]?key|secret[_-]?access[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|private[_-]?key|github[_-]?token|openai[_-]?api[_-]?key|database[_-]?url)\b['"]?\s*[:=]\s*['"]?([A-Za-z0-9_./+=:-]{12,})/gim;
const harmless = /^(?:example|placeholder|your|dummy|sample|replace|changeme|undefined|null|none|false|true|process\.|import\.|os\.|env\.|getenv|secrets\.|vars\.|testtoken|testpassword|redacted|https?:\/\/(?:localhost|example))/i;
const forbiddenFilename = /(^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.npmrc|\.pypirc|\.git|\.ssh|\.aws|\.wrangler|id_rsa|id_ed25519|[^/]*\.(?:pem|key|p12|pfx|tfstate)|(?:credentials?|service-account)[^/]*)$/i;
const findings = [];
let inspected = 0;

function report(type, rel) {
  // Avoid exposing sensitive paths in publicly readable Actions logs.
  findings.push({type, path: process.env.GITHUB_ACTIONS === 'true' ? '[redacted]' : rel});
}
function visit(rel, allowedExt, mayHaveChildren = true) {
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep) &&
      !(mode === '--dist' && (abs === outputAbs || abs.startsWith(outputAbs + path.sep)))) {
    report('path-escape', '[redacted]');
    return;
  }
  let stats;
  try { stats = fs.lstatSync(abs); }
  catch { report('missing-deployment-file', rel); return; }
  if (stats.isSymbolicLink()) { report('symlink', rel); return; }
  const name = path.basename(rel);
  if (forbiddenFilename.test(rel) || name.startsWith('.') && name !== '.nojekyll') {
    report('sensitive-or-hidden-path', rel);
    return;
  }
  if (stats.isDirectory()) {
    if (!mayHaveChildren) { report('directory-instead-of-file', rel); return; }
    for (const child of fs.readdirSync(abs)) visit(path.posix.join(rel, child), allowedExt);
    return;
  }
  if (!stats.isFile()) { report('nonregular-file', rel); return; }
  if (stats.size > 32 * 1024 * 1024) { report('oversized-deployment-file', rel); return; }
  if (!allowedExt.has(path.extname(name).toLowerCase())) {
    report('unexpected-file-type', rel); return;
  }
  if (!textExtensions.has(path.extname(name).toLowerCase())) return;
  const content = fs.readFileSync(abs, 'utf8');
  if (content.includes('\0')) { report('binary-in-text-file', rel); return; }
  inspected++;
  for (const [type, pattern] of blockers) {
    if (pattern.test(content)) report(type, rel);
  }
  assignment.lastIndex = 0;
  let m;
  while ((m = assignment.exec(content))) {
    const value = m[1].replace(/\.+$/, '');
    if (!harmless.test(value) && !/^[0-9]+$/.test(value) &&
        !( /^[a-z]+$/i.test(value) && new Set(value.toLowerCase()).size < 6 )) {
      report('potential-hardcoded-credential', rel);
      break;
    }
  }
}
if (mode === '--source') {
  visit('index.html', new Set(['.html']), false);
  visit('src', new Set(['.js']));
  visit('styles', new Set(['.css']));
  if (fs.existsSync(path.join(root, 'assets/npc')))
    visit('assets/npc', assetExtensions);
  const three=path.join(root,'experiments/three');
  if(fs.existsSync(path.join(three,'native.html'))){
    for(const name of fs.readdirSync(three)){
      if(name==='native.html'||/\\.(?:js|mjs|css)$/.test(name))
        visit('experiments/three/'+name,
          new Set(['.html','.js','.mjs','.css']),false);
    }
  }
} else {
  // The published directory must include only assets explicitly approved below.
  const dist = outputAbs;
  if (!fs.existsSync(dist) || fs.lstatSync(dist).isSymbolicLink()) {
    report('missing-or-symlink-dist', 'dist');
  } else {
    const allowed = new Set(['src', 'styles', 'assets', 'experiments', 'index.html', 'build.json', '_headers', '.nojekyll']);
    for (const filename of fs.readdirSync(dist)) {
      if (!allowed.has(filename)) report('unexpected-published-file', 'dist/' + filename);
    }
    visit(path.join(output, 'index.html'), new Set(['.html']), false);
    visit(path.join(output, 'build.json'), new Set(['.json']), false);
    visit(path.join(output, 'src'), new Set(['.js']));
    visit(path.join(output, 'styles'), new Set(['.css']));
    if (fs.existsSync(path.join(dist, 'assets'))) {
      const dirs = fs.readdirSync(path.join(dist, 'assets'));
      for (const d of dirs) if (d !== 'npc') report('unexpected-published-asset-dir', 'dist/assets/' + d);
      if (fs.existsSync(path.join(dist, 'assets/npc'))) visit(path.join(output, 'assets/npc'), assetExtensions);
    }
    if(fs.existsSync(path.join(dist,'experiments'))){
      for(const sub of fs.readdirSync(path.join(dist,'experiments')))
        if(sub!=='three')report('unapproved-experiment-directory','dist/experiments/'+sub);
      if(fs.existsSync(path.join(dist,'experiments/three'))){
        for(const name of fs.readdirSync(path.join(dist,'experiments/three'))){
          if(name!=='native.html'&&!/\\.(?:js|mjs|css)$/.test(name))
            report('unapproved-experiment-file','dist/experiments/three/'+name);
        }
        visit(path.join(output,'experiments/three'),
          new Set(['.html','.js','.mjs','.css']));
      }
    }
    // These are intentionally the only extensionless/hidden deployment metadata.
    for (const name of ['_headers', '.nojekyll']) {
      const f = path.join(dist, name);
      if (!fs.existsSync(f) || !fs.lstatSync(f).isFile()) report('unsafe-published-metadata', 'dist/' + name);
    }
  }
}
if (findings.length) {
  for (const f of findings.slice(0, 30)) {
    console.error('BLOCKED DEPLOY:', f.type, f.path);
  }
  console.error('Blocked', findings.length, 'possible leaks/unsafe files. No secret values were logged.');
  process.exit(1);
}
console.log('PASS deployment security:', mode, 'checked', inspected, 'text assets; no unsafe paths or recognizable embedded credentials.');
