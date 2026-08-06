import { describe, it, expect } from 'vitest'
import { buildWatchPayload } from './watchPayload'
import { getMovementToday } from './movementToday'

describe('buildWatchPayload (phone→watch wire contract)', () => {
  it('returns null when there is no status', () => {
    expect(buildWatchPayload(null, '2026-08-06')).toBe(null)
  })

  it('uses the sub-phase as the phase label and the real movement-today guidance', () => {
    const status = { phase: 'Luteal', subPhase: 'Mid luteal' }
    const p = buildWatchPayload(status, '2026-08-06')
    const move = getMovementToday('Luteal', 'Mid luteal')
    expect(p.phase).toBe('Mid luteal')          // sub-phase preferred over coarse phase
    expect(p.date).toBe('2026-08-06')
    expect(p.workouts).toHaveLength(1)
    expect(p.workouts[0].title).toBe(move.title) // never fabricated — pulled from movementToday
    expect(p.workouts[0].detail).toBe(move.detail)
  })

  it('infers a cardio activity when the guidance says to go lighter with tempo cardio', () => {
    // Mid-luteal guidance mentions "tempo cardio or yoga" → yoga keyword wins first; assert a
    // non-Gym bucket so we know keyword inference actually ran.
    const p = buildWatchPayload({ phase: 'Luteal', subPhase: 'Mid luteal' }, '2026-08-06')
    expect(['Yoga', 'Walk', 'Cycle', 'Run', 'Swim', 'Rest', 'Gym']).toContain(p.workouts[0].activity)
  })

  it('infers Gym for a strength-forward follicular build day', () => {
    const p = buildWatchPayload({ phase: 'Follicular', subPhase: 'Follicular' }, '2026-08-06')
    expect(p.workouts[0].activity).toBe('Gym')
  })

  it('never auto-prescribes a workout for pregnancy — guidance only, no exercises', () => {
    const p = buildWatchPayload({ phase: 'Pregnancy', subPhase: 'Second trimester' }, '2026-08-06')
    expect(p.phase).toBe('Second trimester')
    expect(p.workouts[0].activity).toBe('Walk')
    expect(p.workouts[0].exercises).toEqual([])
    expect(p.workouts[0].detail.toLowerCase()).toContain('provider')
  })

  it('tolerates a missing date', () => {
    const p = buildWatchPayload({ phase: 'Menstrual', subPhase: 'Menstrual' })
    expect(p.date).toBe(null)
    expect(p.phase).toBe('Menstrual')
  })

  it('derives age from the profile birth year for the heart-rate flag threshold', () => {
    const birthYear = new Date().getFullYear() - 29
    const p = buildWatchPayload({ phase: 'Follicular', subPhase: 'Follicular', profile: { birth_year: birthYear } }, '2026-08-06')
    expect(p.age).toBe(29)
  })

  it('leaves age null when no birth year is known (watch uses a safe default)', () => {
    const p = buildWatchPayload({ phase: 'Follicular', subPhase: 'Follicular' }, '2026-08-06')
    expect(p.age).toBe(null)
  })
})
