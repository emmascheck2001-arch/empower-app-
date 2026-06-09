# Em~power — Claude Code Instructions

## Project context
Women's hormone-based fitness app. Vanilla HTML, CSS, JavaScript ES modules, Supabase JS client loaded via CDN. No build step, no npm, no framework. All files live in this folder and open directly in a browser via Live Server.

## Supabase credentials
URL: https://imgujppjvffbubnsscge.supabase.co
Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZ3VqcHBqdmZmYnVibnNzY2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQzNzIsImV4cCI6MjA5NjE4MDM3Mn0.TpjycdiHLl5iI1G8u07mVmStKZWU2fzEsuw1dUi6diU

## Files in this project
- login.html — sign in and create account
- setup.html — onboarding for new users, four paths
- dashboard.html — main home screen showing phase, nutrition card, log streak
- log.html — daily symptom and biometric log with 5-question morning check-in as default
- mucus.html — cervical mucus and spotting log
- workout.html — activity picker, muscle group selector, guided workout player
- checkin.html — 5-question morning check-in
- feedback.html — trial user feedback screen with smart follow-up questions, stores to user_feedback table
- nutrition.html — phase-aware nutrition screen with symptom relief accordion
- hormoneSync.js — shared getTodayStatus function used by all screens
- algorithm_v3.js — core algorithm with processAllSignals, getNutritionTargets, getIntensityModifier

## Database tables
- profiles — id, email, name, user_path, bc_type, bc_stop_date, cycle_length, body_weight_kg, fitness_level, onboarding_complete
- cycle_data — id, user_id, last_period_date, cycle_length, notes
- daily_logs — id, user_id, log_date, energy, symptoms[], workout_feel, mood[], sleep_quality, resting_hr, resting_hr_exact, disruptors[], wrist_temp, temp_deviation, lh_result, hormone_estradiol, hormone_progesterone, hormone_lh, hormone_cortisol, flow_volume, pain_rating, hot_flash_count, night_sweats_severity, joint_pain_rating, joint_pain_location[], brain_fog_rating, notes, created_at. Unique constraint on (user_id, log_date).
- mucus_logs — id, user_id, log_date, discharge_type, spotting_type, notes. Unique constraint on (user_id, log_date).
- cycle_summaries — id, user_id, cycle_number, cycle dates, phase lengths, ovulation data
- user_baselines — id, avg_cycle_length, avg_luteal_length, temp_follicular_baseline, rhr_follicular_baseline, pms_days_before, peak_energy_day, cycles_tracked, model_confidence
- user_feedback — id, user_id, user_email, category, screen, description, followup_answer, frustration_rating, priority, status, claude_code_instruction, developer_notes, resolved_at

Always use upsert with onConflict: 'user_id,log_date' when saving daily data.

---

## Dashboard phase card rules — permanent, never revert

The phase detail cards in dashboard.html (openPhaseSheet function, PHASE_HORMONE_INFO data structure) have strict content rules that must never be changed:

**Rule 1 — No hormone numbers in the default visible view.**
The `direction` and `patterns` fields in PHASE_HORMONE_INFO must never contain pmol/L, nmol/L, or IU/L values. Plain English only. Examples of FORBIDDEN direction text: "Low, below 3 nmol/L", "Rising from 77 to 330 pmol/L", "Above 8 IU/L". Examples of CORRECT direction text: "Low — no temperature or RHR elevation", "Rising steadily toward ovulation", "Surging — this triggers egg release".

**Rule 2 — Numbers live only in the ranges field, behind a toggle.**
All reference range numbers (pmol/L, nmol/L, IU/L values) belong exclusively in the `ranges` field of each hormone entry. The `ranges` field is rendered inside a `display:none` div and revealed only when the user taps "View reference ranges". This toggle (toggleRanges function) must always remain in place. Never move numbers from ranges into direction or patterns.

**Rule 3 — 4-bullet "What is happening" lists only, no long paragraphs.**
Each phase must show a 4-item `bullets` array under "What is happening". No opening paragraph. Bullets are plain English descriptions of what is happening hormonally. No numbers in bullets.

**Rule 4 — These rules apply to every future edit of dashboard.html.**
If a future task involves editing dashboard.html for any reason, read these rules first and verify no hormone numbers have been introduced into direction, patterns, or bullets fields. Run a final check before finishing: `grep -n "pmol\|nmol\|IU/L" dashboard.html` and confirm every match is inside a `ranges:` string, not a `direction:`, `patterns:`, or `bullets:` entry.

---

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

**Spinner (identical across all files):**
```css
.spinner { width:32px; height:32px; border:3px solid #ede8e0; border-top-color:#c8b89a; border-radius:50%; animation:spin 0.8s linear infinite; margin:60px auto; }
@keyframes spin { to { transform:rotate(360deg); } }
```
Always: show spinner on load, hide when Supabase data returns. Never show blank screen.

**Button states:**
- Primary CTA: `background:#2c2820; color:#f5f0e8; border:none; border-radius:12px; padding:16px; font-size:15px; font-weight:500`
- Single-select option: `.selected-soft` class applied via JS — `background:#e8dfd0; color:#5a4a3a; border-color:#c8b89a; font-weight:500`
- Multi-select: same `.selected-soft` class, toggled on/off

**Toggle switches (core finisher, etc.):** `width:44px; height:26px; border-radius:13px; background:#d8d0c8` off / `#2c2820` on. Thumb: `width:20px; height:20px; top:3px; left:3px`. On: `transform:translateX(18px)`.

