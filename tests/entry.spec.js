// Manual and quick entry validation, date-only drives, sticky milestones and totals display.
const { test, expect, openApp, sess, manual } = require('./helpers');

const NOW = new Date('2026-11-06T20:00:00.000Z');   // 12:00 PST on Fri 2026-11-06

async function quick(page, h, m) {
  return page.evaluate(([h, m]) => {
    openQuickModal();
    selectQaDur(document.getElementById('qa-custom-chip'));
    document.getElementById('qa-h').value = h; document.getElementById('qa-m').value = m;
    const before = sessions.length;
    saveQuickDrive();
    return { added: sessions.length - before, toast: document.getElementById('toast').textContent };
  }, [h, m]);
}

test('manual end equal to start is rejected, not a 24 hour drive', async ({ page }) => {
  await openApp(page, { clock: NOW });
  const r = await manual(page, { date: '2026-11-05', start: '08:00', end: '08:00' });
  expect(r.added).toBe(0);
  expect(r.toast).toMatch(/differ/);
});

test('manual rejects negative minutes, minutes over 59 and negative hours', async ({ page }) => {
  await openApp(page, { clock: NOW });
  for (const f of [{ h: 1, m: -30 }, { h: 1, m: 75 }, { h: -2, m: 30 }]) {
    const r = await manual(page, { date: '2026-11-05', ...f });
    expect(r.added, JSON.stringify(f)).toBe(0);
  }
});

test('manual rejects a drive longer than 24 hours', async ({ page }) => {
  await openApp(page, { clock: NOW });
  const r = await manual(page, { date: '2026-11-05', start: '08:00', h: 999, m: 0 });
  expect(r.added).toBe(0);
  expect(r.toast).toMatch(/24 hours/);
});

test('manual rejects a start in the future, allows today', async ({ page }) => {
  await openApp(page, { clock: NOW });
  const fut = await manual(page, { date: '2031-01-01', start: '10:00', end: '11:00' });
  expect(fut.added).toBe(0);
  expect(fut.toast).toMatch(/future/);
  const futDateOnly = await manual(page, { date: '2026-11-07', h: 1, m: 0 });
  expect(futDateOnly.added).toBe(0);
  const ok = await manual(page, { date: '2026-11-06', h: 1, m: 0 });   // date-only today is fine
  expect(ok.added).toBe(1);
});

test('quick add rejects negative, over-59 and huge durations without throwing', async ({ page }) => {
  await openApp(page, { clock: NOW });
  for (const [h, m] of [[1, -30], [0, 90], [-1, 30], ['1000000000000', 0], [30, 0]]) {
    const r = await quick(page, h, m);
    expect(r.added, `${h}:${m}`).toBe(0);
  }
  const ok = await quick(page, 1, 30);
  expect(ok.added).toBe(1);
});

test('date-only manual drive is stored at noon, flagged, and is not an early drive', async ({ page }) => {
  await openApp(page, { clock: NOW });
  const { s } = await manual(page, { date: '2026-11-05', h: 1, m: 0 });
  expect(s.timeUnknown).toBe(true);
  expect(s.duration).toBe(60);
  expect(s.nightMin).toBe(0);
  expect(s.startTime).toBe(new Date('2026-11-05T12:00:00-08:00').toISOString());
  const t = await page.evaluate(() => getTotals());
  expect(t.earlyDrives).toBe(0);
});

test('a timed drive before 7 am still counts as early', async ({ page }) => {
  await openApp(page, { clock: NOW });
  await manual(page, { date: '2026-11-05', start: '06:00', end: '07:00' });
  expect(await page.evaluate(() => getTotals().earlyDrives)).toBe(1);
});

test('date-only drive keeps its date when viewed far to the west', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, serviceWorkers: 'block', timezoneId: 'Pacific/Honolulu', locale: 'en-US' });
  const page = await ctx.newPage();
  await openApp(page, { clock: NOW, sessions: [sess({ startTime: new Date('2026-11-05T12:00:00-08:00').toISOString(), timeUnknown: true })] });
  const day = await page.evaluate(() => localDateStr(new Date(sessions[0].startTime)));
  expect(day).toBe('2026-11-05');
  await ctx.close();
});

test('earned milestones are never revoked', async ({ page }) => {
  await openApp(page, { clock: NOW, milestones: ['streak7', 'early'], sessions: [sess({ duration: 30 })] });
  const r = await page.evaluate(() => { const e = checkMilestones(); return { e: [...e], stored: JSON.parse(localStorage.getItem('rtr_milestones')) }; });
  expect(r.stored).toEqual(expect.arrayContaining(['streak7', 'early']));
  expect(r.e).toEqual(expect.arrayContaining(['streak7', 'early']));
});

test('a malformed rtr_milestones value does not break Home', async ({ page }) => {
  for (const bad of ['{', '{}', '"x"', '5']) {
    await openApp(page, { clock: NOW });
    await page.evaluate(b => localStorage.setItem('rtr_milestones', b), bad);
    const ok = await page.evaluate(() => { renderHome(); checkMilestones(); return Array.isArray(JSON.parse(localStorage.getItem('rtr_milestones'))); });
    expect(ok, bad).toBe(true);
  }
});

