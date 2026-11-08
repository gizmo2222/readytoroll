// First-run onboarding flow (show/skip rules, steps, validation, saving) and the Help modal.
const { test, expect, openApp, sess, readStore: stored, waitForApp: ready } = require('./helpers');

const FIRST = { onboardingDone: false, driverName: '', state: '' };
const overlay = (page) => page.locator('#onboard-overlay');
const activeStep = (page) => page.evaluate(() => [...document.querySelectorAll('.onboard-step')].filter(s => s.classList.contains('active')).map(s => s.id));
const activeDots = (page) => page.evaluate(() => [...document.querySelectorAll('.onboard-dot')].map(d => d.classList.contains('active')));

test('overlay shows on first run, with step 1 and the state list filled', async ({ page }) => {
  await openApp(page, { settings: FIRST });
  await expect(overlay(page)).toBeVisible();
  expect(await activeStep(page)).toEqual(['ob-1']);
  await expect(page.locator('#ob-name')).toBeVisible();
  expect(await page.locator('#ob-state option').count()).toBeGreaterThanOrEqual(51);
});

test('overlay stays hidden when onboarding is done', async ({ page }) => {
  await openApp(page);
  await expect(overlay(page)).toBeHidden();
});

test('overlay stays hidden for a returning user who has drives', async ({ page }) => {
  await openApp(page, { settings: FIRST, sessions: [sess()] });
  await expect(overlay(page)).toBeHidden();
});

test('overlay stays hidden when a driver name is already stored', async ({ page }) => {
  await openApp(page, { settings: { onboardingDone: false, driverName: 'Sam' } });
  await expect(overlay(page)).toBeHidden();
});

test('step 1 requires a name; blank or whitespace is rejected with a toast', async ({ page }) => {
  await openApp(page, { settings: FIRST });
  await page.locator('#ob-1 .btn-save').click();
  await expect(page.locator('#toast')).toHaveText('Please enter a name');
  expect(await activeStep(page)).toEqual(['ob-1']);
  await page.fill('#ob-name', '   ');
  await page.locator('#ob-1 .btn-save').click();
  expect(await activeStep(page)).toEqual(['ob-1']);
  expect((await stored(page)).driverName).toBe('');
});

test('steps advance 1 to 3 and the progress dots follow', async ({ page }) => {
  await openApp(page, { settings: FIRST });
  expect(await activeDots(page)).toEqual([true, false, false]);
  await page.fill('#ob-name', 'Riley');
  await page.locator('#ob-1 .btn-save').click();
  expect(await activeStep(page)).toEqual(['ob-2']);
  await expect(page.locator('#ob-2')).toBeVisible();
  expect((await activeDots(page))[1]).toBe(true);
  await page.locator('#ob-2 .btn-save').click();
  expect(await activeStep(page)).toEqual(['ob-3']);
  await expect(page.locator('#ob-goal')).toBeVisible();
  expect((await activeDots(page))[2]).toBe(true);
});

test('finishing saves name, state and goal date to rtr_settings and hides the overlay', async ({ page }) => {
  await openApp(page, { settings: FIRST });
  await page.fill('#ob-name', '  Riley ');
  await page.locator('#ob-1 .btn-save').click();
  await page.selectOption('#ob-state', 'TX');
  await page.locator('#ob-2 .btn-save').click();
  await page.fill('#ob-goal', '2027-03-15');
  await page.locator('#ob-3 .btn-save').click();
  await expect(overlay(page)).toBeHidden();
  const s = await stored(page);
  expect(s.driverName).toBe('Riley');
  expect(s.state).toBe('TX');
  expect(s.goalDate).toBe('2027-03-15');
  expect(s.onboardingDone).toBe(true);
});

test('the goal date is optional and the state defaults to CA', async ({ page }) => {
  await openApp(page, { settings: FIRST });
  await page.fill('#ob-name', 'Riley');
  await page.locator('#ob-1 .btn-save').click();
  await page.locator('#ob-2 .btn-save').click();
  await page.locator('#ob-3 .btn-save').click();
  await expect(overlay(page)).toBeHidden();
  const s = await stored(page);
  expect(s.goalDate || '').toBe('');
  expect(s.state).toBe('CA');
  expect(s.onboardingDone).toBe(true);
});

test('onboarding never shows again after a reload', async ({ page }) => {
  await openApp(page, { settings: FIRST });
  await page.fill('#ob-name', 'Riley');
  await page.locator('#ob-1 .btn-save').click();
  await page.locator('#ob-2 .btn-save').click();
  await page.locator('#ob-3 .btn-save').click();
  await page.reload();
  await ready(page);
  await expect(overlay(page)).toBeHidden();
  expect((await stored(page)).driverName).toBe('Riley');
});

test('abandoning onboarding midway does not mark it done', async ({ page }) => {
  await openApp(page, { settings: FIRST });
  await page.fill('#ob-name', 'Riley');
  await page.locator('#ob-1 .btn-save').click();
  await page.reload();
  await ready(page);
  expect((await stored(page)).onboardingDone).toBe(false);
  await expect(overlay(page)).toBeVisible();
  expect(await activeStep(page)).toEqual(['ob-1']);
});

test('help modal opens from the header button and closes with the close button', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#help-modal')).not.toHaveClass(/open/);
  await page.locator('#avatar').click();
  await expect(page.locator('#help-modal')).toHaveClass(/open/);
  await expect(page.locator('#help-modal h3')).toHaveText('ReadyToRoll Help');
  await page.locator('#help-modal .close-btn').click();
  await expect(page.locator('#help-modal')).not.toHaveClass(/open/);
});

test('help modal moves focus inside and returns it to the trigger on close', async ({ page }) => {
  await openApp(page);
  await page.locator('#avatar').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#help-modal')).toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => !!document.activeElement.closest('#help-modal'))).toBe(true);
  await page.locator('#help-modal .close-btn').click();
  await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('avatar');
});

test('Escape closes the help modal', async ({ page }) => {
  await openApp(page);
  await page.locator('#avatar').click();
  await expect(page.locator('#help-modal')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-modal')).not.toHaveClass(/open/);
});

test('help copy matches the app: skill categories, code length, button names, search fields', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => ({
    cats: new Set(SKILLS.map(s => s.cat)).size, n: SKILLS.length,
    len: genSyncCode().replace(/[^A-Z0-9]/gi, '').length,
    txt: document.getElementById('help-modal').innerText,
  }));
  expect(r.txt).toContain(`${r.n} skills across ${r.cats} categories`);
  expect(r.txt).toContain(`${r.len}-character code`);
  expect(r.txt).not.toContain('Share Parent View Link');
  expect(r.txt).toContain('Create & Share');
  expect(r.txt).toMatch(/Search by address, notes, or supervisor/);
  expect(r.txt).not.toMatch(/Search by location, supervisor, or tag/);
});

test('onboarding inputs are labelled and each step focuses its first input', async ({ page }) => {
  await openApp(page, { settings: FIRST });
  await expect(page.locator('#ob-name')).toBeFocused();
  await page.locator('#ob-name').fill('Sam');
  await page.locator('#ob-1 .btn-save').click();
  await expect(page.locator('#ob-state')).toBeFocused();
  await page.locator('#ob-2 .btn-save').click();
  await expect(page.locator('#ob-goal')).toBeFocused();
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('#onboard-overlay input,#onboard-overlay select')]
    .filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map(e => e.id));
  expect(unlabeled).toEqual([]);
});