**Bottom navigation — 5 items (most screens):**
Home (`ti ti-home`, dashboard.html) / Workout (`ti ti-barbell`, workout.html) / Log (`ti ti-pencil`, log.html) / Nutrition (`ti ti-salad`, nutrition.html) / Learn (`ti ti-book-2`, learn.html)
Active item: icon and text both `color:#2c2820`. Inactive: `#9a9590`.
Dashboard uses 6-item nav adding Calendar (`ti ti-calendar`, calendar.html) between Log and Nutrition.

**Top bar pattern:** `background:#f5f0e8; padding:16px 20px; border-bottom:1px solid #ede8e0; display:flex; align-items:center; gap:12px`. Back button: `ti ti-arrow-left`, `font-size:20px`.

**PWA head tags (every HTML file, exact format):**
```html
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Em~power">
<meta name="theme-color" content="#2c2820">
```
SW registration and iOS install banner (shown once, localStorage key `pwa-prompt-dismissed`) added to every file.

**Service worker (sw.js):** Cache name `empower-v1`. Pre-caches all 11 HTML files + hormoneSync.js + algorithm_v3.js + manifest.json. Stale-while-revalidate strategy. Never intercepts `supabase.co`, `jsdelivr.net`, or `cdn.` requests.

**Auth guard (every screen except login.html):**
```javascript
const { data: { session: _s } } = await supabase.auth.getSession()
if (!_s) { window.location.href = 'login.html' }
supabase.auth.onAuthStateChange((event, session) => {
  if (!session) { window.location.href = 'login.html' }
})
```
NEVER use `return` after redirect at module top level (causes SyntaxError in ES modules).

**index.html:** Instant redirect only. No content.
```html
<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=login.html">
<script>window.location.href = 'login.html'</script>
</head><body></body></html>
```

---

### CHECKIN.HTML — Morning check-in

**Path 4 science note adaptation (permanent):** After getTodayStatus loads, if `todayStatus.profile?.user_path === '4'`, two science notes are updated via JS: (1) mucus question note changes from "80% sensitivity for detecting your fertile window" to estrogen-level framing — cervical fluid still tracked but context is estrogen signals not ovulation. (2) Sleep question note changes to perimenopause-specific. These updates happen in the `try` block after getTodayStatus resolves. Never remove this adaptation.

**Title in browser:** "Em~power — Morning Check-in"

**Top bar:** Phase name (large, centered) + day label + phase tag pill (e.g. "Day 14")

**Card header:** "Morning check-in" / "5 questions, under 30 seconds"

**6 questions in order (despite header saying 5):**

1. **How is your energy today?** (4-button grid) — Very low / Low / Good / High. Note: "Good" not "Normal".
2. **Mucus this morning?** (pill buttons) — Nothing / Creamy / Watery / Egg white / Spotting. Science note: "80% sensitivity for detecting your fertile window (Bigelow et al. 2004)."
3. **Sleep last night?** (4-button grid) — Poor / Fair / Good / Great. Note: "Great" not "Excellent".
4. **Resting heart rate this morning?** (pill buttons) — Under 55 / 55 to 65 / 65 to 75 / Over 75. Science note: "RHR rises ~1.7 bpm in mid-luteal phase (De Martin Topranin et al. 2023)." No "No data" option (unlike log.html).
5. **How are you feeling mentally?** (multi-select pills) — Energised / Happy / Calm / Focused / Tired / Anxious / Irritable / Low. Science note: "Mood patterns are a genuine phase signal... (Backstrom et al. 2008.)"
6. **Any physical symptoms?** (multi-select, optional) — Cramps / Bloating / Headache / Fatigue / Breast tenderness.

**Save button:** `id="saveBtn"`. Text: "Save check-in". Black. Disabled during save.

**After save:** Bottom-sheet overlay (`feedback-overlay`) shows:
- Title: "Check-in saved"
- Body: confidence gain message (e.g. "Confidence up 20%. Mucus signal added.")
- Confidence text: "Algorithm confidence now [X]%"
- Mood context block (shown if mood selected): headline + body from `getMoodContextFeedback()` in algorithm_v3.js. Source: Backstrom et al. 2008.
- "Tap anywhere to go to dashboard" text
- Auto-redirect to dashboard after 2500ms

**Saves to:** `daily_logs` (energy, sleep_quality, resting_hr, symptoms, mood) + `mucus_logs` (discharge_type) if mucus answered. Uses upsert with `onConflict: 'user_id,log_date'`.

**Imports:** `getTodayStatus` from `./hormoneSync.js` and `getMoodContextFeedback` from `./algorithm_v3.js`.

---

### LOG.HTML — Full daily log

**Path 4 science note adaptation (permanent):** When `userPath === '4'` is confirmed in `loadPhase()`, two science note elements are updated via JS: (1) `#cervicalFluidWhy` changes from "One of the strongest ovulation indicators" to estrogen-level framing. (2) `#lhTestWhy` changes from "strongest single ovulation signal" to "Ovulation becomes unpredictable in perimenopause. A positive LH test may still occur. Log it if you test." The `id` attributes on these elements must never be removed.

**Title:** Standard top bar with back button.

**Default mode:** Full log (NOT the 5-question check-in; checkin.html is the separate 5-question version).

**Field order in the card (exact, permanent):**

