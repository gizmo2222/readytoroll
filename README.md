# ReadyToRoll — Permit Tracker

A single-file progressive web app for logging supervised driving hours toward a learner's permit. Tracks GPS routes, weather, inclement conditions, day/night hours, and more — no account required, no install needed, works offline.

## Features

### Core Tracking
- **GPS route tracking** — records your route in real time and displays it on an interactive map
- **Weather** — fetches temperature, conditions, and wind speed at the start of each drive
- **Day/Night split** — night minutes worked out from the sun's position at the drive's location, so a drive across sunset counts partly as each; overridable
- **Inclement weather hours** — rain, snow, fog, and thunderstorm drives tracked separately for states that require them (PA: 5h, SD: 10h)
- **All 50 states + DC** — pre-loaded supervised hour requirements including night and inclement minimums; configurable overrides in Settings

### Logging Drives
- **▶ Start Drive** — one tap starts a live session with GPS route recording, weather fetch, and idle detection
- **⚡ Quick Add** — log a just-completed drive in seconds: pick a duration chip, day/night, optional tags, done
- **📝 Manual** — back-fill any past drive by date, start/end time, conditions, supervisor info, and tags
- **Tags** — Highway, City, Rural, Parking, Rain, Snow, Confident, Tough — shared across all entry methods
- **Idle detection** — warns at 5 minutes of no movement; auto-stops the drive at 10 minutes

### Progress Dashboard
- **Progress ring** — animated ring showing overall % of required hours complete
- **Day / Night / Inclement breakdown** — individual hour counts and mini-bars for each requirement
- **Goal date** — set a target test date and the app shows how many hours/week you need to stay on track
- **Weekly chart** — last 8 weeks of activity split by day (amber) and night (purple)

### Milestones & Skills
- **17 milestones** — unlock automatically: progress thresholds (10%, 25%, 50%, 75%, 100%), session counts, miles driven, streaks, and condition badges (Rain Dancer 🌧️, Night Owl 🦉, Early Bird 🌅, Highway Star 🛣️, and more). Confetti fires on each unlock.
- **Skills checklist** — 26 skills across 6 categories mirroring a standard DMV road test. Expand any skill for tips. Mark as Learning or Mastered.

### History
- **Session list** — all drives grouped by month with filter chips (day/night) and search
- **Drive detail** — interactive route map, start/end addresses, weather, supervisor, tags, and notes
- **Edit & Delete** — correct any drive; 5-second undo on delete
- **📖 Driver's Handbook** — one-tap link to your state's official manual (Settings)

### Cloud Sync & Parent View
- **☁️ Cloud Sync** — creates a 12-character sync code (like `ABCD-EFGH-JKMN`); drives automatically back up after every change (4-second debounce). Everything is **encrypted on the device** before upload — the server can't read it.
- **Multi-device** — enter your sync code on a second device to stay in sync (full drives, routes included)
- **📤 Parent View Link** — share a read-only link so a parent can see live progress, recent drives, and milestones. The parent copy is a separate, encrypted **summary**: hours, miles, day/night, tags and weather type — never routes, addresses, supervisor details or notes. Revoking a link deletes it.

### Export & Backup
- **Export JSON** — full backup of all drives and settings; importable on any device
- **Export CSV** — open in Excel or Google Sheets
- **Print Log** — formatted log with session table, supervisor column, skills checklist, and signature lines — ready for a DMV officer

### Appearance
- **Vibe Themes** — Classic 🎨, Dark 🌑, Hi-Contrast ◑, Pastel 🌸, Neon ⚡, Retro ☀️, or Midnight 🌙
- **Accent colour** — any hue, picked with a rainbow slider
- **Text size** — Small / Medium / Large
- **Your Car** — custom car icon and nickname shown on the home screen

### PWA / Offline
- Installable as a home-screen app on iOS and Android
- Offline-capable via service worker — resume tracking without a connection
- The service worker (`rtr-service-worker.js`) is scoped to `readytoroll.html` only, so it never affects other pages on metacrystal.com. Its files are prefixed `rtr-` so they can't clash with other apps at the site root.
- Works at both `metacrystal.com` and `www.metacrystal.com`; sync uses a relative URL, so it always talks to the host the app was loaded from
- Wake lock keeps the screen on during active drives

## Usage

Open `readytoroll.html` in a browser. Because the app uses the Geolocation API it must be served over **HTTPS or localhost** — opening as `file://` will block GPS in most browsers.

Live at: **https://metacrystal.com/readytoroll.html**

To run locally:

```powershell
python -m http.server 3000
```

Then open http://localhost:3000/readytoroll.html.

Or use any static file server (VS Code Live Server, nginx, etc.).

## How It Works

| Step | What happens |
|------|-------------|
| Tap **Start Drive** | Gets GPS location, fetches current weather, records start time |
| While driving | `watchPosition` streams coordinates; route drawn live on the map |
| Tap **Stop Drive** | Calculates duration, distance, and end address; saves session to `localStorage` |
| Change detected | Drive automatically pushed to cloud sync (if enabled) with a 4-second debounce |
| History | Each session shows an interactive map with a green start dot and red end dot |

## State Hour Requirements

Requirements for all 50 states and DC are built in. They were last checked against each state's official DMV/DOT page or statute on 2026-11-05; the sources, mismatches and caveats are in [docs/state-requirements.md](docs/state-requirements.md). You can override the totals in **Settings** if your situation differs. Always verify with your state's official DMV — requirements change.

