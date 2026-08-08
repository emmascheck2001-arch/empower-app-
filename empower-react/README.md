# Em~power — Developer Documentation

A women's hormonal health app for period and symptom tracking, cautious cycle and ovulation estimates, workout planning, nutrition ranges, and visit preparation. Cycle timing is useful context, but it never forces a workout or claims to diagnose a hormone state. Built as a React + Vite SPA, deployed on Netlify, with Supabase as the backend.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite (routes lazy-loaded, wrapped in an app-wide ErrorBoundary) |
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

The root directory of the repo contains legacy HTML files and `www/` — these are not deployed and can be ignored entirely. Continuous integration (lint + tests + build + production `npm audit`) runs via `.github/workflows/ci.yml` at the repo root.

---

## Routing

| Route | Component | Notes |
|---|---|---|
| `/login` | Login.jsx | Auth entry point |
| `/setup` | Setup.jsx | Onboarding — runs once, re-accessible |
| `/dashboard` | Dashboard.jsx | Main screen |
| `/log` | Log.jsx | Full daily symptom + biometric log |
| `/checkin` | Log.jsx | Alias of `/log` — the check-in and full log are one merged screen (quick questions + "add more detail"). There is no separate Checkin.jsx. |
| `/workout` | Workout.jsx | Activity picker + guided workout player |
| `/nutrition` | Nutrition.jsx | Phase-aware nutrition guidance |
| `/calendar` | Calendar.jsx | Cycle calendar with future day planning |
| `/sleep` | Sleep.jsx | Sleep guidance and logging |
| `/learn` | Learn.jsx | Science articles |
| `/ask` | Ask.jsx | "Ask Em~power" — answers from the user's own data + a cited topic bank (no LLM) |
| `/visit-prep` | VisitPrep.jsx | Turns tracked data into a doctor-ready summary |
| `/friends` | Friends.jsx | Friends feature (phase-card sharing, opt-in visibility) |
| `/feedback` | Feedback.jsx | User feedback form |
| `/privacy` | Privacy.jsx | Privacy policy + self-serve account deletion |
| `/terms` | Terms.jsx | Terms of Use (public) |

Auth is handled by `<AuthGuard>` in `App.jsx`. All routes except `/login`, `/privacy`, and `/terms` require authentication. Route components are lazy-loaded (see `App.jsx`) so each screen ships as its own chunk.

---

## The core concept: user paths

Users choose the path that matches their current hormonal context. This determines which tracking and estimates are appropriate.

| `user_path` in DB | What it means | Phase logic |
|---|---|---|
| `'1'` | Knows last period date | Full cycle phase calculation |
| `'5'` | Currently on hormonal BC | Observation mode, BC-specific guidance |
| `'2'` | Just came off birth control | Observation mode, recovery tracking |
| `'3'` | Irregular cycles or unsure | Symptom inference as fallback |
| `'4'` | Perimenopause / menopause | Perimenopause-specific logic, no cycle calculation |
| `'6'` | Pregnant | Pregnancy mode; natural-cycle, period, LH, and fertile-window predictions are paused |

**Important:** The database IDs do not match the display order in the onboarding UI. This is intentional — IDs were assigned in order of development.

---

## The algorithm: `getTodayStatus()`

**File:** `src/lib/hormoneSync.js`

This is the single most important function in the app. Every screen calls it on load and uses its return value to personalise content. Never re-implement phase logic in individual screens — it all lives here.

### What it does

1. Loads the user's profile, cycle data, and recent/history logs from Supabase
2. Checks user path and runs the appropriate calculation:
   - **Path 4 (perimenopause):** Returns early with perimenopause-specific values — skips all cycle calculation
   - **Path 5 (on BC):** Returns early with BC-specific observation mode values
   - **Path 6 (pregnancy):** Returns pregnancy context and pauses natural-cycle predictions
   - **Natural/post-contraception paths:** Calculates a calendar estimate from period history; with no anchor, only objective signals such as LH, cervical fluid, and a sustained temperature pattern can support a low-confidence estimate
3. Runs safety-pattern checks, uncertainty scoring, contextual mood observations, and personalisation
4. Returns a single object consumed by every screen

### Return shape

```javascript
{
  phase,              // 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal' | 'Perimenopause' | 'observation'
  subPhase,           // 'Early luteal' | 'Mid luteal' | 'Late luteal' | 'Early follicular' | null
  cycleDay,           // number | null
  cycleLen,           // number
  daysUntilPeriod,    // number | null
  confidence,         // 0.0 to 1.0 — INTERNAL flag-gating value, never shown to users
  confidenceLabel,    // internal label (legacy)
  confidencePct,      // internal, legacy — do not display
  personalisationPct,   // 0 to 100 — USER-FACING "how personalised your guidance is"
  personalisationLabel, // human-readable label for the above
  intensityModifier,  // always 1 — phase is never a weight multiplier
  intensityLabel,     // readiness-led guidance
  nutritionTargets,   // ranges when weight is supplied; never an invented exact target
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
// Ovulation is ~14 days BEFORE the next period (cycleLen − 14), NOT mid-cycle. Mid-cycle is only
// correct for a 28-day cycle; see getOvulationDay() in hormoneSync.js.
function getPhase(cycleDay, cycleLen) {
  const ovulation = Math.max(8, Math.round((cycleLen || 28) - 14))
  if (cycleDay <= 5) return 'Menstrual'
  if (cycleDay <= ovulation - 2) return 'Follicular'
  if (cycleDay <= ovulation + 1) return 'Ovulatory'
  return 'Luteal'
}
```

