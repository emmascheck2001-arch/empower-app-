import { describe, expect, it } from 'vitest'
import { getSvgType, supportsLoggedWeight, phaseGuidanceNote } from '../lib/workoutPresentation'

describe('Workout exercise presentation helpers', () => {
  it('maps the corrected floor-based demos', () => {
    expect(getSvgType('Glute bridge')).toBe('bridge')
    expect(getSvgType('Lying leg raise')).toBe('supinelegraise')
    expect(getSvgType('Dead bug')).toBe('deadbug')
    expect(getSvgType('Bicycle crunch')).toBe('bicycle')
    expect(getSvgType('Russian twist')).toBe('russiantwist')
    expect(getSvgType('Mountain climbers')).toBe('mountainclimber')
    expect(getSvgType('Side plank')).toBe('sideplank')
    expect(getSvgType('Plank shoulder taps')).toBe('plankshouldertap')
    expect(getSvgType('Plank jack')).toBe('plankjack')
    expect(getSvgType('Plank to pike')).toBe('plankpike')
    expect(getSvgType('Plank push-up')).toBe('plankpushup')
    expect(getSvgType('Standing core twist')).toBe('standingtwist')
  })

  it('treats load-capable mixed prescriptions as loadable', () => {
    expect(supportsLoggedWeight('Dumbbells or bodyweight')).toBe(true)
    expect(supportsLoggedWeight('Bodyweight or barbell')).toBe(true)
    expect(supportsLoggedWeight('Bodyweight')).toBe(false)
    expect(supportsLoggedWeight('Bodyweight (pull-up bar)')).toBe(false)
  })

  it('gives bodyweight form guidance without directing heavier work based on phase', () => {
    const note = phaseGuidanceNote(
      'Follicular',
      'Rising estrogen often brings your best energy and recovery, and muscle responds well to load now.',
      { name: 'Dead bug', weight: 'Bodyweight' },
      [{ name: 'Hip thrust', weight: '40 to 70kg' }, { name: 'Dead bug', weight: 'Bodyweight' }],
    )
    expect(note).toContain('bodyweight')
    expect(note).toContain('controlled form')
    expect(note).not.toContain('push the heavier')
  })
})
