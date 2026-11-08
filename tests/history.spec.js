// History list (filters, search, sort, row open), swipe delete + undo, JSON/CSV export and the print log.
const { test, expect, openApp, sess, newDevice, readStore: read, deletedIds } = require('./helpers');


const SESSIONS = () => [
  sess({ id: 'h-day1', startTime: '2026-10-01T21:00:00.000Z', duration: 30, supervisor: 'Pat Parent', notes: 'parking lot',
    startLocation: { address: '12 Maple Street', city: 'Oakville' } }),
  sess({ id: 'h-night1', startTime: '2026-10-05T04:00:00.000Z', duration: 90, isNight: true, supervisor: 'Uncle Sam', notes: 'highway merge' }),
  sess({ id: 'h-day2', startTime: '2026-09-20T19:00:00.000Z', duration: 45, distance: 12 }),
];

async function openHistory(page, opts = {}) {
  const out = await openApp(page, { clock: new Date('2026-10-10T12:00:00Z'), ...opts });
  await page.evaluate(() => navigate('history'));
  await expect(page.locator('#history-view')).toHaveClass(/active/);
  return out;
}
const rowIds = page => page.locator('#history-content .session-row').evaluateAll(els => els.map(e => e.dataset.id));

test('day and night filters show the right rows, all restores them', async ({ page }) => {
  await openHistory(page, { sessions: SESSIONS() });
  expect((await rowIds(page)).sort()).toEqual(['h-day1', 'h-day2', 'h-night1']);
  await expect(page.locator('.filter-chip.active')).toContainText('All (3)');
  await page.locator('.filter-chip', { hasText: 'Night' }).click();
  expect(await rowIds(page)).toEqual(['h-night1']);
  await expect(page.locator('.filter-chip.active')).toContainText('Night');
  await page.locator('.filter-chip', { hasText: 'Day' }).click();
  expect((await rowIds(page)).sort()).toEqual(['h-day1', 'h-day2']);
  await page.locator('.filter-chip', { hasText: 'All' }).click();
  expect(await rowIds(page)).toHaveLength(3);
});

test('a filter with no matching drives shows the empty state', async ({ page }) => {
  await openHistory(page, { sessions: [sess({ id: 'only-day' })] });
  await page.locator('.filter-chip', { hasText: 'Night' }).click();
  await expect(page.locator('#history-content')).toContainText('No sessions found');
  expect(await rowIds(page)).toEqual([]);
});

test('drives are grouped by month with a drive count and hours total', async ({ page }) => {
  await openHistory(page, { sessions: SESSIONS() });
  const headers = await page.locator('.month-header').allInnerTexts();
  expect(headers).toHaveLength(2);
  expect(headers[0]).toMatch(/october 2026/i);   // CSS upper-cases the label
  expect(headers[0]).toMatch(/2 drives · 2\.0 hrs/);
  expect(headers[1]).toMatch(/september 2026/i);
  expect(headers[1]).toMatch(/1 drive · 0\.8 hrs/);
});

test('search matches location, notes and supervisor, and empty results show the empty state', async ({ page }) => {
  await openHistory(page, { sessions: SESSIONS() });
  const search = page.locator('.history-search');
  await search.fill('maple');                       // start address
  expect(await rowIds(page)).toEqual(['h-day1']);
  await expect(page.locator('.filter-chip', { hasText: 'All' })).toContainText('All (3)');   // count ignores search
  await page.locator('.history-search').fill('MERGE');   // notes, case-insensitive
  expect(await rowIds(page)).toEqual(['h-night1']);
  await page.locator('.history-search').fill('uncle');   // supervisor
  expect(await rowIds(page)).toEqual(['h-night1']);
  await page.locator('.history-search').fill('zzz-nothing');
  await expect(page.locator('#history-content')).toContainText('No sessions found');
  expect(await rowIds(page)).toEqual([]);
});

test('sort menu orders by newest, oldest, longest, shortest and farthest', async ({ page }) => {
  // all in one month, because the list is sorted first and then grouped by month
  await openHistory(page, { sessions: [
    sess({ id: 'a', startTime: '2026-10-01T21:00:00.000Z', duration: 30, distance: 9 }),
    sess({ id: 'b', startTime: '2026-10-02T21:00:00.000Z', duration: 90, distance: 1 }),
    sess({ id: 'c', startTime: '2026-10-03T21:00:00.000Z', duration: 45, distance: 4 }),
  ] });
  const sort = async v => { await page.locator('.history-sort').selectOption(v); return rowIds(page); };
  expect(await rowIds(page)).toEqual(['c', 'b', 'a']);       // newest first
  expect(await sort('oldest')).toEqual(['a', 'b', 'c']);
  expect(await sort('longest')).toEqual(['b', 'c', 'a']);
  expect(await sort('shortest')).toEqual(['a', 'c', 'b']);
  expect(await sort('farthest')).toEqual(['a', 'c', 'b']);
  await expect(page.locator('.history-sort')).toHaveValue('farthest');
});

