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

  it('normalizes apostrophes and catches broader crisis phrasing', () => {
    const result = answerQuestion('I can’t go on and I want to disappear.', baseContext, buildTopics())
    expect(result.kind).toBe('redflag')
    expect(result.tone).toBe('crisis')
  })

  it('catches hopelessness phrasing even without the original substring list', () => {
    const result = answerQuestion("There's no point anymore. I'm done.", baseContext, buildTopics())
    expect(result.kind).toBe('redflag')
    expect(result.tone).toBe('crisis')
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

  it('answers a headache-history question from the member’s logged cycle history', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']
    const dateAt = (cycle, day) => {
      const date = new Date(`${starts[cycle]}T00:00:00`)
      date.setDate(date.getDate() + day - 1)
      return date.toISOString().slice(0, 10)
    }
    const logs = [
      ...[0, 1, 2].flatMap(cycle => [
        { log_date: dateAt(cycle, 13), symptoms: ['Headache'] },
        { log_date: dateAt(cycle, 14), symptoms: ['Headache'] },
        { log_date: dateAt(cycle, 2), symptoms: [] },
        { log_date: dateAt(cycle, 6), symptoms: [] },
        { log_date: dateAt(cycle, 10), symptoms: [] },
        { log_date: dateAt(cycle, 18), symptoms: [] },
      ]),
    ]
    const context = {
      ...baseContext,
      cycle: { cycle_length: 28, last_period_date: starts[3], notes: JSON.stringify({ periodStarts: starts }) },
      logs,
    }

    const result = answerQuestion('Can you look at my history and tell me the phase I get the most headaches?', context, buildTopics())
    expect(result.kind).toBe('answer')
    expect(result.text).toMatch(/looking at your logged history/i)
    expect(result.text).toMatch(/around ovulation/i)
    expect(result.text).toMatch(/across 3 cycles/i)
    expect(result.text).not.toMatch(/some people notice/i)
    expect(result.link).toEqual({ label:'See your calendar', to:'/calendar?focus=headaches' })
  })

  it('does not present generic guidance as a history answer when history is insufficient', () => {
    const result = answerQuestion('What phase do I get the most headaches?', baseContext, buildTopics())
    expect(result.text).toMatch(/at least two completed cycles/i)
    expect(result.text).not.toMatch(/some people notice/i)
  })

  it('prioritizes a cycle-days headache-history question over the current-cycle-day answer', () => {
    const result = answerQuestion('What cycle days do I log the most headaches?', baseContext, buildTopics())
    expect(result.text).toMatch(/at least two completed cycles/i)
    expect(result.text).not.toMatch(/you are on day/i)
    expect(result.text).not.toMatch(/some people notice/i)
  })

  it('answers a personal sleep-history question from logs instead of generic sleep advice', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']
    const dateAt = (cycle, day) => {
      const date = new Date(`${starts[cycle]}T00:00:00`)
      date.setDate(date.getDate() + day - 1)
      return date.toISOString().slice(0, 10)
    }
    const logs = [
      ...[0, 1, 2].flatMap(cycle => [
        { log_date: dateAt(cycle, 26), symptoms: [], sleep_quality: 'Poor' },
        { log_date: dateAt(cycle, 27), symptoms: [], sleep_quality: 'Fair' },
        { log_date: dateAt(cycle, 2), symptoms: [], sleep_quality: 'Good' },
        { log_date: dateAt(cycle, 6), symptoms: [], sleep_quality: 'Good' },
        { log_date: dateAt(cycle, 10), symptoms: [], sleep_quality: 'Excellent' },
        { log_date: dateAt(cycle, 18), symptoms: [], sleep_quality: 'Good' },
      ]),
    ]
    const context = {
      ...baseContext,
      cycle: { cycle_length: 28, last_period_date: starts[3], notes: JSON.stringify({ periodStarts: starts }) },
      logs,
    }

    const result = answerQuestion('Which phase do I usually sleep poorly in?', context, buildTopics())
    expect(result.text).toMatch(/looking at your logged history/i)
    expect(result.text).toMatch(/before your period/i)
    expect(result.text).not.toMatch(/some people notice sleep changes/i)
  })

  it('routes every logged symptom to its history analysis instead of a generic article', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']
    const logs = [0, 1, 2].flatMap(cycle => [2, 6, 10, 14, 18, 22].map(day => {
      const date = new Date(`${starts[cycle]}T00:00:00`)
      date.setDate(date.getDate() + day - 1)
      return { log_date: date.toISOString().slice(0, 10), symptoms: [] }
    }))
    const context = {
      ...baseContext,
      cycle: { cycle_length: 28, last_period_date: starts[3], notes: JSON.stringify({ periodStarts: starts }) },
      logs,
    }
    const cases = [
      ['What cycle days do I log the most bloating?', 'bloating'],
      ['What cycle days do I log the most cramps?', 'cramps'],
      ['What cycle days do I log the most breast tenderness?', 'breast tenderness'],
      ['What cycle days do I log the most headaches?', 'headaches'],
      ['What cycle days do I log the most migraines?', 'migraines'],
      ['What cycle days do I log the most back pain?', 'back pain'],
      ['What cycle days do I log the most nausea?', 'nausea'],
      ['What cycle days do I log the most diarrhea?', 'diarrhea'],
      ['What cycle days do I log the most constipation?', 'constipation'],
      ['What cycle days do I log the most ovulation pain?', 'ovulation pain'],
      ['What cycle days do I log the most fatigue?', 'low-energy or fatigue days'],
      ['What cycle days do I log the most cravings?', 'cravings'],
      ['What cycle days do I log the most mood swings?', 'mood swings'],
      ['What cycle days do I log the most acne?', 'acne'],
    ]

    for (const [question, label] of cases) {
      const result = answerQuestion(question, context, buildTopics())
      expect(result.text).toMatch(new RegExp(`not logged ${label}`, 'i'))
      expect(result.text).not.toMatch(/some people notice|for bloating|for cramps/i)
    }
  })

  it('uses the direction in sleep, energy, mood, libido, and workout history questions', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']
    const logAt = (cycle, day, fields) => {
      const date = new Date(`${starts[cycle]}T00:00:00`)
      date.setDate(date.getDate() + day - 1)
      return { log_date: date.toISOString().slice(0, 10), symptoms: [], ...fields }
    }
    const logs = [0, 1, 2].flatMap(cycle => [
      logAt(cycle, 13, { energy:'High', sleep_quality:'Good', mood:['Confident'], libido:'High', workout_feel:'Felt strong' }),
      logAt(cycle, 14, { energy:'High', sleep_quality:'Excellent', mood:['Motivated'], libido:'High', workout_feel:'Felt strong' }),
      logAt(cycle, 2, { energy:'Low', sleep_quality:'Poor', mood:['Low mood'], libido:'Low', workout_feel:'Felt hard' }),
      logAt(cycle, 6, { energy:'Normal', sleep_quality:'Good', mood:['Calm'] }),
      logAt(cycle, 18, { energy:'Normal', sleep_quality:'Good', mood:['Focused'] }),
      logAt(cycle, 22, { energy:'Normal', sleep_quality:'Good', mood:['Social'] }),
    ])
    const context = {
      ...baseContext,
      cycle: { cycle_length: 28, last_period_date: starts[3], notes: JSON.stringify({ periodStarts: starts }) },
      logs,
    }
    const cases = [
      ['Which phase is my energy highest?', 'high-energy days'],
      ['Which phase do I sleep best in?', 'good-sleep days'],
      ['Which phase is my mood best?', 'positive mood days'],
      ['Which phase is my sex drive highest?', 'high sex-drive days'],
      ['Which phase are my workouts strongest?', 'strong-workout days'],
    ]

    for (const [question, label] of cases) {
      const result = answerQuestion(question, context, buildTopics())
      expect(result.text).toMatch(new RegExp(label, 'i'))
      expect(result.text).toMatch(/looking at your logged history/i)
    }
  })

  it('keeps current-cycle questions and generic relief questions on their intended routes', () => {
    expect(answerQuestion('What cycle day am I on?', baseContext, buildTopics()).text).toMatch(/you are on day 12/i)
    expect(answerQuestion('What helps with headaches?', baseContext, buildTopics()).text).toMatch(/some people notice headaches/i)
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
