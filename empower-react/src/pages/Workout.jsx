// route /workout — activity picker, muscle group selector, guided workout player with timers and phase-adapted weights
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import BottomNav from '../components/BottomNav'
import TopBar from '../components/TopBar'
import Spinner from '../components/Spinner'

const ACTIVITIES = [
  { id:'walk', label:'Walk', icon:'ti-walk' },
  { id:'run', label:'Run', icon:'ti-run' },
  { id:'cycle', label:'Cycle', icon:'ti-bike' },
  { id:'swim', label:'Swim', icon:'ti-swimming' },
  { id:'gym', label:'Gym', icon:'ti-barbell' },
  { id:'yoga', label:'Yoga', icon:'ti-leaf' },
  { id:'pilates', label:'Pilates', icon:'ti-accessible' },
  { id:'hiit', label:'HIIT', icon:'ti-flame' },
  { id:'rest', label:'Rest day', icon:'ti-zzz' },
]

const MUSCLE_GROUPS = [
  { id:'full', label:'Full body', desc:'Every major muscle group in one session' },
  { id:'upper', label:'Upper body', desc:'Chest, shoulders, triceps, back, biceps' },
  { id:'lower', label:'Lower body', desc:'Quads, hamstrings, glutes, calves' },
]

const CUSTOM_MUSCLES = ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core']

const CARDIO_GUIDES = {
  walk: {
    Menstrual:      { duration:'20 to 30 min', pace:'Easy, conversational', note:'Movement reduces prostaglandins, and even 10 minutes makes a measurable difference. Keep the pace gentle.', science:'Gentle walking reduces prostaglandin-driven cramping. (Daley et al. 2015)' },
    Follicular:     { duration:'30 to 45 min', pace:'Brisk, purposeful', note:'Rising estrogen supports endurance. Push pace. This is one of your best cardio windows.', science:'Women rely more on fat oxidation, which supports steady aerobic work. (Hamadeh et al. 2005)' },
    'Late follicular':{ duration:'40 to 60 min', pace:'Fast, interval-friendly', note:'Try tempo intervals: 3 min fast, 2 min easy, repeat.', science:'Aerobic capacity changes little across the cycle, but recovery is strong now, so it is a good window to push.' },
    Ovulatory:      { duration:'30 to 60 min', pace:'Fast or interval', note:'A strong window for speed. Consider fartlek intervals, pushing hard for 1 min then recovering for 2 min.', science:'Strength tends to be highest in the follicular and ovulatory window. Push if you feel good, since individual variation is large. (Sarwar et al. 1996; Colenso-Semple et al. 2023)' },
    'Early luteal': { duration:'30 to 40 min', pace:'Moderate, steady', note:'Progesterone begins rising. Steady-state pace feels sustainable. Avoid pushing to max effort.', science:'Progesterone begins raising core temperature, so a steady pace can feel slightly harder. (Charkoudian and Stachenfeld 2014)' },
    'Mid luteal':   { duration:'20 to 30 min', pace:'Easy to moderate', note:'Core temperature is measurably higher. The same pace feels harder, and that is real physiology, not a lack of fitness.', science:'RHR elevated 1.7 bpm in mid-luteal. Perceived exertion is genuinely higher. (De Martin Topranin 2023)' },
    'Late luteal':  { duration:'20 to 30 min', pace:'Easy, gentle', note:'Keep it gentle. Walking is enough today. This is maintenance, not performance.', science:'With high cortisol and low serotonin, hard training compounds hormonal stress. (Hackney 2006)' },
    Luteal:         { duration:'25 to 35 min', pace:'Easy to moderate', note:'Progesterone elevates core temperature. Hydrate well and do not compare pace to your follicular numbers.', science:'Progesterone raises core temperature and delays sweating onset. (Charkoudian 2014)' },
    Perimenopause:  { duration:'30 to 45 min', pace:'Moderate, consistent', note:'Weight-bearing walking protects bone density. Aim for 30 minutes most days. Every session counts.', science:'Weight-bearing exercise maintains bone mineral density at any age. (Kohrt et al. 2004)' },
    observation:    { duration:'25 to 35 min', pace:'Comfortable', note:'Walk at a pace that feels good. Logging how it feels helps the algorithm learn your baseline.', science:'Consistent moderate exercise supports hormonal regulation. (Sims. ROAR 2024)' },
  },
  run: {
    Menstrual:      { duration:'15 to 25 min', pace:'Easy jog only', note:'If you run today, keep heart rate below 140 bpm. Walking intervals are completely fine and smart.', science:'High-intensity running during menstruation elevates cortisol and may worsen cramping. (Hackney 2006)' },
    Follicular:     { duration:'30 to 45 min', pace:'Comfortable to brisk', note:'Great time to build your base. Introduce longer efforts. Your recovery is faster than any other phase.', science:'Follicular phase muscle protein synthesis responds best to training load. (Kissow 2022)' },
    'Late follicular':{ duration:'35 to 50 min', pace:'Tempo or threshold', note:'Strong window for threshold work and longer efforts, since your recovery is high right now.', science:'Recovery is strong in the late follicular phase; aerobic capacity varies little across the cycle, so train to feel.' },
    Ovulatory:      { duration:'30 to 60 min', pace:'Tempo or intervals', note:'A strong window for speed. Try 800m repeats or a tempo run if you feel good.', science:'Strength tends to be highest in the follicular and ovulatory window. Push if you feel good, since individual variation is large. (Sarwar et al. 1996; Colenso-Semple et al. 2023)' },
    'Early luteal': { duration:'25 to 35 min', pace:'Steady, comfortable', note:'Progesterone is rising. Steady continuous running suits this phase. Save hard intervals for earlier in the cycle.', science:'Core temperature begins rising in early luteal. (Charkoudian and Stachenfeld 2014)' },
    'Mid luteal':   { duration:'20 to 30 min', pace:'Easy conversational', note:'Your body temperature is elevated. Drop pace by 10 to 15%. Do not chase your follicular splits.', science:'Core temperature is elevated 0.3 to 0.5 degrees in the luteal phase, so pace should reflect this. (Charkoudian 2014)' },
    'Late luteal':  { duration:'20 min', pace:'Easy jog', note:'Finishing the run is the goal today. Pace is irrelevant. You are maintaining, not building.', science:'Progesterone-cortisol competition means hard running creates a larger stress response. (Hackney 2006)' },
    Luteal:         { duration:'25 to 35 min', pace:'Easy to moderate', note:'Run to feel, not to pace. Hydrate more than usual, since progesterone delays sweating onset.', science:'Fluid regulation is altered in the luteal phase. Hydration needs increase. (Charkoudian 2014)' },
    Perimenopause:  { duration:'20 to 40 min', pace:'Comfortable intervals', note:'Run-walk intervals are excellent for bone density and joint protection. 3 min run, 2 min walk, repeat.', science:'Impact exercise is one of the most effective bone density interventions. (Kohrt et al. 2004)' },
    observation:    { duration:'20 to 30 min', pace:'Easy', note:'Easy pace. Log how your body feels. This builds your personal baseline data.', science:'Personal tracking outperforms population averages for training load decisions.' },
  },
  cycle: {
    Menstrual:      { duration:'20 to 30 min', pace:'Zone 2, easy spin', note:'Low resistance, easy cadence. Cycling is ideal during menstruation, since it is low impact and joint-friendly.', science:'Low-impact cycling does not aggravate cramping the way high-impact work can, and movement eases period pain. (Daley et al. 2015)' },
    Follicular:     { duration:'30 to 50 min', pace:'Zone 2 to 3', note:'Build your aerobic base. Increase resistance or include short climbs. Your recovery is excellent right now.', science:'Women rely more on fat oxidation, supporting aerobic base-building. (Hamadeh et al. 2005)' },
    'Late follicular':{ duration:'30 to 55 min', pace:'Zone 3, intervals', note:'Great window for harder intervals or a longer climb, since your recovery between efforts is strong.', science:'Recovery is strong in the late follicular phase; train to feel, capacity varies little across the cycle.' },
    Ovulatory:      { duration:'30 to 60 min', pace:'Zone 3 to 4 intervals', note:'A strong window for hard efforts. Try 3 min hard, 2 min easy intervals.', science:'Strength tends to be highest in the follicular and ovulatory window. Push if you feel good, since individual variation is large. (Sarwar et al. 1996; Colenso-Semple et al. 2023)' },
    'Early luteal': { duration:'25 to 40 min', pace:'Zone 2 to 3', note:'Still good energy. Steady endurance riding suits early luteal as core temperature starts to rise.', science:'Progesterone begins raising core temperature in early luteal. (Charkoudian and Stachenfeld 2014)' },
    'Mid luteal':   { duration:'25 to 35 min', pace:'Zone 2', note:'Keep resistance lower than usual. Your body is working harder than it looks. Elevated temperature and RHR are real.', science:'Resting HR elevated 1.7 bpm in mid-luteal. Same output costs more physiologically. (De Martin Topranin 2023)' },
    'Late luteal':  { duration:'20 to 30 min', pace:'Easy zone 2', note:'Keep it easy and low-pressure. Cycling is a gentle way to keep moving in the days before your period.', science:'Hormones drop in the late luteal phase and hard efforts carry a larger stress response. (Hackney 2006)' },
    Luteal:         { duration:'20 to 30 min', pace:'Easy zone 2', note:'Stay comfortable. Hydrate well, since the luteal phase alters fluid regulation. Low-pressure session today.', science:'Progesterone raises core temperature and ventilatory threshold drops. (Charkoudian 2014)' },
    Perimenopause:  { duration:'30 to 45 min', pace:'Comfortable pace', note:'Cycling is joint-friendly and weight-bearing enough to support bone. Excellent choice this phase.', science:'Low-impact aerobic exercise protects joints while supporting cardiovascular health in perimenopause. (Kohrt 2004)' },
    observation:    { duration:'25 to 40 min', pace:'Comfortable', note:'Ride to feel. Log any notes. This helps the algorithm understand your baseline capacity.', science:'Consistent moderate training supports hormonal health regardless of cycle tracking status. (Sims. ROAR 2024)' },
  },
  swim: {
    Menstrual:      { duration:'20 to 30 min', pace:'Easy laps', note:'Cool water may reduce prostaglandin activity and ease cramps. Excellent choice during menstruation.', science:'Aquatic exercise reduces menstrual pain. Cool water may modulate prostaglandin activity. (Daley 2015)' },
    Follicular:     { duration:'30 to 45 min', pace:'Build sets', note:'Great time for intervals, like 50m hard then 50m easy. Your recovery between sets will be faster this week.', science:'Recovery between sets is strong in the follicular phase; train to feel. (Kissow 2022)' },
    'Late follicular':{ duration:'30 to 50 min', pace:'Hard sets', note:'Strong window for speed and threshold sets, since your recovery between sets is excellent now.', science:'Recovery is strong in the late follicular phase; capacity varies little across the cycle, so train to feel.' },
    Ovulatory:      { duration:'30 to 50 min', pace:'Speed sets', note:'A strong window for hard efforts. Sprint intervals in the pool. Try 25m all-out with 60s rest, repeated 6 to 8 times.', science:'Strength tends to be highest in the follicular and ovulatory window. Push if you feel good, since individual variation is large. (Sarwar et al. 1996; Colenso-Semple et al. 2023)' },
    'Early luteal': { duration:'25 to 40 min', pace:'Steady', note:'Comfortable continuous swimming. The pool keeps you cool as core temperature starts to rise.', science:'Progesterone begins raising core temperature in early luteal; water aids cooling. (Charkoudian and Stachenfeld 2014)' },
    'Mid luteal':   { duration:'25 to 35 min', pace:'Steady, easy', note:'One of the best phases to swim, since the cool water directly offsets your elevated core temperature, so the same effort feels easier here than on land.', science:'Core temperature and RHR are measurably elevated in mid-luteal; external cooling helps. (De Martin Topranin 2023; Charkoudian and Stachenfeld 2014)' },
    'Late luteal':  { duration:'20 to 35 min', pace:'Easy laps', note:'Gentle, cooling, low-pressure. Swimming is an ideal way to keep moving in the days before your period.', science:'Hormones drop and stress sensitivity rises in late luteal; cool-water exercise is gentle on the system. (Hackney 2006)' },
    Luteal:         { duration:'25 to 35 min', pace:'Steady easy', note:'The coolness of the pool helps offset elevated core temperature. Great recovery tool this phase.', science:'External cooling helps manage the elevated core temperature of the luteal phase. (Charkoudian 2014)' },
    Perimenopause:  { duration:'25 to 45 min', pace:'Comfortable to brisk', note:'Excellent low-impact cardiovascular and joint-friendly option. Pair it with resistance training, which does the bone-loading swimming cannot.', science:'Swimming supports cardiovascular health with minimal joint load; weight-bearing or resistance work is needed separately for bone. (Kohrt et al. 2004)' },
    observation:    { duration:'20 to 35 min', pace:'Comfortable', note:'Swim to feel. Aquatic exercise is one of the most joint-friendly training options available.', science:'Water-based exercise reduces joint load while maintaining cardiovascular stimulus. (ACSM guidelines)' },
  },
}

const WARMUP_MOVES = {
  Menstrual:      ['Hip circles — 30 seconds each direction', 'Cat-cow — 10 reps', 'Bodyweight squat — 15 reps, slow', 'Arm circles and shoulder rolls — 30 seconds', 'Glute bridge — 15 reps', 'Leg swings — 10 each side'],
  Follicular:     ['Hip circles — 30 seconds', 'Leg swings front and back — 10 each side', 'Inchworm to push-up — 5 reps', 'Lateral lunge — 8 each side', 'Arm circles — 30 seconds', 'Jump squat — 10 reps (light)'],
  'Late follicular':['Dynamic lunge with reach — 8 each side', 'Hip circles — 30 seconds', 'Band walk — 15 each direction', 'Push-up — 10 reps', 'Leg swing — 10 each side', 'Light squat jump — 10 reps'],
  Ovulatory:      ['Hip circles — 30 seconds', 'Leg swings — 10 each side', 'Lateral band walk — 20 each direction', 'Dynamic lunge with reach — 8 each side', 'Glute bridge — 15 reps', 'Bodyweight squat — 12 reps', 'Inchworm to push-up — 5 reps', 'Jump squat — 8 reps (last, after full prep)'],
  'Early luteal': ['Cat-cow — 10 reps', 'Hip circles — 30 seconds', 'Bodyweight squat — 15 reps', 'Glute bridge — 15 reps', 'Shoulder circles — 30 seconds', 'Light lateral lunge — 8 each side'],
  'Mid luteal':   ['Cat-cow — 10 reps slow', 'Hip circles — 30 seconds', 'Glute bridge — 15 reps', 'Arm circles — 30 seconds', 'Bodyweight squat — 10 reps slow', 'Deep breathing — 5 slow breaths'],
  'Late luteal':  ['Cat-cow — 10 reps', 'Hip circles — 30 seconds', 'Glute bridge — 15 reps gentle', 'Arm swing — 30 seconds', 'Slow bodyweight squat — 10 reps', 'Child\'s pose — 30 seconds'],
  Luteal:         ['Hip circles — 30 seconds', 'Cat-cow — 10 reps', 'Glute bridge — 15 reps', 'Arm circles — 30 seconds', 'Lateral lunge — 6 each side', 'Light jump — 10 small hops'],
  Perimenopause:  ['Hip circles — 30 seconds', 'Cat-cow — 10 reps', 'Glute bridge — 15 reps', 'Lateral band walk — 15 each direction', 'Arm circles — 30 seconds', 'Balance stand — 20 seconds each leg'],
  observation:    ['Hip circles — 30 seconds', 'Cat-cow — 10 reps', 'Bodyweight squat — 12 reps', 'Arm circles — 30 seconds', 'Glute bridge — 12 reps', 'Leg swing — 8 each side'],
}

