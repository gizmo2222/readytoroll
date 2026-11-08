# Overhaul findings

Bugs found during the overhaul that were **not** fixed in the phase that found them, with the
reason. Fixed bugs live in git history and the regression tests; this file is the backlog.

## Phase 2 — Bug hunt (2026-11-07, branch `overhaul/phase-2`)

Method: 14 finder workers (7 areas from the doc map × bug classes), then 2 skeptic workers who
tried to disprove every finding. 71 findings: 69 confirmed, 1 refuted, 1 unsure. The confirmed
ones were triaged into four fix clusters (escaping/import validation, drive lifecycle,
entry/totals logic, sync/import data loss) plus the deferred list below. Only the clusters were
fixed, each with regression tests.

### Refuted

| Id | Claim | Why it is wrong |
|---|---|---|
| drive-history-6 | Auto-stop never fires unless the Drive view is on screen (`#stop-notice` missing). | Views are hidden with CSS (`.view{display:none}`); `#drive-view` and `#stop-notice` stay in the DOM, so `checkStopDetection` keeps running. |

### Unsure

| Id | Claim | Status |
|---|---|---|
| detail-settings-5 | `setFontSize`/`setVibeTheme`/`setCarEmoji` and a pull that changes the parent link call `renderSettings()`, which rebuilds the form and discards text typed into Driver Name / Nickname / Override Hours that has not blurred yet. | Code path is real; the skeptic could not decide whether a real tap sequence reaches it (tapping a theme chip blurs the text input first on most browsers, which commits it). Low impact. Re-check in phase 6 (UI). |

### Confirmed but deferred

| Id | Sev | Finding | Why deferred |
|---|---|---|---|
| drive-history-1 / state-persist-4 | high | An in-progress drive lives only in memory (`activeSession`); a reload, tab eviction or crash mid-drive loses the whole drive. | Feature-sized: needs an `rtr_active` checkpoint written on every fix, a resume prompt at init, and tests for the resume path. Top candidate for the next build phase. |
| detail-settings-4 | medium | `clearAllData` resets `settings` (sync code, parent link) before anything reaches the network, so the encrypted cloud blob and the live parent token stay on the server. | Touches server-side data deletion; the project rule says do not delete user data in the overhaul. Needs a design decision (ask "also remove from cloud?"). |
| sync-4 | medium | Pushes skipped while offline are never retried, and pull/join never push local-only drives; status still reads "Synced". | Needs an `online` listener plus a dirty flag persisted across launches; interacts with the pushSync rework in cluster W4. Do after W4 settles. |
| drive-history-7 | medium | History search `oninput` re-renders the whole view on each keystroke, so the input loses focus and the mobile keyboard closes. | UI refactor (render the list, not the input). Phase 6. |
| state-persist-6 | low | A second delete inside the 5 s undo window overwrites `undoSession`; the first drive can no longer be undone. | Needs an undo stack and a redesigned toast. Phase 6 together with state-persist-9. |
| state-persist-9 | low | `toast()` during the undo window removes the Undo button and leaves `pointer-events:auto` set. | Same toast redesign as above. |
| sync-9 | low | After a successful legacy upgrade, a failing `legacy_delete` surfaces as "Sync error" and hides the new-code toast. | Rare one-time path; fold into the next sync change. |
| sync-10 | low | **Fixed in phase 4.** `rtr-sync.php` `put` ignores the return value of `file_put_contents`; `get` reads without a shared lock. | Server file; changing it means a deploy. Safe one-line fix for phase 4 (security) to pick up. |
| quick-parent-milestones-3 | low | Parent view computes Early Bird, streaks and weekly buckets in the parent's time zone and clock. | Needs the teen's zone in `parentSummary`; small protocol change. |
| quick-parent-milestones-4 | low | The milestone "unlocked!" toast is overwritten in the same tick by "Drive logged". | Toast queue; same redesign as state-persist-6/9. |
| quick-parent-milestones-5 | low | Quick-add Day/Night chip reflects the sun now, not over the backdated interval. | Cosmetic; recompute the preselection when the duration chip changes. |
| quick-parent-milestones-8 | low | A fresh device writes `[]` to `rtr_milestones` before the first pull, then confettis every historical milestone. | Depends on the milestone-union fix in cluster W3; re-check after it. |
| quick-parent-milestones-9 | low | Parent view prints "0.0 total left" when under 0.05 h remains. | Cosmetic. |
| home-dashboard-skills-6 | low | Days-to-goal is one too high across the fall-back DST change (`Math.ceil` of midnight-to-midnight). | Use `Math.round`; trivial but untested, left for phase 3 which will add date tests. |
| detail-settings-6 | low | Double-tapping Share starts a second share and a PNG download. | Needs an in-progress flag; phase 6. |
| detail-settings-7 | low | Share-card progress bar is not capped at 100% and overruns the card. | Cosmetic; phase 6. |
| detail-settings-8 | low | Route replay stops up to `step-1` points short of the end marker. | Cosmetic; phase 6. |
| io-manual-sw-11 | low | Service worker never caches map tiles: tiles load `no-cors`, so responses are opaque and `response.ok` is false. | Caching opaque responses silently fills the quota; needs a size-bounded tile cache. Deferred. |

