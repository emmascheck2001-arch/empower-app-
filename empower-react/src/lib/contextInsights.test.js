import { describe, it, expect } from 'vitest'
import { tagInsights, tagByPhase, MIN_TAGGED, SUGGESTED_TAGS } from './contextInsights'

const day = (energy, tags = [], phase = 'Luteal') => ({ log_date: '2026-01-01', energy, context_tags: tags, phase })

describe('tagInsights', () => {
  it('stays silent below the minimum number of tagged days', () => {
    const logs = [day('Low', ['Deadline']), day('Low', ['Deadline']), day('High'), day('High'), day('High')]
    expect(tagInsights(logs)).toHaveLength(0)
  })

  it('stays silent without enough comparison days', () => {
    const logs = [...Array(4)].map(() => day('Low', ['Deadline'])).concat([day('High')])
    expect(tagInsights(logs)).toHaveLength(0)
  })

  it('stays silent when the difference is too small to mean anything', () => {
    const logs = [...Array(4)].map(() => day('Normal', ['Deadline']))
      .concat([...Array(4)].map(() => day('Normal')))
    expect(tagInsights(logs)).toHaveLength(0)
  })

  it('reports a real difference, phrased as an association and never a cause', () => {
    const logs = [...Array(4)].map(() => day('Very low', ['Taught 2+ classes']))
      .concat([...Array(4)].map(() => day('High')))
    const [i] = tagInsights(logs)
    expect(i.tag).toBe('Taught 2+ classes')
    expect(i.n).toBeGreaterThanOrEqual(MIN_TAGGED)
    expect(i.line).toMatch(/not a cause/i)
    expect(i.line).not.toMatch(/because|causes|due to/i)
  })

  it('orders by the size of the difference', () => {
    const logs = [
      ...[...Array(4)].map(() => day('Very low', ['Deadline'])),
      ...[...Array(4)].map(() => day('Normal', ['Social'])),
      ...[...Array(6)].map(() => day('High')),
    ]
    const out = tagInsights(logs)
    expect(Math.abs(out[0].diff)).toBeGreaterThanOrEqual(Math.abs(out[out.length - 1].diff))
  })

  it('ignores logs with no tags array at all', () => {
    expect(() => tagInsights([{ energy: 'Low' }, null, undefined])).not.toThrow()
    expect(tagInsights([{ energy: 'Low' }])).toHaveLength(0)
  })
})

describe('tagByPhase', () => {
  it('needs the same tag in two phases before comparing', () => {
    const logs = [...Array(4)].map(() => day('Low', ['Taught a class'], 'Luteal'))
    expect(tagByPhase(logs, l => l.phase)).toHaveLength(0)
  })

  it('answers the question only this app can: the same day in two different phases', () => {
    const logs = [
      ...[...Array(3)].map(() => day('High', ['Taught a class'], 'Follicular')),
      ...[...Array(3)].map(() => day('Very low', ['Taught a class'], 'Luteal')),
    ]
    const [r] = tagByPhase(logs, l => l.phase)
    expect(r.best.phase).toBe('Follicular')
    expect(r.worst.phase).toBe('Luteal')
    expect(r.line).toMatch(/going on the energy you logged/)
  })

  it('stays quiet when both phases feel the same', () => {
    const logs = [
      ...[...Array(3)].map(() => day('Normal', ['Travel'], 'Follicular')),
      ...[...Array(3)].map(() => day('Normal', ['Travel'], 'Luteal')),
    ]
    expect(tagByPhase(logs, l => l.phase)).toHaveLength(0)
  })

  it('ships a starter tag set about life, not symptoms', () => {
    expect(SUGGESTED_TAGS.length).toBeGreaterThan(5)
    expect(SUGGESTED_TAGS.some(t => /class/i.test(t))).toBe(true)
  })
})
