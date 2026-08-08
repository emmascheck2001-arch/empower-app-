// progression.js, personalised strength progression. Decides, from a woman's OWN last
// lift and where she is in her cycle, whether to add weight, hold, or ease off, so the
// workout actively gets HER stronger instead of repeating a generic level-based range.
//
// The cycle-aware part matters: blindly adding load every session causes failed lifts and
// frustration; adding it in the phases where she recovers and adapts best (follicular /
// ovulatory) and holding through the high-temperature, high-RHR luteal phase is both safer
// and more effective. Pure computation only (no supabase) so it is unit-tested.
//
// Sources: progressive overload for strength (Schoenfeld et al. JSCR 2017; ACSM); phase
// training load. Kissow 2022 (follicular adaptation), De Martin Topranin 2023 (luteal RHR),
// Hackney 2006 (luteal stress response), Colenso-Semple 2023 (use "may", individual variation).

// Lower-body compounds tolerate bigger jumps than small upper-body / isolation moves.
const LOWER_BODY = /squat|deadlift|lunge|leg press|hip thrust|leg curl|leg extension|calf|glute|romanian|\brdl\b|step.?up/i

export function progressionIncrement(exerciseName) {
  return LOWER_BODY.test(exerciseName || '') ? 5 : 2.5
}

function round(kg) { return Math.round(kg * 2) / 2 } // nearest 0.5kg

// getProgressionTarget, returns a performance-led suggestion for an exercise, or null when
// there is no history for it (first time → caller falls back to the level-based range).
//   { weight, delta, action: 'progress' | 'hold' | 'hold-hard', reason }
export function getProgressionTarget({ lastWeight, exerciseName, successfulSessions = 0, lastSessionFeel = null } = {}) {
  const w = Number(lastWeight)
  if (lastWeight == null || Number.isNaN(w) || w <= 0 || w > 500) return null
  const inc = progressionIncrement(exerciseName)

  // Progress only after two completed, tolerable sessions. Phase never substitutes for
  // evidence that the user actually handled the exercise safely.
  if (successfulSessions >= 2 && ['Felt strong', 'Felt average'].includes(lastSessionFeel)) {
    return {
      weight: round(w + inc), delta: inc, action: 'progress',
      reason: `Your last ${successfulSessions} sessions were completed at ${w}kg without being marked hard. Try ${round(w + inc)}kg only if your warm-up is comfortable and your form stays solid; otherwise repeat ${w}kg.`,
    }
  }
  if (lastSessionFeel === 'Felt hard') {
    return {
      weight: round(w), delta: 0, action: 'hold-hard',
      reason: `Last time felt hard at ${w}kg. Repeat it only if your warm-up feels comfortable, or choose a lighter load. Progression can wait until the movement feels controlled.`,
    }
  }
  return {
    weight: round(w), delta: 0, action: 'hold',
    reason: `Your last recorded load was ${w}kg. Repeat it while you build two comfortable completed sessions, then Empower can suggest a small progression.`,
  }
}
