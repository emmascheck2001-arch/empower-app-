import { describe, it, expect } from 'vitest'
import { toNumberOrNull, isValid, sanitize, rangeError } from './validate'

describe('validate — numeric health input guards', () => {
  it('toNumberOrNull parses cleanly and rejects junk', () => {
    expect(toNumberOrNull('72')).toBe(72)
    expect(toNumberOrNull(72)).toBe(72)
    expect(toNumberOrNull('')).toBe(null)
    expect(toNumberOrNull(null)).toBe(null)
    expect(toNumberOrNull('abc')).toBe(null)
    expect(toNumberOrNull(Infinity)).toBe(null)
    expect(toNumberOrNull(NaN)).toBe(null)
  })

  it('sanitize drops out-of-range values to null (never persists bad data)', () => {
    expect(sanitize('body_weight_kg', 65)).toBe(65)
    expect(sanitize('body_weight_kg', -5)).toBe(null)     // negative weight
    expect(sanitize('body_weight_kg', 5000)).toBe(null)   // absurd weight
    expect(sanitize('wrist_temp', 36.5)).toBe(36.5)
    expect(sanitize('wrist_temp', 900)).toBe(null)        // absurd temperature
    expect(sanitize('resting_hr_exact', 300)).toBe(null)
    expect(sanitize('sleep_hours', 26)).toBe(null)
    expect(sanitize('pain_rating', 5)).toBe(5)
    expect(sanitize('pain_rating', 0)).toBe(null)
  })

  it('isValid treats empty as valid (unset) but flags out-of-range', () => {
    expect(isValid('wrist_temp', '')).toBe(true)
    expect(isValid('wrist_temp', 36.5)).toBe(true)
    expect(isValid('wrist_temp', 999)).toBe(false)
  })

  it('rangeError gives a message only when invalid', () => {
    expect(rangeError('body_weight_kg', 65)).toBe(null)
    expect(rangeError('body_weight_kg', -1)).toMatch(/between 25 and 300/)
  })
})
