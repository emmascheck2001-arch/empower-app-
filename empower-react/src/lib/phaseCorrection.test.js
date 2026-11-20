import { describe, expect, it } from 'vitest'
import { applyBodySignalPhaseCorrection } from './hormoneSync.js'

describe('body-signal phase correction', () => {
  it('pulls a calendar mid-luteal label back to ovulatory when fresh egg-white mucus is logged', () => {
    const result = applyBodySignalPhaseCorrection({
      phase: 'Luteal',
      subPhase: 'Mid luteal',
      cycleDay: 20,
      cycleLen: 28,
      daysUntilPeriod: 9,
      confidence: 0.56,
      mucusLogs: [
        { log_date: '2026-08-25', discharge_type: 'Egg white' },
        { log_date: '2026-08-24', discharge_type: 'Egg white' },
      ],
      recentLogs: [],
      today: new Date('2026-08-25T00:00:00'),
    })

    expect(result.corrected).toBe(true)
    expect(result.phase).toBe('Ovulatory')
    expect(result.subPhase).toBeNull()
    expect(result.cycleLen).toBe(35)
    expect(result.daysUntilPeriod).toBe(16)
  })

  it('moves to early luteal only after drying and a sustained temperature rise', () => {
    const result = applyBodySignalPhaseCorrection({
      phase: 'Luteal',
      subPhase: 'Mid luteal',
      cycleDay: 20,
      cycleLen: 28,
      daysUntilPeriod: 9,
      confidence: 0.52,
      mucusLogs: [
        { log_date: '2026-08-25', discharge_type: 'None or dry' },
        { log_date: '2026-08-24', discharge_type: 'Sticky or crumbly' },
        { log_date: '2026-08-23', discharge_type: 'Egg white' },
      ],
      recentLogs: [
        { log_date: '2026-08-25', wrist_temp: 36.8 },
        { log_date: '2026-08-24', wrist_temp: 36.7 },
        { log_date: '2026-08-23', wrist_temp: 36.4 },
        { log_date: '2026-08-22', wrist_temp: 36.4 },
        { log_date: '2026-08-21', wrist_temp: 36.3 },
      ],
      learnedBaselines: {
        avgLutealLength: 11,
      },
      today: new Date('2026-08-25T00:00:00'),
    })

    expect(result.corrected).toBe(true)
    expect(result.phase).toBe('Luteal')
    expect(result.subPhase).toBe('Early luteal')
    expect(result.cycleLen).toBe(30)
    expect(result.daysUntilPeriod).toBe(11)
  })

  it('does not move into early luteal from temperature and a dry day alone', () => {
    const result = applyBodySignalPhaseCorrection({
      phase: 'Luteal',
      subPhase: 'Mid luteal',
      cycleDay: 20,
      cycleLen: 28,
      daysUntilPeriod: 9,
      confidence: 0.52,
      mucusLogs: [
        { log_date: '2026-08-25', discharge_type: 'None or dry' },
      ],
      recentLogs: [
        { log_date: '2026-08-25', wrist_temp: 36.8 },
        { log_date: '2026-08-24', wrist_temp: 36.7 },
        { log_date: '2026-08-23', wrist_temp: 36.4 },
        { log_date: '2026-08-22', wrist_temp: 36.4 },
        { log_date: '2026-08-21', wrist_temp: 36.3 },
      ],
      today: new Date('2026-08-25T00:00:00'),
    })

    expect(result.corrected).toBe(false)
    expect(result.phase).toBe('Luteal')
    expect(result.subPhase).toBe('Mid luteal')
  })

  it('holds the fertile window open for a recent peak pattern until post-ovulation confirmation appears', () => {
    const result = applyBodySignalPhaseCorrection({
      phase: 'Luteal',
      subPhase: 'Mid luteal',
      cycleDay: 21,
      cycleLen: 29,
      daysUntilPeriod: 9,
      confidence: 0.58,
      mucusLogs: [
        { log_date: '2026-08-24', discharge_type: 'Egg white' },
      ],
      recentLogs: [
        { log_date: '2026-08-25', symptoms: [] },
      ],
      learnedBaselines: {
        avgLutealLength: 13,
        avgOvulationDay: 18,
        ovulationVariationDays: 2,
        mucusPeakLeadDays: 2,
      },
      today: new Date('2026-08-25T00:00:00'),
    })

    expect(result.corrected).toBe(true)
    expect(result.phase).toBe('Ovulatory')
    expect(result.source).toBe('cervical_fluid_peak')
    expect(result.fertileLockWindow).toBe(4)
    expect(result.estimatedOvulationDay).toBe(22)
    expect(result.cycleLen).toBe(35)
    expect(result.daysUntilPeriod).toBe(15)
  })

  it('does not replace a period-anchored luteal phase for creamy fluid alone', () => {
    const result = applyBodySignalPhaseCorrection({
      phase: 'Luteal',
      subPhase: 'Mid luteal',
      cycleDay: 24,
      cycleLen: 28,
      daysUntilPeriod: 5,
      confidence: 0.52,
      mucusLogs: [
        { log_date: '2026-11-17', discharge_type: 'Creamy or lotion-like' },
      ],
      recentLogs: [],
      today: new Date('2026-11-19T00:00:00'),
    })

    expect(result.corrected).toBe(false)
    expect(result.phase).toBe('Luteal')
    expect(result.subPhase).toBe('Mid luteal')
  })

  it('uses a recent positive LH test to refine the current fertile-window estimate', () => {
    const result = applyBodySignalPhaseCorrection({
      phase: 'Follicular',
      subPhase: 'Late follicular',
      cycleDay: 12,
      cycleLen: 28,
      daysUntilPeriod: 17,
      confidence: 0.5,
      recentLogs: [{ log_date: '2026-08-25', lh_result: 'Positive' }],
      mucusLogs: [],
      today: new Date('2026-08-25T00:00:00'),
    })

    expect(result).toMatchObject({
      corrected: true,
      phase: 'Ovulatory',
      source: 'positive_lh_test',
      estimatedOvulationDay: 13,
    })
  })
})
