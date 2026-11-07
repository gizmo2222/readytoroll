// Hostile or malformed data from a backup file, a synced device or storage: it is dropped or
// coerced at the boundary, and whatever still reaches the page is rendered as text, not markup.
const { test, expect, openApp, sess } = require('./helpers');

const IMG = '<img src=x onerror="window.__pwned=1">';
const html = (page, sel) => page.evaluate(s => document.querySelector(s).innerHTML, sel);
const views = ['home', 'dashboard', 'history', 'settings'];

test('imported session with hostile tags, id, speed and route is cleaned and renders safely', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(img => {
    const res = applyImport({ sessions: [
      { id: 'evil1', startTime: '2026-10-01T18:00:00Z', duration: 30, tags: [img, 'highway', 7], maxSpeed: '45', avgSpeed: {},
        route: [null, 'abc', [1], [34.05, -118.24, 'x', null], { lat: 34, lng: -118 }], weather: { code: 0, temp: img, windSpeed: '5' },
        supervisor: 42, notes: 'n'.repeat(5000) },
      { id: '" onclick="alert(1)', startTime: '2026-10-01T18:00:00Z', duration: 30 },
      { id: '<script>', startTime: '2026-10-01T18:00:00Z', duration: 30 },
    ] }, 'merge');
    return { res, s: sessions.find(x => x.id === 'evil1'), ids: sessions.map(x => x.id) };
  }, IMG);
  expect(r.res).toEqual({ added: 1, skipped: 2 });
  expect(r.ids).toEqual(['evil1']);
  expect(r.s.tags).toEqual(['highway']);
  expect(r.s.maxSpeed).toBe(45);
  expect(r.s).not.toHaveProperty('avgSpeed');
  expect(r.s.route).toEqual([[34.05, -118.24, null, null]]);
  expect(r.s.weather).toEqual({ code: 0, windSpeed: 5 });
  expect(r.s.supervisor).toBe('');
  expect(r.s.notes).toHaveLength(2000);

  for (const v of views) {
    await page.evaluate(v => navigate(v), v);
    expect(await html(page, '#main')).not.toContain('<img');
  }
  // Detail modal, quick add and manual entry all run without throwing (uncaught errors fail the test)
  await page.evaluate(() => { navigate('history'); showSessionDetail('evil1'); });
  await page.waitForTimeout(200);
  expect(await html(page, '#modal-body')).toContain('45 mph');
  expect(await html(page, '#modal-body')).not.toContain('<img');
  await page.evaluate(() => { closeModal(); openQuickModal(); });
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('hostile session fields already in storage render as text everywhere', async ({ page }) => {
  const rawId = 'raw" onclick="alert(1)';
  await openApp(page, { sessions: [sess({ id: rawId, tags: [IMG], weather: { code: 0, temp: '<b>70</b>', windSpeed: '<i>5</i>' }, route: 'abc', maxSpeed: '45' })] });
  for (const v of ['home', 'dashboard', 'history']) {
    await page.evaluate(v => navigate(v), v);
    const h = await html(page, '#main');
    expect(h).not.toContain('<img');
    expect(h).not.toContain('<b>');
  }
  // The attribute is escaped, so the row still carries the whole id
  expect(await page.evaluate(() => document.querySelector('#history-content .session-row').dataset.id)).toBe(rawId);
  await page.evaluate(id => showSessionDetail(id), rawId);
  await page.waitForTimeout(200);
  const body = await html(page, '#modal-body');
  expect(body).not.toContain('<img');
  expect(body).not.toContain('<i>');
  expect(body).toContain('&lt;img');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  // sessionLatLng skips the junk route instead of throwing
  expect(await page.evaluate(id => sessionLatLng(sessions.find(s => s.id === id)), rawId)).toBeNull();
});

test('imported settings of the wrong type or range are dropped and never show NaN', async ({ page }) => {
  await openApp(page, { sessions: [sess({ duration: 60 })] });
  const s = await page.evaluate(img => {
    applyImport({ sessions: [], settings: {
      goalDate: 'soon', customTotal: 'fifty', customNight: -3, state: 'XX', driverName: {}, carNickname: ['x'],
      carHue: '0deg)" onmouseover="alert(1)', accentHue: 'red', fontSize: 'huge', vibeTheme: '<x>', carEmoji: img, onboardingDone: 'yes',
    } }, 'replace');
    return { settings, reqs: getReqs() };
  }, IMG);
  expect(s.settings.goalDate).toBe('');
  expect(s.settings.customTotal).toBeNull();
  expect(s.settings.customNight).toBeNull();
  expect(s.settings.state).toBe('CA');
  expect(s.settings.driverName).toBe('');
  expect(s.settings.carNickname).toBe('');
  expect(s.settings.carHue).toBe(0);
  expect(s.settings.accentHue).toBe(217);
  expect(s.settings.fontSize).toBe('medium');
  expect(s.settings.vibeTheme).toBe('default');
  expect(s.settings.carEmoji).toBe('🚗');
  expect(s.settings.onboardingDone).toBe(true);
  expect(s.reqs.total).toBe(50);
  for (const v of views) {
    await page.evaluate(v => navigate(v), v);
    const h = await html(page, '#main');
    expect(h).not.toContain('NaN');
    expect(h).not.toContain('Invalid Date');
    expect(h).not.toContain('<img');
  }
  // Valid values still come through, and getReqs backstops a bad stored value
  const ok = await page.evaluate(() => {
    applyImport({ sessions: [], settings: { goalDate: '2027-06-01', customTotal: '40', state: 'OR', driverName: 'Sam' } }, 'replace');
    const imported = { ...settings }, r1 = getReqs();
    settings.customTotal = 'abc'; settings.goalDate = 'soon';
    const r2 = getReqs();
    navigate('dashboard');
    return { settings: imported, r1, r2, dash: document.getElementById('dash-content').innerHTML };
  });
  expect(ok.settings.goalDate).toBe('2027-06-01');
  expect(ok.settings.state).toBe('OR');
  expect(ok.r1.total).toBe(40);
  expect(ok.r2.total).toBe(50);
  expect(ok.dash).not.toContain('NaN');
  expect(ok.dash).not.toContain('Invalid Date');
});

test('driver name and car nickname with quotes and tags render escaped in Settings, Home and Progress', async ({ page }) => {
  const name = 'Alex "Ace" <b>Smith</b>';
  const nick = '"The Beast" <i>x</i>';
  await openApp(page, { settings: { driverName: name, carNickname: nick, carHue: 'bad' } });
  await page.evaluate(() => navigate('settings'));
  expect(await page.inputValue('#s-name')).toBe(name);
  expect(await page.inputValue('#s-car-nick')).toBe(nick);
  expect(await page.evaluate(() => document.querySelectorAll('#settings-content b, #settings-content i').length)).toBe(0);
  await page.evaluate(() => navigate('dashboard'));
  await expect(page.locator('#dash-content .hero-right .sub')).toHaveText(name + "'s Log");
  expect(await page.evaluate(() => document.querySelectorAll('#dash-content b').length)).toBe(0);
  await page.evaluate(() => navigate('home'));
  await expect(page.locator('#home-content .home-car-nick')).toHaveText(nick);
  expect(await page.evaluate(() => document.querySelectorAll('#home-content i').length)).toBe(0);
  expect(await html(page, '#home-content')).not.toContain('NaN');
});

test('parent summary keeps only known tags and the parent view escapes what it shows', async ({ page }) => {
  await openApp(page, { settings: { syncCode: 'ABCDEFGHJKLM' }, sessions: [sess({ duration: 90, tags: ['highway', IMG] })] });
  const { summary, link } = await page.evaluate(async img => {
    settings.parent = { token: toHex(randomBytes(16)), key: b64u.enc(randomBytes(32)) };
    saveSettings(); await pushSync();
    const summary = parentSummary();
    // Someone holding the link key uploads a summary with a hostile tag and driver name
    const tampered = { v: 2, ...summary, driverName: img };
    tampered.sessions[0].tags = [img];
    await syncCall('put', { id: settings.parent.token, blob: await seal(await importParentKey(settings.parent.key), tampered) });
    return { summary: parentSummary(), link: `/readytoroll.html?parent=${settings.parent.token}#k=${settings.parent.key}` };
  }, IMG);
  expect(summary.sessions[0].tags).toEqual(['highway']);
  await page.goto(link);
  await expect(page.locator('#parent-content')).toContainText('1.5');
  const h = await html(page, '#parent-content');
  expect(h).not.toContain('<img');
  expect(h).toContain('&lt;img');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('synced sessions go through the same cleaner as imports', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(img => {
    mergeSyncData({ sessions: [
      { id: 'r1', startTime: '2026-10-01T18:00:00Z', duration: 30, tags: [img], route: 'abc', maxSpeed: '12' },
      { id: 'bad"id', startTime: '2026-10-01T18:00:00Z', duration: 30 },
      { id: 'r2', startTime: 'nope', duration: 30 },
    ] });
    return sessions.map(s => ({ id: s.id, tags: s.tags, route: s.route, maxSpeed: s.maxSpeed }));
  }, IMG);
  expect(r).toEqual([{ id: 'r1', tags: [], route: [], maxSpeed: 12 }]);
});

test('print log escapes the driver name and survives a bad skill entry', async ({ page }) => {
  await openApp(page, { settings: { driverName: IMG }, skills: { steering: { status: null }, braking: { status: 'mastered', lastPracticed: '2026-10-01T18:00:00Z' } }, sessions: [sess({ weather: { code: 0, temp: '<b>1</b>' } })] });
  const out = await page.evaluate(() => {
    let written = '';
    window.open = () => ({ document: { write: t => { written += t; }, close() {} } });
    printLog();
    return written;
  });
  expect(out).not.toContain('<img');
  expect(out).not.toContain('<b>');
  expect(out).toContain('not started');
  expect(out).toContain('mastered');
  // Replace-import validates skills too
  const skills = await page.evaluate(() => {
    applyImport({ sessions: [], skills: { steering: { status: null }, bogus: { status: 'mastered' }, braking: { status: 'in_progress', lastPracticed: 7 }, reverse: 'mastered' } }, 'replace');
    return skillsData;
  });
  expect(skills).toEqual({ braking: { status: 'in_progress' } });
});
