// Skills view: rendering per status, toggling and persistence, badge/counts, tips, suggestSkill, corrupt stored data.
const { test, expect, openApp } = require('./helpers');

const read = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
const goSkills = async page => { await page.locator('.nav-btn[data-view="skills"]').click(); await expect(page.locator('#skills-view')).toBeVisible(); };
const summary = async page => page.locator('.skills-summary-box .sv').allTextContents();
const row = (page, id) => page.locator(`.skill-row[data-id="${id}"]`);

test('renders every skill grouped by category with all counted as not started', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  const n = await page.evaluate(() => SKILLS.length);
  const cats = await page.evaluate(() => [...new Set(SKILLS.map(s => s.cat))]);
  await expect(page.locator('.skill-row')).toHaveCount(n);
  await expect(page.locator('.skill-category-header')).toHaveCount(cats.length);
  expect(await summary(page)).toEqual(['0', '0', String(n)]);
  await expect(page.locator('.skill-btn.mastered, .skill-btn.in_progress')).toHaveCount(0);
  await expect(page.locator('.cat-fraction').first()).toHaveText(/^0\/\d+ mastered$/);
});

test('stored statuses render as highlighted buttons and correct counts', async ({ page }) => {
  await openApp(page, { skills: {
    steering: { status: 'mastered', lastPracticed: '2026-10-01T00:00:00.000Z' },
    braking: { status: 'in_progress', lastPracticed: '2026-10-01T00:00:00.000Z' },
    acceleration: { status: 'not_started' },
  } });
  await goSkills(page);
  const n = await page.evaluate(() => SKILLS.length);
  await expect(row(page, 'steering').locator('.skill-btn.mastered')).toHaveCount(1);
  await expect(row(page, 'braking').locator('.skill-btn.in_progress')).toHaveCount(1);
  await expect(row(page, 'acceleration').locator('.skill-btn.mastered, .skill-btn.in_progress')).toHaveCount(0);
  expect(await summary(page)).toEqual(['1', '1', String(n - 2)]);
});

test('clicking Learning and Mastered sets status, persists, and updates counts', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  const n = await page.evaluate(() => SKILLS.length);
  await row(page, 'steering').getByRole('button', { name: 'Learning' }).click();
  expect(await summary(page)).toEqual(['0', '1', String(n - 1)]);
  let stored = await read(page, 'rtr_skills');
  expect(stored.steering.status).toBe('in_progress');
  expect(Number.isNaN(Date.parse(stored.steering.lastPracticed))).toBe(false);
  // switching from learning to mastered
  await row(page, 'steering').getByRole('button', { name: 'Mastered' }).click();
  expect(await summary(page)).toEqual(['1', '0', String(n - 1)]);
  stored = await read(page, 'rtr_skills');
  expect(stored.steering.status).toBe('mastered');
  await expect(row(page, 'steering').locator('.skill-btn.mastered')).toHaveCount(1);
  await expect(row(page, 'steering').locator('.skill-btn.in_progress')).toHaveCount(0);
});

test('clicking the active status again resets it to not started', async ({ page }) => {
  await openApp(page, { skills: { steering: { status: 'mastered' } } });
  await goSkills(page);
  const n = await page.evaluate(() => SKILLS.length);
  await row(page, 'steering').getByRole('button', { name: 'Mastered' }).click();
  expect((await read(page, 'rtr_skills')).steering.status).toBe('not_started');
  expect(await summary(page)).toEqual(['0', '0', String(n)]);
});

test('statuses survive a reload', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  await row(page, 'parallel').getByRole('button', { name: 'Mastered' }).click();
  await row(page, 'rain').getByRole('button', { name: 'Learning' }).click();
  await page.reload();
  await page.waitForFunction(() => typeof skillsData !== 'undefined');
  await goSkills(page);
  await expect(row(page, 'parallel').locator('.skill-btn.mastered')).toHaveCount(1);
  await expect(row(page, 'rain').locator('.skill-btn.in_progress')).toHaveCount(1);
});

