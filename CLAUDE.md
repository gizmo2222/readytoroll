# ReadyToRoll — Project Guidelines

## What it is
A single-file progressive web app for teens logging supervised driving hours toward a learner's permit:
GPS routes, weather, a sun-based day/night split, state hour requirements, milestones, a skills checklist,
and an end-to-end-encrypted cloud sync with a read-only parent view. Live at
`https://metacrystal.com/readytoroll.html`.

## Tech Stack
`readytoroll.html` (~3500 lines). Vanilla HTML/CSS/JS — no framework, no build step.
- Maps: Leaflet.js (CDN, `unpkg.com/leaflet@1.9.4`)
- Weather: Open-Meteo (free, no key)
- Geocoding: Nominatim/OpenStreetMap
- Sync backend: `rtr-sync.php` (flat-file PHP, SFTP-deployed via GitHub Actions). **End-to-end encrypted**: the app seals everything with WebCrypto before upload; the server only stores blobs by ID and can't read them. Never send drive data, the sync code, or keys to the server in the clear. The parent summary (`parentSummary()`) must not include routes, locations/addresses, supervisor details or notes. See README → Cloud Sync Backend.
- Service worker: `rtr-service-worker.js` (cache name `rtr-v5`, network-first for HTML), registered with scope `./readytoroll.html` so it never controls other metacrystal.com pages. PWA files are all `rtr-`-prefixed. Bump the cache name when cached assets change.

## Storage
`localStorage` keys: `rtr_settings`, `rtr_sessions`, `rtr_skills`, `rtr_milestones`, `rtr_deleted`
(tombstones `[{id,at}]`; older builds stored plain id strings). Old `dl_*` keys are migrated once at load.

## Build, run, test (Windows PowerShell 5.1)
There is no build. To run the app locally (GPS needs HTTPS or localhost):

```powershell
python -m http.server 3000
```

Then open `http://localhost:3000/readytoroll.html`. The tests use Playwright against a stubbed network
(Leaflet, tiles, Open-Meteo, Nominatim and `rtr-sync.php` are all faked; any other request is blocked).
Node 18+ is required. First time only:

```powershell
npm install
```

```powershell
npx playwright install chromium
```

Run the suite (227 tests, 7 of them `test.fixme` for known bugs; under a minute; it starts its own server on port 4173).
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

Mutation check: each `tests/mutants/<module>.json` lists exact find/replace edits and the specs that must catch them.
`tests/mutate.js` applies each to a copy in `coverage/`, runs those specs, and reports to `coverage/mutation-<port>.txt`
(the whole set takes a long time; run one module, or `--only id1,id2`):

```powershell
node tests/mutate.js tests/mutants/skills.json --port 4399
```

## Deploy
Push to `master` → GitHub Actions bumps patch version in `version.txt`, stamps `APP_VERSION` into HTML, SFTPs to `metacrystal.com` (host keys pinned in `.github/known_hosts`). New files that must ship need adding to the workflow's upload list. Always `git pull --rebase origin master` before pushing to avoid version-bump conflicts.

## Doc map
Line numbers are for `readytoroll.html` at the start of the overhaul (phase 1, 2026-11-07) and drift as
code changes; search for the symbol or the `// NAME` banner when in doubt. Never read the file whole:
open the range you need.

### readytoroll.html — markup and CSS
| Area | Lines | Key symbols |
|---|---|---|
| CSS tokens and themes | 15–66 | `:root` 17, `[data-theme="dark"]` 28, `contrast` 35, reduced motion 50; pastel/neon/retro/midnight themes 299–302 |
| Nav, views, cards | 67–132 | `#nav` 68, `.view` 78–84 (slide animations), `.card` 88, skeleton 126–130 |
| Drive map and overlays | 133–160 | `#drive-map` 133, compass 153, car marker 157, hue slider 159 |
| Modals and toasts | 226–294 | `.modal-overlay` 226 (bottom sheets), elevation/replay 245–248, `.toast` 292 |
| Print, parent overlay, motion | 295–432 | `@media print` 297, pulse/streak/nudge 307–326, `#parent-overlay` 373, keyframes 388–414 |
| Page shell | 435–467 | `#header` 436, `#main` 442 with `#home-view`, `#drive-view`, `#skills-view`, `#history-view`, `#settings-view` 443–455, `<nav id="nav">` 458 |
| Modal markup | 468–716 | `#modal` (detail) 468, `#help-modal` 488, `#manual-modal` 576, `#onboard-overlay` 624, `#quick-modal` 656, `#parent-overlay` 708 |

