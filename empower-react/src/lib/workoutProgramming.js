import { pickPreferLoad } from './workoutVariety'

const ADVANCED_FOR_BEGINNERS = /nordic|stiff-leg deadlift|single-leg romanian|front squat|barbell squat|barbell row|sumo deadlift|bulgarian|hanging leg raise|pull-up|tricep dip|close-grip bench|upright row/i

export function buildCustomWorkout(muscles, pools, level, seed = 0, preferLoad = false) {
  const groups = (muscles || []).filter(m => pools[m]).slice(0, 6)
  if (!groups.length) return []
  const perGroup = groups.length === 1 ? (level === 'beginner' ? 2 : 3) : groups.length <= 3 ? 2 : 1
  const result = [], seen = new Set()
  groups.forEach((group, i) => {
    let pool = pools[group].filter(ex => !seen.has(ex.name))
    if (level === 'beginner') pool = pool.filter(ex => !ADVANCED_FOR_BEGINNERS.test(ex.name))
    for (const exercise of pickPreferLoad(pool, Math.min(perGroup, pool.length), seed + i * 2, preferLoad)) {
      seen.add(exercise.name)
      result.push(level === 'beginner' ? { ...exercise, sets: 2 } : exercise)
    }
  })
  return result
}

// Each circuit covers a squat, upper-body push, cardio, a single-leg movement and core.
const INTERVAL_MOVEMENTS = [
  ['Squat', 'Chair squat'],
  ['Incline push-up', 'Wall push-up'],
  ['March in place', 'Step touch'],
  ['Reverse lunge', 'Low step-up'],
  ['Plank shoulder taps', 'Bird-dog'],
]
export function buildIntervalCircuit(seed = 0, level = 'intermediate') {
  return {
    rounds: level === 'beginner' ? 2 : 3,
    work: 30, rest: 30,
    exercises: INTERVAL_MOVEMENTS.map((choices, i) => choices[Math.abs(Math.floor(seed / (2 ** i))) % choices.length]),
  }
}
