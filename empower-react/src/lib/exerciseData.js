// Shared strength-exercise data, used by BOTH the phone workout screen (src/pages/Workout.jsx)
// and the Apple Watch payload builder (src/lib/watchWorkouts.js) so the watch prescribes exactly
// the same Full body / Upper / Lower sessions the phone does — no duplicated, drifting data.
//
// ex(name, sets, reps, weight, tip): reps is a number (a rep count, or seconds for holds like
// planks). weight is a plain-language load range. tip is the coaching cue.
export function ex(name, sets, reps, weight, tip) { return { name, sets, reps, weight, tip } }

export const EXERCISES = {
  full: {
    beginner: [
      ex('Goblet squat', 3, 10, '8 to 16kg', 'Hold dumbbell at chest. Sit deep, knees tracking over toes.'),
      ex('Push-up', 3, 10, 'Bodyweight', 'Hands shoulder-width, body in one line. Knees down if needed.'),
      ex('Dumbbell row', 3, 10, '8 to 14kg each', 'Brace on bench. Drive elbow back, squeeze at top.'),
      ex('Romanian deadlift', 3, 12, '8 to 14kg each', 'Soft knee bend, hinge from hips. Feel hamstring stretch.'),
      ex('Dumbbell shoulder press', 3, 10, '6 to 12kg each', 'Press straight up, elbows at 90° at start.'),
      ex('Plank', 3, 30, 'Bodyweight', '30 seconds. Hips level, brace your core throughout.'),
    ],
    intermediate: [
      ex('Barbell squat', 4, 8, '40 to 60kg', 'Bar on traps, brace core before descent. Drive knees out.'),
      ex('Bench press', 4, 8, '25 to 40kg', 'Retract shoulder blades. Bar to mid-chest, press straight up.'),
      ex('Barbell row', 4, 8, '30 to 50kg', 'Hinge to 45°. Pull bar to lower ribs. Control the descent.'),
      ex('Romanian deadlift', 4, 10, '40 to 65kg', 'Bar stays close to legs. Stop when hips are fully extended.'),
      ex('Overhead press', 3, 10, '15 to 25kg', 'Brace core hard. Press bar in straight line overhead.'),
      ex('Cable face pull', 3, 15, '10 to 20kg', 'Pull to face level, elbows high. Rear delt and rotator cuff.'),
    ],
    advanced: [
      ex('Barbell squat', 5, 5, '60 to 90kg', 'Control the descent. Explosive drive on the way up.'),
      ex('Bench press', 5, 5, '40 to 60kg', 'Tight arch, shoulder blades pulled together. Full range.'),
      ex('Deadlift', 4, 5, '70 to 110kg', 'Brace hard before pulling. Bar stays against your shins.'),
      ex('Barbell row', 4, 6, '50 to 75kg', 'Horizontal torso. Pull explosively, lower with control.'),
      ex('Overhead press', 4, 6, '25 to 40kg', 'Lock out at top. Full range, no hip drive.'),
      ex('Pull-up', 4, 8, 'Bodyweight or weighted', 'Full hang to chin over bar. Control the descent.'),
    ],
  },
  upper: {
    beginner: [
      ex('Push-up', 3, 12, 'Bodyweight', 'Hands shoulder-width. Modify on knees if needed.'),
      ex('Dumbbell row', 3, 12, '8 to 14kg each', 'Brace on bench, pull elbow back and up.'),
      ex('Dumbbell shoulder press', 3, 10, '6 to 10kg each', 'Controlled press overhead. Lower slowly.'),
      ex('Bicep curl', 3, 12, '6 to 10kg each', 'No swinging. Squeeze at top, lower with control.'),
      ex('Tricep dip', 3, 10, 'Bodyweight', 'Hands on bench, lower until elbows are at 90°.'),
      ex('Band pull-apart', 3, 15, 'Light band', 'Arms straight, pull band to chest width. Rear delts.'),
    ],
    intermediate: [
      ex('Bench press', 4, 8, '25 to 40kg', 'Retract shoulder blades. Control the descent.'),
      ex('Barbell row', 4, 8, '30 to 50kg', 'Hinge at hips, pull bar to lower ribs.'),
      ex('Overhead press', 3, 10, '15 to 25kg', 'Strict press. Brace core throughout.'),
      ex('Cable row', 3, 12, '25 to 45kg', 'Sit tall. Pull handle to lower chest, squeeze.'),
      ex('Dumbbell lateral raise', 3, 12, '6 to 12kg each', 'Slight lean forward. Lead with elbows, not wrists.'),
      ex('Tricep pushdown', 3, 12, '15 to 30kg', 'Elbows pinned to ribs. Full extension at bottom.'),
    ],
    advanced: [
      ex('Bench press', 5, 5, '40 to 60kg', 'Tight setup. Drive feet into floor. Full range.'),
      ex('Weighted pull-up', 4, 6, '5 to 20kg added', 'Full hang to chin over bar. No kipping.'),
      ex('Overhead press', 4, 6, '25 to 40kg', 'No hip drive. Lock out overhead.'),
      ex('Cable row', 4, 10, '40 to 65kg', 'Control the eccentric. Avoid rounding at end range.'),
      ex('Incline dumbbell press', 3, 10, '20 to 35kg each', '30° incline. Focus on upper chest.'),
      ex('Face pull', 3, 15, '15 to 30kg', 'Elbows high and wide. Rear delt activation.'),
    ],
  },
  lower: {
    beginner: [
      ex('Goblet squat', 3, 12, '8 to 16kg', 'Sit deep. Elbows inside knees at the bottom.'),
      ex('Romanian deadlift', 3, 12, '8 to 14kg each', 'Feel the hamstring load. Control the descent.'),
      ex('Glute bridge', 3, 15, 'Bodyweight to 20kg', 'Drive hips up, squeeze glutes at top. Hold 1 second.'),
      ex('Leg press', 3, 12, '40 to 80kg', 'Feet at shoulder width. Full range without locking knees.'),
      ex('Walking lunge', 3, 10, 'Bodyweight to 10kg each', 'Long stride, front knee tracks toes.'),
      ex('Calf raise', 3, 15, 'Bodyweight to 20kg', 'Full range: all the way up and down.'),
    ],
    intermediate: [
      ex('Barbell squat', 4, 8, '40 to 65kg', 'Brace core, drive knees out on descent.'),
      ex('Romanian deadlift', 4, 10, '40 to 65kg', 'Bar stays close to legs. Hip hinge pattern.'),
      ex('Bulgarian split squat', 3, 10, '12 to 20kg each', 'Rear foot elevated. Front knee tracks over toes.'),
      ex('Hip thrust', 3, 12, '40 to 80kg', 'Bar padded on hip crease. Full hip extension at top.'),
      ex('Leg curl', 3, 12, '20 to 40kg', 'Control the curl. Pause at full contraction.'),
      ex('Calf raise', 4, 15, '20 to 40kg', 'All the way up, all the way down. No half reps.'),
    ],
    advanced: [
      ex('Barbell squat', 5, 5, '60 to 95kg', 'Controlled descent, explosive ascent. Brace hard.'),
      ex('Deadlift', 4, 5, '70 to 110kg', 'Set up tight. Bar against shins throughout.'),
      ex('Bulgarian split squat', 4, 8, '20 to 35kg each', 'Long stride. Controlled descent, drive through heel.'),
      ex('Hip thrust', 4, 10, '70 to 120kg', 'Full hip extension and glute squeeze at top.'),
      ex('Nordic hamstring curl', 3, 6, 'Bodyweight', 'Lower as slowly as you can with control; start with partial range and expect significant soreness at first. Builds eccentric hamstring strength and knee stability.'),
      ex('Leg press', 3, 12, '80 to 140kg', 'Full range. Maintain lower back contact with pad.'),
    ],
  },
}
