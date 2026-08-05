// Concrete, plain-language "what should I actually do today" movement guidance, keyed by
// cycle phase / subphase. Replaces the abstract "X% intensity today" number, which told
// users nothing actionable. Each entry: a short title + one specific, simple suggestion.
// Science: Kissow 2022 (follicular strength), De Martin Topranin 2023 (luteal feels harder),
// Herzberg 2017 (ovulatory ligament laxity), Daley 2015 (movement eases cramps), Kohrt 2004.
export const MOVEMENT_TODAY = {
  Menstrual:          { title: 'Gentle movement',      detail: 'A 20 to 30 minute walk, easy yoga, or mobility. Movement genuinely eases cramps. Save the heavy lifts for next week.' },
  'Early follicular': { title: 'Ease back in',         detail: 'A lighter strength session or a brisk walk. Your energy is returning, so there is no need to push hard yet.' },
  Follicular:         { title: 'A strong build day',   detail: 'A solid strength session or a faster run. Recovery is quickest this phase, so it is a great day to challenge yourself.' },
  'Late follicular':  { title: 'Peak strength day',    detail: 'Your strongest window. Heavy lower body or compound lifts respond best now. Expect to feel powerful.' },
  Ovulatory:          { title: 'Peak power day',       detail: 'High energy and strength today. Great for a hard session. Warm up thoroughly, as ligaments are a little laxer around ovulation.' },
  'Early luteal':     { title: 'Steady strength',      detail: 'Your energy is still good. Keep your normal training volume with steady, solid work.' },
  'Mid luteal':       { title: 'Go a little lighter',  detail: 'The same session honestly feels harder now. That is physiology, not weakness. Drop the load about 10 to 15 percent, or swap for tempo cardio or yoga.' },
  'Late luteal':      { title: 'Recover gently',       detail: 'Keep it easy. A walk, yoga, or light stretching. Completing anything at all is a win this week.' },
  Luteal:             { title: 'Lighter day',          detail: 'Reduce the intensity but stay consistent. Train to how you feel, not to the numbers.' },
  Perimenopause:      { title: 'Strength is priority', detail: 'Resistance training 2 to 3 times a week protects muscle and bone through the transition. Even one session counts.' },
  bc:                 { title: 'Train steady',         detail: 'Your hormones are steady on birth control, so train consistently. Progressive strength work pays off week to week.' },
  observation:        { title: 'Move to feel good',    detail: 'Any movement counts and teaches the app your baseline. Walk, stretch, or train, whatever feels right today.' },
}

export function getMovementToday(phase, subPhase) {
  return MOVEMENT_TODAY[subPhase] || MOVEMENT_TODAY[phase] || MOVEMENT_TODAY.observation
}
