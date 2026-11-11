import { describe, expect, it } from 'vitest'
import { deriveLearnedBaselines } from './hormoneSync.js'

describe('learned cycle signals', () => {
  it('learns ovulation timing, luteal length, and mucus lead from completed cycles', () => {
    const cycleData = {
      last_period_date: '2026-07-30',
      cycle_length: 29,
      notes: JSON.stringify({
        periodStarts: ['2026-05-01', '2026-05-31', '2026-07-01', '2026-07-30'],
      }),
    }

    const historyLogs = [
      { log_date: '2026-05-11', wrist_temp: 36.3 },
      { log_date: '2026-05-12', wrist_temp: 36.3 },
      { log_date: '2026-05-13', wrist_temp: 36.3 },
      { log_date: '2026-05-14', wrist_temp: 36.3 },
      { log_date: '2026-05-15', wrist_temp: 36.3 },
      { log_date: '2026-05-16', wrist_temp: 36.3 },
      { log_date: '2026-05-17', wrist_temp: 36.6 },
      { log_date: '2026-05-18', wrist_temp: 36.6 },
      { log_date: '2026-05-19', wrist_temp: 36.6 },
      { log_date: '2026-06-11', wrist_temp: 36.3 },
      { log_date: '2026-06-12', wrist_temp: 36.3 },
      { log_date: '2026-06-13', wrist_temp: 36.3 },
      { log_date: '2026-06-14', wrist_temp: 36.3 },
      { log_date: '2026-06-15', wrist_temp: 36.3 },
      { log_date: '2026-06-16', wrist_temp: 36.3 },
      { log_date: '2026-06-17', wrist_temp: 36.6 },
      { log_date: '2026-06-18', wrist_temp: 36.6 },
      { log_date: '2026-06-19', wrist_temp: 36.6 },
      { log_date: '2026-07-10', wrist_temp: 36.3 },
      { log_date: '2026-07-11', wrist_temp: 36.3 },
      { log_date: '2026-07-12', wrist_temp: 36.3 },
      { log_date: '2026-07-13', wrist_temp: 36.3 },
      { log_date: '2026-07-14', wrist_temp: 36.3 },
      { log_date: '2026-07-15', wrist_temp: 36.3 },
      { log_date: '2026-07-16', wrist_temp: 36.6 },
      { log_date: '2026-07-17', wrist_temp: 36.6 },
      { log_date: '2026-07-18', wrist_temp: 36.6 },
    ]

    const historyMucusLogs = [
      { log_date: '2026-05-15', discharge_type: 'Egg white' },
      { log_date: '2026-06-16', discharge_type: 'Egg white' },
      { log_date: '2026-07-14', discharge_type: 'Egg white' },
    ]

    const learned = deriveLearnedBaselines(historyLogs, cycleData, historyMucusLogs)
    expect(learned.avgOvulationDay).toBe(16)
    expect(learned.avgLutealLength).toBe(14)
    expect(learned.ovulationVariationDays).toBe(2)
    expect(learned.mucusPeakLeadDays).toBe(1)
    expect(learned.confirmedOvulationCycles).toBe(3)
  })

  it('learns a provisional ovulation pattern from repeat peak-to-dry mucus cycles without temperature data', () => {
    const cycleData = {
      last_period_date: '2026-07-30',
      cycle_length: 30,
      notes: JSON.stringify({
        periodStarts: ['2026-05-01', '2026-05-31', '2026-06-30', '2026-07-30'],
      }),
    }

    const historyLogs = [
      { log_date: '2026-05-10' },
      { log_date: '2026-06-10' },
      { log_date: '2026-07-10' },
    ]

    const historyMucusLogs = [
      { log_date: '2026-05-15', discharge_type: 'Egg white' },
      { log_date: '2026-05-17', discharge_type: 'None or dry' },
      { log_date: '2026-06-15', discharge_type: 'Egg white' },
      { log_date: '2026-06-17', discharge_type: 'Sticky or crumbly' },
      { log_date: '2026-07-14', discharge_type: 'Egg white' },
      { log_date: '2026-07-15', discharge_type: 'None or dry' },
    ]

    const learned = deriveLearnedBaselines(historyLogs, cycleData, historyMucusLogs)
    expect(learned.avgPeakMucusDay).toBe(15)
    expect(learned.avgOvulationDay).toBe(16)
    expect(learned.avgLutealLength).toBe(14)
    expect(learned.confirmedOvulationCycles).toBe(0)
    expect(learned.mucusInferredOvulationCycles).toBe(3)
  })
})
