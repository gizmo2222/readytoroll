// Leftover paths: GPS permission warnings, swipe navigation, storage fallbacks, inclement stats, skills badge, home timer.
const { test, expect, openApp, sess } = require('./helpers');

// Stub navigator.permissions.query; window.__perm.set(state) fires the onchange handler
const stubPerm = (page, state) => page.addInitScript(s => {
  const res = { state: s, onchange: null };
  window.__perm = { res, set(n) { res.state = n; res.onchange && res.onchange(); } };
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => res } });
}, state);

test('denied GPS permission warns on home and in the drive view, and reacts to permission changes', async ({ page }) => {
  await stubPerm(page, 'denied');
  await openApp(page);
  await page.waitForFunction(() => gpsPermState === 'denied');
  await page.evaluate(() => navigate('home'));
  await expect(page.locator('#home-view')).toContainText('Location access is blocked');
  await page.evaluate(() => navigate('drive'));
  await expect(page.locator('#drive-panel')).toContainText('Location blocked');
  await expect(page.locator('#drive-panel')).toContainText('Ready to Drive?');
  await page.evaluate(() => window.__perm.set('granted'));
  await expect(page.locator('#drive-panel')).not.toContainText('Location blocked');
  await page.evaluate(() => { navigate('home'); window.__perm.set('denied'); });
  await expect(page.locator('#home-view')).toContainText('Location access is blocked');
  await page.evaluate(() => window.__perm.set('prompt'));
  await expect(page.locator('#home-view')).not.toContainText('Location access is blocked');
});

test('granted permission shows no warning; a failing permissions API falls back to unknown', async ({ page }) => {
  await stubPerm(page, 'granted');
  await openApp(page);
  await page.waitForFunction(() => gpsPermState === 'granted');
  await expect(page.locator('#home-view')).not.toContainText('Location access is blocked');
  const state = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => { throw new Error('nope'); } } });
    await checkGpsPermission();
    const a = gpsPermState;
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
    gpsPermState = 'granted'; await checkGpsPermission();
    return [a, gpsPermState, gpsWarnHTML()];
  });
  expect(state).toEqual(['unknown', 'unknown', '']);
});

test('a browser without the geolocation API is treated as denied', async ({ page }) => {
  await openApp(page);
  const st = await page.evaluate(async () => {
    delete navigator.geolocation; delete Navigator.prototype.geolocation;
    gpsPermState = 'granted'; await checkGpsPermission();
    return ['geolocation' in navigator, gpsPermState];
  });
  expect(st).toEqual([false, 'denied']);
});

test('swiping #main moves between views, ignoring vertical or short swipes and active drives', async ({ page }) => {
  await openApp(page);
  const swipe = (dx, dy = 0) => page.evaluate(([dx, dy]) => {
    const el = document.getElementById('main');
    const ev = (type, x, y) => {
      const e = new Event(type, { bubbles: true });
      const t = [{ clientX: x, clientY: y }]; e.touches = t; e.changedTouches = t; el.dispatchEvent(e);
    };
    ev('touchstart', 200, 300); ev('touchend', 200 + dx, 300 + dy);
    return currentView;
  }, [dx, dy]);
  expect(await swipe(-120)).toBe('dashboard');
  expect(await swipe(-120)).toBe('drive');
  expect(await swipe(120)).toBe('dashboard');
  expect(await swipe(-30)).toBe('dashboard');          // too short
  expect(await swipe(-120, 150)).toBe('dashboard');    // mostly vertical
  expect(await swipe(120)).toBe('home');
  expect(await swipe(120)).toBe('home');               // first view: nowhere to go
  await expect(page.locator('#home-view')).toHaveClass(/active/);
  await page.evaluate(() => { activeSession = { startTime: new Date().toISOString(), route: [] }; });
  expect(await swipe(-120)).toBe('home');              // swipes disabled during a drive
  await page.evaluate(() => { activeSession = null; navigate('settings'); });
  expect(await swipe(-120)).toBe('settings');          // last view
});

