import { describe, it, expect } from 'vitest'
import { buildWeeklyHighlights } from './weeklyHighlights.js'

// 2026-06-29 is a Monday; use a known week so weekday names are deterministic.
const D = { sun: '2026-06-28', mon: '2026-06-29', tue: '2026-06-30', wed: '2026-07-01', thu: '2026-07-02', fri: '2026-07-03', sat: '2026-07-04' }
const log = (date, f) => ({ log_date: date, ...f })

describe('buildWeeklyHighlights', () => {
  it('returns nothing with no data', () => {
    expect(buildWeeklyHighlights([], [])).toEqual([])
  })

  it('counts days trained from logged workouts only', () => {
    const week = [
      log(D.mon, { workout_feel: 'Felt strong' }),
      log(D.tue, { workout_feel: 'Rest day' }),
      log(D.wed, { workout_feel: 'Felt average' }),
      log(D.thu, { workout_feel: 'Skipped' }),
    ]
    expect(buildWeeklyHighlights(week, [])[0]).toBe('You trained 2 days this week.')
  })

  it('compares workouts to last week only when last week has data', () => {
    const thisW = [log(D.mon, { workout_feel: 'Felt strong' }), log(D.wed, { workout_feel: 'Felt average' }), log(D.fri, { workout_feel: 'Felt hard' })]
    const lastW = [log(D.mon, { workout_feel: 'Felt strong' }), log(D.wed, { workout_feel: 'Rest day' }), log(D.fri, { workout_feel: 'Rest day' })]
    const h = buildWeeklyHighlights(thisW, lastW)
    expect(h.join(' ')).toMatch(/2 sessions more than last week/)
    // with no last week, no comparison line
    expect(buildWeeklyHighlights(thisW, []).join(' ')).not.toMatch(/than last week/)
  })

  it('names an energy peak ONLY when one day is the unique maximum', () => {
    const clear = [log(D.mon, { energy: 'Low' }), log(D.wed, { energy: 'High' }), log(D.fri, { energy: 'Normal' })]
    expect(buildWeeklyHighlights(clear, []).join(' ')).toMatch(/energy was highest on Wednesday/)
    // tie → no peak named (would imply a peak that isn't there)
    const tie = [log(D.mon, { energy: 'High' }), log(D.wed, { energy: 'High' }), log(D.fri, { energy: 'Low' })]
    expect(buildWeeklyHighlights(tie, []).join(' ')).not.toMatch(/energy was highest/)
  })

  it('names a stress peak only when elevated and unique', () => {
    const week = [log(D.mon, { stress_level: 2 }), log(D.wed, { stress_level: 5 }), log(D.fri, { stress_level: 3 })]
    expect(buildWeeklyHighlights(week, []).join(' ')).toMatch(/stress was highest on Wednesday/)
    // not elevated enough (max < 4) → no line
    const calm = [log(D.mon, { stress_level: 1 }), log(D.wed, { stress_level: 3 }), log(D.fri, { stress_level: 2 })]
    expect(buildWeeklyHighlights(calm, []).join(' ')).not.toMatch(/stress was highest/)
  })

  it('compares sleep hours ONLY when both weeks have logged hours', () => {
    const thisW = [log(D.mon, { sleep_hours: 8 }), log(D.wed, { sleep_hours: 8 }), log(D.fri, { sleep_hours: 8 })]
    const lastW = [log(D.mon, { sleep_hours: 7 }), log(D.wed, { sleep_hours: 7 }), log(D.fri, { sleep_hours: 7 })]
    expect(buildWeeklyHighlights(thisW, lastW).join(' ')).toMatch(/60 minutes more per night than last week/)
    // no last-week hours → no comparison (never fabricate the baseline)
    expect(buildWeeklyHighlights(thisW, []).join(' ')).not.toMatch(/than last week/)
  })

  it('ignores a sub-10-minute sleep change as noise', () => {
    const thisW = [log(D.mon, { sleep_hours: 7.1 }), log(D.wed, { sleep_hours: 7.1 }), log(D.fri, { sleep_hours: 7.1 })]
    const lastW = [log(D.mon, { sleep_hours: 7.0 }), log(D.wed, { sleep_hours: 7.0 }), log(D.fri, { sleep_hours: 7.0 })]
    expect(buildWeeklyHighlights(thisW, lastW).join(' ')).not.toMatch(/minutes/)
  })

  it('does not throw on logs missing fields', () => {
    expect(() => buildWeeklyHighlights([{ log_date: D.mon }, {}, { log_date: D.wed, mood: null }], [])).not.toThrow()
  })
})
