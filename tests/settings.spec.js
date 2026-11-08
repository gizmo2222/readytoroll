// Settings view and theming: form save, state preview, theme/accent/font/car setters, legacy accent migration, clearAllData.
const { test, expect, openApp, sess, readStore: stored } = require('./helpers');

const rootVar = (page, name) => page.evaluate(n => document.documentElement.style.getPropertyValue(n), name);
const attr = (page, name) => page.evaluate(n => document.documentElement.getAttribute(n), name);

async function openSettings(page, opts = {}) {
  const r = await openApp(page, opts);
  await page.evaluate(() => { navigate('settings'); renderSettings(); });
  await expect(page.locator('#s-state')).toBeVisible();
  return r;
}

test('saving the form persists to rtr_settings and re-renders requirements', async ({ page }) => {
  await openSettings(page);
  const tx = await page.evaluate(() => STATE_REQS.TX);
  await page.locator('#s-name').fill('  Riley  ');
  await page.locator('#s-goal').fill('2027-03-01');
  await page.locator('#s-car-nick').fill(' Betty ');
  await page.locator('#s-state').selectOption('TX');
  const s = await stored(page);
  expect(s.state).toBe('TX');
  expect(s.driverName).toBe('Riley');
  expect(s.goalDate).toBe('2027-03-01');
  expect(s.carNickname).toBe('Betty');
  const reqs = await page.evaluate(() => getReqs());
  expect(reqs.total).toBe(tx.total);
  expect(reqs.night).toBe(tx.night);
  await expect(page.locator('.toast').first()).toContainText('Settings saved');
  // a full re-render keeps the saved values
  await page.evaluate(() => renderSettings());
  await expect(page.locator('#s-state')).toHaveValue('TX');
  await expect(page.locator('#s-name')).toHaveValue('Riley');
  await expect(page.locator('#req-total')).toHaveText(String(tx.total || '—'));
});

test('previewState shows the chosen state hours without saving', async ({ page }) => {
  await openSettings(page);
  const ny = await page.evaluate(() => STATE_REQS.NY);
  await page.evaluate(() => previewState('NY'));
  await expect(page.locator('#req-total')).toHaveText(String(ny.total || '—'));
  await expect(page.locator('#req-night')).toHaveText(String(ny.night || '—'));
  await expect(page.locator('#req-handbook a.handbook-link')).toHaveAttribute('href', ny.handbookUrl);
  if (ny.note) await expect(page.locator('#req-note')).toContainText(ny.note.slice(0, 20));
  expect((await stored(page)).state).toBe('CA');
  // unknown code is ignored
  await page.evaluate(() => previewState('ZZ'));
  await expect(page.locator('#req-total')).toHaveText(String(ny.total || '—'));
  // selecting in the dropdown previews and saves
  await page.locator('#s-state').selectOption('CA');
  const ca = await page.evaluate(() => STATE_REQS.CA);
  await expect(page.locator('#req-total')).toHaveText(String(ca.total || '—'));
  expect((await stored(page)).state).toBe('CA');
});

test('override hours are saved and invalid values fall back to the state default', async ({ page }) => {
  await openSettings(page);
  const ca = await page.evaluate(() => STATE_REQS.CA);
  await page.locator('#s-custom-total').fill('75');
  await page.locator('#s-custom-night').fill('20');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  let s = await stored(page);
  expect([s.customTotal, s.customNight]).toEqual([75, 20]);
  expect(await page.evaluate(() => { const r = getReqs(); return [r.total, r.night]; })).toEqual([75, 20]);
  // a negative number is not a valid override: requirements use the state default
  await page.locator('#s-custom-total').fill('-5');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  expect(await page.evaluate(() => getReqs().total)).toBe(ca.total);
  // clearing the field removes the override
  await page.locator('#s-custom-total').fill('');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  s = await stored(page);
  expect(s.customTotal).toBeNull();
  expect(await page.evaluate(() => getReqs().total)).toBe(ca.total);
});

