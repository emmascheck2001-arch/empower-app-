// contextInsights.js — connects what her LIFE was doing to what her body did.
//
// WHY: every field in the log is a body signal. But "I taught four classes and drove to
// Regina" explains an energy crash better than any hormone model can, and the app had no way
// to know it. Tagging a day with real-life context turns the log from a symptom form into a
// record of her actual life, and it lets the app answer a question nothing else can:
// how does teaching a double day in the luteal phase compare to the same day follicular?
//
// RULES (never loosen):
//  1. CORRELATION IS NOT CAUSE. Every line must be phrased as an association she can see in
//     her own data ("on days you tagged X, your energy averaged Y"), never "X causes Y".
//  2. MINIMUMS ARE REAL. Never compare on fewer than MIN_TAGGED tagged days and MIN_UNTAGGED
//     comparison days, and never report a difference smaller than MIN_SPREAD.
//  3. Her own data only. No population claims, no health advice, no diagnosis.
// Pure functions, unit-tested.

export const MIN_TAGGED = 3      // tagged days needed before a tag is analysed at all
export const MIN_UNTAGGED = 3    // comparison days needed
export const MIN_SPREAD = 0.5    // gap on the 1-4 energy scale worth mentioning

// A short, editable starter set. Deliberately about LIFE, not symptoms — the log already has
// symptoms. Free-text custom tags are allowed too; anything stored is analysed the same way.
export const SUGGESTED_TAGS = [
  'Taught a class', 'Taught 2+ classes', 'Big work day', 'Deadline',
  'Travel', 'Late night', 'Social', 'Rest day', 'Family', 'Sick day',
]

const ENERGY = { 'Very low': 1, 'Low': 2, 'Normal': 3, 'Good': 3, 'High': 4 }

const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const word = v => (v >= 3.5 ? 'high' : v >= 2.5 ? 'normal' : v >= 1.75 ? 'low' : 'very low')

// logs: [{ log_date, energy, sleep_quality, context_tags: [] }]
// Returns [{ tag, n, energyTagged, energyOther, diff, line }] for tags that clear the minimums.
export function tagInsights(logs = []) {
  const all = (logs || []).filter(l => l && Array.isArray(l.context_tags))
  const tags = [...new Set(all.flatMap(l => l.context_tags))]
  const out = []

  for (const tag of tags) {
    const tagged = all.filter(l => l.context_tags.includes(tag))
    const other = all.filter(l => !l.context_tags.includes(tag))
    if (tagged.length < MIN_TAGGED || other.length < MIN_UNTAGGED) continue

    const eT = avg(tagged.map(l => ENERGY[l.energy]).filter(Boolean))
    const eO = avg(other.map(l => ENERGY[l.energy]).filter(Boolean))
    if (eT == null || eO == null) continue
    const diff = eT - eO
    if (Math.abs(diff) < MIN_SPREAD) continue

    const dir = diff > 0 ? 'higher' : 'lower'
    out.push({
      tag, n: tagged.length, energyTagged: Math.round(eT * 100) / 100, energyOther: Math.round(eO * 100) / 100, diff,
      line: `On the ${tagged.length} days you tagged "${tag}", your energy has averaged ${word(eT)} — ${dir} than your other days. That is a pattern in your own log, not a cause.`,
    })
  }
  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

// The question only this app can answer: does the same kind of day land differently depending
// on where she is in her cycle? Requires enough tagged days in BOTH phases being compared.
export function tagByPhase(logs = [], phaseOf) {
  const all = (logs || []).filter(l => l && Array.isArray(l.context_tags) && ENERGY[l.energy])
  const out = []
  const tags = [...new Set(all.flatMap(l => l.context_tags))]
  for (const tag of tags) {
    const tagged = all.filter(l => l.context_tags.includes(tag))
    const byPhase = {}
    for (const l of tagged) {
      const p = phaseOf ? phaseOf(l) : l.phase
      if (!p) continue
      ;(byPhase[p] = byPhase[p] || []).push(ENERGY[l.energy])
    }
    const usable = Object.entries(byPhase).filter(([, v]) => v.length >= MIN_TAGGED)
    if (usable.length < 2) continue
    const scored = usable.map(([p, v]) => ({ phase: p, mean: avg(v), n: v.length }))
      .sort((a, b) => b.mean - a.mean)
    const best = scored[0], worst = scored[scored.length - 1]
    if (best.mean - worst.mean < MIN_SPREAD) continue
    out.push({
      tag, best, worst,
      line: `"${tag}" days have felt best in your ${best.phase.toLowerCase()} phase (${best.n} days) and hardest in your ${worst.phase.toLowerCase()} phase (${worst.n} days), going on the energy you logged.`,
    })
  }
  return out
}
