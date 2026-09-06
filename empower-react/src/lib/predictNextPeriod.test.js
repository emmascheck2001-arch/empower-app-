import { describe, it, expect } from 'vitest'
import { predictNextPeriod, computeCycleHistory } from './hormoneSync'

const off = (iso, date) => Math.round((date - new Date(iso + 'T00:00:00')) / 86400000)
const width = (p, iso) => off(iso, p.windowEnd) - off(iso, p.windowStart)

describe('predictNextPeriod (Bull 2019, Li 2020/2023, FIGO 2018, Symul 2019)', () => {
  it('irregular user: predicts from the typical cycle length, not biased early by a short bleed', () => {
    // Gaps 17 (breakthrough bleed) + 32 (a real cycle). The 17 must not drag the estimate down.
    const p = predictNextPeriod('2026-08-06', 32, 2, [17, 32])
    expect(off('2026-08-06', p.predictedDate)).toBeGreaterThanOrEqual(30)
    expect(p.irregular).toBe(true)
    // Only ONE cycle fell in the typical range, so the model is honest that it is not confident.
    // (The old version reported 'moderate' here purely because two bleeds had been logged.)
    expect(p.confidence).toBe('low')
  })

  it('an irregular history can never be reported as high confidence', () => {
    const p = predictNextPeriod('2026-08-01', 30, 5, [24, 38, 26, 35, 29])
    expect(p.irregular).toBe(true)
    expect(p.confidence).not.toBe('high')
  })

  it('never predicts a window earlier than the physiological minimum (~21 days)', () => {
    const p = predictNextPeriod('2026-08-06', 18, 1, [18])
    expect(off('2026-08-06', p.windowStart)).toBeGreaterThanOrEqual(21)
    expect(p.windowStart <= p.predictedDate).toBe(true)
  })

  it('regular user: predicted day sits on their own cycle length, high confidence', () => {
    const p = predictNextPeriod('2026-08-01', 28, 3, [28, 29, 28])
    expect(p.irregular).toBe(false)
    expect(p.confidence).toBe('high')
    expect(off('2026-08-01', p.predictedDate)).toBe(28)
  })

  it('does NOT claim a 2-day window off 3 cycles, but stays tight (honest precision)', () => {
    // The old version took min/max of her cycles and published a 1-day-wide window from three
    // observations. Three data points cannot support that; the floor is +/-2 days.
    const p = predictNextPeriod('2026-08-01', 28, 3, [28, 29, 28])
    expect(width(p, '2026-08-01')).toBeGreaterThanOrEqual(4)
    expect(width(p, '2026-08-01')).toBeLessThanOrEqual(7)
  })

  it('THE KEY FIX: more cycles narrows the window, it never widens it', () => {
    const thin  = predictNextPeriod('2026-08-01', 28, 2, [28, 29])
    const rich  = predictNextPeriod('2026-08-01', 28, 8, [28, 29, 28, 28, 29, 28, 28, 29])
    expect(width(rich, '2026-08-01')).toBeLessThan(width(thin, '2026-08-01'))
  })

  it('one unusual month does not permanently widen a steady cycle', () => {
    const steady  = predictNextPeriod('2026-08-01', 28, 6, [28, 28, 29, 28, 28, 28])
    const oneBlip = predictNextPeriod('2026-08-01', 28, 7, [28, 28, 29, 28, 28, 28, 41])
    // The 41-day month is fenced off as an outlier; the window may grow a little, never double.
    expect(width(oneBlip, '2026-08-01')).toBeLessThanOrEqual(width(steady, '2026-08-01') + 2)
    expect(Math.abs(off('2026-08-01', oneBlip.predictedDate) - 28)).toBeLessThanOrEqual(2)
  })

  it('a genuinely erratic history keeps a wide, honest window', () => {
    const p = predictNextPeriod('2026-08-01', 30, 5, [22, 38, 25, 36, 30])
    expect(width(p, '2026-08-01')).toBeGreaterThanOrEqual(8)
  })

  it('tracks a real drift in cycle length toward the recent cycles', () => {
    // She used to run 32 days and has settled at 27. The estimate must move toward 27.
    const p = predictNextPeriod('2026-08-01', 30, 6, [32, 32, 31, 28, 27, 27])
    expect(off('2026-08-01', p.predictedDate)).toBeLessThan(30)
  })

  it('a single logged cycle is shrunk toward her stated length, not over-fitted to it', () => {
    // Stated 28, one observed 34. Trusting one observation completely would say 34.
    const p = predictNextPeriod('2026-08-01', 28, 1, [34])
    const d = off('2026-08-01', p.predictedDate)
    expect(d).toBeGreaterThan(28)
    expect(d).toBeLessThan(34)
  })

  it('window always contains the predicted day and has non-zero width', () => {
    const cases = [[28, 3, [28, 28, 28]], [30, 1, [30]], [26, 0, []], [28, 9, [21,45,28,30,22,44,27,29,31]], [21, 2, [21, 21]]]
    for (const [avg, cyc, gaps] of cases) {
      const p = predictNextPeriod('2026-08-01', avg, cyc, gaps)
      expect(p.windowStart <= p.predictedDate).toBe(true)
      expect(p.windowEnd >= p.predictedDate).toBe(true)
      expect(p.windowEnd > p.windowStart).toBe(true)
      expect(off('2026-08-01', p.windowStart)).toBeGreaterThanOrEqual(21)
    }
  })

  it('no history at all falls back to her stated length with an honest wide window', () => {
    const p = predictNextPeriod('2026-08-01', 30, 0, [])
    expect(off('2026-08-01', p.predictedDate)).toBe(30)
    expect(p.confidence).toBe('none')
    expect(width(p, '2026-08-01')).toBeGreaterThanOrEqual(8)
  })
})

describe('computeCycleHistory', () => {
  const cd = (starts, len) => ({ notes: JSON.stringify({ periodStarts: starts }), cycle_length: len })

  it('averages robustly: one long month does not drag a steady cycle', () => {
    const h = computeCycleHistory(cd(['2026-01-01','2026-01-29','2026-02-26','2026-03-26','2026-05-06'], 28), 28)
    expect(h.cyclesTracked).toBe(4)
    expect(h.avgCycleLength).toBeLessThanOrEqual(30)  // a plain mean would report 31
  })

  it('excludes breakthrough bleeds (<15d) and skipped cycles (>60d) from the model', () => {
    const h = computeCycleHistory(cd(['2026-01-01','2026-01-10','2026-02-07'], 28), 28)
    expect(h.cyclesTracked).toBe(1)   // the 9-day gap is not a cycle
  })

  it('falls back to her stated cycle length with no history', () => {
    expect(computeCycleHistory(cd([], 31), 31).avgCycleLength).toBe(31)
    expect(computeCycleHistory(null, 30).avgCycleLength).toBe(30)
  })

  it('reports regularity only once there is enough data to judge it', () => {
    expect(computeCycleHistory(cd(['2026-01-01','2026-01-29'], 28), 28).regular).toBe(null)
    const steady = computeCycleHistory(cd(['2026-01-01','2026-01-29','2026-02-26','2026-03-26'], 28), 28)
    expect(steady.regular).toBe(true)
  })
})
