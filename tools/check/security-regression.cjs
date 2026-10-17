#!/usr/bin/env node
// Regression test: security gates must reject a synthetic token *before* it is
// published or committed. Tokens are assembled at runtime and NEVER checked in.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const python = process.platform === 'win32' ? 'python' : 'python3';
const gate = path.join(root, 'tools/check/deploy-surface.cjs');
const token = 'gh' + 'p_' + 'A'.repeat(40); // known-format dummy, invalid by design
const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, {
    cwd, encoding: 'utf8', timeout: 30000, env: {...process.env, GITHUB_ACTIONS:'true'},
  });
  if (r.error) throw r.error;
  return r;
};
const assertBlocked = (result, context) => {
  assert.notEqual(result.status, 0, context + ' must reject the fixture');
  assert(result.stdout.concat(result.stderr).includes('BLOCKED') ||
         result.stdout.concat(result.stderr).includes('FINDING TYPE') ||
         result.stdout.concat(result.stderr).includes('Total findings:'),
         context + ' must explain why it rejected the fixture');
  assert(!result.stdout.concat(result.stderr).includes(token), context + ' must redact values');
};
const testPath = path.join(root, 'src/__security_gate_probe__.js');
assert(!fs.existsSync(testPath), 'Refusing to overwrite a real source file');
try {
  assert.equal(run('node', [gate, '--source']).status, 0, 'Clean source must pass');
  fs.writeFileSync(testPath, 'const demo = "' + token + '";\n', {flag:'wx'});
  assertBlocked(run('node', [gate, '--source']), 'Source credential gate');
} finally {
  fs.rmSync(testPath, {force:true});
}
const hidden = path.join(root, 'src/.env.security-probe');
assert(!fs.existsSync(hidden), 'Refusing to overwrite a real env file');
try {
  fs.writeFileSync(hidden, 'SAMPLE=not-a-real-secret\n', {flag:'wx'});
  assertBlocked(run('node', [gate, '--source']), 'Secret filename gate');
} finally {
  fs.rmSync(hidden, {force:true});
}
assert.equal(run('node', [gate, '--source']).status, 0, 'Clean source must pass after cleanup');

// Test both staged-file and full-history checks inside a disposable Git repo.
// Never place generated credential-looking strings in real repository objects.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ascii-meadow-security-fixture-'));
try {
  const fakeRoot = tmp;
  fs.mkdirSync(path.join(fakeRoot,'tools/check'), {recursive:true});
  for (const f of ['staged-secrets.py','secret-history.py']) {
    fs.copyFileSync(path.join(root,'tools/check',f), path.join(fakeRoot,'tools/check',f));
  }
  assert.equal(run('git',['init','-q'],fakeRoot).status,0);
  assert.equal(run('git',['config','user.email','audit@example.invalid'],fakeRoot).status,0);
  assert.equal(run('git',['config','user.name','Security Fixture'],fakeRoot).status,0);
  const fake = path.join(fakeRoot,'fixture.js');
  fs.writeFileSync(fake,'const demo = "'+token+'";\n',{flag:'wx'});
  assert.equal(run('git',['add','fixture.js'],fakeRoot).status,0);
  assertBlocked(run(python,[path.join(fakeRoot,'tools/check/staged-secrets.py')],fakeRoot),'Pre-commit staged scan');
  assert.equal(run('git',['commit','--no-verify','-qm','safe fixture'],fakeRoot).status,0);
  assertBlocked(run(python,[path.join(fakeRoot,'tools/check/secret-history.py')],fakeRoot),'Historical secret scan');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
console.log('PASS security regression fixtures: source, sensitive paths, staged Git, historical Git, redaction and cleanup');
