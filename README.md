# ReadyToRoll — Permit Tracker

A single-file HTML app for logging supervised driving hours toward a learner's permit. Tracks GPS routes, weather, and day/night conditions — no account, no server, no install required.

## Features

- **GPS route tracking** — records your route in real time and displays it on a map (like Strava)
- **Weather** — automatically fetches temperature, conditions, and wind speed at the start of each drive
- **Day/Night detection** — determined from your GPS location using live weather data
- **All 50 states + DC** — pre-loaded supervised hour requirements; pick your state in Settings
- **Progress dashboard** — circular progress ring, day/night hour breakdowns, session stats
- **Session history** — browse past drives with interactive route maps, start/end addresses, and notes
- **Export** — download all your data as JSON (full detail including GPS tracks) or CSV (spreadsheet-friendly)

## Usage

Open `readytoroll.html` in a browser. Because the app uses the browser Geolocation API, it must be served over **HTTPS or localhost** — opening the file directly as `file://` will block GPS in most browsers.

A simple way to run it locally:

```bash
python -m http.server 3000
# then open http://localhost:3000/readytoroll.html
```

Or use any static file server (VS Code Live Server, nginx, etc.).

## How It Works

| Step | What happens |
|------|-------------|
| Tap **Start Drive** | Gets your GPS location, fetches current weather, records start time |
| While driving | `watchPosition` streams GPS coordinates; route is drawn live on the map |
| Tap **Stop Drive** | Calculates duration, distance, and end address; saves session to `localStorage` |
| History | Each session shows an interactive map with a green start dot and red end dot |

## State Hour Requirements

Requirements for all 50 states and DC are built in, sourced from the IIHS and individual state DMV sites. You can override the totals in **Settings** if your situation differs. Always verify with your state's official DMV — requirements change.

## Data & Privacy

All data is stored locally in your browser's `localStorage`. Nothing is sent to any server except:
- **Open-Meteo** (weather) — `api.open-meteo.com`
- **Nominatim / OpenStreetMap** (reverse geocoding) — `nominatim.openstreetmap.org`
- **OpenStreetMap tiles** (map display) — `tile.openstreetmap.org`

Use **Export → JSON** to back up your data or move it to another device.

## Tech Stack

- Vanilla HTML/CSS/JavaScript — no framework, no build step
- [Leaflet.js](https://leafletjs.com/) — interactive maps
- [Open-Meteo](https://open-meteo.com/) — free weather API (no key required)
- [Nominatim](https://nominatim.openstreetmap.org/) — free reverse geocoding
