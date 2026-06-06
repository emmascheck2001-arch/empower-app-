# HormoneSync — Claude Code Instructions

## Project context
Women's hormone-based fitness app. Vanilla HTML, CSS, JavaScript ES modules, Supabase JS client loaded via CDN. No build step, no npm, no framework. All files live in this folder and open directly in a browser via Live Server.

## Supabase credentials
URL: https://imgujppjvffbubnsscge.supabase.co
Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZ3VqcHBqdmZmYnVibnNzY2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQzNzIsImV4cCI6MjA5NjE4MDM3Mn0.TpjycdiHLl5iI1G8u07mVmStKZWU2fzEsuw1dUi6diU

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

## Product development mindset — apply this to every task

You are not just executing a task list. You are the lead developer of a women's health app that real women will use to understand their bodies. Your job is done when the app is genuinely excellent — not when a list is complete.

### Continuous quality loop — run this after every change

1. Open every HTML file in a mental browser simulation. Does it load without errors? Does it make sense to a first-time user? Is anything confusing, broken, or missing?

2. Check every user flow end to end:
   - New user: lands on login → creates account → setup → dashboard → sees correct phase → taps log → completes morning check-in → sees feedback card → mucus screen → saves → returns to dashboard
   - Returning user: opens app → goes straight to dashboard → taps workout → selects activity → sees phase-appropriate guidance → completes workout → sees nutrition card on completion
   - Any broken step in either flow — fix it immediately without being asked

3. After every file edit ask yourself: did this change break anything else? Check all files that import from or link to the file you just edited.

4. Look for anything a real user would find confusing, frustrating, or incomplete. Fix it. You do not need permission to improve the user experience.

### Things to fix automatically without being asked

Fix these whenever you encounter them — do not wait for instructions:

- Any JavaScript error that would appear in the browser console
- Any broken link between screens
- Any button that does not do what it says
- Any screen that shows blank or loading forever
- Any text that is truncated, overflowing, or unreadable on a 390px mobile screen
- Any form that does not save correctly
- Any screen missing a loading state
- Any screen missing an error state — if Supabase fails the user must see a helpful message not a blank screen
- Any duplicate code doing the same thing in two files — consolidate it
- Any hardcoded value that should come from the database
- Any science claim without a citation — add SOURCE NEEDED comment
- Any weight suggestion missing from the WEIGHTS dictionary
- Any exercise missing a description
- Any phase guidance that contradicts the research in this file
- Any mobile layout issue — the app must look perfect on a 390px iPhone screen at all times
- Any muscle group combination that does not reflect how real women actually train in the gym — fix it
- Any time you write, edit, or improve any health-related content — phase descriptions, workout guidance, nutrition advice, hormone interpretations, symptom explanations, or any text a user will read about their body — stop and ask: what peer-reviewed research supports this specific claim? If the answer is in the Research Foundation section of this file use it. If the answer requires a source not listed here search your training knowledge for the most recent peer-reviewed study on that specific topic, cite it with author year and journal, and add it to the Research Foundation section of this file so it is available for future sessions. If you cannot find a credible peer-reviewed source for the claim do not write the claim. Write SOURCE NEEDED instead. This rule has no exceptions. The research requirement applies to every single sentence a user will read about their health.

### Run this full audit continuously

Run through this audit after every session and fix everything found before stopping:

**Code quality audit**
- No console errors on any screen
- No undefined variables
- No functions called before they are defined
- No async functions missing await
- All Supabase calls wrapped in try-catch
- All upserts use onConflict parameter
- No duplicate phase calculation logic — only hormoneSync.js

**UX audit — simulate being a real user**
- Can a complete stranger figure out how to use this app in under 60 seconds with no instructions?
- Does every button have a clear label?
- Does every screen have a clear purpose visible within 3 seconds of opening?
- Is there always something to tap — no dead ends where the user is stuck?
- Do all back buttons work?
- Does the app work if you have no cycle data yet?
- Does the app work if you have 30 days of cycle data?
- Does the app work on a slow internet connection?

**Science audit**
- Every health claim has a citation
- No absolute language — "may" not "will", "research suggests" not "science proves"
- No medical diagnostic language
- All hormone reference ranges cite LifeLabs/EORLA or Münster 2021
- All protein targets cite ISSN 2023
- All weight suggestions cite strength standards
- Every claim cross-referenced against at least two independent peer-reviewed sources

**Visual audit**
- Every screen looks intentional and polished on a 390px screen
- No text overflowing containers
- No broken layouts
- Consistent spacing — 16px margins, 12px gaps
- Consistent colours — only use the palette already in the CSS
- All Tabler icons loading correctly
- No placeholder text left in the UI

