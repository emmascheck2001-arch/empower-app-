# Em~power — Change Log

Changes made autonomously from user feedback. Most recent first.

---

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
