// Builds the FULL set of today's workout options for the Apple Watch from the app's own computed
// status. The phone is where the workout intelligence lives, so we pre-generate every option here
// (phase-appropriate), flag the one best for her cycle as `recommended`, sort it first, and send
// the whole list. The watch just renders + plays them (guided player + live heart rate), so the
// watch experience mirrors the phone without reimplementing the generator natively.
//
// Wire shape (decoded by TodayPlan/WatchWorkout on the watch):
//   { phase, date, age, workouts: [{ activity, title, detail, recommended, exercises:[{name,guide,reps,sets}] }] }
// A cardio/yoga "exercise" is just a guided step (sets:1, reps carries the duration).

import { getMovementToday } from './movementToday'

const ex = (name, guide, reps, sets = 1) => ({ name, guide, reps, sets })

// Phase-scaled full-body strength session. These mirror the phone's full-body presets so the
// watch strength day matches what the phone would prescribe for the same fitness level.
const STRENGTH = {
  beginner: [
    ex('Goblet squat', '8 to 16 kg', '10 reps', 3),
    ex('Push-up', 'bodyweight', '10 reps', 3),
    ex('Dumbbell row', '8 to 14 kg each', '10 reps', 3),
    ex('Romanian deadlift', '8 to 14 kg each', '12 reps', 3),
    ex('Dumbbell shoulder press', '6 to 12 kg each', '10 reps', 3),
    ex('Plank', 'bodyweight', '30 sec', 3),
  ],
  intermediate: [
    ex('Barbell squat', '40 to 60 kg', '8 reps', 4),
    ex('Bench press', '25 to 40 kg', '8 reps', 4),
    ex('Barbell row', '30 to 50 kg', '8 reps', 4),
    ex('Romanian deadlift', '40 to 65 kg', '10 reps', 4),
    ex('Overhead press', '15 to 25 kg', '10 reps', 3),
    ex('Cable face pull', '10 to 20 kg', '15 reps', 3),
  ],
  advanced: [
    ex('Barbell squat', '60 to 90 kg', '5 reps', 5),
    ex('Bench press', '40 to 60 kg', '5 reps', 5),
    ex('Deadlift', '70 to 110 kg', '5 reps', 4),
    ex('Barbell row', '50 to 75 kg', '6 reps', 4),
    ex('Overhead press', '25 to 40 kg', '6 reps', 4),
    ex('Pull-up', 'bodyweight or weighted', '8 reps', 4),
  ],
}

// Restorative / mobility flow — the same poses the watch can animate (StickFigure).
const YOGA_FLOW = [
  ex("Child's pose", 'breathe deep', '2 min', 1),
  ex('Cat-cow', 'slow, with breath', '2 min', 1),
  ex('Supine twist', 'each side', '3 min', 1),
  ex('Savasana', 'let go', '5 min', 1),
]

// HIIT interval block — rounds of work; the player steps through each.
const HIIT_ROUNDS = [
  ex('Warm up', 'easy pace', '3 min', 1),
  ex('Work interval', 'hard effort', '40 sec', 6),
  ex('Recover', 'walk it out', '80 sec', 6),
  ex('Cool down', 'easy pace', '3 min', 1),
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

// Which activity is best for this phase (the one we flag "Recommended" and sort to the top).
// Research-aligned with movementToday: strength on the strong phases, gentler movement when the
// same session genuinely feels harder (mid/late luteal, menstrual).
function recommendedActivity(phase) {
  switch (phase) {
    case 'Menstrual': return 'Yoga'
    case 'Early follicular': return 'Gym'
    case 'Follicular':
    case 'Late follicular': return 'Gym'
    case 'Ovulatory': return 'HIIT'
    case 'Early luteal': return 'Gym'
    case 'Mid luteal': return 'Walk'
    case 'Late luteal': return 'Yoga'
    case 'Perimenopause': return 'Gym'
    default: return 'Gym'   // bc / observation
  }
}

// The candidate options offered every day. Order here is the fallback order; the recommended
// one is moved to the top below.
function optionsFor(phase, level) {
  const strengthTitle = phase === 'Late follicular' || phase === 'Ovulatory' ? 'Peak strength'
    : (phase === 'Mid luteal' || phase === 'Late luteal' || phase === 'Menstrual') ? 'Lighter strength'
    : 'Full-body strength'
  const strengthDetail = (phase === 'Mid luteal' || phase === 'Late luteal')
    ? 'Strength · drop the load ~10–15%'
    : phase === 'Ovulatory' ? 'Strength · warm up thoroughly (ligaments laxer)'
    : 'Strength · progressive overload'

  return [
    { activity: 'Gym',  title: strengthTitle, detail: strengthDetail, exercises: STRENGTH[level] },
    { activity: 'Walk', title: 'Zone 2 walk', detail: '35 min · conversational pace',
      exercises: [ex('Steady walk', 'conversational, nose-breathing', '35 min', 1)] },
    { activity: 'Yoga', title: 'Restorative flow', detail: '12 min · calm', exercises: YOGA_FLOW },
    { activity: 'HIIT', title: 'HIIT intervals', detail: '~15 min · hard/easy', exercises: HIIT_ROUNDS },
    { activity: 'Run',  title: 'Easy run', detail: '30 min · easy pace',
      exercises: [ex('Steady run', 'easy, can hold a conversation', '30 min', 1)] },
    { activity: 'Cycle', title: 'Zone 2 ride', detail: '40 min · steady',
      exercises: [ex('Steady ride', 'steady, sustainable effort', '40 min', 1)] },
  ]
}

// status: getTodayStatus output. dateISO: yyyy-MM-dd. Returns the full watch payload.
export function buildWatchWorkouts(status, dateISO) {
  if (!status) return null
  const age = ageFromProfile(status.profile)
  const phase = status.subPhase || status.phase || 'Today'

  // Pregnancy is never auto-prescribed a workout (permanent app rule) — guidance only.
  if (status.phase === 'Pregnancy') {
    return {
      phase, date: dateISO || null, age,
      workouts: [{
        activity: 'Walk', title: 'Move as your provider advised', recommended: true,
        detail: 'Gentle, cleared-by-your-provider movement. Stop and call your provider if anything feels off.',
        exercises: [],
      }],
    }
  }

  const level = levelOf(status.profile)
  const rec = recommendedActivity(status.phase)   // recommend by top-level phase (not subphase)
  const move = getMovementToday(status.phase, status.subPhase)

  const opts = optionsFor(status.phase, level).map(o => ({
    ...o,
    recommended: o.activity === rec,
    // Give the recommended card the phase's plain-language "why" as its detail so it reads like
    // the phone's Today guidance.
    detail: o.activity === rec ? `${o.detail} · ${move.title}` : o.detail,
  }))

  // Recommended first, rest keep their order.
  opts.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))

  return { phase, date: dateISO || null, age, workouts: opts }
}
