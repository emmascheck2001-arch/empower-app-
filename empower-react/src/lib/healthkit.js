// Wearable health bridge — ONE integration that works on both platforms:
//   iOS  -> Apple HealthKit   (Apple Watch, Oura, Whoop, Fitbit, Garmin all sync into it)
//   Android -> Health Connect (Samsung, Fitbit, Oura, Garmin, Whoop all sync into it)
// via @capgo/capacitor-health's unified API. Because we read the phone's central health store
// rather than any one vendor's API, connecting once passively covers most wearables on the
// market. Reads the signals that power cycle + ovulation detection — overnight/basal/body
// temperature, resting heart rate, and HRV. Native only; every function no-ops safely on web.
import { Capacitor } from '@capacitor/core'
import { Health } from '@capgo/capacitor-health'

// Temperature comes first because a sustained, consistently measured shift can add retrospective ovulation context. We read all three temperature
// streams and use whichever the user's device actually fills: Apple Watch writes overnight
// "wrist" temperature; Oura/dedicated BBT write basal; Android wearables write body temperature.
const TEMP_TYPES = ['appleSleepingWristTemperature', 'basalBodyTemperature', 'bodyTemperature']
const READ_TYPES = [...TEMP_TYPES, 'restingHeartRate', 'heartRateVariability', 'sleep', 'workouts']

export function isNative() {
  return Capacitor.isNativePlatform()
}

// 'Apple Health' on iOS, 'Health Connect' on Android — for user-facing copy.
export function healthStoreName() {
  return Capacitor.getPlatform() === 'android' ? 'Health Connect' : 'Apple Health'
}

// True only where a health store is actually usable (iOS 14+, or Android with Health Connect
// installed — Android 14+ ships it by default; older devices must install it from the Play Store).
export async function isHealthAvailable() {
  if (!isNative()) return false
  try { const r = await Health.isAvailable(); return !!r?.available } catch { return false }
}

// Prompt for read access to the signals we need. Returns true if the sheet completed without
// error (the OS never reveals which types were granted, by design).
export async function connectHealth() {
  if (!isNative()) return false
  try { await Health.requestAuthorization({ read: READ_TYPES, write: [] }); return true }
  catch (e) { console.error('Health authorization failed', e); return false }
}

