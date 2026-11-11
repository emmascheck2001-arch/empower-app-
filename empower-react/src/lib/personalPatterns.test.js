import { describe, expect, it } from 'vitest'
import { analyzePersonalPatterns } from './personalPatterns.js'

const PERIOD_STARTS = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']
const cycleData = {
  last_period_date: '2026-03-26',
  cycle_length: 28,
  notes: JSON.stringify({ periodStarts: PERIOD_STARTS }),
}

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function at(cycleN, cycleDay, fields = {}) {
  const d = new Date(PERIOD_STARTS[0] + 'T00:00:00')
  d.setDate(d.getDate() + cycleN * 28 + (cycleDay - 1))
  return { log_date: fmt(d), ...fields }
}

function filler() {
  return [
    at(0, 7, { energy: 'Normal', sleep_quality: 'Good', mood: ['Calm'] }),
    at(0, 11, { energy: 'Normal', sleep_quality: 'Good', mood: ['Focused'] }),
    at(0, 18, { energy: 'Normal', sleep_quality: 'Good' }),
    at(0, 22, { energy: 'Normal', sleep_quality: 'Good' }),
    at(1, 7, { energy: 'Normal', sleep_quality: 'Good', mood: ['Calm'] }),
    at(1, 11, { energy: 'Normal', sleep_quality: 'Good', mood: ['Focused'] }),
    at(1, 18, { energy: 'Normal', sleep_quality: 'Good' }),
    at(1, 22, { energy: 'Normal', sleep_quality: 'Good' }),
    at(2, 7, { energy: 'Normal', sleep_quality: 'Good', mood: ['Calm'] }),
    at(2, 11, { energy: 'Normal', sleep_quality: 'Good', mood: ['Focused'] }),
    at(2, 18, { energy: 'Normal', sleep_quality: 'Good' }),
    at(2, 22, { energy: 'Normal', sleep_quality: 'Good' }),
  ]
}

describe('analyzePersonalPatterns', () => {
  it('learns a repeated libido peak around ovulation', () => {
    const logs = [
      at(0, 13, { libido: 'High' }),
      at(0, 14, { libido: 'High' }),
      at(1, 14, { libido: 'High' }),
      at(1, 15, { libido: 'High' }),
      at(2, 14, { libido: 'High' }),
      ...filler(),
    ]
    const result = analyzePersonalPatterns({ logs, cycleData, phase: 'Ovulatory' })
    const libido = result.insights.find(x => x.domain === 'libido')
    expect(result.status).toBe('ok')
    expect(libido).toBeTruthy()
    expect(libido.headline).toMatch(/sex drive/i)
    expect(libido.body).toMatch(/pattern in your own data/i)
    expect(libido.appliesNow).toBe(true)
  })

  it('learns a repeated late-luteal mood pattern without calling it diagnostic', () => {
    const logs = [
      at(0, 25, { mood: ['Irritable'] }),
      at(0, 26, { mood: ['Anxious'] }),
      at(1, 25, { mood: ['Irritable'] }),
      at(1, 26, { mood: ['Low mood'] }),
      at(2, 25, { mood: ['Sad'] }),
      at(0, 10, { mood: ['Calm'] }),
      at(0, 14, { mood: ['Focused'] }),
      at(1, 10, { mood: ['Calm'] }),
      at(1, 14, { mood: ['Focused'] }),
      at(2, 10, { mood: ['Calm'] }),
      at(2, 14, { mood: ['Focused'] }),
      ...filler(),
    ]
    const result = analyzePersonalPatterns({ logs, cycleData, phase: 'Luteal', subPhase: 'Late luteal' })
    const mood = result.insights.find(x => x.domain === 'mood')
    expect(mood).toBeTruthy()
    expect(mood.headline).toMatch(/before your period/i)
    expect(mood.body).toMatch(/not a diagnosis/i)
    expect(mood.appliesNow).toBe(true)
  })

  it('learns a sleep or recovery dip in the second half of the cycle', () => {
    const logs = [
      at(0, 21, { sleep_quality: 'Poor', energy: 'Low', workout_feel: 'Felt hard' }),
      at(0, 25, { sleep_quality: 'Fair', energy: 'Low' }),
      at(1, 22, { sleep_quality: 'Poor', workout_feel: 'Felt hard' }),
      at(1, 26, { sleep_quality: 'Poor', energy: 'Low' }),
      at(2, 21, { sleep_quality: 'Fair', workout_feel: 'Felt hard' }),
      at(0, 8, { sleep_quality: 'Good', energy: 'Normal', workout_feel: 'Felt average' }),
      at(0, 12, { sleep_quality: 'Good', energy: 'High' }),
      at(1, 8, { sleep_quality: 'Good', energy: 'Normal', workout_feel: 'Felt average' }),
      at(1, 12, { sleep_quality: 'Excellent', energy: 'Normal' }),
      at(2, 8, { sleep_quality: 'Good', energy: 'Normal', workout_feel: 'Felt average' }),
      at(2, 12, { sleep_quality: 'Good', energy: 'High' }),
      ...filler(),
    ]
    const result = analyzePersonalPatterns({ logs, cycleData, phase: 'Luteal', subPhase: 'Mid luteal' })
    const recovery = result.insights.find(x => x.domain === 'sleep_recovery')
    expect(recovery).toBeTruthy()
    expect(recovery.headline).toMatch(/second half of your cycle/i)
    expect(recovery.appliesNow).toBe(true)
  })

  it('stays quiet when there is not enough anchored data yet', () => {
    const logs = [
      at(0, 14, { libido: 'High' }),
      at(0, 25, { mood: ['Irritable'] }),
    ]
    const result = analyzePersonalPatterns({ logs, cycleData, phase: 'Ovulatory' })
    expect(result.status).toBe('insufficient')
    expect(result.insights).toEqual([])
    expect(result.featured).toBeNull()
  })
})
