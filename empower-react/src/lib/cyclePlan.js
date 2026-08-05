import { getPhase, getLutealSubPhase } from './hormoneSync'

// Build a day-by-day training plan by rolling forward from today's cycle day. Each day gets
// the phase (and luteal subphase) it will fall in, so the UI can map it to a cycle-aware
// movement recommendation. Returns null when there's no confident cycle (irregular / no
// period date / birth control), the UI then shows a goal-based generic week instead of a
// confidently-wrong one. `days` = 7 for weekly, 28 for monthly.
export function buildCyclePlan(cycleDay, cycleLen, days = 7, periodLength) {
  if (!cycleDay || cycleDay < 1 || !cycleLen) return null
  const plan = []
  for (let i = 0; i < days; i++) {
    const cd = ((cycleDay - 1 + i) % cycleLen) + 1
    const phase = getPhase(cd, cycleLen, periodLength)
    const sub = phase === 'Luteal' ? getLutealSubPhase(cd, cycleLen) : phase
    plan.push({ offset: i, cycleDay: cd, phase, sub })
  }
  return plan
}

// Varied session pools per training-capacity tier, so consecutive same-phase days don't all
// read identically. Each tier rotates through its options across the week.
const POOLS = {
  peak: [
    { title:'Peak session', detail:'Your strongest day of the cycle. Go for heavy lifts or a hard effort, and warm up thoroughly first.' },
  ],
  high: [
    { title:'Strength, lower body', detail:'Squats, deadlifts, lunges. Recovery is quick this week, so add weight where you can.' },
    { title:'Strength, upper body', detail:'Presses, rows, and pulls. Push for an extra rep or a little more load than last time.' },
    { title:'Faster cardio', detail:'Intervals, a tempo run, or a spin. Your engine handles intensity well right now.' },
    { title:'Strength, full body', detail:'Compound lifts across the whole body. A great use of this window.' },
  ],
  moderate: [
    { title:'Steady strength', detail:'Normal volume at a moderate load. Solid, consistent work.' },
    { title:'Easy cardio', detail:'A steady walk, jog, or ride at a comfortable, conversational effort.' },
    { title:'Pilates or core', detail:'Controlled strength and stability without heavy loading.' },
  ],
  low: [
    { title:'Gentle walk', detail:'20 to 30 min easy. Movement genuinely eases cramps and lifts your mood.' },
    { title:'Restorative yoga', detail:'Slow flow and stretching, kind to your body today.' },
    { title:'Mobility & stretch', detail:'Loosen up and breathe. No intensity needed today.' },
  ],
  rest: [
    { title:'Rest day', detail:'Full rest. Recovery is when the work you did actually pays off.' },
  ],
}

function tierOf(sub) {
  if (sub === 'Ovulatory') return 'peak'
  if (['Follicular', 'Late follicular', 'Early luteal'].includes(sub)) return 'high'
  if (['Menstrual', 'Late luteal'].includes(sub)) return 'low'
  return 'moderate' // Early follicular, Mid luteal, Luteal
}

// Turn a phase-per-day plan into an actual varied training week: rotates session types within
// a phase so days differ, sprinkles ~2 rest days (1 for a consistency goal), and softens the
// hard days for calmer goals. This is what stops every follicular day reading the same.
export function assignSessions(plan, goal) {
  if (!plan) return null
  const counters = { peak: 0, high: 0, moderate: 0, low: 0 }
  const restTarget = goal === 'consistency' ? 1 : 2
  let streak = 0, rests = 0
  const out = []
  for (let i = 0; i < plan.length; i++) {
    let tier = tierOf(plan[i].sub)
    if ((goal === 'destress' || goal === 'feel_better') && tier === 'high') tier = 'moderate'
    const daysLeft = plan.length - i
    let isRest = false
    if (tier !== 'peak') {
      if (streak >= 3 && rests < restTarget) isRest = true
      else if (tier === 'low' && rests < restTarget && i % 2 === 1) isRest = true
      else if (rests < restTarget && daysLeft <= restTarget - rests) isRest = true
    }
    let pick
    if (isRest) { pick = POOLS.rest[0]; rests++; streak = 0 }
    else { const pool = POOLS[tier]; pick = pool[counters[tier] % pool.length]; counters[tier]++; streak++ }
    out.push({ ...plan[i], title: pick.title, detail: pick.detail })
  }
  return out
}

// A lighter alternative session, used when the user chooses to adapt a day (e.g. because their
// own history shows lower energy around that cycle day).
export function lighterSession() {
  return { title: 'Lighter day (your choice)', detail: 'A walk, gentle yoga, or mobility instead of the harder session. You tend to have less in the tank around here.' }
}

// Group a 28-day plan into 4 weeks, returning each week's dominant phase (the phase on its
// middle day) for the monthly overview.
export function weekBlocks(plan) {
  if (!plan) return null
  const blocks = []
  for (let w = 0; w < Math.floor(plan.length / 7); w++) {
    const mid = plan[w * 7 + 3] || plan[w * 7]
    blocks.push({ week: w + 1, sub: mid.sub, phase: mid.phase, startOffset: w * 7 })
  }
  return blocks
}
