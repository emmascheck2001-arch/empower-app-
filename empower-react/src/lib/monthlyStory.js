// monthlyStory.js, the "Monthly Coach". Turns a cycle's worth of logged energy (and mood)
// into a short plain-language story + a forward-looking suggestion, e.g. "your energy is
// strongest around ovulation, lowest before your period, plan demanding work accordingly."
//
// HONESTY RULES (never loosen):
//  1. Only describe a trend when there are >= MIN_PER_PHASE logs in each phase compared, AND
//     the difference is meaningful (>= MIN_SPREAD on the 1 to 4 energy scale). Otherwise stay quiet.
//  2. Always describe HER OWN logged data, hedged ("has tended to"), never causal, never a
//     diagnosis, never a population claim.
//  3. Not enough data yet -> status 'insufficient', say nothing.
// Pure computation only (no supabase) so it is unit-tested.

const MIN_PER_PHASE = 2       // logs needed in a phase before its average is trusted
const MIN_SPREAD = 0.6        // energy-score gap (1 to 4 scale) needed to call it a real difference
const MIN_ENERGY_LOGS = 8     // total energy logs needed before we say anything
const RECENT_DAYS = 45        // look back about a cycle and a half

const ENERGY = { 'Very low': 1, 'Low': 2, 'Normal': 3, 'Good': 3, 'High': 4 }
const NEG_MOODS = ['Irritable', 'Anxious', 'Low mood', 'Sad', 'Overwhelmed']

function ovulationDay(cl) { return Math.max(8, Math.round((cl || 28) - 14)) }
function phaseKey(cd, cl) {
  const ov = ovulationDay(cl)
  if (cd <= 5) return 'menstrual'
  if (cd <= ov - 2) return 'follicular'
  if (cd <= ov + 1) return 'ovulatory'
  if (cd >= (cl || 28) - 2) return 'late_luteal'
  return 'luteal'
}
const PHRASE = {
  menstrual: 'during your period',
  follicular: 'in the week or so after your period',
  ovulatory: 'around ovulation',
  luteal: 'in the second half of your cycle',
  late_luteal: 'in the days before your period',
}

export function buildMonthlyStory({ logs = [], cycleData = null } = {}) {
  const lp = cycleData?.last_period_date
  const cl = cycleData?.cycle_length || 28
  if (!lp) return { status: 'no_cycle', story: [], suggestion: null }

  const lpDate = new Date(lp + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const byPhase = {} // key -> { energy: [scores], neg: count, total: count }
  let energyLogs = 0
  for (const l of logs) {
    if (!l.log_date) continue
    const ld = new Date(l.log_date + 'T00:00:00')
    const ageDays = Math.floor((now - ld) / 86400000)
    if (ageDays < 0 || ageDays > RECENT_DAYS) continue
    const diff = Math.floor((ld - lpDate) / 86400000)
    const cd = (((diff % cl) + cl) % cl) + 1
    const key = phaseKey(cd, cl)
    const b = byPhase[key] || (byPhase[key] = { energy: [], neg: 0, total: 0 })
    b.total++
    if (ENERGY[l.energy] != null) { b.energy.push(ENERGY[l.energy]); energyLogs++ }
    if (Array.isArray(l.mood) && l.mood.some(m => NEG_MOODS.includes(m))) b.neg++
  }

  if (energyLogs < MIN_ENERGY_LOGS) {
    return {
      status: 'insufficient', story: [], suggestion: null,
      summary: 'Log your energy for a few more weeks and a picture of how it moves across your cycle will appear here.',
    }
  }

  // Average energy per phase (only phases with enough logs).
  const avgs = Object.entries(byPhase)
    .filter(([, b]) => b.energy.length >= MIN_PER_PHASE)
    .map(([key, b]) => ({ key, avg: b.energy.reduce((a, x) => a + x, 0) / b.energy.length, negRate: b.total ? b.neg / b.total : 0, total: b.total }))
  if (avgs.length < 2) {
    return { status: 'insufficient', story: [], suggestion: null, summary: 'A bit more logging across the different parts of your cycle and your energy story will appear here.' }
  }

  avgs.sort((a, b) => b.avg - a.avg)
  const high = avgs[0], low = avgs[avgs.length - 1]
  if (high.avg - low.avg < MIN_SPREAD) {
    // Energy has been fairly even, that is itself a (gentle, honest) story.
    return { status: 'even', story: ['Across your recent logs your energy has stayed fairly steady across your cycle, without a strong high or low phase yet.'], suggestion: null }
  }

  const story = [`Across your recent logs, your energy has tended to be strongest ${PHRASE[high.key]} and lowest ${PHRASE[low.key]}.`]
  // Mood colour, only if a phase clearly stands out.
  const moodLow = [...avgs].sort((a, b) => b.negRate - a.negRate)[0]
  if (moodLow && moodLow.negRate >= 0.5 && moodLow.total >= MIN_PER_PHASE) {
    story.push(`Your mood has also tended to dip ${PHRASE[moodLow.key]}.`)
  }
  const suggestion = `Plan your most demanding work and hardest training for when your energy is highest, ${PHRASE[high.key]}, and build in more recovery ${PHRASE[low.key]}. This is a pattern in your own data, not a rule.`

  return { status: 'ok', story, suggestion, high: high.key, low: low.key }
}
