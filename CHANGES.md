# Em~power — Change Log

Changes made autonomously from user feedback. Most recent first.

---

## 2026-06-11 — Workout science pass: HIIT intensity, women-specific reps/load, menopause content

**Found via:** user review — HIIT felt too easy; questioned whether gym reps were too high; asked to validate loading against women-specific science and update the whole workout tab for menopause, cross-referenced to peer-reviewed sources.

**What was done:**
- *HIIT was under-prescribed.* HIIT intensity is defined by effort, not the clock, and the prescriptions were short-rest moderate circuits that cap peak intensity — which is why a fit person finds them easy. Added a prominent "how hard" note (work bouts must be near-maximal, 9–10/10; women are more fatigue-resistant so must push genuinely hard) and increased difficulty for the high-capacity phases. Sources: Sims ROAR 2024; sex differences in HIIT, Frontiers in Physiology 2020; Hunter SK, Acta Physiologica 2014.
- *Reps/load — validated with a women-specific rationale.* The rep ranges are defensible; added a note explaining women are more fatigue-resistant and recover similarly between sets (so volume is well-tolerated), that reps only count when the last few are genuinely hard, and that very active users should use Advanced for heavier 5-rep strength work. Sources: Hunter 2014; Roberts et al. JSCR 2020; Schoenfeld et al. JSCR 2017.
- *Menopause: content was unreachable and is now wired in and upgraded.* The workout phase lookup used the stage subPhase ("Early perimenopause" etc.) but the dictionaries are keyed "Perimenopause", so menopause users silently got generic content. Fixed the resolution (perimenopause/postmenopause -> Perimenopause content; hormonal-BC -> observation). Upgraded the perimenopause phase banner, weight note, and reps/load note to a heavy-load/bone priority based on the LIFTMOR RCT (5x5 at >85% 1RM improved bone density safely in postmenopausal women). Sources: Watson et al. LIFTMOR, JBMR 2018; Kohrt et al. MSSE 2004.

**Files changed:** empower-react/src/pages/Workout.jsx

---

## 2026-06-11 — Postmenopause track + fixed the path-4 stage never registering

**Found via:** adding a short postmenopause track to the menopause content.

**What was done:** Added a postmenopause-specific Learn article ("After menopause: the long view") covering how postmenopause differs from perimenopause (estrogen now low and steady, not fluctuating) and where to focus — bone in the first years, cardiovascular risk, persistent GSM symptoms, and HRT timing. Sourced (Harlow STRAW+10 2012, Kohrt 2004, Carr 2003, Manson 2013, NAMS). While wiring it in, found and fixed a latent bug: Setup saves the perimenopause stage as its display string ("Menopause 12+ months" etc.), but buildPath4Status compared against "menopause"/"peri-late", which never matched — so every path-4 user was labelled "Early perimenopause" regardless of their selection, and postmenopausal users were never detected. The mapping now reads the actual saved strings. Existing users with no stage set still default to Early perimenopause, so nothing changed for them. Verified the build and that every Learn menu item has matching content.

**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Learn.jsx

---

## 2026-06-11 — Menopause content: added vaginal/sexual health article, tightened three claims

**Found via:** review of menopause coverage and science quality.

**What was done:** Filled the biggest gap in the menopause content — a new Learn article, "Vaginal and sexual health," covering genitourinary syndrome of menopause (dryness, painful sex, urinary changes), its treatments (moisturisers/lubricants, low-dose local vaginal estrogen, pelvic floor physio, DHEA/ospemifene), and libido/testosterone — all sourced (Portman & Gass 2014; NAMS GSM Position Statement 2020; Davis et al. Global Consensus on Testosterone Therapy for Women 2019). Also tightened three claims that were stronger than the evidence cleanly supports: perimenopausal depression risk softened from "two to five times" to "two to four times" and from "responds better than antidepressants" to "can respond well… sometimes when antidepressants alone have not been enough"; and the HRT benefits line now leads with the best-established benefits (symptoms, bone), frames cardiovascular as lower risk than feared rather than a treatment benefit, and notes cognition is still being researched.

**Files changed:** empower-react/src/pages/Learn.jsx

---

## 2026-06-11 — Merged check-in: night-sweats selector broke Save for perimenopause users

