// Dev-only Playwright config. Tests load readytoroll.html from a local static server
// and stub every network dependency (Leaflet, Open-Meteo, Nominatim, rtr-sync.php).
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.RTR_TEST_PORT || 4173);

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    serviceWorkers: 'block',
    timezoneId: 'America/Los_Angeles',
    locale: 'en-US',
  },
  webServer: {
    command: 'node tests/serve.js',
    url: `http://127.0.0.1:${PORT}/readytoroll.html`,
    reuseExistingServer: !process.env.CI,
  },
});
