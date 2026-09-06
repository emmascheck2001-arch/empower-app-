import { describe, it, expect } from 'vitest'
import { answerQuestion, buildTopics } from './askEngine'

// AUDIT REGRESSION TEST.
// The only unresolved piece of user feedback in the database is an Ask question the engine
// could not answer at the time: "Why do I need higher protein todsy" (sic, 2026-06-30). The
// protein topic has since been added; this locks it in, including the typo'd and reworded
// forms a real person actually types, so it can never silently regress.
const topics = buildTopics()
const ctx = {
  status: { phase: 'Luteal', subPhase: 'Mid luteal', nutritionTargets: { proteinG: 130, keyFoods: ['Salmon'] } },
  cycle: null, logs: [], recentLogs: [],
}

describe('Ask engine — protein "why" coverage (from real user feedback)', () => {
  const variants = [
    'Why do I need higher protein todsy',   // the exact question that went unanswered
    'why do i need more protein',
    'why so much protein',
    'how much protein should I eat',
    'whats my protein target',
  ]
  for (const q of variants) {
    it(`answers: "${q}"`, () => {
      const a = answerQuestion(q, ctx, topics)
      expect(a.kind).toBe('answer')
      expect(a.text).toMatch(/protein/i)
    })
  }

  it('gives the REASON, not just the number — that is what she actually asked', () => {
    const a = answerQuestion('Why do I need higher protein todsy', ctx, topics)
    expect(a.text).toMatch(/progesterone/i)
    expect(a.text).toMatch(/ISSN 2023/)
  })

  it('still routes a red flag to care before answering anything about food', () => {
    const a = answerQuestion('I am bleeding through a pad every hour and need protein advice', ctx, topics)
    expect(a.kind).toBe('redflag')
  })
})
