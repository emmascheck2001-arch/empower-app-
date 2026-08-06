import { describe, it, expect } from 'vitest'
import { predictNextPeriod } from './hormoneSync'

// Days after an ISO date, as a Date (matches predictNextPeriod's internal math).
const at = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d }
const off = (iso, date) => Math.round((date - new Date(iso + 'T00:00:00')) / 86400000)

describe('predictNextPeriod (research-backed: Bull 2019, Li 2020/2023, FIGO 2018)', () => {
  it('irregular user: predicts from the TYPICAL cycle length, not biased early by a short bleed', () => {
    // Gaps 17 (breakthrough) + 32 (real). avgCycleLength is typical-based (32).
    const p = predictNextPeriod('2026-08-06', 32, 2, [17, 32])
    expect(off('2026-08-06', p.predictedDate)).toBe(32) // point = typical length, not ~24
    expect(p.irregular).toBe(true)
    expect(p.confidence).toBe('moderate')
  })

  it('never predicts a window earlier than the physiological minimum (~21 days)', () => {
    // Absurdly short average must still not paint a period before day 21.
    const p = predictNextPeriod('2026-08-06', 18, 1, [18])
    expect(off('2026-08-06', p.windowStart)).toBeGreaterThanOrEqual(21)
    expect(p.windowStart <= p.predictedDate).toBe(true)
  })

  it('regular user: tight window drawn from their own cycle spread, high confidence', () => {
    const p = predictNextPeriod('2026-08-01', 28, 3, [28, 29, 28])
    expect(p.irregular).toBe(false)
    expect(p.confidence).toBe('high')
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
