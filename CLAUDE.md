> **Developer?** See [empower-react/README.md](empower-react/README.md) for architecture, setup, and how the codebase works. This file contains AI assistant instructions — it is not developer documentation.

# Em~power — Claude Code Instructions

## Project context
Women's hormone-based fitness app. **React + Vite SPA** in `empower-react/`. Supabase JS client loaded via npm (not CDN). All screens are React components (`.jsx`). Build with `npm run build` inside `empower-react/`. Deploy the `dist/` folder to Netlify. The root directory contains legacy HTML files — ignore them, they are NOT deployed.

## Supabase credentials
URL: https://imgujppjvffbubnsscge.supabase.co
Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZ3VqcHBqdmZmYnVibnNzY2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQzNzIsImV4cCI6MjA5NjE4MDM3Mn0.TpjycdiHLl5iI1G8u07mVmStKZWU2fzEsuw1dUi6diU

## Files in this project (React SPA — empower-react/src/)

**Pages (empower-react/src/pages/):**
- Login.jsx — route `/login` — sign in and create account
- Setup.jsx — route `/setup` — onboarding for new users, four paths
- Dashboard.jsx — route `/dashboard` — main home screen showing phase, nutrition card, log streak
- Log.jsx — route `/log` — daily symptom and biometric log
- Workout.jsx — route `/workout` — activity picker, muscle group selector, guided workout player with timers
- Feedback.jsx — route `/feedback` — trial user feedback screen, stores to user_feedback table
- Nutrition.jsx — route `/nutrition` — phase-aware nutrition screen with symptom relief accordion
- Calendar.jsx — route `/calendar` — colour-coded cycle calendar with future day planning