const YOGA_SEQUENCES = {
  Menstrual:      ['Supported child\'s pose — hold 2 minutes', 'Reclined butterfly — hold 90 seconds', 'Cat-cow — 10 slow breath cycles', 'Supine twist — 90 seconds each side', 'Legs up the wall — hold 3 minutes', 'Savasana — 5 minutes'],
  Follicular:     ['Cat-cow warm-up — 10 cycles', 'Sun salutation A — 3 rounds', 'Warrior I — 5 breaths each side', 'Warrior II — 5 breaths each side', 'Triangle pose — 5 breaths each side', 'Downward dog — 1 minute', 'Pigeon pose — 90 seconds each side', 'Savasana — 5 minutes'],
  Ovulatory:      ['Sun salutation A — 5 rounds', 'Warrior I and II flow — 3 rounds', 'Dancer\'s pose — 5 breaths each side', 'Side plank — 30 seconds each side', 'Camel pose — 5 breaths', 'Seated forward fold — 1 minute', 'Supine twist — 1 minute each side', 'Savasana — 5 minutes'],
  'Early luteal': ['Cat-cow — 10 cycles', 'Crescent lunge — 5 breaths each side', 'Tree pose — 5 breaths each side', 'Seated twist — 5 breaths each side', 'Yin dragon pose — 2 minutes each side', 'Child\'s pose — 2 minutes', 'Savasana — 5 minutes'],
  'Mid luteal':   ['Gentle cat-cow — 10 cycles', 'Supported child\'s pose — 2 minutes', 'Supine knee to chest — 1 minute each side', 'Reclined butterfly — 2 minutes', 'Legs up the wall — 3 minutes', 'Savasana — 5 minutes'],
  'Late luteal':  ['Child\'s pose — 2 minutes', 'Gentle cat-cow — 10 cycles', 'Yin forward fold — 2 minutes', 'Reclined spinal twist — 2 minutes each side', 'Supported bridge — 2 minutes', 'Legs up the wall — 3 minutes', 'Savasana — 5 minutes'],
  Luteal:         ['Cat-cow — 10 cycles', 'Supported child\'s pose — 2 minutes', 'Hip flexor lunge — 90 seconds each side', 'Seated forward fold — 90 seconds', 'Supine twist — 90 seconds each side', 'Legs up the wall — 3 minutes', 'Savasana — 5 minutes'],
  Perimenopause:  ['Cat-cow — 10 cycles', 'Sun salutation A — 2 rounds, slow', 'Warrior I — 5 breaths each side', 'Balance tree pose — 5 breaths each side', 'Seated forward fold — 2 minutes', 'Supine twist — 90 seconds each side', 'Savasana — 5 minutes'],
  observation:    ['Cat-cow — 10 cycles', 'Downward dog — 1 minute', 'Warrior I — 5 breaths each side', 'Seated forward fold — 90 seconds', 'Supine twist — 90 seconds each side', 'Legs up the wall — 2 minutes', 'Savasana — 5 minutes'],
}

const PILATES_SEQUENCES = {
  Menstrual:      ['Pelvic tilts — 15 reps, gentle', 'Knee folds — 10 each side', 'Supine leg circles — 8 each direction each side', 'Single knee hug — 30 seconds each side', 'Shell stretch — hold 60 seconds', 'Roll-down against wall — 5 slow reps'],
  Follicular:     ['Hundred — full 100 breaths', 'Roll-up — 8 reps', 'Single leg circles — 8 each direction each side', 'Rolling like a ball — 10 reps', 'Single leg stretch — 10 alternating', 'Criss-cross — 10 alternating', 'Plank hold — 30 seconds', 'Mermaid stretch — 60 seconds each side'],
  Ovulatory:      ['Hundred — 100 breaths, vigorous', 'Roll-up — 8 reps', 'Double leg stretch — 10 reps', 'Criss-cross — 15 alternating', 'Side kick series — 10 each side', 'Swimming — 30 seconds', 'Side plank — 30 seconds each side', 'Plank — 45 seconds'],
  'Early luteal': ['Hundred — 80 breaths', 'Roll-up — 6 reps', 'Spine stretch forward — 8 reps', 'Single leg stretch — 10 alternating', 'Hip circles — 8 each direction', 'Mermaid stretch — 60 seconds each side', 'Shell stretch — 60 seconds'],
  'Mid luteal':   ['Pelvic tilts — 15 reps', 'Knee folds — 10 each side', 'Modified hundred — 60 breaths', 'Spine stretch — 8 reps', 'Hip circles — 8 each direction', 'Mermaid stretch — 90 seconds each side', 'Shell stretch — 90 seconds'],
  'Late luteal':  ['Pelvic tilts — 12 reps, slow', 'Cat stretch — 10 cycles', 'Knee folds — 10 each side', 'Side lying leg lift — 12 each side', 'Mermaid stretch — 2 minutes each side', 'Shell stretch — 2 minutes'],
  Luteal:         ['Hundred — 80 breaths', 'Roll-up — 6 reps', 'Single leg circles — 8 each direction', 'Spine stretch — 8 reps', 'Side kick — 10 each side', 'Mermaid — 90 seconds each side', 'Shell stretch — 90 seconds'],
  Perimenopause:  ['Hundred — 80 breaths', 'Roll-up — 6 reps', 'Spine stretch — 8 reps', 'Side kick series — 10 each side', 'Plank — 30 seconds', 'Swimming — 20 seconds', 'Mermaid stretch — 90 seconds each side'],
  observation:    ['Hundred — 80 breaths', 'Roll-up — 8 reps', 'Single leg stretch — 10 alternating', 'Criss-cross — 10 alternating', 'Spine stretch — 8 reps', 'Mermaid stretch — 60 seconds each side', 'Shell stretch — 60 seconds'],
}

// Simple how-to descriptions for warmup exercises — matched by move name prefix
const WARMUP_DESCRIPTIONS = {
  'Hip circles':               'Stand feet shoulder-width, hands on hips. Rotate your hips in a wide circle — 30 seconds one direction, then reverse. Keep your upper body still and let the movement come entirely from your hips.',
  'Cat-cow':                   'On hands and knees, wrists under shoulders, knees under hips. Inhale and drop your belly toward the floor, lift your head and tailbone (cow). Exhale and round your spine upward, tuck chin and tailbone (cat). Move slowly with your breath.',
  'Bodyweight squat':          'Stand feet shoulder-width, toes slightly out. Lower your hips back and down as if sitting into a chair. Keep chest up, knees tracking over toes, heels flat. Drive through heels to stand.',
  'Slow bodyweight squat':     'Same as a bodyweight squat but take 3 to 4 seconds on the way down. Focus on keeping your knees tracking over your toes the whole way.',
  'Light squat jump':          'Squat down to about half depth, then drive through your heels for a small jump. Land softly with bent knees, absorbing impact through your legs. Keep it light during warmup.',
  'Jump squat':                'Squat down, then drive through your heels to jump off the ground. Land softly with bent knees. Go lighter and lower than a working squat to protect your joints.',
  'Arm circles':               'Stand tall with arms extended out to your sides. Make 10 small circles forward, then 10 large circles forward. Reverse direction. Keep shoulders relaxed and down.',
  'Shoulder circles':          'Roll both shoulders backward in a slow circle 10 times, then forward 10 times. Focus on the full range — up, back, down, forward.',
  'Arm swing':                 'Stand feet shoulder-width. Swing both arms across your chest then open them wide, rotating your torso with the swing. Keep a soft bend in your knees.',
  'Arm swing and rotation':    'Stand feet shoulder-width. Swing both arms across your chest then open them wide, rotating your torso with the swing. Keep a soft bend in your knees.',
  'Glute bridge':              'Lie on your back, knees bent, feet hip-width, arms at sides. Press heels into the floor and lift your hips until your body forms a straight line from knees to shoulders. Squeeze glutes at the top, hold one second, then lower slowly.',
  'Leg swings':                'Stand holding a wall for balance. Swing one leg forward and back from the hip, keeping the knee soft. Start small and gradually increase range over 10 reps. Switch sides.',
  'Leg swing':                 'Stand holding a wall for balance. Swing one leg forward and back from the hip, keeping the knee soft. Start small and gradually increase range over 10 reps. Switch sides.',
  'Inchworm':                  'Stand tall, hinge forward and walk your hands out to a plank position. Pause for a breath, then walk your feet toward your hands keeping legs as straight as comfortable. Stand and repeat.',
  'Inchworm to push-up':       'Walk hands out to a plank, do one push-up, then walk feet back to hands and stand. Keep your core tight throughout.',
  'Lateral lunge':             'Stand with feet together. Step one foot wide to the side and lower your hips into that leg, keeping the other leg straight. Knee tracks over your toes. Push off to return. Alternate sides.',
  'Light lateral lunge':       'Same as a lateral lunge but use a shorter step and shallower depth. Keep the movement controlled and pain-free.',
  'Dynamic lunge with reach':  'Step forward into a lunge, then reach your opposite arm toward the ground beside your front foot. Drive back to standing. Alternate sides. Combines hip mobility and hamstring lengthening.',
  'Lateral band walk':         'Place a resistance band around your ankles or just above your knees. Bend slightly into an athletic squat. Step sideways maintaining band tension throughout. Keep toes pointing forward.',
  'Band walk':                 'Place a resistance band around your ankles or just above your knees. Bend slightly into an athletic squat. Step sideways maintaining band tension throughout. Keep toes pointing forward.',
  'Push-up':                   'Hands shoulder-width, body in one straight line from head to heels. Lower chest toward the floor, elbows at 45 degrees from your body. Press back up. Modify on knees if needed for warmup.',
  'Nordic curl':               'Kneel with feet anchored under something heavy. Slowly lower your upper body toward the floor, controlling the descent with your hamstrings. Catch yourself with your hands before hitting the floor. Drive back up.',
  'Child\'s pose':             'Kneel and sit back on your heels, then fold forward with arms extended. Let your forehead rest on the mat. Breathe slowly and let your lower back and hips relax completely.',
  'Balance stand':             'Stand on one foot with a soft bend in the standing knee. Hold still for the full duration, then switch. For extra challenge, close your eyes.',
  'Deep breathing':            'Stand or sit comfortably. Inhale slowly through your nose for 4 counts, belly first then chest. Hold for one count. Exhale slowly through your mouth for 6 counts. This activates your parasympathetic nervous system.',
  'Light jump':                'Stand feet hip-width. Do small light hops on the balls of your feet, barely leaving the ground. Keep knees soft. Focus on quick light contact with the floor.',
}

