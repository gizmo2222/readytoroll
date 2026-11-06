// Hour totals and the day/night split, across sunset, midnight, DST and time zones.
const { test, expect, openApp, sess, newDevice } = require('./helpers');

const LA = [34.05, -118.24];
// 2026-11-05 16:00–18:00 PST. Sunset in Los Angeles is about 16:57, so ~63 min are night.
const ACROSS_SUNSET = { startTime: '2026-11-06T00:00:00.000Z', duration: 120, route: [[...LA, 0, 0]] };

test('totals add up every drive and use the stored night minutes', async ({ page }) => {
  await openApp(page, { sessions: [
    sess({ duration: 90 }), sess({ duration: 30, isNight: true }), sess({ duration: 45.5, nightMin: 20 }),
  ] });
  const t = await page.evaluate(() => getTotals());
  expect(t.totalHours).toBeCloseTo((90 + 30 + 45.5) / 60, 6);
  expect(t.nightHours).toBeCloseTo((30 + 20) / 60, 6);   // legacy isNight counts whole; nightMin counts as stored
  expect(t.sessions).toBe(3);
});

test('a drive across sunset is split into day and night minutes', async ({ page }) => {
  await openApp(page);
  const n = await page.evaluate(s => nightMinutes(new Date(s.startTime).getTime(),
    new Date(s.startTime).getTime() + s.duration * 60000, 34.05, -118.24), ACROSS_SUNSET);
  expect(n).toBeGreaterThan(55);
  expect(n).toBeLessThan(70);
});

test('the night split is the same whatever the device time zone', async ({ browser, baseURL }) => {
  const results = [];
  for (const timezoneId of ['America/Los_Angeles', 'America/New_York', 'Asia/Tokyo', 'UTC']) {
    const { ctx, page } = await newDevice(browser, baseURL, { timezoneId });
    await openApp(page);
    results.push(await page.evaluate(s => computeTotals([applyNightSplit(s)]).nightHours, sess(ACROSS_SUNSET)));
    await ctx.close();
  }
  for (const r of results) expect(r).toBeCloseTo(results[0], 6);
  expect(results[0]).toBeGreaterThan(0.9);
  expect(results[0]).toBeLessThan(1.2);
});

test('polar night is all night and midnight sun is all day', async ({ page }) => {
  await openApp(page);
  const [dec, jun] = await page.evaluate(() => [
    nightMinutes(Date.parse('2026-12-15T21:00:00Z'), Date.parse('2026-12-15T23:00:00Z'), 71.29, -156.79),
    nightMinutes(Date.parse('2026-06-21T08:00:00Z'), Date.parse('2026-06-21T10:00:00Z'), 71.29, -156.79),
  ]);
  expect(dec).toBeCloseTo(120, 0);
  expect(jun).toBeCloseTo(0, 0);
});

async function addManual(page, f) {
  return page.evaluate(f => {
    openManualModal();
    const set = (id, v) => { document.getElementById(id).value = v ?? ''; };
    set('m-date', f.date); set('m-start', f.start); set('m-end', f.end);
    set('m-dur-h', f.h); set('m-dur-m', f.m); set('m-daynight', f.dn || 'auto');
    saveManualDrive();
    return sessions[sessions.length - 1];
  }, f);
}

test('manual drive past midnight counts real minutes and is all night', async ({ page }) => {
  await openApp(page);
  const s = await addManual(page, { date: '2026-11-05', start: '23:30', end: '00:30' });
  expect(s.duration).toBe(60);
  expect(s.nightMin).toBeCloseTo(60, 0);
  expect(s.isNight).toBe(true);
});

test('manual drive across the spring-forward DST gap counts real minutes', async ({ page }) => {
  await openApp(page);
  // 2026-03-08 in Los Angeles: 02:00 jumps to 03:00, so 01:30–03:30 is one real hour
  const s = await addManual(page, { date: '2026-03-08', start: '01:30', end: '03:30' });
  expect(s.duration).toBe(60);
});

test('manual drive across the fall-back DST repeat counts real minutes', async ({ page }) => {
  await openApp(page);
  // 2026-11-01 in Los Angeles: 01:00–02:00 happens twice, so 00:30–02:30 is three real hours
  const s = await addManual(page, { date: '2026-11-01', start: '00:30', end: '02:30' });
  expect(s.duration).toBe(180);
});

test('manual day/night choice overrides the sun; auto uses the sun', async ({ page }) => {
  await openApp(page);
  const auto = await addManual(page, { date: '2026-11-05', start: '16:00', end: '18:00' });
  expect(auto.nightMin).toBeGreaterThan(50);
  expect(auto.nightMin).toBeLessThan(75);
  const day = await addManual(page, { date: '2026-11-05', start: '21:00', end: '22:00', dn: 'day' });
  expect(day.nightMin).toBe(0);
  expect(day.isNight).toBe(false);
  const night = await addManual(page, { date: '2026-07-01', start: '12:00', end: '13:00', dn: 'night' });
  expect(night.nightMin).toBe(60);
  expect(night.isNight).toBe(true);
});

test('editing a sun-split drive keeps auto, editing a legacy drive keeps its choice', async ({ page }) => {
  const legacy = sess({ id: 'legacy1', isNight: true, startTime: '2026-07-01T19:00:00.000Z', duration: 60 });
  await openApp(page, { sessions: [legacy] });
  const dn = await page.evaluate(() => { openManualModal('legacy1'); return document.getElementById('m-daynight').value; });
  expect(dn).toBe('night');
  const s = await page.evaluate(() => { saveManualDrive(); return sessions.find(x => x.id === 'legacy1'); });
  expect(s.nightMin).toBe(60);
});

test('quick add after dark in November counts as night', async ({ page }) => {
  // 19:00 PST: the old rule (night = 8 pm–6 am) called the last hour daytime
  await openApp(page, { clock: new Date('2026-11-06T03:00:00.000Z') });
  const s = await page.evaluate(() => { openQuickModal(); saveQuickDrive(); return sessions[sessions.length - 1]; });
  expect(s.duration).toBe(60);
  expect(s.nightMin).toBeCloseTo(60, 0);
  expect(s.isNight).toBe(true);
});

test('weekly buckets start on the local Sunday', async ({ page }) => {
  await openApp(page, { sessions: [
    sess({ startTime: '2026-11-08T07:30:00.000Z', duration: 60 }),   // Sat 23:30 PST -> week of Nov 1
    sess({ startTime: '2026-11-08T09:00:00.000Z', duration: 30 }),   // Sun 01:00 PST -> week of Nov 8
  ] });
  const best = await page.evaluate(() => getTotals().bestWeekHours);
  expect(best).toBeCloseTo(1, 6);
});
