// Sync code lifecycle: code generation, create/connect/disconnect, legacy upgrade, parent link and copy/email/share paths.
const { test, expect, openApp, sess, json: reply, toastText } = require('./helpers');

// Legacy server stub: serves legacy_pull/legacy_delete, passes everything else to the helpers' fake server.
async function legacyServer(page, { sessions = [], pullStatus = 200, pullError } = {}) {
  const legacy = [];
  await page.route('**/rtr-sync.php', route => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.action === 'legacy_pull') {
      legacy.push(body);
      if (pullStatus === 404) return reply(route, { ok: false, error: 'Sync code not found' }, 404);
      if (pullError) return reply(route, { ok: false, error: pullError }, 500);
      return reply(route, { ok: true, sessions });
    }
    if (body.action === 'legacy_delete') { legacy.push(body); return reply(route, { ok: true }); }
    return route.fallback();
  });
  return legacy;
}

test('generated sync codes are 12 characters from the unambiguous alphabet and unique', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const codes = Array.from({ length: 300 }, () => genSyncCode());
    return { codes, alphabet: SYNC_ALPHABET, shown: fmtSyncCode(codes[0]) };
  });
  const re = new RegExp('^[' + r.alphabet + ']{12}$');
  expect(r.codes.every(c => re.test(c))).toBe(true);
  expect(new Set(r.codes).size).toBe(300);
  expect(r.alphabet).not.toMatch(/[01OI]/);
  // every alphabet character is reachable (3600 draws; chance of missing one is negligible)
  expect(new Set(r.codes.join('')).size).toBe(new Set(r.alphabet).size);
  expect(r.shown).toMatch(/^\w{4}-\w{4}-\w{4}$/);
});

test('creating a sync code uploads only sealed blobs', async ({ page }) => {
  const { sync } = await openApp(page, { sessions: [sess({ id: 'c1', notes: 'secret-note-xyz', supervisor: 'Pat Q. Parent' })] });
  await page.evaluate(() => createSyncCode());
  const code = await page.evaluate(() => settings.syncCode);
  expect(code).toMatch(/^[A-Z2-9]{12}$/);
  const puts = sync.calls.filter(c => c.body.action === 'put');
  expect(puts.length).toBeGreaterThan(0);
  for (const c of sync.calls) {
    expect(c.raw).not.toContain(code);
    expect(c.raw).not.toContain('secret-note-xyz');
    expect(c.raw).not.toContain('Pat Q. Parent');
  }
  for (const p of puts) {
    const blob = JSON.parse(p.body.blob);
    expect(blob.v).toBe(2);
    expect(typeof blob.iv).toBe('string');
    expect(typeof blob.ct).toBe('string');
  }
  expect(await page.evaluate(() => syncStatus)).toBe('ok');
});

test('a failed create clears the code and says so', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'c2' })] });
  await page.route('**/rtr-sync.php', route => reply(route, { ok: false, error: 'boom' }, 500));
  await page.evaluate(() => createSyncCode());
  expect(await page.evaluate(() => settings.syncCode)).toBe('');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rtr_settings')).syncCode)).toBe('');
  expect(await page.evaluate(() => syncStatus)).toBe('err');
  expect(await toastText(page)).toBe('Could not create sync code');
});

test('connecting rejects a wrong-length code without any request', async ({ page }) => {
  const { sync } = await openApp(page);
  await page.evaluate(() => connectSyncCode('ABCD-EFG'));
  expect(await toastText(page)).toContain('12-character');
  expect(sync.calls).toEqual([]);
  expect(await page.evaluate(() => settings.syncCode || '')).toBe('');
});

