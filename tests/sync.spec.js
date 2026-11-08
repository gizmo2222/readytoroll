// Encrypted sync: nothing readable reaches the server, the parent summary is an allow-list,
// and two devices merge edits and deletes instead of overwriting each other.
const { test, expect, openApp, sess, newDevice, pair, ids } = require('./helpers');

const CODE = 'ABCDEFGHJKLM';
const MARK = {
  note: 'SECRET_NOTE_7731', supervisor: 'Supervisor Quimby', license: 'D1234567',
  address: '742 Evergreen Terrace', lat: 37.123456, driver: 'Jamie Markerson',
};
const secretSession = () => sess({
  id: 'sec1', duration: 50, notes: MARK.note, supervisor: MARK.supervisor, supervisorLicense: MARK.license,
  startLocation: { lat: MARK.lat, lng: -122.654321, city: 'Springfield', address: MARK.address },
  endLocation: { lat: MARK.lat, lng: -122.654321, city: 'Springfield', address: MARK.address },
  route: [[MARK.lat, -122.654321, 10, 20]], weather: { code: 61, temp: 55 },
});

async function withParent(page) {
  return page.evaluate(async () => {
    settings.parent = { token: toHex(randomBytes(16)), key: b64u.enc(randomBytes(32)) };
    saveSettings(); await pushSync();
    return settings.parent;
  });
}

test('no request body contains drive data, the sync code or a key', async ({ page }) => {
  const { sync } = await openApp(page, { settings: { syncCode: CODE, driverName: MARK.driver }, sessions: [secretSession()] });
  const parent = await withParent(page);
  expect(sync.calls.filter(c => c.body.action === 'put').length).toBeGreaterThanOrEqual(2);
  const sent = sync.calls.map(c => c.raw).join('\n');
  for (const m of [MARK.note, MARK.supervisor, MARK.license, MARK.address, String(MARK.lat), MARK.driver,
    'Springfield', CODE, parent.key, 'sec1', 'startTime']) expect(sent).not.toContain(m);
  for (const c of sync.calls.filter(c => c.body.action === 'put')) {
    expect(Object.keys(JSON.parse(c.body.blob)).sort()).toEqual(['ct', 'iv', 'v']);
    expect(Object.keys(c.body).sort()).toEqual(['action', 'blob', 'id']);
    expect(c.body.id).toMatch(/^(?:[0-9a-f]{32}|[0-9a-f]{64})$/);
  }
});

test('the parent summary holds only progress fields', async ({ page }) => {
  await openApp(page, { settings: { syncCode: CODE, driverName: MARK.driver }, sessions: [secretSession()] });
  const parent = await withParent(page);
  const data = await page.evaluate(async p => {
    const d = await syncCall('get', { id: p.token });
    return unseal(await importParentKey(p.key), d.blob);
  }, parent);
  expect(Object.keys(data).sort()).toEqual(['driverName', 'reqs', 'sessions', 'v']);
  const allowed = new Set(['id', 'startTime', 'duration', 'isNight', 'nightMin', 'distance', 'tags', 'weather']);
  for (const s of data.sessions) {
    for (const k of Object.keys(s)) expect(allowed.has(k), `unexpected field ${k}`).toBe(true);
    if (s.weather) expect(Object.keys(s.weather)).toEqual(['code']);
  }
  const text = JSON.stringify(data);
  for (const m of [MARK.note, MARK.supervisor, MARK.license, MARK.address, String(MARK.lat), 'Springfield', 'route'])
    expect(text).not.toContain(m);
});


test('a push merges with the server first instead of overwriting', async ({ page, browser, baseURL }) => {
  const { b, ctx } = await pair(browser, baseURL, page, [sess({ id: 's1' })]);
  await page.evaluate(s => { sessions.push(s); return pushSync(); }, sess({ id: 'a2' }));
  await b.evaluate(s => { sessions.push(s); return pushSync(); }, sess({ id: 'b3' }));   // B never pulled a2
  await page.evaluate(() => pullSync());
  await b.evaluate(() => pullSync());
  expect(await ids(page)).toEqual(['a2', 'b3', 's1']);
  expect(await ids(b)).toEqual(['a2', 'b3', 's1']);
  await ctx.close();
});

test('a delete on one device removes the drive on the other', async ({ page, browser, baseURL }) => {
  const { b, ctx } = await pair(browser, baseURL, page, [sess({ id: 's1' }), sess({ id: 's2' })]);
  expect(await ids(b)).toEqual(['s1', 's2']);
  await page.evaluate(() => { deleteSession('s1'); return pushSync(); });
  await b.evaluate(() => pullSync());
  expect(await ids(b)).toEqual(['s2']);
  await b.evaluate(() => pushSync());   // B pushing its old view must not resurrect it
  await page.evaluate(() => pullSync());
  expect(await ids(page)).toEqual(['s2']);
  await ctx.close();
});

test('an edit on one device reaches the other', async ({ page, browser, baseURL }) => {
  const { b, ctx } = await pair(browser, baseURL, page, [sess({ id: 's1', startTime: '2026-10-01T19:00:00.000Z', duration: 30 })]);
  await page.evaluate(() => {
    openManualModal('s1'); document.getElementById('m-end').value = '13:00'; saveManualDrive(); return pushSync();
  });
  await b.evaluate(() => pullSync());
  expect(await b.evaluate(() => sessions.find(s => s.id === 's1').duration)).toBe(60);
  expect(await b.evaluate(() => getTotals().totalHours)).toBeCloseTo(1, 6);
  await ctx.close();
});

test('undo after a synced delete brings the drive back everywhere', async ({ page, browser, baseURL }) => {
  const { b, ctx } = await pair(browser, baseURL, page, [sess({ id: 's1' }), sess({ id: 's2' })]);
  await page.evaluate(() => { deleteSession('s1'); return pushSync(); });
  await b.evaluate(() => pullSync());
  expect(await ids(b)).toEqual(['s2']);
  await page.evaluate(() => { undoDelete(); return pushSync(); });
  await b.evaluate(() => pullSync());
  expect(await ids(b)).toEqual(['s1', 's2']);
  await ctx.close();
});
