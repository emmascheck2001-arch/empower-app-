import { describe, expect, it } from 'vitest'
import { EXERCISES } from './exerciseData'
import { buildPresetWorkout, presetCore, nextVariedSeed, sameWorkout } from './workoutVariety'

describe('gym workout variety', () => {
  it.each(['full', 'upper', 'lower'])('varies two main movements in %s at every level', group => {
    for (const level of ['beginner', 'intermediate', 'advanced']) {
      const base = EXERCISES[group][level]
      const first = presetCore(base, group, level, 100)
      const next = presetCore(base, group, level, 101)
      expect(first).toHaveLength(4)
      expect(next).toHaveLength(4)
      expect(next.filter((exercise, index) => exercise.name !== first[index].name)).toHaveLength(2)
      expect(new Set(next.map(exercise => exercise.name)).size).toBe(4)
      expect(next.map(exercise => [exercise.sets, exercise.reps])).toEqual(first.map(exercise => [exercise.sets, exercise.reps]))
    }
  })

  it('does not count a rearrangement of the same exercises as a new workout', () => {
    expect(sameWorkout(['Squat', 'Row', 'Press'], ['Press', 'Squat', 'Row'])).toBe(true)
    expect(sameWorkout(['Squat', 'Row'], ['Squat', 'Lunge'])).toBe(false)
  })

  it('selects new exercises for repeated plans and remains stable for a given seed', () => {
    const base = EXERCISES.full.intermediate
    const build = seed => presetCore(base, 'full', 'intermediate', seed)
    const firstSeed = nextVariedSeed(build, 100, null)
    const first = build(firstSeed)
    const nextSeed = nextVariedSeed(build, 100, { seed: firstSeed, names: first.map(e => e.name) })
    const next = build(nextSeed)
    expect(nextSeed).toBeGreaterThan(firstSeed)
    expect(sameWorkout(first.map(e => e.name), next.map(e => e.name))).toBe(false)
    expect(next.filter(e => !first.some(old => old.name === e.name))).toHaveLength(2)
    expect(build(nextSeed)).toEqual(next)
  })

  it.each(['full', 'upper', 'lower'])('builds balanced, non-duplicate %s sessions across repeated requests', group => {
    for (const level of ['beginner', 'intermediate', 'advanced']) {
      const base = EXERCISES[group][level]
      const extras = [base[0], base[1], { name: 'Face pull', sets: 3, reps: 12, weight: 'Cable with weight plates' },
        { name: 'Plank', sets: 3, reps: 30, weight: 'Bodyweight' }]
      const build = seed => buildPresetWorkout(base, group, level, seed, extras, true)
      let seed = 100
      let previous = build(seed)
      for (let session = 0; session < 4; session++) {
        expect(previous).toHaveLength(base.length)
        expect(new Set(previous.map(exercise => exercise.name)).size).toBe(previous.length)
        const nextSeed = nextVariedSeed(build, 100, { seed, names: previous.map(exercise => exercise.name) })
        const next = build(nextSeed)
        expect(next.filter(exercise => !previous.some(old => old.name === exercise.name)).length).toBeGreaterThanOrEqual(2)
        seed = nextSeed
        previous = next
      }
    }
  })

  it('falls back safely if a small pool has no alternative', () => {
    const build = () => [{ name: 'Plank' }]
    expect(nextVariedSeed(build, 100, { seed: 100, names: ['Plank'] })).toBe(100)
  })
})
