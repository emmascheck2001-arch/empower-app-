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

// A flexible weekly template, independent of cycle phase. Strength sessions are separated
// by lower-intensity days; users can move days or reduce volume to suit their recovery.
export function assignSessions(plan, goal) {
  if (!plan) return null
  const strength = { title:'Strength, full body', detail:'Choose a full-body session with squats or hinges, presses and pulls. Use a manageable load.' }
  const cardio = { title:'Easy cardio', detail:'Walk, cycle, swim or jog at a comfortable, conversational pace.' }
  const mobility = { title:'Pilates or mobility', detail:'Choose controlled movement or gentle stretching that feels comfortable.' }
  const rest = { title:'Rest day', detail:'Rest or choose gentle movement if you enjoy it.' }
  const third = goal === 'strength' ? strength : mobility
  const week = [strength, cardio, rest, strength, cardio, third, goal === 'consistency' ? mobility : rest]
  return plan.map((day, i) => ({ ...day, ...week[i % 7] }))
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
