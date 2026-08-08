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
    { title:'Planned challenge', detail:'Use the hard session you planned if recent recovery and today’s warm-up support it.' },
  ],
  high: [
    { title:'Strength, lower body', detail:'Squats, hinges and lunges at a load supported by recent completed sessions.' },
    { title:'Strength, upper body', detail:'Presses, rows and pulls. Progress only after repeated comfortable completions.' },
    { title:'Cardio session', detail:'Use the intervals, steady session or recovery work already in your plan.' },
    { title:'Strength, full body', detail:'Compound lifts across the whole body, adjusted from your warm-up.' },
  ],
  moderate: [
    { title:'Steady strength', detail:'Normal volume at a moderate load. Solid, consistent work.' },
    { title:'Easy cardio', detail:'A steady walk, jog, or ride at a comfortable, conversational effort.' },
    { title:'Pilates or core', detail:'Controlled strength and stability without heavy loading.' },
  ],
  low: [
    { title:'Gentle walk', detail:'An optional 20 to 30 minute easy walk when recovery is the goal.' },
    { title:'Restorative yoga', detail:'An optional slow flow or stretching session.' },
    { title:'Mobility & stretch', detail:'An optional mobility session when symptoms or recovery call for it.' },
  ],
  rest: [
    { title:'Rest day', detail:'Full rest. Recovery is when the work you did actually pays off.' },
  ],
}

function tierOf(sub) {
  void sub
  // Phase stays attached as context, but it cannot assign training capacity.
  return 'moderate'
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
  return { title: 'Lighter day (your choice)', detail: 'A walk, gentle yoga, mobility or reduced-volume version of your planned session.' }
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
