// Streaks and milestones, local-day boundaries, DST, and the parent view's progress.
const { test, expect, openApp, sess } = require('./helpers');

// Noon (local) on each of the n days ending `endDay` days ago, built in the page's time zone
const dailySessions = (page, n, endDay = 0) => page.evaluate(([n, endDay]) => {
  const out = [];
  for (let i = endDay; i < endDay + n; i++) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(12, 0, 0, 0);
    out.push({ id: 'day' + i, startTime: d.toISOString(), duration: 30, isNight: false, tags: [], route: [], distance: 0 });
  }
  return out;
}, [n, endDay]);

test('streak counts back from today, or from yesterday if nothing yet today', async ({ page }) => {
  await openApp(page);
  const today = await dailySessions(page, 3, 0);
  const fromYesterday = await dailySessions(page, 4, 1);
  const gap = await dailySessions(page, 2, 2);
  expect(await page.evaluate(l => getStreak(l), today)).toBe(3);
  expect(await page.evaluate(l => getStreak(l), fromYesterday)).toBe(4);
  expect(await page.evaluate(l => getStreak(l), gap)).toBe(0);
});

test('streak survives the DST fall-back day', async ({ page }) => {
  // 2026-11-01 has 25 hours in Los Angeles
  await openApp(page, { clock: new Date('2026-11-03T20:00:00.000Z') });
  const list = ['2026-10-31T19:00:00.000Z', '2026-11-01T20:00:00.000Z', '2026-11-02T20:00:00.000Z', '2026-11-03T18:00:00.000Z']
    .map((startTime, i) => ({ id: 'dst' + i, startTime, duration: 20 }));
  expect(await page.evaluate(l => getStreak(l, new Date()), list)).toBe(4);
});

test('an 11:30 pm drive counts on its local day', async ({ page }) => {
  // 23:30 PST on Nov 4 is 07:30 UTC on Nov 5
  await openApp(page, { clock: new Date('2026-11-05T20:00:00.000Z') });
  const list = [{ id: 'late', startTime: '2026-11-05T07:30:00.000Z', duration: 30 }];
  expect(await page.evaluate(l => getStreak(l, new Date()), list)).toBe(1);   // yesterday, not today
});

test('checkMilestones stores earned milestones once', async ({ page }) => {
  await openApp(page, { sessions: [sess({ duration: 60 })] });
  await page.evaluate(() => checkMilestones());
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rtr_milestones') || '[]'));
  expect(stored).toContain('first');
  expect(new Set(stored).size).toBe(stored.length);
});

test('night milestones use the split night minutes', async ({ page }) => {
  await openApp(page, { settings: { state: 'CA' } });
  const earned = await page.evaluate(() => [...computeEarnedMilestones(
    [{ id: 'a', startTime: '2026-11-06T00:00:00Z', duration: 600, nightMin: 300 }], getReqs()).earned]);
  expect(earned).toContain('nightowl');   // 5 night hours
});

test('the parent view earns the 7-day streak', async ({ page }) => {
  await openApp(page);
  const list = await dailySessions(page, 7, 0);
  const earned = await page.evaluate(l => [...computeEarnedMilestones(l, getReqs()).earned], list);
  expect(earned).toContain('streak7');
});

test('freezing rain counts as inclement and as a rain drive', async ({ page }) => {
  await openApp(page, { sessions: [sess({ duration: 60, weather: { code: 66 } }), sess({ duration: 30, weather: { code: 67 } })] });
  const t = await page.evaluate(() => getTotals());
  expect(t.inclementHours).toBeCloseTo(1.5, 6);
  expect(t.rainDrives).toBe(2);
});

test('parent view shows a 0-hour state (Arkansas) as 0, not 50', async ({ page }) => {
  await openApp(page, { settings: { state: 'AR', syncCode: 'ABCDEFGHJKLM' }, sessions: [sess({ duration: 90 })] });
  const link = await page.evaluate(async () => {
    settings.parent = { token: toHex(randomBytes(16)), key: b64u.enc(randomBytes(32)) };
    saveSettings(); await pushSync();
    return `/readytoroll.html?parent=${settings.parent.token}#k=${settings.parent.key}`;
  });
  await page.goto(link);
  await expect(page.locator('#parent-content')).toContainText('1.5');
  await expect(page.locator('#parent-content')).toContainText('/ 0 hrs');
});