1. **Cervical fluid** (single-select pills) — None or dry / Sticky or crumbly / Creamy or lotion-like / Watery / Egg white / Spotting. Science note element `id="cervicalFluidWhy"`.
2. **LH test** (single-select pills) — No test / Negative / Positive. Science note element `id="lhTestWhy"`.
3. **Energy** (4-button grid) — Very low / Low / Normal / High. Note: "Normal" not "Good" (different from checkin.html).
4. **Mood positive** (`#moodRow`, multi-select pills) — Energetic / Motivated / Confident / Social / Calm / Focused
5. **Mood challenging** (`#moodRowB`, multi-select pills) — Tired / Irritable / Anxious / Sad / Brain fog / Low mood
6. **Wrist temperature** (number input, 34-40°C range, step 0.1)
7. **Resting heart rate** (RHR ranges: Under 55 / 55 to 65 / 65 to 75 / Over 75 / No data) + exact input `id="rhrExactInput"` (range 30-120). Mutual deselection: range selection clears exact input; typing exact clears range buttons.
8. **Symptoms** (multi-select pills) — Bloating / Cramping / Breast tenderness / Headache / Back pain / Fatigue / Cravings / Mood swings / Acne / None. "None" deselects all others.
9. **Sleep** (single-select 4-button grid) — Poor / Fair / Good / Excellent. Note: "Excellent" not "Great" (different from checkin.html).
10. **Workout** (single-select pills) — Rest day / Weaker than usual / Average / Stronger than usual / Skipped
11. **Disruptors** (multi-select pills) — Alcohol / Illness / Travel / Very poor sleep / High stress / None of these. "None of these" clears all; selecting others deselects "None of these".
12. **Flow** (menstrual phase only, hidden otherwise) — Spotting only / Light / Moderate / Heavy / Very heavy. Saved to `flow_volume`.
13. **Pain** (menstrual phase only, hidden otherwise) — 1 None / 2 Mild barely noticeable / 3 Moderate distracting / 4 Severe affects daily activities / 5 Debilitating cannot function. Saved to `pain_rating`.
14. **Hormones section** (outside main card, collapsed by default) — Estradiol pmol/L / Progesterone nmol/L / LH IU/L / Cortisol nmol/L. Has LifeLabs/EORLA reference ranges shown inline.

**Save button:** `.next-btn` class (no id="saveBtn"). Dark background. Full width.

**Save payload includes:** user_id, log_date, energy, sleep_quality, resting_hr, resting_hr_exact, wrist_temp, lh_result, symptoms[], mood[], disruptors[], workout_feel, flow_volume (menstrual), pain_rating (menstrual), hormone_estradiol, hormone_progesterone, hormone_lh, hormone_cortisol.

**After save:** navigates to dashboard.html.

---

### DASHBOARD.HTML — Main home screen

**Screen order (permanent, do not reorder):**
1. Hero card: phase name (italic serif), cycle day, description, confidence dot + text, "Plan my workout" button, science disclaimer
2. Anomaly container (`#anomalyContainer`) — hidden unless anomaly detected
3. Hormone card — hidden by default, shown only when user logged hormone results today
4. Already logged banner — hidden by default
5. "Log today's data" button
6. Nutrition card (tap navigates to nutrition.html) — icon `ti ti-salad`, title, subtitle, chevron
7. Stats row (Cycle day / Days left / Day streak) — hidden until cycle data exists
8. Personal baseline card — hidden, shown after 2+ cycles
9. Community pulse card — hidden
10. Allostatic load card — hidden
11. Wearable readiness warning card — hidden
12. Pattern flag container — hidden
13. "Your cycle phases" section label (`id="cyclePhasesSectionLabel"`) + phase cards. For Path 4 users the label changes to "Your hormonal phases" via JS, a Perimenopause card appears at the top (`id="cardPerimenopause"`, hidden by default, shown via Path 4 JS block), and a context note (`id="periCycleNote"`) appears below the 4 standard cards: "If you are still cycling, the phase cards above still apply to your irregular cycles."
14. Share feedback link: `<a href="feedback.html">` — `font-size:12px; color:#9a9590`
15. Bottom nav (6 items: Home / Workout / Calendar / Log / Nutrition / Learn)

**Phase card data (`PHASE_HORMONE_INFO`) — permanent rules:**
- `bullets[]`: 4 plain-English items, NO hormone numbers (pmol/L, nmol/L, IU/L)
- `hormones.estrogen/progesterone/lh.direction`: plain English only, NO numbers
- `hormones.estrogen/progesterone/lh.patterns[]`: plain English only, NO numbers
- `hormones.estrogen/progesterone/lh.ranges`: numbers HERE ONLY, hidden behind "View reference ranges" toggle
- The `toggleRanges()` function reveals the ranges div. This toggle must always exist.
- Run `grep -n "pmol\|nmol\|IU/L" dashboard.html` after every edit and confirm every match is inside a `ranges:` string.
- The Perimenopause card uses `fsh` as the hormone key (not `lh`) — `hormoneNames` in `openPhaseSheet` maps `fsh: 'FSH'`. Do not remove this mapping.

**Path 4 (perimenopause/menopause) dashboard rules — permanent:**
- PCOS pattern flag must always have `profile.user_path !== '4'` guard. Irregular cycles in perimenopause are expected — showing PCOS flag would be actively misleading.
- Endometriosis pain flag must always have `profile.user_path !== '4'` guard. Path 4 logs use `joint_pain_rating` not `pain_rating`.
- Community pulse (`renderCommunityPulse`) skips Path 4 — returns early if `phase === 'Perimenopause'`. Community pulse compares energy by cycle phase which does not apply.
- Wearable warning card only shows for `phase === 'Luteal'` — correctly excluded from Path 4.

