import { describe, it, expect } from 'vitest'
import { getProgressionTarget, progressionIncrement } from './progression.js'

describe('progressionIncrement', () => {
  it('uses 5kg for lower-body compounds', () => {
    expect(progressionIncrement('Back squat')).toBe(5)
    expect(progressionIncrement('Romanian deadlift')).toBe(5)
    expect(progressionIncrement('Hip thrust')).toBe(5)
  })
  it('uses 2.5kg for upper-body / isolation moves', () => {
    expect(progressionIncrement('Dumbbell shoulder press')).toBe(2.5)
    expect(progressionIncrement('Bicep curl')).toBe(2.5)
    expect(progressionIncrement('')).toBe(2.5)
  })
})

// Progression is now PERFORMANCE-led (the user's own completed sessions + how the last one felt),
// not cycle-phase prescribed. It only adds load after two tolerable sessions.
describe('getProgressionTarget', () => {
  it('returns null when there is no history (first time)', () => {
    expect(getProgressionTarget({ lastWeight: null, exerciseName: 'Bench press' })).toBeNull()
    expect(getProgressionTarget({ lastWeight: undefined, exerciseName: 'Bench press' })).toBeNull()
  })

  it('adds load after two completed, tolerable sessions', () => {
    const r = getProgressionTarget({ lastWeight: 40, exerciseName: 'Bench press', successfulSessions: 2, lastSessionFeel: 'Felt average' })
    expect(r.action).toBe('progress')
    expect(r.weight).toBe(42.5)   // +2.5 upper body
    expect(r.delta).toBe(2.5)
  })

  it('adds a bigger jump on lower-body compounds', () => {
    const r = getProgressionTarget({ lastWeight: 60, exerciseName: 'Back squat', successfulSessions: 3, lastSessionFeel: 'Felt strong' })
    expect(r.weight).toBe(65)     // +5 lower body
    expect(r.action).toBe('progress')
  })

  it('holds (building sessions) when there are not yet two tolerable sessions', () => {
    const r = getProgressionTarget({ lastWeight: 40, exerciseName: 'Bench press', successfulSessions: 1, lastSessionFeel: 'Felt average' })
    expect(r.action).toBe('hold')
    expect(r.weight).toBe(40)
    expect(r.delta).toBe(0)
  })

  it('holds hard when the last session felt hard, regardless of session count', () => {
    const r = getProgressionTarget({ lastWeight: 40, exerciseName: 'Bench press', successfulSessions: 3, lastSessionFeel: 'Felt hard' })
    expect(r.action).toBe('hold-hard')
    expect(r.weight).toBe(40)
    expect(r.reason).toMatch(/felt hard|lighter load/i)
  })

  it('rounds to the nearest 0.5kg', () => {
    const r = getProgressionTarget({ lastWeight: 12.25, exerciseName: 'Curl', successfulSessions: 0 })
    expect(r.weight % 0.5).toBe(0)
  })

  it('does not progress a lower-body lift that has not earned it (only one good session)', () => {
    const r = getProgressionTarget({ lastWeight: 80, exerciseName: 'Deadlift', successfulSessions: 1, lastSessionFeel: 'Felt strong' })
    expect(r.action).toBe('hold')
    expect(r.weight).toBe(80)
  })
})
