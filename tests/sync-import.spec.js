// Regression tests for sync and import data-loss findings (W4).
const { test, expect, openApp, sess, newDevice } = require('./helpers');

const CODE = 'ABCDEFGHJKLM';
const ids = p => p.evaluate(() => sessions.map(s => s.id).sort());

async function pair(browser, baseURL, page, sessionsA = [], sessionsB = []) {
  const store = new Map();
  await openApp(page, { store, settings: { syncCode: CODE }, sessions: sessionsA });
  await page.evaluate(() => pushSync());
  const { ctx, page: b } = await newDevice(browser, baseURL);
  await openApp(b, { store, settings: { syncCode: CODE }, sessions: sessionsB });
  await b.evaluate(() => pullSync());
  return { b, ctx, store };
}
const toastText = p => p.evaluate(() => document.getElementById('toast').textContent);

// ── sync-1 ──
test('a ~2 MB payload seals and unseals', async ({ page }) => {
  await openApp(page);
  const ok = await page.evaluate(async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const obj = { pad: 'x'.repeat(2_000_000) + Math.random() };
    const back = await unseal(key, await seal(key, obj));
    return back.pad === obj.pad;
  });
  expect(ok).toBe(true);
});

test('a push with a 200k-byte route succeeds and keeps the route', async ({ page, browser, baseURL }) => {
  const route = Array.from({ length: 6000 }, (_, i) => [37 + i * 1e-5, -122 - i * 1e-5, 10.123, 25.5]);
  expect(JSON.stringify(route).length).toBeGreaterThan(200000);
  const { b, ctx } = await pair(browser, baseURL, page, [sess({ id: 'big1', route })]);
  expect(await page.evaluate(() => syncStatus)).toBe('ok');
  expect(await b.evaluate(() => sessions.find(s => s.id === 'big1').route.length)).toBe(6000);
  await ctx.close();
});

test('a blob over the server cap is not sent and says so', async ({ page }) => {
  const { sync } = await openApp(page, { settings: { syncCode: CODE } });
  await page.waitForFunction(() => syncStatus !== 'busy' && syncStatus !== 'off');   // startup pull done
  sync.calls.length = 0;
  await page.evaluate(() => {   // in memory only, localStorage could not hold it
    const route = Array.from({ length: 90000 }, (_, i) => [37 + Math.random(), -122 - Math.random(), Math.random() * 100, Math.random() * 60]);
    sessions.push({ id: 'huge', startTime: '2026-10-01T18:00:00Z', duration: 30, route });
    return pushSync();
  });
  expect(await page.evaluate(() => syncStatus)).toBe('big');
  expect(sync.calls.filter(c => c.body.action === 'put')).toHaveLength(0);
  await page.evaluate(() => { settings.syncCode = settings.syncCode; navigate('settings'); });
  await expect(page.locator('#sync-status-txt')).toHaveText('Sync data too large — export a backup');
});

// ── sync-2 / sync-3 ──
test('a stale device cannot resurrect a revoked parent link', async ({ page, browser, baseURL }) => {
  const { b, ctx, store } = await pair(browser, baseURL, page);
  await page.evaluate(() => createParentLink());
  await b.evaluate(() => pullSync());
  const old = await b.evaluate(() => settings.parent.token);
  expect(await page.evaluate(() => settings.parent.token)).toBe(old);
  await page.evaluate(() => { window.confirm = () => true; return revokeParentToken(); });
  const fresh = await page.evaluate(() => settings.parent.token);
  expect(fresh).not.toBe(old);
  expect(store.has(old)).toBe(false);
  // B still holds the old link and logs a drive without reloading
  await b.evaluate(s => { sessions.push(s); return pushSync(); }, sess({ id: 'b1' }));
  expect(store.has(old)).toBe(false);
  expect(store.has(fresh)).toBe(true);
  expect(await b.evaluate(() => settings.parent.token)).toBe(fresh);
  await page.evaluate(() => pullSync());
  expect(await page.evaluate(() => settings.parent.token)).toBe(fresh);
  await ctx.close();
});

test('a device whose clock put a revoked link ahead drops it on the server 410 instead of erroring', async ({ page, browser, baseURL }) => {
  const { b, ctx, store } = await pair(browser, baseURL, page);
  await page.evaluate(() => createParentLink());
  await b.evaluate(() => pullSync());
  const old = await b.evaluate(() => settings.parent.token);
  await b.evaluate(() => { settings.parentAt = Date.now() + 864e5; saveSettings(); });   // B's clock runs a day ahead
  await page.evaluate(() => { window.confirm = () => true; return revokeParentToken(); });
  const fresh = await page.evaluate(() => settings.parent.token);
  // B merges first but keeps its "newer" old link, so its parent put hits the revoked id
  expect(await b.evaluate(s => { sessions.push(s); return pushSync(); }, sess({ id: 'b2' }))).toBe(true);
  expect(await b.evaluate(() => [syncStatus, settings.parent, settings.parentAt])).toEqual(['ok', null, 0]);
  expect(store.has(old)).toBe(false);
  // A keeps its fresh link, and B picks it up on its next pull
  await page.evaluate(() => pullSync());
  expect(await page.evaluate(() => settings.parent.token)).toBe(fresh);
  await page.evaluate(() => pushSync());
  await b.evaluate(() => pullSync());
  expect(await b.evaluate(() => settings.parent && settings.parent.token)).toBe(fresh);
  expect(await page.evaluate(() => sessions.some(s => s.id === 'b2'))).toBe(true);
  await ctx.close();
});