test('a second device joins a created code typed with dashes and lower case', async ({ page, browser, baseURL }) => {
  const { sync } = await openApp(page, { sessions: [sess({ id: 'j1' })] });
  await page.evaluate(() => createSyncCode());
  const code = await page.evaluate(() => settings.syncCode);
  const ctx = await browser.newContext({ baseURL, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles', locale: 'en-US' });
  const p2 = await ctx.newPage();
  await openApp(p2, { store: sync.store });
  await p2.evaluate(c => connectSyncCode(c.toLowerCase().replace(/(.{4})/g, '$1-')), code);
  await expect.poll(() => p2.evaluate(() => sessions.map(s => s.id))).toEqual(['j1']);
  expect(await p2.evaluate(() => settings.syncCode)).toBe(code);
  await ctx.close();
});

test('a legacy upgrade migrates drives, deletes the old file and never sends drives in clear', async ({ page }) => {
  const remote = sess({ id: 'old1', notes: 'legacy-note-abc' });
  const { sync } = await openApp(page, { settings: { syncCode: 'ABCD2345', parentToken: 'tok' }, sessions: [sess({ id: 'mine1' })] });
  const legacy = await legacyServer(page, { sessions: [remote] });
  const ok = await page.evaluate(() => upgradeLegacySync());
  expect(ok).toBe(true);
  expect((await page.evaluate(() => sessions.map(s => s.id))).sort()).toEqual(['mine1', 'old1']);
  const s = await page.evaluate(() => ({ code: settings.syncCode, tok: settings.parentToken }));
  expect(s.code).toMatch(/^[A-Z2-9]{12}$/);
  expect(s.tok).toBe('');
  expect(legacy.map(l => l.action)).toEqual(['legacy_pull', 'legacy_delete']);
  expect(legacy[1].code).toBe('ABCD2345');
  expect(sync.calls.some(c => c.body.action === 'put')).toBe(true);
  for (const c of sync.calls) {
    expect(c.raw).not.toContain('legacy-note-abc');
    expect(c.raw).not.toContain('old1');
    expect(c.raw).not.toContain('mine1');
    expect(c.raw).not.toContain(s.code);
  }
  expect(await toastText(page)).toContain('Sync upgraded and encrypted');
});

test('upgrade when another device already upgraded clears the old code', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCD2345', parentToken: 'tok' } });
  const legacy = await legacyServer(page, { pullStatus: 404 });
  const ok = await page.evaluate(() => upgradeLegacySync());
  expect(ok).toBe(false);
  expect(await page.evaluate(() => ({ c: settings.syncCode, t: settings.parentToken, st: syncStatus }))).toEqual({ c: '', t: '', st: 'off' });
  expect(legacy.map(l => l.action)).toEqual(['legacy_pull']);
  expect(await toastText(page)).toContain('upgraded on another device');
});

test('upgrade fails cleanly when the legacy pull errors', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCD2345' }, sessions: [sess({ id: 'keep' })] });
  const legacy = await legacyServer(page, { pullError: 'Server busy' });
  const msg = await page.evaluate(() => upgradeLegacySync().then(() => 'resolved', e => e.message));
  expect(msg).toBe('Server busy');
  expect(await page.evaluate(() => settings.syncCode)).toBe('ABCD2345');
  expect(legacy.map(l => l.action)).toEqual(['legacy_pull']);
});

test('if the encrypted upload fails the old code is restored and the old file is kept', async ({ page }) => {
  const { sync } = await openApp(page, { settings: { syncCode: 'ABCD2345' }, sessions: [sess({ id: 'keep2' })] });
  const legacy = await legacyServer(page, { sessions: [sess({ id: 'old2' })] });
  await page.route('**/rtr-sync.php', route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.action === 'put') return reply(route, { ok: false, error: 'Disk full' }, 500);
    return route.fallback();
  });
  const msg = await page.evaluate(() => upgradeLegacySync().then(() => 'resolved', e => e.message));
  expect(msg).toBe('upgrade push failed');
  expect(await page.evaluate(() => settings.syncCode)).toBe('ABCD2345');
  expect(legacy.some(l => l.action === 'legacy_delete')).toBe(false);
  expect(sync.store.size).toBe(0);
});

test('joining a legacy code that exists saves it and upgrades', async ({ page }) => {
  await openApp(page);
  const legacy = await legacyServer(page, { sessions: [sess({ id: 'lg1' })] });
  await page.evaluate(() => connectSyncCode('abcd-2345'));
  await expect.poll(() => page.evaluate(() => settings.syncCode)).toMatch(/^[A-Z2-9]{12}$/);
  expect(await page.evaluate(() => sessions.map(s => s.id))).toContain('lg1');
  expect(legacy[0].action).toBe('legacy_pull');
  expect(legacy[legacy.length - 1].action).toBe('legacy_delete');
});

test('joining a legacy code when the server errors toasts and saves nothing', async ({ page }) => {
  await openApp(page);
  await legacyServer(page, { pullError: 'Rate limited' });
  await page.evaluate(() => connectSyncCode('ABCD2345'));
  expect(await toastText(page)).toBe('Could not connect to sync: Rate limited');
  expect(await page.evaluate(() => settings.syncCode || '')).toBe('');
  expect(await page.evaluate(() => syncStatus)).toBe('err');
});

test('joining a legacy code that does not exist toasts and saves nothing', async ({ page }) => {
  await openApp(page);
  const legacy = await legacyServer(page, { pullStatus: 404 });
  await page.evaluate(() => connectSyncCode('ABCD2345'));
  expect(await toastText(page)).toContain('Code not found');
  expect(await page.evaluate(() => settings.syncCode || '')).toBe('');
  expect(await page.evaluate(() => syncStatus)).toBe('off');
  expect(legacy.map(l => l.action)).toEqual(['legacy_pull']);
});

test('the parent link keeps the key after # and the token in the query', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCD2345EFGH', parent: { token: 'a'.repeat(32), key: 'KEY_abc-123' } }, url: '/readytoroll.html?x=1#old' });
  const url = await page.evaluate(() => parentLinkURL());
  const u = new URL(url);
  expect(u.pathname).toBe('/readytoroll.html');
  expect(u.searchParams.get('parent')).toBe('a'.repeat(32));
  expect(u.search).not.toContain('KEY_abc');
  expect(u.hash).toBe('#k=KEY_abc-123');
  expect(url).not.toContain('x=1');
});

