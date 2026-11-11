import { describe, expect, it } from 'vitest'
import { visibleWearableWorkouts } from '../lib/healthPresentation'

describe('visibleWearableWorkouts', () => {
  it('keeps only meaningful workouts from the current week', () => {
    const workouts = visibleWearableWorkouts([
      { date: '2026-08-18', activity: 'Gym', minutes: 45, calories: 320, km: null },
      { date: '2026-08-17', activity: 'Walk', minutes: 25, calories: 120, km: 2.1 },
      { date: '2026-08-16', activity: 'Run', minutes: 30, calories: 260, km: 5.2 },
      { date: '2026-08-15', activity: 'Other', minutes: 0, calories: 0, km: null },
      { date: '2026-08-10', activity: 'Gym', minutes: 60, calories: 400, km: null },
    ], new Date('2026-08-18T12:00:00'))

    expect(workouts).toHaveLength(2)
    expect(workouts.map(w => w.activity)).toEqual(['Gym', 'Walk'])
  })

  it('limits the list to four recent entries', () => {
    const workouts = visibleWearableWorkouts([
      { date: '2026-08-18', activity: 'Gym', minutes: 45, calories: 320, km: null },
      { date: '2026-08-18', activity: 'Run', minutes: 30, calories: 260, km: 5.2 },
      { date: '2026-08-17', activity: 'Walk', minutes: 25, calories: 120, km: 2.1 },
      { date: '2026-08-17', activity: 'Yoga', minutes: 50, calories: 180, km: null },
      { date: '2026-08-17', activity: 'Cycle', minutes: 40, calories: 310, km: 12.2 },
    ], new Date('2026-08-18T12:00:00'))

    expect(workouts).toHaveLength(4)
  })
})