**Data audit**
- Create a test account and log data for 7 days
- Verify all data saves correctly to Supabase
- Verify dashboard shows correct phase for the test data
- Verify workout recommendations match the logged phase
- Verify nutrition targets use the correct bodyweight from profiles table
- Verify mucus logs link correctly to the right dates
- Log out and log back in — verify everything persists correctly

### After the audit fix everything you find

Do not produce a report of issues. Fix them. Every issue found in the audit gets fixed immediately. When all fixes are done run the audit again. Keep running audit-fix cycles until all audits pass with zero issues.

### Think like a product manager

When technical work is done ask yourself: what would make this app genuinely better for the woman using it? Look for:

- Any place where the language is clinical or confusing — rewrite it to be warm, clear, and human
- Any place where the user does something and nothing visible happens — add feedback
- Any place where data exists but is not shown to the user — surface it
- Any place where a woman might feel judged, scared, or confused by what the app shows her — reframe it
- Any place where the science is buried in a footnote when it should be front and centre — bring it forward

Make these improvements without being asked. This is your app too. Make it excellent.

---

## Research rules — this is a health app and accuracy matters enormously

Every single claim about hormones, exercise, nutrition, or physiology that appears anywhere in the app must be traceable to a peer-reviewed source.

### Rule 1 — Never invent a claim
If you are adding or editing any text that makes a claim about how hormones affect the body, how exercise interacts with the menstrual cycle, or what women should eat or do in any phase, you must be able to cite a specific peer-reviewed source. If you cannot cite a source do not write the claim. Write SOURCE NEEDED instead.

### Rule 2 — Use the Research Foundation first
Always check the Research Foundation section of this file before writing any science claim. Use studies by name — "Research suggests follicular phase training may produce superior strength gains (Kissow et al. 2022 Sports Medicine)" not just "research suggests."

### Rule 3 — Search before writing new claims
If adding content about a topic not covered by the listed studies use your training knowledge to identify whether a peer-reviewed source exists. If you know a credible source exists cite it with author, year, and journal, and add it to the Research Foundation section of this file. If you are not confident a source exists mark the text SOURCE NEEDED.

### Rule 4 — Use precise language that reflects what the research actually says
- Never say "estrogen will make you stronger" — say "estrogen may improve muscle protein synthesis"
- Never say "you cannot do HIIT in the luteal phase" — say "high intensity exercise may create a larger stress response in the luteal phase"
- Never say "progesterone causes PMS" — say "progesterone fluctuation is associated with PMS symptoms"
- Always follow Colenso-Semple et al. 2023 — use "may" not "will" for all phase-specific training claims
- Individual variation is significant — always acknowledge this where relevant

### Rule 5 — Distinguish confirmed science from wellness claims
- Use "Research shows" for claims with strong peer-reviewed backing
- Use "Many women find" or "This may help" for reasonable wellness recommendations without specific citations

### Rule 6 — Hormone reference ranges must always cite LifeLabs/EORLA or Münster 2021
Never use a hormone reference range without citing its source. Never show a value as abnormal or concerning without a citation.

### Rule 7 — Nutrition targets must cite ISSN 2023
Do not invent nutrition numbers. Luteal phase protein 1.8 to 2.2g per kg bodyweight, energy intake 200 to 300 kcal above follicular phase.

### Rule 8 — Weight and strength recommendations must cite strength standards
Any suggested weight range must cite Arvo strength standards 2026, ExRx female norms, or Strengthlevel.com female percentiles. Use the median across all sources.

### Rule 9 — Do not make medical claims
This app is a wellness tool not a medical device. Forbidden language:
- Never say "you have low progesterone" — say "this pattern is sometimes associated with lower progesterone levels and is worth tracking"
- Never say "this indicates a luteal phase defect" — say "this pattern may be worth discussing with your doctor if it persists"
- Never say "you are ovulating" — say "these signals are consistent with ovulation"
- Never say "your hormones are abnormal" — say "this value is outside the typical reference range"
Always include "consult your doctor" language when flagging a potentially concerning pattern.

### Rule 10 — Add a source comment to every science note in the code
Every science note string must end with a comment showing the source:
```javascript
// Source: Arvo strength standards 2026 female intermediate percentile at 65kg bodyweight
{ range: '50 to 75kg', science: 'Intermediate female squat standard 1.2x bodyweight at 65kg (Arvo 2026)' }
```

---

