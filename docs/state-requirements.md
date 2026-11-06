# State supervised-driving requirements: audit

The app's `STATE_REQS` table (in `readytoroll.html`) was checked against each state's official DMV/DOT page,
statute or driver manual. Hours are written as total/night (and /inclement where a state requires it).

- **Date checked:** 2026-11-05
- **What was checked:** the total supervised hours, the night hours and the app's note, for a teen under 18
  getting a first permit.
- **What was not checked:** the `handbookUrl` links, permit holding periods and driver-ed course hours.
  These appear in the notes column only where they change the hours.

Requirements change. Re-check a state's source before relying on it, and update this file with the new date.

## Mismatches

These were fixed in `STATE_REQS` on 2026-11-05 unless marked otherwise.

| State | App had | Official | Fix |
|---|---|---|---|
| AL Alabama | 50/10 | 50/0 | The ALEA GDL page lists 50 hours (or a state-approved driver ed course instead), with no night hours. Night set to 0 and a note added. ALEA's older form DL-31 still says 30 hours. |
| CT Connecticut | 40/10 | 40/0 | The DMV teen training page lists 40 hours behind the wheel and no night hours. Night set to 0 and a note added. |
| MA Massachusetts | 40/1, with the note "night requirement is 30 minutes" | 40/0 | M.G.L. c.90 §8 has no night-hour requirement. The 30-minute figure looks like a mix-up with the 12:30 am curfew. Night set to 0 and the note corrected. The 30-hour reduction for a closed-course skills program is correct. |
| NC North Carolina | 60/10, with the note "additional 12 hrs (6 night) for Level 2→3" | 60/10 | The hours match. G.S. 20-11(f) no longer requires a Level 3 log, and form DL-214 (rev. 06-26) lists only a 6-month hold. The note was replaced with the 10-hours-a-week cap from 20-11(d)(5). |
| ND North Dakota | 50/10 | 50/0 for ages 14–15; none at 16–17 | N.D.C.C. 39-06 has no 10-hour night figure. Night driving is one of the listed conditions. The DOT applies the 50 hours to permit holders aged 14–15 only. Night set to 0 and a note added. The total stays 50 so younger permit holders still see a goal. |
| HI Hawaii | 50/10 | none found | **Not changed.** The 2023 driver manual's "Driving by Minors" section and Honolulu's GDL page list no practice-hour requirement, only a 180-day permit hold, driver ed and a 21+ supervisor. Hawaii is the one state where the app may be showing a goal the law does not set. Confirm with HDOT before changing it. |

## Caveats (values match, but read the note)

| State | Caveat |
|---|---|
| AR Arkansas | No hour requirement (the app shows 0). Third-party sites that claim 40 hours are wrong. |
| DC | The 40 hours are for the provisional license. A separate 10 night hours are certified later, for the full license; they are not part of the 40. |
| IA Iowa | 20/2 is for the intermediate license. A further 10 hours (2 night) are needed for the full license. A note was added. |
| IL Illinois | ilsos.gov and ilga.gov refused automated fetches (HTTP 403). The figures were confirmed from the page's search excerpt only. |
| IN Indiana | A daylight-only permit is exempt from the 10 night hours. The 50 total still applies. |
| KS Kansas | The old note described only the under-16 path (25 hours for a restricted license, 50 by 16). Teens aged 16–17 need 50 hours. The note was rewritten. |
| MT Montana | The 75/15 figure applies to an "alternative (non-traditional)" course under MCA 61-5-132. The old wording, "parent-taught online-only", was not in the statute. The note was reworded. |
| NV Nevada | The DMV teen page says 100 hours (10 night) without driver ed. The DMV log form says that applies only to rural applicants. The sources conflict, so the app keeps 50/10. |
| RI Rhode Island | The statute cite (RIGL 31-10-6) comes from the DMV page. The statute text itself was not read. |
| SC South Carolina | Hours with a driving school do not count toward the 40, according to the log form DL-008A. |
| SD South Dakota | 50/10/10 applies to permits issued after 2020-07-01. |
| WI Wisconsin | Each hour with an instructor counts as two, up to 5 actual hours (10 credited). Older DMV documents still say 30 hours. |

