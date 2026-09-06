# Em~power Apple Watch app — spec

**Status:** planning. This is a *native watchOS (SwiftUI) app*, a companion to the existing
Capacitor iPhone app. The iPhone app can't run on the watch (no webview on watchOS), so the
watch screens are rebuilt natively — but the content is text/numbers/timers, which is the
simplest and most watch-native kind of UI.

---

## 1. What it is (the vision)
A **workout-only** watch app. It uses the Em~power algorithm + workout data to show the user the
workouts recommended for **today's cycle phase**, she **picks one**, and it guides her through it
on her wrist (exercise name · weight guide · reps · rest timer). The kicker: it **monitors live
heart rate** during the workout and keeps her in her **personalized optimal zone** — flagging when
HR goes too high or too low, and **adapting the exercise in real time** to raise or lower it.

Everything is **fitness/training guidance, never medical monitoring** (see §7).

---

## 2. Architecture (reuse all the cycle logic you already have)
```
 iPhone app (existing, Capacitor/React)          Apple Watch app (NEW, SwiftUI)
 - computes phase + today's workouts     ── WatchConnectivity ──▶  - shows today's workouts
 - computes personalized HR zone                (sends a small           - live HR from HealthKit
 - resting HR, age, phase, goal                  JSON payload)           - zone flags + adapt
```
- **The phone does the thinking.** It already computes phase, the day's workouts, weights/reps,
  and it has resting HR (from the wearable sync we built) + age + goal. A small bridge sends a
  compact payload to the paired watch via **WatchConnectivity** (`updateApplicationContext` for
  the daily plan; `sendMessage` for live updates).
- **The watch is a thin native app.** It renders the received plan, reads **live heart rate from
  HealthKit on-device** during the workout (a watch workout session gives high-frequency HR),
  runs the zone logic, and drives the guided player + timers. Completed workouts write back to
  HealthKit (so they flow into the phone via the import we just built) and/or send results back
  to the phone.
- **No new backend needed** for v1 — the phone is the source of truth; the watch is a client.

### Payload the phone sends (draft)
```json
{
  "date": "2026-08-07",
  "phase": "Luteal",
  "restingHR": 58,
  "age": 30,
  "goal": "metabolic_health",
  "targetZone": { "low": 120, "high": 140, "label": "Zone 2 · aerobic base" },
  "hardCeilingBpm": 172,
  "workouts": [
    { "id": "gym-lower", "activity": "Gym", "title": "Lower body",
      "exercises": [ { "name": "Goblet squat", "weight": "12–16 kg", "reps": "3×10", "rest": 75 } ] },
    { "id": "walk", "activity": "Walk", "title": "Zone 2 walk", "durationMin": 35 }
  ]
}
```

---

## 3. Screens / flow
1. **Today** — "Luteal phase · recovery-leaning" + the day's workout list (Gym · Yoga · Walk…).
   Tap one.
