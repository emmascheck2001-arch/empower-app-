import { describe, it, expect } from 'vitest'
import { diffCalendarDays, toCalendarDayIndex, daysAgo, addDays, parseLocalDate, toDateStr } from './dateUtils'

describe('dateUtils — DST-safe calendar math', () => {
  it('counts whole calendar days regardless of clock time', () => {
    expect(diffCalendarDays('2026-03-10', '2026-03-01')).toBe(9)
    expect(diffCalendarDays('2026-03-01', '2026-03-10')).toBe(-9)
    expect(diffCalendarDays('2026-03-01', '2026-03-01')).toBe(0)
  })

  it('is correct across the US spring-forward transition (2nd Sunday March, 23h day)', () => {
    // Spring forward 2026: 2026-03-08. A naive (a-b)/86400000 on local-midnight dates would
    // return 0.958... and floor to 0 for this one-calendar-day gap. Calendar diff must be 1.
    expect(diffCalendarDays('2026-03-09', '2026-03-08')).toBe(1)
    expect(diffCalendarDays('2026-03-09', '2026-03-07')).toBe(2)
  })

  it('is correct across the US fall-back transition (1st Sunday Nov, 25h day)', () => {
    // Fall back 2026: 2026-11-01. Naive math could over-count to 2 for a one-day gap.
    expect(diffCalendarDays('2026-11-02', '2026-11-01')).toBe(1)
    expect(diffCalendarDays('2026-11-03', '2026-11-01')).toBe(2)
  })

  it('daysAgo counts calendar days since a past date', () => {
    const now = parseLocalDate('2026-03-09')
    expect(daysAgo('2026-03-02', now)).toBe(7)
    expect(daysAgo('2026-03-08', now)).toBe(1)   // across spring-forward
  })

  it('addDays lands on the right calendar date across DST', () => {
    expect(toDateStr(addDays('2026-03-07', 1))).toBe('2026-03-08')
    expect(toDateStr(addDays('2026-03-08', 1))).toBe('2026-03-09')  // spring-forward day
    expect(toDateStr(addDays('2026-11-01', 1))).toBe('2026-11-02')  // fall-back day
    expect(toDateStr(addDays('2026-01-31', 1))).toBe('2026-02-01')  // month rollover
  })

  it('toCalendarDayIndex is monotonic and integer', () => {
    const a = toCalendarDayIndex('2026-06-01')
    const b = toCalendarDayIndex('2026-06-02')
    expect(Number.isInteger(a)).toBe(true)
    expect(b - a).toBe(1)
  })
})
