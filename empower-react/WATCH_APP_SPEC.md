# Em~power Apple Watch — spec & data contract

The watch app shows **today's phase-based movement plan** on the wrist, sourced from the same
cycle engine that powers the phone app. This document is the contract between the phone (the
Capacitor host + web app) and the watch.

## Topology

```
  React web app (src/)                iPhone host (ios/App/App)            Apple Watch
  ────────────────────                ─────────────────────────           ───────────────────────
  getTodayStatus(...)                                                      Empower Watch Watch App/
        │                                                                  ├─ Empower_WatchApp.swift
        ▼                                                                  │   └─ PlanStore (WCSession
  buildWatchPayload()  ── syncPlanToWatch() ──►  WatchBridge (CAPPlugin)   │       delegate, cache,
  (src/lib/watchPayload.js)   (src/lib/         │  WatchBridge.swift       │       sample fallback)
                               watchBridge.js)  │  WCSession               └─ ContentView.swift
                                                └───── updateApplicationContext ──►  (@EnvironmentObject)
```

- **Web → host:** `syncPlanToWatch(status)` (src/lib/watchBridge.js) builds the payload with
  `buildWatchPayload` and calls the `WatchBridge` Capacitor plugin's `sendPlan`. It is iOS-only
  and no-ops on web/Android, so it's safe to call unconditionally. Currently fired from
  `Workout.jsx` right after `getTodayStatus` resolves.
- **Host → watch:** `WatchBridge.swift` sends the plan via `WCSession.updateApplicationContext`
  (latest-state semantics — a new plan overwrites the previous one and is delivered on the
  watch's next launch even if it was asleep).
- **Watch:** `PlanStore` receives the context, decodes it, publishes it to `ContentView`, and
  caches the last plan in `UserDefaults` so the watch shows real data offline / on cold launch.
  Until the first real plan arrives it shows a **labelled sample** (never an empty screen).

## Wire format (JSON)

`sendPlan({ plan })` where `plan` is:

```json
{
  "phase": "Mid luteal",
  "date": "2026-08-06",
  "workouts": [
    {
      "activity": "Yoga",
      "title": "Go a little lighter",
      "detail": "The same session honestly feels harder now. Drop the load about 10 to 15 percent, or swap for tempo cardio or yoga.",
      "exercises": [
        { "name": "Goblet squat", "guide": "12–16 kg", "reps": "3 × 10" }
      ]
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `phase` | string | User-facing sub-phase label (`status.subPhase || status.phase`). |
| `date` | string \| null | Local `yyyy-MM-dd` the plan was built for (staleness check). |
| `workouts[].activity` | string | One of `Run / Walk / Cycle / Swim / Gym / Yoga / Pilates / HIIT / Rest`. Drives the SF Symbol in `activityIcon`. |
| `workouts[].title` | string | Short headline. |
| `workouts[].detail` | string | One-line guidance. Shown as the body when `exercises` is empty. |
| `workouts[].exercises` | array | May be empty. Each: `{ name, guide, reps }`. `reps` may be `""`. |

Transport note: WatchConnectivity `applicationContext`/`userInfo` values must be property-list
types, so the plan is carried as a JSON **string** under the key `planJSON`. `PlanStore` also
accepts a raw dictionary, for flexibility.

## Design rules (inherited from the app)

- **Never fabricate.** `buildWatchPayload` derives everything from `getTodayStatus` output and
  `getMovementToday` — it invents no weights, reps, or claims. Exercise-level detail stays empty
  until the guided player genuinely provides it.
- **Pregnancy is never auto-prescribed a workout** — the payload sends provider-led guidance only.
- **Brand:** gold `#c8b89a` (`empowerGold`).

## Build / verify (needs Xcode — can't be done from the web toolchain)

1. `npm run build` in `empower-react/`, then `npx cap sync ios`.
2. Open `ios/App/App.xcworkspace` in Xcode. Confirm `WatchBridge.swift` is in the **App** target
   and the watch files are in the **Empower Watch Watch App** target (it's a synchronized folder
   group, so they auto-include).
3. Run the App scheme on a paired iPhone + Apple Watch (or the paired simulators).
4. Open Workout on the phone → `syncPlanToWatch` fires → the watch's "Today" list updates and the
   "Sample plan" footer disappears.

## Roadmap (next)

- **Live heart-rate session** (`LiveWorkoutPlaceholder` → real `HKWorkoutSession`): zone, live HR,
  and phase-aware flags. This is the next build.
- **Exercise-level sync:** populate `workouts[].exercises` from the phone's guided player (weight
  DB + `cyclePlan`) so the watch can drive a set-by-set session.
- **Watch → phone:** send completed-workout + HR summaries back for logging.