**Phase bullet lists (exact current values):**
- Menstrual: 'Estrogen and progesterone are at their lowest' / 'Serotonin is at its lowest point of the cycle' / 'Prostaglandins are elevated' / 'Iron is being lost through bleeding'
- Follicular: 'Estrogen is rising' / 'Progesterone remains low' / 'Energy and recovery often improve' / 'Body temperature stays near baseline'
- Ovulatory: 'Estrogen peaks before egg release' / 'LH surges triggering ovulation' / 'Brief testosterone rise alongside estrogen' / 'Your most fertile window'
- Early luteal: 'Progesterone rising with calming GABA effect' / 'Energy often still good' / 'Core temperature begins to rise slightly' / 'Good phase for focused steady work'
- Mid luteal: 'Progesterone at its peak' / 'Core temperature and RHR measurably elevated' / 'Serotonin becoming less stable' / 'Recovery slower than follicular'
- Late luteal: 'Both hormones dropping sharply' / 'Serotonin at its lowest since menstruation' / 'PMS symptoms most likely here' / 'Resolves when menstruation begins'
- Luteal (generic): 'Progesterone is elevated and core temperature rises slightly' / 'Resting heart rate measurably higher than in follicular' / 'Serotonin stability decreases through this phase' / 'The same workout genuinely feels harder — this is real physiology'

---

### WORKOUT.HTML — Activity picker and workout player

**Screen flow:** screenActivity → screenGymFocus (gym only) → screenSummary → screenWarmup → screenPlayer → screenCooldown → screenComplete

**Activity picker grid (3x3, exact order):** Walk / Run / Cycle / Swim / Gym / Yoga / Pilates / HIIT / Rest day
Icons: ti ti-walk / ti ti-run / ti ti-bike / ti ti-swimming / ti ti-barbell / ti ti-leaf / ti ti-accessible / ti ti-flame / ti ti-zzz
Note: Yoga uses ti ti-leaf — ti-yoga does not exist in the Tabler Icons webfont.
"Build me a plan" button below grid (`.plan-btn`).

**Gym muscle group picker (screenGymFocus) — PERMANENT LAYOUT, NEVER CHANGE:**

"Choose workout type" section label above THREE full-width single-column radio cards (`.s1-cards` flex column):
- Full body — "Every major muscle group in one session"
- Upper body — "Chest, shoulders, triceps, back, biceps, rear delts"
- Lower body — "Quads, hamstrings, glutes, and calves"

Below those three, a FOURTH card in its own wrapper div with dashed border style — visually secondary:
- Custom — "Build your own session"

Tapping Full body, Upper body, or Lower body: selects that card, deselects Custom, collapses `#customMusclePanel`, shows `#coreFinisherRow`.

Tapping Custom: selects the Custom card AND expands `#customMusclePanel` below it — a 2-column checkbox grid (multi-select) with 10 options:
Chest / Back / Shoulders / Biceps / Triceps / Quads / Hamstrings / Glutes / Calves / Core

When Custom is selected `#coreFinisherRow` is hidden (Core is a checkbox instead).

Custom muscle mapping (individual → exercise group key):
chest/shoulders/triceps → chest_shoulders_triceps; back/biceps → back_biceps; quads/calves → legs; hamstrings → hamstrings_glutes; glutes → glutes_only; core → sets state.coreFinisher = true.

Core finisher toggle (`#coreFinisherRow`): "Add core finisher" / "3 core exercises at the end of your session". Toggle on = dark. Visible only for Full body / Upper body / Lower body.

Fitness level selector (3 buttons, default Intermediate): Beginner / Intermediate / Advanced

Generate button disabled until selection made. Updates in real time.

**Plan picker (screenPlan):** 3 options — Just today / Rest of this week / Full cycle plan. Plus fitness level selector.

**Warning cards (shown in screenSummary):**
- ACL warning (ovulatory + gym/HIIT): amber card `background:#fff8e6; border:1px solid #f0c040`. Title: "Your warmup matters more today". Text references peak estrogen and ligament laxity.
- HIIT warning (mid/late luteal): `background:#fdf3f0; border:1px solid #e8a080`. Title: "HIIT is more stressful in this phase". References Hackney 2006. Has "Switch to tempo cardio" button.
- Observation mode card: `background:#f0f0f8; border:1px solid #c0c0e0`. Title: "Building your baseline".

**Warmup screen (screenWarmup):** Phase note + movement list. "Ready — begin workout" button.

**Cooldown screen (screenCooldown):** Phase note + stretch list. Post-workout nutrition card. "Done" button (calls finishWorkoutFromCooldown).

**Player v2 (screenPlayer):**
- Progress bar at top (`#playerProgress`)
- Minimap dots row: inactive = 28x28px white, done = `#c8b89a`, active = 32x32px `#2c2820` white text
- Header: phase tag pill + volume counter (kg)
- Exercise name: italic Georgia serif 20px
- PR badge (`#prBadge`): green `#e8f5e8`, hidden by default, `.visible` class to show
- Phase note compact: collapsed by default, expands on tap. Label "PHASE GUIDANCE".
- Weight suggestion box: "Starting weight guide" label + text + science citation
- Set table: 4 columns — Set (28px) / Weight kg (flex) / Reps (52px) / Check (36px)
- Set row: weight stepper (- and + buttons) + input + previous hint below input
- Check button: circle 36px, done = dark background `#2c2820`
- Rest strip (fixed bottom): REST label + countdown (italic Georgia serif 28px) + duration buttons (30s/60s default/90s/2m) + Skip

