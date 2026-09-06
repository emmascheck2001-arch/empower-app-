import { describe, it, expect } from 'vitest'
import { buildUnlocks, nextUnlock, newlyUnlocked, THRESHOLDS } from './unlocks'

const energyLogs = n => Array.from({ length: n }, () => ({ energy: 'Normal' }))

describe('buildUnlocks', () => {
  it('counts real progress toward each gated insight', () => {
    const u = buildUnlocks({ logs: energyLogs(5), cyclesTracked: 1, logsThisWeek: 2 })
    const story = u.find(x => x.key === 'monthlyStory')
    expect(story.have).toBe(5)
    expect(story.need).toBe(THRESHOLDS.monthlyStory.energyLogs)
    expect(story.remaining).toBe(3)
    expect(story.unlocked).toBe(false)
  })

  it('marks an item unlocked once the threshold is met and never goes negative', () => {
    const u = buildUnlocks({ logs: energyLogs(40), cyclesTracked: 9, logsThisWeek: 7 })
    expect(u.every(x => x.remaining >= 0)).toBe(true)
    expect(u.find(x => x.key === 'monthlyStory').unlocked).toBe(true)
  })

  it('only counts logs that actually contain an energy value', () => {
    const u = buildUnlocks({ logs: [{ energy: 'Low' }, { notes: 'hi' }, { energy: null }] })
    expect(u.find(x => x.key === 'monthlyStory').have).toBe(1)
  })

  it('orders nearest-first with unlocked items last', () => {
    const u = buildUnlocks({ logs: energyLogs(8), cyclesTracked: 0, logsThisWeek: 2 })
    const firstLocked = u.findIndex(x => !x.unlocked)
    const firstUnlocked = u.findIndex(x => x.unlocked)
    expect(firstLocked).toBeLessThan(firstUnlocked === -1 ? Infinity : firstUnlocked)
  })

  it('scored cycles need three logged periods before the scorecard can exist', () => {
    expect(buildUnlocks({ periodStarts: ['a', 'b'] }).find(x => x.key === 'accuracy').have).toBe(0)
    expect(buildUnlocks({ periodStarts: ['a', 'b', 'c', 'd'] }).find(x => x.key === 'accuracy').have).toBe(2)
  })

  it('nextUnlock names the nearest locked thing in plain language', () => {
    const n = nextUnlock(buildUnlocks({ logs: energyLogs(7), cyclesTracked: 0, logsThisWeek: 3 }))
    expect(n.line).toMatch(/1 more energy log/)
  })

  it('nextUnlock returns null when everything is unlocked', () => {
    expect(nextUnlock(buildUnlocks({ logs: energyLogs(50), cyclesTracked: 10, logsThisWeek: 7,
      periodStarts: ['a','b','c','d','e'] }))).toBe(null)
  })

  it('newlyUnlocked spots what just turned on and nothing else', () => {
    const before = buildUnlocks({ logs: energyLogs(7), cyclesTracked: 0, logsThisWeek: 0 })
    const after = buildUnlocks({ logs: energyLogs(8), cyclesTracked: 0, logsThisWeek: 0 })
    expect(newlyUnlocked(before, after)).toContain('Your cycle story')
    expect(newlyUnlocked(before, before)).toHaveLength(0)
  })

  it('a missed day never resets progress (no streak shaming)', () => {
    const a = buildUnlocks({ logs: energyLogs(6), logsThisWeek: 0 })
    expect(a.find(x => x.key === 'monthlyStory').have).toBe(6)
  })

  it('survives empty input', () => {
    expect(() => buildUnlocks()).not.toThrow()
    expect(buildUnlocks().every(x => x.have === 0)).toBe(true)
  })
})