All day-difference math must use the DST-safe helpers in `src/lib/dateUtils.js` (`diffCalendarDays`, `daysAgo`, `addDays`), never `(a - b) / 86400000` on local-midnight dates.

Luteal sub-phases (Early / Mid / Late) are calculated from days since ovulation. Follicular sub-phases (Early / Late) are calculated from cycle day.

### Training behavior

`intensityModifier` remains for compatibility but is always `1`. The app keeps the user's planned session when they feel well and adapts only from direct information such as pain, very heavy bleeding, illness, sleep, a difficult warm-up, recent performance, or a repeated personal pattern. Calendar phase remains visible context because cycle effects are real for some women, but average research findings are too variable to prescribe a universal load change.

### Personalisation vs. internal confidence

There are two distinct numbers, and they must not be conflated:

- **`personalisationPct` / `personalisationLabel`** measures data coverage, not accuracy. It starts at 0, grows from meaningful user-reported logs and completed cycles, and is capped below 100 because the app is never fully certain.
- **`confidence`** (0–1) is an INTERNAL gating value, reduced by limited history, variability, stale data, contradictions, or inferred timing. It is not statistically calibrated and must never be displayed as a probability.

### Symptom inference

When a user has no period date, `inferPhaseFromSymptoms()` does not use mood, energy, workout feel, absolute resting heart rate, or serum labs to infer phase. It requires at least two objective observations—such as compatible LH and cervical-fluid signals—and caps the result at low confidence. A sustained, consistently measured temperature shift can only add retrospective ovulation context.

---

## `algorithm_v3.js`

**File:** `src/lib/algorithm_v3.js`

Pure computation module. No Supabase calls. Imported by `hormoneSync.js`.

Key exports:

| Function | Purpose |
|---|---|
| `interpretMoodSignal()` | Adds cycle timing as one possible context without changing phase confidence |
| `getMoodContextFeedback()` | Returns personalised mood context card content |
| `detectPMDDPattern()` | Legacy pure helper; production safety flags use actual recorded cycle anchors and repeated contrast |
| `getPersonalisedNutritionFocus()` | Returns the symptom area most relevant to recent logs |
| `getPersonalisedWorkoutReadiness()` | Returns personalised readiness note from recent workout feel |
| `getNutritionTargets()` | Calculates broad protein ranges when body weight is known; no default body or phase calories |
| `getIntensityModifier()` | Compatibility value fixed at 1 |
| `PHASE_PREDICTIONS` | Compatibility labels with phase-neutral training and nutrition guidance |
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

Key fields: `energy` · `symptoms[]` · `mood[]` · `sleep_quality` · `resting_hr` · `resting_hr_exact` · `wrist_temp` · `temperature_source` · `lh_result` · `workout_feel` · `workout_imported` · `workout_feel_reported` · `hormonal_context` · `disruptors[]` · `flow_volume` · `pain_rating` · `hot_flash_count` · `night_sweats_severity` · `joint_pain_rating` · `brain_fog_rating` · stored hormone-result fields

### `mucus_logs`
`id` · `user_id` · `log_date` · `discharge_type` · `spotting_type` · `notes`

Unique constraint on `(user_id, log_date)`. Always upsert.

### `user_feedback`
`id` · `user_id` · `user_email` · `category` · `screen` · `description` · `followup_answer` · `frustration_rating` · `priority` · `status` · `developer_notes` · `resolved_at`

### `user_baselines` / `cycle_summaries`
`user_baselines` IS now written: `getTodayStatus()` upserts the accumulated learning (cycles tracked, average cycle length, model confidence, keyed by `id` = the user's uid) on each load, and VisitPrep + the personal-baseline card read it. `cycle_summaries` is defined but not yet written by the app.

### Database migrations & tests
SQL migrations and pgTAP tests live in `supabase/`:
- `supabase/migrations/000{1,2,3,4,5}_*.sql` — schema, RLS, guarded functions, validation constraints, observation provenance, hormonal-context separation, progression fields, and friend privacy.
- `supabase/tests/*.sql` — pgTAP tests asserting RLS is enabled, functions are SECURITY DEFINER with pinned `search_path`, and that `anon`/`public` have no EXECUTE.
Apply with `supabase db push`; run tests with `supabase test db`. See `supabase/migrations/README.md`.

### `friendships` / `friend_visibility`
Power the Friends feature (`/friends`). `friendships` holds `requester_id`, `addressee_id`, and `status` (`pending` | `accepted`). `friend_visibility` holds owner-only flags for which fields a friend may see. Both have RLS scoped to the owner / participants.

---

## Security: friend functions

The Friends feature uses guarded Postgres `SECURITY DEFINER` functions. Because `SECURITY DEFINER` bypasses Row Level Security, these functions check access themselves:

- **`get_friend_card(target_user_id)`** — returns a friend's phase card only if an `accepted` friendship exists between the caller and the target. Not callable by anonymous users.
- **`find_user_by_email(search_email)`** — returns a user's UUID for the add-friend flow. Authenticated callers only.
- **`respond_friend_request(friendship_id, accept_request)`** — lets only the pending request's addressee accept or decline it; direct table updates are revoked.

If you ever add another `SECURITY DEFINER` function, it must verify `auth.uid()` against the data it returns, and `EXECUTE` must not be granted to `anon` unless the data is genuinely public. (A June 2026 audit caught these two leaking health data to anyone with an email — do not reintroduce that pattern.)

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
