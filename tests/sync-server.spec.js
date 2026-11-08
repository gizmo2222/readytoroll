// Real rtr-sync.php under `php -S`: CORS, blob put/get/delete, validation, size cap, rate limits, legacy v1 files.
const { test, expect, appRoot } = require('./helpers');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

test.describe.configure({ mode: 'serial' });

const hasPhp = !spawnSync('php', ['-v']).error;
const PORT_BASE = Number(process.env.RTR_TEST_PORT || 4317) + 100;
const ID1 = 'a'.repeat(32);
const ID2 = 'b1'.repeat(32);
const sealed = (ct = 'AAAA') => JSON.stringify({ v: 2, iv: 'iviviv', ct });

let tmp, rlDir, dataDir, blobDir, proc, base, port;

async function call(body, { origin, raw, method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  const r = await fetch(base + '/rtr-sync.php', {
    method, headers, body: method === 'GET' ? undefined : (raw !== undefined ? raw : JSON.stringify(body)),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
  return { status: r.status, json, text, headers: r.headers };
}
const put = (id, blob, extra) => call({ action: 'put', id, blob }, extra);
const resetRl = () => { for (const f of fs.readdirSync(rlDir)) fs.rmSync(path.join(rlDir, f), { force: true }); };
const blobFiles = () => (fs.existsSync(blobDir) ? fs.readdirSync(blobDir) : []);

test.beforeAll(async ({}, testInfo) => {
  test.skip(!hasPhp, 'php is not on PATH');
  port = PORT_BASE + testInfo.parallelIndex;
  base = `http://127.0.0.1:${port}`;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtr-sync-'));
  rlDir = path.join(tmp, 'rl');                 // PHP's sys_get_temp_dir(): rate-limit files stay isolated
  fs.mkdirSync(rlDir);
  const docroot = path.join(tmp, 'www');
  fs.mkdirSync(docroot);
  fs.copyFileSync(path.join(appRoot, 'rtr-sync.php'), path.join(docroot, 'rtr-sync.php'));
  dataDir = path.join(docroot, 'rtr-sync-data');
  blobDir = path.join(dataDir, 'v2');
  fs.mkdirSync(dataDir);                         // v2/ is left out so the first request creates it
  proc = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', docroot], {
    stdio: 'ignore', env: { ...process.env, TMP: rlDir, TEMP: rlDir, TMPDIR: rlDir },
  });
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    try { await fetch(base + '/rtr-sync.php', { method: 'OPTIONS' }); up = true; }
    catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
  expect(up, 'php server did not start').toBe(true);
});

test.afterAll(() => {
  if (proc) proc.kill();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

test.beforeEach(() => { if (rlDir) resetRl(); });

test('CORS: same-host and allowed origins pass, foreign origin gets 403, no Origin is fine', async () => {
  for (const origin of [base, 'https://metacrystal.com', 'https://www.metacrystal.com']) {
    const r = await call({ action: 'get', id: ID1 }, { origin });
    expect(r.status, origin).toBe(404);
    expect(r.headers.get('access-control-allow-origin')).toBe(origin);
    expect(r.headers.get('vary')).toBe('Origin');
  }
  const noOrigin = await call({ action: 'get', id: ID1 });
  expect(noOrigin.status).toBe(404);
  expect(noOrigin.headers.get('access-control-allow-origin')).toBeNull();
  for (const origin of ['https://evil.example', 'http://metacrystal.com', 'https://metacrystal.com.evil.example', 'http://127.0.0.1:1']) {
    const r = await call({ action: 'get', id: ID1 }, { origin });
    expect(r.status, origin).toBe(403);
    expect(r.json).toEqual({ ok: false, error: 'Forbidden' });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  }
});

test('OPTIONS preflight returns 204 with method and header allowances; foreign preflight is refused', async () => {
  const r = await call(null, { method: 'OPTIONS', origin: 'https://metacrystal.com', raw: '' });
  expect(r.status).toBe(204);
  expect(r.text).toBe('');
  expect(r.headers.get('access-control-allow-origin')).toBe('https://metacrystal.com');
  expect(r.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
  expect(r.headers.get('access-control-allow-headers')).toBe('Content-Type');
  const bad = await call(null, { method: 'OPTIONS', origin: 'https://evil.example', raw: '' });
  expect(bad.status).toBe(403);
});

test('put/get/delete round trip; first request creates the data folder with a deny .htaccess', async () => {
  const blob = sealed('round-trip');
  const p = await put(ID1, blob);
  expect(p.status).toBe(200);
  expect(p.json.ok).toBe(true);
  expect(p.json.updatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  expect(fs.readFileSync(path.join(dataDir, '.htaccess'), 'utf8')).toContain('Deny from all');

  const g = await call({ action: 'get', id: ID1 });
  expect(g.status).toBe(200);
  expect(g.json.blob).toBe(blob);
  expect(g.json.updatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  expect(g.headers.get('cache-control')).toBe('no-store');
  expect(g.headers.get('content-type')).toContain('application/json');

  const replaced = await put(ID1, sealed('second'));
  expect(replaced.json.ok).toBe(true);
  expect((await call({ action: 'get', id: ID1 })).json.blob).toBe(sealed('second'));

  const d = await call({ action: 'delete', id: ID1 });
  expect(d.json).toEqual({ ok: true });
  expect((await call({ action: 'get', id: ID1 })).status).toBe(404);
  expect((await call({ action: 'delete', id: ID1 })).json).toEqual({ ok: true });   // idempotent
});

test('get of a missing blob is 404; 64-char ids work and action is case-insensitive', async () => {
  const miss = await call({ action: 'get', id: ID2 });
  expect(miss.status).toBe(404);
  expect(miss.json).toEqual({ ok: false, error: 'Not found' });
  expect((await call({ action: '  PUT ', id: ID2, blob: sealed() })).json.ok).toBe(true);
  expect((await call({ action: 'Get', id: ID2 })).json.ok).toBe(true);
  await call({ action: 'delete', id: ID2 });
});

test('invalid ids are rejected on get, put and delete', async () => {
  const bad = ['', 'abc', 'a'.repeat(31), 'a'.repeat(33), 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(32), 'g'.repeat(32),
    ' ' + 'a'.repeat(31), 'a'.repeat(32) + ' ', 123, null];
  for (const id of bad) {
    for (const action of ['get', 'put', 'delete']) {
      const r = await call({ action, id, blob: sealed() });
      expect([r.status, r.json && r.json.error], `${action} ${JSON.stringify(id)}`).toEqual([400, 'Invalid id']);
    }
  }
  const noId = await call({ action: 'get' });
  expect(noId.status).toBe(400);
  expect(blobFiles()).toEqual([]);
});

// BUG: a non-string id (object/array) triggers PHP "Array to string conversion"; with display_errors on, the warning
// (including the server file path) is printed before the JSON, so the client gets a non-JSON body.
test.fixme('non-string ids get a clean JSON 400 without PHP warnings in the body', async () => {
  const r = await call({ action: 'get', id: {} });
  expect(r.status).toBe(400);
  expect(r.json).toEqual({ ok: false, error: 'Invalid id' });
});

// BUG: the id regex ends in `$` without the D modifier, so a valid id plus a trailing newline passes validation
// and addresses a different (newline-named) file instead of being rejected.
test.fixme('an id with a trailing newline is rejected', async () => {
  const r = await call({ action: 'get', id: ID1 + '\n' });
  expect([r.status, r.json.error]).toEqual([400, 'Invalid id']);
});

test('path traversal in ids and legacy codes cannot reach other files', async () => {
  const secret = path.join(path.dirname(dataDir), 'secret.blob');
  fs.writeFileSync(secret, sealed('secret'));
  const ids = ['../../secret', '../' + 'a'.repeat(29), 'a'.repeat(32) + '/../../../secret', '..%2f' + 'a'.repeat(28),
    'a'.repeat(30) + '..', '..\\' + 'a'.repeat(30), 'a'.repeat(32) + '\u0000', 'a'.repeat(32) + '.blob/../x'];
  for (const id of ids) {
    for (const action of ['get', 'put', 'delete']) {
      const r = await call({ action, id, blob: sealed('evil') });
      expect(r.status, `${action} ${JSON.stringify(id)}`).toBe(400);
    }
  }
  expect(fs.readFileSync(secret, 'utf8')).toBe(sealed('secret'));
  expect(blobFiles()).toEqual([]);
  // legacy: separators and dots are stripped, so only 8 clean characters ever form a file name
  const lp = await call({ action: 'legacy_pull', code: '../../secret' });
  expect([lp.status, lp.json.error]).toEqual([400, 'Invalid code']);
  const ld = await call({ action: 'legacy_delete', code: '..\\..\\x' });
  expect(ld.status).toBe(400);
  expect(fs.existsSync(secret)).toBe(true);
});

test('invalid blob shapes are rejected and nothing is stored', async () => {
  const cases = [
    [undefined, 'missing'], ['', 'empty'], [123, 'number'], [{ v: 2, iv: 'x', ct: 'y' }, 'object not string'],
    [['x'], 'array'], ['not json', 'not json'], ['"str"', 'json string'], ['[]', 'json array'], ['null', 'json null'],
    [JSON.stringify({ iv: 'x', ct: 'y' }), 'no v'], [JSON.stringify({ v: 1, iv: 'x', ct: 'y' }), 'v1'],
    [JSON.stringify({ v: '2', iv: 'x', ct: 'y' }), 'v as string'], [JSON.stringify({ v: 2, ct: 'y' }), 'no iv'],
    [JSON.stringify({ v: 2, iv: 'x' }), 'no ct'], [JSON.stringify({ v: 2, iv: 5, ct: 'y' }), 'iv number'],
    [JSON.stringify({ v: 2, iv: 'x', ct: ['y'] }), 'ct array'], [JSON.stringify({ v: 2, iv: null, ct: null }), 'nulls'],
  ];
  for (const [blob, label] of cases) {
    const r = await put(ID1, blob);
    expect([r.status, r.json && r.json.error], label).toEqual([400, 'Invalid payload']);
  }
  expect(blobFiles()).toEqual([]);
});

test('3 MB cap: exactly 3 MB is accepted, one byte more and oversized bodies get 413', async () => {
  const MAX = 3 * 1024 * 1024;
  const fill = n => sealed('x'.repeat(n - sealed('').length));
  const ok = fill(MAX);
  expect(ok.length).toBe(MAX);
  const r1 = await put(ID1, ok);
  expect(r1.status).toBe(200);
  expect(fs.statSync(path.join(blobDir, ID1 + '.blob')).size).toBe(MAX);

  const over = fill(MAX + 1);
  const r2 = await put(ID2, over);
  expect([r2.status, r2.json.error]).toEqual([413, 'Data too large (max 3 MB)']);
  expect(blobFiles()).toEqual([ID1 + '.blob']);   // the oversized put stored nothing

  const huge = await call(null, { raw: JSON.stringify({ action: 'put', id: ID2, blob: sealed('y'.repeat(MAX + 20000)) }) });
  expect([huge.status, huge.json.error]).toEqual([413, 'Data too large']);
  expect(blobFiles()).toEqual([ID1 + '.blob']);
  await call({ action: 'delete', id: ID1 });
});

test('wrong method, malformed JSON and unknown actions are rejected cleanly', async () => {
  const get = await call(null, { method: 'GET' });
  expect([get.status, get.json.error]).toEqual([400, 'Invalid request']);
  for (const raw of ['', '{', 'not json', '0', '"get"', '5', 'null', '[1,2]x', '{"action":"get"']) {
    const r = await call(null, { raw });
    expect([r.status, r.json && r.json.error], JSON.stringify(raw)).toEqual([400, 'Invalid request']);
  }
  for (const action of ['', 'list', 'purge', 'legacy', 'get2', 5, null]) {
    const r = await call({ action, id: ID1 });
    expect([r.status, r.json.error], String(action)).toEqual([400, 'Unknown action']);
  }
  expect((await call({ id: ID1 })).json.error).toBe('Unknown action');
});

test('rate limit: 61st get in a window is 429, counters are per action, an old window resets', async () => {
  for (let i = 0; i < 60; i++) {
    const r = await call({ action: 'get', id: ID2 });
    if (r.status !== 404) throw new Error(`request ${i + 1} gave ${r.status}`);
  }
  const limited = await call({ action: 'get', id: ID2 });
  expect(limited.status).toBe(429);
  expect(limited.json.ok).toBe(false);
  expect((await call({ action: 'delete', id: ID2 })).json.ok).toBe(true);     // separate counter
  expect((await call({ action: 'get', id: ID2 })).status).toBe(429);          // still blocked

  // age the window by rewriting its start time: the next call starts a fresh window
  const ip = crypto.createHash('md5').update('127.0.0.1').digest('hex');
  const file = path.join(rlDir, `rtr_rl_${ip}_get`);
  expect(fs.existsSync(file)).toBe(true);
  fs.writeFileSync(file, JSON.stringify({ count: 500, start: Math.floor(Date.now() / 1000) - 120 }));
  expect((await call({ action: 'get', id: ID2 })).status).toBe(404);
});

test('rate limit: only new blobs count toward the 10-per-5-minutes create limit', async () => {
  const mk = i => i.toString(16).padStart(32, '0');
  for (let i = 1; i <= 10; i++) expect((await put(mk(i), sealed())).status, `create ${i}`).toBe(200);
  const eleventh = await put(mk(11), sealed());
  expect(eleventh.status).toBe(429);
  expect(blobFiles()).not.toContain(mk(11) + '.blob');
  for (let i = 0; i < 5; i++) expect((await put(mk(1), sealed('upd' + i))).status).toBe(200);   // replacing is not a create
  expect((await call({ action: 'get', id: mk(1) })).json.blob).toBe(sealed('upd4'));
  for (let i = 1; i <= 10; i++) await call({ action: 'delete', id: mk(i) });
});

test('stored files hold exactly the blob and nothing else (no id, code, headers or metadata)', async () => {
  const blob = sealed('only-this');
  expect((await put(ID2, blob)).json.ok).toBe(true);
  expect(blobFiles()).toEqual([ID2 + '.blob']);
  expect(fs.readFileSync(path.join(blobDir, ID2 + '.blob'), 'utf8')).toBe(blob);
  expect(fs.readdirSync(dataDir).filter(f => f !== 'secret.blob' && !f.endsWith('.json') && !f.endsWith('.parent')).sort())
    .toEqual(['.htaccess', 'v2']);
  await call({ action: 'delete', id: ID2 });
});

test('legacy_pull returns only sessions; invalid and missing codes are rejected', async () => {
  const sessions = [{ id: 's1', duration: 30 }, { id: 's2', duration: 45 }];
  fs.writeFileSync(path.join(dataDir, 'ABCD2345.json'), JSON.stringify({ sessions, parentToken: 'c'.repeat(32), notes: 'x' }));
  const r = await call({ action: 'legacy_pull', code: 'abcd-2345' });   // lower case and separators are normalised
  expect(r.status).toBe(200);
  expect(r.json).toEqual({ ok: true, sessions });
  expect((await call({ action: 'legacy_pull', code: 'ZZZZ9999' })).status).toBe(404);
  for (const code of ['', 'ABC', 'ABCDEFGHI', 'ABCD234', undefined]) {
    const x = await call({ action: 'legacy_pull', code });
    expect([x.status, x.json.error], String(code)).toEqual([400, 'Invalid code']);
  }
  fs.writeFileSync(path.join(dataDir, 'NODATA11.json'), 'garbage');
  expect((await call({ action: 'legacy_pull', code: 'NODATA11' })).json).toEqual({ ok: true, sessions: [] });
});

test('legacy_delete removes the legacy file and its parent link, and is idempotent', async () => {
  const token = 'd'.repeat(32);
  const legacy = path.join(dataDir, 'LEGACY99.json');
  const parent = path.join(dataDir, token + '.parent');
  const other = path.join(dataDir, 'e'.repeat(32) + '.parent');
  fs.writeFileSync(legacy, JSON.stringify({ sessions: [], parentToken: token }));
  fs.writeFileSync(parent, '{}');
  fs.writeFileSync(other, '{}');
  expect((await call({ action: 'legacy_delete', code: 'legacy99' })).json).toEqual({ ok: true });
  expect(fs.existsSync(legacy)).toBe(false);
  expect(fs.existsSync(parent)).toBe(false);
  expect(fs.existsSync(other)).toBe(true);
  expect((await call({ action: 'legacy_delete', code: 'LEGACY99' })).json).toEqual({ ok: true });
  // a bad parentToken (not 32 hex) is never turned into a path
  const evilTarget = path.join(path.dirname(dataDir), 'victim.parent');
  fs.writeFileSync(evilTarget, 'keep');
  fs.writeFileSync(path.join(dataDir, 'EVILTOK1.json'), JSON.stringify({ sessions: [], parentToken: '../victim' }));
  expect((await call({ action: 'legacy_delete', code: 'EVILTOK1' })).json.ok).toBe(true);
  expect(fs.existsSync(evilTarget)).toBe(true);
  expect(fs.existsSync(path.join(dataDir, 'EVILTOK1.json'))).toBe(false);
});