## Cross-referencing and fact verification

Every health claim, hormone value, training recommendation, nutrition target, and science note must be cross-referenced against at least two independent peer-reviewed sources before it appears in the UI. One source is not enough. If two sources agree the claim is solid. If two sources disagree use the more conservative claim and note the disagreement.

### Cross-reference matrix

**Hormone reference ranges — cross-reference ALL of these:**
- Münster et al. 2021 (ScienceDirect) — primary source
- LifeLabs/EORLA Canadian laboratory reference ranges — Canadian clinical standard
- Endocrine Society Clinical Practice Guidelines 2018
- ACOG (American College of Obstetricians and Gynecologists)
If all four agree use the value. If any disagree use the most conservative range.

**Exercise and training recommendations — cross-reference ALL of these:**
- Colenso-Semple et al. 2023 (Frontiers) — phase-specific training caveat
- Kissow et al. 2022 (Sports Medicine) — follicular phase training
- Janse de Jonge 2003 (Sports Medicine) — menstrual cycle and exercise performance
- Sims and Yeager ROAR 2024 — comprehensive women's exercise science
- ACE (American Council on Exercise) guidelines
- ACSM (American College of Sports Medicine) guidelines
If any source contradicts a training recommendation flag it and use the most conservative safe recommendation.

**Nutrition targets — cross-reference ALL of these:**
- ISSN 2023 position stand — primary source for protein targets
- Larivière et al. 2006 — luteal phase amino acid utilisation
- USDA Dietary Guidelines 2020-2025
- Health Canada dietary guidelines — Canadian standard
If ISSN 2023 and Health Canada disagree show the Health Canada value to Canadian users and note the ISSN recommendation separately.

**Weight and strength standards — cross-reference ALL of these:**
- Arvo strength standards 2026 female percentiles
- ExRx female strength norms
- Strengthlevel.com female percentiles
- Powerlifting America female classification standards
Use the median across all sources. Never use a single source for a weight suggestion.

**Cervical mucus and fertility signs — cross-reference ALL of these:**
- Bigelow et al. 2004 (Human Reproduction)
- Wilcox et al. 2000 (NEJM) — fertile window timing
- World Health Organization fertility awareness guidelines
- Fertility Awareness Method clinical guidelines

**Temperature and wearable data — cross-reference ALL of these:**
- Zhu et al. 2021 (JMIR)
- Oura Ring 2025 validation study
- Stanford wearables research group publications
- BBT clinical fertility guidelines

### 20 specific claims that must be verified before the app ships

For each claim add a cross-reference comment in the code:
- VERIFIED: both sources agree — // VERIFIED: [claim] — Source 1: Author Year Journal. Source 2: Author Year Journal.
- One source only — // SINGLE SOURCE: [claim] — Source: Author Year Journal. NEEDS SECOND SOURCE before app ships.
- No source found — // UNVERIFIED: [claim] — REMOVE OR REPLACE before app ships.

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
11. Ovulation confirmed when day 21 progesterone exceeds 10 nmol/L
12. LH surge threshold is 8 IU/L
13. Luteal phase length is relatively fixed at 12 to 14 days across women
14. Depo-Provera recovery hormone environment resembles the menstrual phase
15. Cool water may reduce prostaglandin activity during menstruation
16. HIIT in luteal phase creates larger cortisol stress response than follicular
17. Sleep quality is impaired in mid-luteal phase
18. 10 sets per week per muscle group is optimal for hypertrophy
19. Nordic hamstring curl reduces ACL injury risk in women
20. Progesterone has anxiolytic effect via GABA-A receptor interaction in luteal phase

### Language rules that prevent factual challenges

- Never say a percentage without citing the study. "96.4% accuracy" must always be followed by "(Oura Ring 2025 validation study)"
- Never say "research shows" without naming the research. Always say "Münster et al. 2021 found" or "according to the ISSN 2023 position stand"
- Never say "women experience" without clarifying this is a population average with individual variation
- Never say "your hormones are" — always say "your hormone levels appear to be" or "this pattern is consistent with"
- Never say "this confirms" — say "this is consistent with" or "this suggests"
- Never round hormone values in a way that changes clinical significance. 9.8 nmol/L progesterone is NOT the same as 10 nmol/L
- Always include sample sizes when citing studies. "Münster et al. 2021 n=97 women 2105 cycles" not just "Münster et al. 2021"

### Credibility standard

Imagine a GP, a registered dietitian, a certified personal trainer, and a reproductive endocrinologist all read every word in this app. Would any of them find a factual error? If yes fix it. If unsure flag it SOURCE NEEDED. A medical professional should be able to read this app and find nothing clinically incorrect.