**Complete screen (screenComplete):**
Icon: 🌿. Title: "Workout complete." Subtitle from JS.
3 stat cards: exercises completed / post-workout priority / tomorrow.
Workout feel buttons: Rest day / Felt strong / Felt average / Felt hard / Skipped
Non-gym activities also show: duration (minutes input) + notes (textarea).
"Save & back to dashboard" button.

**Timer screen (screenTimer):** 3 modes:
- Cardio (walk/run/cycle/swim): segmented phases with ring countdown. Time-based view OR lap-based view. "Skip to next segment" button.
- HIIT: WORK/REST badge, large time display, exercise name, "Round X of Y", Pause + Skip buttons, "End session" link.
- Checklist (yoga/pilates): progress bar + item list with checkboxes. "Done" button at bottom.

**Weight database (`weightsByLevel`):** 3 levels (beginner/intermediate/advanced). Each exercise has `range` string and `science` citation. Based on Arvo 2026 / ExRx / Strengthlevel.com.

---

### NUTRITION.HTML — Phase-aware nutrition screen

**Top bar:** Back arrow (to dashboard.html) + "NUTRITION" wordmark + phase chip (uppercase, amber).

**Phase banner:** Full-width card with phase-specific gradient background. Fields: banner-label / banner-phase (italic serif) / banner-desc / banner-science.
Phase gradients: menstrual `135deg, #3d2830, #2c1f25` / follicular `135deg, #2c3828, #1f2c20` / ovulatory `135deg, #2c3035, #1f252c` / luteal `135deg, #352c20, #2c2415` / observation `135deg, #2c2820, #1f1e18`

**Profile stats bar:** Shows weight + fitness level when available. "Update" link to setup.html.

**Targets card:** 2-column — protein (g) / extra kcal (+prefix). Source citation below.

**2 tabs:** Phase foods (default active) / Symptom relief

**Phase foods tab:**
- Section label (phase-specific)
- 2-column food card grid (6 cards per phase): emoji icon + food name + why + source
- Avoid card: `background:#fdf5f0; border:1px solid #f0d8cc`. Red-tinted. List of avoid items with reasons.
- Carb cravings note (menstrual phase only): `background:#fff4f0; border:1px solid #e8cfc8`. "Why carbohydrate cravings are real right now". Explains estrogen-insulin sensitivity mechanism. Source: Mauvais-Jarvis et al. JCI 2013.

**Symptom relief tab — 5 accordion cards (exact order):**
1. Cramping (emoji 🦵) — "Dysmenorrhea and pelvic pain" — 4 remedies: Fatty fish / Pumpkin seeds and dark chocolate / Fresh ginger / Walnuts and flaxseed. Avoid: trans fats / excess alcohol / tea+coffee with iron meals / high sodium.
2. Bloating (emoji 🪣 via unicode) — "Luteal-phase GI changes" — 4 remedies: Probiotic foods / Cooked vegetables / Fennel / Increase water. Avoid: high-sodium / carbonated drinks / alcohol / raw brassicas / sugar alcohols.
3. Brain fog (emoji 🧠) — "Focus, concentration and energy" — 4 remedies: Iron-rich foods / Oily fish and walnuts / Complex carbohydrates / Eggs and leafy greens. Avoid: ultra-processed / excess alcohol / skipping meals.
4. PMS and mood (emoji 💙) — "Late luteal phase support" — 4 remedies: Calcium and vitamin D / Magnesium-rich foods / Vitamin B6 / Complex carbohydrates. Avoid: alcohol / refined sugar / high-sodium / excess caffeine.
5. Fatigue and low energy (emoji 🦵 via unicode) — "Especially during and after menstruation" — 3 remedies: Red meat / Lentils+spinach+tofu with vitamin C / B12. Avoid: black tea/coffee with iron / large dairy at same meal.

**Accordion CSS:** `.symptom-card.open .symptom-chevron { transform:rotate(180deg); }`. Body hidden until `.open` class added.

**Disclaimer at bottom:** Medical disclaimer, not advice, consult a professional.

**Bottom nav:** 5 items, Nutrition active.

**Phase-specific food data (`PHASE_DATA`):** All 5 phases (Menstrual/Follicular/Ovulatory/Luteal/Observation) have: bannerClass / desc / science / sectionLabel / foods[] / avoid[]. Each food has: icon (HTML entity) / name / why / source.

---

### SETUP.HTML — Onboarding

**Welcome text (exact):** "You have probably been dismissed before. Maybe your pain was called normal. Maybe your symptoms were called anxiety. Maybe you were told to come back if it got worse. Em~power is not that. Your body sends signals every single day. This app learns to read them and takes every single one seriously."

**Two info cards below welcome:**
- "Your cycle is a vital sign" (warm background `#f5f0e8`)
- "Built on research about women" (white background)

**4 path options:**
1. Path 1: "I know my last period date" — icon `ti ti-calendar`
2. Path 2: "I just came off birth control" — icon `ti ti-pill`  
3. Path 3: "My cycles are irregular or I am not sure" — icon `ti ti-wave-sine`
4. Path 4: "I am in perimenopause or menopause" — icon `ti ti-heart`

**Path 1 panel:** Date input (last period) + cycle length input (21-45, default 28) + preset buttons (24 / 28 default / 30 / 32 / 35) + live phase preview box showing cycle day / days until period / current phase.