const YOGA_DESCRIPTIONS = {
  'Supported child\'s pose':    'Kneel and sit back toward your heels, then fold forward with arms extended or resting alongside your body. Place a pillow under your torso or forehead for support. Let your lower back and hips completely release. Breathe slowly into your back body.',
  'Child\'s pose':              'Kneel and sit back on your heels, then fold forward with arms extended. Let your forehead rest on the mat. Breathe slowly and let your lower back and hips relax completely.',
  'Reclined butterfly':         'Lie on your back and bring the soles of your feet together, letting your knees fall out to the sides. Place one hand on your chest and one on your belly. Close your eyes and breathe — this pose gently opens the inner thighs and hips.',
  'Cat-cow':                    'On hands and knees, wrists under shoulders, knees under hips. Inhale and drop your belly toward the floor, lift your head and tailbone (cow). Exhale and round your spine upward, tuck chin and tailbone (cat). Move slowly with your breath.',
  'Gentle cat-cow':             'Same as cat-cow but with a smaller range of motion. Move only as far as feels comfortable with no tension in your low back.',
  'Supine twist':               'Lie on your back. Draw one knee to your chest, then guide it across your body to the opposite side, letting your hips rotate. Extend that arm out to the side. Keep both shoulders on the mat. Stay for the full time, then switch sides.',
  'Reclined spinal twist':      'Lie on your back. Draw one knee to your chest, then guide it across your body to the opposite side, letting your hips rotate. Extend that arm out to the side. Keep both shoulders on the mat. Stay for the full time, then switch sides.',
  'Legs up the wall':           'Sit with one hip touching a wall, then swing your legs up and lie back, resting your legs straight up the wall. Arms relax at your sides. This is one of the most restorative poses — it reverses blood flow and calms the nervous system.',
  'Savasana':                   'Lie flat on your back, arms slightly away from your sides, palms facing up. Close your eyes and let your body become completely still. This is not sleep — it is conscious rest. Let the practice integrate.',
  'Sun salutation A':           'A flowing sequence: standing mountain pose, arms up, forward fold, half lift, step back to plank, lower through chaturanga, upward dog, downward dog, step forward, half lift, fold, arms up, stand. Move with your breath. Inhale to extend, exhale to fold.',
  'Warrior I':                  'Step one foot back about a metre. Back foot turns out 45 degrees, front knee bends to 90 degrees and tracks over the ankle. Hips square forward. Arms rise overhead. Gaze forward or up. Press through the outer edge of the back foot.',
  'Warrior II':                 'Feet wide apart, front foot points forward, back foot turns out. Front knee bends to 90 degrees tracking over the ankle. Arms extend parallel to the floor in opposite directions. Gaze over your front middle finger. Sink your hips.',
  'Triangle pose':              'Stand wide, feet parallel. Turn front foot out. Reach forward over the front leg, then lower your hand to your shin, a block, or the floor. Top arm reaches toward the ceiling. Both legs stay straight. Open your chest upward.',
  'Downward dog':               'From hands and knees, tuck toes and press your hips up and back, forming an inverted V. Hands shoulder-width, feet hip-width. Press heels toward the floor. Lengthen your spine. Relax your head between your arms.',
  'Pigeon pose':                'From downward dog, bring one knee forward behind your wrist, shin angled across the mat. Lower the back leg flat. Hinge forward over the front leg as far as comfortable. This deeply stretches the hip rotators. Hold for the full time before switching.',
  'Dancer\'s pose':             'Stand on one foot. Bend the other knee and reach back to hold your foot or ankle. Hinge forward slightly while pressing your lifted foot into your hand, extending that leg back and up. Reach your free arm forward for balance.',
  'Side plank':                 'From a plank, rotate onto one hand and the outer edge of that foot, stacking feet or placing the lower knee down. Lift your hips to form a straight line. Top arm reaches up. Hold steady, then switch sides.',
  'Camel pose':                 'Kneel with knees hip-width, thighs vertical. Place hands on your lower back for support. Gently arch back, opening your chest upward. If comfortable, reach back to hold your heels. Keep your hips directly over your knees.',
  'Seated forward fold':        'Sit with legs extended. Hinge from your hips and reach toward your feet, holding your shins, ankles, or feet. Keep your spine long rather than rounding. Breathe into your hamstrings and let them gradually release.',
  'Yin forward fold':           'Sit with legs extended. Let gravity do the work — release all muscular effort and round forward passively. Support your forehead on a pillow if needed. Stay completely passive for the full hold.',
  'Crescent lunge':             'Step one foot forward into a lunge, back knee on the mat. Press your hips down and forward until you feel a stretch in the front of the back hip. Raise both arms overhead and lift your chest. Hold for the set time, then switch sides.',
  'Tree pose':                  'Stand on one foot. Place the sole of the other foot on your inner calf or inner thigh — not directly on the knee. Hands at heart or arms overhead. Fix your gaze on a still point to help with balance.',
  'Balance tree pose':          'Stand on one foot. Place the sole of the other foot on your inner calf or inner thigh — not directly on the knee. Hands at heart or arms overhead. Fix your gaze on a still point to help with balance. Balance training is especially valuable for long-term health.',
  'Seated twist':               'Sit tall with legs crossed or extended. Place one hand on the opposite knee and the other hand behind you. On an exhale, rotate your spine in the direction of your back hand. Keep your spine long rather than collapsing. Switch sides.',
  'Yin dragon pose':            'Step one foot forward between your hands and lower the back knee to the mat. Walk the front foot out slightly wider than the hip. Lower both forearms to the mat inside the front foot. Let your hips sink toward the floor. This is an intense hip opener — stay passive and breathe.',
  'Supported bridge':           'Lie on your back, knees bent, feet hip-width. Press into your feet and lift your hips. Place a yoga block or firm pillow under your sacrum (the flat bone at the base of your spine) and let your weight rest on the support. This is passive and deeply restorative.',
  'Hip flexor lunge':           'Step one foot forward into a lunge, back knee on the mat. Tuck your tailbone under slightly and gently press your hips forward until you feel the stretch in the front of the back hip. Hold for the set time, then switch sides.',
}

const PILATES_DESCRIPTIONS = {
  'Pelvic tilts':               'Lie on your back, knees bent, feet flat. Gently flatten your lower back against the mat by tilting your pelvis, then release back to neutral. This is a small, controlled movement. Focus on engaging your deep abdominal muscles rather than using momentum.',
  'Knee folds':                 'Lie on your back, knees bent, feet flat. Keeping your core engaged and your back still, lift one foot off the mat and bring the knee toward your chest without letting your pelvis tilt. Lower and alternate. This builds deep core stability.',
  'Supine leg circles':         'Lie on your back. Lift one leg toward the ceiling. Draw small circles in the air with your foot — the movement comes from the hip socket, not the knee. Keep your core engaged and your pelvis completely still on the mat.',
  'Single knee hug':            'Lie on your back and draw one knee into your chest with both hands. Keep the other leg extended or slightly raised. Hold for the set time. This gently releases the low back and hip flexor.',
  'Shell stretch':              'Kneel and sit back on your heels, then fold forward completely with arms alongside your body, palms up. Let your spine round fully. This is the Pilates version of child\'s pose, a complete release.',
  'Roll-down against wall':     'Stand with your back against a wall, heels a few centimetres away. Tuck your chin, then slowly peel your spine away from the wall one vertebra at a time until you are hanging forward. Then slowly re-stack each vertebra back to the wall on the way up.',
  'Hundred':                    'Lie on your back. Lift your head, shoulders, and legs to a low hover. Arms hover just above the mat alongside your body. Pump your arms in a small, controlled pulsing motion — 5 counts inhale, 5 counts exhale. One hundred total arm pumps. Modify by keeping knees bent if your lower back lifts off the mat.',
  'Roll-up':                    'Lie flat, arms overhead. Inhale to prepare, then exhale and slowly peel your spine off the mat one vertebra at a time, reaching toward your feet. Inhale at the top. Exhale to roll back down slowly, controlling each vertebra. Never use momentum.',
  'Single leg circles':         'Lie on your back, one leg extended to the ceiling. Draw a circle with your whole leg from the hip socket — clockwise, then counterclockwise. Keep the circle small enough that your pelvis stays completely still on the mat.',
  'Rolling like a ball':        'Sit with knees drawn to your chest, hands holding your shins, feet hovering. Rock back onto your shoulder blades on an exhale, then inhale to roll back up to balance. Never roll onto your neck. Keep the shape compact throughout.',
  'Single leg stretch':         'Lie on your back, head and shoulders lifted. Draw one knee to your chest while the other leg extends out at a low diagonal. Switch legs with a quick, controlled alternating pulse. Exhale for every 2 switches.',
  'Criss-cross':                'Lie on your back, hands behind your head, legs in tabletop. Rotate your upper body, bringing one elbow toward the opposite knee while the other leg extends. Alternate sides in a controlled, deliberate rhythm. Do not pull on your neck.',
  'Double leg stretch':         'Lie on your back, head and shoulders lifted, knees drawn to your chest. Inhale and extend your arms overhead and legs out to a diagonal simultaneously. Exhale and circle your arms back as you draw your knees to your chest again.',
  'Plank hold':                 'From hands and knees, extend your legs back one at a time, balancing on your hands and toes. Body forms a straight line from head to heels. Engage your core, squeeze your glutes lightly, breathe steadily. Modify on your knees if needed.',
  'Plank':                      'From hands and knees, extend your legs back one at a time, balancing on your hands and toes. Body forms a straight line from head to heels. Engage your core, squeeze your glutes lightly, breathe steadily.',
  'Modified hundred':           'Same as the Hundred but with knees bent and feet on the mat, reducing the load on your lower back. Focus on the breath rhythm and the deep abdominal connection rather than the intensity.',
  'Spine stretch forward':      'Sit tall with legs extended wide apart. Inhale to prepare, then exhale and reach your arms forward as you round your spine forward and down, drawing your navel in. Inhale to sit back up. This is a flexion exercise — keep it slow and controlled.',
  'Spine stretch':              'Sit tall with legs extended wide apart. Inhale to prepare, then exhale and reach your arms forward as you round your spine forward and down, drawing your navel in. Inhale to sit back up.',
  'Hip circles':                'Sit in Pilates V position with hands behind you for support. Lift your legs slightly. Draw circles with your knees — first one direction, then the other. Keep your torso as still as possible. The movement comes from your hips.',
  'Mermaid stretch':            'Sit with your legs folded to one side. Reach the top arm up and over toward the opposite side, creating a long side stretch. Hold for the set time. Switch sides. Keep both sitting bones on the mat.',
  'Side kick series':           'Lie on your side, body in one straight line. Lift the top leg to hip height. Kick it forward with a pointed toe, then sweep it back with a flexed foot. Keep your core engaged so your torso stays completely still throughout.',
  'Swimming':                   'Lie on your stomach, arms extended overhead. Simultaneously lift your arms, chest, and legs slightly off the mat. Flutter your opposite arm and leg in small alternating pulses, as if swimming. Inhale for 5 counts, exhale for 5. Keep your neck long.',
  'Side plank':                 'From a plank, rotate onto one hand and the outer edge of that foot, or lower the bottom knee for support. Lift your hips to form a straight line. Top arm reaches up. Hold steady, then switch sides.',
  'Cat stretch':                'On hands and knees, wrists under shoulders, knees under hips. Round your spine upward fully on an exhale (like an angry cat). Hold for a breath, then slowly release back to neutral. Repeat. This releases the low back and activates deep abdominals.',
  'Side lying leg lift':        'Lie on your side with your body in a straight line. Stack your hips and keep your core engaged. Lift the top leg to just above hip height on an exhale, then lower slowly on an inhale. Keep your pelvis completely still — only the leg moves.',
  'Modified push-up on knees':  'Hands shoulder-width, knees on the mat, body in a straight line from knees to head. Lower your chest toward the floor, elbows at 45 degrees from your body. Press back up.',
}

const HIIT_ROUNDS = {
  Menstrual:      { rounds:3, work:25, rest:35, exercises:['Low-impact march in place','Step touch side to side','Gentle squat, no jump','Standing knee lift','Standing side crunch'] },
  Follicular:     { rounds:5, work:40, rest:20, exercises:['Jump squat','High knees sprint','Push-up','Lateral shuffle','Plank hold'] },
  'Late follicular':{ rounds:6, work:40, rest:20, exercises:['Burpee','Sprint in place','Jump lunge','Push-up jump','Plank to pike'] },
  Ovulatory:      { rounds:6, work:40, rest:20, exercises:['Burpee','Box jump or jump squat','High knees sprint','Jump lunge','Mountain climber','Plank push-up'] },
  'Early luteal': { rounds:4, work:35, rest:25, exercises:['Squat jump','High knees','Push-up','Lateral shuffle','Plank'] },
  'Mid luteal':   { rounds:3, work:30, rest:30, exercises:['Step-up or low squat','Marching in place','Push-up','Side lunge','Plank hold'] },
  'Late luteal':  { rounds:3, work:25, rest:35, exercises:['Bodyweight squat','Step touch','Modified push-up','Standing core twist','Gentle plank'] },
  Luteal:         { rounds:3, work:30, rest:30, exercises:['Squat, no jump','Step touch','Push-up','Lateral lunge','Plank hold'] },
  Perimenopause:  { rounds:3, work:30, rest:30, exercises:['Step-up','Modified high knees','Push-up on knees','Lateral lunge','Plank hold'] },
  observation:    { rounds:3, work:30, rest:30, exercises:['Squat','High knees','Push-up','Lateral shuffle','Plank'] },
}

// Extra, phase-appropriate HIIT moves rotated in for day-to-day variety. Low-impact
// options for menstrual/luteal phases; explosive options for follicular/ovulatory.
const HIIT_POOL = {
  Menstrual:        ['Heel taps','Standing oblique crunch','Slow reverse lunge','Bird-dog','Toe-touch march'],
  Follicular:       ['Skater hops','Reverse lunge to knee drive','Plank shoulder taps','Speed squat','Tuck jump — low'],
  'Late follicular':['Squat to press','Broad jump — controlled','Burpee to tuck','Plank jack','Speed mountain climber'],
  Ovulatory:        ['Squat to press','Broad jump','Burpee to tuck','Skater bound','Plank jack','Speed mountain climber'],
  'Early luteal':   ['Reverse lunge','Plank shoulder taps','Speed squat','Step-up','Skater step'],
  'Mid luteal':     ['Step-up','Slow reverse lunge','Bird-dog','Glute bridge march','Standing side crunch'],
  'Late luteal':    ['Marching in place','Slow squat','Standing knee lift','Bird-dog','Heel taps'],
  Luteal:           ['Step-up','Slow reverse lunge','Standing knee lift','Glute bridge march'],
  Perimenopause:    ['Step-up','Reverse lunge','Glute bridge march','Wall press-up','Standing knee lift'],
  observation:      ['Reverse lunge','Step-up','Plank shoulder taps','Skater step'],
}

function ex(name, sets, reps, weight, tip) { return { name, sets, reps, weight, tip } }

function getSvgType(name) {
  const n = name.toLowerCase()
  if (n.includes('squat') || n.includes('goblet')) return 'squat'
  if (n.includes('deadlift')) return 'hinge'
  if (n.includes('bench press') || n.includes('push-up')) return 'push'
  if (n.includes('row') && !n.includes('pull')) return 'row'
  if (n.includes('overhead press') || n.includes('shoulder press')) return 'press'
  if (n.includes('lunge') || n.includes('split squat')) return 'lunge'
  if (n.includes('hip thrust') || n.includes('glute bridge')) return 'thrust'
  if (n.includes('pull-up') || n.includes('pull up') || n.includes('chin')) return 'pullup'
  if (n.includes('curl') && !n.includes('calf')) return 'curl'
  if (n.includes('plank')) return 'plank'
  if (n.includes('calf')) return 'calf'
  return 'stand'
}

function getMuscles(name) {
  const n = name.toLowerCase()
  if (n.includes('goblet squat') || n.includes('barbell squat')) return 'Quads, glutes, core'
  if (n.includes('romanian deadlift') || n.includes('rdl')) return 'Hamstrings, glutes, lower back'
  if (n.includes('deadlift')) return 'Hamstrings, glutes, lower back, traps'
  if (n.includes('bench press')) return 'Chest, triceps, front delts'
  if (n.includes('push-up')) return 'Chest, triceps, shoulders'
  if (n.includes('barbell row')) return 'Back, biceps, rear delts'
  if (n.includes('dumbbell row')) return 'Back, biceps'
  if (n.includes('cable row')) return 'Back, biceps'
  if (n.includes('overhead press') || n.includes('shoulder press')) return 'Shoulders, triceps, core'
  if (n.includes('face pull') || n.includes('lateral raise')) return 'Rear delts, rotator cuff'
  if (n.includes('bulgarian split squat')) return 'Quads, glutes, hamstrings'
  if (n.includes('walking lunge')) return 'Quads, glutes, hamstrings'
  if (n.includes('hip thrust')) return 'Glutes, hamstrings'
  if (n.includes('glute bridge')) return 'Glutes, hamstrings'
  if (n.includes('leg press')) return 'Quads, glutes'
  if (n.includes('leg curl')) return 'Hamstrings'
  if (n.includes('bicep curl') || (n.includes('curl') && !n.includes('calf'))) return 'Biceps'
  if (n.includes('tricep')) return 'Triceps'
  if (n.includes('dip')) return 'Triceps, chest'
  if (n.includes('pull-up') || n.includes('pull up')) return 'Back, biceps'
  if (n.includes('plank')) return 'Core, shoulders'
  if (n.includes('nordic')) return 'Hamstrings'
  if (n.includes('calf')) return 'Calves'
  if (n.includes('band pull-apart')) return 'Rear delts, rotator cuff'
  if (n.includes('incline')) return 'Upper chest, triceps, front delts'
  return 'Multiple muscle groups'
}