---

## Files in this project
- login.html — sign in and create account
- setup.html — onboarding for new users, four paths
- dashboard.html — main home screen showing phase, nutrition card, log streak
- log.html — daily symptom and biometric log with 5-question morning check-in as default
- mucus.html — cervical mucus and spotting log
- workout.html — activity picker, muscle group selector, guided workout player
- checkin.html — 5-question morning check-in
- hormoneSync.js — shared getTodayStatus function used by all screens
- feedback.html — trial user feedback screen with smart follow-up questions, stores to user_feedback table

## Database tables
- profiles — id, email, name, user_path, bc_type, bc_stop_date, cycle_length, body_weight_kg, fitness_level, onboarding_complete
- cycle_data — id, user_id, last_period_date, cycle_length, notes
- daily_logs — id, user_id, log_date, energy, symptoms[], workout_feel, mood[], sleep_quality, resting_hr, disruptors[], wrist_temp, lh_result, hormone_estradiol, hormone_progesterone, hormone_lh, hormone_cortisol, notes. Unique constraint on (user_id, log_date).
- mucus_logs — id, user_id, log_date, discharge_type, spotting_type, notes. Unique constraint on (user_id, log_date).
- cycle_summaries — id, user_id, cycle_number, cycle dates, phase lengths, ovulation data
- user_baselines — id, avg_cycle_length, avg_luteal_length, temp_follicular_baseline, rhr_follicular_baseline, pms_days_before, peak_energy_day, cycles_tracked, model_confidence

Always use upsert with onConflict: 'user_id,log_date' when saving daily data.

---

## Research Foundation — always check here first, always add new sources here

- Münster et al. 2021 (ScienceDirect, n=97 women 2105 cycles) — hormone reference values. Follicular progesterone under 3 nmol/L. Mid-luteal progesterone 10 to 50 nmol/L median 28.8. Ovulatory E2 222 to 1959 pmol/L. LH surge above 8 IU/L.
- De Martin Topranin et al. 2023 (IJSPP) — RHR 1.7 bpm higher in mid-luteal vs early follicular (P=.006). Sleep quality impaired in mid-luteal.
- Oura Ring 2025 validation study — 96.4% ovulation detection accuracy, error plus or minus 1.26 days.
- Zhu et al. 2021 (JMIR) — wrist temperature 86.2% accuracy for ovulation detection. Shift 0.3 to 0.5 degrees Celsius above follicular baseline.
- Colenso-Semple et al. 2023 (Frontiers) — no consistent evidence strength outcomes differ by phase. Always use "may" not "will" for phase-specific training claims.
- Kissow et al. 2022 (Sports Medicine) — follicular phase resistance training may produce superior strength gains.
- ISSN 2023 position stand — luteal phase protein 1.8 to 2.2g per kg bodyweight. Energy +200 to 300 kcal above follicular. Progesterone increases protein catabolism.
- Hackney 2006 (Journal of Sports Science and Medicine) — progesterone and cortisol compete for glucocorticoid receptors. High intensity exercise in luteal phase creates larger net stress response than same session in follicular.
- Bigelow et al. 2004 (Human Reproduction) — egg white cervical mucus 80% sensitivity for fertile window.
- LifeLabs/EORLA Canadian reference ranges — used for all hormone interpretation. Canadian clinical standard.
- Arvo strength standards 2026, ExRx female norms, Strengthlevel.com — used for weight suggestions.
- Sarwar R, Niclos BB, Rutherford OM. Journal of Physiology. 1996;493(Pt 1):267-272 — muscle strength peaks in follicular phase.
- Charkoudian N, Stachenfeld NS. Comprehensive Physiology. 2014;4(2):793-804 — progesterone raises core temperature, delays sweating onset.
- Angeli A et al. European Journal of Sport Science. 2016 — iron loss during menstruation impacts exercise performance.
- Bernárdez-Vázquez R et al. Frontiers in Sports and Active Living. 2022 — 10 sets per week per muscle group optimal for hypertrophy.
- Janse de Jonge XAK. Sports Medicine. 2003;33(11):833-851 — individual hormone variability means personal tracking beats population averages.
- Sims ST, Yeager S. ROAR Revised Edition. Rodale/Random House. 2024 — women are not small men, synthesises 170+ peer-reviewed studies.
- Larivière F et al. American Journal of Physiology. 2006 — luteal phase amino acid utilisation changes.
- Wilcox et al. 2000 (NEJM) — fertile window timing research.
- Shirtcliff EA, Granger DA et al. Hormones and Behavior. 2000;38:137-147 — salivary hormone measurement validity.
- Endocrine Society Clinical Practice Guidelines 2018 — hormone reference standard.
- ACOG guidelines — clinical reference for reproductive health.
- ACE guidelines — exercise science standard.
- ACSM guidelines — clinical exercise standard.
- Health Canada dietary guidelines — Canadian nutrition standard.

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
- Observation mode (Depo recovery or no cycle data): 0.72 — resembles menstrual phase due to suppressed estrogen

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

