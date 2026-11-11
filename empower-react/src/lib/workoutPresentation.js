function isPureBodyweightWeight(weight) {
  const lower = (weight || '').trim().toLowerCase()
  return lower === 'bodyweight' || lower === 'bodyweight (pull-up bar)'
}

export function getSvgType(name) {
  const n = (name || '').toLowerCase()
  // Order matters: more specific matches first (e.g. "split squat" before "squat").
  if (n.includes('glute bridge')) return 'bridge'
  if (n.includes('bulgarian') || n.includes('split squat')) return 'splitsquat'
  if (n.includes('squat') || n.includes('goblet')) return 'squat'
  if (n.includes('leg press')) return 'legpress'
  if (n.includes('deadlift')) return 'hinge'
  if (n.includes('plank push-up')) return 'plankpushup'
  if (n.includes('lateral raise') || n.includes('rear delt') || (n.includes('fly') && !n.includes('chest')) || n.includes('front raise')) return 'lateralraise'
  if (n.includes('pulldown')) return 'pullup'
  if (n.includes('bench press') || n.includes('push-up') || (n.includes('incline') && !n.includes('curl')) || n.includes('chest press') || n.includes('chest fly')) return 'push'
  if (n.includes('face pull') || n.includes('pull-apart')) return 'facepull'
  if (n.includes('row') && !n.includes('pull')) return 'row'
  if (n.includes('overhead press') || n.includes('shoulder press')) return 'press'
  if (n.includes('lunge')) return 'lunge'
  if (n.includes('hip thrust')) return 'thrust'
  if (n.includes('pull-up') || n.includes('pull up') || n.includes('chin')) return 'pullup'
  if (n.includes('leg curl') || n.includes('nordic') || n.includes('hamstring curl')) return 'legcurl'
  if (n.includes('pushdown') || n.includes('tricep extension')) return 'pushdown'
  if (n.includes('dip')) return 'dip'
  if (n.includes('curl') && !n.includes('calf')) return 'curl'
  if (n.includes('lying leg raise')) return 'supinelegraise'
  if (n.includes('dead bug')) return 'deadbug'
  if (n.includes('bicycle')) return 'bicycle'
  if (n.includes('leg raise') || n.includes('hanging')) return 'legraise'
  if (n.includes('russian twist')) return 'russiantwist'
  if (n.includes('mountain climber')) return 'mountainclimber'
  if (n.includes('plank shoulder tap')) return 'plankshouldertap'
  if (n.includes('plank jack')) return 'plankjack'
  if (n.includes('plank to pike')) return 'plankpike'
  if (n.includes('side plank')) return 'sideplank'
  if (n.includes('standing core twist') || n.includes('standing twist')) return 'standingtwist'
  if (n.includes('plank')) return 'plank'
  if (n.includes('calf')) return 'calf'
  return 'stand'
}

export function supportsLoggedWeight(weight) {
  const lower = (weight || '').trim().toLowerCase()
  if (!lower || isPureBodyweightWeight(lower)) return false
  return /\d/.test(lower) || /(dumbbell|dumbbells|barbell|weighted|weight vest|kettlebell|plate)/.test(lower)
}

export function phasePrefersLoad(phaseVal) {
  const p = (phaseVal || '').trim().toLowerCase()
  return p.includes('follicular') || p === 'ovulatory' || p === 'early luteal' || p === 'perimenopause'
}

export function phaseGuidanceNote(phaseVal, bannerNote, exercise, sessionExercises) {
  void phaseVal
  void sessionExercises
  if (!bannerNote) return ''
  const weight = exercise?.weight || ''
  if (isPureBodyweightWeight(weight)) {
    return `${bannerNote} For this bodyweight movement, focus on comfortable range and controlled form.`
  }
  return bannerNote
}

export function exerciseLoadGuide(weight) {
  if (!weight) return ''
  if (/\d/.test(weight)) return /bodyweight/i.test(weight)
    ? 'Bodyweight or a manageable load' : 'Choose a manageable load'
  return weight
}

export function isTimedExercise(name) {
  return /^(side )?plank(?: hold)?$/i.test((name || '').trim())
}

export function exerciseReps(exercise) {
  const eachSide = /side plank|single-arm|single-leg|lunge|split squat|step-up/i.test(exercise.name || '')
  return `${exercise.reps} ${isTimedExercise(exercise.name) ? 'seconds' : 'reps'}${eachSide ? ' each side' : ''}`
}