**Path 2 panel:** BC type selector (full-width single-select buttons):
Combined pill (estrogen and progestin) / Mini pill (progestin only) / Patch / Vaginal ring / Hormonal IUD (Mirena, Kyleena) / Copper IUD (non-hormonal) / Implant (Nexplanon) / Depo-Provera injection / Not sure
Plus: bleeding status (Yes a full period / Some spotting / Nothing yet) + observation mode explanation + 3 check items (cervical mucus, wearable, mood/energy).

**Path 3 panel:** Rough date input + irregularity type (Slightly irregular / Very irregular / Never tracked before).

**Path 4 panel:** Stage (Early perimenopause / Late perimenopause / Menopause 12+ months) + 3 check items (exercise adapts / sleep+mood tracking / Hormone+ testing).

**Body stats overlay (bottom sheet, appears after path selection):**
- Body weight: number input + kg/lbs unit toggle
- Height: number input + cm/ft-in toggle
- Fitness level: 3 cards (Beginner / Intermediate / Advanced) each with title + description
- Skip link below form

**Next bar:** Fixed bottom bar, button disabled until option selected. Text changes from "Select an option above to continue" to the path-specific action.

---

### FEEDBACK.HTML — User feedback

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

### CALENDAR.HTML — Cycle calendar

**Title:** "Em~power Cycle Calendar". Subtitle in top bar: "Day X of Y" (cycle users) / "Symptom burden calendar" (Path 4) / "Building baseline" (no data).

**Top bar:** Back arrow (`ti ti-chevron-left`, links to dashboard.html) + centered title div (title + sub label) + 28px spacer div for balance.

**Structure (top to bottom):**
1. Top bar
2. Period banner (hidden by default, shown when period is within 14 days)
3. Month navigation: left chevron / "Month YYYY" title / right chevron
4. Weekday labels row: Sun Mon Tue Wed Thu Fri Sat
5. Calendar grid
6. Phase legend
7. Bottom nav (6 items)

**Imports:** `getPhase`, `getLutealSubPhase`, `predictNextPeriod` from `./hormoneSync.js` and `PHASE_PREDICTIONS`, `BRAIN_STATE_STYLES` from `./algorithm_v3.js`.

**Month navigation:** `background:#f5f0e8; border:1px solid #ede8e0; padding:7px 9px; border-radius:10px` buttons. Title: 18px, `letter-spacing:-0.01em`. Arrows: `ti ti-chevron-left` / `ti ti-chevron-right`.

**Weekday labels:** 9px, `color:#b0a89a`, 7 columns.

**Calendar grid:** White card, `border-radius:16px; box-shadow:0 2px 12px rgba(44,40,32,0.06); border:1px solid #ede8e0`. Cells transparent with phase tint applied as inline background rgba. `min-height:54px; padding:7px 2px 10px`.

**Cell day number:** 28x28px circle. Today: `background:#2c2820; color:#f5f0e8; font-weight:700`.

**Cell phase bar:** `position:absolute; bottom:5px; left:8px; right:8px; height:3px; border-radius:2px`. Future days: `.future` class = `opacity:0.4`.

**Mood dot:** 5x5px circle, `position:absolute; top:7px; right:5px`. Logged days with mood: coloured from MC constant. Logged days with no mood: `background:#dcd8d0; border:1px solid #c8c0b8`.

**CRITICAL — pi scope rule:** `pi` (phase info object) MUST be computed at the TOP of `if (cell.inMonth)`, BEFORE the `if (isPath4)` / `else` branch. Never move it inside the else block — the click handler closure is outside both branches and needs `pi` in scope:
```javascript
if (cell.inMonth) {
    const pi = isPath4 ? null : phaseForDate(cell.date)  // always here
    if (isPath4) { ... } else { ... }
    el.addEventListener('click', () => { ... pi ... })  // pi is in scope
}
```

**Phase colour constants (PC object) — exact values, never change:**
- Menstrual: dot `#e09898`, bg `#f0d8d8`, text `#5a2a28`
- Follicular: dot `#88c088`, bg `#d8f0d8`, text `#1a4a1a`
- Ovulatory: dot `#88c0e0`, bg `#d0e8f8`, text `#1a3a5a`
- Early luteal: dot `#e0c070`, bg `#f8e8c8`, text `#6a3a10`
- Mid luteal: dot `#d0a040`, bg `#f0d098`, text `#5a3008`
- Late luteal: dot `#c88878`, bg `#f0c8b8`, text `#5a2818`
- Luteal (generic): dot `#d0a040`, bg `#f0d098`, text `#5a3008`
- Early follicular: dot `#88c088`, bg `#d8f0d8`, text `#1a4a1a`
- Late follicular: dot `#68b068`, bg `#c8e8c8`, text `#1a4a1a`
- observation: dot null, bg `#e8e5e0`, text `#4a4540`

**Phase tints on cells:** Exact period = `rgba(200,88,88,0.13)`; Period window = `rgba(200,100,90,0.08)`; Pre-period = `rgba(220,160,150,0.06)`. Phase tint from PC dot hex with `0.06` opacity future / `0.10` opacity past.

**Other month cells:** `opacity:0.28; pointer-events:none`.

**Period banner:** Gradient `linear-gradient(135deg, #fce8e0, #fad8d0); border:1px solid #f0c0b0`. Shown when period is within 14 days. Icon `ti ti-droplet-filled` (color `#c05858`) + `.period-banner-body` div with text + italic confidence note. Hidden for Path 4.

