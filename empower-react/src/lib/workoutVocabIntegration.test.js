import { describe, it, expect } from 'vitest'
import { getPersonalisedWorkoutReadiness } from './algorithm_v3'

// INTEGRATION REGRESSION TEST for the vocabulary bug.
//
// Three screens wrote three different vocabularies into daily_logs.workout_feel, and the
// engines matched raw strings, so the SAME behaviour produced different insights depending
// on which screen the user happened to log from. These tests assert the engines are now
// blind to which screen wrote the row — which is the entire point of workoutFeel.js.
const iso = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const logs = (...feels) => feels.map((workout_feel, i) => ({ log_date: iso(i), workout_feel }))

describe('workout vocabulary: the engine reads both dialects the same way', () => {
  it('three hard sessions are recognised from the WORKOUT PLAYER vocabulary', () => {
    const r = getPersonalisedWorkoutReadiness(logs('Felt hard', 'Felt hard', 'Felt hard'))
    expect(r).toMatch(/felt hard/i)
  })

  it('three hard sessions are recognised from the DAILY LOG vocabulary (previously missed entirely)', () => {
    const r = getPersonalisedWorkoutReadiness(logs('Weaker than usual', 'Weaker than usual', 'Weaker than usual'))
    expect(r).toMatch(/felt hard/i)
  })

  it('the two dialects produce the IDENTICAL insight', () => {
    expect(getPersonalisedWorkoutReadiness(logs('Weaker than usual', 'Weaker than usual', 'Weaker than usual')))
      .toBe(getPersonalisedWorkoutReadiness(logs('Felt hard', 'Felt hard', 'Felt hard')))
  })

  it('MIXED dialects still add up — a user who logs from both screens is not penalised', () => {
    // This is the real-world case: she logs some days in the player, some in the daily log.
    // Before the fix neither vocabulary reached the threshold on its own and she got nothing.
    const r = getPersonalisedWorkoutReadiness(logs('Felt hard', 'Weaker than usual', 'Felt hard'))
    expect(r).toMatch(/felt hard/i)
  })

  it('strong sessions are recognised from both dialects', () => {
    const a = getPersonalisedWorkoutReadiness(logs('Felt strong', 'Felt strong'))
    const b = getPersonalisedWorkoutReadiness(logs('Stronger than usual', 'Stronger than usual'))
    expect(a).toMatch(/strong/i)
    expect(b).toBe(a)
  })

  it('rest days are never counted as sessions in either dialect', () => {
    expect(getPersonalisedWorkoutReadiness(logs('Rest day', 'Rest day', 'Rest day'))).toBe(null)
    expect(getPersonalisedWorkoutReadiness(logs('Skipped', 'Skipped', 'Skipped'))).toBe(null)
  })

  it('an ungradeable historical value does not fabricate an insight', () => {
    // A live row literally reads 'yoga'. It counts as training, but we must not grade it.
    expect(getPersonalisedWorkoutReadiness(logs('yoga', 'yoga', 'yoga'))).toBe(null)
  })
})