test('tapping a row opens its detail modal', async ({ page }) => {
  await openHistory(page, { sessions: SESSIONS() });
  await page.locator('.session-row[data-id="h-day1"] .s-title').click();
  await expect(page.locator('#modal')).toHaveClass(/open/);
  expect(await page.evaluate(() => currentDetailSession?.id)).toBe('h-day1');
});

// BUG: the search box value is interpolated into value="..." unescaped, so a quote in the query breaks out of the attribute.
test('search text is escaped when the toolbar is re-rendered', async ({ page }) => {
  await openHistory(page, { sessions: SESSIONS() });
  await page.evaluate(() => { historySearch = '"><img src=x onerror="window.__xss=1">'; renderHistory(); });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('.history-search').inputValue()).toBe('"><img src=x onerror="window.__xss=1">');
});

// Swipe: real TouchEvents on a touch-enabled "device"
async function swipe(page, id, dx) {
  await page.evaluate(([id, dx]) => {
    const row = document.querySelector(`.session-row[data-id="${id}"]`);
    const mk = x => new Touch({ identifier: 1, target: row, clientX: x, clientY: 100 });
    const fire = (type, x, list = true) => row.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true, touches: list ? [mk(x)] : [], changedTouches: [mk(x)] }));
    fire('touchstart', 300);
    fire('touchmove', 300 + dx / 2);
    fire('touchmove', 300 + dx);
    fire('touchend', 300 + dx, false);
  }, [id, dx]);
}

test.describe('swipe to delete', () => {
  let ctx, page, dialogs;
  test.beforeEach(async ({ browser, baseURL }) => {
    ({ ctx, page } = await newDevice(browser, baseURL, { hasTouch: true }));
    dialogs = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  });
  test.afterEach(async () => { await ctx.close(); });

  test('a swipe past the threshold deletes with an undo toast, and undo restores it and clears the tombstone', async () => {
    await openHistory(page, { sessions: SESSIONS() });
    await swipe(page, 'h-day1', -120);
    expect(dialogs).toEqual(['Delete this session?']);
    expect((await rowIds(page)).sort()).toEqual(['h-day2', 'h-night1']);
    expect(deletedIds(await read(page, 'rtr_deleted'))).toContain('h-day1');
    expect((await read(page, 'rtr_sessions')).map(s => s.id)).not.toContain('h-day1');
    await expect(page.locator('#toast')).toContainText('Session deleted');
    await page.locator('#toast button', { hasText: 'Undo' }).click();
    await expect(page.locator('#toast')).toContainText('Session restored');
    expect(deletedIds(await read(page, 'rtr_deleted'))).not.toContain('h-day1');
    expect((await read(page, 'rtr_sessions')).map(s => s.id).sort()).toEqual(['h-day1', 'h-day2', 'h-night1']);
    // (the swipe also changed tabs, see the fixme below, so go back to History to check the rows)
    await page.evaluate(() => navigate('history'));
    expect((await rowIds(page)).sort()).toEqual(['h-day1', 'h-day2', 'h-night1']);
  });

  // BUG: the swipe also bubbles to the #main tab-swipe handler (dx > 50), so deleting a row switches to the next tab,
  // and undo then no longer re-renders the History list.
  test.fixme('swiping a row to delete stays on the History tab', async () => {
    await openHistory(page, { sessions: SESSIONS() });
    await swipe(page, 'h-day1', -120);
    expect(await page.evaluate(() => currentView)).toBe('history');
  });

  test('a short swipe does not delete and the row snaps back', async () => {
    await openHistory(page, { sessions: SESSIONS() });
    await swipe(page, 'h-day1', -40);
    expect(dialogs).toEqual([]);
    expect(await rowIds(page)).toHaveLength(3);
    expect(await page.locator('.session-row[data-id="h-day1"]').evaluate(e => e.style.transform)).toBe('');
    expect(deletedIds(await read(page, 'rtr_deleted'))).toEqual([]);
  });

  test('a rightward swipe never deletes', async () => {
    await openHistory(page, { sessions: SESSIONS() });
    await swipe(page, 'h-day1', 150);
    expect(dialogs).toEqual([]);
    expect((await read(page, 'rtr_sessions')).map(s => s.id).sort()).toEqual(['h-day1', 'h-day2', 'h-night1']);
    expect(deletedIds(await read(page, 'rtr_deleted'))).toEqual([]);
  });

  test('declining the confirm keeps the drive', async () => {
    await openHistory(page, { sessions: SESSIONS() });
    page.removeAllListeners('dialog');
    page.on('dialog', d => d.dismiss());
    await swipe(page, 'h-night1', -120);
    expect(await rowIds(page)).toHaveLength(3);
    expect(deletedIds(await read(page, 'rtr_deleted'))).toEqual([]);
    expect(await page.locator('.session-row[data-id="h-night1"]').evaluate(e => e.style.transform)).toBe('');
  });
});

