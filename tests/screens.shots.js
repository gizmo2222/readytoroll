// UI review harness (not part of the suite): screenshots every view and modal at phone, tablet and
// desktop widths in each theme, plus an automated audit (text contrast, touch targets, unlabeled controls).
// Run: npx playwright test --config playwright.shots.config.js
// Output: coverage/shots/<width>/<theme>/<screen>.png and coverage/shots/audit.json (git-ignored).
// RTR_SHOTS_THEMES / RTR_SHOTS_WIDTHS (comma lists) narrow a run.
const fs = require('fs'), path = require('path');
const { test, openApp, sess, startDriving } = require('./helpers');

const OUT = path.join(__dirname, '..', 'coverage', 'shots');
const WIDTHS = { phone: [375, 812], tablet: [768, 1024], desktop: [1280, 800] };
const THEMES = ['default', 'dark', 'contrast', 'pastel', 'neon', 'retro', 'midnight'];
const pick = (env, all) => (process.env[env] ? process.env[env].split(',') : all);

const DAY = 86400000;
function seedSessions() {
  const now = Date.now(), out = [];
  const tags = [['highway'], ['parking'], ['rain'], [], ['city', 'highway'], ['confident']];
  for (let i = 0; i < 14; i++) {
    const start = new Date(now - (i * 2 + 1) * DAY + (i % 3) * 3600000);
    const night = i % 4 === 1;
    if (night) start.setHours(20, 0, 0, 0); else start.setHours(15, 30, 0, 0);
    const route = Array.from({ length: 30 }, (_, k) => [34.05 + k * 0.001, -118.24 + k * 0.0007, 80 + (k % 9) * 3, 18 + (k % 7) * 3]);
    out.push(sess({ startTime: start.toISOString(), duration: 30 + (i % 5) * 15, isNight: night,
      tags: tags[i % tags.length], supervisor: 'Alex Rivera', supervisorLicense: 'D1234567',
      startLocation: { lat: 34.05, lng: -118.24, city: 'Springfield', address: '742 Evergreen Terrace, Springfield' },
      endLocation: { lat: 34.08, lng: -118.22, city: 'Springfield', address: 'Springfield Mall, Springfield' },
      weather: { code: i % 5 === 2 ? 61 : 0, temp: 62, windSpeed: 6, isDay: !night },
      route, distance: 6.4 + i, notes: i === 0 ? 'Practised merging onto the 101. Felt good about lane changes.' : '' }));
  }
  return out;
}
const SKILLS = { parallel: 'confident', highway: 'practicing', merging: 'practicing', threepoint: 'confident' };

async function grab(page, file, full = true) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.waitForTimeout(350);   // view/modal animations
  if (!full) return page.screenshot({ path: file });
  // Views scroll inside #main, so grow the viewport to the active view's content height
  const vp = page.viewportSize();
  const h = await page.evaluate(() => {
    const sheet = [...document.querySelectorAll('.modal-overlay.open .modal-sheet, #onboard-overlay.open .onboard-card')].pop();
    if (sheet) return sheet.scrollHeight + 120;
    const v = document.querySelector('.view.active');
    return v ? v.scrollHeight + (window.innerHeight - v.clientHeight) : 0;
  });
  if (h > vp.height) await page.setViewportSize({ width: vp.width, height: Math.min(h, 4000) });
  await page.waitForTimeout(150);
  await page.screenshot({ path: file });
  await page.setViewportSize(vp);
}

// In-page audit: text contrast against the effective background, small targets, unnamed controls
function audit(screen) {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = el => { const stack = []; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let bg = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) bg = blend(stack[i], bg); return bg; };
  const visible = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const label = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')) + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '"';
  const issues = [];
  const scope = document.querySelector('.modal-overlay.open, #onboard-overlay.open, #parent-overlay.open') || document.body;
  for (const el of scope.querySelectorAll('*')) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || !visible(el)) continue;
    const cs = getComputedStyle(el), fg = parse(cs.color), bg = bgOf(el);
    if (!fg || !bg) continue;
    const L1 = lum(blend(fg, bg)), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    // emoji-only text has no contrast requirement
    if (ratio < need && /[A-Za-z0-9]/.test(el.textContent)) issues.push({ kind: 'contrast', el: label(el), ratio: +ratio.toFixed(2), need, size });
  }
  for (const el of scope.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="radio"], [role="checkbox"], [role="tab"], [onclick]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.width < 44 || r.height < 44) && !['checkbox', 'radio', 'range'].includes(el.type) && el.tagName !== 'A')
      issues.push({ kind: 'target', el: label(el), w: Math.round(r.width), h: Math.round(r.height) });
    const name = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim() || (el.labels && el.labels[0] && el.labels[0].textContent.trim()) || el.getAttribute('placeholder');
    if (!name) issues.push({ kind: 'unnamed', el: label(el) });
  }
  return { screen, issues };
}