**PERMANENT — Daily Coach & Weekly Insights rules (added 2026-06-29):**
- **Daily Coach** (dashboard, top, above the hero): `lib/dailyCoach.js` `buildDailyCoach(status, hour, name)` is a PURE synthesis of existing getTodayStatus output — invents nothing (no wearable/recovery score we don't have, no fabricated numbers). The dashboard card renders ONLY "Today's Focus" (greeting + focus label/sub + a recovery note that appears ONLY when the user's OWN logs support it — poor sleep / very low energy / heavy disruptors, hedged "may be lower"). `buildDailyCoach` still computes training/nutrition/sleep/mindset (unit-tested, kept for future use) but the card does NOT render them. Pregnancy NEVER gets an auto-prescribed workout.
- **Weekly Insights** (`components/WeeklySummary.jsx`): surfaces on the FIRST APP OPEN once 7+ days have passed since it last appeared, and only with at least `WEEKLY_MIN_LOGS` (4) meaningful logs that week plus real content. Below that threshold the user gets `WeeklyNudgeCard` instead — never a hollow review. It must contain ONLY the user's own logged data — NO generic "many women notice" phase predictions, NO prescribed "experiments", no fabrication. The `weeklyHighlights.js` recap lines ("you trained N days", "energy was highest on <day>", "slept ~X min more than last week") are all factual statements about logged data, comparisons gated on data existing in both weeks, and a peak day is named ONLY when there is a single unique maximum. Never reintroduce population predictions into Weekly Insights.
- Learn.jsx — route `/learn` — science articles and perimenopause education
- Privacy.jsx — route `/privacy` — privacy policy + self-serve account deletion
- Terms.jsx — route `/terms` — Terms of Use (added 2026-06-29; public route). Not-medical-advice/not-a-device, assumption of risk, "as is" pilot, limitation of liability, Saskatchewan/Canada governing law. Linked from the signup form, Setup consent, and Privacy page. Login.jsx now has a real self-serve signup ('signup' mode via supabase.auth.signUp); Setup consent references BOTH Terms and Privacy. Pilot-readiness work for handing the app to strangers.
- Sleep.jsx — route `/sleep` — sleep tracking and guidance
- Ask.jsx — route `/ask` — "Ask Em~power" assistant (added 2026-06-26). One-directional: user asks, app answers. Answers ONLY from (a) the user's own logged data and (b) hand-written, cited content in the topic bank — NO LLM, NO generated medical claims, nothing made up. Red-flag questions (heavy bleeding, severe pain, possible pregnancy, crisis) route to seek-care / 988 before anything else. Unknown questions are NOT guessed — the user is offered a "Send to Em~power" button that inserts into `user_feedback` with `category:'assistant_question', screen:'ask'`. "Read more" links deep-link into Learn via `/learn?article=<id>`. Entry point: a dashboard card. Permanent rules: never let it fabricate, never strip the red-flag routing, keep the unknown→submit path. A future Phase 2 (true conversational AI) would need a Supabase Edge Function calling Claude server-side (key never in the client), per-query cost, and a tighter FDA/safety review.

- VisitPrep.jsx — route `/visit-prep` (added 2026-06-29) — turns the user's OWN tracked data into a doctor-ready summary ("walk in with data" — the antidote to being dismissed; product pillar #4 / appointment prep). READ-ONLY (writes nothing). Pure logic in `lib/visitPrep.js` (`buildVisitSummary` + `summaryToText`, unit-tested in `visitPrep.test.js`). Fetches profile + cycle_data + last 120 daily_logs + user_baselines; renders snapshot (life stage/age/tracking span/cycle), "what I have been tracking" (aggregated symptom/pain/flow/mood/sleep + peri tallies), "patterns worth discussing" (NEUTRAL — NEVER names PCOS/endo/etc., always "not a diagnosis"), questions to ask, tests worth asking about (path-tailored; iron/ferritin surfaced for heavy-flow/low-energy per Burden 2015). "Copy summary" + "Print/PDF". Dashboard entry card (`ti-clipboard-heart`). PERMANENT: keep never-name-a-condition + not-a-diagnosis framing.

**Shared library (empower-react/src/lib/):**
- hormoneSync.js — getTodayStatus shared function, getPhase, getLutealSubPhase, inferPhaseFromSymptoms
- visitPrep.js — buildVisitSummary + summaryToText (pure, tested): compile tracked data into a doctor-ready visit summary for VisitPrep.jsx. Never names a condition; always "not a diagnosis."
- algorithm_v3.js — processAllSignals, getNutritionTargets, getIntensityModifier, PHASE_PREDICTIONS, BRAIN_STATE_STYLES

**Components (empower-react/src/components/):**
- BottomNav.jsx — 5-item nav (most screens) or 6-item nav (dashboard/calendar adds Calendar tab)
- TopBar.jsx — top bar with back button
- Spinner.jsx — loading spinner

**Config:**
- empower-react/public/_redirects — `/* /index.html 200` (required for Netlify SPA routing)
- empower-react/vite.config.js — build config with timestamp in filenames to bust cache
- empower-react/public/manifest.json — PWA manifest

## Database tables
- profiles — id, email, name, user_path, bc_type, bc_stop_date, cycle_length, body_weight_kg, fitness_level, onboarding_complete, diet_preference, birth_year (added 2026-06-26: captured at onboarding for the 13+ age gate and age-aware guidance; year only, never full DOB), ethnicity (added 2026-06-26: optional, self-reported, JSON array of codes for mixed heritage; sensitive data used ONLY to surface ancestry-linked health info in Learn's "Relevant for you" card — additive, never restrictive, never used to assume diet; disclosed in the privacy policy), pregnancy_due_date (added 2026-06-29: date, set only for the pregnancy path; trimester + gestational week computed from it)
- cycle_data — id, user_id, last_period_date, cycle_length, notes
- daily_logs — id, user_id, log_date, energy, symptoms[], workout_feel, mood[], sleep_quality, resting_hr, resting_hr_exact, disruptors[], wrist_temp, temp_deviation, lh_result, hormone_estradiol, hormone_progesterone, hormone_lh, hormone_cortisol, flow_volume, pain_rating, hot_flash_count, night_sweats_severity, joint_pain_rating, joint_pain_location[], brain_fog_rating, sleep_hours (added 2026-06-26: dedicated column for Sleep-screen hours so saving sleep never overwrites the shared `notes` field), stress_level (1-5, added 2026-06-27, in the quick-log view; feeds allostatic load), libido ('Low'/'Normal'/'High', added 2026-06-27, an ovulation-approaching signal in "add more detail"), notes, created_at. Unique constraint on (user_id, log_date).
- mucus_logs — id, user_id, log_date, discharge_type, spotting_type, notes. Unique constraint on (user_id, log_date).
- cycle_summaries — id, user_id, cycle_number, cycle dates, phase lengths, ovulation data
- user_baselines — id, avg_cycle_length, avg_luteal_length, temp_follicular_baseline, rhr_follicular_baseline, pms_days_before, peak_energy_day, cycles_tracked, model_confidence
- user_feedback — id, user_id, user_email, category, screen, description, followup_answer, frustration_rating, priority, status, claude_code_instruction, developer_notes, resolved_at
- friendships — id, requester_id, addressee_id, status ('pending' | 'accepted'). RLS scoped to requester or addressee. Powers the Friends feature.
- friend_visibility — owner-only flags controlling which fields a friend can see (e.g. sleep_quality, workout_feel). RLS owner-only.
- exercise_history (added 2026-06-26) — user_id, exercise, last_weight, last_reps, last_date, updated_at. PK (user_id, exercise). RLS own-rows only. Powers workout progression: the player shows "last time" and nudges progressive overload. Written on gym-workout finish (top working weight per exercise). Included in delete_my_account.

Always use upsert with onConflict: 'user_id,log_date' when saving daily data.

## Database security — friend functions (permanent, never weaken)

Two Postgres functions power the Friends feature. Both are `SECURITY DEFINER` (they bypass RLS), so they MUST re-implement the access check themselves. A June 2026 audit found they did not, exposing every user's name, path, cycle length, and last period date to anyone with an email — no login required. This is now fixed and must never regress:

- **`get_friend_card(target_user_id)`** — returns a friend's phase card. Only returns data if an `accepted` row exists in `friendships` between `auth.uid()` and `target_user_id` (either direction). `EXECUTE` is REVOKEd from `anon`/`PUBLIC` — requires login. Never remove the friendship guard or re-grant anon access.
- **`find_user_by_email(search_email)`** — returns a user's UUID for the add-friend-by-email flow. `EXECUTE` REVOKEd from `anon`/`PUBLIC` — authenticated callers only. Never re-grant anon access (it would become an email-enumeration oracle).
- Both functions, plus `get_claude_instructions`, have a pinned `search_path = public`.
- Rule for any future `SECURITY DEFINER` function: it bypasses RLS, so it must check `auth.uid()` against the data it returns, and `EXECUTE` should never be granted to `anon` unless the data is genuinely public.

**Security state (audited 2026-06-26):** All 10 public tables have RLS enabled with policies scoped to `auth.uid()` — no user can read another's data. The client ships only the anon key (RLS-protected); the service-role key is never in the bundle. Friends is ACTIVE again (re-enabled 2026-06-26), so `EXECUTE` on `find_user_by_email` AND `get_friend_card` is GRANTed to `authenticated` (still REVOKEd from `anon`/`public`). Both functions keep their internal guards (get_friend_card requires an `accepted` friendship between `auth.uid()` and the target; find_user_by_email requires a logged-in caller). Do NOT grant to anon. The dashboard Friends card shows when the user has any accepted friend or pending request, loaded via `get_friend_card`. `get_all_feedback` stays callable by `authenticated` but self-checks Emma's uid (the one remaining advisor WARN is expected/safe).

**`delete_my_account()` (added 2026-06-26):** SECURITY DEFINER, `search_path=public`, EXECUTE granted only to `authenticated`. Deletes the caller's rows from every table (daily_logs, mucus_logs, cycle_data, cycle_summaries, user_baselines[id=uid], user_feedback, friendships, friend_visibility, analytics_events, exercise_history, profiles) then their `auth.users` row, all gated to `auth.uid()` so a user can only ever delete THEIR OWN account. Surfaced as the self-serve "Delete my account and all my data" button on the Privacy page (/privacy), linked from the dashboard footer. If a NEW user-data table is ever added, add its delete to this function so erasure stays complete.

---

## Pregnancy mode (path 6) — PERMANENT RULES (added 2026-06-29)

Onboarding path `user_path === '6'` ("I am pregnant") with a `pregnancy_due_date`. `getTodayStatus` early-exits to `buildPregnancyStatus` (phase `'Pregnancy'`, subPhase = trimester from `getPregnancyWeek`/`getTrimester`, no cycle, prenatal nutrition targets: protein ~1.1 g/kg, +0/+340/+450 kcal by trimester). Dashboard, Workout, Nutrition, and Learn all branch on pregnancy:
- **Dashboard** renders a dedicated pregnancy home (trimester + week, a prominent "When to get care now" safety net, provider-led framing) — never cycle cards.
- **Workout** NEVER auto-prescribes a workout for a pregnant user — it shows general SOGC/ACOG movement guidance + the stop-and-call-your-provider signs + "get cleared by your provider first."
- **Nutrition** shows prenatal nutrition (Health Canada/ACOG): supplements, +calories by trimester, foods to avoid, morning-sickness help.
- **Learn** shows the `PREG_SECTIONS` guide (warning signs, trimesters, safe movement, nutrition, mental health, loss) and hides the cycle articles.

RULES: prenatal content is the HIGHEST-liability content in the app. It must (1) trace to SOGC 2019 / ACOG 804 / Health Canada prenatal guidelines / CDC-ACOG urgent maternal warning signs (all cited in-app), (2) stay conservative and defer to her doctor/midwife everywhere, (3) NEVER auto-prescribe prenatal exercise, (4) always surface the warning-signs safety net. **Before this feature is relied on by the public, an OB/midwife/prenatal-fitness professional should review it** — flag this to Emma whenever pregnancy content is touched. Pregnancy-loss content must stay gentle and emphasise it is almost never the mother's fault (Quenby 2021). 988 crisis line in the mental-health content.

## Behaviour rules — follow these exactly
- Never ask clarifying questions. Make a reasonable decision and state what you chose.
- Never rewrite a whole file unless the task explicitly says to. Edit only what needs changing.
- Never stop between tasks waiting for approval. Work continuously without pausing.
- After each fix reply with exactly one line: DONE — what you changed in one sentence.
- If something cannot be done explain why in one sentence then move on.
- Write the minimum code needed. Do not refactor unrelated code.
- Always verify your change is syntactically correct before moving on.
- Use the existing code style — same variable naming, same indentation, same Supabase client pattern already in the files.

---

## Current file inventory — permanent record of all design decisions

This section documents every design decision, UI pattern, field option, and content choice across every file, exactly as implemented. Update this when changes are made. Never revert without updating this record.

---

### GENERAL DESIGN SYSTEM — applies to every file

**Colour palette (never change these values):**
- Background: `#faf8f5`
- Panel / top-bar: `#f5f0e8`
- Border: `#ede8e0`
- Dark text and primary buttons: `#2c2820`
- Primary button hover: `#3d3830`
- Accent / highlight: `#c8b89a`
- Muted text: `#7a7268`
- Very muted / labels: `#9a9590`
- Selected-soft state: background `#e8dfd0`, border `#c8b89a`, text `#5a4a3a`
- Disabled buttons: `#c8c0b8`

**Typography:**
- Body font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Serif / italics (section titles, hero text, player exercise name): `Georgia, serif`, italic
- Logo / wordmark: `font-size:13px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase`
- Section labels (all-caps micro labels): `font-size:11px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#9a9590`

**Icons:** Tabler Icons webfont only. Class pattern: `ti ti-[name]`. CDN: `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css`

**Layout:** `max-width:420px; margin:0 auto` on every screen. `padding-bottom:100px` on body to clear fixed bottom nav.

**Card patterns:**
- Main cards: `background:#fff; border:1px solid #ede8e0; border-radius:14px; padding:16px`
- Inner elements: `border-radius:12px` (medium), `border-radius:10px` (small)
- Spacing: 16px page margins, 10-12px card gaps

**Spinner:** Use `<Spinner />` from `../components/Spinner.jsx`. Import and render it while loading. Always show spinner on load, hide when Supabase data returns. Never show a blank screen. The `Spinner` component uses inline styles matching the design system.

**Button states:**
- Primary CTA: `background:#2c2820; color:#f5f0e8; border:none; border-radius:12px; padding:16px; font-size:15px; font-weight:500`
- Single-select option: `.selected-soft` class applied via JS — `background:#e8dfd0; color:#5a4a3a; border-color:#c8b89a; font-weight:500`
- Multi-select: same `.selected-soft` class, toggled on/off

**Toggle switches (core finisher, etc.):** `width:44px; height:26px; border-radius:13px; background:#d8d0c8` off / `#2c2820` on. Thumb: `width:20px; height:20px; top:3px; left:3px`. On: `transform:translateX(18px)`.

**Bottom navigation — 5 items (most screens):**
Home (`ti ti-home`, `/dashboard`) / Workout (`ti ti-barbell`, `/workout`) / Log (`ti ti-pencil`, `/log`) / Nutrition (`ti ti-salad`, `/nutrition`) / Learn (`ti ti-book-2`, `/learn`)
Active item: icon and text both `color:#2c2820`. Inactive: `#9a9590`.
Dashboard and Calendar use a 6-item nav adding Calendar (`ti ti-calendar`, `/calendar`) between Workout and Log. Implemented in `BottomNav.jsx` — `isDashboard` prop controls the 6-item variant.

**Top bar pattern:** `background:#f5f0e8; padding:16px 20px; border-bottom:1px solid #ede8e0; display:flex; align-items:center; gap:12px`. Back button: `ti ti-arrow-left`, `font-size:20px`.

**PWA:** Configured in `empower-react/index.html` (manifest, apple-mobile-web-app tags, theme-color). Service worker registered via `<script>` in `index.html`. SW file is `empower-react/public/sw.js`. SPA routing requires `empower-react/public/_redirects` containing `/* /index.html 200` — never remove this file.

**Auth guard:** Handled centrally by `<AuthGuard>` in `App.jsx` using `supabase.auth.onAuthStateChange`. Individual pages call `supabase.auth.getUser()` in `useEffect` and redirect with `navigate('/login', { replace: true })` if no user. Never use `window.location.href` in React components.

---

### Log.jsx — routes /log and /checkin — the daily log

One merged screen: quick questions first, then a collapsed "Optional details". `/checkin` routes
here too — there is no separate check-in screen.

**Quick view (in order):** cervical fluid (non-menstrual) · temperature ONLY when the wearable
pre-filled it · resting heart rate · symptoms · mood · energy · sleep · stress. Flow and pain appear
during the period, when they matter most.

**Optional details (collapsed):** workout feel · disruptors · notes · manual temperature (when the
wearable did not fill it) · LH ovulation strip · hormone lab results (estradiol, progesterone, LH,
cortisol) with `interpretHormones` output.

**Why LH and manual temperature are NOT in the quick view:** zero uptake across all 184 real logs.
See the retention rules above — do not move them back.

**Acute red-flag safety net:** very heavy/heavy flow OR pain >= 4 shows the "When to seek care
today" card. Never gate this behind a toggle or remove it.

**CrisisSupport** renders on any low-mood/sad log. Keep it reachable.
### Dashboard.jsx — route /dashboard — Main home screen

Hero card (phase, cycle day, personalisation, next-period prediction) followed by cards that each
self-gate on whether the user has the data to justify them. Cards render only when they have
something real to say — never show a hollow card.

**Phase sheet content rules — permanent.** The phase copy lives in `lib/phaseInfo.js`
(`PHASE_SHEET_INFO`), which carries these rules in its own header comment: NO hormone numbers
(pmol/L, nmol/L, IU/L) in `bullets`, `direction`, or `patterns` — plain English only; `bullets` is a
4-item "what is happening" list; any numbers added later belong behind a reference-range disclosure.
Keep the hedged wording ("generally", "often", "may") — it was deliberately softened away from
absolute claims.

**Path 4 (perimenopause) rules — permanent:**
- The PCOS pattern flag and the endometriosis pain flag must BOTH stay guarded by
  `user_path !== '4'`. Irregular cycles and joint pain are expected in perimenopause, so these flags
  would be actively misleading there.
- The hero uses `subPhase` for Path 4, so a "Menopause 12+ months" user reads "Postmenopause".

**Late-period pathway:** `buildCycleStatus` exposes `latePeriod`/`daysLate`; the dashboard shows the
late-period + pregnancy-test card at 2+ days late. Never let a late user keep seeing "period in 0 days".
### Workout.jsx — route /workout — Activity picker and workout player

Activity picker (walk / run / cycle / swim / gym / yoga / pilates / HIIT / rest day), a gym focus
picker, then a guided player with timers. Yoga uses `ti ti-leaf` — `ti-yoga` does not exist in the
Tabler webfont.

**Gym focus options — permanent:** Full body / Upper body / Lower body as three full-width cards,
plus a visually secondary Custom card that expands a 10-checkbox muscle grid (chest, back,
shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core). The core-finisher toggle shows
for the three preset splits only; when Custom is selected, Core is a checkbox instead.

**Warnings that must survive:** the ovulatory ACL/warm-up card (Herzberg 2017), the luteal HIIT
stress-response card (Hackney 2006), and the observation-mode baseline card.

**Pregnancy NEVER gets an auto-prescribed workout** — see the pregnancy rules above.

**Progression:** `exercise_history` powers the player's "last time" hint and the progressive-overload
nudge. Keep persisting the top working weight on gym finish.
### Nutrition.jsx — route /nutrition — Phase-aware nutrition screen

**Top bar:** Back arrow (`ti ti-arrow-left`, navigates to `/dashboard`) + "NUTRITION" wordmark + phase chip (uppercase, amber background `#f5e6c8`, text `#6a4a10`).

**Phase banner:** Full-width dark card with phase-specific gradient background. Fields: small label / phase name (italic serif) / desc / science citation.
Phase gradients: Menstrual `135deg, #3d2830, #2c1f25` / Follicular `135deg, #2c3828, #1f2c20` / Ovulatory `135deg, #2c3035, #1f252c` / Luteal `135deg, #352c20, #2c2415` / Perimenopause `135deg, #2c2030, #201828` / observation `135deg, #2c2820, #1f1e18`

**Profile stats bar:** Always visible (not conditional). Shows weight (kg) + fitness level. "Update" link navigates to `/setup`. If weight or fitness not set, shows "Not set" in muted text.

**Targets card:** 2-column — protein (g) / extra kcal (+prefix, shown as 0 when not applicable). Vegan users: protein multiplied by 1.15 (Source: Rogerson, D. (2017). Vegan diets. *Journal of the International Society of Sports Nutrition*, *14*, 36). Citation row below in muted italic.

**Diet preference feature — permanent, never remove:**
- 7 diet options stored as single-select chips in an "Update" bottom sheet: No preference / Vegetarian / Vegan / Pescatarian / Anti-inflammatory / Gluten-free / Dairy-free
- Saved to `diet_preference` column in `profiles` table (text)
- When a diet is active, phase foods are replaced with `DIET_FOODS[activeDiet][phaseKey]` arrays. Fallback chain: phase-specific → observation → default phase foods
- Vegan: protein target multiplied by 1.15 (`isVegan` flag, `displayProtein = Math.round(targets.proteinG * 1.15)`)
- Phase key mapping for diet lookup: Early/Mid/Late luteal all map to `'Luteal'`; Perimenopause maps to `'Perimenopause'`
- Diet chip row in Update sheet: flex-wrap, single-select toggle. "No preference" deselects all others.
- `DIET_FOODS` object covers: Vegetarian / Vegan / Pescatarian / Anti-inflammatory / Gluten-free / Dairy-free × Menstrual / Follicular / Ovulatory / Luteal / Perimenopause / observation

**2 tabs:** Phase foods (default active) / Symptom relief

**Phase foods tab:**
- Section label (phase-specific)
- 2-column food card grid (6 cards per phase): emoji icon + food name + why
- Avoid card: `background:#fdf5f0; border:1px solid #f0d8cc`. Red-tinted. List of avoid items with reasons.
- Carb cravings note (menstrual phase only): `background:#fff4f0; border:1px solid #e8cfc8`. "Why carbohydrate cravings are real right now." Source: Mauvais-Jarvis et al. *Journal of Clinical Investigation*. 2013.

**Symptom relief tab — 5 accordion cards (exact order):**
1. Cramping — subtitle "Period cramps and pelvic pain" — 4 remedies: Salmon and sardines / Pumpkin seeds and dark chocolate / Ginger / Walnuts and flaxseed. Avoid: trans fats / excess alcohol / tea and coffee with iron-rich meals / high-sodium foods.
2. Bloating — subtitle "Luteal-phase digestive changes" — 4 remedies: Probiotic foods / Cooked vegetables / Fennel / Increase water intake. Avoid: high-sodium foods / carbonated drinks / alcohol / raw brassicas / sugar alcohols.
3. Brain fog — subtitle "Focus, concentration, and energy" — 4 remedies: Iron-rich foods / Salmon, sardines, or walnuts / Complex carbohydrates / Eggs and leafy greens. Avoid: ultra-processed foods / excess alcohol / skipping meals.
4. PMS and mood — subtitle "Late luteal phase support" — 4 remedies: Calcium and vitamin D / Magnesium-rich foods / Vitamin B6 / Complex carbohydrates. Avoid: alcohol / refined sugar / high-sodium foods / excess caffeine.
5. Fatigue and low energy — subtitle "Especially during and after your period" — 3 remedies: Red meat / Lentils, spinach, or tofu with vitamin C / B12-rich foods. Avoid: black tea or coffee with iron-rich meals / large dairy portions at the same meal.

**Accordion CSS:** `.symptom-card.open .symptom-chevron { transform:rotate(180deg); }`. Body hidden by default, shown when `.open` class applied.

**APA references block:** All citations at the bottom of the component in a `APA_REFS` array rendered as a references section. APA 7 format mandatory.

**Disclaimer at bottom:** Medical disclaimer, not advice, consult a professional.

**Bottom nav:** 5 items, Nutrition active.

**Phase-specific food data (`PHASE_DATA`):** All phases (Menstrual/Follicular/Ovulatory/Luteal/Perimenopause/observation) have: gradientStyle / desc / science / sectionLabel / foods[] / avoid[]. Each food has: icon (emoji) / name / why. No inline source per food — citations handled by APA_REFS block.

**Language rules for this screen (permanent):** "Salmon and sardines" not "oily fish". "Plant-based omega-3" not "ALA". "Omega-3" not "EPA/DHA". "Period cramps" not "Dysmenorrhea" in UI text. "Iron from red meat" not "haem iron". "Plant-based iron" not "non-haem iron". See the clinical language ban table in GENERAL CODE RULES.

---

### Setup.jsx — route /setup — Onboarding

**Welcome text (exact):** "You have probably been dismissed before. Maybe your pain was called normal. Maybe your symptoms were called anxiety. Maybe you were told to come back if it got worse. Em~power is not that. Your body sends signals every single day. This app learns to read them and takes every single one seriously."

**Two info cards below welcome:**
- "Your cycle is a vital sign" (warm background `#f5f0e8`)
- "Built on research about women" (white background)

**Path options — display order and database IDs do NOT match. Never change the IDs.** Paths 1 to 5 are below; path 6 (pregnancy) is documented in the pregnancy rules above.

| Display order | `user_path` in DB | Label | Icon |
|---|---|---|---|
| 1 | `'1'` | I know my last period date | `ti-calendar` |
| 2 | `'5'` | I am currently on birth control | `ti-pill` |
| 3 | `'2'` | I just came off birth control | `ti-pill-off` |
| 4 | `'3'` | My cycles are irregular or I am not sure | `ti-wave-sine` |
| 5 | `'4'` | I am in perimenopause or menopause | `ti-heart` |

**Path 1 panel (`user_path='1'`):** Date input (last period) + cycle length input (21-45, default 28) + preset buttons (24 / 28 default / 30 / 32 / 35) + live phase preview box showing cycle day / days until period / current phase.

**Path 5 panel (`user_path='5'`, currently on BC):** BC type selector using `BC_TYPES_CURRENT` array (values: pill / minipill / patch / ring / hormonal-iud / copper-iud / implant / depo). Optional last period/withdrawal bleed date input + cycle length presets. Saves `bc_type` to profiles.

**Path 2 panel (`user_path='2'`, just came off BC):** BC type selector using `BC_TYPES` string array (Combined pill / Mini pill / Patch / Vaginal ring / Hormonal IUD / Copper IUD / Implant / Depo-Provera injection / Not sure). Optional stop date input — "When did you stop?" — saves to `bc_stop_date` in profiles. `bc_stop_date` is only saved when path === 2 and a date is entered.

**Path 3 panel (`user_path='3'`, irregular/unsure):** No extra fields. User continues straight to body stats.

**Path 4 panel (`user_path='4'`, perimenopause/menopause):** Stage selector: Early perimenopause / Late perimenopause / Menopause 12+ months. Saved to `bc_type` column (repurposed for stage). Stage required to continue.

**Body stats overlay (bottom sheet, appears after path selection):**
- Body weight: number input + kg/lbs unit toggle
- Height: number input + cm/ft-in toggle
- Fitness level: 3 cards (Beginner / Intermediate / Advanced) each with title + description
- Skip link below form

**Next bar:** Fixed bottom bar, button disabled until option selected. Text changes from "Select an option above to continue" to the path-specific action.

---

### Feedback.jsx — route /feedback — User feedback

**Hero card (dark):** "You are building this app." / "Every piece of feedback goes directly to the developer and shapes what gets fixed next."

**Step 1 — 6 category buttons (2-column grid):**
1. Something is broken (🔧) — "Error, crash, or not working"
2. Something is confusing (🤔) — "Hard to understand or use"
3. Something is missing (✨) — "Feature or content I want"
4. Something seems wrong (📋) — "Data, science, or recommendations"
5. I love something (❤️) — "What is working well"
6. General feedback (💬) — "Anything else"

**Step 2 — Screen selector (2-column grid, 5 items):**
Dashboard / Daily log / Workout / Morning check-in / General or other
Icons: ti ti-home / ti ti-pencil / ti ti-barbell / ti ti-sun / ti ti-apps

**Step 3 — Description textarea:** Placeholder: "Describe what happened, what you expected, or what you want..."

**Step 4 — Smart follow-up question (category-specific multiple choice options):**
- something_broken: "What happened when it broke?" — 6 options (blank screen / error message / button did nothing / saved but disappeared / wrong screen / crashed)
- confusing: "What specifically confused you?" — 6 options
- missing: "What type of thing is missing?" — 6 options
- wrong: "What type of issue did you notice?" — 6 options
- love: "What made it feel good?" — 6 options
- other: "What is the nature of your feedback?" — options

**Step 5 — Frustration rating:** 5 emoji buttons — 😌 😊 😐 😕 😤. Labels: "Not at all" / "Very frustrated".

**Submit button:** Disabled by default. Text: "Tell me what you want fixed first".

**Success screen:** 🌿 icon / "Feedback received." / "Emma has been notified and will review this..." + 3 summary cards (category / feedback / follow-up if answered) + "Back to dashboard" button.

**Saves to `user_feedback` table:** user_id, user_email, category, screen, description, followup_answer, frustration_rating. Status defaults to 'pending'.

---

### Calendar.jsx — route /calendar — Cycle calendar

Month grid with phase-tinted cells, a period banner, a phase legend, and bottom sheets for past and
future days. Path 4 (`profile.user_path === '4'`) colours cells by symptom burden instead of phase.

**Phase colour constants (`PC` in Calendar.jsx) — exact values, never change:**
- Menstrual: dot `#e09898` · Follicular: dot `#88c088` · Ovulatory: dot `#88c0e0`
- Early luteal `#f2df85` (lightest) -> Mid luteal `#e6c447` -> Late luteal `#cf9e18` (deepest gold)
- **(Emma, 2026-08-06):** luteal is a light-to-dark YELLOW gradient. NO salmon/brown. The old salmon
  late-luteal read as menstrual red and made pre-period days look like the period had started. Only
  real menstrual days are pink/red. Never reintroduce a reddish luteal shade.

**Fertile-window card** lives in the future-day sheet, gated on `hasPhaseData` (so hormonal-BC and
Path 4 users never see it) and always carries the awareness-only disclaimer. See the FDA rule below.

---

### GENERAL CODE RULES — permanent

**No dashes in user-facing text:** Remove em dashes and en dashes from any copy a user reads (JSX text, labels, card content). Use "to" for ranges, commas for parenthetical breaks. Code comments and citation strings are exempt.

**Clinical language is permanently banned from user-facing text — never revert these decisions:**

The following clinical terms have been replaced everywhere in the app. Never reintroduce them:

| Banned term | Use instead |
|---|---|
| Allopregnanolone | "a calming compound that works on the same receptors as anti-anxiety medication" or "converts in the brain into a calming compound" |
| GABA-A receptors / GABA receptors | remove entirely, or describe as "the same receptors as anti-anxiety medication" |
| GABA withdrawal | "the calming effect it was providing disappears" |
| Glucocorticoid receptors | "stress hormone system" |
| Protein catabolism | "your body breaks down muscle protein faster" |
| HPA axis | remove entirely |
| Dysmenorrhea | "period cramps" (in UI text; APA reference titles are exempt) |
| Prostaglandins | ALLOWED (Emma, 2026-06-24): keep the term, but the sentence must explain it, e.g. "prostaglandins, the pain-causing hormones behind cramps." Do not strip it to plain language. This relaxation applies to genuine scientific terms in general: keep them if the sentence makes them understandable. |
| Haem iron / Non-haem iron | "iron from red meat" / "plant-based iron" |
| Oily fish | specific fish names: "salmon and sardines" or "salmon, sardines, or mackerel" |
| ALA omega-3 / EPA/DHA | "plant-based omega-3" / "omega-3" |
| Sulforaphane | describe naturally, e.g. "a compound that supports estrogen metabolism" |
| DIM (diindolylmethane) | "a compound that supports estrogen metabolism" |
| Functional iron deficiency | simplified natural language |
| GnRH | "the hormone signal that tells your ovaries to function" |
| GnRH analogues | "medications that temporarily suppress ovarian hormone production" |
| Anabolic effect | "muscle-building boost" |
| Neurochemical basis for | simplified natural language |
| Arachidonic acid | simplified: describe the mechanism plainly |
| COX-2 enzymes | simplified natural language |

**APA 7 format is mandatory for all citations:** Author, A. A. (Year). Title. *Journal*, *Volume*(Issue), pages. Never use informal citation styles. "Dysmenorrhea" in APA reference titles is correct — cite exact titles. Only simplify clinical terms in user-facing UI text, not in citation strings.

**PCOS and endometriosis are never named in pattern flags:** Pattern flags for irregular cycles or pain always use neutral language about the pattern and suggest speaking to a doctor. Never name PCOS, endometriosis, adenomyosis, or fibroids in flag text. This is a permanent legal and clinical safety rule.

**After every session — build and deploy to production:** Run from `empower-react/`:
```
npm run build && netlify deploy --dir dist --site 11d125ac-cd81-4060-8dc1-2b6b580265ed --prod
```
Or from the project root:
```
cd "/Users/emmascheck/Developer/hormone app/empower-react" && npm run build && netlify deploy --dir dist --site 11d125ac-cd81-4060-8dc1-2b6b580265ed --prod
```
Always pass `--site 11d125ac-cd81-4060-8dc1-2b6b580265ed` explicitly. Production site is https://empowerhealth.netlify.app. empowerhealth.com is a different company and is NOT this app. The `www/` and `ios/` directories in the repo root are legacy — do NOT sync changes to them.

**Tabler icons only:** Never use emoji as icons where a ti class exists. Emoji only where no tabler icon equivalent exists (e.g. 🧘‍♀️ for yoga, 🌿 for complete screen).

**Georgia serif italic used for:** Phase names in banners (workout, dashboard, nutrition), exercise names in player, hero titles in feedback/success screens, section headers in setup.

**Supabase import:** Always `import { supabase } from '../lib/supabase'` in React components. The client is initialised once in `empower-react/src/lib/supabase.js`. Never use the CDN ESM import — the project uses npm.

**getTodayStatus:** Always imported from `./hormoneSync.js`. Never re-implemented in any screen. Returns: phase, subPhase, cycleDay, cycleLen, daysUntilPeriod, confidence, confidenceLabel, confidencePct, intensityModifier, intensityLabel, nutritionTargets, immediateFeedback, anomalies, predictions, symptomInference, moodInsight, bodyWeight, profile.

**Path 4 early exit in getTodayStatus — permanent rule:** The very first thing getTodayStatus does after loading data is check `profile?.user_path === '4'`. If true it immediately returns a perimenopause status object with `phase: 'Perimenopause'` and skips ALL cycle phase calculations. This is critical — Path 4 users may have a `last_period_date` in cycle_data from before they chose Path 4, and without this guard they would receive regular cycle phase calculations. NEVER remove this early exit. The perimenopause return object includes: perimenopause nutrition targets (1.8g/kg protein), intensity modifier 0.82, perimenopause-specific anomaly detection (fatigue and sleep patterns, not cycle patterns), empty predictions array, and the stage label (Early perimenopause / Late perimenopause / Postmenopause) as subPhase.

**Hormonal birth control — steady state, NEVER fake cycle phases (permanent rule, added 2026-06-21):** In getTodayStatus, hormonal BC (`user_path === '5'` and `bc_type !== 'copper-iud'`) ALWAYS returns `buildPath5Status` (a steady BC baseline with `phase: 'bc-combined' | 'bc-progestin'`, `cycleDay: null`, no predictions), regardless of whether a `last_period_date`/withdrawal-bleed date exists. Combined pills/patch/ring (and Depo, implant, hormonal IUD) suppress ovulation and hold the body's own estrogen and progesterone low and flat, so there are NO follicular/ovulatory/luteal phases — showing rotating phases to these users is medically inaccurate and a credibility risk (a knowledgeable tester immediately flagged it). Do NOT reintroduce phase estimation for hormonal BC (the old `bcEstimate` flag was removed). Dashboard mirrors this: `else if (isHormonalBC && status)` routes them to the steady `phase === 'bc'` branch (still predicts the next withdrawal bleed from a logged bleed date, which is accurate because the pill pack repeats on a fixed schedule). The copper IUD is non-hormonal and keeps a natural cycle, so it always uses the normal cycle path. Calendar excludes hormonal BC from `hasPhaseData` and shows a steady-state note instead of phase colours.

**getNutritionTargets — Perimenopause key:** `targets.Perimenopause` exists with multiplier 1.8, extra 0, focus on protein and bone protection. Never remove this key.

**getNutritionTargets is the SINGLE source of truth for protein (permanent, added 2026-06-23):** Protein multipliers — Menstrual 1.5, Follicular 1.7, Ovulatory 1.8, Luteal 2.0 (with +250 kcal), observation 1.6, bc-combined 1.6, bc-progestin 1.7, Perimenopause 1.8 (all within ISSN 2023 ranges; luteal cited 1.8 to 2.2). The vegan +15% (Rogerson 2017) is baked in here via the `dietPreference` arg, NOT re-applied in the UI. Every screen must read `status.nutritionTargets.proteinG` — Dashboard no longer has its own `PROTEIN_MULT` table and Nutrition no longer re-multiplies for vegan. Do NOT reintroduce a second protein calculation anywhere; it caused the dashboard and nutrition page to show different numbers.

**getIntensityModifier — Perimenopause:** Returns 0.82. Added before the observation fallback. Never remove.

**detectAnomalies — Path 4 guard:** If `flagStats?.userPath === '4'`, runs perimenopause-specific checks (persistent low energy, repeated poor sleep) and returns early — skips all cycle-based anomaly logic. Never remove this guard.

**algorithm_v3.js PHASE_PREDICTIONS — Perimenopause key:** Exists with brain_state 'Fluctuating estrogen', training and nutrition guidance specific to perimenopause. Never remove.

**getMoodContextFeedback — perimenopause branch:** Checks `phase === 'Perimenopause'` FIRST, before all cycle-based branches. Returns estrogen-variability framing for low mood, estrogen-surge framing for high energy. Never move this branch below the cycle-based branches.

**Podcast sources:** Never reference any podcast (including Diary of a CEO) in user-visible text. All science claims must cite peer-reviewed sources by name.

**Fertility window is AWARENESS-ONLY — never contraceptive guidance (PERMANENT, FDA line, added 2026-08-05):** The app may show fertility *information* (estimated fertile window, ovulation estimate, "days you are most likely to conceive") but must NEVER give contraceptive *instructions*. Absolutely no "safe/unsafe to have unprotected sex", no green/red "safe day" framing, no language a user could act on to prevent pregnancy. Telling a user it is safe to skip protection is a contraceptive claim that makes the app a Class II medical device requiring FDA 510(k) clearance (the bar Natural Cycles had to clear) — doing it without clearance is both a regulatory violation and a real unplanned-pregnancy harm risk (predictions are wrong; sperm survive ~5 days; irregular cycles). EVERY place the fertile window appears must carry the "this is an estimate for awareness, not birth control … use a proven contraceptive method and talk to your doctor" disclaimer. The fertile-window card lives in `Calendar.jsx` (future-day sheet), is gated on `hasPhaseData` (so hormonal-BC and Path 4 users never see it), and computes the window as ovulation (cycleLen−14) minus 5 days through +1. Never soften the disclaimer or add safe-day language, even if asked to make it "more useful".

---

## Retention system — PERMANENT RULES (added 2026-08-20)

Ten weeks of real pilot data showed the app had no way to bring anyone back: 11 of 21 real users
never logged a single day, only one user ever sustained use, and every dormant user who returned
did so because Emma personally messaged them. These changes are the product-side answer. Do not
quietly remove them.

**`lib/notifications.js` — local notifications, the only return trigger the app has.**
- LOCAL only (`@capacitor/local-notifications`). There is no push server and no device token, so
  no cycle data ever leaves the phone in order to schedule a reminder. Never replace this with a
  remote push service without a privacy review — cycle data is the most sensitive thing here.
- Native only; every function no-ops on web so the PWA build is unaffected.
- Fixed notification ids (`DAILY_REMINDER_ID`, `PHASE_IDS`) so re-scheduling REPLACES rather than
  stacks. Phase alerts are cancelled and rebuilt on every dashboard load because `daysUntilPeriod`
  moves as she logs. Never schedule phase alerts once at opt-in and leave them.
- `buildPhaseNotifications` is pure and unit-tested (`lib/notifications.test.js`). Cycle-timed
  alerts are gated on `cycleDay`/`cycleLen`/`daysUntilPeriod` all being non-null, which is exactly
  how hormonal-BC, Path 4, and pregnancy users are excluded — they get no cycle notifications.
- **The fertile-window notification is awareness-only and must stay that way.** It carries "this is
  an estimate for awareness, not birth control" in the body text, and a test asserts no
  safe-day/unprotected-sex wording appears in ANY notification. This is the same permanent FDA line
  as the fertile-window card; a notification is if anything MORE actionable, so never soften it.

**`components/ReminderSettings.jsx` — the opt-in surface.** Renders on native only. Appears both on
the dashboard and as the final onboarding step. Once the OS permission is `denied` it stops asking;
"Not now" on the dashboard card is remembered. Never make reminders default-on without an explicit
permission grant.

**Onboarding now ends with the two passive-value asks (`Setup.jsx`).** After the profile saves, a
native user gets a final step offering the wearable connection (`HealthConnect`) and reminders
before reaching the dashboard. Rationale: both were previously only reachable from the dashboard,
so only already-engaged users ever found them, and the wearable is what keeps the app learning on
days she does not open it. The web flow is unchanged and goes straight to the dashboard.

**Never lead with a low personalisation percentage.** `nextPersonalisationMilestone` in
`hormoneSync.js` is the required framing everywhere the personalisation number used to headline
(Log save overlay, Checkin). Emma's own pilot feedback, frustration 4/5: "I been stuck in
observation mode for the past week and my algorithm says it's only at 5%." A low number tells a new
user the app does not understand her, on the exact screen meant to convince her to stay. Show the
next unlock and what it costs instead; the percentage may remain as secondary text. Every milestone
must map to a REAL gate in the code (3 meaningful logs -> symptom-based phase estimate; 1 cycle ->
period prediction; 2 cycles -> personal baseline). Never invent a milestone the code does not honour.

**Weekly review stays gated at `WEEKLY_MIN_LOGS` (4) — do not lower it.** Emma's rule, and correct:
a hollow insight built from one log is worse than silence. Low-log users instead get
`WeeklyNudgeCard`, which states only facts about their own data ("you logged 2 days this week, 2
more and your weekly review unlocks"). That keeps the no-fabrication rule intact while still giving
a disengaged user a reason to return. Never turn the nudge into a fabricated mini-review.

**Manual clinical entry has zero uptake — do not put it back in the quick log.** Across all 184
real logs: `lh_result` 0, `hormone_lh`/`hormone_progesterone`/`hormone_estradiol` 0, `wrist_temp` 0.
The only non-null LH values were 19 "No test" opt-outs, i.e. pure friction with no data yield. LH
strips and the hormone labs now live under "Optional details"; manual temperature shows inline ONLY
when the wearable pre-filled it (then the job is correcting a value, not entering one). The columns
and `interpretHormones` are untouched, so nothing became dead capture. The lesson generalises:
passive wearable capture, not manual clinical entry, is how these signals get collected.

---

## Product development mindset — apply this to every task

You are not just executing a task list. You are the lead developer of a women's health app that real women will use to understand their bodies. Your job is done when the app is genuinely excellent — not when a list is complete.

This app exists because almost everything women have been told about exercise and nutrition was researched on men and generalised to women. Women were not required to be included in medical research studies until 1993. Less than 1% of research funding goes to women over 40. Em~power is built entirely on research conducted on women. Every word in this app must reflect that commitment.

### The core philosophy — apply to every piece of content
- Women are not small men. Their physiology differs down to the cellular level.
- There is no universal normal for women's hormones. Population averages are built from research that often excluded women. Personal pattern over time is the only meaningful benchmark.
- The menstrual cycle is a vital sign — not just a reproductive function. It reflects bone health, brain health, cardiovascular health, and metabolic health.
- Women have been systematically dismissed by the medical system. This app never dismisses. Every symptom a user logs is real.
- Never replicate medical gaslighting. Remove any language that minimises symptoms.

### Continuous quality loop — run this after every change

1. Open every HTML file in a mental browser simulation. Does it load without errors? Does it make sense to a first-time user? Is anything confusing, broken, or missing?

2. Check every user flow end to end:
   - New user: login → setup → dashboard → log → mucus → dashboard
   - Returning user: dashboard → workout → complete → nutrition card
   - Any broken step — fix immediately without being asked

3. After every file edit ask: did this change break anything else?

4. Look for anything a real user would find confusing, frustrating, or incomplete. Fix it.

### Things to fix automatically without being asked

- Any JavaScript error that would appear in the browser console
- Any broken link between screens
- Any button that does not do what it says
- Any screen that shows blank or loading forever
- Any text truncated or unreadable on a 390px mobile screen
- Any form that does not save correctly
- Any screen missing a loading state or error state
- Any duplicate code doing the same thing in two files
- Any hardcoded value that should come from the database
- Any science claim without a citation — add SOURCE NEEDED comment
- Any weight suggestion missing from the WEIGHTS dictionary
- Any exercise missing a description
- Any phase guidance contradicting the research in this file
- Any mobile layout issue — perfect on 390px iPhone at all times
- Any muscle group combination that does not reflect real gym training
- Any language that minimises or dismisses symptoms — rewrite it
- Any hormone reference range shown without the personal variation caveat
- Any content sourced only from a podcast without peer-reviewed verification
- Any time you write health-related content — stop and ask: what peer-reviewed research supports this? If none exists write SOURCE NEEDED.

### Full audit — run after every session

**Code quality:** No console errors, no undefined variables, no async missing await, all Supabase calls in try-catch, all upserts use onConflict, no duplicate phase logic.

**UX:** Stranger can use in 60 seconds, every button labelled, no dead ends, all back buttons work, works with no data and with 30 days of data, works on slow connection.

**Science:** Every claim cited, no absolute language, no medical diagnostic language, all hormone ranges cite LifeLabs/EORLA or Münster 2021, all hormone ranges include personal variation caveat, all protein targets cite ISSN 2023, all weight suggestions cite strength standards, every claim cross-referenced against two peer-reviewed sources, no podcast-only claims.

**Visual:** Polished on 390px, no overflow, consistent spacing 16px margins 12px gaps, consistent colours, all icons loading, no placeholder text.

**Data:** Test account logs 7 days, all data saves correctly, phase correct, workout matches phase, nutrition uses correct bodyweight, mucus links correctly, persists after logout.

### After audit fix everything found. Run audit again. Repeat until zero issues.

### Think like a product manager
- Clinical or confusing language → rewrite warm, clear, human
- User action with no visible response → add feedback
- Data exists but not shown → surface it
- Woman might feel judged, scared, or confused → reframe it
- Science buried in footnote → bring it forward
- Woman has been dismissed before → make her feel seen

---

## Research rules — accuracy is everything

Every claim about hormones, exercise, nutrition, or physiology must be traceable to a peer-reviewed source. This is a health app. Being wrong causes real harm.

### Rule 1 — Never invent a claim
No peer-reviewed source = do not write the claim. Write SOURCE NEEDED.

### Rule 2 — Use the Research Foundation first
Check the Research Foundation below before writing any science claim. Cite by name: "Kissow et al. 2022 Sports Medicine" not "research suggests."

### Rule 3 — Search before writing new claims
If no listed study covers a topic, search training knowledge for a peer-reviewed source. If found, cite it and add it to Research Foundation. If not confident, write SOURCE NEEDED.

### Rule 4 — Precise language only
- "estrogen may improve muscle protein synthesis" NOT "estrogen will make you stronger"
- "high intensity exercise may create a larger stress response in the luteal phase" NOT "you cannot do HIIT in the luteal phase"
- "progesterone fluctuation is associated with PMS symptoms" NOT "progesterone causes PMS"
- Always "may" not "will" for phase-specific training claims (Colenso-Semple 2023)
- Always acknowledge individual variation

### Rule 5 — Confirmed science vs wellness claims
- "Research shows" — strong peer-reviewed backing only
- "Many women find" or "This may help" — wellness recommendations without specific citations

### Rule 6 — Hormone reference ranges
Always cite LifeLabs/EORLA or Münster 2021. Always add: "This is a population average. Your personal normal may be different. What matters most is your pattern across multiple cycles, not a single value against a population average."

### Rule 7 — Nutrition targets
Cite ISSN 2023. Luteal protein 1.8 to 2.2g per kg. Energy +200 to 300 kcal above follicular.

### Rule 8 — Weight and strength
Cite Arvo 2026, ExRx, or Strengthlevel.com. Use median across sources.

### Rule 9 — No medical claims
Forbidden language:
- "you have low progesterone" → "this pattern is sometimes associated with lower progesterone levels and is worth tracking"
- "this indicates a luteal phase defect" → "this pattern may be worth discussing with your doctor if it persists"
- "you are ovulating" → "these signals are consistent with ovulation"
- "your hormones are abnormal" → "this value is outside the typical reference range"
Always include "consult your doctor" when flagging a concerning pattern.

### Rule 10 — Source comments in code
```javascript
// Source: Arvo strength standards 2026 female intermediate percentile at 65kg
{ range: '50 to 75kg', science: 'Intermediate female squat 1.2x bodyweight at 65kg (Arvo 2026)' }
```

### Rule 11 — Podcast claims require independent peer-reviewed verification
Claims from the Diary of a CEO episodes or any podcast are expert opinion, not peer-reviewed evidence. Every specific claim from those episodes must be verified against at least one independent peer-reviewed source before appearing in the app as fact. If peer-reviewed source agrees — use it, cite the peer-reviewed source as primary. If peer-reviewed source partially disagrees — use the conservative version from the research. If no peer-reviewed source found — write SOURCE NEEDED. Never cite a podcast as the primary source for a health claim.

---

## Cross-referencing and fact verification

Every health claim must be cross-referenced against at least two independent peer-reviewed sources. One source is not enough.

### Cross-reference matrix

**Hormone reference ranges:** Münster 2021 + LifeLabs/EORLA + Endocrine Society 2018 + ACOG. Use most conservative if any disagree.

**Exercise and training:** Colenso-Semple 2023 + Kissow 2022 + Janse de Jonge 2003 + Sims ROAR 2024 + ACE + ACSM. Use most conservative if any contradict.

**Nutrition:** ISSN 2023 + Larivière 2006 + USDA 2020-2025 + Health Canada. Show Health Canada value to Canadian users if it differs from ISSN.

**Strength standards:** Arvo 2026 + ExRx + Strengthlevel.com + Powerlifting America. Use median.

**Cervical mucus:** Bigelow 2004 + Wilcox 2000 (NEJM) + WHO fertility awareness + FAM clinical guidelines.

**Wearable data:** Zhu 2021 + Oura 2025 validation + Stanford wearables research + BBT clinical guidelines.

**PCOS:** Teede et al. 2018 International PCOS Guideline + Woodward 2019 Obesity Reviews + Fica 2008 on insulin resistance.

**Endometriosis:** Meuleman 2009 Human Reproduction Update + Nnoaham 2011 Fertility and Sterility diagnostic delay data.

**Perimenopause and menopause:** Harlow 2012 STRAW+10 + Freeman 2004/2006 Archives General Psychiatry + Manson 2013 NEJM HRT reanalysis.

**Iron and anaemia:** Angeli 2016 + Burden 2015 BJSM ferritin threshold + WHO haemoglobin 2011.

**Bone density:** Kohrt 2004 MSSE ACSM position stand + Wright clinical practice.

**Pregnancy loss:** Quenby 2021 The Lancet miscarriage series.

**RED-S:** IOC Consensus Statement Mountjoy 2023 BJSM + Nattiv 2007 Female Athlete Triad original position stand.

**Creatine for women:** Rawson 2018 JISSN + Candow 2021 Nutrients.

**Fasted training in women:** Sims ROAR 2024 + Hamadeh 2005 Am J Physiol on sex differences in fuel utilisation.

### 23 specific claims to verify before app ships

For each add: VERIFIED (two sources agree), SINGLE SOURCE (needs second), or UNVERIFIED (remove).

1. Follicular phase resistance training produces superior strength gains
2. RHR rises 1.7 bpm in mid-luteal phase
3. Progesterone raises core temperature 0.3 to 0.5 degrees Celsius
4. Egg white cervical mucus indicates ovulation within 24 to 48 hours
5. Luteal phase protein requirements are 1.8 to 2.2g per kg bodyweight
6. Energy intake naturally higher by 200 to 300 kcal in luteal phase
7. Progesterone and cortisol compete for glucocorticoid receptors
8. Peak estrogen increases ACL injury risk
9. Oura Ring detects ovulation with 96.4% accuracy
10. Wrist temperature shift threshold is 0.2 degrees Celsius minimum
11. Ovulation confirmed when progesterone exceeds 10 nmol/L measured 7 days after confirmed ovulation (NOT "day 21" — that assumes 28-day cycle with ovulation day 14; always say "7 days post-ovulation")
12. LH surge threshold is 8 IU/L
13. Luteal phase length is relatively fixed at 12 to 14 days across women
14. Depo-Provera recovery hormone environment resembles the menstrual phase
15. Cool water may reduce prostaglandin activity during menstruation
16. HIIT in luteal phase creates larger cortisol stress response than follicular
17. Sleep quality is impaired in mid-luteal phase
18. 10 sets per week per muscle group is optimal for hypertrophy
19. Nordic hamstring curl reduces ACL injury risk in women
20. Progesterone has anxiolytic effect via GABA-A receptor interaction in luteal phase
21. Standard haemoglobin thresholds for women were set using male data — verify against WHO 2011 and Burden 2015
22. Perimenopause symptoms can begin as early as age 35 — verify against STRAW+10 Harlow 2012
23. Up to 1 in 4 known pregnancies ends in miscarriage — verify against Quenby 2021 Lancet

### Language rules
- Never cite a percentage without the study: "96.4% (Oura Ring 2025 validation)"
- Never say "research shows" without naming the research
- Never say "women experience" without clarifying population average with individual variation
- Never say "your hormones are" — say "your hormone levels appear to be"
- Never say "this confirms" — say "this is consistent with"
- Never round hormone values that change clinical significance
- Always include sample sizes: "Münster et al. 2021 n=97 women 2105 cycles"
- Never say "day 21 progesterone" — say "progesterone measured 7 days after confirmed ovulation"

### Credibility standard
A GP, registered dietitian, certified personal trainer, and reproductive endocrinologist should all read this app and find nothing clinically incorrect. If unsure — SOURCE NEEDED.

---

## Research Foundation — always check here first, always add new sources here

**Core hormones and physiology:**
- Münster et al. 2021 (ScienceDirect, n=97 women 2105 cycles) — hormone reference values. Follicular progesterone under 3 nmol/L. Mid-luteal progesterone 10 to 50 nmol/L median 28.8. Ovulatory E2 222 to 1959 pmol/L. LH surge above 8 IU/L.
- LifeLabs/EORLA Canadian reference ranges — Canadian clinical standard for all hormone interpretation.
- Endocrine Society Clinical Practice Guidelines 2018 — hormone reference standard.
- ACOG guidelines — clinical reference for reproductive health.
- Charkoudian N, Stachenfeld NS. Comprehensive Physiology. 2014;4(2):793-804 — progesterone raises core temperature, delays sweating onset.
- Crawford N. Diary of a CEO October 2025 — progesterone pulses throughout entire luteal phase. The smooth curve graph is a population average not a reality. Individual variation is the norm not the exception. Verify pulsatility claim against Filicori M et al. J Clin Endocrinol Metab 1984 and Eldar-Geva T et al.

**Exercise and training:**
- Colenso-Semple et al. 2023 (Frontiers) — no consistent evidence strength outcomes differ by phase. Always use "may" not "will".
- Kissow et al. 2022 (Sports Medicine) — follicular phase resistance training may produce superior strength gains.
- De Martin Topranin et al. 2023 (IJSPP) — RHR 1.7 bpm higher in mid-luteal vs early follicular (P=.006). Sleep quality impaired in mid-luteal.
- Sarwar R et al. Journal of Physiology. 1996;493(Pt 1):267-272 — muscle strength peaks in follicular phase.
- Janse de Jonge XAK. Sports Medicine. 2003;33(11):833-851 — individual hormone variability means personal tracking beats population averages.
- Hackney 2006 (Journal of Sports Science and Medicine) — progesterone and cortisol compete for glucocorticoid receptors. High intensity exercise in luteal phase creates larger net stress response.
- Bernárdez-Vázquez R et al. Frontiers in Sports and Active Living. 2022 — 10 sets per week per muscle group optimal for hypertrophy.
- Sims ST, Yeager S. ROAR Revised Edition. Rodale/Random House. 2024 — women are not small men. Synthesises 170+ peer-reviewed studies. Intermittent fasting can suppress HPA axis in women. Women need food within 30 to 60 minutes of waking. Caffeine above 200mg before training raises cortisol.
- Sims ST. Diary of a CEO October 2025 — wearable devices calibrated on male physiology underestimate readiness in luteal phase. PCOS more common in successful female athletes. Amenorrhea in athletes is illness not fitness. Allostatic load drives cycle disruption.
- Maher AC et al. PLOS ONE 2009 — women have more mitochondria in muscle than men. Satellite cells from XX individuals better at making cartilage and muscle.
- IOC Consensus Statement on RED-S 2023 (Mountjoy M et al. BJSM 2023;57(17):1073-1098) — Relative Energy Deficiency in Sport replaces female athlete triad. Affects immune function, bone health, metabolic rate, and reproductive function. Does not require being underweight or elite.
- Nattiv A et al. Medicine and Science in Sports and Exercise 2007 — Female Athlete Triad original position stand. Cross-reference for RED-S claims.
- Hamadeh MJ et al. American Journal of Physiology. 2005 — sex differences in fuel utilisation during exercise. Women rely more on fat oxidation; pre-exercise carbohydrate protects muscle differently in women than men.
- Kohrt WM et al. Medicine and Science in Sports and Exercise 2004 — ACSM position stand on exercise and bone health. Bone can be built at any age with resistance training and impact exercise.
- ACE guidelines — exercise science standard.
- ACSM guidelines — clinical exercise standard.
- Arvo strength standards 2026, ExRx female norms, Strengthlevel.com — weight suggestions.
- Watson SL et al. Journal of Bone and Mineral Research 2018;33(2):211 — LIFTMOR randomized controlled trial. Postmenopausal women with low bone mass did 8 months of twice-weekly high-intensity resistance and impact training (5 sets of 5 reps at over 85% 1RM: deadlift, squat, overhead press, plus impact) and improved lumbar spine and femoral neck bone mineral density, height, and function — safely. Primary source that heavy loading (not light high-rep work) is the priority in peri/postmenopause. Cross-reference for bone with Kohrt 2004.
- Hunter SK. Acta Physiologica 2014;210(4):768 — sex differences in human fatigability. Women are more fatigue-resistant than men and can sustain force at the same relative intensity longer, performing more repetitions at a given %1RM (greater type I fibre proportion, better blood flow, less metabolite accumulation). Basis for women tolerating rep volume well.
- "Sex Differences in High-Intensity Interval Training — Are HIIT Protocols Interchangeable Between Females and Males?" Frontiers in Physiology 2020;11:38 — women recover ATP faster between bouts and are more fatigue-resistant in intermittent sprinting, so short-rest moderate circuits under-stimulate them; true high-intensity (near-maximal effort) is required for adaptation. Cross-reference with Sims ROAR 2024.
- Roberts BM, Nuckols G, Krieger JW. Journal of Strength and Conditioning Research 2020 — sex differences in resistance training systematic review. Women tolerate volume and recover similarly between sets; informs rep/volume prescription for women.
- Schoenfeld BJ et al. Journal of Strength and Conditioning Research 2017 — strength and hypertrophy across low vs high loads. Hypertrophy is similar across a wide rep range when sets are taken close to failure; strength favours heavier loads/lower reps. Basis for "reps count only when the last few are hard; go heavy for strength."
- Herzberg SD et al. Orthopaedic Journal of Sports Medicine 2017;5(7) — systematic review and meta-analysis. Knee ligament laxity is significantly increased in the ovulatory phase vs follicular, and ACL injury risk is higher around ovulation (peak estradiol reduces type I collagen synthesis in the ACL). This is the verifying source for claim #8 (peak estrogen increases ACL injury risk) — previously SOURCE NEEDED. Use for the ovulatory warmup/ACL caution instead of Kissow 2022.
- Daley AJ et al. (exercise and dysmenorrhea) — gentle/aerobic exercise reduces menstrual pain. Source for the menstrual cardio "movement eases cramps" notes (walk/cycle/swim), replacing the previously mis-attributed Hackney 2006.

**Safety, adolescent, and population-difference sources (added 2026-06-26 — multi-persona clinical review):**
- ACOG — Heavy Menstrual Bleeding (FAQ) and acute pelvic pain / ectopic pregnancy guidance. Basis for the Log red-flag card: soaking a pad/tampon every 1–2h for several hours or clots larger than a coin = seek same-day care; sudden one-sided pain + faintness/shoulder-tip pain or possible pregnancy = emergency. Also the postmenopausal-bleeding "always get it checked" rule in Learn.
- ACOG Committee Opinion 651 — Menstruation in Girls and Adolescents: Using the Menstrual Cycle as a Vital Sign. Cycles are commonly irregular for the first 1–3 years after menarche. Basis for the teen reassurance card (shown to users ≤19 with irregular/observation cycles).
- Eltoukhi HM et al. American Journal of Obstetrics and Gynecology 2014 — uterine fibroid burden and racial disparities: fibroids more common, earlier, and more severe in Black women. Basis for the new Fibroids section in Learn.
- Gold EB et al. SWAN Study, American Journal of Public Health 2011 — Black and Hispanic/Latina women enter perimenopause earlier with a longer, more symptomatic transition. Basis for the ethnicity note in the perimenopause-onset box.
- Abbasi B et al. Journal of Research in Medical Sciences 2012 — magnesium and insomnia (the correct citation for the Sleep magnesium tip; Facchinetti 1991 is PMS-specific and was mis-attributed before).
- 988 Suicide and Crisis Lifeline — call/text, 24/7, live in Canada (since Nov 2023) and the US. Used by the reusable `CrisisSupport.jsx` component, surfaced on any low-mood log (was previously buried in one perimenopause article).

**Permanent rules from the 2026-06-26 multi-persona review — never revert:**
- **Age gate:** Setup collects `birth_year` and requires age ≥13 to continue (under-13 blocked with a guardian message; 13–17 see a guardian-awareness note). Never remove the gate.
- **Acute red-flag safety net (Log.jsx):** very heavy/heavy flow OR pain ≥4 shows the "When to seek care today" card. Never gate this behind a toggle or remove it.
- **Late-period/pregnancy pathway:** `buildCycleStatus` exposes `latePeriod`/`daysLate` (cycleDay > cycleLen+1); Dashboard shows the late-period + pregnancy-test card at ≥2 days late. Never let late users silently keep seeing "PMS, period in 0 days".
- **Crisis line everywhere:** `CrisisSupport` renders on any low-mood/sad log. Keep it reachable beyond Path 4.
- **Hormone interpretation is never overstated:** progesterone ≥10 "supports ovulation when measured mid-luteal" (not "confirms"); a single LH ≥8 is "consistent with an approaching surge" with the PCOS caveat (not a guaranteed surge). Keep the hedged wording.
- **Nutrition accuracy:** no food is described as "as effective as ibuprofen" except ginger, which keeps the real Ozgoli 2009 RCT framing PLUS "alongside, not instead of, your usual pain relief". Omega-3 = "may modestly reduce" (Rahbar 2012). No olive-oil/ibuprofen comparison. Nutrition disclaimer must keep the allergen-swap + disordered-eating + supplement-dose lines. Vegan protein capped at 2.2 g/kg.
- **Inclusivity (never re-narrow):** default foods lead with affordable global staples (beans/lentils alongside meat/fish); calcium guidance never leads with dairy alone; Learn must keep the South-Asian PCOS note, the Fibroids section, the ferritin/blood-trait caveat, vitamin-D-by-skin-tone, and the earlier-perimenopause-in-Black/Latina note.
- **Ethnicity (optional, added 2026-06-26):** collected at signup (multi-select, skippable, "prefer not to say"), stored in `profiles.ethnicity` as a JSON array. Drives the Learn "Relevant for you" card via `ETHNICITY_NOTES`. RULE: additive only — it surfaces relevant health info and NEVER hides content, NEVER assumes diet (the diet-preference selector owns food), and is always framed as "population patterns, not a diagnosis." It is sensitive data: keep it optional and keep the privacy-policy disclosure. New source added: WHO Expert Consultation, Lancet 2004 — lower BMI thresholds / higher type-2-diabetes risk in Asian populations.
- **Postmenopause label:** Dashboard hero uses `subPhase` for Path 4, so a "Menopause 12+ months" user reads "Postmenopause", never "Perimenopause".
- **Workout progression:** `exercise_history` + the player "last time" hint and progressive-overload nudge are the strength-tracking core. Keep persisting top working weight on gym finish.

**Nutrition:**
- ISSN 2023 position stand — luteal phase protein 1.8 to 2.2g per kg bodyweight. Energy +200 to 300 kcal above follicular. Progesterone increases protein catabolism.
- Larivière F et al. American Journal of Physiology. 2006 — luteal phase amino acid utilisation changes.
- USDA Dietary Guidelines 2020-2025 — baseline nutrition reference.
- Health Canada dietary guidelines — Canadian nutrition standard.
- Angeli A et al. European Journal of Sport Science. 2016 — iron loss during menstruation impacts exercise performance. Vitamin C improves iron absorption by up to 67%.
- Burden RJ et al. British Journal of Sports Medicine 2015 — ferritin below 30 mcg/L is functionally deficient for active women even with normal haemoglobin.
- WHO haemoglobin concentrations 2011 — clinical anaemia thresholds. Verify whether female thresholds were set from female-specific data.
- Rawson ES et al. Journal of the International Society of Sports Nutrition 2018 — creatine supplementation in women. Women have lower natural creatine stores. 3 to 5g daily supports muscle, cognition, and mood.
- Candow DG et al. Nutrients. 2021;13(6):1825 — creatine supplementation across age and sex. Cross-reference for creatine claims in women.
- Facchinetti F et al. Obstetrics and Gynecology 1991 — magnesium reduces dysmenorrhea severity.
- Rahbar N et al. Gynecological Endocrinology 2012 — omega-3 fatty acids reduce menstrual cramping.
- Zafari M et al. 2011 — omega-3 and dysmenorrhea mechanism.
- Akin MD et al. Obstetrics and Gynecology 2001 — continuous low-level heat therapy for primary dysmenorrhea.
- Mauvais-Jarvis F et al. Journal of Clinical Investigation 2013 — estrogen receptors on pancreatic beta cells and muscle cells. Estrogen improves insulin sensitivity directly via receptor activation. Low estrogen drives insulin resistance through impaired receptor signalling and reduced beta cell function. Primary peer-reviewed mechanism for the bidirectional estrogen-insulin connection.
- Carr MC. Journal of Clinical Endocrinology and Metabolism 2003 — estrogen loss at menopause drives visceral fat redistribution and metabolic syndrome. Visceral fat releases inflammatory cytokines that further worsen insulin resistance. Confirms estrogen-insulin relationship in the perimenopause context.
- Backstrom T et al. Archives of Women's Mental Health 2008 — estrogen regulates serotonin and dopamine production and receptor sensitivity. Progesterone metabolises to allopregnanolone which modulates GABA-A receptors. Phase-specific neurotransmitter fingerprints: late luteal low serotonin plus GABA withdrawal = anxious irritable low mood; early luteal allopregnanolone GABA effect = calm settled; follicular rising serotonin and dopamine = energised motivated; ovulatory peak neurochemistry = confident social focused. Direct neurobiological effects not psychological.
- Bäckström T et al. Psychoneuroendocrinology 2014 — allopregnanolone and GABA-A receptor modulation. Calming effect of progesterone in early luteal and the rebound anxiety when it drops in late luteal. Primary source for GABA withdrawal mechanism.
- Lokuge S et al. Journal of Psychiatry and Neuroscience 2011 — estrogen as serotonin modulator. Estrogen increases serotonin synthesis, reduces reuptake, and increases receptor sensitivity. Mood tracks estrogen across the cycle in measurable ways.
- Osborn E et al. Frontiers in Pharmacology 2025 — estrogen and progesterone regulate mood, cognition, and brain health across the lifespan. Hormonal fluctuations contribute to PMDD, postnatal depression, and menopausal depression through neurotransmitter pathways. PMDD affects approximately 3 to 8% of women.
- DSM-5 PMDD diagnostic criteria — cyclical mood symptoms confined to the luteal phase with remission in follicular phase. Requires prospective daily symptom tracking across at least two cycles. Source for PMDD pattern detection logic.

**Fertility, mucus, and cycle:**
- Bigelow et al. 2004 (Human Reproduction) — egg white cervical mucus 80% sensitivity for fertile window.
- Wilcox et al. 2000 (NEJM) — fertile window up to 6 days, timing relative to ovulation.
- Crawford N. Diary of a CEO October 2025 — normal period: 3 to 7 days, cycle 21 to 35 days, flow not requiring pad change more than every 1 to 2 hours, pain not disrupting daily life. Irregular cycles may indicate PCOS, endometriosis, or hormonal imbalance. 50% of unexplained infertility may have endometriosis — verify against Meuleman 2009.
- Meuleman C et al. Human Reproduction Update 2009 — endometriosis and subfertility. Use as primary source for endometriosis/infertility claim.
- Nnoaham KE et al. Fertility and Sterility 2011 — endometriosis diagnostic delay. Average 7 to 10 years — verify exact range from this study.
- Quenby S et al. The Lancet 2021 — miscarriage epidemiology. Use as primary source for pregnancy loss rates.
- Crawford N. Diary of a CEO October 2025 — the 5 fertility non-negotiables: sleep 7 to 9 hours, manage stress, do not smoke, maintain a weight the hormonal system can support, take folate if any chance of pregnancy.
- World Health Organization fertility awareness guidelines.
- Fertility Awareness Method clinical guidelines.

**Sleep (the Sleep screen recommendations trace to these):**
- Okamoto-Mizuno K, Mizuno K. Journal of Physiological Anthropology 2012;31(1):14 — effects of thermal environment on sleep. A cool room (~18 to 20°C) supports faster sleep onset and more slow-wave/REM sleep. Basis for the "cool room around 18°C" advice.
- Haghayegh S et al. Sleep Medicine Reviews 2019;46:124-135 — meta-analysis: a warm bath/shower (40 to 42°C) 1 to 2 hours before bed improves sleep onset latency and quality by accelerating the core-temperature drop. Basis for the "warm bath before bed" advice (esp. menstrual).
- Drake C et al. Journal of Clinical Sleep Medicine 2013;9(11):1195 — caffeine taken even 6 hours before bed measurably disrupts sleep. Basis for "cut caffeine after 2pm".
- Chang AM et al. PNAS 2015;112(4):1232 — evening screen/blue-light exposure suppresses melatonin and delays sleep. Basis for "screens away an hour before bed".
- Abbasi B et al. Journal of Research in Medical Sciences 2012;17(12):1161 — magnesium supplementation improved insomnia severity, sleep time, and onset in a randomized trial. Moderate evidence; phrase magnesium as "may help / try", not a guarantee. Basis for the 400mg magnesium glycinate suggestion (cross-reference Facchinetti 1991 for the menstrual-cramp angle).
- Charkoudian N, Stachenfeld NS. Comprehensive Physiology 2014;4(2):793 — progesterone raises core temperature 0.3 to 0.5°C in the luteal phase, which is why cooling matters more then. (Already in the foundation; reused for the luteal sleep advice.)
- De Martin Topranin et al. 2023 IJSPP — sleep quality measurably impaired in the mid-luteal phase. Basis for the luteal "sleep gets lighter" framing.
- Morning light / circadian anchoring and consistent sleep-wake timing are well-established circadian-health principles (light exposure within ~30 min of waking; regularity > duration alone). SOURCE: add a named circadian reference (e.g. Czeisler) before any strong on-screen claim beyond general guidance.

**Wearables and temperature:**
- Oura Ring 2025 validation study — 96.4% ovulation detection accuracy, error ±1.26 days.
- Zhu et al. 2021 (JMIR) — wrist temperature 86.2% accuracy. Shift 0.3 to 0.5 degrees Celsius above follicular baseline.
- Stanford wearables research group publications.
- BBT clinical fertility guidelines.

**PCOS:**
- Teede HJ et al. Human Reproduction 2018 — international PCOS guideline. Use as primary source for all PCOS management language.
- Woodward A et al. Obesity Reviews 2019 — exercise interventions in PCOS. Resistance training and insulin sensitivity.
- Fica S et al. Journal of Medicine 2008 — insulin resistance central to PCOS pathogenesis.
- Rickenlund A et al. Journal of Clinical Endocrinology 2003 — PCOS-like features in athletes. Verify "more common in successful athletes" claim against this source.
- Haver MC. Diary of a CEO October 2025 — insulin resistance fuels hormone imbalance, irregular cycles, and infertility. Birth control masks PCOS symptoms without fixing root cause.

**Bone density:**
- Kohrt WM et al. MSSE 2004 — bone health and exercise.
- Wright V. Diary of a CEO October 2025 — bone can be built in your 40s. Every resistance training session stimulates bone formation. Verify against Kohrt 2004 and ACSM guidelines.
- FDA Depo-Provera prescribing information 2016 — Depo causes significant bone mineral density loss. Partial recovery only. Black box warning.
- ScienceDirect 2006 BMD recovery study — spine BMD recovers approximately 37 months after stopping Depo. Hip BMD takes 48 to 92 months.

**Perimenopause and menopause:**
- Harlow SD et al. Climacteric 2012 — STRAW+10 reproductive aging staging. Gold standard for perimenopause onset age. Verify "as early as 35" claim against this study.
- Freeman EW et al. Archives of General Psychiatry 2004 and 2006 — depression risk across menopausal transition.
- Bromberger JT, Epperson CN. Depression and Anxiety 2018 — mental health and menopause.
- Soares CN. Menopause 2014 — depression in perimenopause.
- Manson JE et al. New England Journal of Medicine 2013 — HRT timing hypothesis reanalysis of WHI. HRT started within 10 years of menopause or before age 60 associated with reduced risk.
- Murabito JM et al. Journal of Clinical Endocrinology and Metabolism 2005 — heritability of menopause timing. Maternal age is predictive.
- Haver MC. Diary of a CEO October 2025 — perimenopause can begin at 35. Only 4% of eligible women use FDA-approved HRT. Verify current uptake statistics from peer-reviewed public health data. Verify suicide risk claims against Bromberger 2018 and Soares 2014 before including.

**Research gap and women's health history:**
- NIH Revitalization Act 1993 — women required in NIH-funded research. US law. Note this applies to US NIH-funded research specifically.
- Wright V, Haver MC. Diary of a CEO October 2025 — funding gap claim. Verify "$450 billion, less than 1% to women over 40" statistic from original McKinsey or Gates Foundation source before using exact figure.
- Sims ST. Diary of a CEO October 2025 — women are not small men. All exercise science built on male bodies.
- Crawford N, Haver MC, Sims ST, Wright V. Diary of a CEO October 2025 — women gaslight themselves about pain. Whiny woman dismissal is systemic across all medical specialties.

---

## Phase calculation — use this exact logic everywhere via hormoneSync.js, never duplicate it

**Ovulation timing (updated 2026-06-18 — never revert to mid-cycle):** the luteal phase is
biologically near-fixed at ~14 days, so ovulation is ~14 days BEFORE the next period
(`cycleLen − 14`), NOT mid-cycle (`cycleLen / 2`). Mid-cycle is only correct for a 28-day
cycle and misplaces the fertile window for everyone else (a 35-day cycle ovulates ~day 21,
not 18). This matters for the planned fertility-window feature. Use `getOvulationDay()`.
For a 28-day cycle the result is identical (day 14), so existing behaviour is unchanged.

```javascript
const LUTEAL_LENGTH = 14
function getOvulationDay(cycleLen) {
  return Math.max(8, Math.round((cycleLen || 28) - LUTEAL_LENGTH))  // clamp for short cycles
}

function getPhase(cycleDay, cycleLen) {
  const ovulation = getOvulationDay(cycleLen)
  if (cycleDay <= 5) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}

function getLutealSubPhase(cycleDay, cycleLen) {
  const ovulation = getOvulationDay(cycleLen)
  const lutealDay = cycleDay - ovulation - 1
  if (lutealDay <= 4) return 'Early luteal'
  if (lutealDay <= 9) return 'Mid luteal'
  return 'Late luteal'
}
```

**Logged hormone labs are used (added 2026-06-18):** `interpretHormones(log)` in hormoneSync.js
reads logged progesterone/LH/estradiol. Progesterone ≥10 nmol/L confirms ovulation occurred
(sets `ovulationConfirmed`, boosts confidence); LH ≥8 IU/L is a surge. getTodayStatus exposes
`ovulationConfirmed` and `hormoneSignals` for the future fertility feature. Do not let these
labs become dead-captured data again.

## Intensity modifiers — use these exact values
- Menstrual: 0.70
- Follicular early: 0.95
- Follicular late: 1.05
- Ovulatory: 1.05
- Early luteal: 0.92
- Mid luteal: 0.82
- Late luteal: 0.72
- Observation mode (Depo recovery or no cycle data): 0.72 — low-estrogen environment resembles menstrual phase

## Hormone reference ranges for interpretation cards
```javascript
const HORMONE_REFS = {
  progesterone: {
    follicular: { low: 0.1, high: 3.0, label: 'Follicular range' },
    earlyLuteal: { low: 2.0, high: 20.0, label: 'Early luteal' },
    midLuteal: { low: 10.0, high: 50.0, label: 'Confirmed ovulation' },
    ovulationConfirmed: 10.0
  },
  estradiol: {
    earlyFollicular: { low: 77, high: 330, label: 'Early follicular' },
    ovulatory: { low: 222, high: 1959, label: 'Ovulatory peak' },
    luteal: { low: 95, high: 854, label: 'Luteal range' }
  },
  lh: {
    follicular: { low: 2.0, high: 13.2 },
    surge: { low: 8.0, high: 90.0, label: 'LH surge — ovulation imminent' }
  },
  cortisol: {
    morningNormal: { low: 10.0, high: 30.0, label: 'Normal morning cortisol' },
    elevated: 30.0,
    suppressed: 5.0
  }
}
```

Every hormone reference range shown in the app must include: "This is a population average. Your personal normal may be different. What matters most is your pattern across multiple cycles."

## Muscle group options — correct real-world training splits

Three full-width radio cards (single select, with subtitle):
- Full body — every major muscle group in one session
- Upper body — chest, shoulders, triceps, back, biceps, rear delts
- Lower body — quads, hamstrings, glutes, calves

One secondary card below with dashed border (single select):
- Custom — build your own session — expands 10-checkbox muscle panel below it

Custom muscle checkbox panel (shown only when Custom selected, 2-column grid, multi-select):
Chest / Back / Shoulders / Biceps / Triceps / Quads / Hamstrings / Glutes / Calves / Core

Core finisher toggle shown for Full body / Upper body / Lower body only. Hidden when Custom selected.

## Auth and session protection — React pattern

Auth is handled centrally by `AuthGuard` in `App.jsx`. All routes except `/login` and `/privacy` are wrapped in `<AuthGuard>`. Individual pages check auth in `useEffect` with `navigate('/login', { replace: true })`. Pattern:
```javascript
useEffect(() => {
  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    // load data here
  }
  init()
}, [navigate])
```
Never use `window.location.href` in React pages — always use `navigate()` from `useNavigate()`.

## Loading spinner — add to every screen
```css
.spinner {
  width: 32px; height: 32px;
  border: 3px solid #ede8e0;
  border-top-color: #c8b89a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 60px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
```
Show spinner immediately on page load. Hide when all Supabase data has loaded. Never show a blank screen.

## Upsert pattern
```javascript
await supabase.from('daily_logs').upsert(record, { onConflict: 'user_id,log_date' })
await supabase.from('mucus_logs').upsert(record, { onConflict: 'user_id,log_date' })
```

## getTodayStatus — single shared function for all screens
hormoneSync.js must export getTodayStatus which returns:
```javascript
{
  phase, subPhase, cycleDay, cycleLen, daysUntilPeriod,
  confidence, confidenceLabel, confidencePct,
  intensityModifier, intensityLabel,
  nutritionTargets: { proteinG, extraCalories, headline, keyFoods, avoid, source },
  immediateFeedback: [],
  anomalies: [],
  predictions: [],
  symptomInference: {
    inferredPhase,    // 'Follicular' | 'Menstrual' | 'Ovulatory' | 'Luteal' | null
    confidence,       // 'low' | 'medium' | 'high' | 'insufficient'
    confidencePct,    // rough percentage for UI display
    signals,          // string[] — what drove the inference
    source            // always 'symptom_inference'
  }
}
```
Every screen imports this. No screen calculates phase independently.

## Daily-log fields ↔ inference label sync — PERMANENT RULE (added 2026-06-27)

The daily log's option strings are the INPUTS to `inferPhaseFromSymptoms` in hormoneSync.js, which scores them by exact string match. A 2026-06-27 research review (competitor + peer-reviewed) found the engine was silently IGNORING much of what users logged because the option labels in Log.jsx had drifted from the strings the engine checked (e.g. log saved `'Cramping'` but engine looked for `'Cramps'`; `'Breast tenderness'` vs `'Sore breasts'`; `'Creamy or lotion-like'`/`'Sticky or crumbly'` vs `'Creamy'`/`'Sticky'`; `'Stronger than usual'` vs `'Strong'`; `'Low mood'` vs `'Low'`). All now fixed and verified. **RULE: whenever you change a symptom/mood/cervical-fluid/workout option label in Log.jsx, update the matching string in `inferPhaseFromSymptoms` (and vice-versa). Never let them drift — the mismatch silently degrades cycle inference with no error.** The engine now also uses: `pain_rating` (menstrual), `Ovulation pain` symptom (ovulatory/mittelschmerz), `libido === 'High'` (ovulatory), and logged `hormone_progesterone >= 10` (luteal/ovulation-confirmed) — so it can infer the cycle for users with NO period date from labs + signals, not just a calendar.

Cycle-inference design principle (research-backed): the cycle is reconstructed from three signal classes — **menstrual anchor** (flow), **ovulation-approaching** (cervical mucus, LH, libido, ovulation pain), **ovulation-confirmed** (sustained temperature rise, RHR rise, progesterone). Cervical fluid is the strongest device-free daily predictor, so it lives in the QUICK log view (not buried). Mood/energy/generic symptoms enrich guidance but are weak phase predictors — do not over-weight them. Wearable temperature/RHR sync is the future unlock for passive inference.

## inferPhaseFromSymptoms — symptom-based fallback phase detection
hormoneSync.js exports inferPhaseFromSymptoms(recentLogs, mucusLogs).
- If phase is confirmed from period date: inference runs alongside as supporting evidence
- If no cycle data at all: inference result becomes the working phase (clearly labeled as estimated)
- Returns null inferredPhase if fewer than 3 distinct signals are detected
- UI must never show inferred phase with same confidence as a calculated phase
- Always use "may be" or "looks like" language for inferred phases, never "You are in"
- Sources: Janse de Jonge 2003 Sports Medicine; Bigelow et al. 2004 Human Reproduction; De Martin Topranin 2023 IJSPP; Zhu et al. 2021 JMIR

## Personalisation labels — single source of truth
`personalisationProgress` in `hormoneSync.js` owns the label text ("Strong personal data coverage",
"Your personal pattern is developing", "Early personal pattern", "Starting to learn your baseline",
"Using research-informed general guidance"). Never hand-write a different set of labels in a screen.
Never lead with the percentage — see the retention rules above and `nextPersonalisationMilestone`.

---

## Content requirements — a BACKLOG, not a record of what is built

**Read this header before treating anything below as a bug.** This is a wish list of content Emma
wants, not documentation of the current app. Verified 2026-08-20: several items below have NEVER
been built — the allostatic load indicator, the community pulse card, the Depo doctor-referral
trigger at 12/18 months, and the dashboard research-gap banner do not exist anywhere in the code
(the 1993 / research-gap content lives in Learn.jsx instead). Do not "restore" them thinking they
regressed, and do not delete them thinking they are dead — they are unbuilt ideas awaiting a decision.


### ONBOARDING — Setup.jsx (/setup)

**Welcome screen — first thing new user sees:**
"You have probably been dismissed before. Maybe your pain was called normal. Maybe your symptoms were called anxiety. Maybe you were told to come back if it got worse. Em~power is not that. Your body sends signals every single day. This app learns to read them — and takes every single one seriously. Welcome."
Source: Haver, Crawford, Wright. Diary of a CEO October 2025.

**Research gap card — shown once, dismissible:**
"Almost everything you have been told about exercise and nutrition was researched on men and generalised to women. Women were not required to be included in research studies until 1993 (NIH Revitalization Act). Em~power is built on research conducted on women."

**Vital sign framing — shown during onboarding:**
"Your menstrual cycle is a monthly health report. It reflects your bone health, brain health, cardiovascular health, and metabolic health. When it is regular and pain-free your hormonal system is functioning well. When it is not it is sending you a signal worth listening to."
Source: Crawford N. Diary of a CEO October 2025.

**Birth control path card:**
"Birth control manages symptoms but does not fix the underlying hormonal pattern. If you were put on the pill for irregular cycles, PCOS, endometriosis, or painful periods the original condition is still there waiting to be understood. Em~power helps you see your hormones clearly now that you can see them."
Source: Crawford N. Diary of a CEO October 2025. Teede et al. 2018.

**Depo-Provera specific card (shown when bc_type is depo):**
"What to expect after Depo — your honest timeline. 55% of women have no period at 12 months after Depo. 68% have no period at 24 months. About 93% of women conceive within 18 months. Cycle return can take 9 to 18 months. This is completely normal for Depo. It does not mean something is wrong. Em~power will track your recovery signals daily."
Source: FDA Depo-Provera prescribing information 2016.

**5 fertility non-negotiables card (Path 1 and Path 3):**
1. Sleep 7 to 9 hours — reproductive hormones are produced during sleep
2. Manage stress actively — cortisol directly suppresses GnRH
3. Do not smoke — accelerates egg loss
4. Maintain a weight your hormonal system can support
5. Take folate 400mcg daily if any chance of pregnancy
Source: Crawford N. Diary of a CEO October 2025. Verify each claim against peer-reviewed sources before shipping.

**Decade-by-decade card in setup:**
Teens and 20s: Peak bone-building window. Every strength session builds foundation for life. First 2 years of cycling: irregular periods are normal. After 2 years: worth investigating.
Late 20s to early 30s: Highest hormonal output. Cycle syncing has most pronounced effect. Peak fertility window.
Late 30s: Perimenopause can begin here per STRAW+10 staging (Harlow 2012). Start tracking now.
40s: Bone and muscle can still be built. Protein needs increasing. Sleep becomes more critical.
Source: Wright V, Haver MC, Sims ST. Diary of a CEO October 2025. Harlow 2012 for perimenopause onset.

### DASHBOARD — Dashboard.jsx (/dashboard)

**Personal baseline card (shown after 2 cycles):**
Shows personal average cycle length vs population 28 days, personal follicular length, personal luteal length, personal temperature baseline, personal RHR. Under each: "Your personal pattern drives your recommendations — not the population average."
Source: Crawford, Haver, Sims, Wright. Diary of a CEO October 2025. Janse de Jonge 2003.

**Allostatic load indicator:**
Weekly score 1 to 10. Green under 4. Amber 4 to 7. Red above 7.
Calculated from: poor sleep (+2), high intensity 3+ consecutive days (+2), each disruptor logged (+1), very low energy 2+ consecutive days (+2), late luteal or menstrual (+1).
When above 7: "Your combined load this week is high. When allostatic load is consistently high your body responds by down-regulating reproductive hormones. Consider rest, eat more, prioritise sleep."
Source: Sims ST. ROAR 2024. Diary of a CEO October 2025.

**Wearable accuracy warning (mid and late luteal):**
"Your wearable readiness score may be lower than usual. Wearable algorithms were calibrated on male physiology. Your elevated core temperature and RHR in the luteal phase looks like poor recovery to a device that treats male physiology as the default. Dr Stacy Sims identified this specifically. Your Em~power recommendations already account for this."
Source: Sims ST. Diary of a CEO October 2025.

**Bone density card (Path 2 Depo users):**
"Depo-Provera reduces estrogen and causes measurable bone mineral density loss. The FDA carries a black box warning. Spine bone density recovery takes approximately 37 months. Hip bone density can take 4 to 8 years (ScienceDirect 2006). Weight-bearing exercise and strength training are the most effective non-pharmacological interventions. Every workout you log is actively protecting your long-term bone health."
Nutrition note: "Calcium 600mg twice daily and vitamin D 800 to 1000 IU are recommended during Depo recovery."
Source: FDA Depo-Provera prescribing information 2016. ScienceDirect bone density recovery study 2006.

**Depo doctor referral trigger:**
At 12 months observation with no cycle return: "It has been 12 months since you stopped Depo with no confirmed cycle return. This is within the normal range but worth mentioning to your doctor. Ask for estrogen, FSH, LH, and progesterone blood tests."
At 18 months: Stronger card recommending GP appointment.

**Research gap banner (shown once, dismissible):**
"Less than 1% of the $450 billion spent on health research goes to women over 40. Women were not required to be included in medical research studies until 1993. Em~power is different — every recommendation is based on research conducted on women."
Source: Haver MC. Diary of a CEO October 2025. Verify funding statistic against original McKinsey/Gates source.

**Phase cards — each must include:**
- Hormonal description
- Training implication
- Nutrition implication
- Mental health and brain health dimension:
  - Menstrual: "Estrogen and progesterone are generally low. Mood, motivation, and clarity may be affected. This is hormonal, not a reflection of your character."
  - Follicular: "Rising estrogen may support mood, cognitive clarity, and motivation."
  - NOTE: keep the hedged wording ("generally", "may"). The phase copy in `lib/phaseInfo.js` was
    deliberately softened away from absolute claims; never reintroduce "is at its lowest" phrasing.
  - Ovulatory: "Peak estrogen and testosterone. Confidence, social drive, and cognitive performance all elevated. Biological, not coincidental."
  - Luteal: "Progesterone affects mood, sleep, and cognition. These are real hormonal effects — not weakness."
  - All: "These are population average hormone levels. Your personal levels may be higher or lower and still be completely normal for you."

**PCOS pattern flag:**
When cycle consistently over 35 days + no detected ovulation signals + 3 cycles: "Your cycle has been longer than usual across your last few tracked cycles. Longer cycles are common and have many possible causes. If this pattern continues, it may be worth mentioning to your doctor — tracking data like this can be useful context for that conversation. This is a pattern observation, not a diagnosis."
Source: Teede 2018 for PCOS management language. Never name PCOS directly in the flag — keep the language as a pattern observation only.

**Endometriosis pain flag:**
When pain 4 or 5 logged for 2+ consecutive cycles: "You have logged significant period pain across multiple cycles. Severe pain is worth taking seriously and worth tracking — the pattern you are building here is exactly the kind of information that can be useful to bring to a healthcare provider. If pain regularly affects your daily life, it is worth raising with your doctor."
Source: Nnoaham 2011 for diagnostic delay data. Never name endometriosis directly in the flag — frame as a pain pattern worth discussing, not a condition indicator.

**"Women suffer longer" motivation card (observation mode 30+ days):**
"Women live longer than men but spend 20% more of their lives in poor health. What you are doing right now — tracking your hormonal health before something goes wrong — is exactly the kind of proactive care that changes this."
Source: Haver MC. Diary of a CEO October 2025. Verify McKinsey statistic.

**Perimenopause awareness card (users showing symptoms and possible age 35+):**
"Perimenopause can begin as early as age 35. Sleep disruption, mood changes, cycle irregularity, and brain fog in your late 30s may be early hormonal shifts — not just stress. Worth discussing with a doctor who specialises in hormonal health."
Source: Haver MC, Wright V. Diary of a CEO October 2025. Harlow 2012 STRAW+10 — verify age range.

**HRT education card (Path 4 perimenopause):**
"In 2002 a study caused panic about HRT. Headlines said it caused cancer and heart attacks. The study was later found to have been misinterpreted — it used older women and outdated formulations. Current evidence shows HRT started within 10 years of menopause or before age 60 is associated with reduced risk of osteoporosis, heart disease, and dementia. Only a small percentage of eligible women currently use it. Most are suffering unnecessarily."
Source: Manson JE et al. NEJM 2013. Haver MC. Diary of a CEO October 2025. Verify uptake percentage from peer-reviewed public health data.

**Perimenopause mental health card (Path 4, shown sensitively):**
"The hormonal transition into menopause is associated with significant mood changes and in some women depression. This is a hormonal situation not a psychological weakness. If you are experiencing depression or very low mood during this transition please speak to a doctor who understands hormonal mental health."
If user logs crisis-level mood: include Crisis Services Canada 1-833-456-4566 or text 45645.
Source: Freeman 2004/2006. Bromberger 2018. Soares 2014. Verify suicide risk claim carefully against these sources before including.

### LOG SCREEN — Log.jsx (/log)

**Flow volume tracking (menstrual phase only):**
Options: Spotting only, Light, Moderate, Heavy, Very heavy.
Note: "Flow volume is clinical information. Lighter than usual bleeding can indicate lower estrogen exposure. Heavier may indicate higher exposure or other factors. We track your personal pattern over time."
Source: Crawford N. Diary of a CEO October 2025.
Add flow_volume column to daily_logs table if not present.

**Pain scale (menstrual phase only):**
1 None, 2 Mild barely noticeable, 3 Moderate distracting, 4 Severe affects daily activities, 5 Debilitating cannot function.
Note: "Pain that disrupts your daily life is not normal. Log it here and we will track the pattern."
Add pain_rating column to daily_logs table if not present.

**Anaemia education — iron section:**
"The problem with standard anaemia tests: standard haemoglobin thresholds were set using male data. A woman can be functionally iron deficient — depleted stores affecting performance and mood — while her haemoglobin looks normal. Ask your doctor for a full iron panel including ferritin. Ferritin below 30 mcg/L is functionally deficient for active women even with normal haemoglobin."
Source: Crawford N. Diary of a CEO October 2025. Burden 2015 BJSM — verify 30 mcg/L threshold. WHO 2011 — verify haemoglobin threshold origin claim.

**Sleep field note:**
"Sleep is not passive recovery. Estrogen and progesterone are produced and regulated during sleep. Consistently poor sleep disrupts the hormonal cascade."
Source: Haver MC, Wright V. Diary of a CEO October 2025.

**Caffeine disruptor note (when logged):**
"Caffeine above 200mg before training raises cortisol and compounds the hormonal stress of hard training. In the luteal phase this effect is stronger because progesterone already elevates baseline cortisol load."
Source: Sims ST. ROAR 2024. Hackney 2006.

**Hormone+ section (full log, optional):**
Estradiol pmol/L, progesterone nmol/L, LH IU/L, cortisol nmol/L.
Show LifeLabs/EORLA reference range next to each field.
All ranges must include: "Population average — your personal normal may differ."

### NUTRITION CARDS — all phases

**Fasting warning (all phase nutrition cards, collapsible):**
"Intermittent fasting and skipping breakfast can backfire for women. Research suggests fasting can suppress the HPA axis in women, raise cortisol, and disrupt the hormonal system that regulates your cycle. Eat within 30 to 60 minutes of waking. Especially important in the luteal phase."
Source: Sims ST. ROAR 2024. Diary of a CEO October 2025. Hamadeh MJ et al. Am J Physiol 2005.

**Insulin resistance education (follicular and luteal cards):**
"Blood sugar and your hormones: insulin resistance is one of the most common hidden drivers of irregular cycles, PCOS, and hormonal imbalance. Eating protein and healthy fats before carbohydrates, avoiding ultra-processed foods, and resistance training are the three most evidence-supported lifestyle interventions."
Source: Haver MC, Crawford N. Diary of a CEO October 2025. Teede 2018. Fica 2008.

**Creatine recommendation (all phases):**
"Creatine for women — an underused tool: women have lower natural creatine stores than men. 3 to 5g daily with food supports muscle strength, cognitive function, and mood. Safe across the menstrual cycle. Particularly useful in the luteal phase when protein breakdown is elevated."
Source: Rawson ES et al. JISSN 2018. Candow DG et al. Nutrients 2021. Sims ST. Diary of a CEO October 2025.

**Natural period pain relief (late luteal, collapsible):**
Starting 5 to 7 days before predicted period:
- Anti-inflammatory foods: oily fish, turmeric, ginger, leafy greens. Reduce processed food, sugar, alcohol.
- Magnesium 400mg daily — relaxes smooth muscle including uterus (Facchinetti 1991)
- Omega-3 fatty acids — compete with arachidonic acid to reduce prostaglandin production (Rahbar 2012)
- Heat therapy — reduces prostaglandin-driven cramping (Akin 2001)
- Gentle exercise — movement reduces prostaglandins

**Calcium and vitamin D (Path 2 Depo users, all phases):**
"Calcium 1000mg daily and vitamin D 800 to 1000 IU are especially important during hormonal contraceptive recovery. Calcium from dairy, sardines, almonds, leafy greens."
Source: FDA Depo-Provera prescribing information 2016.

### WORKOUT SCREEN — Workout.jsx (/workout)

**Phase banner muscle mass note:**
"Muscle mass is one of the most powerful things you can build for your long-term hormonal health. It improves insulin sensitivity, supports healthy estrogen metabolism, and directly influences how well you transition through perimenopause and menopause."
Source: Wright V. Diary of a CEO October 2025. Kohrt 2004.

**Bone building note (users over 35 or in late 30s):**
"Yes you can build bone in your 40s. Bone responds to load at every age. Every weighted squat and every deadlift stimulates bone formation. The window before menopause is a critical bone-building opportunity while estrogen is still present to support the process."
Source: Wright V. Diary of a CEO October 2025. Kohrt 2004 MSSE.

**Wearable limitations note (mid and late luteal with wearable connected):**
Show same wearable accuracy warning as dashboard.

**PCOS high training volume flag:**
When 5+ gym sessions per week for 3+ consecutive weeks and irregular cycle or no cycle: show PCOS training load warning.

**RED-S education (observation mode users and high training volume users):**
"RED-S — Relative Energy Deficiency in Sport — happens when energy burned through exercise consistently exceeds energy taken in through food. Your body responds by shutting down non-essential systems. Reproduction is first to go. Signs: persistent fatigue, getting sick frequently, stress fractures, missing or irregular period. You do not need to be elite or underweight for RED-S to affect you."
Source: IOC Consensus Statement on RED-S 2023 (Mountjoy et al. BJSM). Sims ST. Diary of a CEO October 2025.

**No period is not a fitness badge (observation mode, training-related loss):**
"A missing period is not a sign you are training hard enough. It is a sign your body has decided reproduction is too costly given your current energy balance. Your period returning is not a sign you are getting softer. It is a sign your body is healthy enough to perform at its best."
Source: Sims ST. Diary of a CEO October 2025. IOC RED-S 2023.

**Ovulatory ACL warning:**
Prominent amber card when ovulatory + high intensity selection: "Peak estrogen this week increases ligament laxity. A thorough warmup is not optional today — complete all warmup exercises before loading any weight."
Source: Cite specific peer-reviewed ACL injury risk research — SOURCE NEEDED until verified.

**Post-workout nutrition card:**
Pull phase and body_weight_kg from Supabase. Show specific gram target, timing window, 3 food suggestions.
Mid-luteal 65kg woman example: "Eat 130g protein today. Within 45 minutes: Greek yogurt with pumpkin seeds, salmon with sweet potato, or eggs with spinach. Progesterone is increasing your protein breakdown rate right now (ISSN 2023)."

### PREGNANCY LOSS SUPPORT
Accessible from log screen and setup. Only shown when relevant. Extreme sensitivity required.
"Up to 1 in 4 known pregnancies ends in miscarriage (Quenby et al. The Lancet 2021). Most early losses are caused by chromosomal abnormalities — not caused by exercise, stress, food, or anything the mother did. Women are rarely told this clearly. Em~power will continue tracking your cycle as your hormones re-establish, typically 4 to 8 weeks."
Recurrent loss (3+): mention investigating thyroid, autoimmune, clotting disorders, uterine anatomy.

### CONTRACEPTIVE INFORMATION (Setup.jsx)
Non-judgmental information about each method including effects on cycle visibility, training adaptation, and recovery. Note that all hormonal methods suppress natural cycle. Copper IUD is non-hormonal. New progestin-only pills have different profiles.
Source: Crawford N, Sims ST. Diary of a CEO October 2025. Teede 2018.

---

## Ongoing work — what to do every session

There is no fixed task list. Every session:

1. Re-read this entire file
2. Check user_feedback table for pending feedback — process before anything else
3. Run continuous quality loop on every file
4. Run full audit — code, UX, science, visual, data
5. Fix everything found — do not report, fix
6. Verify every health claim has two peer-reviewed sources — mark SOURCE NEEDED if not
7. Add new research sources found to Research Foundation above
8. Think like a product manager — what would make this better for a real woman today
9. Run audit again after all fixes
10. Keep going until zero issues remain

Never stop. There is always something that can be improved, verified, or made more human.

---

## Trial user feedback system — autonomous processing

**This runs at the start of every session without being asked. No exceptions.**

### Step 1 — Fetch pending feedback using the service role key

```bash
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /Users/emmascheck/Developer/hormone\ app/.env.local | cut -d= -f2)
curl -s "https://imgujppjvffbubnsscge.supabase.co/rest/v1/user_feedback?status=eq.pending&order=frustration_rating.desc,created_at.desc" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

The service role key is in `.env.local` (gitignored). Never use the anon key for this — it cannot read other users' rows.

### Step 2 — Process each item autonomously using this judgment framework

| Category | Action |
|----------|--------|
| Bug / crash / broken button | Fix it immediately. No approval needed. |
| Missing feature that is clearly vital (e.g. can't log period) | Add it, keeping it minimal and consistent with existing design. |
| Missing feature that is nice-to-have | Add it if it takes under 30 minutes and doesn't risk breaking anything. |
| Confusing UX | Rewrite the copy or restructure the flow. |
| Science concern | Verify against Research Foundation. Fix if wrong, add source if missing. |
| Something they love | Note it, no action needed. |
| Ambiguous or unclear | Use best judgment. If truly impossible to interpret, skip and flag for Emma. |

Never wait for approval. Never ask clarifying questions. Make a decision and do it.

### Step 3 — After fixing each item

1. Mark resolved in Supabase:
```bash
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /Users/emmascheck/Developer/hormone\ app/.env.local | cut -d= -f2)
curl -s -X PATCH "https://imgujppjvffbubnsscge.supabase.co/rest/v1/user_feedback?id=eq.ITEM_ID" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","resolved_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","developer_notes":"[one sentence describing the fix]"}'
```

2. Add an entry to `CHANGES.md` in the project root (create if it doesn't exist) in this format:
```
## [DATE] — Feedback fix
**User said:** "[exact words from feedback]"
**What was done:** [plain English, 2-3 sentences max]
**Files changed:** [list]
```

3. Build and deploy to production: `cd "/Users/emmascheck/Developer/hormone app/empower-react" && npm run build && netlify deploy --dir dist --site 11d125ac-cd81-4060-8dc1-2b6b580265ed --prod`

### Step 4 — Flag session summary to Emma

The VERY FIRST thing in your response each session must be a summary block if any feedback was processed OR any fixes were made. Format:

---
**What I did before you got here:**
- [fix 1 in plain English, one line]
- [fix 2 in plain English, one line]

Check [CHANGES.md](CHANGES.md) for full details.
---

If nothing was done, skip the block entirely. Do not say "no feedback found" or "nothing to do."

### Pattern detection

If 3 or more users report the same issue, surface it as a systemic problem in the session summary with a suggested fix. Do not wait for Emma to notice the pattern.
