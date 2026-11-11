import { supportsLoggedWeight } from './workoutPresentation'

// Rotate a pair of the main movements across three sessions while keeping two familiar
// lifts for progression. Alternatives use the same sets and reps as the chosen level's
// original exercise. This prevents the Watch's date-based plans from only alternating
// between the same two workouts.
const ALTERNATIVES = {
  full: {
    1: [
      ['Dumbbell chest press', 'Dumbbells, choose a weight you can control', 'On a flat bench, press the dumbbells above your chest and lower with control.'],
      ['Incline dumbbell press', 'Dumbbells, choose a weight you can control', 'Set the bench to a slight incline. Press smoothly and control the lowering phase.'],
    ],
    3: {
      beginner: [
        ['Glute bridge', 'Bodyweight or barbell', 'Drive your hips up and lower with control.'],
        ['Dumbbell deadlift', 'Dumbbells, choose a weight you can control', 'Keep the weights close, hinge from your hips, and stand tall.'],
      ],
      intermediate: [
        ['Single-leg Romanian deadlift', 'Dumbbells or bodyweight', 'Hinge on one leg, keeping your hips square; hold a support if needed.'],
        ['Hip thrust', 'Barbell or dumbbells', 'Drive through your heels and finish with a controlled glute squeeze.'],
      ],
      advanced: [
        ['Single-arm dumbbell row', 'Dumbbell, choose a weight you can control', 'Brace on a bench, pull toward your hip and lower slowly.'],
        ['Lat pulldown', 'Cable machine with weight plates', 'Pull to your upper chest and control the return without swinging.'],
      ],
    },
  },
  upper: {
    1: [
      ['Lat pulldown', 'Cable machine with weight plates', 'Pull the bar toward your upper chest, then return slowly.'],
      ['Single-arm dumbbell row', 'Dumbbell, choose a weight you can control', 'Brace on a bench and pull toward your hip with control.'],
    ],
    3: {
      beginner: [
        ['Hammer curl', 'Dumbbells, choose a weight you can control', 'Keep your elbows close and curl with your palms facing inward.'],
        ['Front raise', 'Dumbbells, choose a weight you can control', 'Raise with soft elbows to shoulder height, then lower slowly.'],
      ],
      other: [
        ['Single-arm dumbbell row', 'Dumbbell, choose a weight you can control', 'Brace on a bench, pull the dumbbell toward your hip, and lower slowly.'],
        ['Lat pulldown', 'Cable machine with weight plates', 'Pull the bar toward your upper chest and return with control.'],
      ],
    },
  },
  lower: {
    1: {
      beginner: [
        ['Dumbbell deadlift', 'Dumbbells, choose a weight you can control', 'Hinge at the hips, keep the weights close and stand tall.'],
        ['Kettlebell deadlift', 'Kettlebell, choose a weight you can control', 'Keep the kettlebell close, hinge from your hips, and stand tall.'],
      ],
      other: [
        ['Single-leg Romanian deadlift', 'Dumbbells or bodyweight', 'Hinge on one leg, keep your hips square, and use a support if needed.'],
        ['Dumbbell deadlift', 'Dumbbells, choose a weight you can control', 'Keep the weights close and stand tall through a controlled hip hinge.'],
      ],
    },
    3: {
      beginner: [
        ['Walking lunge', 'Dumbbells or bodyweight', 'Take a controlled step forward and lower until both knees bend comfortably.'],
        ['Reverse lunge', 'Dumbbells or bodyweight', 'Step back under control and drive through the front heel to stand.'],
      ],
      other: [
        ['Glute bridge', 'Bodyweight or barbell', 'Drive your hips up, squeeze your glutes, and lower with control.'],
        ['Walking lunge', 'Dumbbells or bodyweight', 'Take a long, controlled step and keep the front knee tracking over the toes.'],
      ],
    },
  },
}

export function presetCore(base, group, level, seed) {
  const core = base.slice(0, 4)
  const rotation = ((seed % 3) + 3) % 3
  if (rotation === 0) return core
  const alternatives = ALTERNATIVES[group] || {}
  return core.map((exercise, index) => {
    const entry = alternatives[index]
    const choices = Array.isArray(entry) ? entry : (entry?.[level] || entry?.other)
    const alternate = choices?.[rotation - 1]
    if (!alternate) return exercise
    return { ...exercise, name: alternate[0], weight: alternate[1], tip: alternate[2] }
  })
}

export function rotatePick(pool, n, seed) {
  if (!pool || pool.length <= n) return pool || []
  const start = ((seed % pool.length) + pool.length) % pool.length
  return Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length])
}

export function pickPreferLoad(pool, n, seed, preferLoad) {
  if (!preferLoad || !pool) return rotatePick(pool, n, seed)
  const loaded = pool.filter(exercise => supportsLoggedWeight(exercise?.weight))
  const rest = pool.filter(exercise => !supportsLoggedWeight(exercise?.weight))
  const picks = rotatePick(loaded, Math.min(n, loaded.length), seed)
  if (picks.length < n) picks.push(...rotatePick(rest, n - picks.length, seed + 1))
  return picks
}

export function buildPresetWorkout(base, group, level, seed, accessories, preferLoad) {
  const core = presetCore(base, group, level, seed)
  const seen = new Set(core.map(exercise => exercise.name))
  const pool = [...base.slice(4), ...(accessories || [])].filter(exercise => {
    if (seen.has(exercise.name)) return false
    seen.add(exercise.name)
    return true
  })
  const exercises = core.concat(pickPreferLoad(pool, base.length - core.length, seed, preferLoad))
  return level === 'beginner' ? exercises.map(exercise => ({ ...exercise, sets: 2 })) : exercises
}

export function sameWorkout(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  const counts = new Map()
  for (const name of a) counts.set(name, (counts.get(name) || 0) + 1)
  for (const name of b) {
    if (!counts.get(name)) return false
    counts.set(name, counts.get(name) - 1)
  }
  return true
}

// Prefer the candidate with the most exercises absent from the last plan. This avoids a
// different ordering of the same exercises being mistaken for a different session.
export function nextVariedSeed(build, baseSeed, previous) {
  if (!previous?.names?.length) return baseSeed
  const start = Number.isFinite(previous.seed) ? Math.max(baseSeed, previous.seed + 1) : baseSeed
  const previousNames = new Set(previous.names)
  let bestSeed = start, bestNew = -1
  for (let offset = 0; offset < 24; offset++) {
    const seed = start + offset
    const names = build(seed).map(exercise => exercise.name)
    if (sameWorkout(names, previous.names)) continue
    const newCount = names.filter(name => !previousNames.has(name)).length
    if (newCount > bestNew) { bestSeed = seed; bestNew = newCount }
  }
  return bestNew < 0 ? baseSeed : bestSeed
}
