# Em~power — Developer Documentation

A women's hormonal health app that adapts workout intensity, nutrition targets, and daily guidance to a user's menstrual cycle phase or hormonal context. Built as a React + Vite SPA, deployed on Netlify, with Supabase as the backend.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend / DB | Supabase (Postgres + Auth) |
| Hosting | Netlify |
| Styling | Inline styles (no CSS framework) |
| Icons | Tabler Icons webfont |

---

## Getting started

```bash
cd empower-react
npm install
npm run dev          # local dev server at localhost:5173
npm run build        # production build to dist/
netlify deploy --dir dist --site 11d125ac-cd81-4060-8dc1-2b6b580265ed --prod
```

The `_redirects` file in `public/` is required for Netlify SPA routing (`/* /index.html 200`). Do not remove it.

---

## Project structure

```
empower-react/
├── src/
│   ├── pages/           # One file per screen
│   ├── components/      # Shared UI (BottomNav, TopBar, Spinner)
│   ├── lib/
│   │   ├── supabase.js       # Supabase client (initialised once here)
│   │   ├── hormoneSync.js    # Core algorithm — getTodayStatus()
│   │   └── algorithm_v3.js   # Signal processing, mood analysis, personalisation
│   └── App.jsx          # Router + AuthGuard
├── public/
│   ├── _redirects       # Netlify SPA routing
│   ├── sw.js            # Service worker (PWA)
│   └── manifest.json    # PWA manifest
└── index.html
```

The root directory of the repo contains legacy HTML files and `www/` — these are not deployed and can be ignored entirely.

---

## Routing

| Route | Component | Notes |
|---|---|---|
| `/login` | Login.jsx | Auth entry point |
| `/setup` | Setup.jsx | Onboarding — runs once, re-accessible |
| `/dashboard` | Dashboard.jsx | Main screen |
| `/log` | Log.jsx | Full daily symptom + biometric log |
| `/checkin` | Checkin.jsx | Quick 5-question morning check-in |
| `/workout` | Workout.jsx | Activity picker + guided workout player |
| `/nutrition` | Nutrition.jsx | Phase-aware nutrition guidance |
| `/calendar` | Calendar.jsx | Cycle calendar with future day planning |
| `/sleep` | Sleep.jsx | Sleep guidance and logging |
| `/learn` | Learn.jsx | Science articles |
| `/feedback` | Feedback.jsx | User feedback form |
| `/privacy` | Privacy.jsx | Privacy policy |

Auth is handled by `<AuthGuard>` in `App.jsx`. All routes except `/login` and `/privacy` require authentication.

---

## The core concept: user paths

Users choose one of five paths during onboarding. This determines everything about how the app calculates their phase and personalises content.

| `user_path` in DB | What it means | Phase logic |
|---|---|---|
| `'1'` | Knows last period date | Full cycle phase calculation |
| `'5'` | Currently on hormonal BC | Observation mode, BC-specific guidance |
| `'2'` | Just came off birth control | Observation mode, recovery tracking |
| `'3'` | Irregular cycles or unsure | Symptom inference as fallback |
| `'4'` | Perimenopause / menopause | Perimenopause-specific logic, no cycle calculation |

**Important:** The database IDs do not match the display order in the onboarding UI. This is intentional — IDs were assigned in order of development.

---

## The algorithm: `getTodayStatus()`

**File:** `src/lib/hormoneSync.js`

This is the single most important function in the app. Every screen calls it on load and uses its return value to personalise content. Never re-implement phase logic in individual screens — it all lives here.

### What it does

1. Loads the user's profile, cycle data, and last 14 days of logs from Supabase
2. Checks user path and runs the appropriate calculation:
   - **Path 4 (perimenopause):** Returns early with perimenopause-specific values — skips all cycle calculation
   - **Path 5 (on BC):** Returns early with BC-specific observation mode values
   - **All others:** Calculates phase from last period date, or falls back to symptom inference
3. Runs anomaly detection, confidence scoring, mood analysis, and personalisation
4. Returns a single object consumed by every screen

### Return shape

