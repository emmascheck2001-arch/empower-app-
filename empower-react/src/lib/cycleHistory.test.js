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
  const starts = ['2026-06-01']
  it('flags cycle days where the user logged lower energy (adaptable)', () => {
    // 2026-06-22 is cycle day 22; log low energy there
    const h = buildCycleDayHistory([{ log_date: '2026-06-22', energy: 'Very low' }], starts, 28)
    expect(h[22]).toBeTruthy()
    expect(h[22].lighter).toBe(true)
    expect(h[22].text).toMatch(/lower energy/)
  })
  it('flags strong days without suggesting lighter', () => {
    const h = buildCycleDayHistory([{ log_date: '2026-06-10', energy: 'High' }], starts, 28)
    expect(h[10].lighter).toBe(false)
  })
  it('returns empty when there is no signal or data', () => {
    expect(buildCycleDayHistory([], starts, 28)).toEqual({})
    expect(buildCycleDayHistory([{ log_date: '2026-06-10', energy: 'Normal' }], starts, 28)).toEqual({})
  })
})
