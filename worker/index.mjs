// The site's Worker. Every request is a static file from dist/ (the game), except POST /api/map: the map
// editor's «Сохранить». It checks the editor's password, then commits the map as src/data/map.js to main
// on GitHub, and Cloudflare rebuilds the site from that commit in a minute or two.
// Secrets (Cloudflare → the Worker → Settings → Variables and Secrets):
//   EDITOR_PASSWORD  what the editor asks for once
//   GITHUB_TOKEN     a fine-grained token for aostera/ASCII-Meadow only, Contents: read and write

const REPO = 'aostera/ASCII-Meadow', PATH = 'src/data/map.js', BRANCH = 'main', MAX = 4 << 20;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Same length and every byte compared, so the time taken says nothing about the password.
function samePassword(a, b) {
  const x = new TextEncoder().encode(a || ''), y = new TextEncoder().encode(b || '');
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0 && x.length > 0;
}
function base64(text) {
  const bytes = new TextEncoder().encode(text); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
// A map file as the editor writes it, and nothing else: line comments, then `const MEADOW_MAP = ` and a
// plain JSON object to the end of the file. The whole object is parsed as JSON, so no code can ride along:
// the file is loaded as a script by every visitor. (Comments end only at a newline here, never at U+2028.)
const MAP_FILE = /^(?:\/\/[^\n\r\u2028\u2029]*\n)*const MEADOW_MAP = (\{[\s\S]*\});\n?$/;
function checkMap(text) {
  if (text.length > MAX) return 'map too large';
  const f = MAP_FILE.exec(text);
  if (!f) return 'not a map file';
  try {
    const m = JSON.parse(f[1]);
    if (!m || typeof m !== 'object' || Array.isArray(m) || m.v !== 1) return 'unknown map version';
  } catch { return 'map is not valid JSON'; }
  if (/<\/script/i.test(text)) return 'map contains </script';
  return '';
}
async function github(env, method, url, body) {
  const r = await fetch('https://api.github.com/repos/' + REPO + url, {
    method, body: body && JSON.stringify(body),
    headers: { authorization: 'Bearer ' + env.GITHUB_TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'ascii-meadow-editor', 'x-github-api-version': '2022-11-28' },
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

async function saveMap(request, env) {
  if (!env.EDITOR_PASSWORD || !env.GITHUB_TOKEN) return json({ error: 'saving is not set up: EDITOR_PASSWORD and GITHUB_TOKEN secrets are missing' }, 503);
  if (!samePassword((request.headers.get('authorization') || '').replace(/^Bearer /, ''), env.EDITOR_PASSWORD)) return json({ error: 'wrong password' }, 401);
  const text = await request.text(), bad = checkMap(text);
  if (bad) return json({ error: bad }, 400);
  const cur = await github(env, 'GET', '/contents/' + PATH + '?ref=' + BRANCH);
  if (!cur.ok) return json({ error: 'GitHub: cannot read ' + PATH + ' (' + cur.status + ')' }, 502);
  const content = base64(text);
  if (cur.data.content && cur.data.content.replace(/\n/g, '') === content) return json({ ok: true, unchanged: true });
  const put = await github(env, 'PUT', '/contents/' + PATH, { message: 'Map: saved from the editor', content, sha: cur.data.sha, branch: BRANCH });
  if (!put.ok) return json({ error: 'GitHub: commit failed (' + put.status + ')' }, 502);
  return json({ ok: true, commit: put.data.commit && put.data.commit.html_url });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/map') {
      if (request.method === 'POST') return saveMap(request, env);
      return json({ error: 'POST the map file here' }, 405);
    }
    return env.ASSETS.fetch(request);
  },
};
