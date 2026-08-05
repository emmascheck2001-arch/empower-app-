import { describe, it, expect } from 'vitest'
import { buildCyclePlan, weekBlocks, assignSessions } from './cyclePlan'

describe('buildCyclePlan', () => {
  it('returns null without a confident cycle', () => {
    expect(buildCyclePlan(null, 28)).toBe(null)
    expect(buildCyclePlan(5, null)).toBe(null)
    expect(buildCyclePlan(0, 28)).toBe(null)
  })
  it('builds the requested number of days, rolling forward from today', () => {
    const plan = buildCyclePlan(1, 28, 7, 5)
    expect(plan).toHaveLength(7)
    expect(plan[0].cycleDay).toBe(1)
    expect(plan[0].phase).toBe('Menstrual')
    expect(plan[6].cycleDay).toBe(7)
  })
  it('wraps past the cycle length into the next cycle', () => {
    const plan = buildCyclePlan(27, 28, 7, 5)
    expect(plan[0].cycleDay).toBe(27)
    expect(plan[2].cycleDay).toBe(1) // day 27, 28, then 1
    expect(plan[2].phase).toBe('Menstrual')
  })
})

describe('assignSessions', () => {
  it('varies sessions across consecutive same-phase days (not repetitive)', () => {
    // start mid-follicular so several "high" days run together
    const sched = assignSessions(buildCyclePlan(8, 28, 7, 5), 'strength')
    expect(sched).toHaveLength(7)
    const titles = sched.map(d => d.title)
    // the follicular run should NOT be the same title repeated
    expect(new Set(titles).size).toBeGreaterThan(2)
  })
  it('includes rest days (2 by default, 1 for consistency goal)', () => {
    const std = assignSessions(buildCyclePlan(1, 28, 7, 5), 'strength')
    expect(std.filter(d => d.title === 'Rest day').length).toBe(2)
    const consistency = assignSessions(buildCyclePlan(1, 28, 7, 5), 'consistency')
    expect(consistency.filter(d => d.title === 'Rest day').length).toBe(1)
  })
  it('is null-safe', () => {
    expect(assignSessions(null, 'strength')).toBe(null)
  })
})

describe('weekBlocks', () => {
  it('groups a 28-day plan into 4 weeks', () => {
    const blocks = weekBlocks(buildCyclePlan(1, 28, 28, 5))
    expect(blocks).toHaveLength(4)
    expect(blocks[0].week).toBe(1)
  })
  it('is null-safe', () => {
    expect(weekBlocks(null)).toBe(null)
  })
})