## All states

"App" is the value before the 2026-11-05 fixes.

| Code | State | App | Official | Match | Source | Notes |
|---|---|---|---|---|---|---|
| AL | Alabama | 50/10 | 50/0 | **No** | [link](https://www.alea.gov/dps/driver-license/license-and-id-cards/graduated-driver-license) | ALEA GDL page: 50 hrs behind-the-wheel (or SDE driver ed course instead); no night-hour requirement stated. Older ALEA form DL-31 still says 30 hrs. Stage I held 6 months. |
| AK | Alaska | 40/10 | 40/10 | Yes | [link](https://www.akleg.gov/basis/statutes.asp?media=print&secStart=28.15.055&secEnd=28.15.055) | AS 28.15.055: 40 hrs incl. 10 in challenging conditions (inclement weather, night). App note accurate (10 hrs night OR inclement). Permit held 6 months. |
| AZ | Arizona | 30/10 | 30/10 | Yes | [link](https://www.azleg.gov/ars/28/03174.htm) | ARS 28-3174: 30 hrs incl. 10 night, parent-certified. Alternate: 20 hrs incl. 6 night with certified driver ed course. |
| AR | Arkansas | 0/0 | 0/0 | Yes | [link](https://www.dps.arkansas.gov/wp-content/uploads/Arkansas-DL-Manual-English_June2024-06182024.pdf) | DPS manual and AR Code 27-16-604 state no hour requirement; permit/restricted license held 6 months for under-18 (3rd-party sites claiming 40 hrs are wrong). App note accurate. |
| CA | California | 50/10 | 50/10 | Yes | [link](https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/getting-an-instruction-permit-and-drivers-license/) | 50 hrs with licensed adult 25+, 10 after dark; permit held 6 months; plus driver ed and professional driver training (6 hrs per third-party sources). |
| CO | Colorado | 50/10 | 50/10 | Yes | [link](https://dmv.colorado.gov/permits-first-time-driver-license) | 50 hrs incl. 10 night; permit 12 months. Under 16.5 needs 6 hrs school training; if over 30 miles from a school, 12 extra hrs (62 total) instead. |
| CT | Connecticut | 40/10 | 40/0 | **No** | [link](https://portal.ct.gov/dmv/licenses-permits-ids/teen-drivers-license/driver-training-for-teens) | 40 hrs behind-the-wheel; no night-hour requirement stated. School path: 8+ hrs with trainer, permit 120 days; home training: 40 hrs, permit 180 days. 2-hr parent course. |
| DE | Delaware | 50/10 | 50/10 | Yes | [link](https://dmv.de.gov/DriverServices/drivers_license/index.shtml?dc=dr_lic_grad_dl) | Sponsor certifies 50 hrs incl. 10 night during first 6 months of Level 1 permit. No driver-ed reduction listed. |
| DC | District of Columbia | 40/10 | 40/10 | Yes | [link](https://dmv.dc.gov/sites/default/files/dc/sites/dmv/publication/attachments/form_40_hours.pdf) | Provisional license form: 40 hrs with tutor 21+; permit 6 months. Separate 10 night hrs certified later for full license with conditions (dmv.dc.gov/service/provisional-license), not part of 40. |
| FL | Florida | 50/10 | 50/10 | Yes | [link](https://www.flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/) | 50 hrs incl. 10 night (Fla. Stat. 322.05, form 71143). Learner license held 12 months or until age 18. No reduction listed. |
| GA | Georgia | 40/6 | 40/6 | Yes | [link](https://dds.georgia.gov/teen-drivers/teen-driving-laws-faqs) | Joshua's Law: 40 hrs supervised incl. 6 night, plus 30 hrs driver ed and 6 hrs behind-the-wheel (or parent-taught guide). Required for 16 and 17 year olds. |
| HI | Hawaii | 50/10 | none/none | **No** | [link](https://hidot.hawaii.gov/highways/files/2024/11/2023-Hawaii-Drivers-Manual_5.375x8.375_Final-r3-Digital-071924web.pdf) | Handbook "Driving by Minors" and honolulu.gov GDL page list no practice-hour requirement; only 180-day permit hold, driver ed, 21+ supervisor, parent 11pm-5am. App's 50/10 appears unsupported. |
| ID | Idaho | 50/10 | 50/10 | Yes | [link](https://legislature.idaho.gov/statutesrules/idstat/Title49/T49CH3/SECT49-307/) | Idaho Code 49-307(8)(b): 50 hrs, 10 in darkness, over at least 6 months; driver ed does not waive it. Applies to permittees under 17. |
| IL | Illinois | 50/10 | 50/10 | Yes | [link](https://www.ilsos.gov/departments/drivers/teen-driver-safety/gdl.html) | Confirmed via search excerpt of ilsos.gov GDL page and ilga.gov (direct fetch 403). 50 hrs incl. 10 night, supervisor 21+ licensed 1+ yr; 9-month permit hold; no driver ed reduction seen. |
| IN | Indiana | 50/10 | 50/10 | Yes | [link](https://www.in.gov/bmv/licenses-permits-ids/driver-education/index) | BMV: 50-hr drive log required even with driver ed. Daylight-only permit exempts the 10 night hrs (50 total still needed). No reduction. |
| IA | Iowa | 20/2 | 20/2 | Yes | [link](https://www.legis.iowa.gov/docs/code/321.180B.pdf) | Iowa Code 321.180B: 20 hrs, 2 after dark, for intermediate license after 12-month permit. Full license at 17 needs a further 10 hrs/2 night after 12 months intermediate; app omits. |
| KS | Kansas | 50/10 | 50/10 | Yes | [link](https://ksrevisor.gov/statutes/chapters/ch08/008_002_0101.html) | K.S.A. 8-2,101: under-16 restricted license needs 1-yr permit, driver ed, 25 hrs, then 50 total/10 night by 16. Age 16-17: 50/10, 1-yr permit. Note covers only under-16 path; 16-17 need 50 straight. |
| KY | Kentucky | 60/10 | 60/10 | Yes | [link](https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=55914) | KRS 186.452(1)(c) (eff. 2025-03-25): parent-attested 60 hrs incl. 10 night, supervisor 21+, plus 180-day permit hold. No reductions found. |
| LA | Louisiana | 50/15 | 50/15 | Yes | [link](https://legis.la.gov/Legis/Law.aspx?d=88384) | R.S. 32:405.1/407 and OMV GDL card: 50 hrs incl. 15 night, 180-day learner hold (ends early at 17). Driver ed does not reduce hours. |
| ME | Maine | 70/10 | 70/10 | Yes | [link](https://legislature.maine.gov/statutes/29-a/title29-Asec1304.html) | 29-A MRS 1304(1)(H), under 21: 70 hrs incl. 10 night, 6-month permit hold, supervisor 20+, parent certifies. No driver ed reduction; pending bills to change not enacted. |
| MD | Maryland | 60/10 | 60/10 | Yes | [link](https://mva.maryland.gov/your-mva-guide/teens-new-drivers/provisional-license) | MVA table: 60 hrs incl. 10 night for ages 16-24; 9-month hold under 18; 30 hr class + 6 hr BTW driver ed is separate. Only age 25+ gets 14/3. |
| MA | Massachusetts | 40/1 | 40/0 | **No** | [link](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section8) | No night-hour requirement found; app's "30 minutes" note wrong (12:30am curfew start likely confused). 30 hrs with closed-course skills program is correct. mass.gov JOL page blocked (403). |
| MI | Michigan | 50/10 | 50/10 | Yes | [link](https://www.michigan.gov/sos/license-id/new-drivers-under-18) | 50 hrs incl 10 night logged before Level 2 skills test; 30 hrs incl 2 night needed before Segment 2. No app note. |
| MN | Minnesota | 50/15 | 50/15 | Yes | [link](https://dps.mn.gov/divisions/ots/safe-driving-information-and-laws/driving-safety-tips/teen-driving/graduated-dl) | Parent awareness class (90 min, approved program) reduces to 40 hrs, night stays 15. Note accurate. |
| MS | Mississippi | 50/0 | 50/0 | Yes | [link](https://www.driverservicebureau.dps.ms.gov/sites/default/files/2025-02/1.15.2025%20Revised%20MDPS%20Driver's%20Manual.pdf) | Manual: parent/guardian affidavit of 50 hrs observed driving; no night hours required (10 night only a proposal in highway safety plan). Note accurate. |
| MO | Missouri | 40/10 | 40/10 | Yes | [link](https://dor.mo.gov/driver-license/issuance/graduated-driver-license/details.html) | 40 hrs incl 10 night (sunset-sunrise); 182-day permit hold. |
| MT | Montana | 50/10 | 50/10 | Yes | [link](https://leg.mt.gov/bills/mca/title_0610/chapter_0050/part_0010/section_0320/0610-0050-0010-0320.html) | MCA 61-5-132: 75/15 for alternative (non-traditional) course; app note says "parent-taught online-only", wording not verified in statute. |
| NE | Nebraska | 50/10 | 50/10 | Yes | [link](https://nebraskalegislature.gov/laws/statutes.php?statute=60-4%2C120.01) | POP 50 hrs incl 10 sunset-sunrise; alternatives: DMV-approved safety course or 6 months on LPD without 3+ points. |
| NV | Nevada | 50/10 | 50/10 | Yes | [link](https://dmv.nv.gov/driveeduteens.htm) | DMV teen page says 100 hrs/10 night if no driver ed; DMV log form says that applies only to rural applicants. Sources conflict; app has no note. |
| NH | New Hampshire | 40/10 | 40/10 | Yes | [link](https://gc.nh.gov/rsa/html/XXI/263/263-19.htm) | RSA 263:19: 40 hrs incl 10 night (half hour after sunset to half hour before sunrise); supervisor licensed parent or adult over 25. |
| NJ | New Jersey | 50/10 | 50/10 | Yes | [link](https://www.nj.gov/mvc/press/archives/2025/01312025.htm) | Applies to under-21 permits issued on/after Feb 1, 2025; Form BA-CSD certification. Note accurate. |
| NM | New Mexico | 50/10 | 50/10 | Yes | [link](https://www.mvd.newmexico.gov/nm-drivers-licenses-ids/drivers-license/apply-for-a-learners-permit/) | MVD page: 50 hrs incl. 10 night, parent certifies; no driver-ed reduction listed. Statute NMSA 66-5-8. |
| NY | New York | 50/15 | 50/15 | Yes | [link](https://dmv.ny.gov/forms/mv262.pdf) | MV-262: 50 hrs supervised incl. 15 after sunset; driver-ed hours count toward the 50. Manual only recommends 10 hrs heavy traffic. App has no note. |
| NC | North Carolina | 60/10 | 60/10 | Yes | [link](https://ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_20/GS_20-11.html) | G.S. 20-11(d)(5): 60-hr log, 10 night, max 10 hrs/week counted. NOTE WRONG: current (f) Level 3 has no 12 hr/6 night log; DL-214 (rev 06-26) lists only 6-month hold. |
| ND | North Dakota | 50/10 | 50/? | **No** | [link](https://ndlegis.gov/cencode/t39c06.pdf) | Century Code 39-06: 50 hrs only for restricted Class D minors (night driving among conditions, no 10-hr figure). DOT page applies 50 hrs to ages 14-15 only; none for 16-17. |
| OH | Ohio | 50/10 | 50/10 | Yes | [link](https://www.bmv.ohio.gov/dl-gdl.aspx) | Under 18: 50 hrs with at least 10 night, in addition to driver ed; 6-month permit hold. Night = 30 min after sunset to 30 min before sunrise. |
| OK | Oklahoma | 50/10 | 50/10 | Yes | [link](https://oklahoma.gov/service/all-pages/learner-permit.html) | Parent verifies 50 hrs incl. 10 night via Affidavit of Driver Training; supervisor 21+, licensed 2+ yrs. No driver-ed reduction listed. |
| OR | Oregon | 50/0 | 50/0 | Yes | [link](https://www.oregon.gov/odot/dmv/teen/pages/license.aspx) | 50 hrs with ODOT driver ed, 100 without (ORS 807.065); no night hour requirement. Supervisor 21+, licensed 3+ yrs. Note accurate. |
| PA | Pennsylvania | 65/10/5 | 65/10/5 | Yes | [link](https://www.pa.gov/content/dam/copapwp-pagov/en/dmv/documents/driver-services/driver-licensing/chapter_1.pdf) | Under 18: 65 hrs incl. 10 night, 5 bad weather; DL-180C certification. Motorcycle permit exempt from night/weather hrs. Note accurate. |
| RI | Rhode Island | 50/10 | 50/10 | Yes | [link](https://dmv.ri.gov/licenses-permits-ids/permits-tests/new-license-permits) | Under 18: 50 hrs, 10 night, notarized affidavit before road test; statute RIGL 31-10-6(b)(2)(iii) per DMV. 6-month permit wait. |
| SC | South Carolina | 40/10 | 40/10 | Yes | [link](https://dmv.sc.gov/driver-services/drivers-license/teenage-drivers) | 40 hrs incl. 10 night, parent/qualified adult signs log (DL-008A); 180-day permit hold. Driving school hours cannot count per log form. |
| SD | South Dakota | 50/10/10 | 50/10/10 | Yes | [link](https://sdlegislature.gov/api/Statutes/32-12-11.html?all=true) | SDCL 32-12-11: 50 hrs, 10 night, 10 inclement; applies to permits issued after 7/1/2020. App note accurate. |
| TN | Tennessee | 50/10 | 50/10 | Yes | [link](https://www.tn.gov/safety/driver-services/classd/teengdl.html) | 50-hour certification by parent/guardian/instructor for intermediate license; no reductions listed. |
| TX | Texas | 30/10 | 30/10 | Yes | [link](https://www.dps.texas.gov/section/driver-license/texas-provisional-license-teen) | DPS provisional page: 30 hrs behind-the-wheel, at least 10 at night, supervisor 21+. Learner page itself omits hours. |
| UT | Utah | 40/10 | 40/10 | Yes | [link](https://dld.utah.gov/learner-permit/) | 40 hrs, 10 after sunset, ages 15-17; no reductions (only 19+ driver-ed waiver). |
| VT | Vermont | 40/10 | 40/10 | Yes | [link](https://dmv.vermont.gov/licenses/types-of-licenses-ids/junior-drivers-license) | 40 hrs practice, 10 night, in addition to 6 hrs driver-ed behind-the-wheel; permit held 1 year (23 VSA 607). |
| VA | Virginia | 45/15 | 45/15 | Yes | [link](https://law.lis.virginia.gov/vacodeupdates/title46.2/section46.2-335/) | Under 18: 45 hrs, 15 after sunset, parent-certified; 9-month permit hold (46.2-335.2). |
| WA | Washington | 50/10 | 50/10 | Yes | [link](https://app.leg.wa.gov/rcw/default.aspx?cite=46.20.075) | RCW 46.20.075: 50 hrs incl 10 night; supervisor 21+ licensed 3+ years. DOL splits 40 day/10 night. |
| WV | West Virginia | 50/10 | 50/10 | Yes | [link](https://dmv.wv.gov/graduated-drivers-licensing-gdl) | Level 2 needs 50-hr form incl 10 night, or Driver Education Card alternative (hours credit not stated on page). |
| WI | Wisconsin | 50/10 | 50/10 | Yes | [link](https://docs.legis.wisconsin.gov/statutes/statutes/343/ii/06) | s.343.06(1)(cm): 50 hrs, 10 darkness; instructor hours count double, max 5 actual hrs (10 credited). Older DMV docs say 30. |
| WY | Wyoming | 50/10 | 50/10 | Yes | [link](https://www.dot.state.wy.us/home/driver_license_records/driver-license/learner-permits.html) | WYDOT: 50 actual hrs incl 10 night for intermediate permit; no reductions listed (W.S. 31-7-110). |
