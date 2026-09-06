import { describe, it, expect } from 'vitest'
import { greeting, logPrompt, loggedLine, phaseFraming, pick, seedFrom, POOLS } from './copyPool'

describe('copyPool', () => {
  it('is deterministic for the same day (no flicker on re-render)', () => {
    expect(logPrompt('2026-09-06')).toBe(logPrompt('2026-09-06'))
    expect(loggedLine('2026-09-06')).toBe(loggedLine('2026-09-06'))
    expect(POOLS.LOGGED_LINES).toContain(loggedLine('2026-09-06'))
    expect(greeting('Emma', 9, '2026-09-06')).toBe(greeting('Emma', 9, '2026-09-06'))
  })

  it('actually varies across days', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => logPrompt(`2026-09-${String(i + 1).padStart(2, '0')}`)))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('greets by time of day and uses her name when known', () => {
    expect(greeting('Emma', 8, 'x')).toContain('Emma')
    expect(greeting(null, 8, 'x')).not.toContain('undefined')
    expect(greeting('Emma', 20, 'x').toLowerCase()).toMatch(/evening|hi/)
  })

  it('every pool is non-empty and has no duplicate lines', () => {
    const pools = [POOLS.LOG_PROMPTS, POOLS.LOGGED_LINES,
      ...Object.values(POOLS.GREETINGS), ...Object.values(POOLS.PHASE_FRAMINGS)]
    for (const p of pools) {
      expect(p.length).toBeGreaterThan(1)
      expect(new Set(p).size).toBe(p.length)
    }
  })

  it('no pool line contains a number, a claim or a recommendation (variation is cosmetic only)', () => {
    const pools = [POOLS.LOG_PROMPTS, POOLS.LOGGED_LINES,
      ...Object.values(POOLS.GREETINGS), ...Object.values(POOLS.PHASE_FRAMINGS)]
    for (const p of pools) for (const line of p) {
      expect(line).not.toMatch(/\d+\s?(%|mg|g\b|day)/)
      expect(line.toLowerCase()).not.toMatch(/you should|women often|most women|studies show/)
    }
  })

  it('phaseFraming covers every phase and returns null for an unknown one', () => {
    for (const p of ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal']) expect(phaseFraming(p, 'x')).toBeTruthy()
    expect(phaseFraming('observation', 'x')).toBe(null)
  })

  it('pick and seedFrom handle empty input', () => {
    expect(pick([], 'x')).toBe(null)
    expect(pick(null, 'x')).toBe(null)
    expect(seedFrom('')).toBe(2166136261)
  })
})