### Not finished by the fix workers

Confirmed findings the fix clusters touched, with the part left undone:

| Area | Left undone | Why / where next |
|---|---|---|
| Storage quota (W2) | `saveSettings`, `saveSkillsData`, `saveTombstones` and the `dl_*` migration still call `localStorage.setItem` unguarded; only `saveSessions` toasts on a full store | Same pattern as `saveSessions`; phase 3 or 5 |
| Route size (W2, sync-1) | Routes are neither rounded nor thinned, so a long GPS history still grows the sync blob toward the 2.9 MB client cap (now a clear "Sync data too large" status, not a silent failure) | Thinning changes stored user data; needs a decision (phase 5 or backlog) |
| Parent revoke (sync-2) | **Fixed in phase 4** (`.revoked` marker, put returns 410). Client-side newest-wins fixes resurrection between our devices; the server still lets any `put` recreate a deleted parent id | Needs a tombstone in `rtr-sync.php`, a deploy change; phase 4 |
| Parent view (W3) | Parent badge now needs total, night and inclement hours met; the parent view still shows no inclement line | Phase 6 |
| Service worker | Cached HTML changed in this phase; `rtr-v5` was not bumped because HTML is network-first | **Phase 4 bumped it to `rtr-v6`** (Leaflet now loads with SRI) |


## Phase 3 — Tests (2026-11-07, branch `overhaul/phase-3`)

Method: V8 coverage of the whole suite, then 9 writer workers (one per untested module) and a
mutator per module that seeded 12-18 mutants each and strengthened tests until they died. The bugs below
were found while writing tests. Each is pinned by a `test.fixme` (search the spec for `BUG:`) and was
**not** fixed, since phase 3 only adds tests. Turning a fixme into `test(` is the regression test for the fix.

| Id | Sev | Finding | Where | Pinned by |
|---|---|---|---|---|
| p3-history-search | high | **Fixed in phase 4.** History search text is interpolated unescaped into `value="${historySearch}"`, so a query containing `"` breaks out of the attribute (markup and script injection from your own typing; also any future deep-link of the query). | `renderHistory` toolbar | `history.spec.js` "search text is escaped…" |
| p3-php-newline-id | medium | **Fixed in phase 4.** `rtr-sync.php` id regex ends in `$` without the `D` modifier, so a valid id plus a trailing `\n` passes validation and addresses a different file. | `rtr-sync.php` ~79 | `sync-server.spec.js` "an id with a trailing newline…" |
| p3-php-array-id | low | **Fixed in phase 4.** A non-string id (object or array) hits "Array to string conversion"; with `display_errors` on, the warning and server path print before the JSON body. | `rtr-sync.php` ~78 | `sync-server.spec.js` "non-string ids get a clean JSON 400…" |
| p3-clipboard | low | **Fixed in phase 4.** `copySyncCode` and `shareParentLink` call `clipboard.writeText(...).then(toast)` with no `.catch`: a denied clipboard gives an uncaught rejection and no feedback. | `copySyncCode`, `shareParentLink` | `sync-lifecycle.spec.js` "a denied clipboard write toasts…" |
| p3-swipe-bubble | medium | Swipe-to-delete on a History row bubbles to the `#main` tab-swipe handler, so deleting a row also switches tab; Undo then restores the drive without re-rendering History. | `setupSwipeDelete`, `#main` swipe handlers | `history.spec.js` "swiping a row to delete stays on the History tab" |
| p3-undo-timer | low | `toastUndo` does not clear the pending `toast()` timer, so a toast shown just before a delete hides the Undo toast after 2.8 s instead of 5 s. Same toast redesign as state-persist-6/9. | `toast`, `toastUndo` | `history.spec.js` "undo toast stays visible for 5 seconds…" |
| p3-help-escape | low | The help modal is `aria-modal` but Escape does not close it (no keydown handler). | `#help-modal`, `openHelp`/`closeHelp` | `onboarding.spec.js` "Escape closes the help modal" |
| p3-skill-status | low | `updateSkillsBadge` and `renderSkills` disagree on an unknown stored status (such as `'bogus'`): the badge counts it as started, the view shows it as not started. | `updateSkillsBadge`, `renderSkills` | documented in `skills.spec.js`, no fixme |

