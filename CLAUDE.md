# ReadyToRoll — Project Guidelines

## Tech Stack
Single-file PWA: `readytoroll.html` (~3200 lines). Vanilla HTML/CSS/JS — no framework, no build step.
- Maps: Leaflet.js (CDN)
- Weather: Open-Meteo (free, no key)
- Geocoding: Nominatim/OpenStreetMap
- Sync backend: `rtr-sync.php` (flat-file PHP, SFTP-deployed via GitHub Actions). **End-to-end encrypted**: the app seals everything with WebCrypto before upload; the server only stores blobs by ID and can't read them. Never send drive data, the sync code, or keys to the server in the clear. The parent summary (`parentSummary()`) must not include routes, locations/addresses, supervisor details or notes. See README → Cloud Sync Backend.
- Service worker: `rtr-service-worker.js` (cache name `rtr-v4`, network-first for HTML), registered with scope `./readytoroll.html` so it never controls other metacrystal.com pages. PWA files are all `rtr-`-prefixed. Bump the cache name when cached assets change.

## Storage
`localStorage` keys: `rtr_settings`, `rtr_sessions`, `rtr_skills`, `rtr_milestones`, `rtr_deleted`

## Deploy
Push to `master` → GitHub Actions bumps patch version in `version.txt`, stamps `APP_VERSION` into HTML, SFTPs to `metacrystal.com` (host keys pinned in `.github/known_hosts`). New files that must ship need adding to the workflow's upload list. Always `git pull --rebase origin master` before pushing to avoid version-bump conflicts.

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
