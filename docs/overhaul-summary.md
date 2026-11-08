# Overhaul summary (round 1, 2026-11-07 to 2026-11-08)

Nine phases, one session each, on chained branches `overhaul/phase-1` … `overhaul/phase-9` cut from `master`
at fc757e7. Session 10 (`/land`) merges and deploys. The detail is in `docs/overhaul-state.md` (the ledger)
and `docs/overhaul-findings.md` (every deferred, risky, unsure or refuted finding, with its reason).

Overall: the tests went from 38 to 260, with none left as `fixme`. Code-line coverage went from 81% to 98%,
and the mutation pass killed 127 of 127 mutants. 69 bugs were confirmed and fixed, 22 security findings
were confirmed and most were fixed, 63 simplifications were applied, and 69 UI review issues were triaged.
The app also has a CSP and a cited competitor study. Sync encryption, the blob format and the
`parentSummary` allow-list are unchanged in behaviour.

## What changed in each phase

| Phase | What changed |
|---|---|
| 1 Map | Rewrote `CLAUDE.md` with run and test commands in PowerShell 5.1 syntax and a doc map with line numbers for every area. Decided which phases apply: 6 yes, 7 no, 8 yes. No code changed. |
| 2 Bug hunt | Finder workers per area and bug class, then a skeptic for each finding: 71 found, 69 confirmed. Fixed in four clusters: escaping and sanitising, drive lifecycle, entry and totals, sync and import. Added 48 regression tests. The idle auto-stop now pauses while the page is hidden, and the parent link carries `parentAt`. |
| 3 Tests | Added V8 coverage (`RTR_COVERAGE=1`, `tests/coverage-report.js`) and a mutation runner (`tests/mutate.js`, `tests/mutants/`). Nine new specs took the suite from 86 to 227 tests. Bugs found were pinned as `test.fixme` rather than fixed. |
| 4 Security | 29 findings, 22 confirmed. Fixed: parent-view injection from a forged blob, the history search XSS, Leaflet SRI (SW cache `rtr-v6`), locked PHP rate limits with server-wide caps, a `.revoked` parent marker (410), checks on import timestamps, locations and size, a retry for the legacy delete, and a clipboard fallback. Tests 227 to 238. |
| 5 Clean-up | 120 findings; 63 safe simplifications applied, 38 risky ones logged and left alone. Removed dead code (`--blue*`, `data-dark`, `isInclement` and more). Added shared helpers (`progressLeft`, `newestFirst`, `renderSessionViews`, `applyRemote`), made `computeTotals` one loop, moved test helpers into `tests/helpers.js`, and now require Node 20+. The file is about 100 lines shorter. |
| 6 UI | Added the screenshot and audit harness `tests/screens.shots.js` (3 widths, 7 themes; all 21 audits clean). Added per-theme contrast inks (`applyThemeInks`), 44px targets, modal Escape and focus trap, keyboard-openable rows, ARIA labels, the `#sr-announce` live region, toast queueing, and the desktop layout (a 720px column, sheets as 640px dialogs). Added a meta CSP. Joining a sync code now asks before merging drives, and emailing the code warns first. Tests 238 to 260. |
| 7 Simulation | Skipped: there is no simulation or game to balance. |
| 8 Research | Wrote `docs/research.md`: six market segments, 156 cited sources, the empty-home answer (section 4), 17 ranked features (section 5) and what not to build (section 6). No code changed. |
| 9 Wrap-up | Refreshed the `CLAUDE.md` doc map against the current code: `readytoroll.html` is now 3743 lines, plus new rows for the test files, `tests/screens.shots.js`, `docs/research.md` and the overhaul docs. Wrote this summary. No code changed. |

## What was left

All of these are in `docs/overhaul-findings.md` under the phase named.

**Decisions for landing.** These delete user data or touch deploy or CI config, so no phase could make them.
- Sunset the plaintext legacy v1 sync files. Anyone with an 8-character code can read them, and they never expire. Announce a cut-off first. (Phase 4)
- Expire blobs that have not been touched for, say, 12 months. (Phase 4)
- Pin `actions/checkout` in `deploy.yml` to a commit SHA, and switch SFTP from a password to key auth. (Phase 4)
- Send `frame-ancestors` as a server header; a meta CSP cannot set it. Also move `rtr-sync-data/` and the rate-limit counters out of the webroot and the shared temp folder. (Phases 4 and 6)