Coverage after phase 3: 2300/2338 code lines (98.4%, was 81.1%), 203/208 named functions (was 161/207).
Still never run: `emailSyncCode` (opens `mailto:`, which the harness blocks), the Leaflet-only callbacks
(`watchPosition` options object, row `passive` listeners and the detail modal's map `onclick`, which need a real map),
and short defensive branches at roughly lines 795, 1372, 1426, 1633-1640, 1676, 1800-1804, 2091, 2753-2767,
3014, 3166, 3230 and 3495. None of them hides a known bug; they are listed so phase 5 can judge dead code.
`home-dashboard-skills-6` (days-to-goal across DST) is still open; no test was added for it.

## Phase 4 — Security (2026-11-08, branch `overhaul/phase-4`)

Method: four reviewers (sync server; crypto and sync client; DOM and import; platform: SW, CDN, deploy and
test server), then one skeptic per finding who tried to disprove it against the working tree. Of 29 findings,
22 were confirmed, 1 was unsure and 6 were refuted. Every fix has a regression test, and the four security
fixmes from phase 3 are now `test(`.

### Fixed

| Id | Sev | Fix | Test |
|---|---|---|---|
| crypto-1 / dom-a-1 | high | The parent view put the decrypted blob's `reqs.total`/`night`/`stateName` into `innerHTML` unchecked and used `data.sessions` as is. The hour values are now coerced to finite numbers and the state name to a string, and the sessions go through `cleanImportedSession`. | sanitize: forged parent blob |
| p3-history-search | high | The History search value is escaped. | history (fixme flipped) |
| platform-sri / platform-sw-pin | medium | The Leaflet CSS and JS from unpkg carry `integrity` (sha256) and `crossorigin`. The SW cache is `rtr-v6`, so old opaque copies are dropped. The test harness strips `integrity`, because its stubs are fakes. | service-worker: SRI tags, activate |
| server-ratelimit-race / server-tmp-ratelimit-files | medium | `rateLimit` reads, counts and writes under one `flock`. A counter file that is corrupt or dated in the future starts a fresh window. IPv6 clients are keyed by their /64. | sync-server: corrupt counter |
| server-legacy-bruteforce | medium | Partly fixed: `legacy_pull`/`legacy_delete` now have a server-wide cap of 300 per hour, on top of the 30 per minute per IP. Sunsetting the plaintext v1 files is deferred (see below). | sync-server: server-wide cap |
| server-disk-fill | medium | Partly fixed: new blobs now have a server-wide cap of 500 per hour, on top of the 10 per 5 minutes per IP. Expiry is deferred (see below). | sync-server: server-wide cap |
| p3-php-newline-id / p3-php-array-id | medium | `blobPath` accepts only string ids and uses the `D` modifier. `legacyPath` rejects non-strings. | sync-server (fixmes flipped) |
| sync-2 / sync-10 (parent revoke) | low | Deleting a 32-hex parent id leaves a `.revoked` marker, and a later put to that id gets 410. On a 410 the client drops the link (`parent=null`, `parentAt=0`) and pushes again. A put whose write comes up short gets 500, `get` reads under a shared lock, and the create rate limit is checked before the write. | sync-server: revoked parent; sync-import: skewed clock |
| platform-htaccess / server-storage-in-webroot | low | The data folder's `.htaccess` has both Apache 2.4 (`Require all denied`) and 2.2 rules, and is checked on every request. Moving the folder out of the webroot is deferred. | sync-server: old .htaccess replaced |
| crypto-3 | low | When the `legacy_delete` after an upgrade fails, the code is kept in the device-only setting `legacyPendingDelete` and the next `pushSync` retries the delete. | sync-lifecycle: legacy retry |
| dom-b-1 / dom-b-2 | low | `cleanIso`: a tombstone's `at`, `updatedAt` and `endTime` must parse. A time more than a day in the future is clamped to now, and a bad tombstone date becomes epoch, so a crafted file can no longer win every newest-wins merge. | sanitize: timestamps |
| dom-b-4 | low | Locations are rebuilt with finite lat/lng and city/address capped at 200 characters. An import file over 20 MB is refused before it is read. | sanitize: locations; sync-import: size cap |
| p3-clipboard | low | When the clipboard write is denied, a toast shows the code or the link. | sync-lifecycle (fixme flipped) |
| platform-serve-crash | low | `tests/serve.js` answers a malformed `%` escape with 400 instead of crashing. | none (test tooling) |

### Confirmed but deferred

| Id | Sev | Finding | Why deferred |
|---|---|---|---|
| server-legacy-bruteforce (rest) | medium | The plaintext v1 files never expire, and anyone with an 8-character code (a 2^40 space) can read them. | A sunset would delete user data. Decide at landing: announce a cut-off, then delete the files not upgraded by then. |
| server-disk-fill (rest) | medium | Blobs never expire, and the anonymous endpoint stores up to 3 MB of anything. | Expiry deletes user data, so it needs a policy (for example, a blob untouched for 12 months). Landing or backlog. |
| server-id-is-write-capability / crypto-4 / platform-parent-id-capability | low | Put and delete authorise on the id alone. The parent token is that id, and it travels in `?parent=`, so it reaches access logs. | A separate write key per blob is a protocol change on both client and server. The parent link cannot destroy data: after a delete, the teen's next push gets 410 and the link is dropped. Backlog. |
| crypto-2 | low | `connectSyncCode` merges local history into any code it is given and uploads it, without asking first. | Needs a confirm step, which is a UX change. Phase 6. |
| crypto-6 | low | `emailSyncCode` puts the full-access code in a `mailto:` body. | It is a feature the user chooses. Phase 6 could add a warning line. |
| platform-no-csp | low | The page has no Content-Security-Policy. | The inline script and styles would have to move out or be hashed. Suggested for phase 6, where a meta CSP can be tested against every screen. |
| server-storage-in-webroot (rest) | low | `rtr-sync-data/` sits inside the docroot. | Deploy and hosting change. Report only. |
| platform-deploy-pin | low | `deploy.yml` uses the mutable tag `actions/checkout@v5` in a job with `contents: write`, and SFTP signs in by password. | CI config, which phase 4 must not change. At landing, pin the action to a commit SHA and switch to key auth. |
| server-tmp-ratelimit-files (rest) | low | The counter files sit in the shared temp dir under predictable names, and `fopen` follows symlinks. | Their contents are now validated. A private folder needs a deploy change. Report only. |

### Refuted

- server-error-path-leak: the host's settings print no path, and the array-id warning is fixed anyway.
- crypto-5, dom-a-2, dom-b-3, dom-b-5.
- platform-shared-origin: the SW scope is `./readytoroll.html`, and the other pages on the origin hold no secrets the page can't already reach.


## Phase 5 — Clean-up (2026-11-08, branch `overhaul/phase-5`)

Method: eight finders (A–H: state and persistence, sync client, stats and views, drive and detail,
settings/import/export/onboarding, CSS and markup, PWA/server/tooling, a cross-cutting duplicate sweep),
then one skeptic per finding: 120 findings, 79 safe (63 applied, the rest duplicates), 38 risky, 3 refuted. Two fixers ran one after the other
(`readytoroll.html` first, then tests/package/docs). Suite unchanged at 238 (235 pass, 3 `fixme`).

### Applied

- **Dead code:** the `--blue`/`--blue-dk`/`--blue-lt` properties (uses now read `--accent`; the
  settings.spec asserts on the write-only properties went with them, so F-7 landed as part of A-1),
  the `data-dark` attribute, `activeSessionId`, `loadDeletedIds`, `isInclement`, the `updateAvatar`
  stub, `lastFixAt`, `mergeRemoteSessions` (H-13, folded into its one caller), and unused CSS (toggle,
  skeleton, swatch and other rules with no markup).
- **Duplication:** `renderSessionViews`, `newestFirst`, `SUN_DOWN_DEG`, one week-start helper,
  `progressLeft` (hours/night/inclement left plus "all met", used by home, goal card and parent view),
  `animateRing`, `applyRemote`/`markSynced` in push and pull, `computeEarnedMilestones` shared,
  `renderDashboard` uses `progressRing`. `computeTotals` is one loop, `getStreak` is simpler.
- **Sync:** behaviour-preserving only. `parentSummary`, `seal`/`unseal` and the blob shape are
  untouched; `createSyncCode`/`upgradeLegacySync` test `pushSync()`'s return value instead of
  `syncStatus` (every exit path agrees).
- **Tests and tooling (G-3–G-11):** shared helpers in `tests/helpers.js` (`readStore`, `deletedIds`,
  `ids`, `drive`, `startDriving`, `manual`, `pair`, `json`, `waitForApp`, `toastText`);
  `@playwright/test` ^1.65.0, `engines.node >=20`, README spec table and PowerShell commands.
- **Mutants:** `settings-2` removed (its target is gone); 7 retargeted to the new code, and 4 left
  stale by phase 4 (`sync-lifecycle-10`, `sync-server-8`, `-9`, `-14`) retargeted. All 11 run and killed.
- Reverted: F-10(b). The `.sync-dot` `off`/`offline` rules look redundant but `syncStatus` takes both
  values, so removing them changes the dot.

### Risky, not applied

| Id | Finding | Why not |
|---|---|---|
| A-5 / C-7 | `getPersonalRecords` re-buckets weeks and recomputes top speed that `computeTotals` returns | Drives without `startTime` (raw old local data) bucket differently; best week could change |
| A-9 | `ACCENT_COLORS` only feeds the `accentId` migration; `label`/`dk`/`lt` unused | Migration path for old `rtr_settings` |
| A-12 / H-10 | Repeated localStorage read/parse/fallback and Map→`[{id,at}]` serialisation | Storage compatibility surface; `??` vs `||` differ for stored falsy values |
| A-15 / D-12* | Drive view has its own GPS-warning block | Copy and layout differ (*D-12 refuted as a pure duplicate) |
| B-1 / H-11 | Two sync status label maps; `err` text drifts ("Sync error" vs "… — check connection") | Visible text; pick one wording in phase 6 |
| B-8 | `connectSyncCode` legacy branch fetches `legacy_pull` twice | Legacy v1 path; toasts differ |
| B-9 | **Bug:** `emailSyncCode` keeps `#drive` in the URL, and the raw `#` cuts off the mailto body | Visible change, untested; fix in phase 6 |
| B-13 | **Bug:** `openQuickModal` clears `active` on tag chips but leaves `aria-checked="true"` | Assistive-tech change; phase 6 |
| B-14 | `.sync-dot` rules repeat the base background | No test covers the dot colour |
| B-15 | `settings.parentToken` (v1) is never read but still written | In `rtr_settings`; tests and mutants assert it |
| C-8 | Progress view shows top speed twice | Design decision |
| C-9 | Three "hours left" copies differ slightly (raw vs `||0`) | Partly unified by `progressLeft`; Home's raw `reqs.night` left alone |
| C-13 | Milestone badge markup built twice (driver vs parent) | Titles and click behaviour differ |
| C-14 | `checkMilestones` repeats `computeEarnedMilestones`' loop | Writes `rtr_milestones`, whose order matters |
| D-10 | Canvas font stack repeated 8 times | Nothing checks canvas text |
| D-11 | Redundant `!route` guard in replay | Removing it would clear a running replay first |
| E-4 / G-1 / G-2 | SW `sync`/`push` handlers and `BACK_ONLINE` never fire (no `sync.register`, no push) | Spans SW and cache; "future use" is a product call |
| E-8 | Allowed-key filter after `cleanImportedSettings` is redundant today | Defence in depth on import |
| E-9 / H-9 | "Edited after delete means restored" rule written three times | Tombstone merge and old format |
| E-11 | Partly-night predicate inline twice | No test on that visible text |
| E-13 | **Bug:** settings inputs save on `change` and `blur`, toasting "Settings saved" twice | Visible; phase 6 |
| E-15 / H-15 | Four modals repeat open/focus/close code | Close paths differ; mutants pin the text |
| F-6 | **Bug:** help copy is stale (6 vs 7 skill categories, 8- vs 12-character code, button names) | Copy change; phase 6 |
| F-13 | Inline styles on three form fields override the `:focus` accent border | Visible UI change; phase 6 |
| F-14 | 26 chips repeat inline handlers | Markup and keyboard behaviour |
| G-12 | Local `.claude/launch.json` runs `npx serve`; the `serve` npm script is unused | Git-ignored user config |
| G-13 / G-14 / G-15 | `rtr-sync.php`: triple `parse_url`, duplicated legacy rate-limit lines, redundant `file_exists` | Server responses and CORS are a compatibility surface; port 0 differs |

Refuted: A-14 (the reset is the behaviour), B-4 (tests read `upgradeLegacySync`'s return value), D-12
(the two GPS blocks differ in what they show).

## Phase 6 — UI (2026-11-08, branch `overhaul/phase-6`)

Method: `tests/screens.shots.js` (run with `playwright.shots.config.js`) screenshots the five views, drive-live,
the detail, help, manual and quick modals, the empty states, onboarding and the parent view at phone, tablet and
desktop widths, in all seven themes at phone width, with an in-page audit for text contrast, touch targets under
44px, unnamed controls and CSP console errors. Three reviewers read the captures (layout, theme contrast, a11y and copy)
and filed 69 issues in `coverage/review-issues.txt` (git-ignored). Two Sonnet fix workers ran one after the other. Suite 238 -> 260, no fixme left.

### Fixed

- **Layout:** above 700px the views cap at 720px and centre, the nav centres, and the bottom sheets become centred 640px dialogs with `max-height:90dvh`.
  Toasts wrap. The sync code scales to the phone width. The drive-live stats keep three columns on narrow phones.
- **Contrast:** new `--X-ink` / `--on-X` tokens computed at runtime by `applyThemeInks()` (WCAG maths, from each theme's real
  `--X-lt` tint) keep accent, green, amber, purple and red text at 4.5:1 on cards and tinted chips in every theme and accent hue
  (test in `settings.spec.js`). Locked milestone tiles no longer fade their labels.
- **Targets and keyboard:** 44px minimum on chips, skill buttons, filters, swatches, the avatar and the REC badge. Skill tips are
  real buttons with `aria-expanded` and keep focus. Session rows are `role=button` and open with Enter or Space. Escape closes every modal, and Tab is trapped
  in the open sheet. History search keeps focus and caret. `aria-pressed` is set on the filter and font-size toggles. Nav emoji are `aria-hidden`.
- **Screen readers:** the undo toast announces through `#sr-announce`. `#stop-notice` is a live region. The onboarding, manual,
  quick-add, history search/sort and notes fields all have labels.
- **Ledger items:** B-9 and crypto-6 (the emailed code uses `origin+pathname`, the body is encoded, and the user confirms a warning first).
  crypto-2 (joining asks before merging local drives into the synced log). B-13, E-13 (one save, one toast), B-1/H-11 (`syncStatusLabel()`).
  F-6 (help copy), F-13 (`.field-inline` keeps the focus border).
- **The 3 old fixmes:** a swipe-delete no longer changes tabs, the undo toast is no longer cut short by a milestone toast, and Escape closes help.
- **Other:** a share double-tap opens one sheet, the share-card bar is capped at 100%, the replay ends on the last point,
  the detail's "Save" button now reads "Save notes", and the manual entry has a Cancel button.
- **CSP:** a meta CSP (`default-src 'self'`, with unpkg for Leaflet, OSM tiles, Open-Meteo and Nominatim; `object-src`, `base-uri`
  and `form-action` are 'none'). `script-src` still needs `'unsafe-inline'` because of 98 inline `on*=` handlers and the print
  window's inline script. `frame-ancestors` cannot go in a meta tag; it needs a server header (deploy config, so left out).

### Deferred (design, not defects)

| Ref | Issue | Why left |
|---|---|---|
| review 6, 27, 36, 45, 48 | Home and drive idle have empty lower halves; the home tiles repeat the ring card's "left" numbers | Content change (which teaser to add); phase 8 research should pick |
| review 7 | Nav labels are 9–10px | A nav redesign; the 44px targets are met |
| review 4, 5, 39 | Detail charts and grid at desktop; an empty block when the map fails | The 640px cap fixes most of it; a map-failure placeholder is a small follow-up |
| review 15, 21, 24, 25, 30 | Retro keeps default header colours; neon has no glow; the swatch ring is thin; the Dark swatch is hard to see on midnight; the car slider thumb is hard to see | Theme art direction; the contrast floors already hold |
| review 23 | The dimmed page shows above a sheet | It is a sheet; on desktop it is now a centred dialog |
| review 43 | History rows fade in with a stagger | Entrance animation; the capture caught it mid-way |
| review 44, 50, 51, 52 | "In Progress" vs "Practicing" wording; orphan swatches and cars in the wrapping grids; Data/Danger sections without a card; the weather icon wraps apart from its temperature | Copy and layout polish for the backlog |
| review 62 | setVibeTheme, setCarEmoji, setFontSize and setFilter re-render the view and drop focus | Needs a focus-restore helper across views; search and skill tips are done |
| CSP | `'unsafe-inline'` scripts | Moving 98 inline handlers to listeners is a refactor |