function getEquipment(name) {
  const n = name.toLowerCase()
  if (n.includes('barbell') || n.includes('bar')) return 'Barbell'
  if (n.includes('dumbbell')) return 'Dumbbells'
  if (n.includes('cable')) return 'Cable machine'
  if (n.includes('band')) return 'Resistance band'
  if (n.includes('leg press')) return 'Leg press machine'
  if (n.includes('leg curl')) return 'Machine'
  if (n.includes('push-up') || n.includes('plank') || n.includes('nordic') || n.includes('dip')) return 'Bodyweight'
  if (n.includes('goblet')) return 'Dumbbell or kettlebell'
  if (n.includes('hip thrust') || n.includes('glute bridge')) return 'Barbell or dumbbell'
  if (n.includes('walking lunge') || n.includes('split squat')) return 'Dumbbells or bodyweight'
  if (n.includes('calf')) return 'Bodyweight or dumbbell'
  return 'Barbell or dumbbells'
}

function getPhases(svgType) {
  const P = {
    squat:   [{ label:'Start position', desc:'Feet shoulder-width, bar across upper traps. Brace your core hard before descending.' },
               { label:'Lower / working phase', desc:'Push knees out over toes, sit hips down. Keep chest up and core tight.' },
               { label:'Finish position', desc:'Drive through heels to standing. Hips and shoulders rise at the same rate.' }],
    hinge:   [{ label:'Start position', desc:'Standing tall, soft knee bend, bar or dumbbells close to thighs, lats engaged.' },
               { label:'Lower / working phase', desc:'Push hips back and hinge forward. Feel the hamstrings loading as the weight descends.' },
               { label:'Finish position', desc:'Drive hips forward to standing, squeezing glutes at the top.' }],
    push:    [{ label:'Start position', desc:'Retract shoulder blades into the bench. Bar positioned over lower chest. Feet flat on floor.' },
               { label:'Lower / working phase', desc:'Control the descent. Bar touches mid-chest, elbows at 45 degrees from body.' },
               { label:'Finish position', desc:'Drive bar straight up. Full extension at top without locking out elbows.' }],
    row:     [{ label:'Start position', desc:'Hinge at hips to 45 degrees. Shoulder blades back, core braced, arms straight.' },
               { label:'Lower / working phase', desc:'Lower the weight with control. Let arms fully extend — full range matters.' },
               { label:'Finish position', desc:'Pull bar or dumbbell to lower ribs. Lead with elbow. Squeeze shoulder blades together.' }],
    press:   [{ label:'Start position', desc:'Bar at collar-bone height. Grip shoulder-width, elbows slightly forward of bar.' },
               { label:'Lower / working phase', desc:'Controlled descent back to collar-bone. Maintain core brace throughout.' },
               { label:'Finish position', desc:'Press bar straight up. Head moves slightly back to clear path. Lock out overhead.' }],
    lunge:   [{ label:'Start position', desc:'Upright torso, front foot flat. Back foot raised on bench for split squat.' },
               { label:'Lower / working phase', desc:'Lower back knee toward the floor. Front knee tracks over toes — not past foot.' },
               { label:'Finish position', desc:'Press through front heel to return. Squeeze glutes and stand fully tall.' }],
    thrust:  [{ label:'Start position', desc:'Upper back on bench, bar padded across hip crease. Feet flat, shoulder-width.' },
               { label:'Lower / working phase', desc:'Lower hips slowly toward floor. Maintain control — do not drop.' },
               { label:'Finish position', desc:'Drive hips up until body is a straight line from knees to shoulders. Hard glute squeeze.' }],
    pullup:  [{ label:'Start position', desc:'Full dead hang from bar. Hands shoulder-width or slightly wider. Core engaged.' },
               { label:'Lower / working phase', desc:'Lower slowly to full hang after each rep. No kipping or swinging.' },
               { label:'Finish position', desc:'Drive elbows down and back. Pull until chin clears the bar.' }],
    curl:    [{ label:'Start position', desc:'Arms fully extended at sides. Elbows pinned close to ribs throughout the movement.' },
               { label:'Lower / working phase', desc:'Lower slowly to full extension. The eccentric is where muscle is built.' },
               { label:'Finish position', desc:'Curl the weight up to shoulder height. Squeeze at the top.' }],
    plank:   [{ label:'Start position', desc:'Forearms flat, elbows directly under shoulders. Body in a straight line.' },
               { label:'Lower / working phase', desc:'Brace core hard. Hips level — not raised or sagging. Breathe normally.' },
               { label:'Finish position', desc:'Hold for the full duration. Quality of position over time.' }],
    calf:    [{ label:'Start position', desc:'Stand with balls of feet on edge of a step or flat on the floor.' },
               { label:'Lower / working phase', desc:'Lower heels all the way down — feel the full stretch in the calf.' },
               { label:'Finish position', desc:'Rise onto toes as high as possible. Pause at the top before lowering.' }],
    stand:   [{ label:'Start position', desc:'Controlled starting position. Brace your core before initiating the movement.' },
               { label:'Lower / working phase', desc:'Move through the full range of motion with control.' },
               { label:'Finish position', desc:'Return to start with control. Do not rush the descent.' }],
  }
  return P[svgType] || P.stand
}

function StickFigure({ type }) {
  const s = { stroke:'#2c2820', strokeWidth:3, strokeLinecap:'round', fill:'none' }
  const bar = { stroke:'#c8b89a', strokeWidth:5, strokeLinecap:'round' }
  const floor = { stroke:'#c8b89a', strokeWidth:3, strokeLinecap:'round' }
  const figures = {
    squat: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <line x1="82" y1="72" x2="158" y2="72" {...bar}/>
      <circle cx="120" cy="44" r="16" {...s}/>
      <line x1="120" y1="60" x2="120" y2="72" {...s}/>
      <line x1="120" y1="72" x2="118" y2="118" {...s}/>
      <line x1="118" y1="118" x2="88" y2="144" {...s}/>
      <line x1="118" y1="118" x2="148" y2="144" {...s}/>
      <line x1="88" y1="144" x2="85" y2="162" {...s}/>
      <line x1="148" y1="144" x2="151" y2="162" {...s}/>
      <line x1="113" y1="75" x2="97" y2="72" {...{...s,strokeWidth:2.5}}/>
      <line x1="127" y1="75" x2="143" y2="72" {...{...s,strokeWidth:2.5}}/>
    </svg>,
    hinge: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <circle cx="82" cy="46" r="16" {...s}/>
      <line x1="88" y1="58" x2="148" y2="110" {...s}/>
      <line x1="148" y1="110" x2="133" y2="162" {...s}/>
      <line x1="148" y1="110" x2="157" y2="162" {...s}/>
      <line x1="99" y1="70" x2="110" y2="148" {...{...s,strokeWidth:2.5}}/>
      <line x1="116" y1="76" x2="124" y2="148" {...{...s,strokeWidth:2.5}}/>
      <line x1="94" y1="150" x2="138" y2="150" {...bar}/>
    </svg>,
    push: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <rect x="38" y="118" width="165" height="10" rx="4" fill="#e8dfd0" stroke="#c8b89a" strokeWidth="2"/>
      <circle cx="65" cy="92" r="16" {...s}/>
      <line x1="80" y1="98" x2="158" y2="105" {...s}/>
      <line x1="90" y1="100" x2="90" y2="62" {...{...s,strokeWidth:2.5}}/>
      <line x1="120" y1="102" x2="120" y2="62" {...{...s,strokeWidth:2.5}}/>
      <line x1="70" y1="62" x2="165" y2="62" {...bar}/>
      <line x1="158" y1="105" x2="175" y2="118" {...s}/>
      <line x1="168" y1="107" x2="185" y2="118" {...s}/>
    </svg>,
    row: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <circle cx="75" cy="50" r="16" {...s}/>
      <line x1="82" y1="62" x2="145" y2="108" {...s}/>
      <line x1="145" y1="108" x2="130" y2="162" {...s}/>
      <line x1="145" y1="108" x2="158" y2="162" {...s}/>
      <line x1="95" y1="74" x2="108" y2="106" {...{...s,strokeWidth:2.5}}/>
      <line x1="112" y1="80" x2="122" y2="110" {...{...s,strokeWidth:2.5}}/>
      <line x1="92" y1="108" x2="130" y2="110" {...bar}/>
    </svg>,
    press: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <circle cx="120" cy="40" r="16" {...s}/>
      <line x1="120" y1="56" x2="120" y2="112" {...s}/>
      <line x1="120" y1="112" x2="105" y2="162" {...s}/>
      <line x1="120" y1="112" x2="135" y2="162" {...s}/>
      <line x1="112" y1="68" x2="86" y2="44" {...{...s,strokeWidth:2.5}}/>
      <line x1="128" y1="68" x2="154" y2="44" {...{...s,strokeWidth:2.5}}/>
      <line x1="73" y1="38" x2="167" y2="38" {...bar}/>
    </svg>,
    lunge: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <circle cx="105" cy="42" r="16" {...s}/>
      <line x1="105" y1="58" x2="108" y2="112" {...s}/>
      <line x1="108" y1="112" x2="88" y2="138" {...s}/>
      <line x1="88" y1="138" x2="78" y2="162" {...s}/>
      <line x1="108" y1="112" x2="148" y2="130" {...s}/>
      <line x1="148" y1="130" x2="162" y2="162" {...s}/>
      <line x1="98" y1="68" x2="84" y2="106" {...{...s,strokeWidth:2.5}}/>
      <line x1="118" y1="68" x2="132" y2="106" {...{...s,strokeWidth:2.5}}/>
    </svg>,
    thrust: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <rect x="35" y="104" width="62" height="12" rx="4" fill="#e8dfd0" stroke="#c8b89a" strokeWidth="2"/>
      <circle cx="68" cy="88" r="16" {...s}/>
      <line x1="82" y1="95" x2="148" y2="100" {...s}/>
      <line x1="148" y1="100" x2="158" y2="145" {...s}/>
      <line x1="152" y1="100" x2="168" y2="145" {...s}/>
      <line x1="158" y1="145" x2="148" y2="162" {...s}/>
      <line x1="168" y1="145" x2="175" y2="162" {...s}/>
      <line x1="118" y1="100" x2="178" y2="102" {...bar}/>
    </svg>,
    pullup: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="55" y1="22" x2="185" y2="22" {...bar}/>
      <circle cx="120" cy="54" r="16" {...s}/>
      <line x1="120" y1="70" x2="120" y2="120" {...s}/>
      <line x1="120" y1="120" x2="108" y2="162" {...s}/>
      <line x1="120" y1="120" x2="132" y2="162" {...s}/>
      <line x1="112" y1="58" x2="96" y2="22" {...{...s,strokeWidth:2.5}}/>
      <line x1="128" y1="58" x2="144" y2="22" {...{...s,strokeWidth:2.5}}/>
    </svg>,
    curl: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <circle cx="120" cy="42" r="16" {...s}/>
      <line x1="120" y1="58" x2="120" y2="112" {...s}/>
      <line x1="120" y1="112" x2="108" y2="162" {...s}/>
      <line x1="120" y1="112" x2="132" y2="162" {...s}/>
      <line x1="112" y1="68" x2="90" y2="90" {...{...s,strokeWidth:2.5}}/>
      <line x1="90" y1="90" x2="76" y2="72" {...{...s,strokeWidth:2.5}}/>
      <line x1="128" y1="68" x2="150" y2="90" {...{...s,strokeWidth:2.5}}/>
      <line x1="150" y1="90" x2="164" y2="72" {...{...s,strokeWidth:2.5}}/>
    </svg>,
    plank: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <circle cx="55" cy="94" r="16" {...s}/>
      <line x1="70" y1="102" x2="182" y2="120" {...s}/>
      <line x1="80" y1="104" x2="75" y2="130" {...{...s,strokeWidth:2.5}}/>
      <line x1="96" y1="107" x2="91" y2="133" {...{...s,strokeWidth:2.5}}/>
      <line x1="182" y1="120" x2="183" y2="155" {...{...s,strokeWidth:2.5}}/>
      <line x1="176" y1="119" x2="177" y2="154" {...{...s,strokeWidth:2.5}}/>
    </svg>,
    calf: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="80" y1="162" x2="160" y2="162" {...floor}/>
      <circle cx="120" cy="34" r="16" {...s}/>
      <line x1="120" y1="50" x2="120" y2="104" {...s}/>
      <line x1="120" y1="104" x2="108" y2="148" {...s}/>
      <line x1="120" y1="104" x2="132" y2="148" {...s}/>
      <line x1="108" y1="148" x2="100" y2="162" {...s}/>
      <line x1="132" y1="148" x2="140" y2="162" {...s}/>
      <line x1="112" y1="58" x2="95" y2="102" {...{...s,strokeWidth:2.5}}/>
      <line x1="128" y1="58" x2="145" y2="102" {...{...s,strokeWidth:2.5}}/>
    </svg>,
    stand: <svg viewBox="0 0 240 175" style={{width:'100%',height:'100%'}}>
      <line x1="30" y1="162" x2="210" y2="162" {...floor}/>
      <circle cx="120" cy="42" r="16" {...s}/>
      <line x1="120" y1="58" x2="120" y2="112" {...s}/>
      <line x1="120" y1="112" x2="108" y2="162" {...s}/>
      <line x1="120" y1="112" x2="132" y2="162" {...s}/>
      <line x1="112" y1="68" x2="95" y2="112" {...{...s,strokeWidth:2.5}}/>
      <line x1="128" y1="68" x2="145" y2="112" {...{...s,strokeWidth:2.5}}/>
    </svg>,
  }
  return figures[type] || figures.stand
}

