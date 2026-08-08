import { describe, expect, it } from 'vitest'
import { answerQuestion, buildTopics, TRAIN_BY_PHASE } from './askEngine.js'

const baseContext = {
  status: { phase:'Follicular', subPhase:'Late follicular', cycleDay:12, cycleLen:29, phaseEvidence:{ label:'Calendar estimate.' } },
  cycle: { cycle_length:29, last_period_date:'2026-07-20', notes:JSON.stringify({ periodStarts:['2026-05-23','2026-06-21','2026-07-20'] }) },
  logs: [],
  streak: 0,
}

describe('Ask safety and uncertainty', () => {
  it('does not turn a negated severe symptom into an emergency answer', () => {
    const result = answerQuestion('I do not have severe pain, can I work out?', baseContext, buildTopics())
    expect(result.kind).not.toBe('redflag')
  })

  it('does not treat the bare word pregnancy as a positive pregnancy concern', () => {
    const result = answerQuestion('What changes in the pregnancy mode?', baseContext, buildTopics())
    expect(result.kind).not.toBe('redflag')
  })

  it('keeps phase training contextual rather than ordering a load change', () => {
    for (const phase of ['Menstrual','Follicular','Ovulatory','Late luteal']) {
      const answer = TRAIN_BY_PHASE(phase)
      expect(answer).toMatch(/estimate|calendar/)
      expect(answer).not.toMatch(/must|avoid high|drop (the )?load|highest performance/i)
    }
  })

  it('requires two completed cycles before reporting a symptom-phase pattern', () => {
    const oneCycle = {
      ...baseContext,
      cycle: { cycle_length:29, last_period_date:'2026-07-20', notes:JSON.stringify({ periodStarts:['2026-06-21','2026-07-20'] }) },
      logs: Array.from({ length:8 }, (_, i) => ({ log_date:`2026-07-${String(20 + i).padStart(2, '0')}`, symptoms:['Cramping'] })),
    }
    const result = answerQuestion('What is my cramp pattern?', oneCycle, buildTopics())
    expect(result.text).toMatch(/at least two completed cycles/i)
  })

  it('returns the forecast range and labels it as an estimate', () => {
    const context = {
      ...baseContext,
      status: {
        ...baseContext.status,
        nextPeriodPrediction: {
          predictedDate:new Date('2026-08-18T00:00:00'),
          windowStart:new Date('2026-08-15T00:00:00'),
          windowEnd:new Date('2026-08-22T00:00:00'),
          confidence:'low', irregular:true,
        },
      },
    }
    const result = answerQuestion('When is my next period?', context, buildTopics())
    expect(result.text).toMatch(/window from/i)
    expect(result.text).toMatch(/estimate, not a guarantee/i)
  })
})
