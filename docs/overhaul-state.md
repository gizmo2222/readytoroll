# Overhaul state (shared ledger)

Every overhaul session reads this file first and writes to it last. One phase per session, each on
branch `overhaul/phase-N` cut from the previous phase's branch (phase 1 from `master` at fc757e7).
Rules that apply to every phase: do not push, merge or open a PR; the full suite (`npm run test:quiet`,
260 tests after phase 6, 282 after phase 10, no `test.fixme`) must pass before the phase commit; never touch deploy or CI config, secrets or user data.

| Phase | Name | Status | Branch |
|---|---|---|---|
| 1 | Map | done | overhaul/phase-1 |
| 2 | Bug hunt | done | overhaul/phase-2 |
| 3 | Tests | done | overhaul/phase-3 |
| 4 | Security | done | overhaul/phase-4 |
| 5 | Clean-up | done | overhaul/phase-5 |
| 6 | UI | done | overhaul/phase-6 |
| 7 | Simulation or game balance | skipped | |
| 8 | Research | done | overhaul/phase-8 |
| 9 | Wrap-up | done | overhaul/phase-9 |
| 10 | Land | done | merged into `master` (fc3aff4) |

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

### Phase 6 — UI (done 2026-11-08, branch `overhaul/phase-6`)
- New harness `tests/screens.shots.js` (`npx playwright test --config playwright.shots.config.js`) shot 10 screens plus empty states, onboarding and the parent view at 3 widths in 7 themes and audited contrast, targets under 44px, unnamed controls and CSP errors: 0 issues left in all 21 audits. Fixed: contrast inks computed per theme (`applyThemeInks`), 44px targets, modal Escape and focus trap, keyboard-openable session rows, `aria-pressed`/`aria-label`s, an `#sr-announce` live region, toast queueing behind undo, and every phase-5 ledger bug (B-9, B-13, E-13, F-6, F-13, B-1/H-11). The 3 old fixmes are real passing tests. Suite 238 -> 260.
- Decisions: a meta CSP keeps `unsafe-inline` (98 inline `on*=` handlers and the print window need it), and `frame-ancestors` cannot be set from a meta tag, so it belongs in a server header (deploy config, not touched). `connectSyncCode` asks before merging local drives into the synced log, and emailing the code warns first. Sync encryption and the `parentSummary` allow-list are unchanged. One run hit a Chromium worker crash (0xC0000409) in `sanitize.spec.js:112`; reruns pass, so it is environmental, not a test bug.
- For the next phases: 7 is skipped (not a game). 8 (research) could look at what competitors put on an empty home screen (review items 6/27/36/45/48 are deferred). Deferred UI items, including focus loss on re-render and moving inline handlers off `unsafe-inline`, are in `docs/overhaul-findings.md` → Phase 6. Phase 9 refreshes the doc map: the JS sits about 80 lines lower near `renderHome` and about 220 near `initOnboarding`.

### Phase 7 — Simulation or game balance (skipped 2026-11-08)
- Skipped by the orchestrator: phase 1 recorded that the app has no simulation or game to balance.
- No branch; phase 8 cuts `overhaul/phase-8` from `overhaul/phase-6`.

### Phase 8 — Research (done 2026-11-08, branch `overhaul/phase-8`)
- Wrote `docs/research.md`: six segments (teen log apps, course providers, official apps and state forms, reviews and engagement research, telematics, generic trackers), one research agent and one fact-check agent each. 180 unique sources (156 cited), 10 of 64 checked claims corrected before writing. Sections: landscape with prices, what rivals do better, where ReadyToRoll is ahead, the empty-home answer, 17 ranked features with size and privacy notes, and what not to build.
- Decisions and gaps: no app code changed, so the suite was not rerun (still 260). Reddit blocked automated reads, some Google Play figures are snippets, and DMV.org was unreachable. Permit Pal, DriveTime, Roadcrew, 50 Hours, Smartdrive and Teen Driver Pro were not found in any store. RoadReady's maker is Safe Roads Alliance, not a DMV.
- For phase 9: add `docs/research.md` to the CLAUDE.md doc map. The answer to review items 6/27/36/45/48 is research.md section 4: a first-run panel before any drive, then pace and target date, a weekly streak and backup health in place of the duplicate tiles, and a pre-drive checklist on drive idle. The backlog should draw on section 5. The top five are state-form print (Ohio BMV 5791 first), a supervisor list, per-state rules in `STATE_REQS`, pace and target date, and a weekly streak.

