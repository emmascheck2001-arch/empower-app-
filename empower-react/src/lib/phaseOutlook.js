// phaseOutlook.js, the "Looking Ahead" engine. Predicts what the user personally tends to
// experience heading into her UPCOMING phase, from HER OWN past cycles, not population
// averages. If there aren't enough past cycles yet, it honestly says how many are needed.
//
// RULES:
//  - Only predict from >= MIN_CYCLES past cycles of data in that phase; otherwise say "needs N".
//  - Describe what SHE logged (energy/symptoms/mood), hedged, never a diagnosis.
// Pure computation only, unit-tested.

const MIN_CYCLES = 2 // past cycles of data needed in a phase before predicting it
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

export function buildPhaseOutlook({ logs = [], lastPeriodDate = null, cycleLen = 28, cycleDay = null } = {}) {
  if (!lastPeriodDate || !cycleDay) return null
  const cl = cycleLen || 28
  const lp = new Date(lastPeriodDate + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const curCycleNum = Math.floor(Math.floor((today - lp) / 86400000) / cl)

  // The phase she moves into over the next few days.
  const futureCd = ((cycleDay + 5 - 1) % cl) + 1
  const upcoming = phaseOf(futureCd, cl)
  const w = WORD[upcoming]

  // Collect her logs that fell in that phase, in PAST cycles.
  const inPhasePast = []
  const cyclesSeen = new Set()
  for (const l of logs) {
    if (!l.log_date) continue
    const diff = Math.floor((new Date(l.log_date + 'T00:00:00') - lp) / 86400000)
    const cycleNum = Math.floor(diff / cl)
    const cd = (((diff % cl) + cl) % cl) + 1
    if (phaseOf(cd, cl) === upcoming && cycleNum < curCycleNum) { inPhasePast.push(l); cyclesSeen.add(cycleNum) }
  }
  const cyclesInPhase = cyclesSeen.size

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

  const adj = upcoming === 'Luteal' ? ' Em~power will ease your training and lift your protein to match.'
    : upcoming === 'Menstrual' ? ' Em~power will keep movement gentle and focus on iron and recovery.'
    : ' Em~power will lean your plan into this stronger window.'

  return {
    status: 'ok', upcoming, cyclesInPhase,
    text: `Heading into your ${w} phase. Across your past ${cyclesInPhase} cycles here, ${parts.join(', ')}.${adj}`,
  }
}
