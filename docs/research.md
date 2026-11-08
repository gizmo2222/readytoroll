# Competitor research: tools comparable to ReadyToRoll

Date: 2026-11-08. Phase 8 (Research) of the repo overhaul.

## Summary

- **The free, trusted log app is still missing in most states.** RoadReady is the default in many states. It is free and it is endorsed by Delaware, Nevada, Massachusetts and Rhode Island [1][2][3][4]. On iOS it rates 2.9 from about 19K ratings [5]. Its reviews mostly describe login lockouts and lost hours: one person lost 23 h and another 41 h [5][6]. RoadReady Ohio is a separate app that the state paid about $190,000 to build, and it rates 4.7 [7][8][9]. Most of the newer paid apps cost $3 to $5 once, or a few dollars a month [10][11][12][13].
- **The paid apps compete on paperwork.** The things people actually pay for are a log that prints in the state's own format, with supervisor names, licence numbers and signature lines (PermitLog, LaneUp, Clocked) [14][10][11]. Other draws are sharing between teen and parent phones without lost data (GoTime, Clocked) [12][11], and reminders [12]. ReadyToRoll already has better GPS, weather and day/night maths than most of them. It has no state-form print and no supervisor list.
- **ReadyToRoll's real advantages are privacy and price.** It is free, has no account, and its sync is end to end encrypted. The parent view shows totals only. Telematics apps (Life360, Drivewise, Snapshot) hold large amounts of location data and have sold it or been sued over it [15][16][17]. They do not log permit hours at all.
- **Empty home screen (review items 6, 27, 36, 45, 48):** before the first drive, show a first-run panel with three direct actions. After that, use the space for a pace and target-date card, a weekly streak and a backup-health line. Replace the tiles that repeat the ring's "left" numbers with this week's numbers. On drive idle, show a short pre-drive checklist. Section 4 has the details and sources.
- **Top five features to build:** state-form print logs (Ohio BMV 5791 first); a supervisor list; per-state rules in `STATE_REQS`; home pace and target date; a weekly streak with a freeze.

## Method

Six research agents covered six segments, one each. Each one searched the web, read store listings, official forms and articles, and wrote notes with numbered sources. A second agent per segment then checked a sample of claims in each segment against the sources:

| Segment | Sources | Claims checked | Corrected |
|---|---|---|---|
| Teen hour-log apps | 29 | 10 | 0 |
| Course providers (Aceable, DriversEd.com, Zutobi) | 32 | 10 | 1 |
| Official and state apps and forms | 30 | 12 | 2 |
| Reviews, UX and engagement research | 32 | 12 | 1 |
| Telematics and family-safety apps | 33 | 10 | 5 |
| Generic mileage and time trackers | 39 | 10 | 1 |

That is 195 source entries. After duplicate URLs are merged, 180 remain: 156 are cited in this report and 24 are listed as also consulted (section 7). Corrected claims were fixed in the notes before this report was written.

Limits:
- Reddit blocked automated reads, so there are no forum opinions here.
- Some Google Play numbers come from search snippets or aggregators (AppBrain, AppGoblin), not from the store page.
- DMV.org could not be reached.
- Several app names in the brief or found by search could not be found in any store: Permit Pal, DriveTime, Roadcrew, 50 Hours, Smartdrive and Teen Driver Pro.
- Prices are US App Store prices on 2026-11-08 unless noted.
- RoadReady is made by Safe Roads Alliance, not a state DMV [18].

## 1. Landscape

### 1.1 Teen hour-log apps (direct competitors)

| Tool | What it is | Price | Source |
|---|---|---|---|
| RoadReady (Safe Roads Alliance) | GPS drive log with an account. Endorsed by several state DMVs. Prints a log. | Free with ads | [5][18][19][20] |
| RoadReady Ohio | Ohio's own version. Downloads the BMV affidavit, has supervisor tools and two-factor sign-in. | Free (state-funded) | [9][8][9] |
| GoTime | Shared log for every supervisor, several teens, 8 PM reminder that skips evenings with a drive, PDF and CSV, RoadReady import, pause and resume | Pro $3.99/mo or $19.99/yr | [12] |
| PermitLog | Signature columns, Indiana SF 54706 and Florida HSMV 71143 layouts, test-date countdown, manual bad-weather hours for PA and SD | $4.99 | [10] |
| LaneUp | Parent dashboard with drive approval, curfew warnings at 30 and 15 minutes, state PDF logs (NC, CA, TX, FL, NY, VA, OH, PA) | Free | [14] |
| Clocked | Teen and parent phones synced, flags duplicate drives, state-formatted PDF | PDF unlock $4.99 | [11] |
| Moda | Permit hours log | $4.99 | [21] |
| DMV Driving Hours Log | Log with Pro plans | $2.99/week to $39.99 lifetime | [13] |
| DriveMint | Teen driving log (Android) | $5.99 | [22] |
| DriveLogs | Teen driving hours | $4.99 | [23] |
| GUIDE2Safeti | Teen driving log | $14.99/mo or $59.99 per 6 months | [24] |
| Student Driving Logger | Simple manual log; import and export to merge devices | Free; "Remove Ads" $3.99 | [25] |
| Drive Logger | Open-source student log. Reviewers ask for a pause button. | Free | [26] |
| New Drive | Basic log | $0.99 | [27] |
| DriveitHOME (National Safety Council) | Lesson ideas for parents more than a log | Free; rated 1.2 | [28][29] |
| Teen Driving Log, LBoard, Drive Experience Log, Student Driving Log | Smaller manual logs | Free to a few dollars | [30][31][32][33] |

### 1.2 Course providers

| Tool | What it is | Price | Source |
|---|---|---|---|
| Aceable, DriversEd.com, I Drive Safely | One company (Aceable bought DriversEd.com, which had bought I Drive Safely). Online driver's ed, permit tests, Texas parent-taught courses with a drive log. | Texas parent-taught courses $59 to $74 on sale, $99 to $115 regular | [34][35][36][37][38][39][40][41] |
| Virtual Drive of Texas, SafeMotorist | Texas parent-taught course providers | Similar to the above | [42][43][44][45] |
| TDLR (Texas) | The parent-taught programme guide every Texas family must buy. Texas requires 44 hours: 7 observation, 7 instruction and 30 practice, 10 of them at night. | $20 guide | [46][47][48] |
| Zutobi | Permit test prep with a parent driving system: 35 lessons, with skills marked on each drive | PLUS from $4.99; rated 4.7 from 239K | [49][50][51][52][53] |
| Mentor (eDriving) | Family driving coach with scores | About $9.99/mo (unverified); rated 2.5 | [54][55] |
| DRVN | Teen driving app | Price not confirmed | [56] |
| State Farm Steer Clear | Insurer programme: 5 hours over 10 trips earns a certificate and a discount. Mentor viewing was removed in v3.0.0 (April 2025). | Free with a policy | [57][58][59][57] |

An IIHS study found an app log "a viable alternative to pen and paper" [60].

