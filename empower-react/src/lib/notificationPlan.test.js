import { describe, it, expect } from 'vitest'
import { buildNotificationPlan, copyIsSafe, IDS, MAX_PER_WEEK } from './notificationPlan'

const NOW = new Date('2026-09-02T08:00:00')   // a Wednesday
const status = (o = {}) => ({
  nextPeriodPrediction: { predictedDate: new Date('2026-09-14T00:00:00'), confidence: 'high' },
  ...o,
})
const on = (o = {}) => ({ enabled: true, ...o })

describe('buildNotificationPlan', () => {
  it('schedules nothing at all when notifications are off', () => {
    expect(buildNotificationPlan(status(), { enabled: false, streak: 9 }, NOW)).toHaveLength(0)
  })

  it('never schedules more than the weekly cap', () => {
    const p = buildNotificationPlan(status(), on({ streak: 30, loggedToday: false }), NOW)
    expect(p.length).toBeLessThanOrEqual(MAX_PER_WEEK)
  })

  it('warns two days before the predicted period, at 9am', () => {
    const p = buildNotificationPlan(status(), on(), NOW)
    const n = p.find(x => x.id === IDS.PERIOD)
    expect(n.at.toDateString()).toBe(new Date('2026-09-12T09:00:00').toDateString())
    expect(n.at.getHours()).toBe(9)
  })

  it('hedges harder when the prediction is not confident', () => {
    const low = buildNotificationPlan(status({ nextPeriodPrediction: { predictedDate: new Date('2026-09-14T00:00:00'), confidence: 'low' } }), on(), NOW)
    expect(low.find(x => x.id === IDS.PERIOD).body).toMatch(/may fall/i)
  })

  it('says nothing about a period it cannot predict', () => {
    expect(buildNotificationPlan(status({ nextPeriodPrediction: null }), on(), NOW).find(x => x.id === IDS.PERIOD)).toBeUndefined()
    expect(buildNotificationPlan(status({ nextPeriodPrediction: { predictedDate: new Date('2026-09-14'), confidence: 'none' } }), on(), NOW)
      .find(x => x.id === IDS.PERIOD)).toBeUndefined()
  })

  it('never schedules a notification in the past', () => {
    const past = buildNotificationPlan(status({ nextPeriodPrediction: { predictedDate: new Date('2026-08-01T00:00:00'), confidence: 'high' } }), on({ streak: 5 }), NOW)
    for (const n of past) expect(n.at.getTime()).toBeGreaterThan(NOW.getTime())
  })

  it('only nudges someone who already has a habit, and never after she has logged', () => {
    expect(buildNotificationPlan(status(), on({ streak: 2 }), NOW).find(x => x.id === IDS.NUDGE)).toBeUndefined()
    expect(buildNotificationPlan(status(), on({ streak: 5, loggedToday: true }), NOW).find(x => x.id === IDS.NUDGE)).toBeUndefined()
    expect(buildNotificationPlan(status(), on({ streak: 5, loggedToday: false }), NOW).find(x => x.id === IDS.NUDGE)).toBeTruthy()
  })

  it('always queues the weekly review for the next Sunday', () => {
    const n = buildNotificationPlan(status(), on(), NOW).find(x => x.id === IDS.WEEKLY)
    expect(n.at.getDay()).toBe(0)
    expect(n.at.getTime()).toBeGreaterThan(NOW.getTime())
  })

  it('rolls the weekly review forward when it is already Sunday afternoon', () => {
    const sundayPM = new Date('2026-09-06T15:00:00')
    const n = buildNotificationPlan(status(), on(), sundayPM).find(x => x.id === IDS.WEEKLY)
    expect(n.at.getTime()).toBeGreaterThan(sundayPM.getTime())
    expect(n.at.getDay()).toBe(0)
  })

  it('uses stable ids so rescheduling replaces instead of duplicating', () => {
    const a = buildNotificationPlan(status(), on({ streak: 5 }), NOW)
    const b = buildNotificationPlan(status(), on({ streak: 5 }), NOW)
    expect(a.map(x => x.id)).toEqual(b.map(x => x.id))
    expect(new Set(a.map(x => x.id)).size).toBe(a.length)
  })

  it('SAFETY: no shipped copy guilts, diagnoses, or leaks anything to a lock screen', () => {
    for (const ctx of [on({ streak: 9 }), on({ streak: 0 }), on({ streak: 4, loggedToday: true })]) {
      for (const n of buildNotificationPlan(status(), ctx, NOW)) {
        expect(copyIsSafe(n.title)).toBe(true)
        expect(copyIsSafe(n.body)).toBe(true)
      }
    }
  })

  it('the safety guard actually catches the things it claims to', () => {
    expect(copyIsSafe('You broke your streak!')).toBe(false)
    expect(copyIsSafe('Your period starts tomorrow')).toBe(false)
    expect(copyIsSafe('Log your cramps')).toBe(false)
    expect(copyIsSafe("You're in your fertile window")).toBe(false)
    expect(copyIsSafe('A heads up from Em~power')).toBe(true)
  })

  it('does not throw on empty input', () => {
    expect(() => buildNotificationPlan(null, on(), NOW)).not.toThrow()
    expect(() => buildNotificationPlan(undefined, {}, NOW)).not.toThrow()
  })
})
