import { describe, it, expect } from 'vitest'
import { cycleTimingReliability, isMeaningfulHealthLog, personalisationProgress } from './hormoneSync'

function denseLogs(days, overrides = {}) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10)
    return {
      log_date: date,
      energy: 'Normal',
      sleep_quality: 'Good',
      mood: ['Calm'],
      symptoms: ['Bloating'],
      resting_hr_exact: 60,
      ...overrides,
    }
  })
}

describe('personalisationProgress — guidance evidence, not forecast confidence', () => {
  it('is 0% with no observations and no cycle anchors', () => {
    const p = personalisationProgress()
    expect(p.personalisationPct).toBe(0)
    expect(p.personalisationLabel).toMatch(/general guidance/i)
  })

  it('grows with meaningful daily observations', () => {
    const few = personalisationProgress({ logs: denseLogs(5) }).personalisationPct
    const more = personalisationProgress({ logs: denseLogs(20) }).personalisationPct
    expect(more).toBeGreaterThan(few)
  })

  it('uses cycle anchors without requiring them for every increment', () => {
    const oneCycle = personalisationProgress({ logs: denseLogs(20), cyclesTracked: 1 }).personalisationPct
    const twoCycles = personalisationProgress({ logs: denseLogs(20), cyclesTracked: 2 }).personalisationPct
    expect(twoCycles).toBeGreaterThan(oneCycle)
  })

  it('does not plateau at 70% after 64 daily logs and two cycles', () => {
    const atOldPlateau = personalisationProgress({ logs: denseLogs(64), cyclesTracked: 2 }).personalisationPct
    const afterEightMoreDays = personalisationProgress({ logs: denseLogs(72), cyclesTracked: 2 }).personalisationPct
    expect(atOldPlateau).toBeGreaterThan(70)
    expect(afterEightMoreDays).toBeGreaterThan(atOldPlateau)
    expect(afterEightMoreDays).toBeGreaterThanOrEqual(79)
  })

  it('rewards broad, sustained, repeated data without treating it as prediction accuracy', () => {
    const p = personalisationProgress({ logs: denseLogs(90), cyclesTracked: 2, hasRepeatedPattern: true })
    expect(p.personalisationPct).toBe(100)
    expect(p.personalisationEvidence).toMatchObject({
      meaningfulLogDays: 90,
      spanDays: 90,
      signalDomains: 5,
      cyclesTracked: 2,
      hasRepeatedPattern: true,
    })
  })

  it('does not count many rows from one date as a longitudinal history', () => {
    const sameDay = denseLogs(90, { log_date: '2026-01-01' })
    const p = personalisationProgress({ logs: sameDay, cyclesTracked: 2 })
    expect(p.personalisationEvidence.meaningfulLogDays).toBe(1)
    expect(p.personalisationEvidence.spanDays).toBe(1)
    expect(p.personalisationPct).toBeLessThan(40)
  })

  it('keeps cycle timing evidence separate from daily guidance personalisation', () => {
    expect(cycleTimingReliability(2)).toMatchObject({ level: 'developing' })
    const periodStarts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']
    const snapshots = [
      { cycle_start_date: '2026-01-01', predicted_period_date: '2026-01-29', window_start: '2026-01-27', window_end: '2026-01-31' },
      { cycle_start_date: '2026-01-29', predicted_period_date: '2026-02-26', window_start: '2026-02-24', window_end: '2026-02-28' },
      { cycle_start_date: '2026-02-26', predicted_period_date: '2026-03-26', window_start: '2026-03-24', window_end: '2026-03-28' },
    ]
    expect(cycleTimingReliability(3, snapshots, periodStarts)).toMatchObject({
      level: 'validated',
      scoredPredictions: 3,
      inWindowRate: 100,
    })
  })

  it('counts libido and stress logs as real learning data', () => {
    expect(isMeaningfulHealthLog({ libido: 'High' })).toBe(true)
    expect(isMeaningfulHealthLog({ stress_level: 4 })).toBe(true)
  })
})