test('setVibeTheme sets data-theme and persists', async ({ page }) => {
  await openSettings(page);
  const cases = ['dark', 'neon', 'midnight', 'contrast', 'pastel', 'retro', 'default'];
  for (const id of cases) {
    await page.evaluate(t => setVibeTheme(t), id);
    expect(await attr(page, 'data-theme')).toBe(id);
    expect((await stored(page)).vibeTheme).toBe(id);
  }
  await page.locator('.theme-swatch[aria-label*="Pastel"]').click();
  expect(await attr(page, 'data-theme')).toBe('pastel');
  await expect(page.locator('.theme-swatch.active')).toHaveCount(1);
});

test('accent-lt variables depend on theme (set, stronger for contrast, removed for others)', async ({ page }) => {
  await openSettings(page, { settings: { accentHue: 100 } });
  await page.evaluate(() => setVibeTheme('default'));
  expect(await rootVar(page, '--accent-lt')).toContain('0.12');
  await page.evaluate(() => setVibeTheme('dark'));
  expect(await rootVar(page, '--accent-lt')).toContain('0.12');
  await page.evaluate(() => setVibeTheme('contrast'));
  expect(await rootVar(page, '--accent-lt')).toContain('0.22');
  await page.evaluate(() => setVibeTheme('neon'));
  expect(await rootVar(page, '--accent-lt')).toBe('');
});

test('setAccentHue updates CSS variables, wraps the value and persists', async ({ page }) => {
  await openSettings(page);
  await page.evaluate(() => setAccentHue(120));
  for (const v of ['--accent']) expect(await rootVar(page, v)).toBe('hsl(120,80%,50%)');
  expect((await stored(page)).accentHue).toBe(120);
  await page.evaluate(() => setAccentHue(-30));
  expect((await stored(page)).accentHue).toBe(330);
  await page.evaluate(() => setAccentHue(400));
  expect((await stored(page)).accentHue).toBe(40);
  expect(await page.evaluate(() => document.getElementById('accent-hue-preview').style.background)).toBe('rgb(230, 162, 26)');
});

test('setFontSize changes --base-size and persists; unknown size falls back to 16px', async ({ page }) => {
  await openSettings(page);
  for (const [sz, px, label] of [['small', '14px', 'Small'], ['large', '18px', 'Large'], ['medium', '16px', 'Medium']]) {
    await page.locator('.font-size-btn', { hasText: label }).click();
    expect(await rootVar(page, '--base-size')).toBe(px);
    expect((await stored(page)).fontSize).toBe(sz);
    await expect(page.locator('.font-size-btn.active')).toHaveText(label);
  }
  await page.evaluate(() => setFontSize('huge'));
  expect(await rootVar(page, '--base-size')).toBe('16px');
});

test('setCarEmoji and setCarHue persist and update the previews', async ({ page }) => {
  await openSettings(page);
  await page.locator('.car-option[data-e="🚙"]').click();
  expect((await stored(page)).carEmoji).toBe('🚙');
  await expect(page.locator('.car-option.active')).toHaveAttribute('data-e', '🚙');
  await expect(page.locator('#car-hue-preview')).toHaveText('🚙');
  await page.evaluate(() => setCarHue(90));
  expect((await stored(page)).carHue).toBe(90);
  expect(await page.evaluate(() => document.getElementById('car-hue-preview').style.filter)).toBe('hue-rotate(90deg)');
  await page.evaluate(() => setCarHue(360));
  expect((await stored(page)).carHue).toBe(0);
  expect(await page.evaluate(() => document.getElementById('car-hue-preview').style.filter)).toBe('none');
});

