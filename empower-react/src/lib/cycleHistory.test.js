import { describe, it, expect } from 'vitest'
import { cycleDayForDate, buildCycleDayHistory } from './cycleHistory'

describe('cycleDayForDate', () => {
  it('maps a date to its cycle day from the nearest period start', () => {
    expect(cycleDayForDate('2026-07-05', ['2026-07-05'], 28)).toBe(1)
    expect(cycleDayForDate('2026-07-11', ['2026-07-05'], 28)).toBe(7)
  })
  it('is null-safe', () => {
    expect(cycleDayForDate(null, ['2026-07-05'], 28)).toBe(null)
    expect(cycleDayForDate('2026-07-05', [], 28)).toBe(null)
  })
})

describe('buildCycleDayHistory', () => {
  // Three consecutive cycles so a given cycle day can be logged on >= 3 tracked days,
  // which is the bar buildCycleDayHistory now requires before flagging a day.
  const starts = ['2026-06-01', '2026-06-29', '2026-07-27']
  it('flags cycle days where the user logged lower energy (adaptable)', () => {
    // Cycle day 22 in each of the three cycles: 2026-06-22, 2026-07-20, 2026-08-17
    const h = buildCycleDayHistory([
      { log_date: '2026-06-22', energy: 'Very low' },
      { log_date: '2026-07-20', energy: 'Low' },
      { log_date: '2026-08-17', energy: 'Very low' },
    ], starts, 28)
    expect(h[22]).toBeTruthy()
    expect(h[22].lighter).toBe(true)
    expect(h[22].text).toMatch(/lower energy/)
  })
  it('flags strong days without suggesting lighter', () => {
    // Cycle day 10 in each of the three cycles: 2026-06-10, 2026-07-08, 2026-08-05
    const h = buildCycleDayHistory([
      { log_date: '2026-06-10', energy: 'High' },
      { log_date: '2026-07-08', energy: 'High' },
      { log_date: '2026-08-05', energy: 'High' },
    ], starts, 28)
    expect(h[10].lighter).toBe(false)
  })
  it('returns empty when there is no signal or data', () => {
    expect(buildCycleDayHistory([], starts, 28)).toEqual({})
    expect(buildCycleDayHistory([{ log_date: '2026-06-10', energy: 'Normal' }], starts, 28)).toEqual({})
  })
  it('does not flag a day logged fewer than 3 times', () => {
    const h = buildCycleDayHistory([
      { log_date: '2026-06-22', energy: 'Very low' },
      { log_date: '2026-07-20', energy: 'Low' },
    ], starts, 28)
    expect(h[22]).toBeUndefined()
  })
})
