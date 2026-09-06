// logDelta.js — "here is what your log just changed".
//
// THE PROBLEM: saving a log showed a checkmark and a confidence percentage. On any given day
// that number barely moved, so the app silently taught her that logging does nothing. The
// reward for logging was invisible.
//
// THE FIX: after every save, show the DELTA — what the model believed before her entry versus
// after it. A moved period date, a phase that firmed up, a pattern that now has enough data.
// Every log visibly moves something, or the card honestly says it confirmed what we had.
//
// RULES (never loosen):
//  1. NEVER invent a change. If nothing moved, say "this confirmed what I already had" —
//     confirmation is a real, honest outcome and worth saying plainly.
//  2. Only ever describe HER data and the model's own state. No population claims, no
//     "women often...", no health predictions.
//  3. Numbers must be the real before/after values, never rounded into looking better.
// Pure functions only, unit-tested.

const DAY = 86400000
const fmt = d => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null

// before/after are getTodayStatus() results (before = pre-save, after = post-save).
// Returns { changes: [{icon,text,kind}], confirmed: bool, headline }
export function buildLogDelta(before, after, opts = {}) {
  const changes = []
  if (!after) return { changes, confirmed: true, headline: 'Saved' }

  // ── model confidence ──────────────────────────────────────────────────────
  const b = Math.round((before?.confidence ?? 0) * 100)
  const a = Math.round((after?.confidence ?? 0) * 100)
  if (before && a > b) {
    changes.push({ kind: 'confidence', icon: 'ti-target-arrow',
      text: `How well I know your body: ${b}% → ${a}%` })
  }

  // ── the period prediction ─────────────────────────────────────────────────
  const bp = before?.nextPeriodPrediction, ap = after?.nextPeriodPrediction
  if (bp?.predictedDate && ap?.predictedDate) {
    const shift = Math.round((new Date(ap.predictedDate) - new Date(bp.predictedDate)) / DAY)
    if (shift !== 0) {
      changes.push({ kind: 'prediction', icon: 'ti-calendar-event',
        text: `Predicted period moved ${fmt(bp.predictedDate)} → ${fmt(ap.predictedDate)}` })
    }
    // A narrowing window is real progress and worth naming: it means the guess got sharper.
    const bw = Math.round((new Date(bp.windowEnd) - new Date(bp.windowStart)) / DAY)
    const aw = Math.round((new Date(ap.windowEnd) - new Date(ap.windowStart)) / DAY)
    if (aw < bw) {
      changes.push({ kind: 'window', icon: 'ti-arrows-minimize',
        text: `Prediction window tightened from ${bw + 1} days to ${aw + 1}` })
    }
  } else if (!bp?.predictedDate && ap?.predictedDate) {
    changes.push({ kind: 'prediction', icon: 'ti-calendar-event',
      text: `I can now predict your next period: around ${fmt(ap.predictedDate)}` })
  }

  // ── phase ─────────────────────────────────────────────────────────────────
  if (before?.phase && after?.phase && before.phase !== after.phase) {
    changes.push({ kind: 'phase', icon: 'ti-arrow-right',
      text: `Your phase updated: ${before.phase} → ${after.phase}` })
  }
  // An estimated phase becoming a confirmed one is the single biggest jump in the model.
  if (before?.estimated && after && !after.estimated) {
    changes.push({ kind: 'phase', icon: 'ti-check',
      text: 'Your phase is now anchored to a logged period, not an estimate' })
  }

  // ── newly unlocked insights ───────────────────────────────────────────────
  for (const u of opts.newlyUnlocked || []) {
    changes.push({ kind: 'unlock', icon: 'ti-lock-open', text: `Unlocked: ${u}` })
  }

  // ── the model's own prediction, graded ────────────────────────────────────
  // She logged something the app had guessed in advance. Telling her whether it was right is
  // the honest version of a reward, and it is the loop that makes logging feel like a game.
  if (opts.energyPrediction && opts.loggedEnergy) {
    const p = opts.energyPrediction
    const exact = p.word === opts.loggedEnergy
    changes.push({ kind: 'score', icon: exact ? 'ti-confetti' : 'ti-scale',
      text: exact
        ? `I predicted "${p.word}" energy today and you logged "${opts.loggedEnergy}" — called it.`
        : `I predicted "${p.word}" energy today, you logged "${opts.loggedEnergy}". Noted — that improves the next guess.` })
  }

  const confirmed = changes.length === 0
  const headline = confirmed
    ? 'This matched what I already had'
    : changes.length === 1 ? 'One thing changed' : `${changes.length} things changed`
  return { changes, confirmed, headline }
}

// A short, honest line for a day where nothing moved. Confirmation genuinely is worth
// something — it is what makes a pattern trustworthy — so say that rather than nothing.
export function confirmationLine(streakOfConfirmations = 0) {
  if (streakOfConfirmations >= 3) return 'Three days running that your body has done what I expected. That consistency is what makes the prediction reliable.'
  return 'Nothing shifted today, which means your pattern is holding steady. Confirming a pattern is how it becomes reliable.'
}
