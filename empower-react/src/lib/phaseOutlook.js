// phaseOutlook.js, the "Looking Ahead" engine. Predicts what the user personally tends to
// experience heading into her UPCOMING phase, from HER OWN past cycles, not population
// averages. If there aren't enough past cycles yet, it honestly says how many are needed.
//
// RULES:
//  - Only predict from >= MIN_CYCLES past cycles of data in that phase; otherwise say "needs N".
//  - Describe what SHE logged (energy/symptoms/mood), hedged, never a diagnosis.
// Pure computation only, unit-tested.
import { cycleInfoForDate } from './cycleHistory.js'

const MIN_CYCLES = 3
const MIN_LOGS_PER_CYCLE = 2
const ENERGY = { 'Very low':1, 'Low':2, 'Normal':3, 'Good':3, 'High':4 }

function ovulationDay(cl) { return Math.max(8, Math.round((cl || 28) - 14)) }
function phaseOf(cd, cl) {
  const ov = ovulationDay(cl)
  if (cd <= 5) return 'Menstrual'
  if (cd <= ov - 2) return 'Follicular'
  if (cd <= ov + 1) return 'Ovulatory'
  return 'Luteal'
}
const WORD = { Menstrual:'menstrual', Follicular:'follicular', Ovulatory:'ovulatory', Luteal:'luteal' }

export function buildPhaseOutlook({ logs = [], lastPeriodDate = null, periodStarts = [], cycleLen = 28, cycleDay = null } = {}) {
  if (!lastPeriodDate || !cycleDay) return null
  const cl = cycleLen || 28
  const anchors = [...new Set([...(periodStarts || []), lastPeriodDate].filter(Boolean))].sort()

  // The phase she moves into over the next few days.
  const futureCd = ((cycleDay + 5 - 1) % cl) + 1
  const upcoming = phaseOf(futureCd, cl)
  const w = WORD[upcoming]

  // Collect her logs that fell in that phase, in PAST cycles.
  const byCycle = new Map()
  for (const l of logs) {
    if (!l.log_date) continue
    const info = cycleInfoForDate(l.log_date, anchors, cl)
    if (!info || info.anchor === lastPeriodDate) continue
    if (phaseOf(info.cycleDay, info.cycleLength) === upcoming) {
      const bucket = byCycle.get(info.anchor) || []
      bucket.push(l)
      byCycle.set(info.anchor, bucket)
    }
  }
  const qualifying = [...byCycle.entries()].filter(([, entries]) => entries.length >= MIN_LOGS_PER_CYCLE)
  const cyclesInPhase = qualifying.length
  const inPhasePast = qualifying.flatMap(([, entries]) => entries)

  if (cyclesInPhase < MIN_CYCLES) {
    const need = MIN_CYCLES - cyclesInPhase
    return {
      status: 'needs_more', upcoming, cyclesInPhase,
      text: `You're heading toward your ${w} phase. This needs about ${MIN_CYCLES} tracked cycles before Em~power can tell you what YOU personally tend to feel there, you have ${cyclesInPhase}, so ${need} more ${need === 1 ? 'cycle' : 'cycles'} of logging and it unlocks.`,
    }
  }

  // Enough history, summarise her own past experience in that phase.
  const eScores = inPhasePast.map(l => ENERGY[l.energy]).filter(Boolean)
  const avgE = eScores.length ? eScores.reduce((a,b)=>a+b,0)/eScores.length : null
  const symTally = {}
  inPhasePast.forEach(l => (l.symptoms || []).forEach(s => { if (s && s !== 'None') symTally[s] = (symTally[s] || 0) + 1 }))
  const topSym = Object.entries(symTally).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x => x[0].toLowerCase())
  const moodTally = {}
  inPhasePast.forEach(l => (l.mood || []).forEach(m => { moodTally[m] = (moodTally[m] || 0) + 1 }))
  const topMood = Object.entries(moodTally).sort((a,b)=>b[1]-a[1])[0]?.[0]

  const parts = []
  if (avgE != null) parts.push(avgE >= 2.7 ? 'your energy has usually held up' : 'your energy has often dipped')
  if (topSym.length) parts.push(`you tend to log ${topSym.join(' and ')}`)
  if (topMood) parts.push(`your mood often leans ${topMood.toLowerCase()}`)

  const adj = ' Empower will show planned, lighter and recovery options so you can combine this pattern with how you actually feel that day.'

  return {
    status: 'ok', upcoming, cyclesInPhase,
    text: `Heading into your ${w} phase. Across your past ${cyclesInPhase} cycles here, ${parts.join(', ')}.${adj}`,
  }
}
