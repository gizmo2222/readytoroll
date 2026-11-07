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
| sync-10 | low | `rtr-sync.php` `put` ignores the return value of `file_put_contents`; `get` reads without a shared lock. | Server file; changing it means a deploy. Safe one-line fix for phase 4 (security) to pick up. |
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
| Parent revoke (sync-2) | Client-side newest-wins fixes resurrection between our devices; the server still lets any `put` recreate a deleted parent id | Needs a tombstone in `rtr-sync.php`, a deploy change; phase 4 |
| Parent view (W3) | Parent badge now needs total, night and inclement hours met; the parent view still shows no inclement line | Phase 6 |
| Service worker | Cached HTML changed in this phase; `rtr-v5` was not bumped because HTML is network-first | Decide at landing |

