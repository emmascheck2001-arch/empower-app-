// Suggestions are based on recorded training, never an estimated cycle phase.
export function getProgressionTarget({ lastWeight, successfulSessions = 0, lastSessionFeel = null } = {}) {
  const weight = Number(lastWeight)
  if (lastWeight == null || !Number.isFinite(weight) || weight <= 0 || weight > 500) return null
  if (successfulSessions >= 2 && ['Felt strong', 'Felt average'].includes(lastSessionFeel)) {
    return {
      weight, delta: 0, action: 'progress',
      reason: `You logged two completed sessions at ${weight}kg. If every rep felt controlled and you had a few reps left, consider the smallest available increase; otherwise repeat this load.`,
    }
  }
  if (lastSessionFeel === 'Felt hard') {
    return { weight, delta: 0, action: 'hold-hard', reason: `Last time felt hard at ${weight}kg. Repeat it only if your warm-up feels comfortable, or choose a lighter load.` }
  }
  return { weight, delta: 0, action: 'hold', reason: `Your last recorded load was ${weight}kg. Repeat or adjust it to keep your reps controlled.` }
}

// Only count a successful session when every prescribed set was checked and logged at
// the same load. Partial or mixed-load records cannot prove readiness to progress.
export function exerciseHistoryEntry(exercise, weights, done, previous, feel) {
  if (!exercise || ['Skipped', 'Rest day'].includes(feel)) return null
  const count = Number(exercise.sets || 1)
  const checked = Array.from({ length: count }, (_, i) => Boolean(done?.[i]))
  const logged = Array.from({ length: count }, (_, i) => {
    const n = Number(weights?.[i])
    return checked[i] && Number.isFinite(n) && n > 0 && n <= 500 ? n : null
  })
  const valid = logged.filter(n => n !== null)
  if (!valid.length) return null
  const load = Math.max(...valid)
  const completed = checked.every(Boolean) && logged.every(n => n !== null)
  const uniform = completed && logged.every(n => n === load)
  const sameTarget = Number(previous?.last_weight) === load && String(previous?.last_reps) === String(exercise.reps)
  const previousSuccesses = sameTarget ? Number(previous?.successful_sessions || 0) : 0
  const successfulSessions = uniform && ['Felt strong', 'Felt average'].includes(feel) ? previousSuccesses + 1 : 0
  return { last_weight: load, last_reps: String(exercise.reps), last_completed: completed, last_session_feel: feel, successful_sessions: successfulSessions }
}