**Night hours** are worked out from the sun, not the clock. A drive is night time while the sun is below the horizon (altitude under −0.833°) at the drive's position, so a 4–6 pm drive in November is split into its day and night minutes. Manual entries default to **Auto (split at sunset)**; pick **All day** or **All night** to override. Drives saved by older versions keep their single day/night label.

States with inclement-weather minimums (PA: 5h, SD: 10h) show a separate 🌧️ progress bar. Inclement drives are detected from weather codes (rain, snow, fog, thunder) or manual Rain/Snow tags.

## Data & Privacy

All data is stored locally in your browser's `localStorage`. Nothing is sent to any server except:
- **Open-Meteo** (weather) — `api.open-meteo.com`
- **Nominatim / OpenStreetMap** (reverse geocoding) — `nominatim.openstreetmap.org`
- **OpenStreetMap tiles** (map display) — `tile.openstreetmap.org`
- **metacrystal.com/rtr-sync.php** (cloud sync, only when you create or join a sync code) — receives only encrypted data it can't read; see [Cloud Sync Backend](#cloud-sync-backend)

Use **Export → JSON** to back up your data or move it to another device. The export leaves out the sync code and the parent link key, and an import never replaces this device's sync settings.

## Cloud Sync Backend

`rtr-sync.php` is a small PHP backend that stores **sealed blobs it cannot read**. Actions: `get`, `put`, `delete` (plus `legacy_pull` / `legacy_delete` for the one-time upgrade below). Max 3 MB per blob. The data directory (`rtr-sync-data/`) is denied to the web with `.htaccess` and is git-ignored.

How the encryption works (all in the browser, with WebCrypto):

| | Storage ID sent to the server | Encryption key (AES-256-GCM) |
|---|---|---|
| **Sync** (teen's devices) | First half of PBKDF2-SHA256(sync code, 310,000 rounds) | Second half of the same derivation — never sent anywhere |
| **Parent link** | Random 128-bit token (`?parent=…`) | Random 256-bit key after `#k=` in the link — browsers never send the `#` part to a server |

The sync code is generated on the device, so the server never sees it, and the file names on the server reveal nothing about it. Each sync blob holds the full drives and the parent link details (so every device can keep the parent summary up to date); each parent blob holds only the summary.

**If the sync code is lost, the cloud copy can't be recovered** — there's no reset, by design. Each device keeps its own full copy, and **Export → JSON** is the backup.

### Upgrade from the old 8-character codes

Codes created before October 2026 were 8 characters and stored the drives in plain text, named after the code. The first device to open the new version upgrades automatically: it downloads the drives, re-uploads them encrypted under a new 12-character code, deletes the old file and its parent link, and shows the new code. Other devices still on the old code are told to enter the new one, and old parent links stop working — share a new one.

## Tech Stack

- Vanilla HTML/CSS/JavaScript — no framework, no build step
- [Leaflet.js](https://leafletjs.com/) — interactive maps
- [Open-Meteo](https://open-meteo.com/) — free weather API (no key required)
- [Nominatim](https://nominatim.openstreetmap.org/) — free reverse geocoding
- GitHub Actions — auto version-bump and SFTP deploy on every push to `master`

## Running the Tests

The tests are dev-only: they use [Playwright](https://playwright.dev/) to load `readytoroll.html` in Chromium and call its functions directly. Nothing in `tests/`, `package.json` or `node_modules/` ships to the site, and the app itself still has no build step. You need Node.js 18 or later.

Every network call is stubbed: Leaflet, map tiles, Open-Meteo and Nominatim get canned answers, and `rtr-sync.php` is replaced by an in-memory fake server. Any other external request is blocked, and any uncaught page error fails the test. The tests run in the `America/Los_Angeles` time zone unless a test sets its own.

Run these in PowerShell from the repo folder. The first two are needed only once:

```powershell
npm install
```

```powershell
npx playwright install chromium
```

```powershell
npm test
```

`npm test` starts a local server on port 4173 by itself. For one dot per test instead of a line each:

```powershell
npm run test:quiet
```

To run one file, or to watch the browser:

```powershell
npx playwright test tests/sync.spec.js
```

```powershell
npx playwright test --headed
```

| File | Covers |
|---|---|
| `tests/totals.spec.js` | Hour totals; the day/night split across sunset, midnight, DST and time zones; manual and quick-add entries |
| `tests/sessions.spec.js` | Live drives (start, stop, auto-stop), edits and deletes, `rtr_deleted` tombstones |
| `tests/milestones.spec.js` | Streaks across local days and DST, milestones, inclement weather, the parent view |
| `tests/importexport.spec.js` | JSON export/import round trips, import validation, CSV night minutes, secrets kept out of exports |
| `tests/sync.spec.js` | No plaintext in any request, the parent summary allow-list, two-device merges, deletes and undo |

## Deployment

Pushes to `master` trigger `.github/workflows/deploy.yml` which:
1. Increments the patch version in `version.txt` (e.g. `1.4.7` → `1.4.8`)
2. Stamps the new version into `readytoroll.html` (`const APP_VERSION`)
3. Commits `version.txt` back to the repo (ignored by the workflow trigger via `paths-ignore`)
4. Uploads `readytoroll.html`, `rtr-sync.php` and the offline-app files (`rtr-service-worker.js`, `rtr-manifest.json`, `rtr-icon-*.svg`) to the server via SFTP. The server's SSH host keys are pinned in `.github/known_hosts` (refresh with `ssh-keyscan metacrystal.com` if the host changes them).

Pull with rebase before pushing (`git pull --rebase origin master`), since every deploy pushes a version-bump commit.