test('undo stamps the restored drive newer than before so it wins a sync merge', async ({ page }) => {
  await openHistory(page, { sessions: [sess({ id: 'u1', updatedAt: '2026-01-01T00:00:00.000Z' }), sess({ id: 'u2' })] });
  await page.evaluate(() => deleteSession('u1'));
  await page.evaluate(() => undoDelete());
  const stored = (await read(page, 'rtr_sessions')).find(x => x.id === 'u1');
  expect(stored.updatedAt.startsWith('2026-10-10')).toBe(true);
});

// BUG: toast() timers are not cleared by toastUndo(), so a milestone toast shown just before a delete hides the undo toast after 2.8 s.
test.fixme('undo toast stays visible for 5 seconds after a delete that unlocks a milestone', async ({ page }) => {
  await openHistory(page, { sessions: SESSIONS() });
  await page.evaluate(() => { toast('earlier toast'); deleteSession('h-day2'); });
  await page.clock.runFor(3500);
  await expect(page.locator('#toast')).toHaveClass(/show/);
});

test('undo toast expires after 5 seconds and the drive stays deleted', async ({ page }) => {
  await openHistory(page, { sessions: SESSIONS() });
  await page.evaluate(() => checkMilestones());   // earn milestones first, so their toast timer is out of the way
  await page.clock.runFor(3000);
  await page.evaluate(() => deleteSession('h-day2'));
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await page.clock.runFor(4000);
  await expect(page.locator('#toast')).toHaveClass(/show/);   // still undoable after 4 s
  await page.clock.runFor(1200);
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await page.evaluate(() => undoDelete());   // nothing left to undo
  expect(await rowIds(page)).not.toContain('h-day2');
  expect(deletedIds(await read(page, 'rtr_deleted'))).toContain('h-day2');
});

async function downloadFrom(page, fn) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(fn)]);
  const stream = await dl.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk;
  return { name: dl.suggestedFilename(), text };
}

test('JSON export has all drives and tombstones but no sync secrets', async ({ page }) => {
  await openApp(page, {
    sessions: SESSIONS(), deleted: [{ id: 'old-gone', at: '2026-09-01T00:00:00.000Z' }],
    settings: { syncCode: 'SECRET-CODE-123', parentToken: 'tok-abc', parent: 'k', parentAt: 'x', driverName: 'Jamie', state: 'CA' },
  });
  const { name, text } = await downloadFrom(page, () => exportJSON());
  expect(name).toBe('ReadyToRoll.json');
  const data = JSON.parse(text);
  expect(data.sessions.map(s => s.id).sort()).toEqual(['h-day1', 'h-day2', 'h-night1']);
  expect(data.deleted.map(d => d.id)).toEqual(['old-gone']);
  expect(data.settings.driverName).toBe('Jamie');
  for (const k of ['syncCode', 'parentToken', 'parent', 'parentAt']) expect(data.settings).not.toHaveProperty(k);
  expect(text).not.toMatch(/SECRET-CODE-123|tok-abc/);
  expect(typeof data.exported).toBe('string');
});

test('CSV export quotes fields and defuses spreadsheet formulas', async ({ page }) => {
  await openApp(page, { sessions: [
    sess({ id: 'c1', supervisor: '=HYPERLINK("x")', notes: 'line one\nsay "hi", ok', startLocation: { address: '1 Main St, Town' } }),
    sess({ id: 'c2', isNight: true, supervisor: '@evil' }),
    sess({ id: 'c3', supervisor: '+1555' }),
    sess({ id: 'c4', supervisor: '-2+3' }),
    sess({ id: 'c5', supervisor: '|cmd' }),
  ] });
  const { name, text } = await downloadFrom(page, () => exportCSV());
  expect(name).toBe('ReadyToRoll.csv');
  const lines = text.split('\n');
  expect(lines).toHaveLength(6);
  expect(lines[0]).toMatch(/^"ID","Date","Start"/);
  expect(lines[1]).toContain('"\t=HYPERLINK(""x"")"');        // leading tab neutralises the formula
  expect(lines[1]).toContain('"line one say ""hi"", ok"');    // newline flattened, quotes doubled
  expect(lines[1]).toContain('"1 Main St, Town"');
  expect(lines[2]).toContain('"\t@evil"');
  expect(lines[2]).toContain('"Yes"');
  expect(lines[3]).toContain('"	+1555"');
  expect(lines[4]).toContain('"	-2+3"');
  expect(lines[5]).toContain('"	|cmd"');
});

