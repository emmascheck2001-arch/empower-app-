import { describe, expect, it } from 'vitest'
import { buildNotificationSchedule } from './notifications'
import { nextPersonalisationMilestone } from './hormoneSync'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
describe('buildNotificationSchedule', () => {
  it('schedules only one daily reminder to log, regardless of cycle prediction', () => {
    const now = new Date(); now.setHours(8, 0, 0, 0)
    const out = buildNotificationSchedule(
      { cycleDay: 5, cycleLen: 28, daysUntilPeriod: 10, phase: 'Follicular' },
      { today: todayStr(), hour: 9, minute: 0, now }
    )
    const keys = out.map(n => n.date.toISOString().slice(0, 10))
    expect(new Set(keys).size).toBe(keys.length)
    expect(out.every(n => n.route === '/log')).toBe(true)
    expect(out.every(n => /How did today feel/.test(n.body))).toBe(true)
    expect(out.some(n => /period|fertile/i.test(n.body))).toBe(false)
  })

  it('uses the time the user selected for every daily reminder', () => {
    const now = new Date(); now.setHours(6, 0, 0, 0)
    const out = buildNotificationSchedule(null, { today: todayStr(), hour: 7, minute: 30, now })
    expect(out.length).toBeGreaterThan(0)
    out.forEach(n => {
      expect(n.date.getHours()).toBe(7)
      expect(n.date.getMinutes()).toBe(30)
      expect(n.date.getTime()).toBeGreaterThan(now.getTime())
    })
  })
})

describe('nextPersonalisationMilestone', () => {
  it('gives a brand-new user a countable next step, not a low percentage', () => {
    const m = nextPersonalisationMilestone()
    expect(m.remaining).toBe(3)
    expect(m.text).toMatch(/3 more check-ins/)
  })

  it('counts down as she logs', () => {
    expect(nextPersonalisationMilestone({ meaningfulLogDays: 2 }).remaining).toBe(1)
    expect(nextPersonalisationMilestone({ meaningfulLogDays: 2 }).text).toMatch(/1 more check-in\b/)
  })

  it('rewards continued observation once enough meaningful logs exist', () => {
    const m = nextPersonalisationMilestone({ meaningfulLogDays: 5, signalDomains: 3, spanDays: 5 })
    expect(m.text).toMatch(/continued check-ins/i)
  })

  it('asks for cycle anchors only after there is broad, longitudinal day-level data', () => {
    const m = nextPersonalisationMilestone({ meaningfulLogDays: 90, signalDomains: 5, spanDays: 90, cyclesTracked: 1 })
    expect(m.text).toMatch(/two cycles/i)
  })

  it('stops asking for more once guidance has broad repeated evidence', () => {
    const m = nextPersonalisationMilestone({ meaningfulLogDays: 90, signalDomains: 5, spanDays: 90, cyclesTracked: 2, hasRepeatedPattern: true })
    expect(m.remaining).toBe(0)
    expect(m.text).toMatch(/broad, repeated observations/i)
  })
})
