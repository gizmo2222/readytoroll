// UI review screenshots (dev only, not the test suite). See tests/screens.shots.js.
const base = require('./playwright.config.js');
module.exports = { ...base, testMatch: /\.shots\.js$/, reporter: 'dot', retries: 0 };