test('nav badge shows skills not yet started and hides when none are left', async ({ page }) => {
  await openApp(page);
  const n = await page.evaluate(() => SKILLS.length);
  const badge = page.locator('#skills-nav-badge');
  await expect(badge).toHaveText(String(n));
  await expect(badge).toHaveClass(/show/);
  await goSkills(page);
  await row(page, 'steering').getByRole('button', { name: 'Learning' }).click();
  await expect(badge).toHaveText(String(n - 1));
  // toggling back to not started restores the count
  await row(page, 'steering').getByRole('button', { name: 'Learning' }).click();
  await expect(badge).toHaveText(String(n));
  // all started: badge hidden
  await page.evaluate(() => { SKILLS.forEach(s => { skillsData[s.id] = { status: 'in_progress' }; }); updateSkillsBadge(); });
  await expect(badge).not.toHaveClass(/show/);
});

test('category header shows all done once every skill in it is mastered', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { SKILLS.filter(s => s.cat === 'Parking').forEach(s => { skillsData[s.id] = { status: 'mastered' }; }); });
  await goSkills(page);
  await page.evaluate(() => renderSkills());
  const header = page.locator('.skill-category-header', { hasText: 'Parking' });
  await expect(header.locator('.cat-fraction')).toHaveText('✓ All done');
  await expect(page.locator('.skill-category-header', { hasText: 'Conditions' }).locator('.cat-fraction')).toHaveText('0/3 mastered');
});

test('tapping a skill label opens its tips and tapping again or another swaps them', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  const tips = id => page.locator(`#tip-${id}`);
  await expect(page.locator('.skill-tips.open')).toHaveCount(0);
  await row(page, 'braking').locator('.skill-label').click();
  await expect(tips('braking')).toHaveClass(/open/);
  await expect(tips('braking').locator('li')).toHaveCount(3);
  await expect(tips('braking')).toContainText('Begin braking early');
  await row(page, 'rain').locator('.skill-label').click();
  await expect(page.locator('.skill-tips.open')).toHaveCount(1);
  await expect(tips('rain')).toHaveClass(/open/);
  await row(page, 'rain').locator('.skill-label').click();
  await expect(page.locator('.skill-tips.open')).toHaveCount(0);
});

test('suggestSkill picks an unmastered skill, opens its tips and toasts it', async ({ page }) => {
  await openApp(page);
  const ids = await page.evaluate(() => SKILLS.map(s => s.id));
  const mastered = {};
  ids.slice(1).forEach(id => { mastered[id] = { status: 'mastered' }; });   // only the first is left
  await page.evaluate(m => { Object.assign(skillsData, m); }, mastered);
  await goSkills(page);
  await page.locator('.suggest-btn').click();
  await expect(page.locator('#toast')).toContainText('Practice: Steering & Lane Position');
  await expect(page.locator(`#tip-${ids[0]}`)).toHaveClass(/open/);
  await expect(page.locator('.skill-tips.open')).toHaveCount(1);
});

test('suggestSkill never picks a mastered skill', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  const picks = await page.evaluate(() => {
    SKILLS.slice(0, 20).forEach(s => { skillsData[s.id] = { status: 'mastered' }; });
    const mastered = new Set(SKILLS.slice(0, 20).map(s => s.id));
    const out = [];
    for (let i = 0; i < 40; i++) { suggestSkill(); out.push(openSkillTip); }
    return out.map(id => mastered.has(id));
  });
  expect(picks.every(x => x === false)).toBe(true);
});

