// ESLint over the game as the browser sees it: the src/ scripts share one global scope, so they are linted
// concatenated in index.html's load order. That catches names used but defined nowhere (no-undef), names
// declared twice across files (no-redeclare, and the parser's own "already declared"), and duplicate keys.
// Findings are mapped back to file:line.   usage: node tools/check/lint.cjs [--warnings]
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...page.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
// data files are generated literals: lint only that they parse (node --check), not their content
const code = files.filter(f => !f.startsWith('src/data/'));
let text = '', map = [];   // map[i] = [line in the concatenation where file i starts, file]
for (const f of code) { map.push([text.split('\n').length, f]); text += fs.readFileSync(path.join(root, f), 'utf8') + '\n'; }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meadow-lint-'));
fs.writeFileSync(path.join(tmp, 'game.js'), text);
// browser globals the game reads, plus the data globals defined by src/data/ (excluded above)
const globals = ['window', 'document', 'location', 'localStorage', 'Blob', 'URL', 'confirm', 'prompt', 'fetch', 'addEventListener', 'matchMedia', 'devicePixelRatio', 'innerWidth', 'innerHeight', 'requestAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'console', 'Promise'];
fs.writeFileSync(path.join(tmp, 'eslint.config.mjs'), `export default [{ files: ['**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script',
  globals: { ${globals.map(g => `${g}: 'readonly'`).join(', ')}, KNIGHT_ART: 'writable', KSW: 'readonly', COW_ART: 'writable', MEADOW_MAP: 'readonly', RUIN_SITES: 'readonly' } },
  rules: { 'no-undef': 'error', 'no-redeclare': 'error', 'no-dupe-keys': 'error', 'no-unused-vars': ['warn', { vars: 'all', args: 'none' }] } }];\n`);
// eslint's package exports hide bin/, so find the file: the repo's node_modules (npm ci), else a global install
const bin = [path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js'), '/opt/node-tools/node_modules/eslint/bin/eslint.js'].find(f => fs.existsSync(f));
if (!bin) { console.error('eslint not found: run npm ci'); process.exit(2); }
let report;
try { report = execFileSync(process.execPath, [bin, '-f', 'json', '-c', 'eslint.config.mjs', 'game.js'], { cwd: tmp, encoding: 'utf8' }); }
catch (e) { report = e.stdout; if (!report) { console.error(e.message); process.exit(2); } }
const where = line => { let k = 0; while (k + 1 < map.length && map[k + 1][0] <= line) k++; return `${map[k][1]}:${line - map[k][0] + 1}`; };
const msgs = JSON.parse(report)[0].messages, errs = msgs.filter(m => m.severity === 2 || m.fatal), warns = msgs.filter(m => m.severity === 1);
for (const m of errs) console.log(`error   ${where(m.line)}  ${m.message} (${m.ruleId || 'parse'})`);
if (process.argv.includes('--warnings')) for (const m of warns) console.log(`warning ${where(m.line)}  ${m.message} (${m.ruleId})`);
console.log(`${code.length} files linted as one script: ${errs.length} error(s), ${warns.length} warning(s)`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(errs.length ? 1 : 0);