test('hexToHue converts known colours and the ACCENT_COLORS table', async ({ page }) => {
  await openApp(page);
  const hues = await page.evaluate(() => ({
    red: hexToHue('#ff0000'), green: hexToHue('#00ff00'), blue: hexToHue('#0000ff'),
    yellow: hexToHue('#ffff00'), magenta: hexToHue('#ff00ff'), gray: hexToHue('#808080'),
    table: Object.fromEntries(ACCENT_COLORS.map(c => [c.id, hexToHue(c.main)])),
  }));
  expect(hues).toMatchObject({ red: 0, green: 120, blue: 240, yellow: 60, magenta: 300, gray: 0 });
  for (const h of Object.values(hues.table)) {
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  }
  expect(hues.table.blue).toBe(221);
  expect(hues.table.rose).toBe(347);
});

test('legacy accentColor hex migrates to an accent hue on load', async ({ page }) => {
  await openApp(page, { settings: { accentHue: null, accentColor: '#16a34a' } });
  expect(await page.evaluate(() => settings.accentHue)).toBe(142);
  expect(await rootVar(page, '--accent')).toBe('hsl(142,80%,50%)');
});

test('legacy accentId and darkMode migrate (dark vibe theme, id-based hue)', async ({ page }) => {
  await openApp(page, { settings: { accentHue: null, accentId: 'rose', darkMode: true } });
  const s = await page.evaluate(() => ({ hue: settings.accentHue, theme: settings.vibeTheme, dm: 'darkMode' in settings }));
  expect(s).toEqual({ hue: 347, theme: 'dark', dm: false });
  expect(await attr(page, 'data-theme')).toBe('dark');
});

test('legacy darkMode does not override an explicitly chosen vibe theme', async ({ page }) => {
  await openApp(page, { settings: { accentHue: 200, darkMode: true, vibeTheme: 'pastel' } });
  expect(await attr(page, 'data-theme')).toBe('pastel');
  expect(await page.evaluate(() => settings.vibeTheme)).toBe('pastel');
});

test('clearing the goal date field removes the saved goal', async ({ page }) => {
  await openSettings(page, { settings: { goalDate: '2027-05-05' } });
  await expect(page.locator('#s-goal')).toHaveValue('2027-05-05');
  await page.locator('#s-goal').fill('');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  expect((await stored(page)).goalDate).toBe('');
});

test('clearAllData keeps everything when the confirmation is cancelled', async ({ page }) => {
  await openSettings(page, { sessions: [sess({ id: 'k1' })], settings: { driverName: 'Jamie', vibeTheme: 'pastel' } });
  const msgs = [];
  page.once('dialog', d => { msgs.push(d.message()); d.dismiss(); });
  await page.locator('.btn-danger').click();
  expect(msgs[0]).toContain('cannot be undone');
  expect(await page.evaluate(() => sessions.map(s => s.id))).toEqual(['k1']);
  expect((await stored(page, 'rtr_sessions')).length).toBe(1);
  expect((await stored(page)).driverName).toBe('Jamie');
  expect(await attr(page, 'data-theme')).toBe('pastel');
});

test('clearAllData wipes sessions, skills, milestones and settings after confirmation', async ({ page }) => {
  await openSettings(page, {
    sessions: [sess({ id: 'w1' }), sess({ id: 'w2' })],
    settings: { driverName: 'Jamie', vibeTheme: 'neon', accentHue: 10, carEmoji: '🚙' },
    skills: { parking: { done: true } }, milestones: ['m1'], deleted: [{ id: 'x', at: '2026-01-01T00:00:00.000Z' }],
  });
  page.once('dialog', d => d.accept());
  await page.locator('.btn-danger').click();
  await expect(page.locator('.toast').first()).toContainText('All data cleared');
  expect(await page.evaluate(() => sessions.length)).toBe(0);
  expect(await stored(page, 'rtr_sessions')).toEqual([]);
  expect(await stored(page, 'rtr_milestones') || []).not.toContain('m1');
  expect(await stored(page, 'rtr_deleted')).toBeNull();
  expect(await stored(page, 'rtr_skills')).toEqual({});
  expect(await stored(page)).toMatchObject({ driverName: '', vibeTheme: 'default', accentHue: 217, carEmoji: '🚗', state: 'CA' });
  expect(await attr(page, 'data-theme')).toBe('default');
  expect(await rootVar(page, '--accent')).toBe('hsl(217,80%,50%)');
  await expect(page.locator('#s-name')).toHaveValue('');
});

