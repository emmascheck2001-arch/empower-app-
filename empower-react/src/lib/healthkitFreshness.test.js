import { describe, it, expect } from 'vitest'
import { valueOn, valueForDate, daysStale, lastWornDaysAgo, todayLocal } from './healthkit'

// The bug this guards: wearable streams only contain the days the device was actually worn, so
// the newest resting-HR sample can be days old. Showing it as "today's heart rate" — or writing
// it into today's log — invents a measurement she never took.
describe('wearable freshness', () => {
  const today = '2026-09-13'

  it('does not treat a two-day-old reading as today', () => {
    expect(valueOn({ date: '2026-09-11', value: 74 }, today)).toBe(null)
  })

  it('returns a reading measured today', () => {
    expect(valueOn({ date: today, value: 61 }, today)).toBe(61)
  })

  it('handles a missing or undated reading', () => {
    expect(valueOn(null, today)).toBe(null)
    expect(valueOn({ value: 74 }, today)).toBe(null)
  })

  it('counts how stale a reading is', () => {
    expect(daysStale({ date: today }, today)).toBe(0)
    expect(daysStale({ date: '2026-09-12' }, today)).toBe(1)
    expect(daysStale({ date: '2026-09-11' }, today)).toBe(2)
    expect(daysStale(null, today)).toBe(null)
  })

  it('reports the most recent day any stream was worn', () => {
    const data = { latest: {
      temp: { date: '2026-09-10', value: 36.4 },
      rhr: { date: '2026-09-11', value: 74 },
      hrv: null,
      sleep: { date: '2026-09-11', value: 7.2 },
    } }
    expect(lastWornDaysAgo(data, today)).toBe(2)
    expect(lastWornDaysAgo({ latest: {} }, today)).toBe(null)
  })

  it('looks a specific day up in a dated series, for backfilling a past date', () => {
    const daily = [
      { date: '2026-09-09', value: 60 },
      { date: '2026-09-11', value: 74 },
    ]
    expect(valueForDate(daily, '2026-09-11')).toBe(74)
    expect(valueForDate(daily, '2026-09-10')).toBe(null)   // gap day: not worn
    expect(valueForDate(daily, today)).toBe(null)
    expect(valueForDate(undefined, today)).toBe(null)
  })

  it('formats today as a local calendar date', () => {
    expect(todayLocal(new Date(2026, 8, 3))).toBe('2026-09-03')
  })
})
