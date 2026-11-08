// Session detail modal: facts, elevation/speed charts, replay, share card, notes, delete, focus restore.
const { test, expect, openApp, sess, readStore: read, deletedIds } = require('./helpers');

const pt = (i, alt, spd) => [34.05 + i * 0.001, -118.24, alt, spd];
const open = (page, id) => page.evaluate(i => showSessionDetail(i), id);
const body = page => page.locator('#modal-body');

test('detail shows the drive facts and escapes user text', async ({ page }) => {
  const s = sess({ id: 'f1', duration: 90, distance: 12.345, supervisor: '<b>Dad</b>', supervisorLicense: 'X<i>1',
    notes: '</textarea><script>window.__x=1</script>', tags: ['rain'], maxSpeed: 41.6, avgSpeed: 23,
    startLocation: { address: '<img src=x onerror=window.__x=2>' }, endLocation: { address: 'Home' },
    weather: { code: 0, temp: 61 } });
  await openApp(page, { sessions: [s] });
  await open(page, 'f1');
  await expect(page.locator('#modal')).toHaveClass(/open/);
  const text = await body(page).innerText();
  expect(text).toContain('12.35 mi');
  expect(text).toContain('42 mph');
  expect(text).toContain('61°F');
  expect(text).toContain('Home');
  expect(text).toContain('<b>Dad</b>');
  expect(text).toContain('(X<i>1)');
  expect(await body(page).locator('b, i, img, script').count()).toBe(0);
  await page.evaluate(() => closeModal());
  await page.evaluate(() => { sessions.push(Object.assign({}, sessions[0], { id: 'f2', maxSpeed: 0, avgSpeed: 0 })); showSessionDetail('f2'); });
  const t2 = await body(page).innerText();
  expect(t2).not.toMatch(/top speed/i);
  expect(t2).not.toMatch(/avg speed/i);
  await page.evaluate(() => closeModal());
  await open(page, 'f1');
  expect(await page.locator('#detail-notes').inputValue()).toBe('</textarea><script>window.__x=1</script>');
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  await expect(page.locator('#modal-title')).not.toHaveText('Session Detail');
});

test('elevation and speed charts render from route data', async ({ page }) => {
  const route = [0, 1, 2, 3, 4].map(i => pt(i, 100 + i * 10, i * 3));
  await openApp(page, { sessions: [sess({ id: 'c1', route })] });
  await open(page, 'c1');
  await expect(body(page).locator('.elevation-wrap')).toHaveCount(2);
  await expect(body(page)).toContainText('Elevation Profile');
  await expect(body(page)).toContainText('Speed Profile');
  const pts = await body(page).locator('svg polyline').first().getAttribute('points');
  expect(pts.split(' ')).toHaveLength(5);
  expect(pts).not.toMatch(/NaN/);
  await expect(body(page)).toContainText('Low: 328ft');
  await expect(body(page)).toContainText('High: 459ft');
  await expect(page.locator('#replay-btn')).toBeVisible();
});

test('charts are absent or safe with 0-1 points, null altitudes and flat data', async ({ page }) => {
  const nullAlt = [0, 1, 2, 3, 4].map(i => pt(i, null, null));
  const fewAlt = [0, 1, 2].map(i => pt(i, 5, 5));
  const flat = [0, 1, 2, 3].map(i => pt(i, 50, 0));
  await openApp(page, { sessions: [sess({ id: 'z0', route: [] }), sess({ id: 'z1', route: [pt(0, 5, 5)] }),
    sess({ id: 'zn', route: nullAlt }), sess({ id: 'zf', route: fewAlt }), sess({ id: 'zl', route: flat }),
    sess({ id: 'zb', route: [[1], 'x', null, [NaN, 2]] }), sess({ id: 'z2', route: [pt(0, 5, 5), pt(1, 5, 5)] })] });
  for (const id of ['z0', 'z1', 'zn', 'zf', 'zb']) {
    await open(page, id);
    await expect(body(page).locator('.elevation-wrap'), id).toHaveCount(0);
    // replay needs more than 2 valid points
    await expect(page.locator('#replay-btn'), id)[['z0', 'z1', 'zb'].includes(id) ? 'toBeHidden' : 'toBeVisible']();
    await page.evaluate(() => closeModal());
  }
  await open(page, 'zl');
  await expect(body(page).locator('.elevation-wrap').first()).toBeVisible();
  const all = await body(page).locator('svg polyline').evaluateAll(els => els.map(e => e.getAttribute('points')));
  for (const p of all) expect(p).not.toMatch(/NaN|Infinity/);
  await open(page, 'z2');
  await expect(page.locator('#replay-btn')).toBeHidden();   // two points is not enough to replay
  await open(page, 'z0');
  await expect(page.locator('#detail-map')).toContainText('No route recorded');
});