### readytoroll.html — JavaScript (one `<script>` 718–3506)
| Area | Lines | Key symbols |
|---|---|---|
| State requirements | 724–798 | `APP_VERSION` 721, `STATE_REQS` 726 (all 50 states + DC; audit in `docs/state-requirements.md`), `WX_DESC` 780, `wxEmoji` 791 |
| Skills, milestones, themes, tips | 799–914 | `SKILLS` 801, `MILESTONES` 830, `ACCENT_COLORS` 850, `VIBE_THEMES` 859, `CAR_EMOJIS` 869, `DRIVING_TIPS` 871 |
| App state | 915–946 | `settings`, `sessions`, `skillsData`, `activeSession`, map/GPS/wake-lock handles, sync status, history filters 917–944 |
| Persistence | 947–1029 | `dl_*` migration 950, tombstones `addTombstones`/`loadTombstones`/`saveDeletedId` 962–978, `loadSettings`/`defaultSettings` 987–1004, `loadSessions`/`saveSessions`/`onSessionsChanged` 1006–1020, `loadSkillsData` 1021, `genId` 1027 |
| Theme / accent / font | 1030–1079 | `accentHsl` 1032, `applyTheme` 1036, `updateAvatar` 1060, `getTipOfDay` 1067, `handbookLinkHTML` 1073 |
| Requirements and stats | 1080–1217 | `getReqs` 1082, `weatherFlags`/`isInclement` 1094–1102, day/night split `sunAltitude` 1107, `nightMinutes` 1115, `STATE_CENTER` 1125, `applyNightSplit` 1144, `sessionNightMin` 1154, `computeTotals` 1160, `getStreak` 1199 |
| GPS permission | 1218–1244 | `checkGpsPermission` 1220, `gpsWarnHTML` 1233 |
| Cloud sync (E2E) | 1245–1595 | constants 1257–1260 (`SYNC_KDF_ITER` 310000), `genSyncCode` 1272, `deriveSyncKeys` 1284, `seal`/`unseal` 1300–1311, `syncCall` 1312, `parentSummary` 1320 (allow-list!), `mergeSyncData` 1334, `createSyncCode` 1363, `connectSyncCode` 1379, `upgradeLegacySync` 1407, `pushSync` 1431, `pullSync` 1456, `scheduleSyncPush` 1478 (4 s debounce), parent link 1499–1538, `syncCodeHTML` 1539 |
| Quick add | 1596–1665 | `openQuickModal` 1598, `selectQaDur`/`selectQaDN` 1619–1643, `saveQuickDrive` 1644 |
| Parent read-only view | 1666–1758 | `computeEarnedMilestones` 1668, `initParentView` 1676 |
| Records, badges, milestones, confetti | 1759–1912 | `getPersonalRecords` 1761, `updateSkillsBadge` 1794, `checkMilestones` 1805, confetti IIFE 1822–1899, `milestonesHTML` 1900 |
| Weekly chart and navigation | 1913–2001 | `weeklyChartHTML` 1915, `navigate` 1965, swipe handlers 1987 |
| Home and dashboard | 2002–2266 | `renderHome` 2004, `renderDashboard` 2101, `goalCard` 2192, `progressRing` 2229, `sessionRowHTML` 2241, `emptyStateHTML` 2259 |
| Skills view | 2267–2342 | `renderSkills` 2269, `toggleTip` 2308, `setSkill` 2313, `suggestSkill` 2329 |
| Drive view (live GPS) | 2343–2591 | `renderDrive` 2345, `initDriveMap` 2376, `renderDrivePanel` 2404, `startDrive` 2427, `handleFirstFix` 2462, `onPosition` 2485, `checkStopDetection` 2522 (idle warn 5 min, auto-stop 10 min), `stopDrive` 2555 |
| History | 2592–2677 | `renderHistory` 2594, `setupSwipeDelete` 2651, `setFilter` 2675 |
| Session detail modal | 2678–2950 | `showSessionDetail` 2682, elevation/speed SVGs 2721–2754, `initDetailMap` 2755, `startReplay` 2770, `shareSession` 2788 (canvas card), `closeModal` 2923, `saveNotes` 2932, `deleteSession` 2939 |
| Settings | 2951–3091 | `renderSettings` 2953, `previewState` 3033, `saveSettingsForm` 3042, accent/font/theme/car setters 3067–3081, `clearAllData` 3082 |
| Export / import / print | 3092–3228 | `DEVICE_ONLY_SETTINGS` 3095, `exportPayload`/`exportJSON` 3096–3104, `cleanImportedSession` 3105, `applyImport` 3118, `exportCSV` 3155, `importData` 3169, `printLog` 3192 |
| Weather and geocoding | 3229–3249 | `fetchWeather` 3231, `reverseGeocode` 3239 |
| Manual entry | 3250–3346 | `openManualModal` 3255, `saveManualDrive` 3300 |
| Helpers | 3347–3409 | `esc` 3350, `haversineMeters` 3352, `routeDistMiles` 3358, `fmtDur`/`fmtTime`/`fmtDate` 3369–3375, `TAG_LABELS` 3378, `toast` 3382, `toastUndo`/`undoDelete` 3389–3409 |
| Onboarding | 3410–3448 | `initOnboarding` 3412, `obNext` 3425, `obFinish` 3439 |
| Init | 3449–3506 | service worker registration 3451, parent-view detection 3460, `#drive` shortcut 3476, GPS check 3483, pull sync on load 3488, visibility handler 3495 |

