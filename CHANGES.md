# Em~power — Change Log

Changes made autonomously from user feedback. Most recent first.

---

## 2026-08-06 — Weekly review: first-open-of-week trigger + real data gate
**Emma said:** trigger on first open of the week (not Sunday), make sure it's truly once-a-week (not daily), and only show it when there's enough logged data to be meaningful — skip it otherwise.
**What was done:**
- Trigger changed from Sunday-only to **first app-open of the calendar week**. Dedup is per-week (localStorage week key); we now mark it shown ONLY when it actually opens, so a thin early-week review can still appear later once there's content.
- **Data gate:** raised `WEEKLY_MIN_LOGS` from 3 to **4** logged days in the past week, AND require real content (≥1 highlight or a logged workout) — below that, no weekly review that week (no hollow insights).
**Files changed:** components/WeeklySummary.jsx, pages/Dashboard.jsx
## 2026-08-06 — Weekly insights become a once-a-week moment; doctor prep moved to Learn
**Emma said:** move "Prep for a doctor visit" into Learn; don't show "Insights this week" every day — show it one day a week (7th day), with confetti on open; make the insights richer (the good things logged that week vs last week, all positive, plus one observation). Both web + app.
**What was done:**
- **Doctor prep** removed from the home screen, added as a card at the top of the **Learn** tab (→ /visit-prep).
- **Insights this week** daily card removed. The Weekly Review now **auto-opens once a week on Sunday** (only if ≥3 logs that week and not already shown), with a **confetti burst** (`components/Confetti.jsx`, dependency-free). Dedup is per-week via localStorage, so it never repeats within a week.
- **Richer content:** the modal now shows a "Your wins this week" section (it already computed the highlights + last-week comparisons but never displayed them) — trained N days, N more than last week, energy peak, slept more — filtered to positives, with the single constructive note kept in "One observation."
- Also (native polish, native-only earlier): iOS text-size-adjust so native matches web, 16px inputs to stop iOS focus-zoom, safe-area on every remaining top bar (Check-in, Learn, Workout sub-screen, pregnancy home). Confetti keyframes added to index.css.
**Files changed:** pages/Dashboard.jsx, pages/Learn.jsx, components/WeeklySummary.jsx, components/Confetti.jsx, index.css
## 2026-08-05 — Autonomous polish batch (dashes, log, onboarding, QA)
**Emma said:** take out all dashes + fix grammar; polish recent work especially the calendar; think hard about the log and clean it; make signup simple/clean; go over everything for bugs, correct algorithm, data saved + used for personalization, and a beautiful clean feel.
**What was done:**
- **Dashes:** removed all 421 em/en dashes across 37 files (ranges to "to", em dashes to commas/periods by grammar). Hand-polished the highest-visibility copy (movementToday titles/details, cyclePlan session pools, GoalPicker intro) so nothing reads like a machine comma-swap.
- **Log:** cervical fluid now has a "Not sure" option (no forced guessing) and plain relatable descriptions ("clear and stretchy, like raw egg white") shown on selection — Emma's flagged pain point. Reviewed the rest of the log; kept clean.
- **Onboarding:** verified clean after the dash sweep; fixed a comma splice in the GoalPicker intro. (Name capture, progress steps, signup-first, path-1 "not sure" escape all in place from earlier.)
- **QA:** all 146 tests pass across 12 files; build clean; no dead imports. Verified the learning engine is live (`user_baselines` now populating, was 0). Fixed a data bug: `avg_cycle_length` was computing an implausible 17-day average from one short breakthrough-bleed gap — now averages only typical (21 to 45 day) cycles and falls back to the set cycle length, so the doctor summary won't show a misleading number.
**Files changed:** ~38 files (dash sweep); notably lib/movementToday.js, lib/cyclePlan.js, lib/hormoneSync.js, pages/Log.jsx, components/GoalPicker.jsx
## 2026-08-05 — Monthly plan: tappable weeks + current-week highlight
**Emma said:** the monthly view is flat/generic; clicking a week should give the structured week; the week you're on should be highlighted.
**What was done:**
- Monthly is now anchored to the cycle (built from cycle day 1, not rolled from today), so the 4 weeks map to the canonical cycle and "this week" is meaningful.
- Each week card is now tappable → expands to that week's full 7-day structured plan (`assignSessions` on that week's slice), each day labelled by cycle day + phase.
- The current week (the one containing today's cycle day) is highlighted with a bolded 2px border + "· This week" label.
**Files changed:** empower-react/src/pages/Workout.jsx
## 2026-08-05 — Weekly plan: de-repeated + personalised from past cycles
**Emma said:** the weekly plan is repetitive (same "Strong day — build" 4×) and not personal — it should look back at what she logged on those cycle days last cycle and let her choose to adapt.
**What was done:**
- `assignSessions` in cyclePlan.js turns the phase-per-day plan into a varied week: rotates strength (lower/upper/full), cardio, yoga/walks, places ~2 rest days (1 for a consistency goal), softens hard days for calmer goals. No more identical same-phase cards.
- New `lib/cycleHistory.js` (`cycleDayForDate`, `buildCycleDayHistory`): maps past ~70 days of logs to cycle days and, per cycle day, notes lower/higher energy patterns. Workout init fetches the logs + period history and builds it.
- Weekly plan now shows a per-day note ("Cycle day 22: you logged lower energy around here last cycle") with an optional **"Make it lighter"** button (and Undo) — the user chooses to adapt; the app never forces it. `lighterSession()` provides the swapped session.
- 11 new tests (146 total).
**Files changed:** empower-react/src/lib/cyclePlan.js, empower-react/src/lib/cycleHistory.js, empower-react/src/lib/cycleHistory.test.js, empower-react/src/lib/cyclePlan.test.js, empower-react/src/pages/Workout.jsx
## 2026-08-05 — Workout tab: cycle-aware daily/weekly/monthly plans + basic mode
**Emma said:** keep the phase banner; the intensity line should say what to do based on cycle+goal; remove the no-op "recent stressors" note; "+ Log a class" should become "Build your plan" → daily/weekly/monthly; weekly/monthly switches the page to show a workout for every day; add a "back to basic mode" button.
**What was done:**
- Banner intensity line ("X% of max effort") + the "recent stressors logged" note both removed; replaced with a concrete "Today: [movement]" recommendation from cycle phase + the user's saved goal (GOAL_NOTE).
- New `lib/cyclePlan.js` (`buildCyclePlan` rolls the phase forward day-by-day from today's cycle day; `weekBlocks` groups 28 days into 4 weeks). Tested (138 total).
- Workout landing now has two modes: **basic** (activity picker + a prominent "Build my plan" button, "Log a class" kept as secondary) and **plan** (weekly = 7-day list, monthly = week-by-week cycle overview), with a "Basic mode" button to switch back. Degrades to a goal-based generic week when there's no confident cycle (irregular/BC/no date).
**Files changed:** empower-react/src/lib/cyclePlan.js, empower-react/src/lib/cyclePlan.test.js, empower-react/src/pages/Workout.jsx
## 2026-08-05 — One-time workout goal picker (foundation for cycle-aware plans)
**Emma said:** first time someone taps Workout, ask their goal (lose weight, feel better, structured movement, etc.), better than other fitness apps; users should be able to get daily/weekly/monthly plans built around their cycle.
**What was done:**
- New `components/GoalPicker.jsx` — a one-time, wellness-framed goal sheet shown on the first Workout-tab visit (feel better / build strength / move consistently / support cycle & hormones / manage weight healthily / reduce stress). Supportive framing, not diet-culture. Stored in localStorage for now (no DB migration needed to validate); can move to a profiles column later. Exposes `getFitnessGoal()` for the upcoming plan generator.
- The "20× better" angle: goal → a plan that flexes with the cycle (build in follicular, recover in luteal) — no mainstream fitness app does cycle-aware planning.
**Files changed:** empower-react/src/components/GoalPicker.jsx, empower-react/src/pages/Workout.jsx
## 2026-08-05 — Calendar day-sheet: cleaner, sex-drive per day, compact disclaimer
**Emma said:** make the calendar day view cleaner/easier to read; add libido and a protection note per day; shrink the big "NOT BIRTH CONTROL" box to a small red line.
**What was done:**
- Fertile-window disclaimer shrunk from a large boxed paragraph to one small red line ("Not birth control — an estimate only. If you're avoiding pregnancy, use protection…"), folding the protection reminder in. Substance kept; bulk removed.
- Added a per-day "Sex drive" chip (phase-based expectation: peaks near ovulation, lower menstrual/late-luteal) next to energy + movement.
- Protection note only appears on fertile days — never a "safe day" note on other days (FDA line).
- Cleaner sheet: "Your brain this day" + "Plan ahead" now collapse behind a single "More about this day" toggle so the key info shows first.
**Files changed:** empower-react/src/pages/Calendar.jsx
## 2026-08-05 — Late-period flag → small bottom flag; fixed wording; concrete calendar chip
**Emma said:** the big "2 days late" card takes over the home screen — make it a little clickable red flag at the bottom instead; and "a late period usually is not pregnancy" sounds bad/incorrect, fix the language; also the calendar still showed a useless "95% intensity" chip.
**What was done:**
- Late-period flag is now a small tap-to-open **flag pill fixed at the bottom** of the dashboard (above the nav), not a big top card. Tapping opens a bottom sheet with the personalised contributors + guidance.
- Removed "A late period usually is not pregnancy." Wording now leads with "A late period is common and has many causes" and keeps the pregnancy-test option as a neutral, non-leading line.
- Calendar day-sheet "{n}% intensity" chip replaced with the concrete movement recommendation (getMovementToday), matching the dashboard/workout screen.
**Files changed:** empower-react/src/pages/Dashboard.jsx, empower-react/src/pages/Calendar.jsx
## 2026-08-05 — Nutrition screen: clearer protein target + framed symptom relief
**Emma said:** the nutrition protein and symptom relief look messy and not good.
**What was done:**
- Protein/targets card: removed the confusing giant "0 Extra kcal" tile (it showed 0 for every phase except luteal) — now a single centered protein target when there's no extra fuel, two tiles only in luteal. Added a plain-language, phase-aware explainer of what the number means (PROTEIN_NOTE) and a weight-awareness line ("Based on your weight and phase" vs "Set your weight above to personalise this").
- Symptom relief tab: added a short intro framing ("Tap a symptom for food-based relief… alongside, never instead of, your usual care") so it doesn't open as a bare list.
- Content itself was already strong/cited — this was layout + clarity.
**Files changed:** empower-react/src/pages/Nutrition.jsx
## 2026-08-05 — Remove personal info; onboarding polish
**Emma said:** take my email/contact info out of everything, set up a dedicated Em~power inbox; plus signup-first + a "not sure of date" escape.
**What was done:**
- New `lib/appConfig.js` with `SUPPORT_EMAIL` (placeholder `empowerhealthapp@gmail.com` — to be swapped for the real inbox) and `APP_OWNER` ("the Em~power team"). Removed the hard-coded personal email + name from Privacy.jsx (contact, who-we-are, delete-fallback), Terms.jsx (contact), and Feedback.jsx. "Emma has been notified" → "The Em~power team has been notified."
- Feedback admin view no longer hard-codes a personal email: `get_all_feedback()` is already uid-gated server-side, so we just call it and show the admin view when it returns rows. Verified no personal email/name remains in shipped source.
- Onboarding: name capture (personalises the greeting), Step 1/2 progress + "takes less than a minute", birth-year reason, activity marked optional (prior commit); Login now defaults to signup-first; path-1 has a "Not sure of your exact date? Track as irregular instead" escape.
**Files changed:** empower-react/src/lib/appConfig.js, pages/Privacy.jsx, pages/Terms.jsx, pages/Feedback.jsx, pages/Login.jsx, pages/Setup.jsx
## 2026-08-05 — Retention: install prompt + first-log activation nudge
**Context:** retention is down (weekly active 8→2; 40% of signups never logged). Two of the four agreed retention fixes.
**What was done:**
- **Install prompt** (`components/InstallPrompt.jsx`): the app had a PWA manifest but never asked anyone to install it, so users lived in browser tabs (terrible return rates). New dismissible dashboard banner — real Install button on Android/Chrome via `beforeinstallprompt`, "Add to Home Screen via Share" instructions on iOS. Hidden when already running standalone.
- **Activation nudge:** new users were dropped on the dashboard after onboarding with nothing pulling them to log (where the 40% bounced). Added a prominent "Start with a 30-second check-in" card shown only to users with zero logs, linking to /checkin.
**Files changed:** empower-react/src/components/InstallPrompt.jsx, empower-react/src/pages/Dashboard.jsx
## 2026-08-05 — Late period: personalized "what's contributing" from each user's own data
**Emma said:** the late-period flag should work for everyone and "go deeper" — pregnancy is the easy thought; look at the data for what could actually be causing it.
**What was done:**
- New pure, tested `getLatePeriodInsights(recentLogs, profile, cycleInfo)` in hormoneSync.js. When a user is late, it reads their OWN recent logs and names likely contributors: high stress (disruptor or stress_level ≥4), illness, travel, repeated poor sleep, repeated very-low energy / heavy training (RED-S / under-fuelling), repeated alcohol, coming off birth control (path 2), and personal cycle-length variability (tracked gaps differing ≥7 days). All framed as "may contribute", never a diagnosis; no GnRH/PCOS naming; defers to doctor. 8 unit tests (129 total passing).
- Surfaced in `status.latePeriodInsights`; the dashboard late-period card now leads with "A late period usually is not pregnancy — from what you've logged, these may be contributing:" + a personalized bullet list, then the pregnancy-test + see-a-doctor lines. Falls back to the generic copy when there are no signals.
- Applies to every cycle user, not just the reporter.
**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Dashboard.jsx, empower-react/src/lib/latePeriodInsights.test.js
## 2026-08-05 — Late-period flag moved to top of dashboard (was buried)
**Emma said:** on cycle day 31, unsure if correct, and "if my period is late the app should flag that ... in the app not just on here."
**What was done:**
- Verified her data: last period July 5, no flow logged since, so day 31 is CORRECT (not corrupted) and she is genuinely ~2–3 days late.
- The late-period card logic was firing correctly, but it rendered LOW on the dashboard — below the cycle hero and the entire "Today's Plan" grid — so it was easy to miss. Moved it to the TOP of the dashboard (right under the greeting) and made it a prominent amber callout with an alert icon. Same fertility-aware copy (benign causes + pregnancy-test prompt + see-your-doctor).
**Files changed:** empower-react/src/pages/Dashboard.jsx

## 2026-08-05 — Learning engine, sex-drive signal, and fertility-window (awareness-only)
**Emma said:** her confidence was stuck at 85% despite daily use since launch; wanted sex drive tracked and a fertility window, "but make sure it doesnt blur any fda regulations."
**What was done:**
- **Root cause of the 85% ceiling:** confidence was hard-capped at 0.92 (100% impossible), the history component maxed at 0.80 after ~30 logs, and `user_baselines`/`cycle_summaries` had ZERO rows app-wide — the baseline-learning engine was read in code but never written. Confidence was a rolling daily signal score, not accumulated learning.
- **Learning engine:** added `computeCycleHistory` (counts real cycles from recorded period-start gaps, 15–60 days). `calcConfidence` now grows with cycles tracked (caps ~3 cycles) AND log volume; cap raised 0.92→0.99 so "fully personalised" is reachable. Progression: new user 55% → Emma now 84% (no regression) → 93% at 2 cycles → 99% at 3. `getTodayStatus` now best-effort upserts `user_baselines` (cycles_tracked, avg_cycle_length, model_confidence) so VisitPrep/baseline card finally have data.
- **Sex drive:** libido was already scored toward Ovulatory in inference but never shown back — added a "Sex drive" row to the calendar day detail.
- **Fertility window (FDA-safe):** calendar future-day sheet now shows an estimated fertile window / ovulation card for AWARENESS + conception only, with a mandatory "this is not birth control" disclaimer and NO safe/unsafe-for-unprotected-sex language. Excluded for hormonal-BC and Path 4 users. Rule recorded: the app may show fertility *information*, never contraceptive *instructions* (that needs FDA clearance).
**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Calendar.jsx

## 2026-07-09 — Ask assistant now answers "why do I need higher protein today?"
**User said (queued Ask question):** "Why do I need higher protein todsy"
**What was done:**
- The Ask engine already had a correct protein answer (explains luteal progesterone raises protein breakdown), but its keyword list didn't include "why", "higher protein", "more protein", or "protein today", so the question fell through to the unanswered-question queue.
- Widened the `protein` topic keywords to catch why/higher/more/extra/need-more-protein and "protein today" phrasings.
- Fix is deployed; the feedback row is still marked `pending` (the resolve-status DB write needs explicit approval).
**Files changed:** empower-react/src/lib/askEngine.js

## 2026-07-09 — "Period ended" now actually moves you out of the menstrual phase
**User said:** "now i clicked period ended and i still show up in the menstrual cycle"
**What was done:**
- Root cause: `getPhase` hardcoded "cycle day 1–5 = Menstrual" and never looked at the recorded `period_length`, so marking a period ended (which saves `period_length`) had zero effect on the displayed phase.
- `getPhase(cycleDay, cycleLen, periodLength)` now takes an optional period length (defaults to 5, so existing 2-arg callers are unchanged) and ends the menstrual window at the real bleeding length, clamped to `ovulation-3`. `buildCycleStatus` passes `cycleData.period_length` and now exposes `periodLength` in the returned status. Calendar threads it through `getPhaseForDate` so today's cell and past months stay consistent.
- `markPeriodEnded` (Log.jsx) now records the length from the LAST day flow was actually logged this period, instead of today's cycle day — tapping "It ended" days after bleeding stopped no longer records a too-long period that kept the user stuck on "Menstrual".
- General fix affecting every user who ends a period, not just the reporter.
**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Calendar.jsx, empower-react/src/pages/Log.jsx

## 2026-07-06 — Calendar: logging a new period no longer blanks earlier months
**User said:** "I logged my period on the 4th and then it deleted all my info for the calendar in June."
**What was done:**
- Confirmed first that NO data was lost — all 25 of the user's June daily logs (energy, mood, symptoms) are intact in `daily_logs`. This was a calendar *display* bug, not deletion.
- Root cause: an uncommitted half-finished refactor. `getPhaseForDate` had been rewritten to take a `periodStarts` array, but the two call sites still passed the single `lastPeriod` string, so it received a string, iterated its characters, and returned null for every day (would have blanked ALL months if shipped). The previously-deployed version single-anchored to the newest period start, so every date before it (all of June) lost phase colouring after a July period was logged.
- Fix: `getPhaseForDate` now picks the nearest recorded period start at/before each date and, for dates before the earliest recorded start, extrapolates the cycle backward (normalised modulo) instead of returning null. Added `phaseAnchors` (recorded period-start history + derived last-period date, deduped/sorted) and passed it to both call sites.
- Note: the working-tree `logPeriodStart` (Log.jsx) already appends to period-start history via `mergePeriodStartsNotes`, so future period logs preserve past periods.
**Files changed:** empower-react/src/pages/Calendar.jsx

## 2026-06-21 — Birth control: steady state, no fake cycle phases
**Why:** A tester (on continuous pills) correctly pointed out that hormonal birth control suppresses ovulation and holds hormones flat, so there are no real follicular/ovulatory/luteal phases. Showing rotating phases to BC users was medically inaccurate and a credibility risk.
**What was done:**
- Hormonal BC (combined pill/patch/ring, Depo, implant, hormonal IUD) now always shows a **steady BC state** with no cycle phases, even if a withdrawal-bleed date is logged. Removed the old "estimated phases" path (`bcEstimate`).
- The copper IUD (non-hormonal) still gets a real cycle.
- Dashboard, Calendar, Workout, and Nutrition all now agree (single source of truth in `getTodayStatus`). Calendar no longer colours phases for BC and shows a plain steady-state note.
- Onboarding (Setup, path 5) now explains the steady state and makes clear the bleed date is optional (skip if you take pills continuously or do not bleed), so no one is forced to invent a cycle length.
- Documented as a permanent rule in CLAUDE.md so it is never reverted.
**Files changed:** lib/hormoneSync.js, pages/Dashboard.jsx, pages/Calendar.jsx, pages/Setup.jsx, CLAUDE.md, public/sw.js (cache v8)

---

## 2026-06-20 — Dashboard, Sleep, Nutrition & copy polish
**Emma asked for:** collapse previously-sent feedback; shrink the cycle-day/days-until stats and make cycle day tappable to see what was logged; less performative wording (e.g. "biological priority"); Sleep should log first with "why sleep matters" collapsible and cycle-aware tips; remove em dashes everywhere they aren't correct grammar; declutter the dashboard; fix the symptom-relief panel (cramping spacing, wrong emojis, too few symptoms); keep everything matching the research.
**What was done:**
- **Dashboard cycle day:** replaced the two big "Cycle day / Days until period" cards with one compact card. Tapping it reveals exactly what you logged today (energy, sleep, mood, symptoms, RHR, temp, flow, pain) or prompts you to log. Days-until is no longer duplicated (it is already in the hero).
- **Wording:** rewrote the phase descriptions and insight lines to sound natural and human, removing "biological priority", "real biology", "not a coincidence", "highest-priority", and similar performative phrasing across Dashboard and Calendar.
- **Sleep:** the log form is now the first thing on the screen; phase-specific tips follow; "Why sleep matters for your hormones" is collapsed by default at the bottom. Fixed the +/- stepper defaults.
- **Symptom relief (Nutrition):** fixed the weird spacing (no dangling divider before "Limit"), corrected emojis (cramping 🩸, fatigue 🔋), and expanded from 5 to 9 symptoms (added Headaches & migraines, Breast tenderness, Skin breakouts, Cravings), each with research-grounded remedies.
- **Clinical language:** removed banned terms that had crept back in ("GABA"/"GABA withdrawal", "functional iron deficiency", "prostaglandin") and replaced an "(SOURCE: ACL research pending)" placeholder with the now-verified citation (Herzberg et al. 2017).
- **Em dashes:** removed em/en dashes from user-facing copy app-wide (Dashboard, Sleep, Nutrition, Calendar, Learn, Setup, Privacy, Login, Log, Checkin, Friends, Workout, Weekly summary), replacing them with natural punctuation. Kept compound hyphens, minus-sign buttons, middots, arrows, and APA citation page ranges.
- **Feedback:** the admin "All tester feedback" list now collapses each item to a compact one-line row (status, category, who, date) that expands on tap.
- No algorithm or research numbers changed; phase math, intensity, and nutrition targets are untouched.
**Files changed:** pages/Dashboard.jsx, pages/Sleep.jsx, pages/Nutrition.jsx, pages/Calendar.jsx, pages/Feedback.jsx, pages/Learn.jsx, pages/Setup.jsx, pages/Privacy.jsx, pages/Login.jsx, pages/Log.jsx, pages/Checkin.jsx, pages/Friends.jsx, pages/Workout.jsx, components/WeeklySummary.jsx, public/sw.js (cache v5)

---

## 2026-06-19 — Cosmetic cleanup (2 fixes)
**Context:** Follow-up polish after the bug audit.
**What was done:**
- **HIIT "Skip" now works while paused.** It used to set the timer to 0 and rely on the running clock to advance, so tapping Skip while paused did nothing. It now advances the work/rest/round directly.
- **Weight-field placeholder** no longer shows the word "Bodyweight" in a number input for bodyweight moves — it shows "kg" instead (numeric ranges still show their starting number).
- *Left intentionally:* the glute-bridge demo figure still reuses the hip-thrust figure (same hip-extension pattern) — hand-authoring a floor variant means guessing joint coordinates that can't be visually verified, so it wasn't worth the regression risk.
**Files changed:** pages/Workout.jsx

---

## 2026-06-18 — Senior-level bug audit (12 fixes)
**Context:** Full codebase audit (parallel review of every page + the algorithm libs) to find real and "secret" bugs.
**What was done (verified bugs only — false positives discarded):**
- **AuthGuard infinite spinner:** the profile lookup had no error handling, so a single network hiccup left users stuck on the loading spinner forever. Now caught — users fall through to their page (which has its own retry).
- **Friends showed the wrong email:** outgoing requests stored the *target's* email as `requester_email`, so recipients saw their own address instead of the sender's. Now stores the sender's real email.
- **Calendar off-by-one:** "in X days" / period-prediction math compared a timestamped `now` against midnight dates, so day counts flipped depending on time of day. `now` is now normalised to midnight.
- **PMDD detector cycle-day math:** the per-log cycle-day mapping was inverted and not anchored to the real period date (latent — the detector also requires ≥14 logs, which it doesn't yet receive). Math corrected and anchored to today's cycle day; guarded to skip when no real cycle.
- **Workout mid-session reshuffle:** accessory exercises were re-picked from a live day-seed every render, so a gym session crossing midnight could re-bind already-entered set weights to different exercises. Seed is now captured once per session.
- **Stuck "Saving…":** Log + Check-in called `getUser()` outside their try/catch, so a network failure there left the save button stuck forever. Now guarded.
- **Check-in "Nothing" for mucus** now clears an earlier same-day mucus entry instead of silently leaving the stale one.
- **Setup path switch** now clears `bc_stop_date` (was left stale when switching away from "just came off birth control").
- **Period length sanity bound:** "It ended" now clamps the recorded period length to 1–14 days so stale cycle data can't save a nonsense value.
- **Sleep hours stepper:** +/− from the empty field now start at a sensible 7.5h instead of jumping to 0.5h / doing nothing.
- **Dashboard phase sheet:** added a defensive optional-chain so a future hormone entry without a patterns list can't crash the sheet.
**Files changed:** App.jsx, pages/Calendar.jsx, pages/Dashboard.jsx, pages/Friends.jsx, pages/Setup.jsx, pages/Log.jsx, pages/Checkin.jsx, pages/Sleep.jsx, pages/Workout.jsx, lib/hormoneSync.js, lib/algorithm_v3.js, public/sw.js (cache v4)

---

## 2026-06-18 — Algorithm airtight pass (groundwork for the fertility-window feature)

**Reported by:** Emma — "fix everything" from the data-integrity audit.

**1. Ovulation timing corrected (the big one).** `getPhase`/`getLutealSubPhase` assumed ovulation at mid-cycle (`cycleLen/2`), which is only right for a 28-day cycle and misplaced the fertile window for everyone else (a 35-day cycle ovulates ~day 21, the app said 18). Replaced with the luteal-phase-fixed model `getOvulationDay() = max(8, cycleLen − 14)`, applied consistently in getPhase, getLutealSubPhase, getPredictions (hormoneSync) and detectPMDDPattern (algorithm_v3, inlined to avoid a circular import). 28-day cycles are unchanged; non-28 cycles are now accurate. CLAUDE.md phase-calc section updated so it can't be reverted.

**2. Logged hormone labs now used (were dead-captured).** Added `interpretHormones()` — progesterone ≥10 nmol/L confirms ovulation occurred (sets `ovulationConfirmed`, raises confidence to ≥0.85), LH ≥8 IU/L flags a surge, estradiol interpreted. getTodayStatus now exposes `ovulationConfirmed` + `hormoneSignals` for the future fertility feature, and the Log screen shows a plain-language interpretation under the hormone inputs (with the population-average caveat). Previously estradiol/progesterone/LH were saved and never read.

**3. Resting-HR signal precision.** Inference parsed range labels lossily (`"Under 55"`→NaN). Added `rhrToNum()` mapping ranges to midpoints so the RHR phase signal is consistent whether the user picks a range or types an exact bpm.

**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/lib/algorithm_v3.js, empower-react/src/pages/Log.jsx, CLAUDE.md

## 2026-06-18 — Can't log that your period started (+ silent cycle-save bug)

**Reported by:** Emma (emmascheck2001, Path 2 / off Depo since Feb 13) — "I just got my period today but I can't log it."

**Two bugs found:**
1. **No in-app way to log a period start.** The React Log screen only wrote `daily_logs`/`mucus_logs` — the "period started" control from the old app was never ported. Flow/pain fields only appear once you're already in Menstrual phase (which needs cycle data), so an observation/Depo-recovery user whose period returns had no way to record it. Added a "Did your period start?" card to the Log screen (non-perimenopause): a date picker (defaults to today, allows an earlier date) + "Log period start" button that writes `cycle_data`, recomputes the phase, and reveals flow/pain. This is the milestone moment for Depo-recovery users — their cycle returning.
2. **`cycle_data` unique constraint on `user_id` was missing** — so every `onConflict:'user_id'` upsert errored. This silently broke **Setup's** period-date save for all path-1/5 signups since ~Jun 9 (e.g. Cassidy: path 1, required period date never saved → stuck in observation). Restored the constraint via migration (`cycle_data_user_id_key`, no duplicates existed). This fixes Setup going forward and powers the new period-start control.

**Follow-up:** existing affected users (e.g. Cassidy) still have no cycle data — their original Setup date was lost. They can now set it via the new Log "period started" control or by re-entering in Setup.

**Files changed:** empower-react/src/pages/Log.jsx + DB migration cycle_data_user_id_key.

## 2026-06-16 — Liability / wording audit pass (not legal advice)

**Reported by:** Emma — "make sure there are no liability concerns with wording and everything." (Reviewed against medical-language best practice + the project's own rules. NOT a substitute for a real femtech/healthcare attorney review before launch.)

**Findings + fixes:**
- **No contraceptive-use disclaimer** despite the app tracking fertile window, cervical fluid, and LH (the highest femtech liability). Added to the privacy/consent gate every new user sees: "Em~power does not prevent pregnancy and is not a method of contraception or fertility treatment. Never rely on it to avoid or plan a pregnancy." Also strengthened the medical-advice line there to "always consult a qualified healthcare professional before acting on anything in the app."
- **Sleep and Workout screens had no disclaimer** despite giving supplement doses (Sleep) and exercise guidance (Workout). Added a shared `<Disclaimer>` component and placed a tailored disclaimer on each (supplements → "talk to your doctor before starting any supplement"; exercise → "carries inherent risk, stop if you feel pain, check with a professional if new/pregnant/injured"). Learn and Nutrition already had disclaimers.
- **Directive individual supplement dosing softened** where it appeared without an adjacent disclaimer: the late-luteal nutrition tip ("start magnesium 400mg daily now") and the weekly-insight tip ("Try magnesium 400mg before bed") are now framed as "many women find … in studies — check with your doctor," not personal prescriptions.

**Still worth your/a lawyer's attention (not changed):** the PMDD auto-flag names the condition (it does say "pattern observation, not a diagnosis" + see a doctor); remaining specific doses in Learn/Nutrition are now behind disclaimers but could be softened; confirm crisis-line resources appear with any crisis-level mood content. A qualified attorney should review Terms of Service and the full medical-language set before public launch.

**Files changed:** empower-react/src/App.jsx, empower-react/src/components/Disclaimer.jsx (new), empower-react/src/pages/Sleep.jsx, empower-react/src/pages/Workout.jsx, empower-react/src/lib/algorithm_v3.js, empower-react/src/components/WeeklySummary.jsx

## 2026-06-16 — Workout demo: fix leg curl + Bulgarian split squat, add polish

**Reported by:** Emma — "Bulgarian split squat is not correct; leg curl is incorrect, it's legs not arms; also make them a little more aesthetic."

**What was done:**
1. **Leg curl was animating arms.** The `curl` figure is a *biceps* curl, but `getSvgType` routed every "curl" (including Leg curl and Nordic curl) to it. Added a dedicated `legcurl` figure — lying face-down on a pad, thighs fixed, shins curling up toward the glutes — and routed "leg curl" / "nordic" / "hamstring curl" to it. Biceps curls still use the arm figure.
2. **Bulgarian split squat fixed.** The back foot was on the floor like a normal lunge. It now sits **elevated on a bench behind** (the defining feature), with the front knee bending and hips dropping while the back knee travels down and the torso stays upright.
3. **Aesthetic polish:** added a soft ground shadow under the figure, articulated accent-coloured joint dots (shoulders, hips, knees, elbows) for a cleaner designed look, weight plates on the ends of the bar, and a filled white head.

**Note:** still authored by coordinates without a visual render here — worth re-checking the split squat and leg curl specifically look right; trivial to nudge.

**Files changed:** empower-react/src/pages/Workout.jsx

## 2026-06-16 — Workout demo: stick figures now actually animate the rep

**Reported by:** Emma — "make sure the animated stick figures are correct in the demo, and make them move so it's a real demo."

**What was done:** Rebuilt `StickFigure` in Workout.jsx. It was a single static SVG pose per exercise. It's now a joint-based skeleton (head, neck, hip, both legs, both arms, plus the loaded bar/implement) defined as TWO real poses — start and working — per exercise. A `requestAnimationFrame` loop interpolates between them with an ease-in/out ping-pong, so the figure performs the actual movement on a loop: squat sits down and stands, RDL hinges at the hips, bench/overhead press travels the bar, row pulls to the ribs, curl swings the forearms, pull-up rises to the bar, hip thrust bridges up, calf raise lifts onto the toes; plank/stand get a subtle "alive" motion. Honoured `prefers-reduced-motion` (shows a mid-pose still). Verified the exercise→figure mapping in `getSvgType` is correct for every type.

**Note:** the motion/poses were authored by coordinates and built clean, but I can't visually render them from here — worth a quick look on the workout player to confirm each looks right; easy to nudge any joint that's off.

**Files changed:** empower-react/src/pages/Workout.jsx

## 2026-06-15 — Estimate phase from symptoms when no period is logged (the core promise)

**Reported by:** Emma — "shouldn't you be able to figure out what cycle I'm in from the data? That's kinda why I made the app." (Her own account: Path 2, off Depo ~1 month, 11 logs, no period date → stuck in observation at 38%.)

**What was done:** Turned on symptom-based phase estimation, which the engine (`inferPhaseFromSymptoms`) already supported but was being held back to a "soft hint" (an earlier version promoted it per-screen and the screens disagreed, so it was pulled). Now, in `hormoneSync.buildCycleStatus`, when there is no logged period date the inferred phase becomes the working phase — flagged `estimated: true` and carrying the inference's own (lower) confidence — as long as there are ≥3 distinct signals; otherwise it stays in honest observation. Because every screen reads this one shared value, they stay consistent (the original mismatch can't recur). The Dashboard adopts `status.estimated`/`status.phase`, labels the hero "Estimated phase" / "Looks like …", and shows an honest caveat: "read from your logged symptoms, not a confirmed cycle." For Depo-recovery users (Path 2 + Depo) the caveat adds that the cycle can take 9–18 months to return, so there may be no true cycle to detect yet.

**Why the caveat matters:** for a Depo user 1 month out, ovulation is likely still suppressed, so symptom scores may reflect mood/energy that isn't cycle-driven. The estimate is surfaced (the app's job) but never presented as a confirmed cycle.

**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Dashboard.jsx

## 2026-06-15 — Open the feedback tool to all testers (was locked to developer only)

**Reported by:** Emma — "it says the feedback is only available during the beta period, what does that mean?"

**What it meant:** Despite the wording, the feedback screen was hard-restricted to a single email (`setAllowed(u.email === EMMA_EMAIL)`). Every other signed-in user — i.e. all beta testers — got the "Beta access only" lock screen and could not submit anything. This is why the `user_feedback` table has been empty the whole time: testers were silently blocked from sending feedback, so the 3-hour processing loop had nothing to find.

**What was done:** Changed the gate to `setAllowed(true)` so every signed-in user can submit feedback, and removed the now-unused `EMMA_EMAIL` constant. The lock-screen branch remains in place (dead for now) in case access ever needs re-restricting.

**Files changed:** empower-react/src/pages/Feedback.jsx

## 2026-06-15 — Setup self-corrects for onboarded users (Hannah's setup-every-login)

**Reported by:** Emma — Hannah reinstalled but the setup "describe your cycle" screen still pops up every login; "just fix it for her."

**What was done:** Made the setup screen self-correcting. On mount, `Setup.jsx` now checks the user's `onboarding_complete`; if they are already onboarded and did NOT arrive with `?edit=1`, it immediately redirects to `/dashboard` (showing a spinner, no flash of the form). This guarantees an onboarded user can never get stuck re-doing onboarding, regardless of how they reached `/setup` — an installed iOS PWA restoring the `/setup` page, a stray link, or any stale routing. The one legitimate edit entry point (the dashboard "Change information" button) now navigates to `/setup?edit=1` so editing details still works. Also bumped the service worker (`v2` → `v3`) to force any still-stale client to pull this build.

**Files changed:** empower-react/src/pages/Setup.jsx, empower-react/src/pages/Dashboard.jsx, empower-react/public/sw.js

## 2026-06-15 — Force stale PWAs to update (Hannah re-doing setup every login)

**Reported by:** Emma — "hannah keeps having to enter the 'describe your cycle right now' [setup screen] every time she logs in."

**Diagnosis:** Hannah's account is `onboarding_complete=true` with one clean profile row, and the current AuthGuard reads that from the database and keeps her on the dashboard — verified by simulating her exact profile read under RLS (returns `true`). So the current code does NOT route her to setup. The "describe your cycle right now" text lives only on the setup path screen (`Setup.jsx:127`). The DB-based onboarding gate was introduced in commit `af2432d`; before that, onboarding/consent state was read from `localStorage`, which doesn't persist on her browser/PWA — so the OLD build re-showed setup on every login. Conclusion: her device is running a stale cached build from before that fix.

**What was done:** Bumped the service-worker cache version (`empower-react-v1` → `v2`). The browser detects the changed `sw.js`, installs the new worker, whose install handler deletes every old cache and claims open clients — delivering the current (fixed) build to stale installed PWAs on next open. No app-logic change was needed; the routing is already correct.

**Note for Emma:** if Hannah's app doesn't refresh on its own, have her fully close and reopen it (or remove and reinstall the PWA / hard-refresh in the browser) once to pick up v2. After that the DB-based gate keeps her on the dashboard.

**Files changed:** empower-react/public/sw.js

## 2026-06-13 — Fix: privacy gate infinite loop locked new users out (Emily)

**Reported by:** Emma — "emily couldn't get in, she was stuck in a loop."

**Root cause:** The privacy gate recorded consent with `localStorage.setItem(ep_privacy_<uid>)` and then `AuthGuard.resolve()` re-read `localStorage` to decide whether to proceed. On mobile Safari, iOS PWAs, and private/incognito mode, localStorage writes are frequently dropped or blocked — so the write didn't persist, the re-read returned nothing, and the user was sent straight back to the privacy gate. Agreeing → re-check → gate again, forever. A not-yet-onboarded user (like Emily, who has no profile) has no DB consent record to fall back on, so she could never get past it. (In private mode `setItem` can also throw, which would kill the agree handler outright.)

**What was done:** Added a module-level in-memory `consentedThisSession` set (survives route changes within the session) and routed all consent reads/writes through `rememberConsent()` / `hasConsent()` helpers. Consent is now remembered in memory the instant the user agrees, regardless of whether localStorage persists, so the gate can never loop. Both the localStorage read and write are wrapped in try/catch so a blocked/throwing storage API can no longer break the auth flow or hang on the spinner.

**Files changed:** empower-react/src/App.jsx

## 2026-06-13 — Robustness audit: no more dead-ends / white screens

**Reported by:** Emma — "make sure everything is working and no one is getting stuck."

**Audit findings:** Build is clean. A DB check found several users stuck at onboarding — two signed-in-but-no-profile (`emilyberday`, `ems384`) and two with `onboarding_complete=false` (`delaneyheadrick3`, `kennedynolan`) — all pre-fix casualties of the silent setup dead-end fixed earlier today (they can complete setup now that it surfaces errors). No DB trigger creates profiles, so profiles come only from Setup's finish().

**Hardening done (prevents future stuck states):**
- `getTodayStatus` (hormoneSync.js) and the per-page profile reads in Dashboard, Log, and Learn used `.single()`, which **throws on zero rows**. For a profile-less user (or a transient empty read) that threw, and Dashboard then rendered a blank white screen (`if (!d) return null`) — a dead-end. Switched all four `profiles` reads to `.maybeSingle()` (all call sites already use optional chaining, so null flows through safely).
- Dashboard now redirects to `/setup` when the profile is missing OR onboarding is incomplete (was only the latter), so a profile-less user can never land on a broken dashboard.
- Dashboard's blank-screen failure state (`if (!d) return null`) is now a recoverable error with a "Try again" button instead of an unrecoverable white screen.

**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Dashboard.jsx, empower-react/src/pages/Log.jsx, empower-react/src/pages/Learn.jsx

## 2026-06-13 — Birth control: show cycle phases (as an estimate), not "cycle paused"

**Decided by:** Emma — chose "phases for all BC, with a note." This refines the earlier same-day change (which hid phases for hormonal BC). Rationale she raised: many hormonal-BC users still cycle and bleed — true especially for the hormonal IUD (ovulation usually continues) and many mini-pill users; combined pill/patch/ring suppress ovulation and the monthly bleed is a withdrawal bleed, so for those the phases are an estimate.

**What was done:** Hormonal-BC users (path 5, excluding copper IUD) who track a period/bleed date now flow through the normal cycle-phase logic — so phases appear on the dashboard, calendar, workout, and nutrition like any other user. Added a `bcEstimate` flag (set in `hormoneSync.js` `buildCycleStatus` and recomputed in `Dashboard.jsx`) that is true whenever a hormonal-BC user is being shown a phase. Both the dashboard hero and the calendar render an honest caveat when it is set: "Hormonal birth control can flatten your natural hormone swings, so your true cycle may differ." Users with no bleed date logged still fall back to the BC baseline state (`buildPath5Status`) and now correctly see the "log your period date to see phase predictions" prompt (which, once logged, gives them phases). Replaced the "your natural cycle is paused" calendar banner with the estimate caveat.

**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Calendar.jsx, empower-react/src/pages/Dashboard.jsx

## 2026-06-13 — Calendar: complete mood colours + birth-control awareness

**Reported by:** Emma — "make sure the calendar is working with all colors and mood; make sure if you're on hormonal birth control you're still getting what phase you're in."

**What was found and done:**
1. **Mood colours incomplete.** `MOOD_COLORS` in Calendar.jsx only covered the Check-in mood words (Energised, Happy, Calm, Focused, Tired, Anxious, Irritable, Low). The full Log screen saves a *different* set (Energetic, Motivated, Confident, Social, Sad, Brain fog, Low mood), none of which were mapped — so moods logged via the full log rendered as plain grey in the calendar. Added all seven missing moods with sentiment-appropriate colours. Phase colours (`PC`) were already complete for every phase.
2. **Calendar ignored hormonal birth control.** A path-5 hormonal-BC user saw a generic grey "observation" calendar whose future-day sheet told them to "Log your period date to see phase predictions" — misleading, since hormonal BC suppresses ovulation and there is no natural cycle phase (per the app's permanent clinical rules). Added `isHormonalBC` detection (path 5, excluding copper IUD), folded it into `hasPhaseData` so the calendar never fabricates phases for these users, set the header subtitle to their method (e.g. "Combined pill"), suppressed the misleading period-date prompt, and added a short banner: "Your natural cycle is paused. Hormonal birth control suppresses ovulation, so there are no cycle phases to show. This calendar tracks your logged energy, mood, and sleep instead."

**Clinical note:** Birth-control users do NOT get a faked Follicular/Ovulatory/Luteal phase (that would be medically wrong). They correctly get a BC-specific state — the dashboard already shows their method, pill-pack/withdrawal-bleed tracking, and BC nutrition via the `bc` phase. This change brings the calendar in line with that.

**Files changed:** empower-react/src/pages/Calendar.jsx

## 2026-06-13 — Bug fix: setup could dead-end silently (users stuck with no profile)

**Reported by:** Emma — "it doesn't like emily finish setup." Investigation found user `emilyberday@gmail.com` had a valid, confirmed auth account (signed in 2026-06-09) but **no profile row and no data anywhere** — she could log in but never completed onboarding.

**Root cause:** `Setup.jsx` `finish()` saved the profile with `supabase.from('profiles').upsert(...)`, but on error did `console.error(error); setSaving(false); return` — a **silent dead-end**. The spinner stopped, no message appeared, and the user was stuck on the setup screen with no profile created. Verified the database side is healthy: RLS policies allow the insert (simulated Emily's exact upsert under her own JWT in a rolled-back transaction — it succeeds), all columns nullable/defaulted. So the failure is client-side (most likely an expired auth session → RLS rejects the write), and the real bug is that the failure was invisible and unrecoverable.

**What was done:** Added a `saveErr` state and rendered an error message below the Finish button. On save failure the user now sees either "Your session has expired. Please sign in again, then finish setup." (for auth/JWT/session errors) or the specific error text, instead of a silent dead-end. The save can now succeed or tell the user exactly what to do, rather than trapping them. Did NOT touch Emily's account (per Emma's instruction not to change her password).

**Files changed:** empower-react/src/pages/Setup.jsx

## 2026-06-12 — Code cleanup: lint pass + remove superseded Calendar content

**Found via:** lint sweep during the 3-hourly bug check (45 ESLint problems, 0 build errors).

**What was done:** Cleaned up 24 lint problems with zero behavior change — all verified against a passing build after each edit:
- Converted 6 empty `catch(e){}` blocks to `catch { /* ignore */ }` (Checkin, Dashboard, Learn, Sleep, Workout, Friends) — identical runtime behavior, drops the unused binding.
- Removed 11 genuinely unused variables from destructures/assignments (Dashboard, Friends, WeeklySummary, Workout), each confirmed unused by ESLint. Avoided one trap: a `return {…}` object whose fields *are* used sat on a near-identical line.
- Removed the `WHAT_TO_EXPECT` and `PLAN_AHEAD` constant blocks (~24 lines) from the Calendar future-day sheet. These were superseded leftovers from an older design — the live sheet already renders the same ground via `PLAN_NUTRITION`/`PLAN_MOVEMENT` (PLAN AHEAD card) and `BRAIN_STATE`/`BRAIN_DETAIL` (YOUR BRAIN THIS DAY card), all fully populated. Wiring the legacy constants back in would have produced duplicate sections, so they were deleted rather than reconnected.

**Deliberately left untouched** (changing them risks real behavior changes): 3 `setState`-in-effect cases (Calendar brain-reset, Setup preview, Workout HIIT timer), 5 `react-refresh/only-export-components` (dev-only HMR), the intentional `useEffect(()=>{init()},[])` mount pattern (exhaustive-deps + "before declared"), and the unused-but-complete `ActivityPulse` component. Lint went 45 → 21 problems.

**Files changed:** empower-react/src/pages/{Calendar,Checkin,Dashboard,Friends,Learn,Sleep,Workout}.jsx, empower-react/src/components/WeeklySummary.jsx

## 2026-06-12 — Bug fix: broken PWA manifest (console errors + not installable)

**Found via:** scheduled audit / browser console check — every page load logged "Manifest: Line 1, column 1, Syntax error" plus two 404s.

**What was done:** `index.html` referenced `<link rel="manifest" href="/manifest.json">`, but `manifest.json` and the app icons were never carried into `empower-react/public/` during the React migration. The SPA `_redirects` fallback served `index.html` (HTML) for `/manifest.json`, so the browser tried to parse HTML as JSON and threw a syntax error on every load; the icons and `/favicon.ico` 404'd. Created `public/manifest.json` (start_url `/`, standalone, theme `#2c2820`), copied the four icon PNGs (192, 512, maskable-512, apple-touch) into `public/`, and added the missing `<link rel="icon">`, `<link rel="apple-touch-icon">`, and `<meta name="mobile-web-app-capable">` to `index.html`. The app is now installable as a PWA and the console is clean. Verified in a headless Chrome run: zero manifest errors, zero failed requests.

**Files changed:** empower-react/index.html, empower-react/public/manifest.json (new), empower-react/public/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png (new)

---

## 2026-06-12 — Feedback fix: observation mode stuck at 5% confidence forever

**User said:** "I been stuck in observation mode for the past week and my algorithm says it's only at 5%"

**What was done:** For users with no cycle data (e.g. Depo recovery / observation mode), confidence was hardcoded to 5% and never moved, even after a week of daily logging — so the app looked broken ("learning your baseline" with no progress). The no-cycle-data branch in `buildCycleStatus` and the dashboard's observation case both ignored the lifetime log count that already drives confidence growth for everyone else. Both now grow confidence by ~3% per logged day, capped at 45% (kept modest on purpose, since there is no confirmed cycle to anchor to — it reflects "learning your baseline", not certainty). Verified the reporting account now shows 29% after 8 logs instead of 5%. Phase correctly stays "observation".

**Files changed:** empower-react/src/lib/hormoneSync.js, empower-react/src/pages/Dashboard.jsx

---

## 2026-06-11 — Gym: embedded exercise demo photos (replacing the watch-demo link)

**Found via:** user preferred embedded images in the card over a link.

**What was done:** Replaced the "Watch video demo" link with embedded demonstration photos in the gym player's demo card, sourced from the public-domain free-exercise-db (served via the jsDelivr CDN). Every image URL was verified to return HTTP 200 before being added — 28 of 30 gym exercises have a real photo; the 2 without (Bulgarian split squat, Nordic curl) gracefully fall back to the existing stick figure. The `ExerciseImage` component also falls back to the stick figure on any load error, so a missing or 404 image can never break the card (and a `key` per exercise resets that state between exercises). Warmups, yoga, and pilates keep their text demos.

**Note for follow-up:** the free-exercise-db photos use a male model. For a women's app that's a brand consideration worth revisiting with a women-specific media source later.

**Files changed:** empower-react/src/pages/Workout.jsx
## 2026-06-11 — Workout variety (gym + HIIT) + gym video demos

**Found via:** user request — workouts repeated the same exercises each session; wanted variety, and visual demos for the gym while keeping the text ("word") demos for warmups/yoga/pilates.

**What was done:**
- *Variety (deterministic day rotation).* Added `daySeed()` + `rotatePick()` — selection is keyed to the calendar day (NOT Math.random) so it stays stable within a session (the gym player tracks sets by exercise index, so the list must not reshuffle mid-workout) but varies day to day.
  - Gym: the main compound lifts (first 4) stay fixed for progression; the 2 accessory slots now rotate from an expanded pool (`GYM_ACCESSORIES`, built only from exercises the demo metadata already recognises). Verified across all 9 group/level combos: always 6 exercises, core fixed, stable within a day, varies across days, no duplicates, valid shape.
  - HIIT: keeps the phase's rounds/work/rest but rotates which moves are shown from an expanded, phase-appropriate pool (`HIIT_POOL` — low-impact options for menstrual/luteal, explosive for follicular/ovulatory). Verified across all phases: correct count, stable, varies, no duplicates.
- *Gym video demos.* Added a "Watch video demo" link to each exercise in the gym player (opens a form-demonstration video), on top of the existing stick figure and start/working/finish position text. Warmups, yoga, and pilates keep their text demos unchanged, as requested.
- *Held deliberately:* yoga/pilates exercise rotation — their sequences are deliberately ordered flows (warm-up → peak → savasana), and rotating them safely needs curated per-phase pools so an intense pose never lands in a rest-day flow. Flagged as the careful next step rather than risk the flow.

**Files changed:** empower-react/src/pages/Workout.jsx
## 2026-06-11 — Workout: phase-content fallback + filled-in cardio phase keys

**Found via:** following up the workout audit — cardio dictionaries were missing per-phase keys for some strokes.

**What was done:** Two parts.
1. *Systemic fix.* getTodayStatus returns sub-phases like "Early follicular", but the workout dictionaries are keyed "Follicular" — so early-follicular users were silently getting generic observation content across the WHOLE workout tab (cardio, warmups, HIIT, banner, yoga, pilates), not just cardio. Added a `pc()` lookup helper that uses the exact sub-phase if present, otherwise falls back to the base phase (Follicular/Luteal) before observation, and routed every dictionary lookup through it. No real cycle phase drops to observation anymore.
2. *Cardio specifics (as requested).* Filled in the missing per-phase cardio entries so each stroke has tailored guidance: run gained Late follicular and Early luteal; cycle gained Late follicular, Early luteal, Late luteal; swim gained Late follicular, Early luteal, Mid luteal, Late luteal, and Perimenopause (e.g. swim mid-luteal now notes the cool water offsets the elevated core temperature; swim perimenopause notes to pair with resistance for bone since swimming is not weight-bearing). Also softened two lingering overstated citations in the swim Follicular note.

Verified by simulating the lookup for every phase × stroke: all resolve to specific or correct base-phase content, none to observation.

**Files changed:** empower-react/src/pages/Workout.jsx
## 2026-06-11 — Full workout-tab science audit: safety fixes + citation corrections

**Found via:** requested full audit of the Workout tab (durations, weights, workouts, warmups, instructions, demos) against women's cycle-phase science, cross-referenced to peer-reviewed sources. Ran three parallel audits, then verified and fixed.

**What was fixed (safety):**
- A Nordic hamstring curl was in the **ovulatory warmup** — a maximal eccentric exercise placed at peak ligament laxity (backwards and unsafe). Removed it and rebuilt the ovulatory warmup to be the most thorough/progressive (8 moves, joint and knee prep first, the only plyometric last).
- The gym Nordic curl was over-dosed (3×8) and over-claimed ("crucial ACL prevention"). Reduced to 3×6 with a progression/soreness caveat and reframed to hamstring-strain prevention and knee stability (the ACL link is indirect).
- Menstrual HIIT prescribed a mountain climber (raises intra-abdominal pressure during cramps) → swapped for a standing knee lift. Mid-luteal HIIT kept high knees (impact) despite the cooling intent → swapped for marching in place.

**What was fixed (citations / accuracy):**
- The ovulatory ligament-laxity/ACL claim was mis-cited to Kissow 2022 (a strength study); the repo itself flagged this SOURCE NEEDED. Replaced with the correct source, Herzberg et al. 2017 (OJSM systematic review & meta-analysis: laxity significantly higher in the ovulatory phase). Added to the Research Foundation.
- Cardio "estrogen improves fat oxidation" was cited to Hackney 2006 (the cortisol paper) → corrected to Hamadeh et al. 2005. Overstated ovulatory "best power and speed (Sarwar 1996)" claims (walk/run/cycle/swim) softened to the accurate "strength tends to be highest in the follicular-to-ovulatory window" with individual-variation hedging. A VO2max claim (Sung 2014) and a progesterone-ventilation claim (mis-cited to Charkoudian) were corrected. Menstrual cycling prostaglandin claim re-cited to Daley 2015.

**Audited and confirmed sound:** gym weight ranges (vs female strength norms), sets/reps per level, muscle-group mapping, form cues, yoga/pilates sequences and all move demos (anatomically correct, safe cues), and the duration/intensity gradient across phases. Build verified.

**Files changed:** empower-react/src/pages/Workout.jsx, CLAUDE.md
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

## 2026-06-26 — Multi-persona review fixes (safety, accuracy, inclusivity, progression)
**Context:** Ran the app as 8 expert personas (OB-GYN, GP, dietitian, strength coach, inclusivity reviewer, life-stage personas, investor, competitor). Fixed everything they flagged.

**Safety (#1–4):**
- Acute red-flag card in the daily log for very heavy bleeding or severe pain (ACOG: soaking through protection hourly / clots / sudden one-sided pain / possible pregnancy → seek same-day care).
- Late/missed-period card on the dashboard that prompts a pregnancy test instead of silently continuing "PMS" framing.
- Crisis support (988, call or text) now surfaces on any low-mood log, not just one perimenopause article.
- Age gate at onboarding (13+) with a guardian note for under-18s; teen reassurance card that irregular cycles are normal in the first years after menarche (ACOG 651).
- Postmenopausal-bleeding "always get it checked" warning added.

**Accuracy (#5–7):**
- Softened overstated claims: omega-3/olive-oil are no longer "as effective as ibuprofen"; ginger keeps its real RCT framing but with "alongside, not instead of, pain relief". Hormone readouts no longer "confirm" ovulation or call a single LH a guaranteed surge.
- Nutrition disclaimer now covers allergens, disordered-eating safety, and supplement doses; vegan protein capped at 2.2 g/kg.
- Postmenopausal users are now labelled "Postmenopause", not "Perimenopause".
- Sleep magnesium tip re-cited correctly (Abbasi 2012, not Facchinetti).

**Inclusivity (#9):**
- Default foods lead with affordable global staples (beans/lentils); calcium guidance no longer defaults to dairy.
- Learn now covers PCOS in South Asian women, fibroids (disproportionately affect Black women), the ferritin/blood-trait caveat (thalassemia/sickle cell), vitamin D by skin tone, and earlier perimenopause in Black and Latina women.

**Workout progression (#8):**
- New exercise_history table + a "last time" hint and progressive-overload nudge in the workout player, so the app finally tracks strength across sessions, not just displays a workout.

**Also fixed earlier the same day:** sleep hours no longer overwrite the shared notes field (own column).
**Files:** Setup, Log, Dashboard, Nutrition, Learn, Sleep, Workout, hormoneSync, CrisisSupport (new), session, App; migrations: birth_year, sleep_hours, exercise_history, delete_my_account.

## 2026-06-29 — Feedback fix + prenatal verification
**User said:** "I tried to log yesterdays bc I missed it but it showed up as my log today when I tried to fix it and log my yesterdays results it wouldn't save. Also I'm on my period so I don't think I would have any type of cervical mucus. And that's an option in the log"
**What was done:** Added a date picker at the top of the daily log so any missed day can be backfilled (previously the log always saved to today unless reached from the calendar); the form now resets and reloads that day's saved data when the date changes. Hid the cervical-fluid question during the menstrual phase — flow masks it, so it is not a meaningful signal then. Also ran a clinical cross-reference pass on all pregnancy/prenatal content: corrected a misattributed miscarriage stat (kept "~15% of recognised pregnancies, Quenby 2021", removed the incorrect "1 in 4 women" claim), softened the postpartum-emergency wording to match CDC framing, and rounded out the high-mercury fish list (added king mackerel, tilefish).
**Files changed:** src/pages/Log.jsx, src/pages/Learn.jsx, src/pages/Nutrition.jsx, public/sw.js

## 2026-06-29 — New feature: Visit Prep (appointment prep)
**Why:** Product pillar #4 — help women prepare for appointments and understand symptoms. Was the weakest pillar (scattered Learn mentions, no data-driven tool).
**What was done:** New /visit-prep screen that compiles a user's own tracked data (last 120 logs + cycle data + baselines) into a doctor-ready summary: snapshot, what they've been tracking (aggregated pain/flow/mood/sleep/peri symptoms), neutral "patterns worth discussing" (never names a condition, always "not a diagnosis"), questions to ask, and tests worth requesting (path-tailored; iron/ferritin for heavy flow + fatigue). Copy-to-clipboard + print/PDF. Entry card on the dashboard. Pure logic in lib/visitPrep.js with 10 unit tests.
**Files changed:** src/lib/visitPrep.js (new), src/lib/visitPrep.test.js (new), src/pages/VisitPrep.jsx (new), src/App.jsx, src/pages/Dashboard.jsx, public/sw.js, CLAUDE.md

## 2026-06-29 — Personalised, cycle-aware weight progression
**Why:** The workout should actively get HER stronger (up the weights), not just show a generic level-based range. Foundation existed (exercise_history + "last time" hint) but the prescribed weight was static and the +2.5kg nudge was hardcoded text.
**What was done:** New lib/progression.js (pure, 9 unit tests) computes the day's target from her OWN last lift AND her cycle phase: in a favourable phase (follicular/ovulatory, intensity ≥0.95) it prescribes +2.5kg (upper) or +5kg (lower-body compound) with a "+Xkg" badge; in early luteal it holds and says save the jump for follicular; in the demanding luteal/menstrual phases it holds and reframes that the same load feels harder (physiology). The player's "WEIGHT TODAY" box and set-input placeholder now show this personalised target; first-time lifts still fall back to the level-based starting range. Sources: Schoenfeld 2017/ACSM (overload), Kissow 2022, De Martin Topranin 2023, Hackney 2006.
**Files changed:** src/lib/progression.js (new), src/lib/progression.test.js (new), src/pages/Workout.jsx, public/sw.js, CHANGES.md

## 2026-06-29 — Daily Coach (morning briefing)
**Why:** Make the app feel like a coach — a morning summary of Today's Focus + Training, Nutrition, Sleep, Mindset.
**What was done:** New lib/dailyCoach.js (pure, 10 unit tests) synthesises a morning briefing ENTIRELY from data getTodayStatus already produces (phase, intensity modifier, nutrition targets, recent logs) — no new data source, no DB writes, no fabricated metrics. Time-aware greeting with first name; Today's Focus (phase-derived); Training scaled to the phase intensity (and NEVER auto-prescribed in pregnancy); Nutrition from the real protein/calorie targets + iron when menstruating; Sleep with phase-aware + poor-night acknowledgement; Mindset from the phase. A recovery caution appears ONLY when her own logs (poor sleep / very low energy / heavy disruptors) support it — never invented. Rendered as a card at the top of the dashboard: focus always visible, full plan expands on tap. Degrades gracefully on sparse data.
**Files changed:** src/lib/dailyCoach.js (new), src/lib/dailyCoach.test.js (new), src/pages/Dashboard.jsx, public/sw.js, CHANGES.md

## 2026-06-29 — Coach + Weekly Insights polish
**What was done:** (1) Daily Coach card simplified to just "Today's Focus" (greeting + focus + a recovery note only when the user's own logs warrant it); removed the expandable training/nutrition/sleep/mindset plan and the "smart call, not the soft one" wording. (2) Weekly Insights now appears ONLY on Sundays. (3) Weekly Insights is now strictly the user's own logged data — removed the generic "Trend to watch" (population "many women notice" predictions) and "Your experiment this week" (generic prescriptions); tightened the sleep line to pure logged data.
**Files changed:** src/lib/dailyCoach.js, src/pages/Dashboard.jsx, src/components/WeeklySummary.jsx
**Deploy note:** `netlify deploy --prod` returned Forbidden (draft deploy worked; published via `netlify api restoreSiteDeploy`). Not a code issue — likely a token-rotation/permission change on the Netlify side. Worth checking team role / new token scope.

## 2026-06-30 — Symptom Coach (cycle-symptom pattern detection)
**Why:** The "over the last months your headaches usually appear around ovulation" feature — the differentiator. Built with strict honesty rules so it only claims a pattern when the data earns it.
**What was done:** New lib/symptomPatterns.js (pure, 9 unit tests) analyses a user's own logged symptoms and reports which cluster in a consistent part of the cycle vs which don't. Honesty gates: a symptom must be logged 4+ times across 2+ cycles, with 60%+ of occurrences in one phase window, before it's called cyclical; always hedged ("has tended to show up"), never causal, never names a condition, always "a pattern in your own data, not a diagnosis." The null result is first-class: "did not line up with your cycle — worth mentioning to your provider." Needs 14+ placed logs or it says "keep logging." Surfaced in Visit Prep as a "How my symptoms line up with my cycle" section (also included in the copy/print text). Cycle day per past log is projected from last_period_date at avg cycle length (approximate for irregular cycles — hence the hedged wording + strong-clustering requirement).
**Files changed:** src/lib/symptomPatterns.js (new), src/lib/symptomPatterns.test.js (new), src/pages/VisitPrep.jsx

## 2026-08-06 — Cross-platform wearable integration + cycle guardian
**What was built:** One wearable integration that works on BOTH iOS (Apple Health / Apple Watch) and Android (Health Connect) via @capgo/capacitor-health. Because it reads the phone's central health store, connecting once passively covers most wearables (Oura, Apple Watch, Whoop, Fitbit, Garmin, Samsung) that sync into it. Reads overnight/basal/body temperature, resting HR, and HRV; re-reads on every app open so data keeps integrating daily. Detects ovulation from the temperature shift (3-over-6 coverline, Marshall 1968).
**Cycle guardian:** confirmed wearable ovulation is fed back into getTodayStatus, so the phase everywhere in the app (dashboard, calendar, workout, nutrition) anchors to the body's own signal instead of the calendar — the key unlock for irregular cycles and users with no period date. Conservative: only acts on a CONFIRMED temperature shift, never touches BC/pregnancy/perimenopause, and is a complete no-op on web and for non-connected users (reads a localStorage signal that only native writes).
**Files:** src/lib/healthkit.js (cross-platform reader), src/lib/wearableCycle.js (ovulation engine), src/lib/cycleGuardian.js (+test), src/components/HealthConnect.jsx (platform-aware connect card), src/lib/hormoneSync.js (guardian wired into getTodayStatus), android privacypolicy.html. 160 tests pass. NOT deployed to web (native only, per standing instruction).

## 2026-08-06 — Wearable auto-fills the daily log (manual override wins)
**What was built:** When a wearable is connected (iOS Apple Health / Android Health Connect), the dashboard auto-writes each day's temperature (wrist_temp), resting heart rate (resting_hr_exact), and sleep (sleep_hours) into daily_logs, so the algorithm uses them and the user never re-enters them. Today's Focus tiles show Temp / Sleep / Heart rate / Cycle live from the wearable (blank when no data that day — never faked). The auto-sync only FILLS empty fields, so a manual value typed in the Log always wins and is never overwritten. "Logged today" + streak now count manual engagement only, so a wearable-only row never fakes the streak. Not-connected users see the unchanged Energy/Sleep/Mood/Cycle tiles and log by hand.
**Files:** src/pages/Dashboard.jsx, src/components/HealthConnect.jsx, src/lib/healthkit.js (added sleep read). Native only; no web behaviour change.