// Replace the no-op Leaflet proxy with a recorder so replay steps can be observed.
async function fakeReplayMap(page) {
  await page.evaluate(() => {
    window.__moves = []; window.__pans = 0;
    window.L = { divIcon: () => ({}), marker: () => { const m = { addTo: () => m, setLatLng: ll => window.__moves.push(ll), remove() {} }; return m; } };
    detailMap = { panTo: () => { window.__pans++; }, remove() {} };
  });
}

test('replay walks the route and finishes', async ({ page }) => {
  const route = Array.from({ length: 10 }, (_, i) => pt(i, null, null));
  await openApp(page, { sessions: [sess({ id: 'r1', route })], clock: new Date('2026-10-02T18:00:00.000Z') });
  await open(page, 'r1');
  await page.clock.runFor(200);   // initDetailMap timer
  await fakeReplayMap(page);
  await page.locator('#replay-btn').click();
  await expect(page.locator('#toast')).toContainText('Replaying');
  await page.clock.runFor(80 * 20);
  const r = await page.evaluate(() => ({ moves: window.__moves, pans: window.__pans }));
  expect(r.moves).toHaveLength(9);   // points 1..9, then it stops
  expect(r.moves[r.moves.length - 1]).toEqual([route[9][0], route[9][1]]);
  expect(r.pans).toBe(9);
  await page.clock.runFor(2000);
  expect((await page.evaluate(() => window.__moves)).length).toBe(9);   // timer cleared, no more moves
});

test('a long route is replayed in at most about 60 steps', async ({ page }) => {
  const route = Array.from({ length: 130 }, (_, i) => pt(i, null, null));
  await openApp(page, { sessions: [sess({ id: 'r3', route })], clock: new Date('2026-10-02T18:00:00.000Z') });
  await open(page, 'r3');
  await page.clock.runFor(200);
  await fakeReplayMap(page);
  await page.evaluate(() => startReplay());
  await page.clock.runFor(80 * 140);
  const moves = await page.evaluate(() => window.__moves);
  expect(moves).toHaveLength(65);   // step = floor(130/60) = 2: points 1,3,...,129
  expect(moves[1]).toEqual([route[3][0], route[3][1]]);
});

test('closing the modal during replay stops it', async ({ page }) => {
  const route = Array.from({ length: 10 }, (_, i) => pt(i, null, null));
  await openApp(page, { sessions: [sess({ id: 'r2', route })], clock: new Date('2026-10-02T18:00:00.000Z') });
  await open(page, 'r2');
  await page.clock.runFor(200);
  await fakeReplayMap(page);
  await page.evaluate(() => startReplay());
  await page.clock.runFor(160);
  await page.evaluate(() => closeModal());
  const n = await page.evaluate(() => window.__moves.length);
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.__moves.length)).toBe(n);
  await expect(page.locator('#modal')).not.toHaveClass(/open/);
});

async function stubShare(page, mode) {
  await page.evaluate(m => {
    window.__shares = [];
    const def = (k, v) => Object.defineProperty(navigator, k, { configurable: true, value: v });
    if (m === 'none') { def('share', undefined); def('canShare', undefined); return; }
    def('canShare', () => true);
    def('share', async data => {
      window.__shares.push(data);
      if (m === 'abort') throw new DOMException('cancelled', 'AbortError');
      window.__file = data.files && data.files[0];
    });
  }, mode);
}

test('share hands a PNG drive card to navigator.share', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 's1', duration: 75, distance: 3 })] });
  await open(page, 's1');
  await stubShare(page, 'ok');
  await page.evaluate(() => shareSession());
  await page.waitForFunction(() => window.__shares.length === 1);
  const r = await page.evaluate(async () => {
    const f = window.__file, b = new Uint8Array(await f.arrayBuffer());
    return { name: f.name, type: f.type, sig: Array.from(b.slice(0, 4)), size: b.length, text: window.__shares[0].text };
  });
  expect(r.type).toBe('image/png');
  expect(r.name).toMatch(/^drive-.*\.png$/);
  expect(r.sig).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(r.size).toBeGreaterThan(500);
  expect(r.text).toContain('1h 15m');
});