### Phase 9 — Wrap-up (done 2026-11-08, branch `overhaul/phase-9`)
- Refreshed the `CLAUDE.md` doc map: `readytoroll.html` is 3743 lines, and every line was re-derived by grepping symbols. It now covers all 19 specs, `tests/helpers.js`, `tests/screens.shots.js`, `docs/research.md`, the overhaul docs, `package.json` and Node 20+. Wrote `docs/overhaul-summary.md`: the changes by phase, what was left and the top ten next steps. Suite: 260 passed.
- Decisions: the phase was done inline without a workflow, since it is documentation only and the token budget is small. No app code changed. `isInclement` and the skeleton CSS have been removed from the map, because phase 5 deleted them.
- For /land: the decisions landing owns are listed in the summary under "What was left": the legacy v1 sunset, blob expiry, pinning `deploy.yml` with SFTP key auth, and the `frame-ancestors` header. The summary's top ten (live-drive checkpoint, clearing the cloud on clear all, the offline push retry, then the research picks) is the seed for `docs/BACKLOG.md`. The branch chain is phase-1 → … → phase-6 → phase-8 → phase-9.

### Phase 10 — Land (done 2026-11-08, merged into `master` at fc3aff4, deployed as 1.4.34)
- Fixed on `overhaul/phase-9`, each with tests: c55c0a6 (the small-bug batch: `lsSave` quota guard with one toast, the `dl_*` migration guarded, days-to-goal across DST with `Math.round`, an unknown skill status counted as not started, merged or imported milestones recorded silently), f2ca0a5 (the live drive checkpointed to device-only `rtr_active`, with resume or save offered after a reload or crash), 2b1cc54 (Clear all deletes the cloud blob and the parent id, asks again if that fails; device-only `syncDirty` retried on online, visible and load), 7036ccd (`pushSync`/`pullSync` queue through `syncSerial`, so a load-time pull or retry never overlaps a push; it fixed a flaky `sync-import.spec.js:64`). Suite 260 -> 282, green three times (once after the merge).
- `master` had not moved since phase 1, so there was no base merge. Merged with `--no-ff`, pushed `fc757e7..fc3aff4`, and the deploy action ran green (`Bump version to 1.4.34`). Deleted the local `overhaul/phase-1..9` branches and the remote `tests` branch. There were no worktrees or worker branches.
- Smoke check on https://metacrystal.com/readytoroll.html: the page, service worker, manifest and icon all return 200, `APP_VERSION` is 1.4.34, the new code (`syncSerial`, `rtr_active`, `#resume-modal`) is present, `rtr-sync.php` answers a bad request with 400 JSON, `rtr-sync-data/` returns 403, the service worker registers, and a reload in Chrome gave no console or CSP errors.

## Deferred (pick up with /backlog)
Ids refer to `docs/overhaul-findings.md` unless they say otherwise. Line numbers in the `CLAUDE.md` doc map are now about 100 lines off below the Cloud sync area, because of the phase 10 additions. Grep the symbol.
- **Pin `deploy.yml`, and use SFTP key auth** (platform-deploy-pin). `actions/checkout@v5` is a mutable tag in a job with `contents: write`, and `sshpass` signs in by password. Pin the action to a commit SHA, move to an SSH key secret, and keep `.github/known_hosts`. This is a CI change that you declined at landing.
- **DONE 2026-11-08: Legacy v1 sunset and blob expiry** (server-legacy-bruteforce, server-disk-fill). Both delete user data, so they need a policy and an in-app notice first: a cut-off date for the plaintext v1 files, and an expiry for blobs untouched for about 12 months. Deferred by your choice at landing.
- **Server and hosting**: a `frame-ancestors` response header (a meta CSP cannot set it); moving `rtr-sync-data/` out of the webroot (server-storage-in-webroot); rate-limit counters in a private folder, not the shared tmp (server-tmp-ratelimit-files). All three are hosting or deploy config.
- **Write keys separate from ids** (server-id-is-write-capability / crypto-4). Put and delete authorise on the id alone, and the parent token travels in `?parent=`. This is a protocol change on both client and server.
- **Small client bugs**: quick-parent-milestones-3 (the parent view uses the parent's time zone; needs the teen's zone in `parentSummary`, allow-list review), quick-parent-milestones-5 (the quick-add Day/Night chip reflects the sun now, not the backdated interval), quick-parent-milestones-9 ("0.0 total left"), sync-9 (a failing `legacy_delete` after an upgrade shows "Sync error" and hides the new-code toast), io-manual-sw-11 (map tiles are never cached; needs a size-bounded tile cache), detail-settings-5 (unsure: `renderSettings()` drops unblurred typing).
- **Route size** (W2, sync-1). Routes are not thinned or rounded, so long histories grow toward the 2.9 MB sync cap. Thinning changes stored data and needs a design.
- **Phase 5 risky clean-ups**: 38 items in Phase 5 → Risky, not applied, including B-15 (v1 `settings.parentToken` still written).
- **Phase 6 design items**: the focus-restore helper (review 62), moving 98 inline handlers off `unsafe-inline`, theme art (review 15/21/24/25/30), nav label size (review 7), and the map-failure placeholder (review 4/5/39).
- **Features**: `docs/overhaul-summary.md` top ten, items 4-10 (state-form print starting with Ohio BMV 5791, the supervisor list, per-state rules, pace and target date with a weekly streak, forgotten-start backfill, reminders and backup health, RoadReady import). Sources are in `docs/research.md` section 5.
