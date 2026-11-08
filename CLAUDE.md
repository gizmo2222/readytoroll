# ReadyToRoll — Project Guidelines

## What it is
A single-file progressive web app for teens logging supervised driving hours toward a learner's permit:
GPS routes, weather, a sun-based day/night split, state hour requirements, milestones, a skills checklist,
and an end-to-end-encrypted cloud sync with a read-only parent view. Live at
`https://metacrystal.com/readytoroll.html`.

## Tech Stack
`readytoroll.html` (~3750 lines). Vanilla HTML/CSS/JS — no framework, no build step.
- Maps: Leaflet.js (CDN, `unpkg.com/leaflet@1.9.4`)
- Weather: Open-Meteo (free, no key)
- Geocoding: Nominatim/OpenStreetMap
- Sync backend: `rtr-sync.php` (flat-file PHP, SFTP-deployed via GitHub Actions). **End-to-end encrypted**: the app seals everything with WebCrypto before upload; the server only stores blobs by ID and can't read them. Never send drive data, the sync code, or keys to the server in the clear. The parent summary (`parentSummary()`) must not include routes, locations/addresses, supervisor details or notes. See README → Cloud Sync Backend.
- Content Security Policy: a `<meta http-equiv="Content-Security-Policy">` at the top of `<head>`. A new external host (script, style, image, fetch) must be added there or the browser blocks it; `tests/sanitize.spec.js` fails on any CSP console error.
- Service worker: `rtr-service-worker.js` (cache name `rtr-v6`, network-first for HTML), registered with scope `./readytoroll.html` so it never controls other metacrystal.com pages. PWA files are all `rtr-`-prefixed. Bump the cache name when cached assets change.

## Storage
`localStorage` keys: `rtr_settings`, `rtr_sessions`, `rtr_skills`, `rtr_milestones`, `rtr_deleted`,
`rtr_active` (checkpoint of the in-progress drive, device-only: never synced, exported or in `parentSummary`; removed on stop, discard and clear all)
(tombstones `[{id,at}]`; older builds stored plain id strings). Old `dl_*` keys are migrated once at load.

## Build, run, test (Windows PowerShell 5.1)
There is no build. To run the app locally (GPS needs HTTPS or localhost):

```powershell
python -m http.server 3000
```

Then open `http://localhost:3000/readytoroll.html`. The tests use Playwright against a stubbed network
(Leaflet, tiles, Open-Meteo, Nominatim and `rtr-sync.php` are all faked; any other request is blocked).
Node 20+ is required. First time only:

```powershell
npm install
```

```powershell
npx playwright install chromium
```

Run the suite (276 tests; under a minute; it starts its own server on port 4173).
`tests/sync-server.spec.js` runs the real `rtr-sync.php` under `php -S` and skips itself if `php` is not on PATH:

```powershell
npm run test:quiet
```

One file, or headed:

```powershell
npx playwright test tests/sync.spec.js
```

```powershell
npx playwright test --headed
```

Tests run in `America/Los_Angeles` unless a test sets its own zone. Uncaught page errors fail the test.

