import { describe, it, expect } from 'vitest'
import { predictNextPeriod } from './hormoneSync'

// Days between an ISO date and a Date (matches predictNextPeriod's internal math).
const off = (iso, date) => Math.round((date - new Date(iso + 'T00:00:00')) / 86400000)

describe('predictNextPeriod (research-backed: Bull 2019, Li 2020/2023, FIGO 2018)', () => {
  it('irregular user: predicts from the median cycle gap, and flags low confidence', () => {
    // Gaps 17 + 32. True median of an even count averages the two middle values (24.5 → 25).
    // This previously asserted 32, because sorted[n/2] took the UPPER middle value — which put
    // the predicted day on the outer edge of the window built from those same two gaps.
    const p = predictNextPeriod('2026-08-06', 32, 2, [17, 32])
    expect(off('2026-08-06', p.predictedDate)).toBe(25)
    expect(p.irregular).toBe(true)
    expect(p.confidence).toBe('low')   // irregular + only 2 cycles → low, not moderate
  })

  it('does not predict a window before the physiological floor', () => {
    // NOTE: the current physiological floor is 15 days (lowered from 21 by a concurrent edit —
    // flagged for review, as a day-15 period prediction is clinically borderline).
    const p = predictNextPeriod('2026-08-06', 18, 1, [18])
    expect(off('2026-08-06', p.windowStart)).toBeGreaterThanOrEqual(15)
    expect(p.windowStart <= p.predictedDate).toBe(true)
  })

  it('regular user: tight window drawn from their own cycle spread, moderate confidence', () => {
    const p = predictNextPeriod('2026-08-01', 28, 3, [28, 29, 28])
    expect(p.irregular).toBe(false)
    expect(p.confidence).toBe('moderate')   // 3+ regular cycles → moderate
    expect(off('2026-08-01', p.windowStart)).toBe(28)
    expect(off('2026-08-01', p.windowEnd)).toBe(29)
  })

  it('window always contains the predicted day and has non-zero width', () => {
    for (const [avg, cyc, gaps] of [[28, 3, [28, 28, 28]], [30, 1, [30]], [26, 0, []]]) {
      const p = predictNextPeriod('2026-08-01', avg, cyc, gaps)
      expect(p.windowStart <= p.predictedDate).toBe(true)
      expect(p.windowEnd >= p.predictedDate).toBe(true)
      expect(p.windowEnd > p.windowStart).toBe(true)
    }
  })
})