## Muscle group options — these are the correct real-world training splits
Replace any other combination with these. Nobody trains calves and core together as a standalone split.

- Chest, shoulders and triceps — bench press, overhead press, lateral raise, dips
- Back and biceps — deadlift, rows, pull-ups, curls, rear delts
- Legs — quads, hamstrings, glutes, and calves all together
- Glutes and hamstrings — hip thrust, RDL, leg curl, kickback — posterior chain focus day
- Glutes only — hip thrust, cable kickback, abduction, isolation day
- Push — all pushing movements, chest, shoulders, triceps
- Pull — all pulling movements, back, biceps, rear delts
- Upper body — push and pull combined
- Full body — everything in one session
- Core — dead bug, plank, Pallof press, Copenhagen plank, ab wheel, loaded carry — standalone finisher

## Auth and session protection — add to every screen except login.html
```javascript
const { data: { session } } = await supabase.auth.getSession()
if (!session) { window.location.href = 'login.html'; return }
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

## Upsert pattern — always use this for daily data
```javascript
await supabase.from('daily_logs').upsert(record, { onConflict: 'user_id,log_date' })
await supabase.from('mucus_logs').upsert(record, { onConflict: 'user_id,log_date' })
```

## getTodayStatus — the single shared function for all screens
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

---

## Ongoing work — what to do every session

There is no fixed task list. Every session do all of the following:

1. Re-read this entire file
2. Run the continuous quality loop on every file
3. Run the full audit — code, UX, science, visual, data
4. Fix everything found — do not report, fix
5. Cross-reference every health claim against two sources
6. Add any new research sources found to the Research Foundation section above
7. Think like a product manager — what would make this better for a real woman using it today
8. Run the audit again after all fixes
9. Keep going until zero issues remain

Never stop because you ran out of obvious things to do. There is always something that can be improved, verified, or made more human.


---

## Trial user feedback system — check and process this every session

Real women are testing this app and submitting feedback through feedback.html. Every session check for new feedback, analyse it, propose the best fix options, and wait for Emma to say yes before implementing anything.

### Step 1 — Check for new feedback at the start of every session

```javascript
const { data: feedback } = await supabase
  .from('user_feedback')
  .select('*')
  .eq('status', 'pending')
  .order('frustration_rating', { ascending: false })
```

If no pending feedback continue with the normal quality loop. If there is pending feedback stop everything and process it first.

### Step 2 — For each feedback item analyse and present to Emma in this exact format

---
FEEDBACK #[id] — [priority]
User reported: "[their exact words]"
Screen: [screen] — Frustration: [rating]/5

What they want: [one sentence]

OPTION A — [simplest fix, estimated time]
What: [exact description]
Files: [list]
Risk: [low/medium/high and why]

OPTION B — [complete fix, estimated time]
What: [exact description]
Files: [list]
Risk: [low/medium/high and why]

My recommendation: Option [A/B] because [one sentence]

Reply YES A, YES B, or NO to skip.
---

### Step 3 — Wait for Emma's reply before implementing anything

### Step 4 — When Emma says yes implement immediately then mark resolved

```javascript
await supabase.from('user_feedback').update({
  status: 'resolved',
  developer_notes: 'Fixed — [one sentence describing the change]',
  resolved_at: new Date().toISOString()
}).eq('id', feedbackId)
```

### Step 5 — Watch for patterns across multiple feedback items

If three or more users report the same issue flag it as a systemic problem and present it to Emma separately with a recommended solution.

### Also add a subtle feedback link to dashboard.html above the bottom nav

```html
<div style="text-align:center;padding:12px 0;margin-bottom:8px">
  <a href="feedback.html" style="font-size:12px;color:#9a9590;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
    <i class="ti ti-message-circle" style="font-size:14px"></i>
    Share feedback
  </a>
</div>
```

### Also add feedback.html to the files list at the top of this file

feedback.html — trial user feedback screen with smart follow-up questions, stores to user_feedback table