**Phase legend (below grid, 5 items):** 8px dots + label. Menstrual `#e09898` / Follicular `#88c088` / Ovulatory `#88c0e0` / Luteal `#d0a040` / Period window `#c85858`. Path 4 replaces legend with: Low burden `#b8e0b8` / Moderate `#e0c060` / High burden `#e09090` / Not logged `#d8d0c8`.

**Path 4 mode (perimenopause):** `isPath4 = profileData?.user_path === '4'`. Cells coloured by symptom burden score instead of phase. Burden levels: none (score 0-3), moderate (4-6), high (7+). Score derived from: hot_flash_count, night_sweats_severity, joint_pain_rating, brain_fog_rating, energy, sleep_quality fields.

**Bottom sheets:** Two overlays — `#pastSheet` (past/today cell tap) and `#futureSheet` (future cell tap). `#sheetOverlay` background with `onclick="closeSheet()"`. Both sheets have drag handle + scrollable content area.

**Past day sheet sections (in order):**
1. Date header: formatted date + phase pill (coloured from PC) + optional logged data
2. Energy bar (if logged): colored fill bar + label
3. Mood chips (if logged): coloured from MC constant
4. Physical symptoms chips (if logged): grey pills
5. Disruptors chips (if logged): amber pills
6. Flow and pain (if logged): icon rows
7. Biometrics: sleep, RHR, wrist temp, workout feel
8. Mucus (if logged): discharge type
9. LH test result (if logged): positive = amber tag, negative = grey tag
10. Hormone values (if logged): 2-column grid with bar charts
11. Phase guidance: collapsible `phase-why` text from PHASE_PREDICTIONS
12. Log/edit button: links to `log.html`

**Future day sheet sections (in order):**
1. Date header + phase pill + days away note
2. Period prediction card (if within prediction window): rose-tinted card with exact date, window, prep advice
3. What to expect: `pred.why` text from PHASE_PREDICTIONS + quick chips (energy level / phase / intensity %)
4. Your brain this day: brain state pill + sentence from BRAIN_SENTENCES
5. Plan ahead: 3 suggestion rows with icons (from SUGGESTIONS object)
6. Personal prediction: pattern note (updates after 2 cycles)
7. Prediction confidence: progress bar + label
8. Reminder button: downloads `.ics` calendar file via Blob

**SUGGESTIONS object:** Per subPhase/phase — 3 items, each with `icon` (ti class) and `text`. Covers all phases including observation.

**BRAIN_SENTENCES object:** Maps brain state strings to one explanatory sentence. States: Low serotonin / Rising serotonin / Peak dopamine / Neurochemical peak / GABA calm / Serotonin dropping / Serotonin crash / Low estrogen.

**MC (mood colours) object:** Energised / Happy / Calm / Focused / Tired / Anxious / Irritable / Low. Each has bg / text / border hex values.

**Bottom nav (6 items, Calendar active):** Home (`ti ti-home`, dashboard.html) / Workout (`ti ti-barbell`, workout.html) / Calendar (`ti ti-calendar`, calendar.html, active) / Log (`ti ti-pencil`, log.html) / Nutrition (`ti ti-salad`, nutrition.html) / Learn (`ti ti-book-2`, learn.html).

---

### GENERAL CODE RULES — permanent

**No dashes in HTML text:** Remove em dashes and en dashes from static HTML text content. Use "to" for ranges, commas for parenthetical breaks. Exception: dashes inside JavaScript strings in `<script>` blocks are fine.

**Every file edit must also update www/ and ios/App/App/public/:** After changing any HTML/JS file, the same change goes to `www/[filename]` and `ios/App/App/public/[filename]`. Both must always be in sync with the root directory.

**After every session — deploy to production:** Run from `/Users/emmascheck/Desktop/hormone app`:
```
netlify deploy --dir . --site 11d125ac-cd81-4060-8dc1-2b6b580265ed --prod
```
The local Netlify link points to the wrong site (scintillating-phoenix). Always pass `--site 11d125ac-cd81-4060-8dc1-2b6b580265ed` explicitly. Production site is https://empowerhealth.netlify.app — empowerhealth.com is a different company's website and is NOT this app.

**Tabler icons only:** Never use emoji as icons where a ti class exists. Emoji only where no tabler icon equivalent exists (e.g. 🧘‍♀️ for yoga, 🌿 for complete screen).

**Georgia serif italic used for:** Phase names in banners (workout, dashboard, nutrition), exercise names in player, hero titles in feedback/success screens, section headers in setup.

**Supabase CDN import:** Always `from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'`. Never npm import.

**getTodayStatus:** Always imported from `./hormoneSync.js`. Never re-implemented in any screen. Returns: phase, subPhase, cycleDay, cycleLen, daysUntilPeriod, confidence, confidenceLabel, confidencePct, intensityModifier, intensityLabel, nutritionTargets, immediateFeedback, anomalies, predictions, symptomInference, moodInsight, bodyWeight, profile.

**Path 4 early exit in getTodayStatus — permanent rule:** The very first thing getTodayStatus does after loading data is check `profile?.user_path === '4'`. If true it immediately returns a perimenopause status object with `phase: 'Perimenopause'` and skips ALL cycle phase calculations. This is critical — Path 4 users may have a `last_period_date` in cycle_data from before they chose Path 4, and without this guard they would receive regular cycle phase calculations. NEVER remove this early exit. The perimenopause return object includes: perimenopause nutrition targets (1.8g/kg protein), intensity modifier 0.82, perimenopause-specific anomaly detection (fatigue and sleep patterns, not cycle patterns), empty predictions array, and the stage label (Early perimenopause / Late perimenopause / Postmenopause) as subPhase.