**Found via:** QA pass on the new merged check-in/log screen.

**What was done:** On the merged screen, the path-4 (perimenopause) "Night sweats" selector stored a text value (None/Mild/Moderate/Severe), but `daily_logs.night_sweats_severity` is an integer column — so when a perimenopause user picked a night-sweats level, the upsert was rejected by Postgres and Save silently failed (they were stuck on the screen). Changed the selector to integer values (0–3), matching the joint-pain and brain-fog selectors right next to it. Other users were unaffected. Quick fields, the "Add more detail" expander, and Save are otherwise working.

**Files changed:** empower-react/src/pages/Log.jsx

---

## 2026-06-10 — Feedback fix: post-workout "eat 85g protein in 45 minutes" was wrong

**User said:** "At the end of my workout it said eat 85g of protein within 45 minutes if you can it's 8:02pm and 85g of protein seems like a lot in that period of time can you fact check this"

**What was done:** The user was right. The workout complete and cooldown screens showed the user's full *daily* protein target (e.g. 85g) with the instruction to eat it "within 45 minutes" — conflating a whole day's protein with a single post-workout serving, and attaching the discredited 45-minute "anabolic window". Both screens now say to spread the daily total across meals, recommend a realistic 20 to 40g serving within a couple of hours of training, and state that total daily protein matters more than exact timing. Citation updated to Aragon and Schoenfeld 2013 (nutrient-timing window) and the ISSN nutrient-timing position stand.

**Files changed:** empower-react/src/pages/Workout.jsx

---

## 2026-06-10 — App-wide bug sweep (Workout, Checkin, Log, hormoneSync)

**Found via:** requested "check for bugs everywhere" — audited every page, lib, and component not already reviewed this session.

**What was fixed:**
1. *Workout weight guide misattributed cycle physiology.* `getPhaseWeightNote` chose its wording purely from the intensity-modifier value, so birth-control (0.85), perimenopause (0.82), and observation/Depo (0.72) users were told they had "elevated RHR" or "progesterone-cortisol competition" — luteal-phase physiology they don't have. It now uses neutral, train-to-feel wording for any non-cycle phase and keeps the cycle-specific notes only for real cycle phases.
2. *Check-in success screen "Tap anywhere to go to dashboard" did nothing.* The tap handler was on the form (only shown before saving), not on the success view. Moved the navigate handler onto the success view and removed the dead one.
3. *Daily log could spin forever on a load error.* `init()` had no error handling, so a failed network call left the spinner stuck. Wrapped it in try/finally so loading always clears.
4. *Removed a stray console error for users with no cycle data.* `getTodayStatus` read `cycle_data` with `.single()`, which errors on zero rows; switched to `.maybeSingle()` (same data, no error noise).

**Also reviewed and confirmed clean / not bugs:** Calendar correctly shows no cycle colouring for hormonal-BC users (getTodayStatus returns no cycle day for them); the Check-in vs Log "Good/Normal" and "Great/Excellent" wording difference is intentional and handled by the scoring tables; Feedback, BottomNav, TopBar, Sleep, and the algorithm_v3 lookup tables handle all phase values without crashing. Two minor follow-ups noted (not yet done): the Learn "Your path" card shows natural-cycle content to birth-control users, and the Sleep banner can show a raw `bc-combined` label.

**Files changed:** empower-react/src/pages/Workout.jsx, empower-react/src/pages/Checkin.jsx, empower-react/src/pages/Log.jsx, empower-react/src/lib/hormoneSync.js

---

## 2026-06-10 — Nutrition panel: perimenopause users got the wrong food guidance + stale protein after weight edit

**Found via:** requested check of the Nutrition panel for bugs.

**What was done:** Two bugs.
1. *Perimenopause users saw generic "observation" nutrition instead of perimenopause guidance.* The screen set its phase from `status.subPhase`, which for path-4 users is "Early perimenopause" / "Late perimenopause" / "Postmenopause". The `phaseKey` lookup only collapsed luteal subphases, so those values didn't match the `Perimenopause` key and fell back to `observation` — meaning the dedicated calcium/bone-protective foods, science text, avoid list, perimenopause diet arrays, and gradient never showed. `phaseKey` now maps all perimenopause stages to `Perimenopause` (and the gradient falls back through `phaseKey`). The top bar still shows the specific stage label.
2. *Protein target didn't update after editing body weight.* The Update sheet writes the new weight to the database but `targets` (and therefore the displayed protein number) was never recomputed, so it stayed stale until a full reload. `saveStats()` now re-runs `init()`, which recomputes the targets from the new weight (and re-applies the vegan multiplier on diet change).

