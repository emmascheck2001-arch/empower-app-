import { describe, it, expect } from 'vitest'
import { getLatePeriodInsights } from './hormoneSync'

describe('getLatePeriodInsights', () => {
  it('returns empty for clean logs and no risk factors', () => {
    const logs = [{ energy: 'Normal', sleep_quality: 'Good', disruptors: ['None of these'] }]
    expect(getLatePeriodInsights(logs, { user_path: '1' }, { gaps: [28, 29] })).toEqual([])
  })

  it('flags high stress from disruptors or stress_level', () => {
    const a = getLatePeriodInsights([{ disruptors: ['High stress'] }], {}, {})
    expect(a.some(t => /stress/i.test(t))).toBe(true)
    const b = getLatePeriodInsights([{ stress_level: 5 }], {}, {})
    expect(b.some(t => /stress/i.test(t))).toBe(true)
  })

  it('flags illness and travel', () => {
    const out = getLatePeriodInsights([{ disruptors: ['Illness', 'Travel'] }], {}, {})
    expect(out.some(t => /unwell|illness/i.test(t))).toBe(true)
    expect(out.some(t => /travel/i.test(t))).toBe(true)
  })

  it('flags repeated poor sleep', () => {
    const logs = [{ sleep_quality: 'Poor' }, { sleep_quality: 'Poor' }, { sleep_quality: 'Poor' }]
    expect(getLatePeriodInsights(logs, {}, {}).some(t => /sleep/i.test(t))).toBe(true)
  })

  it('flags under-fuelling / heavy training from repeated very low energy', () => {
    const logs = [{ energy: 'Very low' }, { energy: 'Very low' }, { energy: 'Very low' }]
    expect(getLatePeriodInsights(logs, {}, {}).some(t => /energy|training|RED-S/i.test(t))).toBe(true)
  })

  it('always notes coming off birth control for path 2', () => {
    expect(getLatePeriodInsights([], { user_path: '2' }, {}).some(t => /birth control/i.test(t))).toBe(true)
  })

  it('notes personal cycle variability when tracked gaps differ by a week+', () => {
    expect(getLatePeriodInsights([], {}, { gaps: [26, 40] }).some(t => /varied|variation/i.test(t))).toBe(true)
  })

  it('is safe with null/empty input', () => {
    expect(getLatePeriodInsights(null, null, null)).toEqual([])
  })
})
