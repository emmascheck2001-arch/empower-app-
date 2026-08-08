// Concrete, plain-language "what should I actually do today" movement guidance, keyed by
// cycle phase / subphase. Replaces the abstract "X% intensity today" number, which told
// users nothing actionable. Each entry: a short title + one specific, simple suggestion.
// Science: Kissow 2022 (follicular strength), De Martin Topranin 2023 (luteal feels harder),
// Herzberg 2017 (ovulatory ligament laxity), Daley 2015 (movement eases cramps), Kohrt 2004.
export const MOVEMENT_TODAY = {
  Menstrual:          { title: 'Planned or lighter option', detail: 'Training can continue if you feel well. Choose the lighter or recovery option for pain, heavy bleeding, low energy or a difficult warm-up.' },
  'Early follicular': { title: 'Start with your plan', detail: 'Use your warm-up and recent performance to choose the load. Some people notice a shift here; others do not.' },
  Follicular:         { title: 'Start with your plan', detail: 'Some studies report performance advantages here, but individual effects vary. Progress only when recent sessions support it.' },
  'Late follicular':  { title: 'Planned session', detail: 'A possible higher-readiness window for some people. Let form, repetitions in reserve and your own history decide progression.' },
  Ovulatory:          { title: 'Planned session', detail: 'Calendar phase alone does not establish a peak day. Warm up thoroughly and train from today’s readiness.' },
  'Early luteal':     { title: 'Start with your plan', detail: 'Keep the planned session unless symptoms, sleep or your warm-up point toward a lighter option.' },
  'Mid luteal':       { title: 'Planned or lighter option', detail: 'Some people notice higher perceived effort here. Adjust only if that is true for you today.' },
  'Late luteal':      { title: 'Choose from readiness', detail: 'Use symptoms and your warm-up to choose the planned, lighter or recovery option. No automatic deload is required.' },
  Luteal:             { title: 'Choose from readiness', detail: 'Cycle phase is context. Your symptoms, recovery and performance decide the session.' },
  Perimenopause:      { title: 'Strength plus recovery', detail: 'Resistance training supports muscle and bone. Adapt exercises and loads to symptoms, experience and professional guidance.' },
  bc:                 { title: 'Train from readiness', detail: 'Contraceptive responses vary by method and person. Progress from completed training, not an assumed hormone pattern.' },
  observation:        { title: 'Choose what fits today', detail: 'Walk, stretch, train or recover. Logging what you chose and how it felt helps build your baseline.' },
}

export function getMovementToday(phase, subPhase) {
  return MOVEMENT_TODAY[subPhase] || MOVEMENT_TODAY[phase] || MOVEMENT_TODAY.observation
}