### 1.3 Official apps and forms

| Jurisdiction | Requirement and format | Source |
|---|---|---|
| Ohio | BMV 5791 (rev. 9/25): 50 h, 10 at night. Night is 30 minutes after sunset to 30 minutes before sunrise. Each row needs the date, the supervisor's name and Ohio licence number, start and end times, and day and night hours and minutes. The form is notarized. RoadReady Ohio's output is accepted. | [61][7][8] |
| New York | MV-262: 50 h, 15 after sunset. A certification, not a row-by-row log. | [62] |
| California | Log is optional. Skill codes and supervisor initials. | [63] |
| Pennsylvania | 65 h: 10 at night and 5 in bad weather | [64][65] |
| Texas | DES150N 30-hour log for parent-taught; Impact Texas Teen Drivers course | [47][48][66][67] |
| Virginia | 45 h, 15 at night; parent/teen guide | [68][69] |
| Michigan | Checkpoints at 30 h (2 at night) and 50 h (10 at night). RoadReady is called a preferred format (search snippet). | [70] |
| Georgia | 40 h, 6 at night; sworn verification (Joshua's Law) | [71] |
| Minnesota | Only the official template is accepted | [72][73] |
| Indiana, Vermont, Massachusetts | Official paper logs (SF 54706, TA-VN-210, RMV log) | [74][75][76] |
| New South Wales | Since June 2024 only approved apps (Roundtrip) count. The supervisor signs on the learner's screen. Roundtrip rates 4.7. | [77][78][79][80][81] |
| Victoria | myLearners, rated 1.6 | [82][83] |
| Queensland | Logbook app rated 2.3. Supervisors approve by email, odometer readings are recorded, and night is a manual toggle allowed between 4:35 pm and 7:55 am. | [84][85][86] |
| New Zealand | Practice log advised; supervised-hours rules under review | [87][88] |

### 1.4 Telematics and family-safety apps (adjacent, not competitors)

None of these log permit hours.

| Tool | What it is | Price | Source |
|---|---|---|---|
| Life360 | Family location sharing with crash detection and driving reports. Rated 4.8 from 3.2M. It sold precise location data (The Markup, 2021). | Silver $9.99, Gold $16.99, Platinum $24.99 per month | [89][90][91][15][92][93] |
| Allstate Drivewise | Insurer telematics. Flags speed over 80 mph, hard braking, phone use and driving 11 pm to 4 am (5 am at weekends). Texas sued Allstate and Arity over data from 45M+ people. | Free with a policy | [16][94][95][96] |
| Progressive Snapshot | Insurer telematics. $328 average discount at renewal, but rates rise for about 2 in 10 drivers. | Free with a policy | [97][98] |
| Root | Insurer that prices from a test-drive period | Premium only | [99][100][101] |
| Bouncie | Plug-in GPS tracker with a family app | About $8 to $10/mo plus the device | [102][103][104][105][106] |
| Verizon Family Plus (CMT) | Carrier family app with driving insights | $14.99/mo | [107][108][109][110][111] |
| Verizon Hum | Plug-in car tracker; shut down on 2025-12-31 | Ended | [112] |
| iOS Driving Focus, Android driving Do Not Disturb | Silence the phone while driving; report nothing | Built in | [113][114] |
| OurPact, Motus Road Smart | Parental control and fleet-style driver apps | Various | [115][116] |

The FTC's data-sharing order against GM was finalized in January 2026 [17]. Teens describe resenting parents who track them [117].

### 1.5 Generic trackers and paper templates

| Tool | What it is | Price | Source |
|---|---|---|---|
| MileIQ | Automatic mileage log (drive detection) | $13.99/mo or $139.99/yr; free tier 40 drives/mo | [118][119][120][121][122][123] |
| Everlance | Mileage and expenses | $10.99/mo or $89.99/yr; free tier 30 trips/mo | [124][125] |
| TripLog | Mileage with optional beacon ($19.99) or GPS logger ($79.99) | Premium $59.99/yr | [126][127] |
| Driversnote | Mileage with iBeacon auto-tracking | Pro $11/mo on the web, $150/yr in the app; free 15 trips/mo | [128][129][130][131] |
| Hours Tracker | Time tracking | $3.99 to $47.99; free tier 3 jobs, 21 days | [132] |
| Toggl Track, Clockify | Time tracking | $9 to $24, $3.99 to $15.99 per user/mo | [133][134] |
| Strava | Activity tracker. Hides the first and last 200 m of a route by default, auto-pauses, and its Beacon live-location feature is free. | $79.99/yr | [135][136][137][138] |
| Paper templates | AAA log (it recommends 100 h), CDC and AAA parent-teen agreements, Connecticut contract, Template.net log | Free | [139][140][141][142][143] |

A PWA cannot keep `watchPosition` running in the background [144][145]. A NHTSA study found log entries were often made late, and only 32% of parents knew their state's requirement [146][147].

## 2. What competitors do better

1. **State-form output.** PermitLog, LaneUp and Clocked print logs in the layout a DMV expects, with the supervisor's name and licence number and signature or initial columns [14][10][11]. Ohio's form needs every one of those fields and a notary block [61]. ReadyToRoll's `printLog` prints a generic table.
2. **Supervisors as people.** RoadReady Ohio, GoTime and LaneUp keep a list of supervisors and attach one to each drive [9][12][14]. NSW has the supervisor sign on the learner's screen [81]. Queensland emails each supervisor to approve [86]. ReadyToRoll has only a free-text field.
3. **State rules beyond total and night.** Pennsylvania needs 5 bad-weather hours [64]. Ohio's night starts 30 minutes after sunset [61]. Michigan has two checkpoints [70]. Texas splits observation, instruction and practice [46]. `STATE_REQS` stores only a total and a night number.
4. **Reminders and pace.** GoTime sends an 8 PM reminder only on evenings with no drive [12]. PermitLog counts down to the test date [10]. Duolingo's tuned reminders added 0.5% daily users and 2% new-user retention [148].
5. **Forgiving streaks.** Duolingo gives two Streak Freezes, which added 0.38% daily active learners [149][150]. Strava counts streaks by the week [151]. Habitica lets a user "Rest in the Inn" [152]. ReadyToRoll's streak is daily and breaks on any missed day, though teens can only drive when a parent is free.
6. **Coming from RoadReady.** GoTime imports RoadReady logs [12]. RoadReady has 775K+ Android installs and many unhappy users [153][6].
7. **Duplicate detection and approval.** Clocked flags the same drive logged on two phones [11]. LaneUp lets a parent approve each drive [14].
8. **Curfew awareness.** LaneUp warns 30 and 15 minutes before curfew [14]. Drivewise counts 11 pm to 4 am driving [94].
9. **Location privacy on shared images.** Strava trims the first and last 200 m by default [136]. ReadyToRoll's share card draws the whole route.
10. **Lessons.** Zutobi's 35 parent lessons and DriveitHOME's weekly ideas tell a parent what to practise next [51][29]. ReadyToRoll has a skills checklist with tips but no plan.

## 3. Where ReadyToRoll is ahead or different

- **No account and no lost hours.** Data lives on the device. Sync is optional and end to end encrypted, so a server failure cannot lock anyone out. RoadReady's reviews are mostly about exactly that failure [5][6].
- **Free with no ads.** RoadReady has ads [20]; nearly every other app with state forms charges [10][11][12].
- **Accurate night split.** ReadyToRoll computes sunset and sunrise from the sun's position for each minute of a drive. Queensland makes the learner toggle night by hand [85], and reviewers doubt RoadReady Ohio's night classification [9].
- **Weather on every drive**, with inclement flags, and real GPS routes with elevation, speed, replay and a share card. Most hour logs are manual [30][31][33].
- **A parent view that is not surveillance.** The parent link shows totals and milestones only, never routes or places. Life360 and insurer apps collect far more and have sold or misused it [15][16][17]. Teens resent tracking [117].
- **All 50 states and DC** with handbook links, audited in `docs/state-requirements.md`.
- **Works offline as a PWA.** The limit is that GPS stops when the screen is off [144][145].

## 4. What the empty home screen should show (review items 6, 27, 36, 45, 48)

Phase 6 found that the home screen and drive idle screen have empty lower halves, and that the home tiles repeat the ring card's "left" numbers. Research points to the following.

**Principles.** Nielsen Norman Group says an empty state should show the system's status, teach in context, and give a direct path to the key task [154]. Duolingo's first run gets a learner into a lesson before anything else [155]. A NHTSA study found entries are often made late and only 32% of parents knew the requirement [147], so the home screen should state the goal and make logging the moment easy.

**Before the first drive** (no sessions):
- One first-run panel with three large actions: **Start a drive**, **Quick add** (a drive that just ended) and **Add past drives** (manual entry, later import).
- Under it, the state goal in one sentence, such as "Ohio: 50 hours, 10 at night. Night starts 30 minutes after sunset." Link the handbook. This also teaches the night rule.
- Hide the tiles until there is data. Empty zero tiles say nothing.

**After the first drive:**
- **Pace and target date** in place of the duplicate tiles: "At 3.2 h a week you finish around 14 March." If the user sets a test date, show "On track" or "Need 4.1 h a week". PermitLog's countdown is the model [10].
- **This week**: hours this week and a weekly streak ("3 weeks in a row") with one freeze a month, as Strava and Duolingo do [151][149]. Keep the daily streak for the milestone list if wanted.
- **Next step**: one suggested skill from `suggestSkill`, or a nudge to drive at night if night hours lag behind.
- **Backup health**: "Synced 2 h ago" or "Last export 23 days ago". Without an account, this is the only guard against a lost phone, and lost hours are the most common complaint in this market [6].

**Drive idle screen:** fill the lower half with a short pre-drive checklist: phone down (link to Driving Focus or driving Do Not Disturb [113][114]), supervisor chosen from the list, and "keep the screen on". GPS pauses when the screen is off in a PWA [144], so this last item protects the log.

## 5. Ranked features worth building

Size: S under a day, M a few days, L a week or more. Privacy notes say whether anything new would leave the device.

| # | Feature | Why (evidence) | Size | Privacy |
|---|---|---|---|---|
| 1 | **State-form print logs**, Ohio BMV 5791 first, then CA, VA, TX, MN, IN, FL | The main paid feature in this market [14][10][11]. Ohio requires named fields and a notary [61]. Minnesota accepts only its own template [72]. | M per state | None. Printed on the device. |
| 2 | **Supervisor list**: name, optional licence number, initials or signature per drive | Needed by Ohio's form [61]. Rivals have it [9][12][14]. | M | Inside the encrypted blob only. Never in `parentSummary`. |
| 3 | **Per-state rules** in `STATE_REQS`: Ohio's 30-minute night offset, PA's 5 bad-weather hours, MI checkpoints, TX categories | Official rules [61][64][70][46] | M | None |
| 4 | **Home pace and target date**, optional test date | The empty-home answer (section 4); PermitLog countdown [10] | S | None (local) |
| 5 | **Weekly streak with a freeze** | Teens drive when a parent can. Strava and Duolingo forgive gaps [151][149][152]. | S | None (local) |
| 6 | **Import from RoadReady** (CSV or PDF) and a "starting hours" field | GoTime imports RoadReady [12]; 775K+ RoadReady installs and many unhappy users [153][6] | M | Parsed on the device |
| 7 | **Forgotten-start backfill** ("I started 20 minutes ago") and clear screen-off gaps | Drive Logger reviewers ask for a pause [26]; GoTime has pause and resume [12]; PWA GPS stops in the background [144] | S | None |
| 8 | **Road-type and instructor tags** (highway, city, rural, parking; professional lesson) | GoTime tags road type [12]; Queensland counts instructor hours triple [84] | S | Encrypted blob only |
| 9 | **Reminders without a server**: an `.ics` file with weekly drive slots, plus an in-app nudge on open | GoTime's 8 PM reminder [12]; bandit-tuned reminders [148]. Back off after a few ignored, as Duolingo does after about 8 [156]. | S | None |
| 10 | **Backup-health line** (last sync or export) | Lost hours are the top complaint [6] | S | None |
| 11 | **Trim the share card** start and end, with an optional home radius | Strava's default [136] | S | Less location shared |
| 12 | **Several teen profiles** on one device | GoTime and LaneUp support several teens [12][14] | L | Separate keys per profile |
| 13 | **Late-night count** (minutes after 11 pm) and an optional curfew warning | LaneUp and Drivewise [14][94] | S | None |
| 14 | **Completion certificate** to print and share | Steer Clear's certificate [57]; Duolingo-style celebration | S | Totals only |
| 15 | **Post-drive reflection, parent-teen agreement, lesson plans** | CDC and AAA agreements [139][141]; Zutobi lessons [51]; DriveitHOME [29] | M | Encrypted blob only |
| 16 | **Opt-in smoothness coaching** on the device (hard braking from GPS speed) | Telematics apps score this [97][94], but teens dislike being watched [117], so keep it private to the teen | M | Never sent; never in the parent view |
| 17 | **Parent approval** of each drive through the parent link | LaneUp [14]; NSW on-screen sign-off [81] | L | Needs a write path from the parent view, which is read-only by design |

### 5.1 How the top five would work here

1. **State-form print.** `printLog` (Export / import / print in the doc map) builds one generic table. Add a `FORMS` map keyed by state code. Each entry gives the column list, header text and footer (signature, date, notary block for Ohio). `printLog` picks `FORMS[settings.state]` and falls back to the generic table. Day and night hours and minutes per row come from `sessionNightMin`. The form layouts are public PDFs [61][74][63][73]. Add a print stylesheet test per form.
2. **Supervisor list.** Add `settings.supervisors = [{id, name, licence}]` and `session.supervisorId`, with a picker in manual entry, quick add and drive idle. They sync inside the sealed blob like every other setting, so `mergeSyncData` needs a rule for the list. Leave `parentSummary` alone: it is an allow-list and must stay one. `DEVICE_ONLY_SETTINGS` should not include supervisors, so a new phone gets them.
3. **Per-state rules.** Extend each `STATE_REQS` entry with optional fields: `nightOffsetMin` (Ohio 30), `badWeather` (PA 5), `checkpoints` (MI), `categories` (TX). `nightMinutes` takes the offset. `computeTotals` adds bad-weather hours from `isInclement`. `goalCard` shows extra goals only when a state has them. Each new value needs a source line in `docs/state-requirements.md`.
4. **Pace and target date.** In `renderHome`, compute hours per week over the last four weeks from `sessions`, then the date the remaining hours run out. Add an optional `settings.testDate`. This replaces the tiles that repeat the ring's "left" numbers. The before-first-drive panel replaces `emptyStateHTML` on home.
5. **Weekly streak.** `getStreak` counts consecutive days. Add `getWeekStreak`, which counts consecutive weeks with at least one drive, and allow one missed week per four. Show it on home. Keep the daily number for the existing milestone so no earned badge disappears.

## 6. Not worth building (and why)

- **A permit test question bank.** Zutobi and Aceable do this well and at scale [49][36]. It is content work unrelated to logging hours.
- **Behaviour scores sent to parents.** This is what teens resent [117], and it would break the totals-only parent view.
- **Live location sharing.** Life360 owns this and has sold location data [15]. It would also need a server that can read location.
- **Background auto-detection of drives.** A PWA cannot run GPS in the background [144][145]. MileIQ needs a native app for it [120].
- **Web Push reminders.** These need a push server holding subscriptions. The `.ics` file and in-app nudge cover most of the value.
- **Accounts or licence validation.** Accounts are the cause of RoadReady's worst reviews [6]. Checking licence numbers needs state systems the app cannot reach.
- **Ads or a subscription.** Free with no ads is a real difference in this market [20][10].

## 7. Sources

1. Delaware DMV launches new mobile app in support of the Parent's Supervised Driving Program (2013-10-18). <https://news.delaware.gov/2013/10/18/delaware-dmv-launches-new-mobile-app-in-support-of-the-parents-supervised-driving-program>. Accessed 2026-11-08.
2. Nevada DMV offers new program, app to help parents of teen drivers (Las Vegas Review-Journal). <https://www.reviewjournal.com/news/nevada-dmv-offers-new-program-app-help-parents-teen-drivers>. Accessed 2026-11-08. Search snippet only.
3. MassDOT RMV, "MassDOT RMV Announces Enhanced RoadReady App". <https://www.mass.gov/news/massdot-rmv-announces-enhanced-roadreadyr-app>. Accessed 2026-11-08. Search snippet only.
4. Rhode Island DMV - Parent's Supervised Driving Program (with RoadReady Ohio App Store listing and a Florida guide in the same results). <https://dmv.ri.gov/PSDP/>. Accessed 2026-11-08. Search snippet only.
5. RoadReady - App Store. <https://apps.apple.com/us/app/roadready/id699534935>. Accessed 2026-11-08.
6. Contact RoadReady / reported problems - JustUseApp. <https://justuseapp.com/en/app/699534935/roadready/contact>. Accessed 2026-11-08.
7. Signal Ohio, "Ohio releases app to help drivers-in-training log supervised time behind the wheel". <https://signalohio.org/ohio-releases-app-to-help-drivers-in-training-log-supervised-time-behind-the-wheel/>. Accessed 2026-11-08.
8. Ohio Governor, "Governor DeWine Announces Creation of New Driver Safety App for Practicing Drivers". <https://content.govdelivery.com/accounts/OHIOGOVERNOR/bulletins/3f34868>. Accessed 2026-11-08.
9. RoadReady Ohio - App Store. <https://apps.apple.com/us/app/-/id6748363429>. Accessed 2026-11-08.
10. PermitLog - Driving Hours - App Store. <https://apps.apple.com/app/id6761863108>. Accessed 2026-11-08.
11. Clocked - Teen Driving Log - App Store. <https://apps.apple.com/app/id6764368827>. Accessed 2026-11-08.
12. GoTime - Teen Driving Log - App Store. <https://apps.apple.com/us/app/id6759268978>. Accessed 2026-11-08.
13. DMV Driving Hours Log - App Store. <https://apps.apple.com/us/app/-/id6765655988>. Accessed 2026-11-08.
14. LaneUp - App Store. <https://apps.apple.com/us/app/laneup/id6760084574>. Accessed 2026-11-08.
15. The Popular Family Safety App Life360 Is Selling Precise Location Data (The Markup, 2021-12-06). <https://themarkup.org/privacy/2021/12/06/the-popular-family-safety-app-life360-is-selling-precise-location-data-on-its-tens-of-millions-of-user>. Accessed 2026-11-08.
16. Texas Lawsuit Alleges Allstate Illegally Collects Driver Data (Insurance Journal, 2025-01-13). <https://www.insurancejournal.com/news/southcentral/2025/01/13/808043.htm>. Accessed 2026-11-08.
17. The FTC's data-sharing order against GM is finally settled (TechCrunch, 2026-01-14). <https://techcrunch.com/2026/01/14/the-ftcs-data-sharing-order-against-gm-is-finally-settled>. Accessed 2026-11-08.
18. RoadReady official site. <https://www.roadreadyapp.com/>. Accessed 2026-11-08.
19. RoadReady - AppBrain (Android stats). <https://www.appbrain.com/app/roadready/com.saferoadsalliance.roadready>. Accessed 2026-11-08. Search snippet only.
20. RoadReady pricing (App Pricing Lab). <https://apppricinglab.com/app/apple/699534935>. Accessed 2026-11-08. Search snippet only.
21. Moda: Driving Permit Hours Log - App Store. <https://apps.apple.com/us/app/id6760154154>. Accessed 2026-11-08.
22. DriveMint: Teen Driving Log - Google Play. <https://play.google.com/store/apps/details?id=com.drivemint.app>. Accessed 2026-11-08. Search snippet only.
23. DriveLogs - Teen Driving Hours - App Store. <https://apps.apple.com/us/app/id6761263598>. Accessed 2026-11-08.
24. Teen Driving Log. GUIDE2Safeti - App Store. <https://apps.apple.com/us/app/top1driver/id6479383022>. Accessed 2026-11-08.
25. Student Driving Logger - App Store. <https://apps.apple.com/app/id1535395757>. Accessed 2026-11-08.
26. Drive Logger - student driver - App Store. <https://apps.apple.com/us/app/drive-logger-student-driver/id1533511069>. Accessed 2026-11-08.
27. New Drive - App Store. <https://apps.apple.com/us/app/new-drive/id1058675322>. Accessed 2026-11-08.
28. DriveitHOME - App Store. <https://apps.apple.com/us/app/driveithome/id6449082985>. Accessed 2026-11-08.
29. DriveitHOME - National Safety Council. <https://www.nsc.org/DriveitHOME>. Accessed 2026-11-08. Search snippet only.
30. Teen Driving Log (NerdsGeeksGurus) - App Store. <https://apps.apple.com/us/app/teen-driving-log/id385816093>. Accessed 2026-11-08.
31. LBoard - Student Driver Log - App Store. <https://apps.apple.com/us/app/-/id1441326063>. Accessed 2026-11-08.
32. Drive Experience Log - App Store. <https://apps.apple.com/us/app/-/id6742055027>. Accessed 2026-11-08.
33. Student Driving Log (Sam Wolf) - App Store. <https://apps.apple.com/us/app/student-driving-log/id6472604271>. Accessed 2026-11-08.
34. Aceable - Texas Parent Taught Drivers Ed. <https://www.aceable.com/drivers-ed/texas/parent-taught/>. Accessed 2026-11-08.
35. Aceable - Texas Parent Taught, For Parents. <https://aceable.com/drivers-ed/texas-parent-taught/parents>. Accessed 2026-11-08.
36. Aceable Drivers Ed & More - App Store. <https://apps.apple.com/us/app/id766014676>. Accessed 2026-11-08.
37. DriversEd.com - home page (course prices). <https://www.driversed.com/>. Accessed 2026-11-08.
38. DriversEd.com - Texas Parent-Taught Drivers Ed. <https://www.driversed.com/texas/parent-taught-drivers-ed/>. Accessed 2026-11-08.
39. Groupon - Aceable Inc business listing (I Drive Safely and DriversEd.com as acquired brands). <https://www.groupon.com/biz/aceable-inc>. Accessed 2026-11-08. Search snippet only.
40. Mergr - DriversEd.com acquires I Drive Safely. <https://mergr.com/transaction/driversed-com-acquires-i-drive-safely>. Accessed 2026-11-08. Search snippet only.
41. I Drive Safely - Texas Parent-Taught Drivers Ed. <https://www.idrivesafely.com/drivers-ed/texas/parent-taught/>. Accessed 2026-11-08.
42. Virtual Drive of Texas - Texas Parent Taught Drivers Ed. <https://virtualdriveoftexas.com/texas-parent-taught-drivers-ed/>. Accessed 2026-11-08.
43. Virtual Drive of Texas - In-Car Course Details. <https://virtualdriveoftexas.com/in-car-course-details/>. Accessed 2026-11-08.
44. Virtual Drive of Texas - How Parent-Taught Driver's Ed Works in Texas. <https://virtualdriveoftexas.com/parent-taught/>. Accessed 2026-11-08.
45. SafeMotorist - Texas Parent Taught Drivers Education. <https://www.safemotorist.com/texas/parent-taught-drivers-education>. Accessed 2026-11-08.
46. TDLR - Parent Taught Driver Education. <https://www.tdlr.texas.gov/driver/education/parent-taught/>. Accessed 2026-11-08.
47. Texas DPS, "Texas Provisional License as a Teen". <https://www.dps.texas.gov/section/driver-license/texas-provisional-license-teen>. Accessed 2026-11-08.
48. TDLR, "Forms and Publications for Driver Education Providers" (DES150N 30-hour log). <https://www.tdlr.texas.gov/driver/drivereduforms.htm>. Accessed 2026-11-08.
49. Zutobi: Permit & Driving Prep - App Store. <https://apps.apple.com/US/app/id1394069110>. Accessed 2026-11-08.
50. Zutobi - Parent guide, Practice log. <https://zutobi.com/us/parents/practice-log>. Accessed 2026-11-08.
51. Zutobi - The Zutobi Parent Driving System. <https://zutobi.com/us/parents/zutobi-parent-driving-system>. Accessed 2026-11-08.
52. Zutobi - Driving schools pricing. <https://zutobi.com/us/driving-schools/pricing>. Accessed 2026-11-08.
53. ToolRadar - Zutobi pricing. <https://toolradar.com/tools/zutobi/pricing>. Accessed 2026-11-08. Search snippet only.
54. Mentor Family by eDriving - App Store. <https://apps.apple.com/us/app/id1249477801>. Accessed 2026-11-08.
55. eDriving store - Mentor for Families. <https://store.edriving.com/product/mentor-for-families/>. Accessed 2026-11-08. Search snippet only.
56. DRVN - App Store. <https://apps.apple.com/us/app/id1244075088>. Accessed 2026-11-08.
57. Enroll and save with Steer Clear® (State Farm). <https://www.statefarm.com/insurance/auto/discounts/steer-clear>. Accessed 2026-11-08.
58. Steer Clear® on the App Store. <https://apps.apple.com/us/app/steer-clear/id1434324487>. Accessed 2026-11-08.
59. State Farm Steer Clear (LendingTree / WalletHub summaries). <https://www.lendingtree.com/car-insurance/state-farm-steer-clear/>. Accessed 2026-11-08. Search snippet only.
60. IIHS - Smartphone app shows promise for logging teens' practice drives (2022-10-13). <https://www.iihs.org/news/detail/smartphone-app-shows-promise-for-logging-teens-practice-drives>. Accessed 2026-11-08.
61. Ohio BMV 5791 "Fifty Hour Affidavit" (rev. 9/25). <https://dam.assets.ohio.gov/image/upload/publicsafety.ohio.gov/bmv5791.pdf>. Accessed 2026-11-08.
62. NY DMV MV-262 "Certification of Supervised Driving" (rev. 3/25). <https://dmv.ny.gov/forms/mv262.pdf>. Accessed 2026-11-08.
63. California DMV "Supervised Driving Log". <https://www.dmv.ca.gov/portal/file/supervised-driving-log-pdf>. Accessed 2026-11-08.
64. PennDOT / pa.gov, "Get a Driver License". <https://www.pa.gov/en/services/dmv/get-a-driver-license.html>. Accessed 2026-11-08.
65. PA Driver's Manual, "Applying for a Learner's Permit". <https://www.pa.gov/agencies/dmv/driver-services/pennsylvania-drivers-manual/online-drivers-manual/applying-for-a-learners-permit>. Accessed 2026-11-08.
66. Texas DPS, "Impact Texas Teen Drivers FAQ". <https://impacttexasdrivers.dps.texas.gov/ittd/FAQ.aspx>. Accessed 2026-11-08. Search snippet only.
67. Virtual Drive of Texas, "How Do You Log Behind-the-Wheel Driving Time in Texas?". <https://virtualdriveoftexas.com/license-news/how-do-we-log-behind-the-wheel-driving-time>. Accessed 2026-11-08. Search snippet only.
68. Virginia DOE, "45-Hour Parent/Teen Driving Guide". <https://doe.virginia.gov/home/showpublisheddocument/1994/637949897707070000>. Accessed 2026-11-08. Search snippet only.
69. Chantilly HS (FCPS), "Required Driving Practice". <https://chantillyhs.fcps.edu/node/2580>. Accessed 2026-11-08. Search snippet only.
70. Michigan SOS, "Michigan Supervised Driving Log". <https://www.michigan.gov/documents/sos/Michigan_supervised_driving_log_572744_7.pdf>. Accessed 2026-11-08. Search snippet only.
71. Georgia DDS, "Joshua's Law Explained FAQs". <https://dds.georgia.gov/node/1821>. Accessed 2026-11-08.
72. Minnesota DVS Supervised Driving Log. <https://dps.mn.gov/divisions/ots/teen-driving/Documents/supervised-driving-log-dvs.pdf>. Accessed 2026-11-08. Search snippet only.
73. Minnesota DPS Driver and Vehicle Services - Supervised Driving Log (PDF). <https://dps.mn.gov/divisions/dvs/forms-documents/Documents/SupervisedDrivingLog.pdf>. Accessed 2026-11-08. Search snippet only.
74. Indiana State Form 54706 (log of supervised driving). <https://forms.in.gov/Download.aspx?id=9758>. Accessed 2026-11-08. Search snippet only.
75. Vermont DMV Form TA-VN-210 Driving Practice Log (copy on etags.com). <https://www.etags.com/blog/wp-content/uploads/2018/05/VT-DMV-Form-TA-VN-210.pdf>. Accessed 2026-11-08. Search snippet only.
76. Massachusetts RMV - Supervised Driving Log. <https://www.mass.gov/doc/supervised-driving-log/download>. Accessed 2026-11-08. Search snippet only.
77. NSW Government, "Learner driving log book apps". <https://www.nsw.gov.au/driving-boating-and-transport/driving-nsw/driver-and-rider-licences/driver-licences/learner-driver-licence/learners-driver-log-book-app>. Accessed 2026-11-08.
78. NSW Government, "Using your Learner Driver Log Book". <https://www.nsw.gov.au/driving-boating-and-transport/driver-and-rider-licences/driver-licences/learner-driver-licence/using-your-learner-driver-log-book>. Accessed 2026-11-08.
79. Roundtrip Learner Logbook, App Store (AU). <https://apps.apple.com/au/app/id1171287648>. Accessed 2026-11-08.
80. LTrent Driving School, "Digital logbook" (Roundtrip Pro $2.29/month). <https://www.ltrent.com.au/driving-lessons/digital-logbook/>. Accessed 2026-11-08. Search snippet only.
81. Roundtrip, "Supervisors & Driving Instructors FAQ". <https://roundtripapp.pages.dev/supervisors>. Accessed 2026-11-08. Search snippet only.
82. Transport Victoria, "myLearners FAQs". <https://transport.vic.gov.au/road-and-active-transport/registration-and-licensing/licences/learner-permit/mylearners-faqs>. Accessed 2026-11-08. Search snippet only.
83. myLearners, App Store (AU). <https://apps.apple.com/au/app/mylearners/id1436550381>. Accessed 2026-11-08.
84. Queensland Government, "Queensland learner logbook app". <https://qld.gov.au/transport/licensing/getting/learner-logbook/queensland-learner-logbook-app>. Accessed 2026-11-08.
85. QLD Learner Logbook, App Store (AU). <https://apps.apple.com/au/app/qld-logbook/id1094522699>. Accessed 2026-11-08.
86. Queensland Government, "Learner logbook". <https://www.qld.gov.au/transport/licensing/getting/learner-logbook>. Accessed 2026-11-08. Search snippet only.
87. NZTA drive.govt.nz, "Keeping a practice log". <https://drive.govt.nz/teach-someone-to-drive/hints-and-tips/keeping-a-practice-log>. Accessed 2026-11-08. Search snippet only.
88. NZ AA, submission on GDLS supervised hours (2026). <https://www.aa.co.nz/content/dam/nzaa/01-brand/governance---reporting/governance/government-submissions/2026-submissions/AA%20submission%20on%20GDLS%20supervised%20hours%20FINAL.pdf>. Accessed 2026-11-08. Search snippet only.
89. Life360: Find Friends & Family on the App Store. <https://apps.apple.com/us/app/life360-find-friends-family/id384830320>. Accessed 2026-11-08.
90. Life360 Launches Driver Protect (press release, 2016). <https://www.life360.com/press/life360-launches-driver-protect-bringing-auto-crash-detection-and-family-driving-analysis-to-the-smartphone>. Accessed 2026-11-08. Search snippet only.
91. Is Life360 free? What the free plan actually includes in 2026. <https://northlabapps.com/blog/is-life360-free/>. Accessed 2026-11-08. Search snippet only.
92. Arity (Life360 Help Center). <https://support.life360.com/hc/en-us/articles/23053397958551-Arity>. Accessed 2026-11-08. Search snippet only.
93. Driving Safety - Life360. <https://www.life360.com/en-us/driving-safety/>. Accessed 2026-11-08. Search snippet only.
94. Allstate Drivewise Review: How It Works (Compare.com). <https://www.compare.com/auto-insurance/reviews/allstate-drivewise-review>. Accessed 2026-11-08.
95. Allstate Mobile on the App Store / Google Play. <https://apps.apple.com/us/app/allstate-mobile/id364376344>. Accessed 2026-11-08. Search snippet only.
96. Allstate - Drivewise Frequently Asked Questions. <https://www.allstate.com/help-support/drivewise-support/faqs>. Accessed 2026-11-08. Search snippet only.
97. Snapshot (Progressive). <https://www.progressive.com/auto/discounts/snapshot/>. Accessed 2026-11-08.
98. Progressive on the App Store. <https://apps.apple.com/us/app/progressive/id349731802>. Accessed 2026-11-08. Search snippet only.
99. Root help: Get a quote / test drive. <https://joinroot.com/help/day-one>. Accessed 2026-11-08. Search snippet only.
100. Root: Better car insurance on the App Store. <https://apps.apple.com/us/app/root-better-car-insurance/id1021256908>. Accessed 2026-11-08.
101. How Root determines driving safety (Root blog). <https://www.joinroot.com/blog/how-root-determines-driving-safety/>. Accessed 2026-11-08.
102. Bouncie home page. <https://www.bouncie.com/>. Accessed 2026-11-08.
103. Bouncie Simple Pricing. <https://www.bouncie.com/pricing>. Accessed 2026-11-08.
104. Bouncie Family. <https://www.bouncie.com/family>. Accessed 2026-11-08.
105. Bouncie on the App Store. <https://apps.apple.com/us/app/bouncie/id1211282909>. Accessed 2026-11-08.
106. Bouncie GPS Tracker Review (SafeWise) and Bouncie review ($8/month). <https://www.safewise.com/blog/bouncie-gps-vehicle-tracker-review>. Accessed 2026-11-08. Search snippet only.
107. Cambridge Mobile Telematics acquires TrueMotion (Insurance Journal, 2021-06-17). <https://www.insurancejournal.com/news/national/2021/06/17/618964.htm>. Accessed 2026-11-08. Search snippet only.
108. TrueMotion Launches Free Family Driving App (GlobeNewswire, 2016-07-26). <https://www.globenewswire.com/news-release/2016/07/26/1005714/0/en/TrueMotion-Launches-Free-Family-Driving-App-to-Increase-Safety-and-Reduce-Insurance-Costs.html>. Accessed 2026-11-08. Search snippet only.
109. CMT partners with Verizon to bring driving insights to the Smart Family app (CMT blog, 2021-09-15). <https://www.cmtelematics.com/blog/cambridge-mobile-telematics-partners-with-verizon-to-bring-driving-insights-to-the-smart-family-app/>. Accessed 2026-11-08.
110. What parents need to know about Verizon Family Plus (Verizon, 2025-08-21). <https://www.verizon.com/about/parenting/what-parents-need-to-know-about-verizon-family-plus>. Accessed 2026-11-08.
111. CMT expands DriveWell Engage with Universal Rewards and Family Connect (Coverager, 2025-11-13). <https://coverager.com/cambridge-mobile-telematics-expands-drivewell-engage-with-universal-rewards-and-family-connect/>. Accessed 2026-11-08.
112. Verizon Hum shutting down (9to5Google, 2025-10-01). <https://9to5google.com/2025/10/01/verizon-hum-shutting-down/>. Accessed 2026-11-08. Search snippet only.
113. Use the Driving Focus on your iPhone (Apple Support). <https://support.apple.com/en-us/108384>. Accessed 2026-11-08.
114. How to turn on Do Not Disturb while driving on Google Pixel (How-To Geek). <https://www.howtogeek.com/687102/how-to-turn-on-do-not-disturb-while-driving-on-google-pixel/>. Accessed 2026-11-08. Search snippet only.
115. OurPact pricing. <https://www.ourpact.com/pricing>. Accessed 2026-11-08.
116. Motus launches Road Smart (Business Wire, 2025-10-15). <https://www.businesswire.com/news/home/20251015045414/en>. Accessed 2026-11-08. Search snippet only.
117. 'They control me': Angry teens hit out at parents obsessed with tracking app (Yahoo News AU) and student-press coverage. <https://au.news.yahoo.com/creepy-and-stalkerish-teens-claim-parents-use-app-to-control-them-070759103.html>. Accessed 2026-11-08. Search snippet only.
118. MileIQ - Pick the plan that works for you (pricing). <https://mileiq.com/pricing>. Accessed 2026-11-08.
119. MileIQ: Mileage Tracker & Log - App Store (US). <https://apps.apple.com/us/app/mileiq-mileage-tracker-log/id578830929>. Accessed 2026-11-08.
120. MileIQ - Drive Detection and Classification. <https://mileiq.com/mileage-tracker/drive-detection>. Accessed 2026-11-08.
121. MileIQ Help Center - Battery life best practices. <https://support.mileiq.com/hc/en-us/articles/204480735-Battery-life-best-practices>. Accessed 2026-11-08. Search snippet only.
122. Microsoft Mobile Engineering - MileIQ improves the drive quality using Bluetooth. <https://medium.com/microsoft-mobile-engineering/mileiq-improves-the-drive-quality-using-bluetooth-ad746c084d88>. Accessed 2026-11-08. Search snippet only.
123. Mileage Tracker & Log - MileIQ - Google Play. <https://play.google.com/store/apps/details?id=com.mobiledatalabs.mileiq&hl=en_US>. Accessed 2026-11-08. Search snippet only.
124. Everlance - Plans built for self-employed success. <https://www.everlance.com/premium>. Accessed 2026-11-08.
125. Mileage Tracker by Everlance - App Store (US). <https://apps.apple.com/us/app/everlance-mileage-tracker-log/id985378916>. Accessed 2026-11-08.
126. TripLog - Plans & Pricing. <https://www.triplog.net/pricing/>. Accessed 2026-11-08.
127. Mileage Tracker App by TripLog - App Store (US). <https://apps.apple.com/us/app/mileage-tracker-app-by-triplog/id585918522>. Accessed 2026-11-08.
128. Driversnote - Pricing. <https://www.driversnote.com/pricing>. Accessed 2026-11-08.
129. Mileage Tracker by Driversnote - App Store (US). <https://apps.apple.com/us/app/mileage-tracker-by-driversnote/id924418916>. Accessed 2026-11-08.
130. Driversnote - Even easier & more accurate auto-tracking with iBeacon. <https://driversnote.com/ibeacon>. Accessed 2026-11-08. Search snippet only.
131. Driversnote Knowledge Base - Tracking Configuration & Settings Requirements. <https://driversnote.helpscoutdocs.com/article/162-tracking-health-settings-requirements>. Accessed 2026-11-08. Search snippet only.
132. App Pricing Lab - Hours Tracker: Time Tracking (Cribasoft, LLC), App Store. <https://apppricinglab.com/app/apple/336456412>. Accessed 2026-11-08.
133. Toggl Track - Pricing. <https://toggl.com/track/pricing/>. Accessed 2026-11-08.
134. Clockify - Pricing. <https://clockify.me/pricing>. Accessed 2026-11-08.
135. Strava - Pricing. <https://www.strava.com/pricing>. Accessed 2026-11-08.
136. Strava Support - Edit Map Visibility. <https://support.strava.com/hc/en-us/articles/115000173384-Edit-Map-Visibility>. Accessed 2026-11-08.
137. Strava Support - Auto-Pause. <https://support.strava.com/en-us/articles/15402141-auto-pause>. Accessed 2026-11-08.
138. Coach - Strava's Beacon Safety Feature Is Now Free To Use (Aug 2021). <https://www.coachweb.com/fitness-apps/9051/strava-s-beacon-safety-feature-is-now-free-to-use>. Accessed 2026-11-08.
139. CDC Parents Are the Key - Parent-Teen Driving Agreement. <https://www.cdc.gov/parentsarethekey/agreement/>. Accessed 2026-11-08.
140. AAA Mid-Atlantic - Parent-Teen Agreement and Practice Log (PDF). <https://midatlantic.aaa.com/-/media/pdfs/ParentTeenAgrmt--Practice-Log.pdf>. Accessed 2026-11-08. Search snippet only.
141. AAA - Parent-Teen Driving Agreement (PDF). <https://aaa.com/AAA/005/public/resources/downloads/parent_teen_driving_agreement.pdf>. Accessed 2026-11-08.
142. Connecticut DMV - Parent-Teen Driving Contract (credits The Allstate Foundation). <https://portal.ct.gov/-/media/DMV/parentteendrivingcontractpdf.pdf>. Accessed 2026-11-08. Search snippet only.
143. Template.net - Practice Driving Log. <https://www.template.net/business/log/practice-driving-log>. Accessed 2026-11-08. Search snippet only.
144. Mozilla Bugzilla - Bug 1482733, Geolocation.watchPosition() doesn't work in background on Android O and above. <https://bugzilla.mozilla.org/show_bug.cgi?id=1482733>. Accessed 2026-11-08.
145. Progressier - PWA capabilities: Geolocation. <https://progressier.com/pwa-capabilities/geolocation>. Accessed 2026-11-08.
146. NHTSA - The Role of Supervised Driving Requirements in a Graduated Driver Licensing Program (DOT HS 811 550). <https://www.nhtsa.gov/sites/nhtsa.gov/files/811550.pdf>. Accessed 2026-11-08. Search snippet only.
147. The Role of Supervised Driving Requirements in Graduated Driver Licensing Programs (NHTSA, Foss et al.). <https://rosap.ntl.bts.gov/view/dot/1923>. Accessed 2026-11-08.
148. A Sleeping, Recovering Bandit Algorithm for Optimizing Recurring Notifications (Yancey and Settles, KDD 2020). <https://research.duolingo.com/papers/yancey.kdd20.pdf>. Accessed 2026-11-08. Search snippet only.
149. How the Duolingo streak builds habit - Duolingo Blog. <https://blog.duolingo.com/how-duolingo-streak-builds-habit>. Accessed 2026-11-08.
150. How to keep your streak on vacation - Duolingo Blog. <https://blog.duolingo.com/how-to-keep-your-streak-on-vacation>. Accessed 2026-11-08.
151. Streaks on Strava - Strava Support. <https://support.strava.com/en-us/articles/15401580-streaks-on-strava>. Accessed 2026-11-08.
152. Rest in the Inn - Habitica Wiki. <https://habitica.fandom.com/wiki/Rest_in_the_Inn>. Accessed 2026-11-08. Search snippet only.
153. RoadReady (Android, com.saferoadsalliance.roadready) - AppGoblin. <https://appgoblin.info/apps/com.saferoadsalliance.roadready>. Accessed 2026-11-08.
154. Designing Empty States in Complex Applications - Nielsen Norman Group. <https://www.nngroup.com/articles/empty-state-interface-design/>. Accessed 2026-11-08.
155. Duolingo's delightful user onboarding experience - Appcues GoodUX. <https://goodux.appcues.com/blog/duolingo-user-onboarding>. Accessed 2026-11-08.
156. Growth Dives: Duolingo's 6-step reactivation experience. <https://growth-dives.kit.com/posts/growth-dives-duolingo-s-6-step-reactivation-experience>. Accessed 2026-11-08.

Also consulted (not cited above):

157. Best Driving Log Apps For Teenagers (AppsHunter). <https://appshunter.io/ios/topics/driving-log-apps-for-teenagers>. Accessed 2026-11-08. Search snippet only.
158. DriversEd.com - California Drivers Ed. <https://www.driversed.com/california/drivers-ed/>. Accessed 2026-11-08.
159. Teen & Adult Drivers Ed Online (DriversEd.com app, Aceable Inc.) - App Store. <https://apps.apple.com/us/app/id6738843099>. Accessed 2026-11-08.
160. DriversEd.com - Driving Lessons. <https://www.driversed.com/driving-lessons/>. Accessed 2026-11-08.
161. DriversEd.com - Driving guidance for your teen when you can't be there. <https://driversed.com/trending/driving-guidance-for-your-teen-when-you-cant-be-there>. Accessed 2026-11-08.
162. I Drive Safely - Texas Parent-Taught FAQ. <https://idrivesafely.com/drivers-ed/texas/parent-taught/faq>. Accessed 2026-11-08.
163. Zutobi - California Online Drivers Ed for Teens. <https://zutobi.com/us/ca-car>. Accessed 2026-11-08.
164. AppBrain / AppFollow - Zutobi Android installs and ratings. <https://www.appbrain.com/dev/Zutobi/>. Accessed 2026-11-08. Search snippet only.
165. IGottaDrive - DMV Practice Tests. <https://igottadrive.com/dmv-practice-tests/>. Accessed 2026-11-08. Search snippet only.
166. San Diego Magazine - DMV Cheat Sheets vs Aceable permit practice tests. <https://sandiegomagazine.com/guides/dmv-cheat-sheets-vs-aceable-permit-practice-tests/>. Accessed 2026-11-08. Search snippet only.
167. RoadReady Ohio, App Store listing (via AppFollow). <https://apps.appfollow.io/ios/roadready-ohio/6748363429?country=us>. Accessed 2026-11-08.
168. RoadReady (iOS) - AppFollow. <https://apps.appfollow.io/ios/roadready/699534935?country=us>. Accessed 2026-11-08. Search snippet only.
169. Ohio app gives feedback to young drivers and their parents - GovTech. <https://www.govtech.com/transportation/ohio-app-gives-feedback-to-young-drivers-and-their-parents>. Accessed 2026-11-08. Search snippet only.
170. Parental Perceptions of the Learner Driver Log Book System in Two Australian States (Bates, Watson, King 2014). <https://informahealthcare.com/doi/full/10.1080/15389588.2014.891104>. Accessed 2026-11-08. Search snippet only.
171. Budget Direct survey on falsified learner logbooks, reported by the Maryborough Advertiser. (URL not captured). Accessed 2026-11-08. Search snippet only.
172. NJ mandates 50 practice driving hours for teens: how can you prove it? - NJ 101.5. <https://nj1015.com/nj-mandates-50-practice-driving-hours-for-teens-how-can-you-prove-it/>. Accessed 2026-11-08.
173. Product lessons from Friend Streak - Duolingo Blog. <https://blog.duolingo.com/product-lessons-friend-streak/>. Accessed 2026-11-08.
174. Strava Goals update - BikeRadar. <https://www.bikeradar.com/news/strava-goals-update/>. Accessed 2026-11-08.
175. How much does Strava cost - ThePricer. <https://www.thepricer.org/how-much-does-strava-cost/>. Accessed 2026-11-08. Search snippet only.
176. Habitica: Gamified Taskmanager - App Store. <https://apps.apple.com/us/app/habitica-gamified-taskmanager/id994882113>. Accessed 2026-11-08.
177. State Farm Newsroom - Nevada DMV and State Farm Parent's Supervised Driving Program. <https://newsroom.statefarm.com/072916-nv-dmv-teen-driver-safety/>. Accessed 2026-11-08.
178. iBerkshires - MassDOT RMV Announces Enhanced RoadReady App (27 June 2026). <https://www.iberkshires.com/story/83045/MassDOT-RMV-Announces-Enhanced-RoadReady-App.html>. Accessed 2026-11-08.
179. GHSA - Outcomes of Variability in Teen Driving Experience and Exposure (BTS-23). <https://www.ghsa.org/resource-hub/outcomes-variability-teen-driving-experience-and-exposure-evidence-naturalistic>. Accessed 2026-11-08.
180. UNC Highway Safety Research Center - Directions (Spring 2012), supervised driving requirements. <https://www.hsrc.unc.edu/directions/2012/spring/gdl.htm>. Accessed 2026-11-08.
