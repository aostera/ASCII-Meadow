// node --check on every JavaScript file of the game and the tools.   usage: node tools/check/syntax.cjs
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === 'node_modules' || e.name.startsWith('.') ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'tools')), ...walk(path.join(root, 'worker'))].filter(f => /\.([cm]?js)$/.test(f));
let bad = 0;
for (const f of files) { const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); if (r.status) { bad++; console.log('FAIL ' + path.relative(root, f) + '\n' + r.stderr.split('\n').slice(0, 5).join('\n')); } }
console.log(`${files.length} files checked, ${bad} with syntax errors`);
process.exit(bad ? 1 : 0);
