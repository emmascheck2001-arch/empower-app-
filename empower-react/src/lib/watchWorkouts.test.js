import { describe, expect, it } from 'vitest'
import { buildWatchWorkouts } from './watchWorkouts'

describe('watch workout options', () => {
  const status = { phase:'Follicular', profile:{ fitness_level:'beginner' } }
  it('varies strength movements day to day without suggesting generic weights', () => {
    const today = buildWatchWorkouts(status, '2026-10-18').workouts.find(w => w.title === 'Full body')
    const tomorrow = buildWatchWorkouts(status, '2026-10-19').workouts.find(w => w.title === 'Full body')
    expect(today.exercises.map(e => e.name)).not.toEqual(tomorrow.exercises.map(e => e.name))
    expect(today.exercises.every(e => e.sets === 2 && !/\d+\s*(to|–)\s*\d+\s*kg/i.test(e.guide))).toBe(true)
  })
  it.each(['Full body', 'Upper body', 'Lower body'])('uses more than two rotating %s plans', title => {
    const plans = Array.from({ length: 9 }, (_, i) => {
      const date = `2026-10-${String(18 + i).padStart(2, '0')}`
      return buildWatchWorkouts(status, date).workouts.find(w => w.title === title).exercises.map(e => e.name)
    })
    expect(new Set(plans.map(plan => plan.join('|'))).size).toBeGreaterThan(2)
    for (let i = 1; i < plans.length; i++) expect(plans[i]).not.toEqual(plans[i - 1])
  })
  it('alternates the watch work and recovery intervals', () => {
    const workout = buildWatchWorkouts(status, '2026-10-18').workouts.find(w => w.activity === 'HIIT')
    expect(workout.exercises.slice(1, -1).map(e => e.name)).toEqual(Array.from({ length:6 }, () => ['Work interval', 'Recover']).flat())
  })
})