const EXERCISES = {
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
      ex('Bench press', 4, 8, '30 to 50kg', 'Retract shoulder blades. Bar to mid-chest, press straight up.'),
      ex('Barbell row', 4, 8, '30 to 50kg', 'Hinge to 45°. Pull bar to lower ribs. Control the descent.'),
      ex('Romanian deadlift', 4, 10, '40 to 65kg', 'Bar stays close to legs. Stop when hips are fully extended.'),
      ex('Overhead press', 3, 10, '25 to 40kg', 'Brace core hard. Press bar in straight line overhead.'),
      ex('Cable face pull', 3, 15, '10 to 20kg', 'Pull to face level, elbows high. Rear delt and rotator cuff.'),
    ],
    advanced: [
      ex('Barbell squat', 5, 5, '60 to 90kg', 'Control the descent. Explosive drive on the way up.'),
      ex('Bench press', 5, 5, '50 to 75kg', 'Tight arch, shoulder blades pulled together. Full range.'),
      ex('Deadlift', 4, 5, '70 to 110kg', 'Brace hard before pulling. Bar stays against your shins.'),
      ex('Barbell row', 4, 6, '50 to 75kg', 'Horizontal torso. Pull explosively, lower with control.'),
      ex('Overhead press', 4, 6, '35 to 55kg', 'Lock out at top. Full range, no hip drive.'),
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
      ex('Bench press', 4, 8, '30 to 50kg', 'Retract shoulder blades. Control the descent.'),
      ex('Barbell row', 4, 8, '30 to 50kg', 'Hinge at hips, pull bar to lower ribs.'),
      ex('Overhead press', 3, 10, '25 to 40kg', 'Strict press. Brace core throughout.'),
      ex('Cable row', 3, 12, '25 to 45kg', 'Sit tall. Pull handle to lower chest, squeeze.'),
      ex('Dumbbell lateral raise', 3, 12, '6 to 12kg each', 'Slight lean forward. Lead with elbows, not wrists.'),
      ex('Tricep pushdown', 3, 12, '15 to 30kg', 'Elbows pinned to ribs. Full extension at bottom.'),
    ],
    advanced: [
      ex('Bench press', 5, 5, '50 to 75kg', 'Tight setup. Drive feet into floor. Full range.'),
      ex('Weighted pull-up', 4, 6, '5 to 20kg added', 'Full hang to chin over bar. No kipping.'),
      ex('Overhead press', 4, 6, '35 to 55kg', 'No hip drive. Lock out overhead.'),
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

// Accessory pools rotated into the last 2 slots of a gym session for variety. The
// main compound lifts (first 4 of each EXERCISES list) stay fixed for progression.
// Only exercises the demo-metadata helpers already recognise are used here.
const GYM_ACCESSORIES = {
  upper: [
    ex('Dumbbell lateral raise', 3, 14, '5 to 12kg each', 'Slight forward lean, lead with your elbows. Pause at shoulder height.'),
    ex('Bicep curl', 3, 12, '6 to 12kg each', 'No swinging. Squeeze at the top, lower with control.'),
    ex('Tricep dip', 3, 12, 'Bodyweight', 'Hands on a bench, lower until your elbows reach 90 degrees.'),
    ex('Face pull', 3, 15, '12 to 25kg', 'Pull to face level, elbows high and wide. Rear delts and rotator cuff.'),
    ex('Incline dumbbell press', 3, 10, '10 to 22kg each', '30 degree bench. Press up and slightly together, control the descent.'),
    ex('Cable row', 3, 12, '25 to 45kg', 'Sit tall, pull the handle to your lower chest, squeeze.'),
  ],
  lower: [
    ex('Walking lunge', 3, 12, 'Bodyweight to 12kg each', 'Long stride, front knee tracks over the toes, torso tall.'),
    ex('Hip thrust', 3, 12, '30 to 70kg', 'Shoulders on a bench, drive through the heels, full hip extension.'),
    ex('Leg curl', 3, 12, '15 to 35kg', 'Control the curl, pause at full contraction, lower slowly.'),
    ex('Glute bridge', 3, 15, 'Bodyweight to 20kg', 'Drive your hips up, squeeze your glutes at the top, hold one second.'),
    ex('Calf raise', 3, 15, '15 to 40kg', 'Full range, all the way up and all the way down. No half reps.'),
    ex('Bulgarian split squat', 3, 10, '8 to 18kg each', 'Rear foot elevated, front knee tracks over the toes.'),
  ],
  full: [
    ex('Dumbbell shoulder press', 3, 10, '6 to 14kg each', 'Press straight up, brace your core, lower slowly.'),
    ex('Dumbbell row', 3, 12, '8 to 16kg each', 'Brace on a bench, drive your elbow back and up, squeeze.'),
    ex('Goblet squat', 3, 12, '8 to 20kg', 'Hold the weight at your chest, sit deep, elbows inside the knees.'),
    ex('Glute bridge', 3, 15, 'Bodyweight to 20kg', 'Drive your hips up, squeeze at the top, hold one second.'),
    ex('Plank', 3, 40, 'Bodyweight', '40 seconds. Hips level, brace your core, do not let your back sag.'),
    ex('Face pull', 3, 15, '12 to 25kg', 'Pull to face level, elbows high and wide. Rear delts.'),
  ],
}

const FEEL_OPTIONS = ['Felt strong','Felt average','Felt hard','Rest day','Skipped']

const CLASS_TYPES = [
  { id:'swim', label:'Swim', icon:'ti-swimming' },
  { id:'cycle', label:'Cycle', icon:'ti-bike' },
  { id:'pilates', label:'Pilates', icon:'ti-accessible' },
  { id:'yoga', label:'Yoga', icon:'ti-leaf' },
  { id:'gym', label:'Gym', icon:'ti-barbell' },
  { id:'run', label:'Run', icon:'ti-run' },
  { id:'hiit', label:'HIIT', icon:'ti-flame' },
  { id:'other', label:'Other', icon:'ti-activity' },
]

const PHASE_BANNER = {
  Menstrual:      { bg:'#3d2830', text:'#f5e8e8', note:'Lower intensity today is smart, not lazy. Prostaglandins and low estrogen are doing real physiological work. (Hackney 2006)' },
  Follicular:     { bg:'#2c3828', text:'#e8f5e8', note:'Rising estrogen supports muscle protein synthesis and recovery. Research suggests late follicular may produce stronger adaptations. (Kissow et al. 2022)' },
  Ovulatory:      { bg:'#2c3035', text:'#e8f0f8', note:'Peak estrogen and a small testosterone rise, so you may feel unusually strong. Complete your full warmup today: knee ligament laxity is measurably higher around ovulation, which raises ACL injury risk. (Herzberg et al. 2017)' },
  'Early luteal': { bg:'#352c20', text:'#f5ede0', note:'Progesterone rising with a mild calming GABA effect. Good steady energy still available. Solid phase for focused progress. (Bäckström et al. 2014)' },
  'Mid luteal':   { bg:'#352c20', text:'#f5ede0', note:'RHR is measurably higher and recovery is slower. The same weight costs more physiologically. That is real biology, not lack of fitness. (De Martin Topranin et al. 2023)' },
  'Late luteal':  { bg:'#352c20', text:'#f5ede0', note:'Both hormones dropping. Progesterone-cortisol competition means hard training creates a larger stress response than usual. Completing your sets cleanly is the goal. (Hackney 2006)' },
  Luteal:         { bg:'#352c20', text:'#f5ede0', note:'Progesterone elevated and core temperature rising. Prioritise form and completing sets over adding weight. (De Martin Topranin et al. 2023)' },
  Perimenopause:  { bg:'#2c2035', text:'#f0e8f8', note:'Lift heavy. Training at challenging loads builds bone and preserves muscle safely, where light high-rep work does not. In the LIFTMOR trial, postmenopausal women did 5 sets of 5 near their limit. This is the single highest-value thing you can do for your long-term health. (Watson et al. LIFTMOR, JBMR 2018; Kohrt et al. 2004)' },
  observation:    { bg:'#2c2820', text:'#f5f0e8', note:'Building your personal baseline. Log how every session feels. Individual variation is large and your data is more useful than population averages.' },
}

// Phase content lookup: use the exact sub-phase if the dictionary has it, otherwise
// fall back to the base phase (Follicular/Luteal) before observation. This stops real
// cycle phases the dictionaries don't key directly — chiefly 'Early follicular', and
// any luteal sub-phase a given dictionary omits — from silently dropping to generic
// observation content.
function pc(dict, ph) {
  if (!dict) return null
  if (ph && dict[ph]) return dict[ph]
  const base = ph && ph.includes('follicular') ? 'Follicular'
    : ph && ph.includes('luteal') ? 'Luteal'
    : null
  if (base && dict[base]) return dict[base]
  return dict.observation
}

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Deterministic day-based rotation for workout variety. Using the calendar day (not
// Math.random) keeps the selection STABLE within a session/day — critical because the
// gym player tracks set completion by exercise index, so the list must not reshuffle
// mid-session — while varying day to day.
function daySeed() {
  const d = new Date()
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}
function rotatePick(pool, n, seed) {
  if (!pool || pool.length <= n) return pool || []
  const start = ((seed % pool.length) + pool.length) % pool.length
  const out = []
  for (let i = 0; i < n; i++) out.push(pool[(start + i) % pool.length])
  return out
}
// HIIT: keep the phase's structure (rounds/work/rest) but rotate which exercises are
// shown from an expanded, phase-appropriate pool, keeping the same number of moves.
function hiitFor(ph) {
  const base = pc(HIIT_ROUNDS, ph)
  if (!base) return base
  const poolKey = HIIT_POOL[ph] ? ph
    : ph && ph.includes('follicular') ? 'Follicular'
    : ph && ph.includes('luteal') ? 'Luteal'
    : 'observation'
  const seen = new Set()
  const pool = [...base.exercises, ...(HIIT_POOL[poolKey] || [])].filter(x => {
    if (seen.has(x)) return false; seen.add(x); return true
  })
  return { ...base, exercises: rotatePick(pool, base.exercises.length, daySeed()) }
}

export default function Workout() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [screen, setScreen] = useState('pick') // pick | muscles | warmup | plan | checklist | feel | done | logClass
  const [checkedMoves, setCheckedMoves] = useState({})
  const [activity, setActivity] = useState(null)
  const [muscleGroup, setMuscleGroup] = useState(null)
  const [customMuscles, setCustomMuscles] = useState([])
  const [fitnessLevel, setFitnessLevel] = useState('intermediate')
  const [feel, setFeel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [classType, setClassType] = useState(null)
  const [classDuration, setClassDuration] = useState('')
  const [playerIdx, setPlayerIdx] = useState(0)
  const [setWeights, setSetWeights] = useState({}) // { exIdx: { setIdx: weight } }
  const [playerDone, setPlayerDone] = useState({}) // { exIdx: { setIdx: true } }
  const [phaseOpen, setPhaseOpen] = useState(false)
  const [expandedWarmupMove, setExpandedWarmupMove] = useState(null)
  const [expandedChecklistMove, setExpandedChecklistMove] = useState(null)
  const [cardioSeconds, setCardioSeconds] = useState(0)
  const [cardioRunning, setCardioRunning] = useState(false)
  const [restSecondsLeft, setRestSecondsLeft] = useState(0)
  const [hiitRound, setHiitRound] = useState(1)
  const [hiitExIdx, setHiitExIdx] = useState(0)
  const [hiitPhase, setHiitPhase] = useState('work')
  const [hiitSecondsLeft, setHiitSecondsLeft] = useState(0)
  const [hiitRunning, setHiitRunning] = useState(false)

  // Declared before useEffects so it is in scope for the HIIT dependency array.
  // Resolve the phase used for workout content: perimenopause/postmenopause users
  // (status.phase === 'Perimenopause') use the Perimenopause content rather than their
  // stage subPhase, which the dictionaries are not keyed by; hormonal-BC users have no
  // cycle-specific workout content, so they use the neutral observation content.
  const rawPhase = status?.phase
  const phase = rawPhase === 'Perimenopause' ? 'Perimenopause'
    : (rawPhase === 'bc-combined' || rawPhase === 'bc-progestin') ? 'observation'
    : status?.subPhase || rawPhase || 'observation'

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (!cardioRunning) return
    const id = setInterval(() => setCardioSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [cardioRunning])

  useEffect(() => {
    if (restSecondsLeft <= 0) return
    const id = setInterval(() => setRestSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [restSecondsLeft])

  useEffect(() => {
    if (!hiitRunning) return
    if (hiitSecondsLeft <= 0) {
      const data = hiitFor(phase)
      if (hiitPhase === 'work') {
        setHiitPhase('rest')
        setHiitSecondsLeft(data.rest)
      } else {
        const nextEx = hiitExIdx + 1
        if (nextEx < data.exercises.length) {
          setHiitExIdx(nextEx)
          setHiitPhase('work')
          setHiitSecondsLeft(data.work)
        } else {
          const nextRound = hiitRound + 1
          if (nextRound <= data.rounds) {
            setHiitRound(nextRound)
            setHiitExIdx(0)
            setHiitPhase('work')
            setHiitSecondsLeft(data.work)
          } else {
            setHiitRunning(false)
            setScreen('feel')
          }
        }
      }
      return
    }
    const id = setTimeout(() => setHiitSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [hiitRunning, hiitSecondsLeft, hiitPhase, hiitExIdx, hiitRound, phase])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const s = await getTodayStatus(supabase, user.id)
      setStatus(s)
      if (s?.profile?.fitness_level) setFitnessLevel(s.profile.fitness_level === 'beginner' ? 'beginner' : s.profile.fitness_level === 'advanced' || s.profile.fitness_level === 'athlete' ? 'advanced' : 'intermediate')
    } catch(e) {}
    setLoading(false)
  }

  function getPhaseWeightNote(exWeight, intensityModifier, phaseVal) {
    if (!exWeight) return null
    const lower = exWeight.toLowerCase()
    if (lower === 'bodyweight' || lower.startsWith('bodyweight or') || lower === 'light band') return null
    const m = exWeight.match(/(\d+)\s*to\s*(\d+)/)
    if (!m) return null
    const lo = parseInt(m[1])
    const hi = parseInt(m[2])
    const mid = (lo + hi) / 2
    const raw = mid * intensityModifier
    const suggested = Math.round(raw / 2.5) * 2.5
    const clamped = Math.max(lo, Math.min(hi, suggested))
    // The intensity-based notes below describe natural cycle physiology (elevated RHR,
    // progesterone-cortisol load). Birth control, perimenopause, and observation users
    // share those intensity values coincidentally but are NOT in a luteal phase, so use
    // neutral wording for them rather than misattributing cycle physiology.
    if (phaseVal === 'Perimenopause') {
      return { weight: `${clamped}kg`, note: 'Load is the priority now. Lifting heavy, meaning a weight where the last 2 reps are genuinely hard, directly builds bone and preserves muscle as estrogen declines, which light high-rep work does not. Progress the weight as you get stronger.', source: 'Watson et al. LIFTMOR trial, JBMR 2018; Kohrt et al. MSSE 2004' }
    }
    const CYCLE_PHASES = ['Menstrual','Follicular','Ovulatory','Early luteal','Mid luteal','Late luteal','Luteal']
    if (!CYCLE_PHASES.includes(phaseVal)) {
      return { weight: `${clamped}kg`, note: 'Train to how you feel today. Individual variation is large, so let your energy and form guide your load.', source: 'Colenso-Semple et al. 2023 Frontiers' }
    }
    if (intensityModifier >= 1.0) {
      return { weight: `${clamped}kg`, note: 'Peak estrogen and testosterone phase. Aim toward the top of your range if you feel strong. Individual variation is large, so your body is the primary guide.', source: 'Kissow et al. 2022 Sports Medicine; Colenso-Semple et al. 2023 Frontiers' }
    } else if (intensityModifier >= 0.90) {
      return { weight: `${clamped}kg`, note: 'Good energy available. Mid-range weights with solid form. Recovery is still strong this phase.', source: 'Kissow et al. 2022 Sports Medicine' }
    } else if (intensityModifier >= 0.80) {
      return { weight: `${clamped}kg`, note: 'RHR is measurably elevated and recovery is slower. The same weight costs more physiologically right now. That is real biology.', source: 'De Martin Topranin et al. 2023 IJSPP' }
    } else {
      return { weight: `${clamped}kg`, note: 'Lower load today is appropriate. Progesterone-cortisol competition makes hard training carry a larger hormonal cost. Completing sets cleanly is the goal.', source: 'Hackney 2006 JSSM' }
    }
  }

  function selectActivity(id) {
    setActivity(id)
    setCheckedMoves({})
    if (id === 'gym') setScreen('muscles')
    else setScreen('plan')
  }

  function getExercises() {
    const key = muscleGroup === 'custom' ? (customMuscles.some(m => ['Chest','Shoulders','Triceps'].includes(m)) ? 'upper' : customMuscles.some(m => ['Quads','Hamstrings','Glutes','Calves'].includes(m)) ? 'lower' : 'full') : (muscleGroup || 'full')
    const base = EXERCISES[key]?.[fitnessLevel] || EXERCISES.full.intermediate
    // Keep the main compound lifts (first 4) fixed for progression; rotate the
    // remaining accessory slots day to day from an expanded pool. Deterministic by
    // date, so the list stays stable within a session.
    const core = base.slice(0, 4)
    const coreNames = new Set(core.map(e => e.name))
    const seen = new Set()
    const accPool = [...base.slice(4), ...(GYM_ACCESSORIES[key] || [])].filter(e => {
      if (coreNames.has(e.name) || seen.has(e.name)) return false
      seen.add(e.name); return true
    })
    return core.concat(rotatePick(accPool, base.length - core.length, daySeed()))
  }

  async function save() {
    if (!feel) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('daily_logs').upsert({
        user_id: user.id, log_date: localDateStr(), workout_feel: feel
      }, { onConflict: 'user_id,log_date' })
      if (error) throw error
      setScreen('done')
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function saveClass() {
    if (!classType) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const notes = classDuration ? `${CLASS_TYPES.find(c=>c.id===classType)?.label} class, ${classDuration} min` : `${CLASS_TYPES.find(c=>c.id===classType)?.label} class`
    await supabase.from('daily_logs').upsert({
      user_id: user.id, log_date: localDateStr(), workout_feel: 'Felt average', notes
    }, { onConflict: 'user_id,log_date' })
    setScreen('done')
    setSaving(false)
  }

  if (loading) return <div style={{ paddingTop:60 }}><Spinner /></div>

  const intensity = status?.intensityModifier ?? 1.0
  const banner = pc(PHASE_BANNER, phase)
  const isAcl = phase === 'Ovulatory' && (activity === 'gym' || activity === 'hiit')
  const isHiitWarn = (phase === 'Mid luteal' || phase === 'Late luteal') && activity === 'hiit'
  const workoutReadiness = status?.workoutReadiness || null
  const rawProtein = status?.nutritionTargets?.proteinG
  const isVeganWorkout = (() => { try { const d = status?.profile?.diet_preference; if (!d) return false; const p = JSON.parse(d); return Array.isArray(p) ? p.includes('vegan') : p === 'vegan' } catch { return status?.profile?.diet_preference === 'vegan' } })()
  const protein = rawProtein ? (isVeganWorkout ? Math.round(rawProtein * 1.15) : rawProtein) : null

  // DONE screen
  if (screen === 'done') return (
    <div style={{ padding:'60px 20px', textAlign:'center' }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🌿</div>
      <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:22, marginBottom:8 }}>Workout complete.</div>
      <div style={{ fontSize:14, color:'#7a7268', marginBottom:32, lineHeight:1.6 }}>
        {feel === 'Felt strong' ? 'You showed up and felt strong. That is what consistency looks like.' :
         feel === 'Felt average' ? 'Solid session. Consistent average beats inconsistent great every time.' :
         feel === 'Felt hard' ? 'You did it even when it was hard. That is the real win.' :
         'Rest is part of training. Your body rebuilds during recovery.'}
      </div>
      {protein && <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:24, fontSize:13, color:'#3a3530', lineHeight:1.6 }}><strong style={{ display:'block', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>Post-workout</strong>Aim for <strong>{protein}g protein</strong> today, spread across your meals. A 20 to 40g serving within a couple of hours of training supports recovery, but your total protein for the day matters more than exact timing.</div>}
      <button className="btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
    </div>
  )

  // ACTIVITY PICKER
  if (screen === 'pick') return (
    <div style={{ paddingBottom:100 }}>
      <TopBar title="WORKOUT" backTo="/dashboard" />
      <div style={{ background:`linear-gradient(135deg, ${banner.bg}, ${banner.bg}cc)`, padding:'18px 16px', marginBottom:16 }}>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, color:banner.text, marginBottom:4 }}>{phase}</div>
        <div style={{ fontSize:12, color:banner.text, opacity:0.8, lineHeight:1.6 }}>{banner.note}</div>
        <div style={{ fontSize:11, color:banner.text, opacity:0.6, marginTop:4 }}>Intensity guide: {Math.round(intensity * 100)}% of your max effort today</div>
        {workoutReadiness && <div style={{ fontSize:11, color:banner.text, background:'rgba(255,255,255,0.12)', borderRadius:8, padding:'6px 10px', marginTop:6, lineHeight:1.5 }}>{workoutReadiness}</div>}
      </div>
      <div style={{ padding:'0 16px' }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:12, display:'block' }}>What are you doing today?</span>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
          {ACTIVITIES.map(a => (
            <div key={a.id} onClick={() => selectActivity(a.id)} style={{
              padding:'16px 8px', borderRadius:14, border:'1px solid #ede8e0',
              background:'#fff', cursor:'pointer', textAlign:'center',
              boxShadow:'0 1px 4px rgba(44,40,32,0.04)',
            }}>
              {a.emoji
                ? <span style={{ fontSize:26, display:'block', marginBottom:6 }}>{a.emoji}</span>
                : <i className={`ti ${a.icon}`} style={{ fontSize:26, display:'block', marginBottom:6, color:'#c8b89a' }} />
              }
              <div style={{ fontSize:12, fontWeight:500, color:'#2c2820' }}>{a.label}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <button onClick={() => setScreen('logClass')} style={{ background:'none', border:'1px solid #ede8e0', borderRadius:20, padding:'7px 18px', fontSize:13, color:'#7a7268', cursor:'pointer', fontFamily:'inherit' }}>
            <i className="ti ti-plus" style={{ fontSize:13, marginRight:5 }} />Log a class
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  )

  // MUSCLE GROUP PICKER (gym only)
  if (screen === 'muscles') return (
    <div style={{ paddingBottom:100 }}>
      <TopBar title="WORKOUT" backTo={() => setScreen('pick')} />
      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, marginBottom:4 }}>Choose your focus</div>
        <div style={{ fontSize:13, color:'#7a7268', marginBottom:20 }}>Your exercises will be chosen for your phase and fitness level.</div>

        {MUSCLE_GROUPS.map(g => (
          <div key={g.id} onClick={() => { setMuscleGroup(g.id); setCustomMuscles([]) }} style={{
            padding:'16px', borderRadius:12, border:`1px solid ${muscleGroup===g.id?'#c8b89a':'#ede8e0'}`,
            background:muscleGroup===g.id?'#e8dfd0':'#fff', cursor:'pointer', marginBottom:10,
          }}>
            <div style={{ fontSize:14, fontWeight:600 }}>{g.label}</div>
            <div style={{ fontSize:12, color:'#7a7268', marginTop:2 }}>{g.desc}</div>
          </div>
        ))}

        {/* Custom — dashed */}
        <div onClick={() => { setMuscleGroup('custom') }} style={{
          padding:'16px', borderRadius:12, border:`2px dashed ${muscleGroup==='custom'?'#c8b89a':'#ede8e0'}`,
          background:muscleGroup==='custom'?'#e8dfd0':'transparent', cursor:'pointer', marginBottom:16,
        }}>
          <div style={{ fontSize:14, fontWeight:600 }}>Custom</div>
          <div style={{ fontSize:12, color:'#7a7268', marginTop:2 }}>Build your own session</div>
        </div>

        {muscleGroup === 'custom' && (
          <div style={{ marginBottom:16 }}>
            <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10, display:'block' }}>Select muscle groups</span>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {CUSTOM_MUSCLES.map(m => {
                const on = customMuscles.includes(m)
                return (
                  <div key={m} onClick={() => setCustomMuscles(p => on ? p.filter(x=>x!==m) : [...p,m])} style={{
                    padding:'10px 12px', borderRadius:10, border:`1px solid ${on?'#c8b89a':'#ede8e0'}`,
                    background:on?'#e8dfd0':'#fff', cursor:'pointer', fontSize:13, fontWeight:on?600:400,
                    color:on?'#5a4a3a':'#2c2820',
                  }}>{m}</div>
                )
              })}
            </div>
          </div>
        )}

        <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10, display:'block' }}>Fitness level</span>
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {['beginner','intermediate','advanced'].map(l => (
            <button key={l} onClick={() => setFitnessLevel(l)} style={{
              flex:1, padding:'10px 0', borderRadius:10, border:`1px solid ${fitnessLevel===l?'#c8b89a':'#ede8e0'}`,
              background:fitnessLevel===l?'#e8dfd0':'#fff', fontSize:12, fontWeight:fitnessLevel===l?600:400,
              color:fitnessLevel===l?'#5a4a3a':'#2c2820', cursor:'pointer', fontFamily:'inherit',
              textTransform:'capitalize',
            }}>{l}</button>
          ))}
        </div>

        <button className="btn-primary"
          disabled={!muscleGroup || (muscleGroup==='custom' && customMuscles.length===0)}
          onClick={() => { setCheckedMoves({}); setScreen('warmup') }}>
          Show my workout
        </button>
      </div>
      <BottomNav />
    </div>
  )

  // GYM WARMUP SCREEN
  if (screen === 'warmup') {
    const moves = pc(WARMUP_MOVES, phase)
    const totalDone = moves.filter((_, i) => checkedMoves[i]).length
    return (
      <div style={{ paddingBottom:100 }}>
        <TopBar title="WORKOUT" backTo={() => setScreen('muscles')} />
        <div style={{ padding:'16px 16px 0' }}>
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, marginBottom:2 }}>Warmup</div>
          <div style={{ fontSize:12, color:'#9a9590', marginBottom:14 }}>{moves.length} movements, tick each as you go</div>

          {isAcl && (
            <div style={{ background:'#fff8e6', border:'1px solid #f0c040', borderRadius:12, padding:14, marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:'#6a4a00' }}>Your warmup matters more today</div>
              <div style={{ fontSize:12, color:'#7a6020', lineHeight:1.6 }}>Peak estrogen increases ligament laxity. Complete all warmup exercises before loading any weight.</div>
            </div>
          )}

          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, marginBottom:12, overflow:'hidden' }}>
            <div style={{ padding:'10px 16px', borderBottom:'1px solid #f5f0e8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>Warmup for {phase}</div>
              <div style={{ fontSize:12, color:'#9a9590' }}>{totalDone}/{moves.length}</div>
            </div>
            {moves.map((move, i) => {
              const moveName = move.split(' —')[0].split(' —')[0]
              const descKey = Object.keys(WARMUP_DESCRIPTIONS).find(k => moveName.toLowerCase().startsWith(k.toLowerCase()))
              const desc = descKey ? WARMUP_DESCRIPTIONS[descKey] : null
              const isExpanded = expandedWarmupMove === i
              return (
                <div key={i} style={{ borderBottom:i<moves.length-1?'1px solid #f5f0e8':'none', background:checkedMoves[i]?'#f8f5f0':'#fff' }}>
                  <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
                    <div onClick={() => setCheckedMoves(p => ({...p, [i]: !p[i]}))} style={{ width:22, height:22, borderRadius:11, border:`2px solid ${checkedMoves[i]?'#2c2820':'#c8c0b8'}`, background:checkedMoves[i]?'#2c2820':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer' }}>
                      {checkedMoves[i] && <div style={{ width:6, height:6, borderRadius:'50%', background:'#f5f0e8' }} />}
                    </div>
                    <div onClick={() => setCheckedMoves(p => ({...p, [i]: !p[i]}))} style={{ flex:1, fontSize:13, color:checkedMoves[i]?'#9a9590':'#2c2820', textDecoration:checkedMoves[i]?'line-through':'none', lineHeight:1.5, cursor:'pointer' }}>{move}</div>
                    {desc && (
                      <button onClick={() => setExpandedWarmupMove(isExpanded ? null : i)} style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px', color:'#c8b89a', flexShrink:0, lineHeight:1 }}>
                        <i className={`ti ti-chevron-${isExpanded?'up':'down'}`} style={{ fontSize:14 }} />
                      </button>
                    )}
                  </div>
                  {isExpanded && desc && (
                    <div style={{ padding:'0 16px 12px 50px', fontSize:12, color:'#5a5048', lineHeight:1.7 }}>{desc}</div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>Why warmup matters</div>
            <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{banner.note}</div>
          </div>

          <button className="btn-primary" onClick={() => { setCheckedMoves({}); setScreen('plan') }}>
            {totalDone >= moves.length ? 'Warmup complete — start workout' : 'Skip warmup — start workout'}
          </button>
        </div>
        <BottomNav />
      </div>
    )
  }

  // WORKOUT PLAN — overview list
  if (screen === 'plan') {
    const exercises = activity === 'gym' ? getExercises() : null
    const isGym = activity === 'gym'
    return (
      <div style={{ paddingBottom:100 }}>
        <TopBar title="WORKOUT" backTo={() => setScreen(isGym ? 'warmup' : 'pick')} />
        <div style={{ padding:'16px 16px 0' }}>
          {isAcl && <div style={{ background:'#fff8e6', border:'1px solid #f0c040', borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:'#6a4a00' }}>Your warmup matters more today</div>
            <div style={{ fontSize:12, color:'#7a6020', lineHeight:1.6 }}>Peak estrogen increases ligament laxity. Complete all warmup exercises before loading any weight.</div>
          </div>}
          {isHiitWarn && <div style={{ background:'#fdf3f0', border:'1px solid #e8a080', borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:'#6a2800' }}>HIIT is more stressful in this phase</div>
            <div style={{ fontSize:12, color:'#7a4020', lineHeight:1.6 }}>Progesterone competes with cortisol receptors, so high intensity creates a larger net stress response right now (Hackney 2006).</div>
          </div>}

          {isGym ? <>
            <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, marginBottom:2 }}>
              {muscleGroup==='full'?'Full body':muscleGroup==='upper'?'Upper body':muscleGroup==='lower'?'Lower body':'Custom'} session
            </div>
            <div style={{ fontSize:12, color:'#7a7268', marginBottom:8 }}>{fitnessLevel.charAt(0).toUpperCase()+fitnessLevel.slice(1)}, phase-matched intensity</div>
            <div style={{ fontSize:12, color:'#7a7268', marginBottom:16, lineHeight:1.5 }}>Aim for a weight where the last 2 to 3 reps are genuinely hard. If a set feels easy, go heavier.</div>
            <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, marginBottom:16, overflow:'hidden' }}>
              {exercises.map((exObj, i) => (
                <div key={i} style={{ padding:'12px 16px', borderBottom:i<exercises.length-1?'1px solid #f5f0e8':'none', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:24, height:24, borderRadius:12, background:'#f5f0e8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'#9a9590', flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:500 }}>{exObj.name}</div>
                    <div style={{ fontSize:12, color:'#9a9590' }}>{exObj.sets} sets of {exObj.reps} reps at {exObj.weight}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-primary" onClick={() => { setPlayerIdx(0); setPhaseOpen(false); setScreen('player') }}>Start workout</button>
            <button onClick={() => setScreen('feel')} style={{ display:'block', width:'100%', marginTop:10, background:'none', border:'none', fontSize:13, color:'#9a9590', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}>Already done, just log it</button>
          </> : (() => {
            const cardioKey = ['walk','run','cycle','swim'].includes(activity) ? activity : null
            const cardioGuide = cardioKey ? pc(CARDIO_GUIDES[cardioKey], phase) : null
            const hiitData = activity === 'hiit' ? (hiitFor(phase)) : null
            const yogaSeq = activity === 'yoga' ? pc(YOGA_SEQUENCES, phase) : null
            const pilatesSeq = activity === 'pilates' ? pc(PILATES_SEQUENCES, phase) : null

            if (activity === 'rest') return (
              <>
                <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, marginBottom:8 }}>Rest day</div>
                <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>Why rest is training</div>
                  <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>Your body rebuilds during recovery, not during the workout. Muscle protein synthesis peaks in the 24 to 48 hours after training. Rest is when adaptation happens.</div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:14, marginBottom:16 }}>
                  <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{banner.note}</div>
                </div>
                <button className="btn-primary" onClick={() => setScreen('feel')}>Log rest day</button>
              </>
            )

            if (cardioGuide) return (
              <>
                <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, marginBottom:2 }}>{ACTIVITIES.find(a=>a.id===activity)?.label}</div>
                <div style={{ fontSize:12, color:'#9a9590', marginBottom:14 }}>{Math.round(intensity*100)}% intensity today</div>

                <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:16, marginBottom:12 }}>
                  <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                    <div style={{ flex:1, background:'#f5f0e8', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>Duration</div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#2c2820' }}>{cardioGuide.duration}</div>
                    </div>
                    <div style={{ flex:1, background:'#f5f0e8', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>Pace</div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#2c2820' }}>{cardioGuide.pace}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6, marginBottom:10 }}>{cardioGuide.note}</div>
                  <div style={{ fontSize:11, color:'#9a9590', fontStyle:'italic', lineHeight:1.5 }}>{cardioGuide.science}</div>
                </div>

                <button className="btn-primary" onClick={() => { setCardioSeconds(0); setCardioRunning(false); setScreen('cardioTimer') }}>
                  Start {ACTIVITIES.find(a=>a.id===activity)?.label}
                </button>
              </>
            )

            if (hiitData) return (
              <>
                <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, marginBottom:2 }}>HIIT</div>
                <div style={{ fontSize:12, color:'#9a9590', marginBottom:14 }}>{hiitData.rounds} rounds, {hiitData.work}s work and {hiitData.rest}s rest</div>

                <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                  <div style={{ flex:1, background:'#fdf3f0', border:'1px solid #e8c0a8', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a6040', marginBottom:4 }}>Work</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#6a2800' }}>{hiitData.work}s</div>
                  </div>
                  <div style={{ flex:1, background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>Rest</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#2c2820' }}>{hiitData.rest}s</div>
                  </div>
                  <div style={{ flex:1, background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>Rounds</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'#2c2820' }}>{hiitData.rounds}</div>
                  </div>
                </div>

                <div style={{ background:'#fdf3f0', border:'1px solid #e8c0a8', borderRadius:12, padding:14, marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a6040', marginBottom:6 }}>How hard to push</div>
                  <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6, marginBottom:6 }}>Each work bout should be near-maximal, an effort of 9 to 10 out of 10. If you could hold a conversation, it is not HIIT. It is just cardio, and it will feel easy. Women are more fatigue-resistant and recover faster between bouts than men, so you have to push to genuinely high intensity for the adaptation; a comfortable circuit will not get you there. Use harder variations (add a jump, go faster) before adding rounds.</div>
                  <div style={{ fontSize:11, color:'#9a9590', fontStyle:'italic', lineHeight:1.5 }}>Sims ST. ROAR 2024; sex differences in HIIT, Frontiers in Physiology 2020; Hunter SK, sex differences in fatigability, Acta Physiologica 2014.</div>
                </div>

                <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, marginBottom:12, overflow:'hidden' }}>
                  <div style={{ padding:'10px 16px', borderBottom:'1px solid #f5f0e8' }}>
                    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>Repeat all {hiitData.rounds} rounds</div>
                  </div>
                  {hiitData.exercises.map((ex, i) => (
                    <div key={i} style={{ padding:'11px 16px', borderBottom:i<hiitData.exercises.length-1?'1px solid #f5f0e8':'none', display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:22, height:22, borderRadius:11, background:'#f5f0e8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'#9a9590', flexShrink:0 }}>{i+1}</div>
                      <div style={{ fontSize:14, color:'#2c2820' }}>{ex}</div>
                    </div>
                  ))}
                </div>

                <button className="btn-primary" onClick={() => {
                  const data = hiitFor(phase)
                  setHiitRound(1); setHiitExIdx(0); setHiitPhase('work')
                  setHiitSecondsLeft(data.work); setHiitRunning(true)
                  setScreen('hiitTimer')
                }}>Start HIIT</button>
              </>
            )

            if (yogaSeq || pilatesSeq) {
              const seq = yogaSeq || pilatesSeq
              const label = activity === 'yoga' ? 'Yoga' : 'Pilates'
              const totalDone = seq.filter((_, i) => checkedMoves[i]).length
              const allDone = totalDone === seq.length
              return (
                <>
                  <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:12, color:'#9a9590', marginBottom:14 }}>{seq.length} movements, phase-matched sequence</div>

                  <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, marginBottom:12, overflow:'hidden' }}>
                    <div style={{ padding:'10px 16px', borderBottom:'1px solid #f5f0e8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>Your sequence today</div>
                      <div style={{ fontSize:12, color:'#9a9590' }}>{totalDone}/{seq.length}</div>
                    </div>
                    {seq.map((move, i) => {
                      const descLib = activity === 'yoga' ? YOGA_DESCRIPTIONS : PILATES_DESCRIPTIONS
                      const moveName = move.split(' — ')[0].split(' — ')[0]
                      const descKey = Object.keys(descLib).find(k => moveName.toLowerCase().startsWith(k.toLowerCase()))
                      const desc = descKey ? descLib[descKey] : null
                      const isExpanded = expandedChecklistMove === i
                      return (
                        <div key={i} style={{ borderBottom:i<seq.length-1?'1px solid #f5f0e8':'none' }}>
                          <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, background:checkedMoves[i]?'#f8f5f0':'#fff' }}>
                            <div onClick={() => setCheckedMoves(p => ({...p, [i]: !p[i]}))}
                              style={{ width:22, height:22, borderRadius:11, border:`2px solid ${checkedMoves[i]?'#2c2820':'#c8c0b8'}`, background:checkedMoves[i]?'#2c2820':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer' }}>
                              {checkedMoves[i] && <div style={{ width:6, height:6, borderRadius:'50%', background:'#f5f0e8' }} />}
                            </div>
                            <div style={{ flex:1, fontSize:13, color:checkedMoves[i]?'#9a9590':'#2c2820', textDecoration:checkedMoves[i]?'line-through':'none', lineHeight:1.5, cursor:'pointer' }}
                              onClick={() => setCheckedMoves(p => ({...p, [i]: !p[i]}))}>{move}</div>
                            {desc && (
                              <button onClick={() => setExpandedChecklistMove(isExpanded ? null : i)}
                                style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px', color:'#c8b89a', flexShrink:0, lineHeight:1, fontSize:16 }}>
                                <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} />
                              </button>
                            )}
                          </div>
                          {desc && isExpanded && (
                            <div style={{ padding:'0 16px 12px 50px', fontSize:12, color:'#5a5248', lineHeight:1.7, background:checkedMoves[i]?'#f8f5f0':'#faf8f5' }}>
                              {desc}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <button className="btn-primary" onClick={() => setScreen('feel')} style={{ opacity: allDone ? 1 : 0.85 }}>
                    {allDone ? 'Complete — log how it went' : 'Skip ahead — log how it went'}
                  </button>
                </>
              )
            }

            return (
              <>
                <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, marginBottom:8 }}>{ACTIVITIES.find(a=>a.id===activity)?.label}</div>
                <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:16 }}>
                  <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{banner.note}</div>
                </div>
                <button className="btn-primary" onClick={() => setScreen('feel')}>Log how it went</button>
              </>
            )
          })()}
        </div>
        <BottomNav />
      </div>
    )
  }

  // EXERCISE PLAYER — one exercise at a time
  if (screen === 'player') {
    const exercises = getExercises()
    const exObj = exercises[playerIdx]
    const isLast = playerIdx === exercises.length - 1
    const svgType = getSvgType(exObj.name)
    const muscles = getMuscles(exObj.name)
    const equipment = getEquipment(exObj.name)
    const phases = getPhases(svgType)
    const exWeights = setWeights[playerIdx] || {}
    const exDone = playerDone[playerIdx] || {}
    const allSetsComplete = Object.keys(exDone).length >= exObj.sets && Object.values(exDone).every(Boolean)

    function updateWeight(setIdx, delta) {
      setSetWeights(prev => {
        const ex = { ...(prev[playerIdx] || {}) }
        const current = parseFloat(ex[setIdx]) || 0
        const next = Math.max(0, Math.round((current + delta) * 2) / 2)
        ex[setIdx] = next
        return { ...prev, [playerIdx]: ex }
      })
    }
    function toggleSet(setIdx, numSets) {
      setPlayerDone(prev => {
        const ex = { ...(prev[playerIdx] || {}) }
        const completing = !ex[setIdx]
        ex[setIdx] = completing
        if (completing && setIdx < numSets - 1) setRestSecondsLeft(60)
        return { ...prev, [playerIdx]: ex }
      })
    }

    return (
      <div style={{ paddingBottom:120 }}>
        {/* top bar with progress */}
        <div style={{ background:'#f5f0e8', padding:'16px 20px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => playerIdx === 0 ? setScreen('plan') : setPlayerIdx(i => i-1)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontSize:20, color:'#2c2820', lineHeight:1 }}>
            <i className="ti ti-arrow-left"/>
          </button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>WORKOUT</div>
            <div style={{ display:'flex', gap:5 }}>
              {exercises.map((_, i) => (
                <div key={i} style={{ height:3, flex:1, borderRadius:2, background: i < playerIdx ? '#2c2820' : i === playerIdx ? '#c8b89a' : '#ede8e0' }}/>
              ))}
            </div>
          </div>
          <div style={{ fontSize:12, color:'#9a9590', flexShrink:0 }}>{playerIdx+1} of {exercises.length}</div>
        </div>

        <div style={{ padding:'16px' }}>
          {/* Exercise title */}
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:24, marginBottom:4 }}>{exObj.name}</div>
          <div style={{ fontSize:14, color:'#7a7268', marginBottom:16 }}>{exObj.sets} sets x {exObj.reps}</div>

          {/* Demo card */}
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, marginBottom:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px 0' }}>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9a9590', marginBottom:8 }}>EXERCISE DEMO</div>
              <div style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>{exObj.name}</div>
            </div>
            {/* Stick figure (gender-neutral demo, app palette) */}
            <div style={{ background:'#faf8f5', border:'1px solid #ede8e0', margin:'0 16px 12px', borderRadius:12, padding:'14px 0', height:160 }}>
              <StickFigure type={svgType} />
            </div>
            {/* Tags */}
            <div style={{ padding:'0 16px 8px', display:'flex', gap:8, flexWrap:'wrap' }}>
              <span style={{ background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:20, padding:'4px 12px', fontSize:12, color:'#5a4a3a' }}>Main muscles: {muscles}</span>
            </div>
            <div style={{ padding:'0 16px 12px', display:'flex', gap:8, flexWrap:'wrap' }}>
              <span style={{ background:'#f5f0e8', border:'1px solid #ede8e0', borderRadius:20, padding:'4px 12px', fontSize:12, color:'#5a4a3a' }}>Equipment: {equipment}</span>
            </div>
            <div style={{ padding:'0 16px 4px', fontSize:12, color:'#7a7268' }}>Movement: {exObj.name}</div>
            {/* 3 phase cards */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, padding:'12px 16px 16px' }}>
              {phases.map((ph, pi) => (
                <div key={pi} style={{ background:'#faf8f5', borderRadius:10, padding:'10px 8px' }}>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#c8b89a', marginBottom:4 }}>
                    {pi===0?'Start position':pi===1?'Lower / working phase':'Finish position'}
                  </div>
                  <div style={{ fontSize:11, color:'#3a3530', lineHeight:1.5 }}>{ph.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weight guide — always visible */}
          {(() => {
            const weightNote = getPhaseWeightNote(exObj.weight, intensity, phase)
            return weightNote ? (
              <div style={{ background:'#e8dfd0', border:'1px solid #c8b89a', borderRadius:12, padding:'12px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:12 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#7a6a50', marginBottom:2 }}>WEIGHT TODAY</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'#2c2820' }}>~{weightNote.weight}</div>
                </div>
                {playerIdx === 0 && <div style={{ flex:1, fontSize:12, color:'#5a4a3a', lineHeight:1.5 }}>{weightNote.note}</div>}
              </div>
            ) : null
          })()}

          {/* Phase guidance accordion */}
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, marginBottom:12, overflow:'hidden' }}>
            <button onClick={() => setPhaseOpen(o => !o)} style={{ width:'100%', padding:'14px 16px', background:'none', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'inherit' }}>
              <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>PHASE GUIDANCE</span>
              <i className={`ti ti-chevron-${phaseOpen?'up':'down'}`} style={{ color:'#9a9590', fontSize:14 }}/>
            </button>
            {phaseOpen && (
              <div style={{ padding:'0 16px 14px', fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{banner.note}</div>
            )}
          </div>

          {/* Set table */}
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 52px 44px', padding:'10px 14px', borderBottom:'1px solid #f5f0e8' }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>SET</div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>WEIGHT (KG)</div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', textAlign:'center' }}>REPS</div>
              <div/>
            </div>
            {Array.from({ length: exObj.sets }).map((_, si) => {
              const w = exWeights[si] !== undefined ? exWeights[si] : ''
              const done = exDone[si]
              return (
                <div key={si} style={{ display:'grid', gridTemplateColumns:'36px 1fr 52px 44px', padding:'10px 14px', borderBottom:si<exObj.sets-1?'1px solid #f5f0e8':'none', alignItems:'center', background:done?'#fafaf8':'#fff' }}>
                  <div style={{ fontSize:15, fontWeight:600, color:'#9a9590' }}>{si+1}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <button onClick={() => updateWeight(si, -2.5)} style={{ width:30, height:30, borderRadius:8, border:'1px solid #ede8e0', background:'#faf8f5', cursor:'pointer', fontSize:16, color:'#7a7268', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:'inherit' }}>−</button>
                    <input type="number" value={w} onChange={e => setSetWeights(prev => { const ex={...(prev[playerIdx]||{})}; ex[si]=e.target.value; return {...prev,[playerIdx]:ex} })}
                      placeholder={exObj.weight.split(' ')[0]}
                      style={{ flex:1, minWidth:0, padding:'6px 8px', border:'1px solid #ede8e0', borderRadius:8, fontSize:14, textAlign:'center', background:'#fff', fontFamily:'inherit', color:'#2c2820' }}/>
                    <button onClick={() => updateWeight(si, 2.5)} style={{ width:30, height:30, borderRadius:8, border:'1px solid #ede8e0', background:'#faf8f5', cursor:'pointer', fontSize:16, color:'#7a7268', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:'inherit' }}>+</button>
                  </div>
                  <div style={{ fontSize:15, textAlign:'center', color:'#2c2820', fontWeight:500 }}>{exObj.reps}</div>
                  <div style={{ display:'flex', justifyContent:'flex-end' }}>
                    <button onClick={() => toggleSet(si, exObj.sets)} style={{ width:36, height:36, borderRadius:18, border:`2px solid ${done?'#2c2820':'#c8b89a'}`, background:done?'#2c2820':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                      {done && <i className="ti ti-check" style={{ color:'#f5f0e8', fontSize:14 }}/>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Rest timer strip */}
          {restSecondsLeft > 0 && (
            <div style={{ background:'#2c2820', borderRadius:14, padding:'14px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:2 }}>REST</div>
                <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:28, color:'#f5f0e8', lineHeight:1 }}>
                  {String(Math.floor(restSecondsLeft/60)).padStart(2,'0')}:{String(restSecondsLeft%60).padStart(2,'0')}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {[30,60,90].map(s => (
                  <button key={s} onClick={() => setRestSecondsLeft(s)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'#c8b89a', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{s}s</button>
                ))}
                <button onClick={() => setRestSecondsLeft(0)} style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'none', color:'#9a9590', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Skip</button>
              </div>
            </div>
          )}

          {/* Next / Finish button */}
          <button className="btn-primary" onClick={() => { if (isLast) setScreen('feel'); else { setPlayerIdx(i => i+1); setPhaseOpen(false); setRestSecondsLeft(0) } }}>
            {isLast ? 'Finish workout' : `Next: ${exercises[playerIdx+1].name}`}
          </button>
          {isLast && <button onClick={() => setScreen('feel')} style={{ display:'block', width:'100%', marginTop:8, background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Skip to log how it went</button>}
        </div>
      </div>
    )
  }

  // CARDIO TIMER
  if (screen === 'cardioTimer') {
    const cardioKey = ['walk','run','cycle','swim'].includes(activity) ? activity : null
    const cardioGuide = cardioKey ? pc(CARDIO_GUIDES[cardioKey], phase) : null
    const mm = String(Math.floor(cardioSeconds / 60)).padStart(2, '0')
    const ss = String(cardioSeconds % 60).padStart(2, '0')
    const label = ACTIVITIES.find(a => a.id === activity)?.label || activity
    return (
      <div style={{ paddingBottom:100 }}>
        <TopBar title="WORKOUT" backTo={() => { setCardioRunning(false); setScreen('plan') }} />
        <div style={{ padding:'24px 16px 0', textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#9a9590', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600 }}>{label}</div>
          {cardioGuide && (
            <div style={{ fontSize:13, color:'#7a7268', marginBottom:24 }}>Target: {cardioGuide.duration} at {cardioGuide.pace}</div>
          )}

          {/* Big timer */}
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:72, color:'#2c2820', letterSpacing:'-0.02em', lineHeight:1, marginBottom:8 }}>
            {mm}:{ss}
          </div>
          <div style={{ fontSize:12, color:'#9a9590', marginBottom:32 }}>{cardioRunning ? 'Running' : cardioSeconds > 0 ? 'Paused' : 'Ready'}</div>

          {/* Start / Pause */}
          <button
            onClick={() => setCardioRunning(r => !r)}
            style={{ width:80, height:80, borderRadius:40, background: cardioRunning ? '#f5f0e8' : '#2c2820', border:`2px solid ${cardioRunning?'#ede8e0':'#2c2820'}`, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:32 }}
          >
            <i className={`ti ti-${cardioRunning ? 'player-pause' : 'player-play'}`} style={{ fontSize:30, color: cardioRunning ? '#2c2820' : '#f5f0e8' }} />
          </button>

          {cardioGuide && (
            <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:16, textAlign:'left' }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>PHASE NOTE</div>
              <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{cardioGuide.note}</div>
              <div style={{ fontSize:11, color:'#9a9590', fontStyle:'italic', marginTop:6 }}>{cardioGuide.science}</div>
            </div>
          )}

          <button className="btn-primary" onClick={() => { setCardioRunning(false); setScreen('feel') }}>
            Done, log how it went
          </button>
        </div>
        <BottomNav />
      </div>
    )
  }

  // HIIT TIMER
  if (screen === 'hiitTimer') {
    const data = hiitFor(phase)
    const isWork = hiitPhase === 'work'
    const currentExercise = data.exercises[hiitExIdx]
    const totalIntervals = data.rounds * data.exercises.length
    const doneIntervals = (hiitRound - 1) * data.exercises.length + hiitExIdx
    const progressPct = Math.round(doneIntervals / totalIntervals * 100)

    function skipHiitPhase() {
      setHiitSecondsLeft(0)
    }

    return (
      <div style={{ paddingBottom:100, minHeight:'100vh', background: isWork ? '#1e1010' : '#101a10' }}>
        <div style={{ background:'rgba(0,0,0,0.3)', padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => { setHiitRunning(false); setScreen('plan') }} style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontSize:20, color:'rgba(255,255,255,0.7)', lineHeight:1 }}>
            <i className="ti ti-arrow-left"/>
          </button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(255,255,255,0.5)', marginBottom:6 }}>HIIT WORKOUT</div>
            <div style={{ height:4, background:'rgba(255,255,255,0.15)', borderRadius:2 }}>
              <div style={{ height:4, borderRadius:2, background: isWork ? '#e06040' : '#40a060', width:`${progressPct}%`, transition:'width 0.3s' }} />
            </div>
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', flexShrink:0 }}>Round {hiitRound}/{data.rounds}</div>
        </div>

        <div style={{ padding:'32px 20px 0', textAlign:'center' }}>
          {/* WORK / REST badge */}
          <div style={{ display:'inline-block', padding:'6px 20px', borderRadius:20, background: isWork ? '#e06040' : '#40a060', marginBottom:20 }}>
            <span style={{ fontSize:13, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#fff' }}>
              {isWork ? '🔥 WORK' : '💚 REST'}
            </span>
          </div>

          {/* Exercise name */}
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:26, color:'#fff', marginBottom:8, minHeight:36, lineHeight:1.3 }}>
            {isWork ? currentExercise : 'Rest'}
          </div>
          {!isWork && hiitExIdx + 1 < data.exercises.length && (
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:0 }}>
              Next: {data.exercises[hiitExIdx + 1]}
            </div>
          )}
          {!isWork && hiitExIdx + 1 >= data.exercises.length && hiitRound < data.rounds && (
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:0 }}>
              Next round starts with: {data.exercises[0]}
            </div>
          )}

          {/* Big countdown */}
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:96, color:'#fff', letterSpacing:'-0.02em', lineHeight:1, margin:'16px 0 8px' }}>
            {hiitSecondsLeft}
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:36 }}>seconds</div>

          {/* Pause / Play */}
          <button
            onClick={() => setHiitRunning(r => !r)}
            style={{ width:80, height:80, borderRadius:40, background: hiitRunning ? 'rgba(255,255,255,0.15)' : '#fff', border:'2px solid rgba(255,255,255,0.3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}
          >
            <i className={`ti ti-${hiitRunning ? 'player-pause' : 'player-play'}`} style={{ fontSize:30, color: hiitRunning ? '#fff' : '#2c2820' }} />
          </button>

          <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:32 }}>
            <button onClick={skipHiitPhase} style={{ padding:'10px 24px', borderRadius:10, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.8)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              Skip {isWork ? 'to rest' : 'to next'}
            </button>
          </div>

          {/* Exercise list for reference */}
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:14, textAlign:'left', marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)', marginBottom:10 }}>EXERCISES THIS ROUND</div>
            {data.exercises.map((ex, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:i < data.exercises.length - 1 ? 8 : 0 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background: i < hiitExIdx ? '#40a060' : i === hiitExIdx && isWork ? '#e06040' : 'rgba(255,255,255,0.2)', flexShrink:0 }} />
                <div style={{ fontSize:13, color: i === hiitExIdx ? '#fff' : i < hiitExIdx ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.65)', textDecoration: i < hiitExIdx ? 'line-through' : 'none' }}>{ex}</div>
              </div>
            ))}
          </div>

          <button onClick={() => { setHiitRunning(false); setScreen('feel') }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:13, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
            End session early
          </button>
        </div>
      </div>
    )
  }

  // HOW DID IT FEEL
  if (screen === 'feel') return (
    <div style={{ paddingBottom:100 }}>
      <TopBar title="WORKOUT" backTo={() => setScreen('plan')} />
      <div style={{ padding:'16px' }}>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, marginBottom:4 }}>How did it go?</div>
        <div style={{ fontSize:13, color:'#7a7268', marginBottom:20 }}>This helps the algorithm understand your energy relative to your phase.</div>
        {FEEL_OPTIONS.map(f => (
          <div key={f} onClick={() => setFeel(f)} style={{
            padding:'16px', borderRadius:12, border:`1px solid ${feel===f?'#c8b89a':'#ede8e0'}`,
            background:feel===f?'#e8dfd0':'#fff', cursor:'pointer', marginBottom:10,
            fontSize:14, fontWeight:feel===f?600:400, color:feel===f?'#5a4a3a':'#2c2820',
          }}>{f}</div>
        ))}
        <button className="btn-primary" onClick={save} disabled={!feel || saving} style={{ marginTop:8 }}>
          {saving ? 'Saving...' : 'Save workout'}
        </button>
      </div>
      <BottomNav />
    </div>
  )

  // LOG A CLASS
  if (screen === 'logClass') return (
    <div style={{ paddingBottom:100 }}>
      <TopBar title="LOG A CLASS" backTo={() => setScreen('pick')} />
      <div style={{ padding:'16px' }}>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, marginBottom:4 }}>What class did you do?</div>
        <div style={{ fontSize:13, color:'#7a7268', marginBottom:20 }}>Quick log for studio and group classes.</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
          {CLASS_TYPES.map(c => (
            <div key={c.id} onClick={() => setClassType(c.id)} style={{
              padding:'14px 12px', borderRadius:12, border:`1px solid ${classType===c.id?'#c8b89a':'#ede8e0'}`,
              background:classType===c.id?'#e8dfd0':'#fff', cursor:'pointer',
              display:'flex', alignItems:'center', gap:10,
            }}>
              {c.emoji
                ? <span style={{ fontSize:20 }}>{c.emoji}</span>
                : <i className={`ti ${c.icon}`} style={{ fontSize:20, color:classType===c.id?'#5a4a3a':'#c8b89a' }} />
              }
              <div style={{ fontSize:13, fontWeight:classType===c.id?600:400, color:classType===c.id?'#5a4a3a':'#2c2820' }}>{c.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom:24 }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:8, display:'block' }}>Duration (minutes)</span>
          <input
            type="number" inputMode="numeric" placeholder="e.g. 45"
            value={classDuration}
            onChange={e => setClassDuration(e.target.value)}
            style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #ede8e0', fontSize:15, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }}
          />
        </div>
        <button className="btn-primary" disabled={!classType || saving} onClick={saveClass}>
          {saving ? 'Saving...' : 'Save class'}
        </button>
      </div>
      <BottomNav />
    </div>
  )

  return null
}
