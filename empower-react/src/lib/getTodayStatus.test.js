import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTodayStatus } from './hormoneSync.js'

function queryResult(data, error = null) {
  return { data, error }
}

function makeQuery(result) {
  const promise = Promise.resolve(result)
  return {
    select() { return this },
    eq() { return this },
    gte() { return this },
    order() { return this },
    limit() { return this },
    maybeSingle() { return promise },
    then(resolve, reject) { return promise.then(resolve, reject) },
  }
}

function makeSupabase(resultsByTable, upserts) {
  return {
    from(table) {
      if (!(table in resultsByTable)) throw new Error(`Unexpected table: ${table}`)
      return {
        ...makeQuery(resultsByTable[table]),
        upsert(row) {
          upserts.push({ table, row })
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }
}

function addTempShiftCycle(logs, startDate) {
  const start = new Date(startDate + 'T00:00:00')
  const add = (offsetDays, wristTemp) => {
    const d = new Date(start)
    d.setDate(d.getDate() + offsetDays)
    logs.push({
      log_date: d.toISOString().slice(0, 10),
      wrist_temp: wristTemp,
    })
  }
  add(10, 36.3)
  add(11, 36.3)
  add(12, 36.3)
  add(13, 36.3)
  add(14, 36.3)
  add(15, 36.3)
  add(16, 36.6)
  add(17, 36.6)
  add(18, 36.6)
}

describe('getTodayStatus', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps calendar estimates available until the end of the personal period window', async () => {
    const makeStatus = async now => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(now))
      const upserts = []
      return getTodayStatus(makeSupabase({
        cycle_data: queryResult({ last_period_date:'2026-08-01', cycle_length:28, notes:JSON.stringify({ periodStarts:['2026-07-04', '2026-08-01'] }) }),
        profiles: queryResult({ id:'user-1', user_path:'1', cycle_length:28 }),
        daily_logs: queryResult([]),
        mucus_logs: queryResult([]),
        user_baselines: queryResult(null),
        cycle_prediction_snapshots: queryResult([]),
      }, upserts), 'user-1')
    }

    // One completed 28-day cycle produces a Sep 2 window end. The old centre-date cutoff
    // marked Aug 30 late and blanked every future calendar phase, despite the window remaining open.
    const withinWindow = await makeStatus('2026-08-30T12:00:00')
    expect(withinWindow.nextPeriodPrediction?.windowEnd.toISOString().slice(0, 10)).toBe('2026-09-02')
    expect(withinWindow.latePeriod).toBe(false)

    const afterWindow = await makeStatus('2026-09-04T12:00:00')
    expect(afterWindow).toMatchObject({ latePeriod:true, daysLate:2 })
  })

  it('keeps an established period forecast when a current body signal suggests later ovulation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00'))

    const cycleData = {
      last_period_date: '2026-08-06',
      cycle_length: 30,
      notes: JSON.stringify({
        periodStarts: ['2026-05-08', '2026-06-07', '2026-07-07', '2026-08-06'],
      }),
    }

    const historyLogs = []
    addTempShiftCycle(historyLogs, '2026-05-08')
    addTempShiftCycle(historyLogs, '2026-06-07')
    addTempShiftCycle(historyLogs, '2026-07-07')

    const recentLogs = [
      { log_date: '2026-08-25', symptoms: [], hormonal_context: 'natural-cycle' },
      { log_date: '2026-08-24', symptoms: [], hormonal_context: 'natural-cycle' },
    ]

    const historyMucusLogs = [
      { log_date: '2026-05-22', discharge_type: 'Egg white' },
      { log_date: '2026-06-21', discharge_type: 'Egg white' },
      { log_date: '2026-07-21', discharge_type: 'Egg white' },
      { log_date: '2026-08-24', discharge_type: 'Egg white' },
      { log_date: '2026-08-25', discharge_type: 'Egg white' },
    ]

    const upserts = []
    const supabase = makeSupabase({
      cycle_data: queryResult(cycleData),
      profiles: queryResult({ id: 'user-1', user_path: '1', cycle_length: 30 }),
      daily_logs: queryResult([...recentLogs, ...historyLogs]),
      mucus_logs: queryResult(historyMucusLogs),
      user_baselines: queryResult(null),
      cycle_prediction_snapshots: queryResult([]),
    }, upserts)

    const status = await getTodayStatus(supabase, 'user-1')

    // The current fertile-window context remains available, but three completed 30-day cycles
    // are enough personal history that it cannot be turned into a 35-day period forecast.
    expect(status.phase).toBe('Ovulatory')
    expect(status.phaseCorrection?.corrected).toBe(true)
    expect(status.phaseCorrection?.timingOverride).toBe(false)
    expect(status.cycleLen).toBe(30)
    expect(status.daysUntilPeriod).toBe(11)
    expect(status.learnedBaselines.avgLutealLength).toBe(14)
    expect(status.learnedBaselines.avgOvulationDay).toBe(16)
    expect(status.learnedBaselines.avgPeakMucusDay).toBe(15)
    expect(status.learnedBaselines.mucusPeakLeadDays).toBe(1)

    expect(upserts).toHaveLength(2)
    const baselineUpsert = upserts.find(upsert => upsert.table === 'user_baselines')
    expect(baselineUpsert?.row).toEqual(expect.objectContaining({
      id: 'user-1',
      avg_cycle_length: 30,
      avg_luteal_length: 14,
      avg_ovulation_day: 16,
      ovulation_variation_days: 0,
      avg_peak_mucus_day: 15,
      mucus_peak_lead_days: 1,
      confirmed_ovulation_cycles: 3,
    }))
    expect(upserts.find(upsert => upsert.table === 'cycle_prediction_snapshots')?.row).toEqual(expect.objectContaining({
      user_id: 'user-1',
      cycle_start_date: '2026-08-06',
    }))
  })

  it('does not turn a 27-day recorded history into a 42-day forecast', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T12:00:00'))

    const cycleData = {
      last_period_date: '2026-09-29',
      cycle_length: 28,
      notes: JSON.stringify({
        // The first long gap remains visible, but the median of the three completed cycles is
        // 27 days: 49, 27, 27. A fresh fertile-fluid entry cannot overwrite that forecast.
        periodStarts: ['2026-06-18', '2026-08-06', '2026-09-02', '2026-09-29'],
      }),
    }
    const mucusLogs = [
      { log_date: '2026-10-26', discharge_type: 'Egg white' },
      { log_date: '2026-10-25', discharge_type: 'Egg white' },
    ]
    const upserts = []
    const supabase = makeSupabase({
      cycle_data: queryResult(cycleData),
      profiles: queryResult({ id: 'user-1', user_path: '1', cycle_length: 28 }),
      daily_logs: queryResult([]),
      mucus_logs: queryResult(mucusLogs),
      user_baselines: queryResult(null),
      cycle_prediction_snapshots: queryResult([]),
    }, upserts)

    const status = await getTodayStatus(supabase, 'user-1')

    expect(status).toMatchObject({
      cyclesTracked: 3,
      avgCycleLength: 27,
      cycleLen: 27,
      daysUntilPeriod: 0,
    })
    expect(status.phaseCorrection).toMatchObject({
      corrected: true,
      timingOverride: false,
      cycleLen: 27,
    })
    expect(status.nextPeriodPrediction?.predictedDate.toISOString().slice(0, 10)).toBe('2026-10-26')
  })
})