**Files changed:** empower-react/src/pages/Nutrition.jsx

---

## 2026-06-10 — Dashboard showed a natural cycle phase for hormonal birth control users (proactive fix)

**Found via:** audit follow-up to the phase-mismatch feedback fix (same bug class, different cohort). No user reported it directly, but it affected a live user (a combined-pill user was being shown "Ovulatory phase" — a false fertile-window signal).

**What was done:** The dashboard computed the phase itself from a last-period date and only special-cased perimenopause (path 4). For hormonal birth control users (path 5, e.g. the pill/IUD), who often still have a last-period date saved, it wrongly computed a natural cycle phase — while Workout and Nutrition (which use `getTodayStatus`) correctly showed the contraception state. The pill suppresses ovulation, so "Ovulatory phase" was both inconsistent and clinically wrong. The dashboard now reads its phase for these users from `getTodayStatus` (the single source the other screens use) and shows a dedicated "on hormonal birth control" state instead of a cycle phase. The non-hormonal copper IUD is excluded and still tracks a natural cycle.

**Files changed:** empower-react/src/pages/Dashboard.jsx

---

## 2026-06-10 — Privacy gate repeating, weekly insight repeating, phase mismatch across screens

**User said:** "i keep seeing the privacy thing everytime i log in and my weekly insight came up today but i got one yesterday also it says im in my lutel phase in workout and nuterion but im in oberveration mood on the home screen and still it somehow has % on my data something seem wrong"

**What was done:** Three separate bugs.
1. *Privacy gate every login:* the consent state lived only in `localStorage`, which the user's browser was clearing between sessions. AuthGuard now treats anyone who completed onboarding (which already requires agreeing to the privacy policy in Setup) as consented, so it never re-prompts an existing user.
2. *Phase mismatch (home said "observation", Workout/Nutrition said "Luteal"):* the dashboard computes its phase from cycle data (correctly showing observation for a no-cycle-data Depo user), but `getTodayStatus` was promoting a guessed symptom-inferred phase to the headline with a confidence %. Removed that promotion — with no cycle data the app now stays in observation mode everywhere and keeps the inference only as a soft supporting signal. This also removes the misleading % on observation data.
3. *Weekly insight popping up repeatedly:* it auto-opened as a full-screen modal and deduped via `localStorage` (also being cleared), so it re-popped daily. It's now a non-intrusive card shown when there are 3+ logs in the current week; tapping it opens the full modal.

**Files changed:** empower-react/src/App.jsx, empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Dashboard.jsx

---

## 2026-06-08 — Fix mood showing as [object Object] on dashboard

**User said:** "It says mood [object,object] I'm not sure what that means"
**What was done:** `status.moodInsight` is an object with a `.message` property — the dashboard was rendering the whole object as a string which JavaScript coerced to `[object Object]`. Fixed to use `status.moodInsight.message` instead.
**Files changed:** dashboard.html, www/dashboard.html

---

## 2026-06-07 — Citation audit fixes

**What was found:** Four misattributed citations across three files.
**What was done:**
1. hormoneSync.js — Ovulatory phase source removed the Larivière et al. 2006 reference (that paper is about luteal amino acid utilisation, not zinc or the LH surge). Replaced with an accurate ISSN 2023 statement.
2. dashboard.html — Ovulatory nutrition card source removed the same misplaced Larivière 2006 reference. Replaced with ISSN 2023 and Liu RH Am J Clin Nutr 2003 (the correct source for phytonutrients in whole foods).
3. dashboard.html — Luteal progesterone reference ranges removed Hackney 2006 (which is about cortisol/progesterone receptor competition, not lab reference ranges). Ranges now cite Munster et al. 2021 only, which is the correct lab reference source.
4. learn.html — PCOS paragraph split so the birth control-suppresses-symptoms claim now cites Teede HJ et al. Human Reproduction 2018 (the correct PCOS guideline source), while the resistance training/insulin claim continues to cite Woodward 2019 and Fica 2008.

