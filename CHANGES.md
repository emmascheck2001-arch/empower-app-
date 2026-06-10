# Em~power — Change Log

Changes made autonomously from user feedback. Most recent first.

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
