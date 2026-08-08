// Builds the FULL set of today's workout options for the Apple Watch from the app's own computed
// status. The phone is where the workout intelligence lives, so we pre-generate every option here,
// flag a readiness-led starting option as `recommended`, sort it first, and send
// the whole list. The watch just renders + plays them (guided player + live heart rate), so the
// watch experience mirrors the phone without reimplementing the generator natively.
//
// Wire shape (decoded by TodayPlan/WatchWorkout on the watch):
//   { phase, date, age, workouts: [{ activity, title, detail, recommended, exercises:[{name,guide,reps,sets}] }] }
// A cardio/yoga "exercise" is just a guided step (sets:1, reps carries the duration).

import { EXERCISES } from './exerciseData'   // shared with the phone workout screen

const step = (name, guide, reps, sets = 1) => ({ name, guide, reps, sets })

// Convert a phone strength exercise { name, sets, reps, weight } into the watch's guided-step
// shape. Holds like planks store reps as seconds, everything else as a rep count.
function toWatchExercise(e) {
  const isHold = /plank/i.test(e.name)
  return { name: e.name, guide: e.weight || 'bodyweight', reps: isHold ? `${e.reps} sec` : `${e.reps} reps`, sets: e.sets || 1 }
}
function strength(split, level) {
  const list = EXERCISES[split]?.[level] || EXERCISES.full.intermediate
  return list.map(toWatchExercise)
}

// Restorative / mobility flow — the same poses the watch can animate (StickFigure).
const YOGA_FLOW = [
  step("Child's pose", 'breathe deep', '2 min'),
  step('Cat-cow', 'slow, with breath', '2 min'),
  step('Supine twist', 'each side', '3 min'),
  step('Savasana', 'let go', '5 min'),
]

// HIIT interval block — the player steps through each.
const HIIT_ROUNDS = [
  step('Warm up', 'easy pace', '3 min'),
  step('Work interval', 'hard effort', '40 sec', 6),
  step('Recover', 'walk it out', '80 sec', 6),
  step('Cool down', 'easy pace', '3 min'),
]

function ageFromProfile(profile) {
  const by = profile?.birth_year
  if (!by) return null
  const age = new Date().getFullYear() - by
  return age > 0 && age < 120 ? age : null
}

function levelOf(profile) {
  const l = profile?.fitness_level
  return l === 'beginner' ? 'beginner' : (l === 'advanced' || l === 'athlete') ? 'advanced' : 'intermediate'
}

// Calendar phase cannot choose a workout. Use a personal recovery observation when available;
// otherwise keep a neutral full-body option first while still offering every activity.
function recommendedId(status) {
  const readiness = String(status?.workoutReadiness || '').toLowerCase()
  if (/lighter|poor sleep|very low|hard|recovery/.test(readiness)) return 'walk'
  return 'gym-full'
}

// status: getTodayStatus output. dateISO: yyyy-MM-dd. Returns the full watch payload.
export function buildWatchWorkouts(status, dateISO) {
  if (!status) return null
  const age = ageFromProfile(status.profile)
  const phaseLabel = status.subPhase || status.phase || 'Today'

  // Pregnancy is never auto-prescribed a workout (permanent app rule) — guidance only.
  if (status.phase === 'Pregnancy') {
    return {
      phase: phaseLabel, date: dateISO || null, age,
      workouts: [{
        activity: 'Walk', title: 'Move as your provider advised', recommended: true,
        detail: 'Gentle, cleared-by-your-provider movement. Stop and call your provider if anything feels off.',
        exercises: [],
      }],
    }
  }

  const level = levelOf(status.profile)
  const strengthNote = 'use recent performance and your warm-up'

  // Every option offered today. Gym is split into Full / Upper / Lower so she can choose, exactly
  // like the phone. Cardio/yoga/HIIT round out the list.
  const options = [
    { id: 'gym-full',  activity: 'Gym',  title: 'Full body', detail: `Strength · ${strengthNote}`, exercises: strength('full', level) },
    { id: 'gym-upper', activity: 'Gym',  title: 'Upper body', detail: `Strength · ${strengthNote}`, exercises: strength('upper', level) },
    { id: 'gym-lower', activity: 'Gym',  title: 'Lower body', detail: `Strength · ${strengthNote}`, exercises: strength('lower', level) },
    { id: 'walk', activity: 'Walk', title: 'Zone 2 walk', detail: '35 min · conversational pace',
      exercises: [step('Steady walk', 'conversational, nose-breathing', '35 min')] },
    { id: 'yoga', activity: 'Yoga', title: 'Restorative flow', detail: '12 min · calm', exercises: YOGA_FLOW },
    { id: 'hiit', activity: 'HIIT', title: 'HIIT intervals', detail: '~15 min · hard/easy', exercises: HIIT_ROUNDS },
    { id: 'run',  activity: 'Run',  title: 'Easy run', detail: '30 min · easy pace',
      exercises: [step('Steady run', 'easy, can hold a conversation', '30 min')] },
    { id: 'cycle', activity: 'Cycle', title: 'Zone 2 ride', detail: '40 min · steady',
      exercises: [step('Steady ride', 'steady, sustainable effort', '40 min')] },
    { id: 'swim', activity: 'Swim', title: 'Pool session', detail: '30 min · steady laps',
      exercises: [step('Steady swim', 'easy, sustainable laps', '30 min')] },
    { id: 'pilates', activity: 'Pilates', title: 'Mat Pilates', detail: '20 min · core control',
      exercises: [
        step('The hundred', 'pump arms, breathe', '1 min'),
        step('Roll-up', 'slow, one vertebra at a time', '8 reps'),
        step('Single-leg stretch', 'alternate legs, core tight', '10 each'),
        step('Side plank', 'hips lifted, stack', '30 sec', 2),
        step('Spine stretch', 'reach long, exhale', '6 reps'),
      ] },
    { id: 'rest', activity: 'Rest', title: 'Rest day', detail: 'Recovery · gentle stretching if you like',
      exercises: [] },
  ]

  const recId = recommendedId(status)
  const workouts = options.map(({ id, ...o }) => ({
    ...o,
    recommended: id === recId,
    detail: id === recId && status.workoutReadiness ? `${o.detail} · ${status.workoutReadiness}` : o.detail,
  }))
  workouts.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))

  return { phase: phaseLabel, date: dateISO || null, age, workouts }
}
