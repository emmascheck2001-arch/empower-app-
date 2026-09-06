// logPriority.js — decides WHICH questions are worth asking today.
//
// THE PROBLEM THIS SOLVES: the daily log asked the same ~7 questions every single day
// forever — energy, sleep, stress, two mood rows, symptoms, cervical fluid — regardless of
// whether the answer would tell the model anything it did not already know. Fixed cost,
// no variation, and most days the answers changed nothing. That is what made logging boring.
//
// THE IDEA: a question is worth asking when the answer would actually move something —
// because the signal is informative at this point in the cycle (cervical fluid near
// ovulation), because the model is uncertain right now, or because the field has gone stale.
// Everything else moves behind "add more detail", where it is still one tap away.
//
// RULES (never loosen):
//  1. NOTHING IS EVER REMOVED. This chooses what is shown FIRST, not what she is allowed to
//     log. Every field stays reachable, always. She is never blocked from logging anything.
//  2. ENERGY IS ALWAYS ASKED. It is the spine of every insight the app produces.
//  3. SAFETY FIELDS ARE NEVER DEMOTED. Flow and pain during a period always stay in the
//     top view, because that is where the seek-care escalation is anchored.
//  4. Reasons shown to the user must be true and specific ("this is the week your cervical
//     fluid actually says something"), never flattery.
// Pure functions only, unit-tested.

import { getOvulationDay } from './hormoneSync.js'
import { didTrain } from './workoutFeel.js'

// Every question the quick log can surface. `always` fields bypass scoring entirely.
export const FIELDS = {
  energy:         { label: 'Energy',           always: true },
  sleep_quality:  { label: 'Sleep',            wearable: true },
  stress_level:   { label: 'Stress' },
  mood:           { label: 'Mood' },
  symptoms:       { label: 'Physical symptoms' },
  cervical_fluid: { label: 'Cervical fluid' },
  libido:         { label: 'Sex drive' },
  lh_result:      { label: 'Ovulation test' },
  workout_feel:   { label: 'How training felt' },
  flow_volume:    { label: 'Flow',  safety: true },
  pain_rating:    { label: 'Pain',  safety: true },
}

// How many contextual questions to add on top of the always-asked ones. Small on purpose:
// three good questions answered honestly beat seven answered on autopilot.
export const MAX_CONTEXTUAL = 3
const STALE_DAYS = 5    // a field unlogged this long is worth re-asking whatever the phase

function daysSince(logs, key) {
  // logs are newest-first. Returns how many entries back the field was last filled, or null.
  for (let i = 0; i < (logs || []).length; i++) {
    const v = logs[i]?.[key]
    const filled = Array.isArray(v) ? v.length > 0 : (v != null && v !== '' && v !== 'No test' && v !== 'No data')
    if (filled) return i
  }
  return null
}

// Where the fertile window sits. Cervical fluid and LH are only genuinely informative here;
// asking for them on cycle day 8 of a 35-day cycle is noise she has to tap past.
export function fertileWindow(cycleLen) {
  const ov = getOvulationDay(cycleLen)
  return { start: Math.max(1, ov - 5), end: ov + 2, ovulationDay: ov }
}

// Returns { ask: [{key,label,why}], core: [...], contextual: [...] }
// `ask` is the ordered list for the top of the log screen; everything else goes behind
// "add more detail" — still there, just not in her face every morning.
export function pickTodaysQuestions({
  phase, cycleDay, cycleLen = 28, recentLogs = [], confidence = 0.5,
  isPath4 = false, isMenstrual = false, latePeriod = false, wearableFills = [],
} = {}) {
  const core = []
  const scored = []
  const add = (key, score, why) => { if (FIELDS[key]) scored.push({ key, label: FIELDS[key].label, score, why }) }

  // ── core: always asked ────────────────────────────────────────────────────
  core.push({ key: 'energy', label: FIELDS.energy.label, why: 'The one signal every insight is built on' })
  // Safety fields are non-negotiable while bleeding: the heavy-flow / severe-pain seek-care
  // guidance hangs off them, and it must never be hidden behind a "more detail" tap.
  if (isMenstrual) {
    core.push({ key: 'flow_volume', label: FIELDS.flow_volume.label, why: 'Tracks how heavy this period actually is' })
    core.push({ key: 'pain_rating', label: FIELDS.pain_rating.label, why: 'Pain that disrupts your day is worth a record' })
  }

  // ── perimenopause path: its own symptom set is the whole point of that path ──
  if (isPath4) {
    return {
      core,
      contextual: [],
      ask: core,
      isPath4: true,
      reason: 'Perimenopause tracking keeps its own symptom set.',
    }
  }

  const cd = cycleDay || 0
  const fw = fertileWindow(cycleLen)
  const inFertile = cd >= fw.start && cd <= fw.end
  const lateLuteal = phase === 'Luteal' && cd >= (cycleLen - 4)

  // ── contextual scoring ────────────────────────────────────────────────────
  // Cervical fluid: the strongest device-free phase signal, but only ACTUALLY informative
  // approaching ovulation. Masked by bleeding, so never asked during a period.
  if (!isMenstrual) {
    if (inFertile) add('cervical_fluid', 10, 'This is the week it actually tells us something')
    else if (confidence < 0.55) add('cervical_fluid', 6, 'Helps place where you are in your cycle')
    else add('cervical_fluid', 2, null)
  }
  // LH tests: only meaningful in the fertile window, and only if she is a person who tests.
  const testsLH = daysSince(recentLogs, 'lh_result') != null
  if (inFertile && testsLH) add('lh_result', 9, 'Confirms ovulation to the day')
  // Mood + symptoms: most informative late luteal (PMS window) and during a period.
  if (lateLuteal) { add('mood', 9, 'The week your mood pattern shows up'); add('symptoms', 8, 'PMS symptoms are worth catching early') }
  else if (isMenstrual) add('symptoms', 7, 'Period symptoms, so we can track the pattern')
  else { add('mood', 4, null); add('symptoms', 4, null) }
  // Libido rises approaching ovulation — a real, cheap confirming signal.
  if (inFertile) add('libido', 6, 'Rises approaching ovulation')
  // Stress: always somewhat useful, and the prime suspect when a period is late.
  if (latePeriod) add('stress_level', 9, 'Stress is the most common reason a period runs late')
  else add('stress_level', 5, null)
  // Sleep: valuable, but pointless to ASK if the watch already answered it.
  if (!wearableFills.includes('sleep_quality')) add('sleep_quality', 6, null)
  // Training: only worth asking on days she has been training.
  const trained = (recentLogs || []).slice(0, 4)
    .filter(l => didTrain(l.workout_feel)).length
  if (trained >= 4) add('workout_feel', 7, 'You have trained most of this week — this tracks how your body is taking it')
  else if (trained >= 2) add('workout_feel', 6, 'You have been training — this tracks how your body is taking it')

  // Staleness bump: anything not logged for a while is worth one ask, whatever the phase.
  for (const s of scored) {
    const since = daysSince(recentLogs, s.key)
    if (since == null || since >= STALE_DAYS) s.score += 3
  }

  const coreKeys = new Set(core.map(c => c.key))
  const contextual = scored
    .filter(s => !coreKeys.has(s.key))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, MAX_CONTEXTUAL)

  return { core, contextual, ask: [...core, ...contextual], isPath4: false }
}

// The set of keys that stay in the top view. Everything NOT in here is still available under
// "add more detail" — this never removes a field from the app.
export function quickFieldKeys(plan) {
  return new Set((plan?.ask || []).map(f => f.key))
}
