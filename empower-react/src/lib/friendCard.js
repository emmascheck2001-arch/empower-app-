// friendCard.js — the one place that turns a get_friend_card row into a displayable phase.
//
// WHY IT LIVES HERE: get_friend_card returns a friend's raw cycle anchor (last_period_date,
// cycle_length, user_path) plus her visibility flags. It does NOT return a phase — the phase
// has to be computed client-side. That logic previously existed only inside Friends.jsx, so
// the moment a second screen showed friends it silently rendered an undefined phase.
//
// PRIVACY RULE (permanent, never weaken): `show_phase` is the friend's own choice about
// whether anyone may see where she is in her cycle. Every caller MUST go through
// visiblePhaseForCard, which returns null when that flag is off. Never read card.phase
// directly (there is no such field) and never bypass the flag.
import { getPhase, getLutealSubPhase } from './hormoneSync.js'

// The phase a friend is in today, ignoring visibility. Internal — prefer visiblePhaseForCard.
export function phaseForCard(card) {
  if (!card?.last_period_date || !card?.cycle_length) return null
  const last = new Date(card.last_period_date + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const cd = Math.floor((now - last) / 86400000) + 1
  // Stale anchor: past a cycle plus two weeks we do not know where she is, so say nothing
  // rather than showing a confidently wrong phase.
  if (cd < 1 || cd > card.cycle_length + 14) return null
  if (card.user_path === '4') return 'Perimenopause'
  const phase = getPhase(cd, card.cycle_length)
  return phase === 'Luteal' ? getLutealSubPhase(cd, card.cycle_length) : phase
}

// What a viewer is actually allowed to see. Returns null unless the friend turned phase
// sharing on AND we can place her in a cycle.
export function visiblePhaseForCard(card) {
  if (!card || card.show_phase === false) return null
  return phaseForCard(card)
}