**Open bugs, confirmed but deferred.** (Phase 2 unless noted)
- drive-history-1 (high): an in-progress drive lives only in memory, so a reload or a killed tab loses it.
- detail-settings-4: `clearAllData` leaves the cloud blob and the parent token on the server.
- sync-4: a push skipped while offline is never retried.
- quick-parent-milestones-3: the parent view uses the parent's time zone.
- quick-parent-milestones-8: a fresh device launches confetti for every historical milestone.
- home-dashboard-skills-6: days-to-goal is off by one across DST.
- io-manual-sw-11: map tiles are never cached for offline use.
- `setItem` is unguarded in `saveSettings`, `saveSkillsData`, `saveTombstones` and the migration, so a full quota throws.
- Routes are never thinned, so the sync blob grows toward its 2.9 MB cap.
- p3-skill-status: the skills badge and the skills view disagree on an unknown status. (Phase 3)
- Unsure: detail-settings-5, a re-render may discard typed input.

**Protocol and refactor items.** (Phases 4–6)
- Write keys separate from the blob ids. Today the parent token is the id and reaches access logs.
- Move the 98 inline `on*=` handlers to listeners so the CSP can drop `'unsafe-inline'`.
- A focus-restore helper for setters that re-render: theme, car, font size, filter.
- The 38 risky clean-ups from phase 5. One example: `settings.parentToken` (v1) is still written but never read.

**Design polish.** (Phase 6) The empty lower halves of the home and drive-idle views, which research section 4
answers. Also: 9–10px nav labels, a placeholder for when the map fails, retro and neon theme art, and copy and
grid polish.

## Top ten next steps

Ranked by value to the teen and parent, and by risk. Items 1–3 fix real data loss or privacy gaps. The rest
are the research picks (`docs/research.md` section 5; its rank is in brackets).

1. **Checkpoint the live drive** (drive-history-1). Save `activeSession` and its route to localStorage every
   few fixes and offer to resume it at load. Losing a 40-minute drive to a reload is the worst thing that
   can happen in this app. Size S–M.
2. **Make "Clear all data" clear the cloud too** (detail-settings-4). Delete the blob, revoke the parent id,
   and say so in the confirm text. Also retry pushes skipped while offline (sync-4) on `online` and
   `visibilitychange`. Size S.
3. **Decide the legacy v1 sunset and blob expiry** at landing, then implement them with a notice in the app.
   Size S in code; the policy is the work.
4. **State-form print logs, Ohio BMV 5791 first** [1]. Print the log in the official form's layout so the
   printout is the thing the DMV accepts. Size M per state.
5. **Supervisor list** [2]. Name, relation and licence age chosen per drive, kept on the device and out of
   `parentSummary`. Several state forms require it. Size M.
6. **Per-state rules in `STATE_REQS`** [3]. Minimum supervisor age, rules on hours per day, holding period.
   Use `docs/state-requirements.md` as the source. Size M.
7. **Home pace and target date, plus a weekly streak with a freeze** [4, 5]. Put these in place of the tiles
   that repeat the ring card, which answers the phase-6 empty-home items (research section 4). Fix the DST
   off-by-one in days-to-goal at the same time. Size S each.
8. **Forgotten-start backfill and clear screen-off gaps** [7]. Let the teen extend a drive's start time, and
   show GPS gaps as gaps rather than straight lines. Size S.
9. **Reminders without a server** [9] **and a backup-health line** [10]. An `.ics` download and an in-app
   nudge, and "last synced or exported N days ago" on home. Size S each.
10. **Import from RoadReady plus a starting-hours field** [6]. This lets teens who switch apps keep their
    hours. Size M.

After these: road-type and instructor tags [8], a share-card trim [11], a late-night count [13], a
completion certificate [14], and the CSP `'unsafe-inline'` refactor. Several teen profiles [12] and parent
approval [17] are large and need sync protocol work. See research section 6 for what not to build.