**getNutritionTargets — Perimenopause key:** `targets.Perimenopause` exists with multiplier 1.8, extra 0, focus on protein and bone protection. Never remove this key.

**getIntensityModifier — Perimenopause:** Returns 0.82. Added before the observation fallback. Never remove.

**detectAnomalies — Path 4 guard:** If `flagStats?.userPath === '4'`, runs perimenopause-specific checks (persistent low energy, repeated poor sleep) and returns early — skips all cycle-based anomaly logic. Never remove this guard.

**algorithm_v3.js PHASE_PREDICTIONS — Perimenopause key:** Exists with brain_state 'Fluctuating estrogen', training and nutrition guidance specific to perimenopause. Never remove.

**getMoodContextFeedback — perimenopause branch:** Checks `phase === 'Perimenopause'` FIRST, before all cycle-based branches. Returns estrogen-variability framing for low mood, estrogen-surge framing for high energy. Never move this branch below the cycle-based branches.

**Podcast sources:** Never reference any podcast (including Diary of a CEO) in user-visible text. All science claims must cite peer-reviewed sources by name.

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

```javascript
function getPhase(cycleDay, cycleLen) {
  const ovulation = Math.round(cycleLen / 2)
  if (cycleDay <= 5) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}

function getLutealSubPhase(cycleDay, cycleLen) {
  const ovulation = Math.round(cycleLen / 2)
  const lutealDay = cycleDay - ovulation - 1
  if (lutealDay <= 4) return 'Early luteal'
  if (lutealDay <= 9) return 'Mid luteal'
  return 'Late luteal'
}
```

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

## Auth and session protection — add to every screen except login.html

IMPORTANT: The pattern below uses `return` after redirect. In ES modules (all HTML files use `<script type="module">`), `return` at the top level of a module causes a SyntaxError. Omit `return` when the auth check runs at module top level. The safe pattern for module scripts:
```javascript
const { data: { session: _s } } = await supabase.auth.getSession()
if (!_s) { window.location.href = 'login.html' }
supabase.auth.onAuthStateChange((event, session) => {
  if (!session) window.location.href = 'login.html'
})
```

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

## inferPhaseFromSymptoms — symptom-based fallback phase detection
hormoneSync.js exports inferPhaseFromSymptoms(recentLogs, mucusLogs).
- If phase is confirmed from period date: inference runs alongside as supporting evidence
- If no cycle data at all: inference result becomes the working phase (clearly labeled as estimated)
- Returns null inferredPhase if fewer than 3 distinct signals are detected
- UI must never show inferred phase with same confidence as a calculated phase
- Always use "may be" or "looks like" language for inferred phases, never "You are in"
- Sources: Janse de Jonge 2003 Sports Medicine; Bigelow et al. 2004 Human Reproduction; De Martin Topranin 2023 IJSPP; Zhu et al. 2021 JMIR

## Confidence labels — based on personal learning not population comparison
- Under 30%: "Learning your baseline — using population averages for now"
- 30 to 55%: "Your personal pattern is emerging — population averages fading out"
- 55 to 75%: "Mostly your data now — your personal normal is becoming clear"
- 75 to 90%: "Your personal baseline established — almost entirely based on you"
- Above 90%: "Fully personalised — your recommendations are based on your cycle, not anyone else's"

---

## Content requirements — implement all of these

### ONBOARDING — setup.html

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

### DASHBOARD — dashboard.html

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
  - Menstrual: "Estrogen and progesterone are at their lowest. Mood, motivation, and brain clarity may all be affected. This is hormonal — not a reflection of your character."
  - Follicular: "Rising estrogen supports mood, cognitive clarity, and motivation."
  - Ovulatory: "Peak estrogen and testosterone. Confidence, social drive, and cognitive performance all elevated. Biological, not coincidental."
  - Luteal: "Progesterone affects mood, sleep, and cognition. These are real hormonal effects — not weakness."
  - All: "These are population average hormone levels. Your personal levels may be higher or lower and still be completely normal for you."

**PCOS pattern flag:**
When cycle consistently over 35 days + no detected ovulation signals + 3 cycles: "Your cycle pattern shows some features sometimes associated with PCOS. This is not a diagnosis. PCOS is very manageable through training and nutrition. Worth discussing with your doctor."
Source: Crawford N. Diary of a CEO October 2025. Teede 2018 for PCOS management language.

**Endometriosis pain flag:**
When pain 4 or 5 logged for 2+ consecutive cycles: "Severe period pain is not something you have to accept. Excruciating cramps can indicate endometriosis, adenomyosis, or uterine fibroids. Women wait an average of years for a diagnosis because pain is dismissed. If your pain consistently disrupts your daily life please pursue a proper investigation."
Source: Crawford N. Diary of a CEO October 2025. Nnoaham 2011 for diagnostic delay data — use published figure not podcast.

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

### LOG SCREEN — log.html

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

### WORKOUT SCREEN — workout.html

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

### CONTRACEPTIVE INFORMATION (setup.html)
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
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /Users/emmascheck/Desktop/hormone\ app/.env.local | cut -d= -f2)
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
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /Users/emmascheck/Desktop/hormone\ app/.env.local | cut -d= -f2)
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

3. Sync to www/ and deploy to production.

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