test('nav buttons switch the visible view', async ({ page }) => {
  await openApp(page);
  await page.locator('.nav-btn[data-view="history"]').click();
  await expect(page.locator('#history-view')).toHaveClass(/active/);
  await expect(page.locator('.nav-btn[data-view="history"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#home-view')).not.toHaveClass(/active/);
});

test('storage loaders fall back on corrupt JSON, and legacy tombstones load as an id set', async ({ page }) => {
  await openApp(page, { deleted: ['old1', { id: 'new1', at: '2026-10-01T00:00:00.000Z' }] });
  const r = await page.evaluate(() => {
    const ids = [...loadDeletedIds()].sort();
    const list = tombstoneList().map(t => t.id).sort();
    localStorage.setItem('rtr_sessions', '{bad'); localStorage.setItem('rtr_skills', '{bad'); localStorage.setItem('rtr_deleted', '{bad');
    return { ids, list, s: loadSessions(), k: loadSkillsData(), d: [...loadDeletedIds()] };
  });
  expect(r.ids).toEqual(['new1', 'old1']);
  expect(r.list).toEqual(['new1', 'old1']);
  expect(r.s).toEqual([]); expect(r.k).toEqual({}); expect(r.d).toEqual([]);
});

test('saveDeletedId and clearDeletedId round-trip through rtr_deleted', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    saveDeletedId('x1'); saveDeletedId('x2');
    const a = JSON.parse(localStorage.getItem('rtr_deleted')).map(t => [t.id, typeof t.at]);
    clearDeletedId('x1'); clearDeletedId('nope');
    return { a, b: [...loadDeletedIds()] };
  });
  expect(r.a).toEqual([['x1', 'string'], ['x2', 'string']]);
  expect(r.b).toEqual(['x2']);
});

test('duplicate tombstones keep the newest deletion time', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const m = addTombstones(new Map(), [{ id: 'a', at: '2026-01-01T00:00:00.000Z' }, { id: 'a', at: '2026-05-01T00:00:00.000Z' }, { id: 'a', at: '2026-03-01T00:00:00.000Z' }, 'b']);
    return [m.get('a'), m.get('b')];
  });
  expect(r).toEqual(['2026-05-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z']);
});

test('settings with only a legacy accent migrate to accentHue', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    localStorage.setItem('rtr_settings', JSON.stringify({ onboardingDone: true, accentHue: null, accentColor: '#ff0000' }));
    const red = loadSettings().accentHue;
    localStorage.setItem('rtr_settings', JSON.stringify({ onboardingDone: true, accentHue: null, accentId: 'zzz' }));
    return { red, fallback: loadSettings().accentHue };
  });
  expect(r.red).toBe(0);
  expect(Number.isFinite(r.fallback)).toBe(true);
});

test('inclement detection by weather code, tag, fog and thunder; inclement bar only for PA/SD', async ({ page }) => {
  await openApp(page, { settings: { state: 'PA' }, sessions: [
    sess({ id: 'r', weather: { code: 61 }, duration: 60 }),
    sess({ id: 'f', weather: { code: 45 }, duration: 30, startTime: '2026-10-02T21:00:00.000Z' }),
    sess({ id: 't', tags: ['snow'], duration: 30, startTime: '2026-10-03T21:00:00.000Z' }),
    sess({ id: 'ok', weather: { code: 0 }, duration: 60, startTime: '2026-10-04T21:00:00.000Z' }),
  ] });
  const r = await page.evaluate(() => ({
    flags: sessions.map(s => [s.id, isInclement(s)]),
    hrs: getTotals().inclementHours,
    codes: [95, 96, 99, 71, 85, 80, 66, 48, 3].map(c => isInclement({ weather: { code: c } })),
  }));
  expect(r.flags).toEqual([['r', true], ['f', true], ['t', true], ['ok', false]]);
  expect(r.hrs).toBeCloseTo(2, 6);
  expect(r.codes).toEqual([true, true, true, true, true, true, true, true, false]);
  await page.evaluate(() => { navigate('dashboard'); });
  await expect(page.locator('#dashboard-view')).toContainText('Inclement 2.0h / 5h');
  await page.evaluate(() => { settings.state = 'CA'; navigate('home'); navigate('dashboard'); });
  await expect(page.locator('#dashboard-view')).not.toContainText('Inclement');
});

