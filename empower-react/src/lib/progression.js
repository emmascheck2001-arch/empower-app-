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

// getProgressionTarget, returns a personalised prescription for an exercise, or null when
// there is no history for it (first time → caller falls back to the level-based range).
//   { weight, delta, action: 'progress' | 'hold' | 'hold-hard', reason }
export function getProgressionTarget({ lastWeight, exerciseName, intensityModifier = 0.9 } = {}) {
  const w = Number(lastWeight)
  if (lastWeight == null || Number.isNaN(w)) return null
  const inc = progressionIncrement(exerciseName)
  const mod = intensityModifier ?? 0.9

  // Favourable phase (follicular / ovulatory): add load.
  if (mod >= 0.95) {
    return {
      weight: round(w + inc), delta: inc, action: 'progress',
      reason: `Up ${inc}kg from last time (${w}kg). You are in a strong phase for adding load, if the last two reps moved well, take the jump. Steady overload like this is how you get stronger.`,
    }
  }
  // Neutral phase (early luteal): hold and consolidate.
  if (mod >= 0.85) {
    return {
      weight: round(w), delta: 0, action: 'hold',
      reason: `Match last time (${w}kg). Lock the weight in here, then take the next jump in your follicular phase when you adapt best.`,
    }
  }
  // Demanding phase (mid/late luteal, menstrual, observation): hold, reset expectations.
  return {
    weight: round(w), delta: 0, action: 'hold-hard',
    reason: `Match last time (${w}kg) and count it a win. Your core temperature and resting heart rate are higher this phase, so the same load genuinely feels harder, that is physiology, not a step back.`,
  }
}