2. **Workout overview** — title, est. duration, the target HR zone for today ("Aim: Zone 2,
   120–140 bpm").
3. **Guided player** (per exercise) — big exercise name · weight guide · reps · a rest **timer**;
   swipe/crown for next. A persistent **live HR** readout + a small zone bar (below/in/above).
4. **Live HR coaching** (the kicker) — if HR drifts out of the target zone, a gentle haptic +
   card: *"Heart rate's climbing above today's zone — let's bring it down"* → offers a modified
   version of the current move (see §5).
5. **Summary** — duration, avg/max HR, time-in-zone, calories; writes to HealthKit; syncs to phone.

---

## 4. Heart-rate zone model (framework — exact numbers from the science review, §6)
- **Personalized zone via Heart-Rate Reserve (Karvonen), because it uses *her* resting HR:**
  `targetHR = restingHR + %intensity × (maxHR − restingHR)`, where `maxHR ≈ 208 − 0.7×age`
  (Tanaka 2001, more accurate than 220−age).
- **Zones** (approx, %HRR): Z1 recovery 50–60 · Z2 aerobic base 60–70 · Z3 tempo 70–80 ·
  Z4 threshold 80–90 · Z5 VO2max 90–100. *(Confirm ranges + citations from the science review.)*
- **Phase-adjusts the target**, not just the day's plan: push higher-intensity windows in
  **follicular/ovulatory**; bias toward **Zone 2 + recovery** in the **luteal phase** (resting HR
  is already elevated and perceived exertion is higher — De Martin Topranin 2023). The watch
  should account for the luteal RHR bump so it doesn't false-flag.

---

## 5. The kicker: live flags + real-time exercise modification
**Inputs:** live HR, today's target zone (phase-adjusted), the current exercise's intended stimulus.

**Too HIGH — instantaneous** (spikes above a hard ceiling): brief spikes are fine/beneficial, so
this only nudges if she blows well past the day's ceiling.

**Too HIGH — SUSTAINED (the inflammation flag she specifically wants):** the watch tracks
*cumulative time* above the target zone / in Z4–Z5 across the session (a running "time-in-high"
tally, not a single reading). When that exceeds a **phase-appropriate cap** (shorter in the
luteal phase), it flags: *"You've been in a high zone for a while — let's bring it down to
recover."* The distinction is the whole point: a short spike = good stimulus; **prolonged
elevation without recovery** is what raises cortisol/inflammatory load, and women are more
susceptible. *(Exact minutes-cap + citations from the science review — RED-S/IOC 2023,
overtraining-inflammation reviews, Sims ROAR, luteal allostatic load.)*
- **Modify to LOWER HR:** reduce load/pace, extend the rest timer, cut reps, or swap to a
  mobility/breathing interval until HR returns to zone.
- **Across the week too:** roll the same idea up into the app's existing **allostatic-load**
  score — repeated long high-intensity sessions (esp. in luteal) nudge toward more recovery.

**Too LOW** (below the target band for ≥2–3 min of a work block when the goal is aerobic/threshold):
- "You've got more in you — let's lift the effort."
- **Modify to RAISE HR:** add tempo/intensity, shorten rest, add reps, or a short cardio burst.

**Accuracy rules (wrist PPG is noisy in motion, ±15–34 bpm):**
- Decide on a **30-second rolling average**, and require the condition to hold **≥60–90 s** — never
  react to a single beat.
- On an interval day, **don't flag Z5 during work bouts** — instead flag *failure to recover*
  (HR not dropping back toward Z2 in the expected rest).
- Soften/suppress flags during high-motion moves (arm-driven, plyometric); prefer a paired chest
  strap when available.

**Never:** frame any of this as detecting a heart problem or being safe/unsafe medically. It's
"in / above / below *your training zone*," a coaching cue (see §7).

---

## 6. Science to embed (peer-reviewed — from the research review)

### Zone math (personalized, uses HER resting HR)
- `HRmax = 208 − 0.7×age` (**Tanaka 2001, JACC 37:153** — sex-independent; ~±10 bpm individual
  error). **Do NOT use 220−age** (no real derivation — Robergs & Landwehr 2002). Offer a
  field-test HRmax override (always beats a formula).
- `Target = (HRmax − HRrest)×%intensity + HRrest` (**Karvonen 1957**). %HRR ≈ %VO2reserve
  (**Swain & Leutholtz 1997**), which is why it maps to effort.
- **%HRR zones:** Z1 recovery 50–60 · Z2 aerobic base 60–70 · Z3 tempo 70–80 · Z4 threshold
  80–90 · Z5 VO2max 90–100 (ACSM Guidelines 10th ed. 2018). Note these run ~10–15 pts lower than
  the %HRmax numbers marketing uses. Treat zone edges as **soft bands**.
- Worked example (age 30, rest 60): HRmax 187, HRR 127 → Z2 = **136–149 bpm**.

### Why intensity is good (the benefit side)
- Fitness is one of the strongest mortality predictors: +1 MET ≈ **−13% all-cause mortality**
  (**Kodama 2009, JAMA 301:2024**); low vs high fitness ≈ **5× mortality** (**Mandsager 2018, JAMA
  Netw Open**). HIIT raises VO2peak ~9% over moderate cardio (**Weston 2014, BJSM**).

### ⚠️ The inflammation nuance — IMPORTANT, corrects a common belief
- **Acute exercise elevation is normal and ANTI-inflammatory.** Muscle IL-6 rises up to ~100× as
  a *myokine* → triggers IL-1ra/IL-10, inhibits TNF-α (**Pedersen & Febbraio 2008, Physiol Rev
  88:1379**). Regular training **LOWERS** resting CRP/IL-6.
- So "keeping HR elevated causes inflammation" is an **oversimplification** — do not ship it. The
  real risk is **chronic under-recovery relative to load** (overtraining: **Meeusen 2013 ECSS/ACSM
  consensus**; allostatic load: **McEwen 1998, NEJM 338:171**) and, most relevant to women, **RED-S
  / low energy availability** (**Mountjoy 2023, BJSM 57:1073**). The cytokine-overtraining link is
  a hypothesis, not proven (**Smith 2000**).
- **Correct product framing:** the "too elevated for too long" flag is a **recovery/allostatic-load
  balance** feature (nudging rest when high load accumulates, esp. luteal), NOT "your heart rate is
  inflaming you." Accurate AND still exactly the feature Emma wants.

### Cycle-phase HR (small effects — personalize, don't prescribe)
- Resting HR rises **~1.7 bpm** luteal (**De Martin Topranin 2023, Front Physiol**), sleeping pulse
  **+3.8 bpm** (**Shilaih 2017, Sci Rep 7:1294**); HRV drops luteal (**Schmalenberger 2020, JCM
  9:617**). → **Re-baseline HRrest per phase** so the Karvonen zones stay accurate (the single most
  defensible phase adjustment).
- "Luteal feels harder" is **not cleanly supported** — one study found RPE highest at *menses*
  (**Delp 2023**). Phase performance effects are **trivial on average with big individual variation**
  (**McNulty 2020, Sports Med 50:1813**). Phase logic = a personalized nudge, never a rule/promise.

### Weight loss (debunk the myth)
- Fat oxidation peaks (~0.5 g/min) at **~62–64% VO2max** ("Fatmax"; **Achten 2002, MSSE 34:92**),
  but **weight loss = total energy deficit**, not fuel mix (**Donnelly 2009 ACSM Position Stand**;
  >225–250 min/wk for meaningful loss w/o diet change). HIIT and moderate cardio lose **similar**
  fat (**Wewege 2017, Obes Rev**). Don't sell a "fat-burning zone."

### Wearable accuracy → constrains the flag logic
- Wrist PPG error grows with motion (**±15–34 bpm**; **Bent 2020, npj Digit Med 3:18**;
  **Gillinov 2017, MSSE**). → **Flag only on rolling averages / sustained trends, never single
  beats**, and soften flags during high-motion moves; prefer a paired chest strap if present.

---

## 6.1 Reference table — what the watch codes against
This is the single source of truth for the zone + flag logic. **Solid = cited fact. Nudge =
personalized suggestion, tune to the user over cycles, never a rule.**

### Zones (fixed — %HRR, ACSM 2018 / Karvonen 1957)
```
maxHR      = 208 − 0.7 × age                 (Tanaka 2001)
restHR     = the user's resting HR FOR THIS PHASE   (re-baselined — see below)
HRR        = maxHR − restHR
zoneBpm(pct) = restHR + pct × HRR
```
| Zone | %HRR | Age-30 example (restHR 60 → HRR 127) |
|---|---|---|
| Z1 Recovery | 50–60% | 124–136 bpm |
| Z2 Aerobic base | 60–70% | 136–149 bpm |
| Z3 Tempo | 70–80% | 149–162 bpm |
| Z4 Threshold | 80–90% | 162–174 bpm |
| Z5 VO2max | 90–100% | 174–187 bpm |

### Per-phase config
| Phase | restHR baseline (SOLID) | Suggested target zone (NUDGE) | "Too-high" flag: ≥1 zone above target, sustained for | "Too-low" flag: below target floor for |
|---|---|---|---|---|
| **Menstrual** | this phase's measured restHR | Z2 · let live HR/RPE decide | 90 s | 3 min |
| **Follicular** | this phase's measured restHR | Z2 base + Z4–Z5 intervals OK | 120 s | 3 min |
| **Ovulatory** | this phase's measured restHR | Z4–Z5 OK · emphasize warm-up | 120 s | 3 min |
| **Luteal** | this phase's measured restHR *(naturally ~2–4 bpm higher — this is why we re-baseline)* | Z2 · recovery-leaning | 60 s *(tighter)* | 3 min |

### Session + weekly load heuristics (design rules, not proven cutoffs — label as such)
- **In-session:** cap cumulative **Z4–Z5 time** per session; suggest a recovery interval past it.
  Lower cap in luteal. (No peer-reviewed minute-threshold exists — this is a coaching heuristic.)
- **Weekly:** roll cumulative hard-zone time into the app's existing **allostatic-load** score;
  repeated long high sessions (esp. luteal) → nudge toward recovery.

### Accuracy guards (always on)
- All flags decide on a **30-sec rolling average**, never single beats (wrist PPG ±15–34 bpm in motion).
- On interval days, don't flag Z5 work bouts — flag **failure to recover** between them.
- Zone edges are **soft bands** (Tanaka ±10 bpm). Offer a field-test maxHR override.

## 6.2 Personalization — nothing is a fixed bpm (vs Orangetheory)
Orangetheory uses **% of MAX HR** (Gray 50–60 · Blue 61–70 · Green 71–83 · Orange 84–91 ·
Red 92–100) and "splat points" (1/min in Orange+Red, target 12–20/class). Their zones **ignore
resting HR** — two people the same age get identical zones regardless of fitness. Em~power is
more personal by design, on four levels:

1. **%HRR, not %maxHR.** Karvonen uses the person's own **resting HR**, which we already measure
   **daily** and **re-baseline every cycle phase**. So "Zone 2" reflects *her* fitness and *her*
   phase, not just her age. This is the core reason our zones beat OTF's.
2. **Observed max-HR override** (like OTF's "personalized max"): if her real HR ever exceeds the
   formula max in a session, raise her max to the observed value — more accurate than any formula.
3. **Personal-baseline layer (your "15 bpm above *your* normal" idea):** over sessions the app
   learns *her* typical HR for a given workout and *her* usual recovery rate, and flags
   **deviations from her own norm** ("running ~15 bpm above your usual for this session," "not
   recovering like you normally do"). This is more individual than any zone chart and is the
   truest "off the person's data" signal.
4. **No hard-coded bpm anywhere.** The only fixed numbers are the zone **percentages** (standard
   ACSM ranges) and the flag **durations** — both applied to *her* data to produce *her* bpm. We
   never write a universal "150 bpm = too high" rule. Splat-style time-in-high-zone is kept but
   **personalized + phase-adjusted**, never a fixed 12–20 for everyone.

**Rule for implementation:** every threshold the watch checks is computed at runtime from
`{ restingHR(phase), maxHR(observed or Tanaka), her learned baseline }`. Fixed constants are only
allowed for zone %s and flag timings — and even those are tuned per user over time.

## 6.3 Cold start (day 1) + learning over time
The personalization has to work from the **first session**, then improve. Three tiers, all
graceful — more data = more personal, but a first-timer with only Apple Health resting HR gets a
concrete, usable, personal zone from minute one.

### Tier 0 — Day 1 (concrete; needs only resting HR from Apple Health + age)
Every new user who's connected Apple Health already has a **resting HR** (Apple Watch computes it
daily) and an **age** (from onboarding). That's enough for fully personal zones on session one:
```
maxHR   = 208 − 0.7 × age                         (Tanaka)
restHR  = trailing 7-day median of Apple Health resting HR   (median = robust to noise)
HRR     = maxHR − restHR
zones   = restHR + %HRR × HRR                     (§6.1 table)
target  = phase suggestion (§6.1)
flags   = §6.1 durations; personal-baseline layer OFF (not enough data yet)
```
**Fallback — no resting HR at all** (never worn the watch): temporarily use **%maxHR** zones
(OTF-style) mapped to Z1–Z5, label them "estimate — connect your watch for personal zones," and
**auto-upgrade to Karvonen the moment a resting HR appears** (usually within a day of wearing it).

### Tier 1 — Phase-specific resting HR (fast: ~1–2 cycles, passive)
We already pull daily resting HR from Apple Health. Bucket each reading by **cycle phase**; once a
phase has **≥5 readings**, use *that phase's* median resting HR to recompute zones (so luteal
zones use the luteal resting HR — the ~2–4 bpm bump). Until a phase has enough, use the overall
trailing median. This needs no workouts — it builds just from wearing the watch.

### Tier 2 — Personal workout-response baseline (needs several workouts)
Per **(activity type × phase)**, log each session's avg HR, time-in-zone, and **recovery rate**
(HR drop in the first ~60 s of rest).
- After **≥3 sessions** of an activity type, compute her **rolling median** response (last ~8
  sessions, recency-weighted so it tracks fitness changes).
- **Then** the "vs your own normal" deviation flag turns on: today's steady-state HR sustained
  **>~10–15 bpm above her median** for that activity/phase → nudge down; her recovery materially
  slower than her norm → nudge/recover; below her norm when the goal is stimulus → nudge up.
- **Confidence ramp:** <3 sessions → zone logic only · 3–8 → deviation flag with wide tolerance ·
  >8 → tight, fully personalized.

### Always-on self-correction (no history needed)
- **maxHR override:** any session where observed HR > current max → set max = observed, immediately.
- Resting HR refreshes daily from Apple Health; zones recompute each morning.

**Summary:** Day 1 works off Apple Health resting HR + age (concrete). Tier 1 sharpens within a
cycle or two just from wearing the watch. Tier 2 adds the true "your own normal" layer after a
handful of workouts. Nothing blocks a first-time user.

---

## 7. Safety / regulatory framing (non-negotiable)
- **Fitness & wellness guidance, NOT a medical device.** The watch app must never claim to
  detect, diagnose, or warn about a cardiac/health *condition*. Everything is framed relative to
  **her training zone** ("above your Zone 2 target"), not health/safety ("dangerous heart rate").
- Keep the app's existing disclaimer + "talk to a professional / stop if you feel unwell."
- No contraceptive/fertility guidance changes here (workout-only app). Existing FDA line holds.
- HealthKit workout + heart-rate read permissions; clear usage strings.

---

## 8. Build plan (collaborative, in Xcode with the watch paired)
1. **Scaffold:** add a watchOS app target to the existing Xcode project; wire WatchConnectivity;
   get a hardcoded "Today" list rendering on the watch.
2. **Bridge:** phone sends the real daily payload (phase + workouts + zone) → watch renders it.
3. **Guided player:** exercise cards + rest timers + crown navigation.
4. **Live HR:** start a `HKWorkoutSession`, stream HR, show the zone bar.
5. **Flags + modify:** the too-high/too-low logic + real-time exercise modification.
6. **Summary + write-back** to HealthKit → flows into the phone via the import we built.
7. TestFlight for watch (same account).

**My role/limit:** I can write the Swift, but building/testing needs Xcode + your paired watch —
so we do it together, screen by screen (like the App Store setup). Best started **after the pilot
lands**, so real usage sharpens which workouts/zones matter.

---

## 9. Open questions
- Goal input: does "goal" (metabolic health / weight loss / strength / endurance) come from
  onboarding, or a quick watch toggle?
- Should the watch work standalone if the phone isn't nearby (cache the last plan)? (v2.)
- How assertive should the auto-modify be — suggest vs auto-apply? (Lean *suggest* for v1.)