```javascript
{
  phase,              // 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal' | 'Perimenopause' | 'observation'
  subPhase,           // 'Early luteal' | 'Mid luteal' | 'Late luteal' | 'Early follicular' | null
  cycleDay,           // number | null
  cycleLen,           // number
  daysUntilPeriod,    // number | null
  confidence,         // 0.0 to 1.0 — how personalised recommendations are
  confidenceLabel,    // human-readable label for confidence level
  confidencePct,      // 0 to 100
  intensityModifier,  // 0.70 to 1.05 — multiplier applied to workout weights
  intensityLabel,     // human-readable intensity guidance
  nutritionTargets,   // { proteinG, extraCalories, headline, keyFoods, avoid, source }
  immediateFeedback,  // feedback object for most recently logged signal
  anomalies,          // array of flagged patterns worth surfacing
  predictions,        // upcoming phase/period predictions
  symptomInference,   // phase estimated from logged symptoms when no cycle data exists
  moodInsight,        // personalised mood-phase connection message
  bodyWeight,         // kg — used for nutrition calculations
  profile,            // full profile row from DB
  recentLogs,         // last 14 days of daily_logs rows
  personalisedFocus,  // { focus, reason } — symptom area most relevant to this user right now
  workoutReadiness,   // string | null — personalised note based on recent workout feel and energy
}
```

### Phase calculation

```javascript
function getPhase(cycleDay, cycleLen) {
  const ovulation = Math.round(cycleLen / 2)
  if (cycleDay <= 5) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}
```

Luteal sub-phases (Early / Mid / Late) are calculated from days since ovulation. Follicular sub-phases (Early / Late) are calculated from cycle day.

### Intensity modifiers

Grounded in published research (De Martin Topranin 2023, Hackney 2006, Colenso-Semple 2023):

| Phase | Modifier |
|---|---|
| Menstrual | 0.70 |
| Early follicular | 0.95 |
| Late follicular | 1.05 |
| Ovulatory | 1.05 |
| Early luteal | 0.92 |
| Mid luteal | 0.82 |
| Late luteal | 0.72 |
| Observation / Depo recovery | 0.72 |
| Perimenopause | 0.82 |

### Confidence scoring

Starts at 5% and increases as the user logs data. Represents how much recommendations are based on the individual's own data vs. population averages. Displayed to users as a motivator for consistent logging.

### Symptom inference

When a user has no period date (Path 3, new users), `inferPhaseFromSymptoms()` estimates the phase from logged data — cervical fluid, energy, mood, RHR, wrist temperature. Returns `null` if fewer than 3 distinct signals are detected. Inferred phases are labelled differently in the UI ("this looks like" vs. "you are in").

---

## `algorithm_v3.js`

**File:** `src/lib/algorithm_v3.js`

Pure computation module. No Supabase calls. Imported by `hormoneSync.js`.

Key exports:

| Function | Purpose |
|---|---|
| `interpretMoodSignal()` | Connects logged mood to hormonal explanation |
| `getMoodContextFeedback()` | Returns personalised mood context card content |
| `detectPMDDPattern()` | Detects cyclical mood contrast across multiple cycles |
| `getPersonalisedNutritionFocus()` | Returns the symptom area most relevant to recent logs |
| `getPersonalisedWorkoutReadiness()` | Returns personalised readiness note from recent workout feel |
| `getNutritionTargets()` | Calculates protein and calorie targets by phase and body weight |
| `getIntensityModifier()` | Returns phase intensity multiplier |
| `PHASE_PREDICTIONS` | Static per-phase training and nutrition guidance |
| `BRAIN_STATE_STYLES` | Brain state labels and descriptions by phase |

---

## Database schema

All tables are in Supabase. RLS is enabled.

### `profiles`
User settings and onboarding data.

`id` · `email` · `name` · `user_path` · `bc_type` · `bc_stop_date` · `cycle_length` · `body_weight_kg` · `fitness_level` · `onboarding_complete` · `diet_preference`

`diet_preference` stores a JSON array string e.g. `'["vegan","gluten_free"]'`. Parse with the `parseDiets()` helper in Nutrition.jsx — handles legacy single-string values.

### `cycle_data`
`id` · `user_id` · `last_period_date` · `cycle_length` · `notes`

One row per user (unique on `user_id`).

### `daily_logs`
One row per user per day. Unique constraint on `(user_id, log_date)`.

Always upsert:
```javascript
await supabase.from('daily_logs').upsert(record, { onConflict: 'user_id,log_date' })
```

Key fields: `energy` · `symptoms[]` · `mood[]` · `sleep_quality` · `resting_hr` · `resting_hr_exact` · `wrist_temp` · `lh_result` · `workout_feel` · `disruptors[]` · `flow_volume` · `pain_rating` · `hot_flash_count` · `night_sweats_severity` · `joint_pain_rating` · `brain_fog_rating` · `hormone_estradiol` · `hormone_progesterone` · `hormone_lh` · `hormone_cortisol`