test('skills nav badge counts skills not started and hides when all are started', async ({ page }) => {
  await openApp(page);
  const badge = page.locator('#skills-nav-badge');
  const total = await page.evaluate(() => SKILLS.length);
  await expect(badge).toHaveClass(/show/);
  await expect(badge).toHaveText(String(total));
  await page.evaluate(() => { SKILLS.forEach(s => { skillsData[s.id] = { status: 'learning' }; }); updateSkillsBadge(); });
  await expect(badge).not.toHaveClass(/show/);
  await page.evaluate(() => { skillsData[SKILLS[0].id] = { status: 'not_started' }; updateSkillsBadge(); });
  await expect(badge).toHaveText('1');
});

test('drive view idle state, then active map, then idle again', async ({ page }) => {
  await openApp(page, { clock: new Date('2026-10-05T18:00:00Z') });
  await page.evaluate(() => navigate('drive'));
  await expect(page.locator('#drive-map')).toBeHidden();
  await expect(page.locator('#drive-panel')).toContainText('Ready to Drive?');
  await expect(page.locator('#drive-panel .gps-warn')).toHaveCount(0);
  await page.evaluate(() => startDrive());
  await page.waitForFunction(() => window.__geo.watchers.size > 0);
  await page.evaluate(() => window.__geo.emit(34.05, -118.24, 12));
  await page.clock.runFor(2000);
  await expect(page.locator('#drive-map')).toBeVisible();
  expect(await page.evaluate(() => driveMap !== null)).toBe(true);
  const r = await page.evaluate(() => {
    renderDrive(); const again = driveMap !== null;
    driveMap = null; activeSession.route = [[34.05, -118.24, 0], [34.051, -118.24, 0]]; renderDrive();
    return { again, rebuilt: driveMap !== null, elapsed: Math.round(elapsedMin(activeSession.startTime)) };
  });
  expect(r).toEqual({ again: true, rebuilt: true, elapsed: 0 });
  await page.evaluate(() => { activeSession = null; renderDrive(); });
  await expect(page.locator('#drive-map')).toBeHidden();
  expect(await page.evaluate(() => driveMap)).toBeNull();
});

test('home elapsed timer ticks during a drive and stops when it ends', async ({ page }) => {
  await openApp(page, { clock: new Date('2026-10-05T18:00:00Z') });
  await page.evaluate(() => startDrive());
  await page.waitForFunction(() => window.__geo.watchers.size > 0);
  await page.evaluate(() => navigate('home'));
  const el = page.locator('#home-elapsed');
  await expect(el).toBeVisible();
  const before = await el.textContent();
  await page.clock.runFor(65000);
  expect(await el.textContent()).not.toBe(before);
  expect(await page.evaluate(() => window._homeTimer != null)).toBe(true);
  await page.evaluate(() => { activeSession = null; });
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window._homeTimer)).toBeNull();
});

test('compass shows only when a heading is reported', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => navigate('drive'));
  const r = await page.evaluate(() => {
    const el = document.getElementById('compass-el');
    updateCompass(null); const a = el.classList.contains('visible');
    updateCompass(NaN); const b = el.classList.contains('visible');
    updateCompass(90); return [a, b, el.classList.contains('visible'), el.style.transform];
  });
  expect(r).toEqual([false, false, true, 'rotate(90deg)']);
});

test('service worker BACK_ONLINE message shows a toast', async ({ page }) => {
  await openApp(page);
  const has = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!has, 'no serviceWorker container');
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'BACK_ONLINE' } })));
  await expect(page.locator('.toast').filter({ hasText: 'Back online' })).toBeVisible();
});
