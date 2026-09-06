// workoutFeel.js — one vocabulary for `daily_logs.workout_feel`.
//
// THE BUG THIS FIXES: three screens wrote three different sets of values into the SAME column,
// and the insight engines only understood fragments of each.
//   Log.jsx            -> 'Stronger than usual' | 'Average' | 'Weaker than usual' | Rest day | Skipped
//   Workout.jsx        -> 'Felt strong' | 'Felt average' | 'Felt hard' | Rest day | Skipped
//   WearableWorkouts   -> always 'Average'
// Consequences found in live data (58 logged training days):
//   - hormoneSync.js only reacted to 'Stronger than usual', so NOTHING logged through the
//     workout player ever triggered that insight.
//   - algorithm_v3.js counted hard sessions as ['Felt hard','Hard'], so 'Weaker than usual'
//     from the daily log was never counted at all.
//   - Friends.jsx only had labels for the Workout.jsx vocabulary.
//
// RULES (permanent):
//  1. CANONICAL is the vocabulary. New writers use it; nothing else may be written.
//  2. Every reader goes through normaliseFeel() so historical rows stay readable FOREVER.
//     Old values are never migrated away in the database — a woman's log is her record, and
//     rewriting what she entered to suit our schema is not ours to do. We translate on read.
//  3. An unrecognised value is not guessed at. normaliseFeel returns null, and didTrain still
//     reports true, because "she wrote something in the workout box" is evidence she trained
//     even when we cannot grade how it felt.
// Pure functions, unit-tested.

export const CANONICAL = ['Rest day', 'Weaker than usual', 'Average', 'Stronger than usual', 'Skipped']

// Values that mean "no session happened".
export const NON_TRAINING = ['Rest day', 'Skipped']

// Legacy → canonical. Lower-cased keys; lookup is case-insensitive and whitespace-tolerant.
const ALIASES = {
  // Workout.jsx's guided-player + class-logger vocabulary
  'felt strong': 'Stronger than usual',
  'felt average': 'Average',
  'felt hard': 'Weaker than usual',      // "hard" here means higher perceived effort for the
                                          // same work, which is what 'Weaker than usual' encodes
  // shorter variants that appear in older rows
  'strong': 'Stronger than usual',
  'hard': 'Weaker than usual',
  'average': 'Average',
  // 'Good' is genuinely ambiguous — it could mean "fine" or "great". It is mapped to the
  // NEUTRAL value on purpose: over-reading it as a strong session would let a vague word
  // inflate the training signal the engines learn from.
  'good': 'Average',
  'rest day': 'Rest day',
  'rest': 'Rest day',
  'skipped': 'Skipped',
  'stronger than usual': 'Stronger than usual',
  'weaker than usual': 'Weaker than usual',
}

// The canonical value for any stored string, or null when we cannot honestly grade it.
export function normaliseFeel(value) {
  if (value == null) return null
  const k = String(value).trim().toLowerCase()
  if (!k) return null
  return ALIASES[k] || null
}

// Did a session actually happen? True for any recorded value that is not rest/skipped —
// INCLUDING values we cannot grade (a row reading 'yoga' is still a workout that happened).
export function didTrain(value) {
  if (value == null) return false
  const raw = String(value).trim()
  if (!raw) return false
  const norm = normaliseFeel(raw)
  if (norm) return !NON_TRAINING.includes(norm)
  return true   // ungradeable but present: she trained, we just do not know how it felt
}

// 1 = harder than usual, 2 = as usual, 3 = stronger than usual. null when not gradeable.
// This is the number the engines should compare, never the raw string.
export function feelScore(value) {
  switch (normaliseFeel(value)) {
    case 'Weaker than usual': return 1
    case 'Average': return 2
    case 'Stronger than usual': return 3
    default: return null
  }
}

export function isHard(value) { return feelScore(value) === 1 }
export function isStrong(value) { return feelScore(value) === 3 }
export function isRest(value) { return NON_TRAINING.includes(normaliseFeel(value)) }

// Display label for any stored value, old or new. Falls back to the raw text (capitalised)
// so an ungradeable historical entry still reads as what she actually wrote.
export function feelLabel(value) {
  const norm = normaliseFeel(value)
  if (norm) return norm
  const raw = String(value ?? '').trim()
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : null
}

const EMOJI = {
  'Rest day': '🌙', 'Skipped': '⏭', 'Weaker than usual': '😓',
  'Average': '🏃', 'Stronger than usual': '💪',
}
export function feelEmoji(value) { return EMOJI[normaliseFeel(value)] || '🏃' }