### `mucus_logs`
`id` · `user_id` · `log_date` · `discharge_type` · `spotting_type` · `notes`

Unique constraint on `(user_id, log_date)`. Always upsert.

### `user_feedback`
`id` · `user_id` · `user_email` · `category` · `screen` · `description` · `followup_answer` · `frustration_rating` · `priority` · `status` · `developer_notes` · `resolved_at`

### `user_baselines` / `cycle_summaries`
Schema in place for long-term pattern analysis. Not yet written to by the app.

---

## Supabase client

**File:** `src/lib/supabase.js`

Initialised once. Always import from here:

```javascript
import { supabase } from '../lib/supabase'
```

Never use the CDN ESM import. Never initialise a second client.

---

## Auth pattern

```javascript
useEffect(() => {
  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    // load data
  }
  init()
}, [navigate])
```

Always use `navigate()` from `useNavigate()`. Never use `window.location.href`.

---

## Design system

All styling is inline. Key values:

```javascript
// Colours
background:    '#faf8f5'
panel:         '#f5f0e8'
border:        '#ede8e0'
dark:          '#2c2820'
accent:        '#c8b89a'
muted:         '#7a7268'
label:         '#9a9590'
selected-bg:   '#e8dfd0'
selected-text: '#5a4a3a'

// Layout
maxWidth: 420px, margin: '0 auto'
paddingBottom: 100px  // clears fixed bottom nav
pageMargins: 16px
cardGap: 10-12px

// Cards
background: '#fff', border: '1px solid #ede8e0', borderRadius: 14px, padding: 16px

// Primary button
background: '#2c2820', color: '#f5f0e8', borderRadius: 12px, padding: 16px, fontSize: 15px
```

Icons use the Tabler Icons webfont. Class pattern: `ti ti-[name]`. Never use emoji where a Tabler icon exists.

Serif italic text (Georgia) is used for: phase names in banners, exercise names in the workout player, hero titles.

---

## Science foundation

Every recommendation in this app has a peer-reviewed citation. The full reference list lives in `CLAUDE.md`. This is not boilerplate — this app was built because women were excluded from medical research until 1993, and almost everything previously told to women about exercise and nutrition was researched on men. Getting the science right is the entire point.

Key sources:

- **Phase training:** Colenso-Semple et al. 2023 (Frontiers), Kissow et al. 2022 (Sports Medicine)
- **RHR elevation:** De Martin Topranin et al. 2023 (IJSPP) — 1.7 bpm higher in mid-luteal
- **Intensity and cortisol:** Hackney 2006 (JSSM)
- **Nutrition targets:** ISSN 2023 position stand — 1.8 to 2.2g/kg protein in luteal phase
- **Cervical fluid:** Bigelow et al. 2004 (Human Reproduction)
- **Mood and hormones:** Backstrom et al. 2008, Lokuge et al. 2011
- **Perimenopause staging:** Harlow et al. 2012 STRAW+10
- **Wearable accuracy:** Zhu et al. 2021 (JMIR), Oura 2025 validation

**Do not add health claims without two independent peer-reviewed sources.** Use "may" not "will" for phase-specific claims. Never use diagnostic language.

---

## Deployment

```bash
cd empower-react
npm run build
netlify deploy --dir dist --site 11d125ac-cd81-4060-8dc1-2b6b580265ed --prod
```

Production: https://empowerhealth.netlify.app

Vite is configured to include a build timestamp in filenames for cache-busting.

---

## Rules for contributors

1. **Never duplicate phase logic.** All phase calculation lives in `hormoneSync.js`. Import `getTodayStatus()` — do not re-implement it.
2. **Always upsert daily data** with `onConflict: 'user_id,log_date'`.
3. **All health claims need citations** in both the code comment and the UI text.
4. **No clinical language in user-facing text.** Plain English only. The full banned terms list is in `CLAUDE.md`.
5. **Test with a new user (no data) and a 30-day user.** Both must work without errors or blank screens.
6. **Path 4 perimenopause users have an early return** in `getTodayStatus()`. Any changes to the return object shape must also be applied to the Path 4 and Path 5 early returns — they return the same shape.
7. **`www/` and `ios/` in the repo root are legacy.** Do not touch them. They are not deployed.
