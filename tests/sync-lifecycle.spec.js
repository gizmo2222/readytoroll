// Sync code lifecycle: code generation, create/connect/disconnect, old-code rejection, parent link and copy/email/share paths.
const { test, expect, openApp, sess, json: reply, toastText } = require('./helpers');

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

test('emailing the sync code builds a mailto with the code and the app address only', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGH2345', driverName: 'Jamie' }, url: '/readytoroll.html?parent=zzz#k=secretkey' });
  // location.href can't be stubbed, so run the real function body with the navigation captured
  page.once('dialog', d => d.accept());
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

async function captureEmail(page) {
  return page.evaluate(() => {
    const src = emailSyncCode.toString().replace('location.href=', 'window.__mailto=');
    window.__mailto = null;
    (0, eval)('window.__emailFn = ' + src);
    window.__emailFn();
    return window.__mailto;
  });
}

test('the email warns before opening, is fully encoded and has no hash from the page URL', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGH2345' }, url: '/readytoroll.html#drive' });
  let msg = '';
  page.once('dialog', d => { msg = d.message(); d.accept(); });
  const mailto = await captureEmail(page);
  expect(msg).toBe('Anyone with this code can read and change your log. Only send it to yourself.');
  const rawBody = mailto.split('&body=')[1];
  expect(rawBody).not.toContain('#');            // a raw # would cut the body off
  expect(rawBody).toContain('%0A');
  const body = decodeURIComponent(rawBody);
  expect(body).toContain('/readytoroll.html, go to Settings');
  expect(body).not.toContain('#drive');
  expect(body).toContain(msg);
  expect(body).toContain('ABCD-EFGH-2345');
});

test('cancelling the email warning does nothing', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGH2345' } });
  page.once('dialog', d => d.dismiss());
  expect(await captureEmail(page)).toBeNull();
});

test('joining a code with local drives asks first; cancel changes and uploads nothing', async ({ page, browser, baseURL }) => {
  const { sync } = await openApp(page, { sessions: [sess({ id: 'm1' })] });
  await page.evaluate(() => createSyncCode());
  const code = await page.evaluate(() => settings.syncCode);
  const ctx = await browser.newContext({ baseURL, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles', locale: 'en-US' });
  const p2 = await ctx.newPage();
  await openApp(p2, { store: sync.store, sessions: [sess({ id: 'm2' }), sess({ id: 'm3' })] });
  const before = await p2.evaluate(() => localStorage.getItem('rtr_settings'));
  const puts = sync.calls.filter(c => c.body.action === 'put').length;
  let msg = '';
  p2.once('dialog', d => { msg = d.message(); d.dismiss(); });
  await p2.evaluate(c => connectSyncCode(c), code);
  expect(msg).toBe('Merge the 2 drives on this device into the synced log?');
  expect(await p2.evaluate(() => localStorage.getItem('rtr_settings'))).toBe(before);
  expect(await p2.evaluate(() => settings.syncCode || '')).toBe('');
  expect(await p2.evaluate(() => sessions.map(s => s.id))).toEqual(['m2', 'm3']);
  expect(sync.calls.filter(c => c.body.action === 'put').length).toBe(puts);
  // accepting merges both sides
  p2.once('dialog', d => d.accept());
  await p2.evaluate(c => connectSyncCode(c), code);
  await expect.poll(() => p2.evaluate(() => sessions.map(s => s.id).sort())).toEqual(['m1', 'm2', 'm3']);
  await ctx.close();
});

test('both sync status labels come from one map, with the same error wording', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGH2345' } });
  expect(await page.evaluate(() => { syncStatus = 'err'; return syncCodeHTML(); })).toContain('Sync error — check connection');
  await page.evaluate(() => { navigate('settings'); renderSettings(); syncStatus = 'busy'; updateSyncUI(); syncStatus = 'err'; updateSyncUI(); });
  await expect(page.locator('#sync-status-txt')).toHaveText('Sync error — check connection');
});

// ── Clear all data with sync connected ──
async function connectedWithParent(page) {
  const o = await openApp(page, { sessions: [sess({ id: 'cl1' })] });
  await page.evaluate(() => createSyncCode());
  await page.evaluate(() => createParentLink());
  const ids = await page.evaluate(async () => ({ id: (await deriveSyncKeys(settings.syncCode)).id, tok: settings.parent.token }));
  return { ...o, ...ids };
}

test('clear all with sync deletes the cloud blob and parent id, then clears locally', async ({ page }) => {
  const { sync, id, tok } = await connectedWithParent(page);
  expect(sync.store.has(id) && sync.store.has(tok)).toBe(true);
  const msgs = [];
  page.on('dialog', d => { msgs.push(d.message()); d.accept(); });
  await page.evaluate(() => clearAllData());
  expect(msgs).toHaveLength(1);
  expect(msgs[0]).toContain('cloud copy');
  expect(msgs[0]).toContain('parent link');
  expect(sync.store.has(id)).toBe(false);
  expect(sync.store.has(tok)).toBe(false);
  expect(sync.store.revoked.has(tok)).toBe(true);
  expect(await page.evaluate(() => ({ c: settings.syncCode, p: settings.parent, n: sessions.length, k: syncKeys, st: syncStatus })))
    .toEqual({ c: '', p: null, n: 0, k: null, st: 'off' });
});

test('clear all with a failing cloud delete asks again: No changes nothing, Yes clears this device only', async ({ page }) => {
  const { sync, id } = await connectedWithParent(page);
  await page.route('**/rtr-sync.php', route => {
    if (JSON.parse(route.request().postData() || '{}').action === 'delete') return reply(route, { ok: false, error: 'boom' }, 500);
    return route.fallback();
  });
  const msgs = [];
  let answers = [true, false];
  page.on('dialog', d => { msgs.push(d.message()); (answers.shift() ? d.accept() : d.dismiss()); });
  await page.evaluate(() => clearAllData());
  expect(msgs).toHaveLength(2);
  expect(msgs[1]).toBe("Couldn't remove the cloud copy. Clear this device anyway? Your cloud copy stays and you can reconnect with your code.");
  expect(await page.evaluate(() => ({ c: !!settings.syncCode, p: !!settings.parent, n: sessions.length }))).toEqual({ c: true, p: true, n: 1 });
  answers = [true, true];
  await page.evaluate(() => clearAllData());
  expect(await page.evaluate(() => ({ c: settings.syncCode, n: sessions.length }))).toEqual({ c: '', n: 0 });
  expect(sync.store.has(id)).toBe(true);
});

test('clear all without sync asks once and makes no sync request', async ({ page }) => {
  const { sync } = await openApp(page, { sessions: [sess({ id: 'ns1' })] });
  const msgs = [];
  page.on('dialog', d => { msgs.push(d.message()); d.accept(); });
  await page.evaluate(() => clearAllData());
  expect(msgs).toHaveLength(1);
  expect(msgs[0]).not.toContain('cloud');
  expect(await page.evaluate(() => sessions.length)).toBe(0);
  expect(sync.calls).toHaveLength(0);
});

// ── Dirty flag: a skipped or failed push is retried ──
test('a push skipped offline sets a device-only dirty flag, reads not Synced, and goes out when back online', async ({ page, context }) => {
  const { sync } = await openApp(page);
  await page.evaluate(() => createSyncCode());
  const id = await page.evaluate(async () => (await deriveSyncKeys(settings.syncCode)).id);
  await context.setOffline(true);
  await page.evaluate(() => { navigate('settings'); renderSettings(); });
  expect(await page.evaluate(() => pushSync())).toBe(false);
  expect(await page.evaluate(() => settings.syncDirty)).toBe(true);
  const before = sync.store.get(id);
  await page.evaluate(() => { syncStatus = 'ok'; renderSettings(); });
  await expect(page.locator('#sync-status-txt')).not.toContainText('Synced');
  expect(await page.evaluate(() => exportPayload().settings.syncDirty)).toBeUndefined();
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => settings.syncDirty)).toBeUndefined();
  expect(await page.evaluate(() => syncStatus)).toBe('ok');
  expect(sync.store.get(id)).not.toBe(before);
});

