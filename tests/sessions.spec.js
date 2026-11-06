// Editing, deleting (rtr_deleted) and recording GPS drives.
const { test, expect, openApp, sess } = require('./helpers');

const read = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
const deletedIds = list => (list || []).map(d => (typeof d === 'string' ? d : d.id));

test('editing a drive keeps its id and updates the totals', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'e1', startTime: '2026-10-01T19:00:00.000Z', duration: 60 })] });
  const s = await page.evaluate(() => {
    openManualModal('e1');
    document.getElementById('m-end').value = '14:30';   // 12:00–14:30 PDT
    saveManualDrive();
    return { list: sessions.map(x => x.id), s: sessions[0], hrs: getTotals().totalHours };
  });
  expect(s.list).toEqual(['e1']);
  expect(s.s.duration).toBe(150);
  expect(s.hrs).toBeCloseTo(2.5, 6);
  expect(typeof s.s.updatedAt).toBe('string');
  const stored = await read(page, 'rtr_sessions');
  expect(stored[0].duration).toBe(150);
});

test('delete writes rtr_deleted and undo restores the drive', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'd1' }), sess({ id: 'd2' })] });
  await page.evaluate(() => deleteSession('d1'));
  expect(await page.evaluate(() => sessions.map(s => s.id))).toEqual(['d2']);
  expect(deletedIds(await read(page, 'rtr_deleted'))).toContain('d1');
  await page.evaluate(() => undoDelete());
  expect((await page.evaluate(() => sessions.map(s => s.id))).sort()).toEqual(['d1', 'd2']);
  expect(deletedIds(await read(page, 'rtr_deleted'))).not.toContain('d1');
  expect((await read(page, 'rtr_sessions')).length).toBe(2);
});

test('legacy rtr_deleted (plain id strings) is still honoured', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'keep' })], deleted: ['gone'] });
  const ids = await page.evaluate(() => { mergeSyncData({ sessions: [{ ...sessions[0], id: 'gone' }] }); return sessions.map(s => s.id); });
  expect(ids).toEqual(['keep']);
});

// Drive mode: fake GPS + fake clock
async function drive(page, minutes, { from = [34.05, -118.24], step = 0.0005 } = {}) {
  for (let i = 0; i < minutes; i++) {
    await page.evaluate(([lat, lng]) => window.__geo.emit(lat, lng, 12), [from[0] + i * step, from[1]]);
    await page.clock.runFor(60000);
  }
}

async function startDriving(page) {
  await page.evaluate(() => startDrive());
  await page.waitForFunction(() => window.__geo.watchers.size > 0);
  await page.evaluate(() => window.__geo.emit(34.05, -118.24, 0));   // first fix
  await page.waitForFunction(() => activeSession && activeSession.route.length > 0);
}

test('auto-stop ends the drive when the car stopped, not ten minutes later', async ({ page }) => {
  await openApp(page, { clock: new Date('2026-10-01T18:00:00.000Z') });
  await startDriving(page);
  await drive(page, 20);
  await page.clock.runFor(13 * 60000);   // parked: auto-stop fires after 10 idle minutes
  await page.waitForFunction(() => !activeSession && sessions.length === 1);
  const s = await page.evaluate(() => sessions[0]);
  expect(s.duration).toBeGreaterThan(18);
  expect(s.duration).toBeLessThan(22);
});

test('a drive with no GPS fix is not auto-stopped', async ({ page }) => {
  await openApp(page, { clock: new Date('2026-10-01T18:00:00.000Z') });
  await page.evaluate(() => startDrive());
  await page.clock.runFor(15 * 60000);
  expect(await page.evaluate(() => !!activeSession && sessions.length === 0)).toBe(true);
});

test('stopping twice saves one drive', async ({ page }) => {
  await openApp(page, { clock: new Date('2026-10-01T18:00:00.000Z') });
  await startDriving(page);
  await drive(page, 5);
  await page.evaluate(() => Promise.all([stopDrive(), stopDrive()]));
  expect(await page.evaluate(() => sessions.length)).toBe(1);
});

test('a finished GPS drive is split at sunset, stored lean, and pushed to sync', async ({ page }) => {
  // 16:30 PST on 2026-11-05; LA sunset is about 16:57
  const { sync } = await openApp(page, { clock: new Date('2026-11-06T00:30:00.000Z'), settings: { syncCode: 'ABCDEFGHJKLM' } });
  await startDriving(page);
  await drive(page, 60);
  await page.evaluate(() => stopDrive());
  await page.clock.runFor(6000);   // sync debounce
  await page.waitForFunction(() => sessions.length === 1 && syncStatus !== 'busy');
  const s = await page.evaluate(() => sessions[0]);
  expect(s.duration).toBeGreaterThan(59);
  expect(s.duration).toBeLessThan(62);
  expect(s.nightMin).toBeGreaterThan(25);
  expect(s.nightMin).toBeLessThan(40);
  for (const k of ['speedSamples', 'lastSpeed', 'lastMovedAt']) expect(s).not.toHaveProperty(k);
  expect(sync.calls.some(c => c.body.action === 'put')).toBe(true);
});