**Files changed:** hormoneSync.js, dashboard.html, learn.html, www/ copies of all three.

---

## 2026-06-08 — Algorithm: Path 5 split by BC method
**What was done:** The algorithm now treats women on different types of birth control differently rather than lumping all into generic observation mode. Combined pill, patch, and ring users (synthetic estrogen present) get phase 'bc-combined' with intensity modifier 0.90 and consistent-training messaging — they are not in a low-estrogen state and should not be told to reduce intensity. Progestin-only users (mini pill, implant, Depo, hormonal IUD) get phase 'bc-progestin' with intensity 0.85 and calcium/vitamin D emphasis since estrogen is lower. Copper IUD users fall through to natural cycle tracking since that method has no hormones. getMoodContextFeedback now handles both BC phases with method-appropriate messaging about mood, citing Skovlund et al. JAMA Psychiatry 2016. Both phases have their own PHASE_PREDICTIONS entries and nutrition targets in the algorithm.
**Files changed:** algorithm_v3.js, hormoneSync.js, www/algorithm_v3.js, www/hormoneSync.js

---

## 2026-06-08 — Feedback fix: birth control users excluded from onboarding
**User said:** "you can only use the app if you aren't on birth control but there used to be options when you first create your account for birth control users"
**What was done:** Added a fifth onboarding path "I am currently on birth control" with a BC type selector (same 9 options as the post-BC path), an explanation of what the app tracks while natural cycle is suppressed, and a copper IUD note clarifying it is non-hormonal. Path 5 users go into observation mode in hormoneSync.js, tracking energy, mood, sleep, and workouts to build a personal baseline. If they stop birth control later, their data is already there.
**Files changed:** setup.html, hormoneSync.js, www/setup.html, www/hormoneSync.js

---

## 2026-06-08 — Feedback fix
**User said:** "There should be a place I can put period started"
**What was done:** Added a quiet "Period started today?" link at the top-right of the daily log card. Tapping it updates cycle_data with today as the period start date, immediately reveals the flow volume and pain fields, and updates the phase display to Menstrual Day 1. Hidden for Path 4 (perimenopause) users. Feedback marked resolved in Supabase.
**Files changed:** log.html, www/log.html

---

## 2026-06-08 — Path 4 full experience
**What was done:** Full perimenopause/menopause (Path 4) experience built out across all screens. Root fix in hormoneSync.js: Path 4 users now get phase "Perimenopause" from the start — no cycle calculations run regardless of database state. Perimenopause added to nutrition targets (1.8g/kg), intensity modifier (0.82), anomaly detection (fatigue and sleep patterns), PHASE_PREDICTIONS, and getMoodContextFeedback in algorithm_v3.js. Dashboard guards added for PCOS flag and endo flag (both incorrectly fired for Path 4 before). Science notes in checkin.html and log.html now adapt for Path 4 — cervical fluid framing changes from "fertile window" to estrogen signals. New Perimenopause phase card added to dashboard "Your hormonal phases" section.
**Files changed:** hormoneSync.js, algorithm_v3.js, dashboard.html, checkin.html, log.html, www/ mirrors

---

## 2026-06-08 — Algorithm pipeline wiring + bug fix

**What was done:** Wired all 8 previously unsaved fields (wrist_temp, flow_volume, disruptors, pain_rating, brain_fog_rating, hot_flash_count, night_sweats_severity, joint_pain_rating) into the algorithm. These were saving to the database but not being read by hormoneSync.js or algorithm_v3.js. Now: wrist temperature boosts confidence and phase inference; flow volume confirms menstrual phase; disruptors reduce signal reliability and trigger luteal allostatic load warning; pain_rating ≥4 during menstrual triggers endometriosis-awareness card; Path 4 fields (hot_flash_count, night_sweats_severity, joint_pain_rating, brain_fog_rating) now drive perimenopause-specific anomaly cards. Confirmed all 27 daily_logs columns accept upsert successfully via test insert. Fixed em-dash in log.html visible text ("Hormone test results (optional)").
**Files changed:** hormoneSync.js, log.html, www/log.html, www/hormoneSync.js, ios/App/App/public/hormoneSync.js, ios/App/App/public/log.html