Coverage (V8, the app's inline script; writes `coverage/report.txt` with never-called functions and unexecuted lines):

```powershell
$env:RTR_COVERAGE = '1'; npx playwright test --reporter=dot; Remove-Item Env:RTR_COVERAGE
```

```powershell
node tests/coverage-report.js
```

UI review screenshots (`tests/screens.shots.js`, not part of the suite): every view, modal, empty state, onboarding and the parent view at
phone, tablet and desktop widths and in each theme, into `coverage/shots/` with an audit per width and theme in
`coverage/shots/audit/` (contrast, targets under 44px, unnamed controls, CSP errors). Narrow a run with
`$env:RTR_SHOTS_WIDTHS='phone'` or `$env:RTR_SHOTS_THEMES='dark,neon'`:

```powershell
npx playwright test --config playwright.shots.config.js
```

Mutation check: each `tests/mutants/<module>.json` lists exact find/replace edits and the specs that must catch them.
`tests/mutate.js` applies each to a copy in `coverage/`, runs those specs, and reports to `coverage/mutation-<port>.txt`
(the whole set takes a long time; run one module, or `--only id1,id2`):

```powershell
node tests/mutate.js tests/mutants/skills.json --port 4399
```

## Deploy
Push to `master` → GitHub Actions bumps patch version in `version.txt`, stamps `APP_VERSION` into HTML, SFTPs to `metacrystal.com` (host keys pinned in `.github/known_hosts`). New files that must ship need adding to the workflow's upload list. Always `git pull --rebase origin master` before pushing to avoid version-bump conflicts.

## Doc map
Line numbers are for `readytoroll.html` (3743 lines) as refreshed in overhaul phase 9 (2026-11-08). They drift as
code changes; search for the symbol or the `// NAME` banner when in doubt. Never read the file whole:
open the range you need.

### readytoroll.html — head, CSS and markup
| Area | Lines | Key symbols |
|---|---|---|
| Head | 1–15 | CSP `<meta>` 5 (keeps `unsafe-inline`: inline `on*=` handlers and the print window need it), Leaflet with SRI 15 |
| CSS tokens and themes | 16–66 | `:root` 18, `[data-theme="dark"]` 32, `contrast` 38, reduced motion 51; pastel/neon/retro/midnight themes 285–288 |
| Nav, views, cards | 67–127 | `#nav` 69, `.view` 79–85 (slide animations), `.card` 89, `.start-fab` 126 |
| Drive map and overlays | 128–160 | `#drive-map` 130, `#compass-el` 151, `.car-map-marker` 155, hue slider 156 |
| Modals and toasts | 213–280 | `.modal-overlay` 215, `.modal-sheet` 217 (bottom sheets), elevation/replay 235, `#onboard-sheet` 243, `.toast` 278 |
| Print, themes, motion, sync, parent | 281–394 | `@media print` 283, pulse/streak/nudge 294–302, `.sync-code-box` 340, `#parent-overlay` 355, keyframes 378–392 |
| Hover, 44px targets, desktop | 395–430 | `@media(hover:hover)` 395, phase-6 touch-target rules 414, `@media (min-width:700px)` 424 |
| Page shell | 433–464 | `#header` 434, `#main` 440 with `#home-view` 441, `#drive-view` 443, `#skills-view`/`#history-view`/`#settings-view` 451–453, `<nav id="nav">` 456 |
| Modal markup | 466–716 | `#modal` (detail) 466, `#help-modal` 486, `#manual-modal` 574, `#onboard-overlay` 623, `#quick-modal` 655, `#parent-overlay` 707, `#confetti-canvas` 714, `#sr-announce` live region 715 |

### readytoroll.html — JavaScript (one `<script>` 717–3741)
| Area | Lines | Key symbols |
|---|---|---|
| State requirements | 720–797 | `APP_VERSION` 720, `STATE_REQS` 725 (all 50 states + DC; audit in `docs/state-requirements.md`), `WX_DESC` 779, `wxEmoji` 790 |
| Skills, milestones, themes, tips | 798–913 | `SKILLS` 800, `MILESTONES` 829, `ACCENT_COLORS` 849, `VIBE_THEMES` 858, `CAR_EMOJIS` 868, `DRIVING_TIPS` 870 |
| App state | 914–954 | `dl_*` migration IIFE 917, `settings`/`sessions`/`skillsData`/`activeSession` 926–929, `gpsWatchId`/`wakeLock` 934, `syncStatus` 942, history filters 947–949 |
| Persistence | 955–1045 | tombstones `addTombstones` 967, `loadTombstones` 975, `saveDeletedId` 981, `loadSettings` 991, `defaultSettings` 1005, `loadSessions`/`saveSessions` 1010–1015, `onSessionsChanged` 1024, `renderSessionViews` 1031, `loadSkillsData` 1037, `genId` 1043 |
| Theme / accent / font | 1046–1121 | `accentHsl` 1048, WCAG maths `relLum`/`contrastRatio`/`readableHsl` 1053–1059, `applyThemeInks` 1064 (per-theme contrast inks), `applyTheme` 1090, `updateAvatar` 1102, `getTipOfDay` 1109, `handbookLinkHTML` 1115 |
| Requirements and stats | 1122–1250 | `getReqs` 1126, `weatherFlags` 1138 (its `.inclement`), `sunAltitude` 1150, `nightMinutes` 1159, `STATE_CENTER` 1169, `applyNightSplit` 1189, `sessionNightMin` 1199, `computeTotals` 1206, `getTotals` 1233, `newestFirst` 1236, `getStreak` 1241 |
| GPS permission | 1251–1277 | `checkGpsPermission` 1253, `gpsWarnHTML` 1266 |
| Cloud sync (E2E) | 1278–1686 | constants 1317 (`SYNC_KDF_ITER` 310000), `isLegacyCode` 1334 (old 8-char codes: dropped at load ~940, rejected in connect), `genSyncCode` 1335, `deriveSyncKeys` 1347, `seal`/`unseal` 1363–1369, `syncCall` 1375, `parentSummary` 1383 (allow-list!), `mergeSyncData` 1397, `createSyncCode` 1424, `connectSyncCode` 1439 (asks before merging local drives), `SYNC_MAX_BLOB` 1462, `applyRemote` 1476, `pushSync` 1485, `pullSync` 1486, `scheduleSyncPush` 1544 (4 s debounce), `disconnectSync` 1567, `syncCodeHTML` 1615, `emailSyncCode` 1661 (warns first) |
| Quick add | 1687–1753 | `openQuickModal` 1689, `selectQaDur`/`selectQaDN` 1710–1720, `saveQuickDrive` 1730 |
| Parent read-only view | 1754–1844 | `computeEarnedMilestones` 1756, `initParentView` 1764 |
| Records, badges, milestones, confetti | 1845–1997 | `getPersonalRecords` 1847, `updateSkillsBadge` 1878, `checkMilestones` 1889, confetti IIFE 1909–1984 (`launchConfetti` 1967), `milestonesHTML` 1985 |
| Weekly chart and navigation | 1998–2084 | `weeklyChartHTML` 2000, `navigate` 2050, swipe handlers 2072 |
| Home and dashboard | 2085–2342 | `renderHome` 2087, `renderDashboard` 2183, `progressLeft` 2260, `goalCard` 2261, `progressRing` 2303, `sessionRowHTML` 2317, `emptyStateHTML` 2335 |
| Skills view | 2343–2419 | `renderSkills` 2345, `toggleTip` 2384, `setSkill` 2390, `suggestSkill` 2406 |
| Drive view (live GPS) | 2420–2693 | `renderDrive` 2423, `initDriveMap` 2453, `renderDrivePanel` 2481, `startDrive` 2505, `handleFirstFix` 2545, `onPosition` 2572, `checkStopDetection` 2607 (idle warn 5 min, auto-stop 10 min, not while hidden), `updateCompass` 2637, `stopDrive` 2646 |
| History | 2694–2785 | `renderHistory` 2696, `setupSwipeDelete` 2758, `setFilter` 2783 |
| Session detail modal | 2786–3068 | `showSessionDetail` 2790, `buildElevationSVG`/`buildSpeedSVG` 2830–2845, `initDetailMap` 2868, `startReplay` 2884, `shareSession` 2905 (canvas card), `closeModal` 3041, `saveNotes` 3050, `deleteSession` 3057 |
| Settings | 3069–3210 | `renderSettings` 3071, `previewState` 3152, `saveSettingsForm` 3161, accent/font/theme/car setters 3187–3195, `clearAllData` 3201 |
| Export / import / print | 3211–3417 | `DEVICE_ONLY_SETTINGS` (search for it), `exportPayload`/`exportJSON` 3215–3219, `cleanImportedSession` 3230, `cleanImportedSettings` 3260, `applyImport` 3293, `exportCSV` 3340, `importData` 3355, `printLog` 3380 |
| Weather and geocoding | 3418–3442 | `fetchJSON` 3421, `fetchWeather` 3426, `reverseGeocode` 3433 |
| Manual entry and help | 3443–3563 | `openManualModal` 3448, `closeManualModal` 3487, `openHelp` 3490, modal Escape and focus-trap `keydown` handler 3491, `closeHelp` 3503, `saveManualDrive` 3506 |
| Helpers | 3564–3633 | `esc` 3567, `haversineMeters` 3570, `routeDistMiles` 3576, `fmtDur`/`fmtTime`/`fmtDate` 3586–3592, `TAG_LABELS` 3595, `toast` 3600 (queues behind undo, writes `#sr-announce`), `toastUndo`/`undoDelete` 3609–3621 |
| Onboarding | 3634–3675 | `initOnboarding` 3636, `obNext` 3650, `obFocus` 3664, `obFinish` 3666 |
| Init | 3676–3741 | service worker registration 3679, parent-view detection 3688, `#drive` shortcut 3703, GPS check 3711, pull sync on load 3717, visibility handler 3729 |

### Other files
| File | Lines | What |
|---|---|---|
| `rtr-sync.php` | 179 | CORS 20–38, `MAX_BLOB_BYTES` 42 (3 MB), `BLOB_TTL_DAYS` 43 (365), `HTACCESS` 47, `respond`/`err` 58–59, `clientKey` 63, `rateLimit` 68 (locked, with server-wide caps), `blobPath` 97, `isParentId`/`revokedPath` 105–106, `sweepExpired` 109 (once a day via `.last-sweep`, deletes `*.blob`/`*.revoked` older than the TTL by mtime; run before the switch for get/put/delete), actions `get` 132, `put` 148 (410 on a revoked parent id), `delete` 168 (leaves a `.revoked` marker); legacy v1 actions are gone (Unknown action). Data in `rtr-sync-data/` (git-ignored, `.htaccess`-denied) |
| `rtr-service-worker.js` | 115 | `CACHE` 9 (`rtr-v6`), `STATIC` 10, `isCacheFirst` 20, install 26, activate 37, fetch 46, sync 95, push 104 |
| `rtr-manifest.json` | 24 | PWA manifest; `#drive` shortcut; icons `rtr-icon-192.svg`, `rtr-icon-512.svg` |
| `package.json` | | Dev-only harness: `@playwright/test`, `engines.node >=20`, scripts `test`, `test:quiet`, `serve` |
| `tests/helpers.js` | 198 | `fakeGeolocation` 16, `seedStorage` 32, `test` fixture 52 (coverage hook, page-error check), `openApp` 74 (stubs every network call, fake sync server, strips Leaflet `integrity`), `sess` 133, `newDevice` 146, shared `drive`/`startDriving`/`manual`/`pair` 156–184, `appRoot` 196 |
| `tests/totals.spec.js` | 111 | Hour totals, sun split across sunset/midnight/DST/time zones, manual and quick-add |
| `tests/sessions.spec.js` | 79 | Live drives, auto-stop, edits, deletes, tombstones |
| `tests/milestones.spec.js` | 97 | Streaks, milestones, inclement weather, parent view |
| `tests/importexport.spec.js` | 78 | JSON/CSV export and import, secrets kept out |
| `tests/sync.spec.js` | 101 | No plaintext on the wire, parent allow-list, two-device merges |
| `tests/drive-lifecycle.spec.js` | 112 | Start/stop races, GPS errors, geocode after save |
| `tests/entry.spec.js` | 192 | Manual and quick-add validation |
| `tests/sanitize.spec.js` | 249 | Escaping of rendered fields, import sanitising, parent-view injection, CSP console errors |
| `tests/sync-import.spec.js` | 327 | Sync and import data-loss cases |
| `tests/home-drive.spec.js` | 223 | GPS permission, swipe nav, storage fallbacks, inclement codes, skills badge, timers, compass |
| `tests/skills.spec.js` | 225 | Skills view, statuses, tips, suggestions |
| `tests/onboarding.spec.js` | 163 | Onboarding steps, help modal, modal Escape and focus trap |
| `tests/settings.spec.js` | 273 | Settings form, theme/accent/font/car setters, contrast inks, clear all |
| `tests/detail.spec.js` | 290 | Detail modal, elevation/speed SVGs, replay, share card, notes, delete |
| `tests/history.spec.js` | 390 | Filters, search, swipe delete, undo, toast queue, JSON/CSV export, print |
| `tests/sync-lifecycle.spec.js` | 357 | Create/connect sync, old-code rejection and drop at load, connect confirm, parent link and revoke, copy/email code |
| `tests/service-worker.spec.js` | 197 | `rtr-service-worker.js` in a Node `vm` (install, activate, fetch strategies) plus registration |
| `tests/sync-server.spec.js` | 371 | Real `rtr-sync.php` under `php -S`: actions, caps, CORS, rate limits, revoked marker, legacy actions 400, 12-month expiry sweep |
| `tests/screens.shots.js`, `playwright.shots.config.js` | 150 | UI review screenshots and audits (not part of the suite; see Build, run, test) |
| `tests/coverage-report.js`, `tests/mutate.js`, `tests/mutants/` | | Coverage report and mutation runner (see Build, run, test). `RTR_SERVE_ROOT` / `RTR_TEST_PORT` point a run at a copy; `helpers.appRoot` is that folder |
| `tests/serve.js`, `playwright.config.js` | | Static server on 4173; Chromium, service workers blocked |
| `.github/workflows/deploy.yml` | | Version bump + SFTP upload list |
| `docs/state-requirements.md` | | Audit of `STATE_REQS` against official sources (checked 2026-11-05) |
| `docs/research.md` | 393 | Competitor research (phase 8): landscape and prices, what rivals do better, the empty-home answer (section 4), 17 ranked features (section 5), what not to build |
| `docs/overhaul-state.md`, `docs/overhaul-findings.md`, `docs/overhaul-summary.md` | | Overhaul ledger, deferred and unconfirmed findings per phase, and the end-of-overhaul summary with the top ten next steps |

---

## Design Context

### Users
Primarily **teenagers (16–17) working toward their learner's permit**. They use the app daily — before, during, and after supervised drives — often in the car with a parent watching. The parent view gives supervisors a read-only window into progress. The primary emotional job is **keeping the teen motivated** through what can be a long, repetitive grind (50–60+ hours in many states). Progress milestones, confetti, and streaks all serve this goal.

### Brand Personality
**Encouraging, friendly, fresh.**
The app celebrates every win — a new milestone, a streak, hitting 50% — without being cloying or childish. It earns trust through competence (real GPS, real weather, accurate state requirements) while staying approachable. Tone is warm and direct, never condescending.

### Aesthetic Direction
**Duolingo / Strava energy** — gamified progress that feels earned, clear stats, strong accent color, badges and streaks with genuine visual weight.
- Progress rings, mini-bars, and weekly charts are first-class UI elements, not afterthoughts
- Milestones should feel rewarding to unlock (opacity shift, confetti)
- Drive mode is the hero interaction — focused, uncluttered, map-first
- Themes (Pastel, Neon, Retro, Midnight, Dark, Hi-Contrast) let teens personalise without breaking usability

**Anti-references:** avoid sterile enterprise SaaS, government-form aesthetics, overly childish/cartoon UI.

### Design Principles
1. **Celebrate progress visibly.** Every logged hour, milestone, and streak should feel like a small win. Use motion, color, and weight deliberately for positive reinforcement.
2. **Drive mode gets maximum focus.** When the app is tracking a live session, all UI chrome steps back. Speed is large, controls are large, map fills the screen.
3. **Hierarchy over decoration.** Strong typographic hierarchy (weight + size) does the heavy lifting. Accent color is used sparingly for actions and live data — not as background fill.
4. **Theme-aware but never broken.** All six vibe themes must read cleanly. No semantic color (green=go, red=stop, amber=day, purple=night) should lose contrast in any theme.
5. **WCAG AA baseline, always.** 4.5:1 body text, 3:1 UI components. Focus rings on all interactive elements. Reduced-motion support. Touch targets ≥ 44px.

### Design Tokens (current)
- **Accent:** `hsl(accentHue, 80%, 50%)` — default hue 217 (blue). User-customisable via hue slider.
- **Semantic colors:** `--green` start/success, `--red` stop/danger, `--amber` day/warning, `--purple` night
- **Radius:** `--radius: 14px` (cards), 10px (inputs), 99px (pills/badges)
- **Font:** System stack — `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Nav height:** 60px bottom nav; modals are bottom-sheets (border-radius 20px top)
