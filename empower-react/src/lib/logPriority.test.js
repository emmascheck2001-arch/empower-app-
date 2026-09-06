import { describe, it, expect } from 'vitest'
import { pickTodaysQuestions, quickFieldKeys, fertileWindow, MAX_CONTEXTUAL, FIELDS } from './logPriority'

const keys = p => p.ask.map(f => f.key)

describe('fertileWindow', () => {
  it('tracks the cycle length rather than assuming mid-cycle', () => {
    expect(fertileWindow(28).ovulationDay).toBe(14)
    expect(fertileWindow(35).ovulationDay).toBe(21)   // NOT day 17
    expect(fertileWindow(21).ovulationDay).toBe(8)
  })
})

describe('pickTodaysQuestions', () => {
  it('always asks energy, whatever the phase', () => {
    for (const phase of ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal']) {
      expect(keys(pickTodaysQuestions({ phase, cycleDay: 10, cycleLen: 28 }))).toContain('energy')
    }
  })

  it('never asks more than a handful of questions', () => {
    const p = pickTodaysQuestions({ phase: 'Luteal', cycleDay: 26, cycleLen: 28 })
    expect(p.contextual.length).toBeLessThanOrEqual(MAX_CONTEXTUAL)
  })

  it('SAFETY: flow and pain always stay in the top view while bleeding', () => {
    const p = pickTodaysQuestions({ phase: 'Menstrual', cycleDay: 2, cycleLen: 28, isMenstrual: true })
    expect(keys(p)).toContain('flow_volume')
    expect(keys(p)).toContain('pain_rating')
  })

  it('asks cervical fluid in the fertile window and not on a random follicular day', () => {
    const fertile = pickTodaysQuestions({ phase: 'Ovulatory', cycleDay: 13, cycleLen: 28, confidence: 0.8 })
    const quiet   = pickTodaysQuestions({ phase: 'Follicular', cycleDay: 7, cycleLen: 28, confidence: 0.8 })
    expect(keys(fertile)).toContain('cervical_fluid')
    expect(keys(quiet)).not.toContain('cervical_fluid')
  })

  it('moves the fertile window with a long cycle instead of assuming day 14', () => {
    const p = pickTodaysQuestions({ phase: 'Ovulatory', cycleDay: 20, cycleLen: 35, confidence: 0.8 })
    expect(keys(p)).toContain('cervical_fluid')
  })

  it('asks cervical fluid when the model is uncertain, even outside the fertile window', () => {
    const p = pickTodaysQuestions({ phase: 'Follicular', cycleDay: 7, cycleLen: 28, confidence: 0.3 })
    expect(keys(p)).toContain('cervical_fluid')
  })

  it('never asks cervical fluid during a period (bleeding masks the signal)', () => {
    const p = pickTodaysQuestions({ phase: 'Menstrual', cycleDay: 2, cycleLen: 28, isMenstrual: true, confidence: 0.2 })
    expect(keys(p)).not.toContain('cervical_fluid')
  })

  it('asks mood and symptoms in the late luteal PMS window', () => {
    const k = keys(pickTodaysQuestions({ phase: 'Luteal', cycleDay: 26, cycleLen: 28 }))
    expect(k).toContain('mood')
    expect(k).toContain('symptoms')
  })

  it('prioritises stress when the period is late', () => {
    const k = keys(pickTodaysQuestions({ phase: 'Luteal', cycleDay: 32, cycleLen: 28, latePeriod: true }))
    expect(k).toContain('stress_level')
  })

  it('does not ask for sleep the watch already filled in', () => {
    const withWatch = pickTodaysQuestions({ phase: 'Follicular', cycleDay: 8, cycleLen: 28, wearableFills: ['sleep_quality'] })
    expect(keys(withWatch)).not.toContain('sleep_quality')
  })

  it('only asks about training on days she has been training', () => {
    // A realistically FULL recent history, so nothing is stale and the phase logic is what
    // is actually being tested rather than the staleness bump.
    const full = (workout_feel) => ({ energy: 'Normal', mood: ['Calm'], symptoms: ['None'], sleep_quality: 'Good',
      stress_level: 2, cervical_fluid: 'Creamy or lotion-like', workout_feel })
    const rest = pickTodaysQuestions({ phase: 'Follicular', cycleDay: 8, confidence: 0.8,
      recentLogs: [full('Rest day'), full('Rest day'), full('Rest day'), full('Rest day')] })
    const active = pickTodaysQuestions({ phase: 'Follicular', cycleDay: 8, confidence: 0.8,
      recentLogs: [full('Average'), full('Stronger than usual'), full('Average'), full('Average')] })
    expect(keys(rest)).not.toContain('workout_feel')
    expect(keys(active)).toContain('workout_feel')
  })

  it('only offers LH tests to someone who actually tests', () => {
    const tester = pickTodaysQuestions({ phase: 'Ovulatory', cycleDay: 13, recentLogs: [{ lh_result: 'Negative' }] })
    const not = pickTodaysQuestions({ phase: 'Ovulatory', cycleDay: 13, recentLogs: [{ energy: 'High' }] })
    expect(keys(tester)).toContain('lh_result')
    expect(keys(not)).not.toContain('lh_result')
  })

  it('re-asks a field that has gone stale', () => {
    const stale = pickTodaysQuestions({ phase: 'Follicular', cycleDay: 8, cycleLen: 28,
      recentLogs: [{ energy: 'High' }, { energy: 'High' }, { energy: 'High' }, { energy: 'High' }, { energy: 'High' }, { energy: 'High' }] })
    expect(keys(stale).length).toBeGreaterThan(1)
  })

  it('perimenopause keeps its own set and is never trimmed', () => {
    const p = pickTodaysQuestions({ isPath4: true, phase: 'observation' })
    expect(p.isPath4).toBe(true)
    expect(keys(p)).toContain('energy')
  })

  it('is stable and never throws on empty input', () => {
    expect(() => pickTodaysQuestions()).not.toThrow()
    expect(() => pickTodaysQuestions({ recentLogs: null, phase: null })).not.toThrow()
  })

  it('every returned key is a real field the log screen can render', () => {
    const p = pickTodaysQuestions({ phase: 'Luteal', cycleDay: 26, cycleLen: 28, isMenstrual: false })
    for (const k of quickFieldKeys(p)) expect(FIELDS[k]).toBeTruthy()
  })
})
