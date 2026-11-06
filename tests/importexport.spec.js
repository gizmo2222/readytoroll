// Export/import round trips, validation, and which secrets an export may carry.
const { test, expect, openApp, sess, newDevice } = require('./helpers');

const seedSessions = () => [
  sess({ id: 'x1', duration: 75, nightMin: 30, notes: 'n1', tags: ['highway'] }),
  sess({ id: 'x2', duration: 45, isNight: true, weather: { code: 61 } }),
];

test('export then import (replace) on another device gives the same totals', async ({ page, browser, baseURL }) => {
  await openApp(page, { sessions: seedSessions(), skills: { night: 3 } });
  const payload = await page.evaluate(() => JSON.parse(JSON.stringify(exportPayload())));
  const before = await page.evaluate(() => getTotals());
  const { ctx, page: b } = await newDevice(browser, baseURL);
  await openApp(b, { sessions: [sess({ id: 'other' })] });
  const after = await b.evaluate(p => { applyImport(p, 'replace'); return { t: getTotals(), ids: sessions.map(s => s.id).sort() }; }, payload);
  expect(after.ids).toEqual(['x1', 'x2']);
  for (const k of ['totalHours', 'nightHours', 'inclementHours', 'sessions']) expect(after.t[k]).toBeCloseTo(before[k], 6);
  const stored = await b.evaluate(() => JSON.parse(localStorage.getItem('rtr_sessions')).length);
  expect(stored).toBe(2);
  await ctx.close();
});

test('exports never carry the sync code or the parent link key', async ({ page }) => {
  await openApp(page, { sessions: seedSessions(), settings: {
    syncCode: 'ABCDEFGHJKLM', parentToken: 'f'.repeat(32), parent: { token: 'a'.repeat(32), key: 'SECRETPARENTKEY' } } });
  const text = await page.evaluate(() => JSON.stringify(exportPayload()));
  for (const secret of ['ABCDEFGHJKLM', 'SECRETPARENTKEY', 'a'.repeat(32), 'f'.repeat(32)]) expect(text).not.toContain(secret);
});

test('import keeps this device\'s sync settings on replace', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGHJKLM', driverName: 'Old' } });
  const s = await page.evaluate(() => {
    applyImport({ settings: { driverName: 'New', syncCode: 'ZZZZZZZZZZZZ', evil: 1 }, sessions: [] }, 'replace');
    return settings;
  });
  expect(s.syncCode).toBe('ABCDEFGHJKLM');
  expect(s.driverName).toBe('New');
  expect(s).not.toHaveProperty('evil');
});

test('import coerces numeric strings and drops sessions it cannot read', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const res = applyImport({ sessions: [
      { id: 'ok1', startTime: '2026-10-01T18:00:00Z', duration: '45' },
      { id: 'bad1', startTime: 'not a date', duration: 30 },
      { id: 'bad2', startTime: '2026-10-01T18:00:00Z', duration: -5 },
      { startTime: '2026-10-01T18:00:00Z', duration: 30 },
      'junk',
    ] }, 'merge');
    return { res, total: getTotals().totalHours, s: sessions };
  });
  expect(r.s.map(s => s.id)).toEqual(['ok1']);
  expect(r.s[0].duration).toBe(45);
  expect(r.total).toBeCloseTo(0.75, 6);
  expect(r.res).toEqual({ added: 1, skipped: 4 });
});

test('merge import does not bring back a deleted drive', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'm1' })], deleted: [{ id: 'm2', at: '2026-10-02T00:00:00Z' }] });
  const ids = await page.evaluate(() => {
    applyImport({ sessions: [sess2('m2'), sess2('m3')] }, 'merge');
    function sess2(id) { return { id, startTime: '2026-10-01T18:00:00Z', duration: 30 }; }
    return sessions.map(s => s.id).sort();
  });
  expect(ids).toEqual(['m1', 'm3']);
});

test('CSV export lists night minutes for split drives', async ({ page }) => {
  await openApp(page, { sessions: [sess({ id: 'c1', duration: 120, nightMin: 63 })] });
  const csv = await page.evaluate(() => { let out = ''; window.download = (name, text) => { out = text; }; exportCSV(); return out; });
  // Every field is quoted, and dates contain commas, so split on the quotes
  const fields = line => line.slice(1, -1).split('","');
  const [head, row] = csv.trim().split('\n').map(fields);
  const i = head.findIndex(c => /night.*min/i.test(c));
  expect(i).toBeGreaterThan(-1);
  expect(row[i]).toBe('63');
});
