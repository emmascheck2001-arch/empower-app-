import { describe, expect, it } from 'vitest'
import { buildCustomWorkout, buildIntervalCircuit } from './workoutProgramming'
import { exerciseLoadGuide, exerciseReps } from './workoutPresentation'

const pools = {
  Chest: ['Bench press', 'Push-up', 'Incline push-up'].map(name => ({ name, sets: 3, weight: 'Bodyweight' })),
  Glutes: ['Nordic curl', 'Glute bridge', 'Reverse lunge'].map(name => ({ name, sets: 4, weight: 'Bodyweight' })),
  Quads: ['Reverse lunge', 'Goblet squat', 'Leg press'].map(name => ({ name, sets: 3, weight: 'Bodyweight' })),
}
describe('workout programming', () => {
  it('limits single-muscle volume and avoids advanced beginner movements', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = buildCustomWorkout(['Glutes'], pools, 'beginner', seed)
      expect(result).toHaveLength(2)
      expect(result.every(e => e.sets === 2 && e.name !== 'Nordic curl')).toBe(true)
    }
  })
  it('keeps multi-muscle selections distinct and caps session size', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = buildCustomWorkout(['Chest', 'Glutes', 'Quads'], pools, 'intermediate', seed)
      expect(result.length).toBeLessThanOrEqual(6)
      expect(new Set(result.map(e => e.name)).size).toBe(result.length)
    }
  })
  it('builds a reproducible circuit with each movement pattern', () => {
    for (let seed = 0; seed < 32; seed++) {
      const c = buildIntervalCircuit(seed, 'beginner')
      expect(c.rounds).toBe(2)
      expect(c.exercises).toHaveLength(5)
      expect(c.exercises[0]).toMatch(/squat/i)
      expect(c.exercises[1]).toMatch(/push-up/i)
      expect(c.exercises[2]).toMatch(/march|step touch/i)
      expect(c.exercises[3]).toMatch(/lunge|step-up/i)
      expect(c.exercises[4]).toMatch(/plank|bird-dog/i)
      expect(buildIntervalCircuit(seed, 'beginner')).toEqual(c)
    }
  })
  it('does not show arbitrary weights and labels static holds as time', () => {
    expect(exerciseLoadGuide('8 to 14kg each')).toBe('Choose a manageable load')
    expect(exerciseLoadGuide('Bodyweight to 20kg')).toBe('Bodyweight or a manageable load')
    expect(exerciseLoadGuide('Bodyweight')).toBe('Bodyweight')
    expect(exerciseReps({ name:'Side plank', reps:30 })).toBe('30 seconds each side')
    expect(exerciseReps({ name:'Plank push-up', reps:10 })).toBe('10 reps')
  })
})
