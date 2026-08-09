import { describe, it, expect } from 'vitest'
import { medianOf, predictNextPeriod, computeCycleHistory } from './hormoneSync'

const iso = d => d.toISOString().slice(0, 10)

describe('median cycle length', () => {
  it('averages the two middle values for an even number of cycles', () => {
    expect(medianOf([17, 32])).toBe(24.5)
    expect(medianOf([20, 26, 30, 34])).toBe(28)
  })

  it('takes the middle value for an odd number of cycles', () => {
    expect(medianOf([17, 28, 32])).toBe(28)
    expect(medianOf([30])).toBe(30)
  })

  it('handles empty input', () => {
    expect(medianOf([])).toBeNull()
    expect(medianOf(null)).toBeNull()
  })

  // Regression: with an even gap count the old sorted[n/2] returned the UPPER middle value, so
  // the predicted day landed on the outer edge of the window built from those same gaps.
  it('keeps the predicted date inside its own window', () => {
    const p = predictNextPeriod('2026-08-06', 32, 2, [17, 32])
    expect(iso(p.predictedDate)).toBe('2026-08-31')
    expect(p.predictedDate.getTime()).toBeGreaterThan(p.windowStart.getTime())
    expect(p.predictedDate.getTime()).toBeLessThan(p.windowEnd.getTime())
  })

  it('still flags genuinely irregular history as irregular and low confidence', () => {
    const p = predictNextPeriod('2026-08-06', 32, 2, [17, 32])
    expect(p.irregular).toBe(true)
    expect(p.confidence).toBe('low')
  })

  it('leaves odd-count predictions unchanged', () => {
    const p = predictNextPeriod('2026-08-06', 28, 3, [27, 28, 29])
    expect(iso(p.predictedDate)).toBe('2026-09-03')   // 28-day median
  })

  it('derives the learned cycle length from the true median', () => {
    const cycleData = {
      last_period_date: '2026-08-06',
      cycle_length: 28,
      notes: JSON.stringify({ periodStarts: ['2026-06-18', '2026-07-05', '2026-08-06'] }),
    }
    const h = computeCycleHistory(cycleData, 28)
    expect(h.gaps).toEqual([17, 32])
    expect(h.avgCycleLength).toBe(25)      // round(24.5), was 32
    expect(h.variabilityDays).toBe(15)
  })
})

// Population data carries the estimate until two completed cycles exist to compare.
describe('two-cycle threshold before trusting personal history', () => {
  const iso = d => d.toISOString().slice(0, 10)

  it('uses the entered cycle length when only one cycle has completed', () => {
    const p = predictNextPeriod('2026-08-06', 28, 1, [49])
    expect(iso(p.predictedDate)).toBe('2026-09-03')   // 28 days, not 49
  })

  it('switches to her own median as soon as a second cycle completes', () => {
    const p = predictNextPeriod('2026-08-06', 28, 2, [49, 47])
    expect(iso(p.predictedDate)).toBe('2026-09-23')   // median 48, her own data
  })

  it('still flags a single atypical cycle as irregular', () => {
    const p = predictNextPeriod('2026-08-06', 28, 1, [49])
    expect(p.irregular).toBe(true)
  })

  it('learned cycle length ignores a lone cycle but adopts two', () => {
    const notes = starts => JSON.stringify({ periodStarts: starts })
    const one = computeCycleHistory({ last_period_date: '2026-08-06', cycle_length: 28, notes: notes(['2026-06-18', '2026-08-06']) }, 28)
    expect(one.avgCycleLength).toBe(28)
    const two = computeCycleHistory({ last_period_date: '2026-09-24', cycle_length: 28, notes: notes(['2026-06-18', '2026-08-06', '2026-09-24']) }, 28)
    expect(two.gaps).toEqual([49, 49])
    expect(two.avgCycleLength).toBe(49)
  })
})