test('a device without the link keeps it in the blob and feeds the parent view', async ({ page, browser, baseURL }) => {
  const { b, ctx } = await pair(browser, baseURL, page);
  await page.evaluate(() => createParentLink());   // B has not pulled since
  expect(await b.evaluate(() => settings.parent)).toBeNull();
  await b.evaluate(s => { sessions.push(s); return pushSync(); }, sess({ id: 'bdrive' }));
  const seen = await page.evaluate(async () => {
    const { id, key } = await deriveSyncKeys(settings.syncCode);
    const main = await unseal(key, (await syncCall('get', { id })).blob);
    const p = settings.parent;
    const sum = await unseal(await importParentKey(p.key), (await syncCall('get', { id: p.token })).blob);
    return { link: main.parent && main.parent.token === p.token, ids: sum.sessions.map(s => s.id) };
  });
  expect(seen.link).toBe(true);
  expect(seen.ids).toContain('bdrive');
  await ctx.close();
});

test('disconnecting and rejoining the same code keeps the parent link for every device', async ({ page, browser, baseURL }) => {
  const { b, ctx } = await pair(browser, baseURL, page);
  await page.evaluate(() => createParentLink());
  const token = await page.evaluate(() => settings.parent.token);
  await page.evaluate(async code => { window.confirm = () => true; await disconnectSync(); await connectSyncCode(code); await pushSync(); }, CODE);
  expect(await page.evaluate(() => settings.parent && settings.parent.token)).toBe(token);
  await b.evaluate(() => pullSync());
  expect(await b.evaluate(() => settings.parent && settings.parent.token)).toBe(token);
  await ctx.close();
});

// ── sync-7 ──
test('offline shows Offline, and coming back online syncs', async ({ page }) => {
  const { sync } = await openApp(page, { settings: { syncCode: CODE } });
  await page.evaluate(() => navigate('settings'));
  await page.context().setOffline(true);
  await page.evaluate(() => { syncStatus = 'busy'; return pullSync(); });
  expect(await page.evaluate(() => syncStatus)).toBe('offline');
  await expect(page.locator('#sync-status-txt')).toHaveText('Offline — will sync when back online');
  await page.evaluate(() => pushSync());
  expect(await page.evaluate(() => syncStatus)).toBe('offline');
  await page.context().setOffline(false);
  await page.waitForFunction(() => syncStatus === 'ok');
  expect(sync.calls.some(c => c.body.action === 'put')).toBe(true);
});

// ── sync-8 ──
test('joining with an 8-character code that does not exist does not save it', async ({ page }) => {
  await openApp(page);
  await page.route('**/rtr-sync.php', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"error":"Not found"}' }));
  await page.evaluate(() => connectSyncCode('ABCD-EFGH'));
  expect(await page.evaluate(() => settings.syncCode)).toBe('');
  expect(await toastText(page)).toContain('Code not found');
});

test('a network failure while joining a legacy code leaves no code saved', async ({ page }) => {
  await openApp(page);
  await page.route('**/rtr-sync.php', r => r.abort());
  await page.evaluate(() => connectSyncCode('ABCD-EFGH'));
  expect(await page.evaluate(() => settings.syncCode)).toBe('');
  expect(await toastText(page)).toContain('Could not connect');
});

// ── sync-5 ──
test('offline revoke does not claim success and keeps the old link', async ({ page, browser, baseURL }) => {
  const { ctx } = await pair(browser, baseURL, page);
  await page.evaluate(() => createParentLink());
  const old = await page.evaluate(() => settings.parent.token);
  await page.context().setOffline(true);
  await page.evaluate(() => { window.confirm = () => true; return revokeParentToken(); });
  expect(await page.evaluate(() => settings.parent.token)).toBe(old);
  expect(await toastText(page)).toContain('Could not create parent link');
  await ctx.close();
});

test('revoke says so when the old link could not be removed', async ({ page, browser, baseURL }) => {
  const { ctx } = await pair(browser, baseURL, page);
  await page.evaluate(() => createParentLink());
  await page.route('**/rtr-sync.php', async route => {
    if (JSON.parse(route.request().postData()).action === 'delete') return route.abort();
    return route.fallback();
  });
  await page.evaluate(() => { window.confirm = () => true; return revokeParentToken(); });
  expect(await toastText(page)).toContain('Old link could not be removed');
  await ctx.close();
});