// Collapse raw samples to one value per calendar day (averaging duplicates). Normalises any
// Fahrenheit temperature to Celsius so the 0.2°C coverline threshold is always correct.
function toDailySeries(samples) {
  const byDay = {}
  for (const s of samples || []) {
    const date = (s.startDate || '').slice(0, 10)
    if (!date || typeof s.value !== 'number') continue
    let v = s.value
    if (s.unit === 'fahrenheit') v = (v - 32) * 5 / 9
    ;(byDay[date] = byDay[date] || []).push(v)
  }
  return Object.entries(byDay)
    .map(([date, vals]) => ({ date, value: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

// Map Apple Health / Health Connect workout types onto Em~power's activity buckets so imported
// workouts line up with the app's own Walk / Run / Cycle / Swim / Gym / Yoga / Pilates / HIIT.
const WORKOUT_MAP = {
  running: 'Run', runningTreadmill: 'Run', wheelchairRunPace: 'Run',
  walking: 'Walk', hiking: 'Walk', wheelchairWalkPace: 'Walk',
  cycling: 'Cycle', bikingStationary: 'Cycle', handCycling: 'Cycle',
  swimming: 'Swim', swimmingPool: 'Swim', swimmingOpenWater: 'Swim', waterFitness: 'Swim',
  yoga: 'Yoga',
  pilates: 'Pilates', barre: 'Pilates',
  highIntensityIntervalTraining: 'HIIT', crossTraining: 'HIIT', mixedCardio: 'HIIT',
  jumpRope: 'HIIT', kickboxing: 'HIIT', boxing: 'HIIT', bootCamp: 'HIIT',
  strengthTraining: 'Gym', traditionalStrengthTraining: 'Gym', functionalStrengthTraining: 'Gym',
  weightlifting: 'Gym', coreTraining: 'Gym', calisthenics: 'Gym',
}

function mapWorkout(t) {
  if (WORKOUT_MAP[t]) return WORKOUT_MAP[t]
  // Any explicit lift / gym-machine movement → Gym; otherwise keep a readable label.
  if (/press|curl|deadlift|lunge|plank|crunch|squat|raise|extension|pullDown|latPull/i.test(t)) return 'Gym'
  return (t || 'Workout').replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim()
}

// Read recent workouts (Apple Watch etc.) from the health store, shaped for display + logging.
// Returns newest-first: [{ date:'YYYY-MM-DD', activity, rawType, minutes, calories, km, source }].
export async function readRecentWorkouts(days = 21) {
  if (!isNative()) return []
  const end = new Date()
  const start = new Date(); start.setDate(start.getDate() - days)
  try {
    const r = await Health.queryWorkouts({
      startDate: start.toISOString(), endDate: end.toISOString(), limit: 100, ascending: false,
    })
    return (r?.workouts || []).map(w => ({
      date: (w.startDate || '').slice(0, 10),
      start: w.startDate,
      activity: mapWorkout(w.workoutType),
      rawType: w.workoutType,
      minutes: w.duration ? Math.round(w.duration / 60) : null,
      calories: w.totalEnergyBurned != null ? Math.round(w.totalEnergyBurned) : null,
      km: w.totalDistance != null ? Math.round(w.totalDistance / 100) / 10 : null,   // m → km, 1dp
      source: w.sourceName || null,
    })).filter(w => w.date)
  } catch (e) { console.error('readRecentWorkouts failed', e); return [] }
}

// Total ASLEEP hours for the most recent night from sleep samples. Counts only true sleep
// states (asleep/rem/deep/light) so overlapping "in bed" segments never double-count; samples
// with no state (some Android sources) are counted as a best effort. Groups by the night the
// sleep ended on and returns the latest night's hours, or null if there is no usable data.
export function sleepHoursLastNight(samples) {
  const ASLEEP = new Set(['asleep', 'rem', 'deep', 'light'])
  const byNight = {}
  for (const s of samples || []) {
    const state = s.sleepState
    if (state && !ASLEEP.has(state)) continue          // skip 'inBed' / 'awake'
    const start = new Date(s.startDate), end = new Date(s.endDate)
    if (isNaN(start) || isNaN(end)) continue
    if (end <= start || end - start > 24 * 60 * 60000) continue
    const night = (s.endDate || '').slice(0, 10)
    const source = s.sourceBundleId || s.sourceName || 'unknown'
    byNight[night] = byNight[night] || {}
    ;(byNight[night][source] = byNight[night][source] || []).push([start.getTime(), end.getTime()])
  }
  const nights = Object.keys(byNight).sort()
  if (!nights.length) return null
  const totals = Object.values(byNight[nights[nights.length - 1]]).map(intervals => {
    const sorted = intervals.sort((a, b) => a[0] - b[0])
    const merged = []
    for (const interval of sorted) {
      const last = merged[merged.length - 1]
      if (!last || interval[0] > last[1]) merged.push([...interval])
      else last[1] = Math.max(last[1], interval[1])
    }
    return merged.reduce((sum, [start, end]) => sum + end - start, 0)
  })
  // Multiple apps can mirror the same sleep into the health store. Use the most complete
  // source for the night instead of adding sources together.
  return Math.max(...totals) / 3600000
}

// Read the last `days` of wearable data, shaped for wearableCycleSignals():
// { temps: [{date,value}] ascending, restingHR: [numbers] newest-first, hrv: [numbers] newest-first }
export async function readWearableData(days = 45) {
  if (!isNative()) return null
  const end = new Date()
  const start = new Date(); start.setDate(start.getDate() - days)
  const q = (dataType) => Health.readSamples({
    dataType, startDate: start.toISOString(), endDate: end.toISOString(), limit: 1000, ascending: true,
  }).then(r => r?.samples || []).catch(() => [])
  try {
    const [wrist, basal, body, rhr, hrv, sleep] = await Promise.all([
      q('appleSleepingWristTemperature'), q('basalBodyTemperature'), q('bodyTemperature'),
      q('restingHeartRate'), q('heartRateVariability'), q('sleep'),
    ])
    // Use whichever temperature stream has the most daily coverage (device-dependent).
    const tempCandidates = [wrist, basal, body].map(toDailySeries)
    const tempDaily = tempCandidates.reduce((best, cur) => (cur.length > best.length ? cur : best), [])
    const rhrDaily = toDailySeries(rhr)
    const hrvDaily = toDailySeries(hrv)
    const sleepHours = sleepHoursLastNight(sleep)
    return {
      temps: tempDaily,                                              // ascending {date,value}
      restingHR: rhrDaily.map(x => x.value).reverse(),               // newest-first
      hrv: hrvDaily.map(x => x.value).reverse(),                     // newest-first
      sleepHours,                                                    // hours asleep last night, or null
      hasAnyData: tempDaily.length + rhrDaily.length + hrvDaily.length > 0 || sleepHours != null,
    }
  } catch (e) { console.error('readWearableData failed', e); return null }
}
