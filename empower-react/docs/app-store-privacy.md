# App Store & Play Store privacy answers

Source of truth for the **Apple App Privacy** questionnaire (App Store Connect) and the
**Google Play Data safety** form. Keep this in sync with `src/pages/Privacy.jsx`, `src/lib/analytics.js`,
and `src/lib/healthkit.js`. Apple explicitly requires health-data collection to be declared
(https://developer.apple.com/health-fitness/). If you add a new field, table, or health type, update this file,
the privacy policy, and `delete_my_account()`.

## What Em~power collects and how it is handled

| Data | Where it comes from | Stored where | Linked to the user? | Used for tracking?¹ | Purpose |
|---|---|---|---|---|---|
| Health & fitness — cycle data, symptoms, mood, flow, pain, sleep, biometrics (RHR, temperature, HRV), hormone lab values | Entered manually + read from Apple Health / Health Connect (read-only) | Supabase (AWS), RLS-scoped to the user | **Yes** | No | App functionality (personal recommendations) |
| Health & fitness — workouts | Manual + Apple Health / Health Connect | Supabase | **Yes** | No | App functionality |
| Contact info — email address | Account signup (Supabase Auth) | Supabase Auth | **Yes** | No | Account / authentication |
| Sensitive info — ethnicity (optional), birth year | Onboarding (skippable) | Supabase `profiles` | **Yes** | No | Show relevant health info + 13+ age gate |
| Usage data — in-app events (screen opened, workout logged, etc.) | `src/lib/analytics.js` | Supabase `analytics_events` | **Yes (stored with `user_id`)** | No | Analytics / product improvement |
| Identifiers — Supabase user ID | Generated at signup | Supabase | **Yes** | No | App functionality |

¹ "Tracking" = Apple's definition: linking with third-party data for ads, or sharing with data brokers. **Em~power does none of this.**

- **Not collected:** precise or coarse location, contacts, browsing history, search history, purchases, financial info, advertising identifiers, photos.
- **No third-party analytics or ad SDKs.** Analytics are first-party (our own Supabase table).
- **Data is not sold, not shared with third parties, and not used for advertising or to train AI models.**
- **Data is encrypted in transit and at rest.** Row-Level Security ensures no user can read another's data.
- **Deletion:** the user can delete their account and all data in-app (Privacy screen → `delete_my_account()`), which removes every table row and the auth user.

## Apple App Privacy — questionnaire answers

- **Data used to track you:** None.
- **Data linked to you:** Health & Fitness; Contact Info (email); Sensitive Info (ethnicity, birth year); Usage Data; Identifiers (user ID). Purposes: App Functionality and Analytics only.
- **Data not linked to you:** None (usage analytics ARE linked, via `user_id` — do not mark analytics as "not linked").

### HealthKit-specific declarations (required)
- The app requests **read-only** HealthKit access to: resting heart rate, heart rate variability (SDNN), sleeping wrist temperature / basal body temperature / body temperature, sleep analysis, and workouts.
- The app requests **no HealthKit write** access.
- HealthKit data is used only for the user's cycle tracking and recommendations. It is **not** used for advertising, marketing, or shared with third parties, and is **not** used for the app's App Store analytics beyond the app's own product analytics.
- `NSHealthShareUsageDescription` describes the read-only use.
- `NSHealthUpdateUsageDescription` **must also be present** even though the app does not write to HealthKit: the linked `@capgo/capacitor-health` SDK references HealthKit write APIs, so Apple's static analysis requires the purpose string (App Store rejection ITMS-90683 if missing). The string states the app only writes data the user chooses to log; in practice the app currently requests `write: []` and does not write.

## Google Play — Data safety answers

- **Data collected:** Health and fitness; Personal info (email, optional ethnicity, birth year); App activity (in-app usage events); App info and performance; Device or other IDs (app user ID).
- **Data shared with third parties:** None.
- **Is data encrypted in transit?** Yes. **At rest?** Yes.
- **Can users request deletion?** Yes — in-app account deletion.
- **Health Connect:** read-only access to skin/body temperature, resting heart rate, heart rate variability, sleep, and exercise. No write access. (See `android/app/src/main/AndroidManifest.xml`, which strips all other Health Connect permissions the plugin declares.)