test('sharing the parent link: needs sync, then share sheet, clipboard or toast', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => shareParentLink());
  expect(await toastText(page)).toBe('Enable sync first');

  await page.evaluate(() => createSyncCode());
  await page.evaluate(() => {
    window.__shared = []; window.__clip = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: o => { __shared.push(o); return Promise.resolve(); } });
  });
  await page.evaluate(() => shareParentLink());
  await expect.poll(() => page.evaluate(() => __shared.length)).toBe(1);
  const shared = await page.evaluate(() => __shared);
  expect(shared[0].url).toContain('?parent=');
  expect(shared[0].url).toContain('#k=');
  expect(shared[0].title).toContain('Jamie');

  // clipboard path (no share sheet)
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { __clip.push(t); return Promise.resolve(); } } });
  });
  await page.evaluate(() => shareParentLink());
  await expect.poll(() => page.evaluate(() => __clip.length)).toBe(1);
  await expect.poll(() => toastText(page)).toBe('Parent link copied!');
  expect(await page.evaluate(() => __clip[0])).toBe(shared[0].url);

  // neither: the link is shown in a toast
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.evaluate(() => shareParentLink());
  expect(await toastText(page)).toBe(shared[0].url);
});

test('copying the sync code uses the clipboard, falls back to a toast, and survives a clipboard failure', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGH2345' } });
  await page.evaluate(() => {
    window.__clip = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { __clip.push(t); return Promise.resolve(); } } });
  });
  await page.evaluate(() => copySyncCode());
  await expect.poll(() => toastText(page)).toBe('Sync code copied: ABCD-EFGH-2345');
  expect(await page.evaluate(() => __clip)).toEqual(['ABCD-EFGH-2345']);

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.evaluate(() => copySyncCode());
  expect(await toastText(page)).toBe('Your code: ABCD-EFGH-2345');
});

// Fixed in phase 4: a denied clipboard write used to raise an uncaught rejection with no feedback
test('a denied clipboard write toasts instead of throwing', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGH2345' } });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await page.evaluate(() => copySyncCode());
  await expect.poll(() => toastText(page)).toBe('Your code: ABCD-EFGH-2345');
  await page.evaluate(() => shareParentLink());
  await expect.poll(() => toastText(page)).toContain('?parent=');
});

test('a failed legacy delete after an upgrade is retried on the next push, and never exported', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCD2345' } });
  const legacy = await legacyServer(page, { sessions: [] });
  let failDelete = true;
  await page.route('**/rtr-sync.php', route => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.action === 'legacy_delete' && failDelete) { legacy.push({ ...b, failed: true }); return reply(route, { ok: false, error: 'Busy' }, 500); }
    return route.fallback();
  });
  expect(await page.evaluate(() => upgradeLegacySync())).toBe(true);
  expect(await page.evaluate(() => settings.legacyPendingDelete)).toBe('ABCD2345');
  expect(await page.evaluate(() => JSON.stringify(exportPayload()))).not.toContain('ABCD2345');
  failDelete = false;
  await page.evaluate(() => pushSync());
  expect(legacy.filter(l => l.action === 'legacy_delete').map(l => !!l.failed)).toEqual([true, false]);
  expect(await page.evaluate(() => settings.legacyPendingDelete)).toBeUndefined();
});

test('emailing the sync code builds a mailto with the code and the app address only', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGH2345', driverName: 'Jamie' }, url: '/readytoroll.html?parent=zzz#k=secretkey' });
  // location.href can't be stubbed, so run the real function body with the navigation captured
  const mailto = await page.evaluate(() => {
    const src = emailSyncCode.toString().replace('location.href=', 'window.__mailto=');
    (0, eval)('window.__emailFn = ' + src);
    window.__emailFn();
    return window.__mailto;
  });
  expect(mailto.startsWith('mailto:?subject=')).toBe(true);
  const body = decodeURIComponent(mailto);
  expect(body).toContain("Jamie's ReadyToRoll Sync Code");
  expect(body).toContain('ABCD-EFGH-2345');
  expect(body).toContain('/readytoroll.html, go to Settings');
  expect(body).not.toContain('secretkey');
  expect(body).not.toContain('parent=zzz');
});

test('disconnecting asks first, then clears the code, parent link and keys', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => createSyncCode());
  await page.evaluate(() => createParentLink());
  expect(await page.evaluate(() => !!settings.parent)).toBe(true);
  page.once('dialog', d => d.dismiss());
  await page.evaluate(() => disconnectSync());
  expect(await page.evaluate(() => !!settings.syncCode)).toBe(true);
  page.once('dialog', d => d.accept());
  await page.evaluate(() => disconnectSync());
  const s = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('rtr_settings')), st: syncStatus, k: syncKeys }));
  expect(s.s.syncCode).toBe('');
  expect(s.s.parent).toBeNull();
  expect(s.s.parentToken).toBe('');
  expect(s.st).toBe('off');
  expect(s.k).toBeNull();
  expect(await toastText(page)).toBe('Sync disconnected');
});