function stubPrintWindow(page) {
  return page.evaluate(() => {
    window.__printed = [];
    window.open = () => ({ document: { write: h => window.__printed.push(h), close() {} } });
  });
}

test('print log has totals, every drive row, supervisor and notes columns, and escapes text', async ({ page }) => {
  await openApp(page, {
    clock: new Date('2026-10-10T12:00:00Z'),
    settings: { driverName: '<script>alert(1)</script>Jamie', state: 'CA' },
    sessions: [
      sess({ id: 'p1', startTime: '2026-10-01T21:00:00.000Z', duration: 60, supervisor: 'Pat <b>Parent</b>', notes: '<img src=x onerror=1>' }),
      sess({ id: 'p2', startTime: '2026-10-02T21:00:00.000Z', duration: 30, supervisor: 'Uncle Sam' }),
      sess({ id: 'p3', startTime: '2026-10-03T21:00:00.000Z', duration: 30, supervisor: 'Aunt May', weather: { code: 0, temp: 71 } }),
    ],
  });
  await stubPrintWindow(page);
  await page.evaluate(() => printLog());
  const html = await page.evaluate(() => window.__printed.join(''));
  expect(html).toContain('<th>Supervisor</th>');
  expect(html).toContain('<th>Notes</th>');
  expect(html).toMatch(/Total Hours:<\/strong> 2\.0 \/ \d+ required/);
  expect(html).toMatch(/Night Hours:<\/strong> 0\.0 \/ \d+ required/);
  const body = html.split('<tbody>')[1].split('</tbody>')[0];
  expect((body.match(/<tr>/g) || [])).toHaveLength(3);
  for (const s of ['Uncle Sam', 'Aunt May', '71°F']) expect(body).toContain(s);
  expect(html).toContain('Skills Checklist');
  expect(html).toContain('Parent/Guardian Signature');
  // untrusted text is escaped everywhere
  expect(html).not.toContain('<script>alert(1)');
  expect(html).not.toContain('<b>Parent</b>');
  expect(html).not.toContain('<img src=x');
  expect(html).toContain('Pat &lt;b&gt;Parent&lt;/b&gt;');
});

test('print rows label day and night drives and cut notes at 40 characters', async ({ page }) => {
  await openApp(page, { clock: new Date('2026-10-10T12:00:00Z'), sessions: [
    sess({ id: 'q1', startTime: '2026-10-01T21:00:00.000Z', duration: 30, notes: 'x'.repeat(50) }),
    sess({ id: 'q2', startTime: '2026-10-05T04:00:00.000Z', duration: 30, isNight: true }),
  ] });
  await stubPrintWindow(page);
  await page.evaluate(() => printLog());
  const html = await page.evaluate(() => window.__printed.join(''));
  const rows = html.split('<tbody>')[1].split('</tbody>')[0].split('</tr>').filter(r => r.includes('<td>'))
    .map(r => [...r.matchAll(/<td>([^<]*)<\/td>/g)].map(m => m[1]));
  const byNotes = rows.find(r => r[8].startsWith('xxx'));
  const night = rows.find(r => !r[8].startsWith('xxx'));
  expect(byNotes[5]).toBe('Day');
  expect(night[5]).toMatch(/^Night/);
  expect(byNotes[8]).toBe('x'.repeat(40));
});

test('print log with zero drives still prints headers, zero totals and an empty table', async ({ page }) => {
  await openApp(page, { sessions: [] });
  await stubPrintWindow(page);
  await page.evaluate(() => printLog());
  const html = await page.evaluate(() => window.__printed.join(''));
  expect(html).toMatch(/Total Hours:<\/strong> 0\.0 \//);
  expect(html).toContain('<tbody></tbody>');
  expect(html).toContain('Driver Signature');
  expect(html).toContain('<script>window.print();</script>');
});

test('print log with pop-ups blocked shows a toast instead of failing', async ({ page }) => {
  await openApp(page, { sessions: SESSIONS() });
  await page.evaluate(() => { window.open = () => null; });
  await page.evaluate(() => printLog());
  await expect(page.locator('#toast')).toContainText('Allow pop-ups');
});