test('every theme and accent hue keeps text inks at 4.5:1 on cards and tinted chips', async ({ page }) => {
  await openApp(page);
  const bad = await page.evaluate(() => {
    const out = [];
    const rgbOf = v => { const d = document.createElement('div'); d.style.color = v; document.body.appendChild(d);
      const m = getComputedStyle(d).color.match(/[\d.]+/g).map(Number); d.remove(); return m; };
    for (const vt of ['default', 'dark', 'contrast', 'pastel', 'neon', 'retro', 'midnight']) {
      for (const hue of [0, 60, 120, 217, 280]) {
        settings.vibeTheme = vt; settings.accentHue = hue; applyTheme();
        const cs = getComputedStyle(document.documentElement), card = rgbOf(cs.getPropertyValue('--card')).slice(0, 3).map(x => x / 255);
        for (const k of ['accent', 'green', 'amber', 'purple', 'red']) {
          const ink = rgbOf(cs.getPropertyValue(`--${k}-ink`)).slice(0, 3).map(x => x / 255);
          const lt = rgbOf(cs.getPropertyValue(`--${k}-lt`) || 'transparent');
          const a = lt.length > 3 ? lt[3] : 1, chip = lt.slice(0, 3).map((x, i) => x / 255 * a + card[i] * (1 - a));
          for (const [where, bg] of [['card', card], ['chip', chip]]) {
            const r = contrastRatio(ink, bg);
            if (r < 4.5) out.push(`${vt} hue ${hue} --${k}-ink on ${where}: ${r.toFixed(2)}`);
          }
        }
        const muted = rgbOf(cs.getPropertyValue('--muted')).slice(0, 3).map(x => x / 255);
        if (contrastRatio(muted, card) < 4.5) out.push(`${vt} --muted on card`);
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test('editing a settings field saves once and toasts once (change and blur do not both fire)', async ({ page }) => {
  await openSettings(page);
  await page.evaluate(() => { window.__saves = 0; const o = saveSettings; saveSettings = function () { window.__saves++; return o.apply(this, arguments); }; });
  await page.locator('#s-name').fill('Sam');
  await page.locator('#s-name').blur();
  await page.locator('#s-custom-total').focus();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__saves)).toBe(1);
  expect(await page.locator('.toast', { hasText: 'Settings saved' }).count()).toBe(1);
});

test('form fields that used inline borders now take the accent border on focus', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => ['m-dur-h', 'm-dur-m', 'm-daynight', 'qa-h', 'qa-m'].map(id => {
    const el = document.getElementById(id);
    return [id, el.classList.contains('field-inline'), el.style.border === '' && el.style.borderColor === ''];
  }));
  for (const [id, hasClass, noInline] of r) { expect(hasClass, id).toBe(true); expect(noInline, id).toBe(true); }
  await page.evaluate(() => { openQuickModal(); selectQaDur(document.getElementById('qa-custom-chip')); });
  await page.locator('#qa-h').focus();
  await expect.poll(() => page.locator('#qa-h').evaluate(el => getComputedStyle(el).borderTopColor))
    .toBe(await page.evaluate(() => { const d = document.createElement('div'); d.style.color = 'var(--accent)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }));
});

test('font size buttons expose aria-pressed for the active size', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => navigate('settings'));
  await page.locator('.font-size-btn', { hasText: 'Large' }).click();
  await expect(page.locator('.font-size-btn', { hasText: 'Large' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.font-size-btn', { hasText: 'Small' })).toHaveAttribute('aria-pressed', 'false');
});
