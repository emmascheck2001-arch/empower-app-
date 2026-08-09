import { describe, it, expect } from 'vitest'
import { buildDailyCoach } from './dailyCoach.js'

const base = (over = {}) => ({
  phase: 'Follicular', subPhase: null, intensityModifier: 1.0,
  nutritionTargets: { proteinRangeG: [80, 100], proteinRangePerKg: [1.2, 1.6] },
  recentLogs: [{}], ...over,
})

describe('buildDailyCoach', () => {
  it('returns null with no status', () => {
    expect(buildDailyCoach(null, 9, 'Emma')).toBeNull()
  })

  it('greets by time of day and includes the name', () => {
    expect(buildDailyCoach(base(), 8, 'Emma').greeting).toBe('Good morning, Emma')
    expect(buildDailyCoach(base(), 14, 'Emma').greeting).toBe('Good afternoon, Emma')
    expect(buildDailyCoach(base(), 21, 'Emma').greeting).toBe('Good evening, Emma')
    expect(buildDailyCoach(base(), 9, null).greeting).toBe('Good morning')
  })

  it('always returns all coach sections', () => {
    const c = buildDailyCoach(base(), 9, 'Emma')
    expect(c.focus.label).toBeTruthy()
    expect(c.training).toBeTruthy()
    expect(Array.isArray(c.nutrition)).toBe(true)
    expect(c.sleep).toBeTruthy()
    expect(c.mindset).toBeTruthy()
  })

  it('uses a profile-derived protein range without inventing calories', () => {
    const c = buildDailyCoach(base({ nutritionTargets: { proteinRangeG: [110, 130] } }), 9, 'Emma')
    expect(c.nutrition.join(' ')).toMatch(/110 to 130g/)
    expect(c.nutrition.join(' ')).not.toMatch(/extra calories|calorie target/i)
  })

  it('adds an iron line only while menstruating', () => {
    const m = buildDailyCoach(base({ phase: 'Menstrual', intensityModifier: 0.7 }), 9, 'Emma')
    expect(m.nutrition.join(' ')).toMatch(/iron-rich/)
    const f = buildDailyCoach(base(), 9, 'Emma')
    expect(f.nutrition.join(' ')).not.toMatch(/iron-rich/)
  })

  it('does not scale training from a phase multiplier', () => {
    const high = buildDailyCoach(base({ intensityModifier: 1.05 }), 9).training
    const low = buildDailyCoach(base({ intensityModifier: 0.72 }), 9).training
    expect(high).toBe(low)
    expect(high).toMatch(/warm-up|planned session/i)
  })

  it('NEVER prescribes a workout in pregnancy', () => {
    const p = buildDailyCoach(base({ phase: 'Pregnancy', intensityModifier: 0.6, nutritionTargets: { proteinG: 80, extraCalories: 340 } }), 9, 'Sam')
    expect(p.training).toMatch(/provider/i)
    expect(p.training).toMatch(/do not prescribe/i)
  })

  it('surfaces a recovery caution ONLY when the user\'s own logs support it', () => {
    const today = new Date(); const ds = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    expect(buildDailyCoach(base({ recentLogs: [{ log_date:ds, sleep_quality: 'Poor' }] }), 9).recoveryNote).toMatch(/recovery may be lower/i)
    expect(buildDailyCoach(base({ recentLogs: [{ log_date:ds, energy: 'Very low' }] }), 9).recoveryNote).toMatch(/recovery may be lower/i)
    expect(buildDailyCoach(base({ recentLogs: [{ log_date:ds, energy: 'High', sleep_quality: 'Good' }] }), 9).recoveryNote).toBeNull()
  })

  it('acknowledges a poor night in the sleep line', () => {
    const c = buildDailyCoach(base({ recentLogs: [{ sleep_quality: 'Poor' }] }), 9)
    expect(c.sleep).toMatch(/poor sleep last night/i)
  })

  it('does not throw on a sparse status object', () => {
    expect(() => buildDailyCoach({ phase: 'observation' }, 9)).not.toThrow()
    const c = buildDailyCoach({ phase: 'observation' }, 9)
    expect(c.focus.label).toBe('Tune in')
  })
})
