// unlocks.js — the progress ledger that replaces a bare streak number.
//
// THE PROBLEM: every real payoff in this app is gated (the cycle story needs 8 energy logs and
// 2 per phase; Looking Ahead needs 2 past cycles; Weekly Insights needs 3 logs and a Sunday),
// but NONE of those thresholds were ever shown. She logged into a locked door with no sign on
// it. A streak counts days; it does not tell you what you are working toward.
//
// THE FIX: show the distance to each real payoff, computed from the SAME thresholds the
// engines actually use. "2 more energy logs and your cycle story turns on."
//
// RULES (never loosen):
//  1. The thresholds here must stay in sync with the engines they describe. If an engine's
//     minimum changes, change it here — a ledger that lies about the distance is worse than
//     no ledger. The constants are imported where the engine exports them.
//  2. Never promise an insight the engine might still withhold. Each item says what it needs,
//     and an engine may still stay quiet if her data shows no real pattern — the copy says
//     "can look for" rather than "will show you".
//  3. No streak shaming. A missed day never resets anything here; these are cumulative counts.
// Pure functions, unit-tested.

import { MIN_SCORED } from './predictionAccuracy.js'

// Mirrors of the engine thresholds, with the file each one belongs to. Keep in sync.
export const THRESHOLDS = {
  monthlyStory:  { energyLogs: 8, perPhase: 2, source: 'monthlyStory.js' },
  phaseOutlook:  { cycles: 2, source: 'phaseOutlook.js' },
  weeklyInsight: { logsThisWeek: 3, source: 'WeeklySummary.jsx' },
  accuracy:      { scoredCycles: MIN_SCORED, source: 'predictionAccuracy.js' },
  energyGame:    { samplesNearDay: 3, source: 'predictionAccuracy.js' },
  tightWindow:   { cycles: 5, source: 'cycleStats.js' },
}

const ENERGY = new Set(['Very low', 'Low', 'Normal', 'Good', 'High'])

// logs: all daily_logs (any order). cyclesTracked: completed cycles. logsThisWeek: count.
// Returns [{ key, title, what, need, have, remaining, unlocked }] ordered nearest-first.
export function buildUnlocks({ logs = [], cyclesTracked = 0, logsThisWeek = 0, periodStarts = [] } = {}) {
  const energyLogs = logs.filter(l => ENERGY.has(l?.energy)).length
  const scoredCycles = Math.max(0, (periodStarts?.length || 0) - 2)

  const items = [
    {
      key: 'monthlyStory',
      title: 'Your cycle story',
      what: 'A plain-English read on when your energy actually peaks and dips across your cycle',
      need: THRESHOLDS.monthlyStory.energyLogs, have: energyLogs, unit: 'energy log',
    },
    {
      key: 'weeklyInsight',
      title: 'Weekly insights',
      what: 'A Sunday recap of your own week — training, energy, sleep',
      need: THRESHOLDS.weeklyInsight.logsThisWeek, have: logsThisWeek, unit: 'log this week',
    },
    {
      key: 'phaseOutlook',
      title: 'Looking ahead',
      what: 'What YOU personally tend to feel heading into your next phase',
      need: THRESHOLDS.phaseOutlook.cycles, have: cyclesTracked, unit: 'tracked cycle',
    },
    {
      key: 'accuracy',
      title: 'Prediction scorecard',
      what: 'How close my period predictions actually land, graded against what really happened',
      need: THRESHOLDS.accuracy.scoredCycles, have: scoredCycles, unit: 'scored cycle',
    },
    {
      key: 'tightWindow',
      title: 'A sharper prediction window',
      what: 'Enough cycles for me to read your real spread instead of estimating it',
      need: THRESHOLDS.tightWindow.cycles, have: cyclesTracked, unit: 'tracked cycle',
    },
  ]

  return items.map(i => {
    const remaining = Math.max(0, i.need - i.have)
    return { ...i, remaining, unlocked: remaining === 0,
      progress: Math.min(1, i.need ? i.have / i.need : 1) }
  }).sort((a, b) => (a.unlocked === b.unlocked ? a.remaining - b.remaining : a.unlocked ? 1 : -1))
}

// The single most motivating line: the nearest thing still locked.
export function nextUnlock(unlocks) {
  const next = (unlocks || []).find(u => !u.unlocked)
  if (!next) return null
  const n = next.remaining
  return {
    ...next,
    line: `${n} more ${next.unit}${n === 1 ? '' : 's'} and ${next.title.toLowerCase()} turns on`,
  }
}

// Which items became unlocked between two ledger snapshots — feeds the "what changed" card.
export function newlyUnlocked(before, after) {
  const wasLocked = new Set((before || []).filter(u => !u.unlocked).map(u => u.key))
  return (after || []).filter(u => u.unlocked && wasLocked.has(u.key)).map(u => u.title)
}