### Other files
| File | Lines | What |
|---|---|---|
| `rtr-sync.php` | 146 | CORS 20–36, `respond`/`err` 51–52, `rateLimit` 55, `blobPath` 77, `legacyPath` 84, actions `get` 93, `put` 100 (3 MB cap), `delete` 116, `legacy_pull` 123, `legacy_delete` 131. Data in `rtr-sync-data/` (git-ignored, `.htaccess`-denied) |
| `rtr-service-worker.js` | 115 | `CACHE` 9, `STATIC` 10, `isCacheFirst` 20, install 26, activate 37, fetch 46, sync 95, push 104 |
| `rtr-manifest.json` | 29 | PWA manifest; `#drive` shortcut; icons `rtr-icon-192.svg`, `rtr-icon-512.svg` |
| `tests/helpers.js` | 143 | `test` fixture 51 (coverage hook, page-error check), `fakeGeolocation` 16, `seedStorage` 32, `openApp` 71 (stubs every network call, fake sync server), `sess` 108, `newDevice` 121 |
| `tests/totals.spec.js` | 120 | Hour totals, sun split across sunset/midnight/DST/time zones, manual and quick-add |
| `tests/sessions.spec.js` | 96 | Live drives, auto-stop, edits, deletes, tombstones |
| `tests/milestones.spec.js` | 78 | Streaks, milestones, inclement weather, parent view |
| `tests/importexport.spec.js` | 78 | JSON/CSV export and import, secrets kept out |
| `tests/sync.spec.js` | 112 | No plaintext on the wire, parent allow-list, two-device merges |
| `tests/drive-lifecycle.spec.js` | 127 | Start/stop races, GPS errors, geocode after save |
| `tests/entry.spec.js` | 187 | Manual and quick-add validation |
| `tests/sanitize.spec.js` | 181 | Escaping of rendered fields, import sanitising |
| `tests/sync-import.spec.js` | 239 | Sync and import data-loss cases |
| `tests/home-drive.spec.js` | 223 | GPS permission, swipe nav, storage fallbacks, inclement codes, skills badge, timers, compass |
| `tests/skills.spec.js` | 226 | Skills view, statuses, tips, suggestions |
| `tests/onboarding.spec.js` | 138 | Onboarding steps, help modal |
| `tests/settings.spec.js` | 220 | Settings form, theme/accent/font/car setters, clear all |
| `tests/detail.spec.js` | 240 | Detail modal, elevation/speed SVGs, replay, share card, notes, delete |
| `tests/history.spec.js` | 322 | Filters, search, swipe delete, undo, JSON/CSV export, print |
| `tests/sync-lifecycle.spec.js` | 280 | Create/connect/upgrade sync, parent link, copy/email code |
| `tests/service-worker.spec.js` | 186 | `rtr-service-worker.js` in a Node `vm` (install, activate, fetch strategies) plus registration |
| `tests/sync-server.spec.js` | 303 | Real `rtr-sync.php` under `php -S`: actions, caps, CORS, rate limit |
| `tests/coverage-report.js`, `tests/mutate.js`, `tests/mutants/` | | Coverage report and mutation runner (see Build, run, test). `RTR_SERVE_ROOT` / `RTR_TEST_PORT` point a run at a copy; `helpers.appRoot` is that folder |
| `tests/serve.js`, `playwright.config.js` | | Static server on 4173; Chromium, service workers blocked |
| `.github/workflows/deploy.yml` | | Version bump + SFTP upload list |
| `docs/state-requirements.md` | | Audit of `STATE_REQS` against official sources (checked 2026-11-05) |
| `docs/overhaul-state.md` | | Shared ledger for the multi-session overhaul |

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
