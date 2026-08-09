import { describe, it, expect } from 'vitest'
import { classifyPeriodStarts, computeCycleHistory, predictNextPeriod } from './hormoneSync'

const iso = d => d.toISOString().slice(0, 10)

// The app can learn from logged period starts, but it should not silently decide that one of
// them "didn't count". If the user logged a period start, cycle history treats it as real until
// she explicitly removes it.
describe('recorded starts stay authoritative', () => {
  const starts = ['2026-06-18', '2026-07-05', '2026-08-06']
  const logs = [
    { log_date: '2026-06-18', flow_volume: 'Moderate' },
    { log_date: '2026-06-20', flow_volume: 'Light' },
    { log_date: '2026-06-21', flow_volume: 'Light' },
    { log_date: '2026-06-22', flow_volume: 'Light' },
    { log_date: '2026-07-05', flow_volume: 'Light' },
    { log_date: '2026-07-06', flow_volume: 'Light' },
    { log_date: '2026-08-06', flow_volume: 'Moderate' },
    { log_date: '2026-08-07', flow_volume: 'Heavy' },
    { log_date: '2026-08-08', flow_volume: 'Light' },
  ]

  it('keeps every recorded start in cycle history even if one bleed was short and light', () => {
    const cycleData = {
      last_period_date: '2026-08-06',
      cycle_length: 28,
      notes: JSON.stringify({ periodStarts: starts }),
    }
    const h = computeCycleHistory(cycleData, 28)
    expect(h.periodStarts).toEqual(starts)
    expect(h.gaps).toEqual([17, 32])
    expect(h.cyclesTracked).toBe(2)
  })

  it('still uses the entered length until only one completed cycle exists', () => {
    const cycleData = {
      last_period_date: '2026-08-06',
      cycle_length: 28,
      notes: JSON.stringify({ periodStarts: ['2026-06-18', '2026-08-06'] }),
    }
    const h = computeCycleHistory(cycleData, 28)
    expect(h.gaps).toEqual([49])
    expect(h.cyclesTracked).toBe(1)
    expect(h.avgCycleLength).toBe(28)
  })

  it('switches to personal history after two completed cycles without discarding starts', () => {
    const cycleData = {
      last_period_date: '2026-08-06',
      cycle_length: 28,
      notes: JSON.stringify({ periodStarts: starts }),
    }
    const h = computeCycleHistory(cycleData, 28)
    const p = predictNextPeriod('2026-08-06', h.avgCycleLength, h.cyclesTracked, h.gaps)
    expect(h.avgCycleLength).toBe(25)
    expect(iso(p.predictedDate)).toBe('2026-08-31')
    expect(p.irregular).toBe(true)
    expect(p.confidence).toBe('low')
  })

  it('detects a short light bleed 17 days later as likely breakthrough and excludes it from cycle maths', () => {
    const cycleData = {
      last_period_date: '2026-08-06',
      cycle_length: 28,
      notes: JSON.stringify({ periodStarts: starts }),
    }
    const classified = classifyPeriodStarts(starts, logs)
    expect(classified.find(c => c.start === '2026-07-05')?.likelyBreakthrough).toBe(true)
    const h = computeCycleHistory(cycleData, 28, logs)
    expect(h.periodStarts).toEqual(starts)                 // still stays on the calendar
    expect(h.breakthroughStarts).toEqual(['2026-07-05'])   // but leaves cycle maths
    expect(h.gaps).toEqual([49])                           // Jun 18 -> Aug 6
    expect(h.cyclesTracked).toBe(1)
    expect(h.avgCycleLength).toBe(28)                      // one real cycle -> population/entered length
    const p = predictNextPeriod('2026-08-06', h.avgCycleLength, h.cyclesTracked, h.gaps)
    expect(iso(p.predictedDate)).toBe('2026-09-03')
  })
})
