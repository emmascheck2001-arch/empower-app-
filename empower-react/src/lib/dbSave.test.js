import { describe, it, expect } from 'vitest'
import { runSave, friendlySaveMessage } from './dbSave'

describe('dbSave.runSave — normalizes Supabase writes', () => {
  it('returns ok when the write has no error', async () => {
    const res = await runSave(Promise.resolve({ data: [{ id: 1 }], error: null }))
    expect(res.ok).toBe(true)
    expect(res.error).toBe(null)
    expect(res.data).toEqual([{ id: 1 }])
  })

  it('returns not-ok with a friendly message when Supabase returns { error } (does NOT throw)', async () => {
    const res = await runSave(Promise.resolve({ data: null, error: { message: 'permission denied' } }))
    expect(res.ok).toBe(false)
    expect(res.error).toEqual({ message: 'permission denied' })
    expect(typeof res.message).toBe('string')
    expect(res.message.length).toBeGreaterThan(0)
  })

  it('catches a thrown/rejected promise and still resolves not-ok', async () => {
    const res = await runSave(Promise.reject(new Error('network down')))
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/could not reach the server|try again/i)
  })

  it('friendlySaveMessage never leaks raw error detail', () => {
    const msg = friendlySaveMessage({ message: 'PGRST301: JWT expired at row 5' })
    expect(msg).not.toMatch(/PGRST|JWT|row 5/)
  })
})