test('suggestSkill with everything mastered congratulates and opens no tip', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  await page.evaluate(() => { SKILLS.forEach(s => { skillsData[s.id] = { status: 'mastered' }; }); renderSkills(); });
  await page.locator('.suggest-btn').click();
  await expect(page.locator('#toast')).toContainText('All skills mastered');
  await expect(page.locator('.skill-tips.open')).toHaveCount(0);
  const n = await page.evaluate(() => SKILLS.length);
  expect(await summary(page)).toEqual([String(n), '0', '0']);
});

test('corrupt rtr_skills JSON falls back to empty and the view still works', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('rtr_skills', '{not json'));
  await page.reload();
  await page.waitForFunction(() => typeof skillsData !== 'undefined');
  const n = await page.evaluate(() => SKILLS.length);
  await expect(page.locator('#skills-nav-badge')).toHaveText(String(n));
  await goSkills(page);
  expect(await summary(page)).toEqual(['0', '0', String(n)]);
  await row(page, 'signs').getByRole('button', { name: 'Mastered' }).click();
  expect((await read(page, 'rtr_skills')).signs.status).toBe('mastered');
});

test('stored skills with null entries or unknown ids do not break rendering', async ({ page }) => {
  await openApp(page, { skills: { steering: null, braking: { status: 'bogus' }, ghost_skill: { status: 'mastered' } } });
  await goSkills(page);
  const n = await page.evaluate(() => SKILLS.length);
  await expect(page.locator('.skill-row')).toHaveCount(n);
  // unknown ids are ignored in the counts; an unrecognised status counts as not started
  expect(await summary(page)).toEqual(['0', '0', String(n)]);
});

test('nav badge still shows 1 when exactly one skill is not started', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { SKILLS.slice(1).forEach(s => { skillsData[s.id] = { status: 'mastered' }; }); updateSkillsBadge(); });
  const badge = page.locator('#skills-nav-badge');
  await expect(badge).toHaveText('1');
  await expect(badge).toHaveClass(/show/);
});

test('a partly mastered category shows its fraction, not all done', async ({ page }) => {
  await openApp(page, { skills: { parallel: { status: 'mastered' } } });
  await goSkills(page);
  const info = await page.evaluate(() => { const c = SKILLS.filter(s => skillsData[s.id]?.status === 'mastered'); return { cat: c[0].cat, total: SKILLS.filter(s => s.cat === c[0].cat).length }; });
  expect(info.total).toBeGreaterThan(1);
  await expect(page.locator('.skill-category-header', { hasText: info.cat }).locator('.cat-fraction')).toHaveText(`1/${info.total} mastered`);
});

test('mastering flags the button for the flourish but Learning does not', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  await row(page, 'steering').getByRole('button', { name: 'Learning' }).click();
  await page.waitForTimeout(100);
  await expect(page.locator('.skill-btn.just-mastered')).toHaveCount(0);
  await row(page, 'steering').getByRole('button', { name: 'Mastered' }).click();
  await expect(row(page, 'steering').locator('.skill-btn.mastered.just-mastered')).toHaveCount(1);
});

test('suggestSkill launches confetti only when every skill is mastered', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  const calls = await page.evaluate(() => {
    let n = 0; window.launchConfetti = () => { n++; };
    suggestSkill(); const some = n;
    SKILLS.forEach(s => { skillsData[s.id] = { status: 'mastered' }; });
    suggestSkill();
    return [some, n];
  });
  expect(calls).toEqual([0, 1]);
});

test('suggestSkill can pick skills that are in progress as well as not started', async ({ page }) => {
  await openApp(page);
  await goSkills(page);
  const picks = await page.evaluate(() => {
    SKILLS.forEach((s, i) => { skillsData[s.id] = { status: i === 0 ? 'not_started' : i === 1 ? 'in_progress' : 'mastered' }; });
    const seen = new Set();
    for (let i = 0; i < 80; i++) { suggestSkill(); seen.add(openSkillTip); }
    return [...seen].sort();
  });
  const ids = await page.evaluate(() => [SKILLS[0].id, SKILLS[1].id].sort());
  expect(picks).toEqual(ids);
});