// ── import ──
async function pickFile(page, payload, confirms) {
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); const ok = confirms.shift(); return ok ? d.accept() : d.dismiss(); });
  const chooser = page.waitForEvent('filechooser');
  await page.evaluate(() => { importData(); });
  await (await chooser).setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
  await page.waitForTimeout(300);
  return dialogs;
}
const fileSession = id => ({ id, startTime: '2026-10-01T18:00:00Z', duration: 30 });

test('cancelling the import dialog and then the replace confirm changes nothing', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'keep1' }), sess({ id: 'keep2' })] });
  const dialogs = await pickFile(page, { sessions: [fileSession('new1')] }, [false, false]);
  expect(dialogs).toHaveLength(2);
  expect(dialogs[1]).toContain('Replace ALL data');
  expect(await ids(page)).toEqual(['keep1', 'keep2']);
  expect(await page.evaluate(() => loadTombstones().size)).toBe(0);
});

test('an import file over the size cap is refused before it is read', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'keep1' })] });
  const chooser = page.waitForEvent('filechooser');
  await page.evaluate(() => { window.__read = 0; const t = Blob.prototype.text; Blob.prototype.text = function () { window.__read++; return t.call(this); }; importData(); });
  await (await chooser).setFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(20 * 1024 * 1024 + 1, 32) });
  await expect.poll(() => page.locator('#toast').textContent()).toBe('Import failed: file is too large');
  expect(await page.evaluate(() => window.__read)).toBe(0);
  expect(await ids(page)).toEqual(['keep1']);
});

test('confirming the replace confirm replaces the data', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'keep1' })] });
  await pickFile(page, { sessions: [fileSession('new1')] }, [false, true]);
  expect(await ids(page)).toEqual(['new1']);
});

test('a replace import that cannot be stored changes nothing', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'keep1' })], settings: { driverName: 'Jamie' } });
  const r = await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'rtr_sessions') throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); };
    let err = '';
    try { applyImport({ sessions: [{ id: 'n1', startTime: '2026-10-01T18:00:00Z', duration: 30 }], settings: { driverName: 'Other' } }, 'replace'); }
    catch (e) { err = e.message; }
    Storage.prototype.setItem = orig;
    return { err, ids: sessions.map(s => s.id), name: settings.driverName, tomb: loadTombstones().size,
      storedName: JSON.parse(localStorage.getItem('rtr_settings')).driverName };
  });
  expect(r.err).toContain('nothing was changed');
  expect(r.ids).toEqual(['keep1']);
  expect(r.name).toBe('Jamie');
  expect(r.storedName).toBe('Jamie');
  expect(r.tomb).toBe(0);
});

test('merge import restores a drive edited after its delete', async ({ page }) => {
  await openApp(page, { sessions: [], deleted: [{ id: 'r1', at: '2026-10-02T00:00:00.000Z' }, { id: 'r2', at: '2026-10-02T00:00:00.000Z' }] });
  const r = await page.evaluate(() => {
    const mk = (id, updatedAt) => ({ id, startTime: '2026-10-01T18:00:00Z', duration: 30, ...(updatedAt ? { updatedAt } : {}) });
    applyImport({ sessions: [mk('r1', '2026-10-03T00:00:00.000Z'), mk('r2', '2026-10-01T00:00:00.000Z')] }, 'merge');
    return { ids: sessions.map(s => s.id), tomb: [...loadTombstones().keys()] };
  });
  expect(r.ids).toEqual(['r1']);
  expect(r.tomb).toEqual(['r2']);
});

// ── io-manual-sw-4 ──
test('print with a blocked pop-up toasts instead of throwing', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.open = () => null; printLog(); });
  expect(await toastText(page)).toContain('Allow pop-ups');
});

// ── state-persist-1 ──
test('dl_* data is migrated before the app loads it', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('dl_sessions', JSON.stringify([
      { id: 'old1', startTime: '2026-10-01T18:00:00Z', duration: 40 }, { id: 'old2', startTime: '2026-10-02T18:00:00Z', duration: 20 }]));
    localStorage.setItem('dl_settings', JSON.stringify({ driverName: 'Sam', state: 'TX', onboardingDone: true }));
  });
  await page.reload();
  await page.waitForFunction(() => typeof getTotals === 'function' && typeof sessions !== 'undefined');
  const r = await page.evaluate(() => ({
    ids: sessions.map(s => s.id).sort(), name: settings.driverName, state: settings.state,
    rtr: !!localStorage.getItem('rtr_sessions') && !!localStorage.getItem('rtr_settings'), dl: localStorage.getItem('dl_sessions'),
  }));
  expect(r).toEqual({ ids: ['old1', 'old2'], name: 'Sam', state: 'TX', rtr: true, dl: null });
});
