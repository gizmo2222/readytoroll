# Overhaul state (shared ledger)

Every overhaul session reads this file first and writes to it last. One phase per session, each on
branch `overhaul/phase-N` cut from the previous phase's branch (phase 1 from `master` at fc757e7).
Rules that apply to every phase: do not push, merge or open a PR; the full suite (`npm run test:quiet`,
238 tests after phase 5, 3 of them `test.fixme`) must pass before the phase commit; never touch deploy or CI config, secrets or user data.

| Phase | Name | Status | Branch |
|---|---|---|---|
| 1 | Map | done | overhaul/phase-1 |
| 2 | Bug hunt | done | overhaul/phase-2 |
| 3 | Tests | done | overhaul/phase-3 |
| 4 | Security | done | overhaul/phase-4 |
| 5 | Clean-up | done | overhaul/phase-5 |
| 6 | UI | todo | |
| 7 | Simulation or game balance | todo | |
| 8 | Research | todo | |
| 9 | Wrap-up | todo | |
| 10 | Land | todo | |

## Phase applicability (decided in phase 1)

- Phase 6 (front end?): **yes**. The whole product is a browser PWA (`readytoroll.html`); run it with
  `python -m http.server 3000` or the Playwright server in `tests/serve.js` and screenshot the five views
  plus the modals and the parent view (`?parent=<token>#k=<key>`).
- Phase 7 (simulation or game?): **no**. It is a logging tool with gamified progress (milestones, streaks,
  confetti) but no simulation, scenarios or balance to tune. Skip.
- Phase 8 (a product with competitors?): **yes**. Competing driving-log apps exist (RoadReady, DriversEd
  logs, state DMV apps such as Ohio's, generic hour trackers). Research is worthwhile.

## Phase log

### Phase 1 — Map (done 2026-11-07, branch `overhaul/phase-1`)
- Rewrote `CLAUDE.md`: what the app is, run/test commands in PowerShell 5.1 syntax, and a doc map of
  every area of `readytoroll.html` (CSS, markup, 27 JS areas), `rtr-sync.php`, the service worker, the
  manifest and each test file, with line numbers and key symbols. Design context kept unchanged.
- No code changed. Suite run on this branch before the commit: 38 passed.
- Next phases: the doc map's areas are the natural split for workers. Line numbers are as of phase 1
  and drift; workers should grep the `// NAME` banner or symbol rather than trust them blindly.
  The file is 3508 lines, so give each worker a range, never the whole file.

### Phase 2 — Bug hunt (done 2026-11-07, branch `overhaul/phase-2`)
- Finder workers per doc-map area across five bug classes, then a skeptic per finding: 71 findings,
  69 confirmed, 1 refuted, 1 unsure. Four fix clusters committed in turn (d90f43f escaping and sanitizing,
  b724931 drive lifecycle, 460d4fd entry and totals, 0bbbb08 sync and import); 48 new regression tests.
- Deferred confirmed findings, the unsure one and the leftovers are in `docs/overhaul-findings.md`.
  Decisions: the idle auto-stop no longer runs while the page is hidden (mobile pauses GPS; the resume
  handler restarts the clock), and the parent link now carries `parentAt` (newest wins; 0 after disconnect).
- For phase 3: new specs are sanitize, drive-lifecycle, entry, sync-import; untested still are the share card,
  replay, print layout, onboarding, skills view and the service worker. Fix workers ran one at a time since
  all edit `readytoroll.html`; do the same for test workers that touch it.

### Phase 3 — Tests (done 2026-11-07, branch `overhaul/phase-3`)
- Added V8 coverage (`RTR_COVERAGE=1` + `tests/coverage-report.js`) and a mutation runner (`tests/mutate.js`,
  mutants in `tests/mutants/`); 9 new specs from one writer per module, each followed by a mutator. Tests 86 -> 227,
  code-line coverage 81.1% -> 98.4%, final mutation pass killed 127/127 mutants. No app code changed.
- Bugs found while testing are pinned as `test.fixme` (grep `BUG:` in the specs) and listed in
  `docs/overhaul-findings.md` under Phase 3. For phase 4 (security): the unescaped history search value, the
  `rtr-sync.php` id regex without `D` and the array-id PHP warning; `tests/sync-server.spec.js` exercises the real PHP.
- Decision: phase 3 fixed no bugs (tests only). A fix should flip its fixme to `test(`. Specs that read app files must use
  `helpers.appRoot` so mutation runs see the mutated copy; `coverage/` is git-ignored scratch.

### Phase 4 — Security (done 2026-11-08, branch `overhaul/phase-4`)
- Four reviewers, then one skeptic per finding: 29 findings, 22 confirmed, 6 refuted. Fixed: the parent-view injection; the history search; Leaflet SRI (SW cache `rtr-v6`, and the test stubs strip `integrity`); PHP rate limits that are locked, validated and have server-wide caps on legacy calls and creates; the revoked-parent marker (`.revoked`: a put returns 410, and the client drops the link with `parentAt` 0); timestamp, location and size checks on imports; the legacy-delete retry; and the clipboard fallback. Tests went from 227 to 238, with 3 fixmes left (UI bugs).
- Deferred items and their reasons are in `docs/overhaul-findings.md` under Phase 4. A legacy v1 sunset and blob expiry would both delete user data, so landing decides. Write keys separate from the ids are a protocol change (backlog). Pinning `deploy.yml` and SFTP key auth are CI, so report only.
- For phase 5: `clientKey`, `rateLimit` and the `HTACCESS` constant in `rtr-sync.php`, and the device-only setting `legacyPendingDelete`, are all new. For phase 6: a meta CSP, a confirm step before `connectSyncCode` uploads, and a warning when the code is emailed. The server changes reach users only on deploy.

### Phase 5 — Clean-up (done 2026-11-08, branch `overhaul/phase-5`)
- Eight finders, then a skeptic per finding: 120 findings. 79 judged safe; 63 applied (the other 16 were duplicates or superseded, one reverted) (dead code, the `--blue*` vars and `data-dark`, shared helpers `progressLeft`/`newestFirst`/`renderSessionViews`/`applyRemote`, one-loop `computeTotals`; `readytoroll.html` is about 100 lines shorter), 38 risky ones deferred, 3 refuted. Sync and the `parentSummary` allow-list are untouched in behaviour. Tests stay at 238 (3 fixme).
- Decisions: tests that called removed dead functions now use their replacements, mutant `settings-2` was dropped and 11 stale ones retargeted, the shared test helpers moved into `tests/helpers.js`, and Node 20+ is now required (`engines`, README, CLAUDE.md). F-10(b) was reverted because the `off`/`offline` sync dot rules matter.
- For phase 6: real UI bugs found here and not fixed are B-9 (`#drive` breaks the emailed code), B-13 (quick-add chips keep `aria-checked`), E-13 (double "Settings saved" toast), F-6 (stale help copy), F-13 (inline styles hide the focus border) and B-1/H-11 (two sync error wordings). See `docs/overhaul-findings.md` → Phase 5. The doc map line numbers in CLAUDE.md are about 100 off after the `// Cloud sync` banner; phase 9 refreshes them.