test('Home and the goal card do not claim completion while night hours are owed', async ({ page }) => {
  await openApp(page, { clock: NOW, settings: { state: 'CA', goalDate: '2026-12-31' },
    sessions: [sess({ duration: 50 * 60, nightMin: 0 })] });
  const r = await page.evaluate(() => {
    renderHome();
    return { home: document.getElementById('home-content').textContent,
      goal: goalCard(getReqs(), getTotals()) };
  });
  expect(r.home).not.toContain('Hours complete');
  expect(r.home).toContain('night left');
  expect(r.goal).not.toContain('All hours complete');
  expect(r.goal).toContain('night hrs left');
  const past = await page.evaluate(() => { settings.goalDate = '2026-11-01'; return goalCard(getReqs(), getTotals()); });
  expect(past).not.toContain('requirements met');
});

test('Home shows complete only when everything is met, and no-requirement states say so', async ({ page }) => {
  await openApp(page, { clock: NOW, settings: { state: 'PA' }, sessions: [sess({ duration: 65 * 60, nightMin: 10 * 60 })] });
  let home = await page.evaluate(() => { renderHome(); return document.getElementById('home-content').textContent; });
  expect(home).not.toContain('Hours complete');   // inclement hours still owed
  expect(home).toContain('inclement left');
  await page.evaluate(() => { settings.state = 'AR'; renderHome(); });
  home = await page.evaluate(() => document.getElementById('home-content').textContent);
  expect(home).not.toContain('Hours complete');
  expect(home).toContain('No hour requirement');
});

test('fmtDur never prints 60m', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => [fmtDur(59.7), fmtDur(119.6), fmtDur(90), fmtDur(45.4), fmtDur(60)]);
  expect(r).toEqual(['1h', '2h', '1h 30m', '45m', '1h']);
});

test('freezing rain and drizzle have descriptions and a rain emoji', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => [56, 57, 66, 67].map(c => [WX_DESC[c], wxEmoji(c)]));
  for (const [d, e] of r) { expect(d).toMatch(/Freezing/i); expect(e).toBe('\u{1F327}️'); }
  expect(await page.evaluate(() => wxEmoji(71))).toBe('\u{1F328}️');
});

test('editing a drive and clearing its location removes the location', async ({ page }) => {
  const manualDrive = sess({ id: 'm1', startLocation: { lat: null, lng: null, city: 'Springfield, IL', address: 'Springfield, IL' } });
  const gps = sess({ id: 'g1', startLocation: { lat: 34.05, lng: -118.24, city: 'Springfield', address: '1 Main St' } });
  await openApp(page, { clock: NOW, sessions: [manualDrive, gps] });
  const r = await page.evaluate(() => {
    const out = {};
    for (const id of ['m1', 'g1']) {
      openManualModal(id);
      document.getElementById('m-location').value = '';
      saveManualDrive();
      out[id] = sessions.find(x => x.id === id).startLocation;
    }
    return out;
  });
  expect(r.m1).toBeNull();
  expect(r.g1).toMatchObject({ lat: 34.05, lng: -118.24, city: '', address: '' });
});

test('saving an edit for a drive removed elsewhere says so and changes nothing', async ({ page }) => {
  await openApp(page, { clock: NOW, sessions: [sess({ id: 'gone1' })] });
  const r = await page.evaluate(() => {
    openManualModal('gone1');
    sessions = sessions.filter(x => x.id !== 'gone1');
    let called = 0; const orig = onSessionsChanged; onSessionsChanged = () => { called++; return orig(); };
    saveManualDrive();
    return { toast: document.getElementById('toast').textContent, called, n: sessions.length,
      open: document.getElementById('manual-modal').classList.contains('open') };
  });
  expect(r.toast).toMatch(/removed on another device/);
  expect(r.called).toBe(0);
  expect(r.n).toBe(0);
  expect(r.open).toBe(false);
});

test('reopening quick add resets the tag chips to aria-checked false', async ({ page }) => {
  await openApp(page, { clock: NOW });
  await page.evaluate(() => openQuickModal());
  await page.locator('#qa-tag-chips .qa-chip').first().click();
  await expect(page.locator('#qa-tag-chips .qa-chip').first()).toHaveAttribute('aria-checked', 'true');
  await page.evaluate(() => { closeQuickModal(); openQuickModal(); });
  const states = await page.evaluate(() => [...document.querySelectorAll('#qa-tag-chips .qa-chip')].map(c => [c.classList.contains('active'), c.getAttribute('aria-checked')]));
  for (const [active, checked] of states) { expect(active).toBe(false); expect(checked).toBe('false'); }
});

test('manual and quick-add controls all have a label', async ({ page }) => {
  await openApp(page, { clock: NOW });
  await page.evaluate(() => { openManualModal(); openQuickModal(); selectQaDur(document.getElementById('qa-custom-chip')); });
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('#manual-modal input,#manual-modal select,#manual-modal textarea,#quick-modal input,#quick-modal select,#quick-modal textarea')]
    .filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map(e => e.id || e.outerHTML.slice(0, 60)));
  expect(unlabeled).toEqual([]);
});

test('days to goal is a whole calendar count across the fall-back DST change', async ({ page }) => {
  // Noon PDT on Oct 31; 2026-11-01 has 25 hours, so midnight-to-midnight is 49 h, not 48
  await openApp(page, { clock: new Date('2026-10-31T19:00:00.000Z'), settings: { state: 'CA', goalDate: '2026-11-02' }, sessions: [sess({ duration: 60 })] });
  const r = await page.evaluate(() => {
    renderHome();
    const box = [...document.querySelectorAll('.countdown-box')].find(b => /Days to goal/.test(b.textContent));
    return { box: box && box.querySelector('.countdown-val').textContent, goal: goalCard(getReqs(), getTotals()) };
  });
  expect(r.box).toBe('2');
  expect(r.goal).toContain('2 days');
  expect(r.goal).not.toContain('3 days');
});
