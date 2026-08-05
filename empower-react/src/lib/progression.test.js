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

describe('getProgressionTarget', () => {
  it('returns null when there is no history (first time)', () => {
    expect(getProgressionTarget({ lastWeight: null, exerciseName: 'Bench press', intensityModifier: 1.0 })).toBeNull()
    expect(getProgressionTarget({ lastWeight: undefined, exerciseName: 'Bench press' })).toBeNull()
  })

  it('adds load in a favourable (follicular/ovulatory) phase', () => {
    const r = getProgressionTarget({ lastWeight: 40, exerciseName: 'Bench press', intensityModifier: 1.05 })
    expect(r.action).toBe('progress')
    expect(r.weight).toBe(42.5)   // +2.5 upper body
    expect(r.delta).toBe(2.5)
  })

  it('adds a bigger jump on lower-body compounds in a favourable phase', () => {
    const r = getProgressionTarget({ lastWeight: 60, exerciseName: 'Back squat', intensityModifier: 0.95 })
    expect(r.weight).toBe(65)     // +5 lower body
    expect(r.action).toBe('progress')
  })

  it('holds at last weight in a neutral (early luteal) phase', () => {
    const r = getProgressionTarget({ lastWeight: 40, exerciseName: 'Bench press', intensityModifier: 0.92 })
    expect(r.action).toBe('hold')
    expect(r.weight).toBe(40)
    expect(r.delta).toBe(0)
  })

  it('holds with "feels harder" framing in a demanding (luteal/menstrual) phase', () => {
    const r = getProgressionTarget({ lastWeight: 40, exerciseName: 'Bench press', intensityModifier: 0.72 })
    expect(r.action).toBe('hold-hard')
    expect(r.weight).toBe(40)
    expect(r.reason).toMatch(/feels harder|physiology/i)
  })

  it('rounds to the nearest 0.5kg', () => {
    const r = getProgressionTarget({ lastWeight: 12.25, exerciseName: 'Curl', intensityModifier: 1.0 })
    expect(r.weight % 0.5).toBe(0)
  })

  it('never progresses past a hold in a low-intensity phase even for lower body', () => {
    const r = getProgressionTarget({ lastWeight: 80, exerciseName: 'Deadlift', intensityModifier: 0.70 })
    expect(r.action).toBe('hold-hard')
    expect(r.weight).toBe(80)
  })
})
