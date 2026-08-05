import { describe, it, expect } from 'vitest'
import { getMovementToday, MOVEMENT_TODAY } from './movementToday'

describe('getMovementToday', () => {
  it('prefers subphase over phase', () => {
    expect(getMovementToday('Luteal', 'Mid luteal')).toBe(MOVEMENT_TODAY['Mid luteal'])
  })
  it('falls back to phase when no subphase', () => {
    expect(getMovementToday('Menstrual')).toBe(MOVEMENT_TODAY.Menstrual)
  })
  it('falls back to observation for unknown', () => {
    expect(getMovementToday('nonsense', 'nonsense')).toBe(MOVEMENT_TODAY.observation)
    expect(getMovementToday(null, null)).toBe(MOVEMENT_TODAY.observation)
  })
  it('every entry has a concrete title and detail (no bare percentages)', () => {
    for (const v of Object.values(MOVEMENT_TODAY)) {
      expect(v.title.length).toBeGreaterThan(3)
      expect(v.detail.length).toBeGreaterThan(20)
      expect(v.title).not.toMatch(/%/)
    }
  })
})
