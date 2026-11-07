# Overhaul state (shared ledger)

Every overhaul session reads this file first and writes to it last. One phase per session, each on
branch `overhaul/phase-N` cut from the previous phase's branch (phase 1 from `master` at fc757e7).
Rules that apply to every phase: do not push, merge or open a PR; the full suite (`npm run test:quiet`,
86 tests after phase 2) must pass before the phase commit; never touch deploy or CI config, secrets or user data.

| Phase | Name | Status | Branch |
|---|---|---|---|
| 1 | Map | done | overhaul/phase-1 |
| 2 | Bug hunt | done | overhaul/phase-2 |
| 3 | Tests | todo | |
| 4 | Security | todo | |
| 5 | Clean-up | todo | |
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