const SCREENS = [
  ['home', async p => {}],
  ['drive', async p => { await p.evaluate(() => navigate('drive')); }],
  ['drive-live', async p => { await p.evaluate(() => navigate('drive')); await startDriving(p);
    await p.evaluate(() => { for (let i = 1; i < 8; i++) window.__geo.emit(34.05 + i * 0.0006, -118.24, 13); }); }],
  ['skills', async p => { await p.evaluate(() => navigate('skills')); }],
  ['history', async p => { await p.evaluate(() => navigate('history')); }],
  ['settings', async p => { await p.evaluate(() => navigate('settings')); }],
  ['detail', async p => { await p.evaluate(() => { const s = [...sessions].sort((a, b) => b.startTime.localeCompare(a.startTime))[0]; showSessionDetail(s.id); }); }],
  ['help', async p => { await p.evaluate(() => openHelp()); }],
  ['manual', async p => { await p.evaluate(() => openManualModal()); }],
  ['quick', async p => { await p.evaluate(() => openQuickModal()); }],
];

for (const width of pick('RTR_SHOTS_WIDTHS', Object.keys(WIDTHS))) {
  for (const theme of pick('RTR_SHOTS_THEMES', THEMES)) {
    // Every screen at every width in the default theme; other themes at phone width plus desktop home
    test(`shots ${width} ${theme}`, async ({ page, browser }, info) => {
      test.setTimeout(120000);
      const dir = path.join(OUT, width, theme);
      await page.setViewportSize({ width: WIDTHS[width][0], height: WIDTHS[width][1] });
      const settings = { vibeTheme: theme, syncCode: 'ABCDEFGHJKLM', supervisorName: 'Alex Rivera' };
      const results = [];
      const screens = theme === 'default' || width === 'phone' ? SCREENS : SCREENS.slice(0, 1);
      // seedStorage runs once per tab, so each state gets a new tab in the same context
      const tab = async () => { const p = await page.context().newPage(); p.on('console', m => { if (/Content Security Policy/i.test(m.text())) results.push({ screen: 'csp', issues: [{ kind: 'csp', el: m.text().slice(0, 200) }] }); }); await p.setViewportSize({ width: WIDTHS[width][0], height: WIDTHS[width][1] }); return p; };
      for (const [name, go] of screens) {
        const page = await tab();
        await openApp(page, { settings, sessions: seedSessions(), skills: SKILLS });
        await go(page);
        await grab(page, path.join(dir, name + '.png'));
        results.push(await page.evaluate(audit, name));
        await page.close();
      }
      if (theme === 'default' || width === 'phone') {
        // Empty states
        let page = await tab();
        await openApp(page, { settings: { vibeTheme: theme }, sessions: [], skills: {} });
        await grab(page, path.join(dir, 'home-empty.png'));
        results.push(await page.evaluate(audit, 'home-empty'));
        await page.evaluate(() => navigate('history'));
        await grab(page, path.join(dir, 'history-empty.png'));
        results.push(await page.evaluate(audit, 'history-empty'));
        // Onboarding (fresh device)
        page = await tab();
        await openApp(page, { settings: { onboardingDone: false, driverName: '', vibeTheme: theme } });
        await page.waitForSelector('#onboard-overlay.open', { timeout: 5000 }).catch(() => {});
        await grab(page, path.join(dir, 'onboarding.png'));
        results.push(await page.evaluate(audit, 'onboarding'));
        // Parent view
        page = await tab();
        await openApp(page, { settings, sessions: seedSessions() });
        const link = await page.evaluate(async () => {
          settings.parent = { token: toHex(randomBytes(16)), key: b64u.enc(randomBytes(32)) };
          saveSettings(); await pushSync();
          return `/readytoroll.html?parent=${settings.parent.token}#k=${settings.parent.key}`;
        });
        await page.goto(link);
        await page.waitForSelector('#parent-content .parent-badge, #parent-content h2', { timeout: 10000 }).catch(() => {});
        await grab(page, path.join(dir, 'parent.png'), false);
        results.push(await page.evaluate(audit, 'parent'));
      }
      fs.mkdirSync(path.join(OUT, 'audit'), { recursive: true });
      fs.writeFileSync(path.join(OUT, 'audit', `${width}-${theme}.json`), JSON.stringify(results, null, 1));
    });
  }
}