test('the dirty flag survives a reload and is retried at load; a failing push stays dirty without looping', async ({ page }) => {
  const { sync } = await openApp(page);
  await page.evaluate(() => createSyncCode());
  const failPuts = route => {
    if (JSON.parse(route.request().postData() || '{}').action === 'put') return reply(route, { ok: false, error: 'down' }, 500);
    return route.fallback();
  };
  await page.route('**/rtr-sync.php', failPuts);
  expect(await page.evaluate(() => pushSync())).toBe(false);
  expect(await page.evaluate(() => settings.syncDirty)).toBe(true);
  const puts = () => sync.calls.filter(c => c.body.action === 'put').length;
  const n = puts();
  await page.waitForTimeout(500);
  expect(puts()).toBe(n);   // no retry loop
  await page.unroute('**/rtr-sync.php', failPuts);
  await page.reload();
  await page.waitForFunction(() => typeof getTotals === 'function');
  expect(await page.evaluate(() => settings.syncDirty)).toBe(true);
  await expect.poll(() => page.evaluate(() => settings.syncDirty), { timeout: 8000 }).toBeUndefined();
});

test('typing an old 8-character code into connect shows the old-style message and makes no request', async ({ page }) => {
  const { sync } = await openApp(page);
  await page.evaluate(() => connectSyncCode('abcd-2345'));
  expect(await toastText(page)).toBe("That's an old-style code. Create a new sync code on your other device.");
  expect(sync.calls).toEqual([]);
  expect(await page.evaluate(() => settings.syncCode || '')).toBe('');
});

test('an old 8-character code in stored settings is dropped at load, with no sync request and drives kept', async ({ page }) => {
  const { sync } = await openApp(page, { sessions: [sess({ id: 'keep1' })], settings: { syncCode: 'ABCD2345', legacyPendingDelete: 'ABCD2345' } });
  expect(await page.evaluate(() => settings.syncCode || '')).toBe('');
  expect(await page.evaluate(() => settings.legacyPendingDelete)).toBeUndefined();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rtr_settings')));
  expect(stored.syncCode || '').toBe('');
  expect(stored.legacyPendingDelete).toBeUndefined();
  expect(await page.evaluate(() => sessions.map(s => s.id))).toEqual(['keep1']);
  await page.evaluate(() => pushSync());
  expect(sync.calls).toEqual([]);
});
