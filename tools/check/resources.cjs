// Static checks of the page and its files (no browser):
//  - every <script src> and <link href> of index.html that points into the repository exists;
//  - every file under src/ is loaded by index.html, exactly once, and data files only from src/data/;
//  - index.html holds no inline script or style (the code lives in src/, the styles in styles/);
//  - paths are relative (so the site works from a sub-folder such as /ASCII-Meadow/ on GitHub Pages);
//  - styles/main.css has no url() pointing at a missing file.
// usage: node tools/check/resources.cjs [repo dir]
const fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const errors = [], ok = m => console.log('ok   ' + m), fail = m => { errors.push(m); console.log('FAIL ' + m); };

const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const srcs = scripts.map(m => (m[1].match(/\bsrc="([^"]+)"/) || [])[1]);
scripts.forEach((m, i) => { if (!srcs[i]) fail('inline <script> in index.html: ' + m[2].trim().slice(0, 60)); else if (m[2].trim()) fail('<script src="' + srcs[i] + '"> has a body'); });
if (/<style\b/.test(page)) fail('inline <style> in index.html (styles belong in styles/main.css)');
const links = [...page.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g)].map(m => m[1]).filter(h => !/^https?:/.test(h));
for (const ref of [...srcs.filter(Boolean), ...links]) {
  if (/^(\/|https?:|file:)/.test(ref)) { fail('not a relative path: ' + ref); continue; }
  if (!fs.existsSync(path.join(root, ref))) fail('missing file: ' + ref); else ok('exists ' + ref);
}
const listed = srcs.filter(Boolean);
const dup = listed.filter((s, i) => listed.indexOf(s) !== i); if (dup.length) fail('loaded twice: ' + dup.join(', '));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(path.join(root, 'src')).filter(f => f.endsWith('.js')).map(f => path.relative(root, f).split(path.sep).join('/'));
for (const f of files) if (!listed.includes(f)) fail('src file not loaded by index.html: ' + f);
listed.forEach((s, i) => { if (s.startsWith('src/data/') && !listed.slice(i + 1).some(x => x.startsWith('src/entities/'))) fail('data file loaded after the entities that parse it: ' + s); });
if (listed[listed.length - 1] !== 'src/main.js') fail('src/main.js must be the last script (it starts the game)');
const css = path.join(root, 'styles/main.css');
if (fs.existsSync(css)) for (const m of fs.readFileSync(css, 'utf8').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
  if (/^(data:|https?:)/.test(m[1])) continue;
  if (!fs.existsSync(path.join(root, 'styles', m[1]))) fail('main.css url() missing: ' + m[1]);
}
console.log(`\n${listed.length} scripts, ${links.length} local stylesheets, ${files.length} files in src/: ${errors.length ? errors.length + ' problem(s)' : 'all good'}`);
process.exit(errors.length ? 1 : 0);
