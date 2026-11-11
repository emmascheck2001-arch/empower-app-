import { describe, it, expect } from 'vitest'
import { getProgressionTarget, exerciseHistoryEntry } from './progression'

describe('strength progression', () => {
  it('does not invent an initial weight or a fixed increase', () => {
    expect(getProgressionTarget({ lastWeight: null })).toBeNull()
    const r = getProgressionTarget({ lastWeight: 4, successfulSessions: 2, lastSessionFeel: 'Felt strong' })
    expect(r.action).toBe('progress')
    expect(r.weight).toBe(4)
    expect(r.reason).toMatch(/smallest available increase/)
  })
  it('holds when the last workout was hard', () => {
    expect(getProgressionTarget({ lastWeight: 40, successfulSessions: 3, lastSessionFeel: 'Felt hard' }).action).toBe('hold-hard')
  })
  it('requires checked and logged sets at the same weight to count progress', () => {
    const ex = { sets: 2, reps: 10 }
    const prior = { last_weight: 10, last_reps:'10', successful_sessions: 1 }
    expect(exerciseHistoryEntry(ex, { 0:10, 1:10 }, { 0:true, 1:true }, prior, 'Felt average').successful_sessions).toBe(2)
    expect(exerciseHistoryEntry(ex, { 0:10 }, { 0:true, 1:true }, prior, 'Felt average').successful_sessions).toBe(0)
    expect(exerciseHistoryEntry(ex, { 0:10, 1:12 }, { 0:true, 1:true }, prior, 'Felt average').successful_sessions).toBe(0)
    expect(exerciseHistoryEntry(ex, { 0:12, 1:12 }, { 0:true, 1:true }, prior, 'Felt strong').successful_sessions).toBe(1)
    expect(exerciseHistoryEntry({ ...ex, reps:12 }, { 0:10, 1:10 }, { 0:true, 1:true }, prior, 'Felt strong').successful_sessions).toBe(1)
    expect(exerciseHistoryEntry(ex, { 0:10 }, {}, prior, 'Felt strong')).toBeNull()
    expect(exerciseHistoryEntry(ex, { 0:10, 1:10 }, { 0:true, 1:true }, prior, 'Skipped')).toBeNull()
  })
})