test('cancelling the share sheet does nothing else', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 's2' })] });
  await open(page, 's2');
  await stubShare(page, 'abort');
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.evaluate(() => shareSession());
  await page.waitForFunction(() => window.__shares.length === 1);
  await page.waitForTimeout(300);
  expect(downloaded).toBe(false);   // AbortError must not fall through to a second share or a download
  expect(await page.evaluate(() => window.__shares.length)).toBe(1);
  await expect(page.locator('#toast')).not.toContainText('saved to downloads');
});

test('share falls back to downloading the PNG when sharing is unavailable', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 's3' })] });
  await open(page, 's3');
  await stubShare(page, 'none');
  await page.evaluate(() => {   // keep the blob: the app revokes its URL straight after click()
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = b => { window.__blob = b; return orig(b); };
  });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => shareSession())]);
  expect(dl.suggestedFilename()).toMatch(/^drive-.*\.png$/);
  const blob = await page.evaluate(async () => ({ type: window.__blob.type, sig: Array.from(new Uint8Array(await window.__blob.arrayBuffer()).slice(0, 4)) }));
  expect(blob.type).toBe('image/png');
  expect(blob.sig).toEqual([0x89, 0x50, 0x4e, 0x47]);
  await expect(page.locator('#toast')).toContainText('saved to downloads');
});

test('saving notes persists them, stamps updatedAt and closes the modal', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'n1', notes: 'old' })], clock: new Date('2026-10-05T12:00:00.000Z') });
  await open(page, 'n1');
  await page.locator('#detail-notes').fill('merged onto the freeway "ok"');
  await page.locator('#modal-save-btn').click();
  await expect(page.locator('#modal')).not.toHaveClass(/open/);
  await expect(page.locator('#toast')).toContainText('Notes saved');
  const stored = (await read(page, 'rtr_sessions'))[0];
  expect(stored.notes).toBe('merged onto the freeway "ok"');
  const dt = new Date(stored.updatedAt).getTime() - Date.parse('2026-10-05T12:00:00.000Z');
  expect(dt).toBeGreaterThanOrEqual(0);   // fake clock keeps ticking a little after install
  expect(dt).toBeLessThan(10000);
  await open(page, 'n1');
  expect(await page.locator('#detail-notes').inputValue()).toBe('merged onto the freeway "ok"');
});

test('deleting from the modal removes the drive, tombstones it and offers undo', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'x1' }), sess({ id: 'x2' })] });
  await open(page, 'x1');
  await page.locator('#modal-del-btn').click();
  await expect(page.locator('#modal')).not.toHaveClass(/open/);
  expect((await read(page, 'rtr_sessions')).map(s => s.id)).toEqual(['x2']);
  expect(deletedIds(await read(page, 'rtr_deleted'))).toContain('x1');
  await expect(page.locator('#toast')).toContainText('Session deleted');
  await page.locator('#toast button', { hasText: 'Undo' }).click();
  expect((await read(page, 'rtr_sessions')).map(s => s.id).sort()).toEqual(['x1', 'x2']);
  expect(deletedIds(await read(page, 'rtr_deleted'))).not.toContain('x1');
});

test('closing the modal returns focus to the element that opened it', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'p1' })] });
  await page.evaluate(() => {
    const b = document.createElement('button'); b.id = 'opener'; b.textContent = 'open'; document.body.appendChild(b);
    b.onclick = () => showSessionDetail('p1'); b.focus();
  });
  await page.locator('#opener').press('Enter');
  await expect(page.locator('#modal')).toHaveClass(/open/);
  await expect(page.locator('#modal .modal-sheet')).toBeFocused();
  await page.locator('#modal .close-btn').click();
  await expect(page.locator('#opener')).toBeFocused();
  expect(await page.evaluate(() => currentDetailSession)).toBeNull();
});

test('an unknown id opens nothing and share with no drive is a no-op', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'k1' })] });
  await open(page, 'nope');
  await expect(page.locator('#modal')).not.toHaveClass(/open/);
  await page.evaluate(() => shareSession());
});
