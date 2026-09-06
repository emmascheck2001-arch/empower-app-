import { describe, it, expect } from 'vitest'
import { phaseForCard, visiblePhaseForCard } from './friendCard'

// A card anchored `n` days ago, as get_friend_card actually returns it (no `phase` field).
const card = (n, extra = {}) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n)
  return {
    name: 'A friend', cycle_length: 28, user_path: '1', show_phase: true,
    last_period_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    ...extra,
  }
}

describe('friendCard', () => {
  it('computes a phase from the anchor — the RPC never returns one', () => {
    expect(card(1).phase).toBeUndefined()          // the bug this module exists to prevent
    expect(phaseForCard(card(1))).toBe('Menstrual')
    expect(phaseForCard(card(13))).toBe('Ovulatory')
  })

  it('PRIVACY: returns nothing when the friend has turned phase sharing off', () => {
    expect(visiblePhaseForCard(card(1, { show_phase: false }))).toBe(null)
    expect(visiblePhaseForCard(card(1, { show_phase: true }))).toBe('Menstrual')
  })

  it('says nothing rather than guessing from a stale anchor', () => {
    expect(phaseForCard(card(200))).toBe(null)
    expect(phaseForCard(card(43))).toBe(null)      // past cycle length + 14
  })

  it('never invents a phase without the data to place one', () => {
    expect(phaseForCard({ name: 'x' })).toBe(null)
    expect(phaseForCard(card(5, { cycle_length: null }))).toBe(null)
    expect(visiblePhaseForCard(null)).toBe(null)
  })

  it('perimenopause friends are labelled, not forced into a cycle phase', () => {
    expect(phaseForCard(card(5, { user_path: '4' }))).toBe('Perimenopause')
  })
})
