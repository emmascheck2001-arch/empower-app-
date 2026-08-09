// Weekly summary modal + dashboard card, a review of ONLY what she logged in the past week.
// Permanent rule: every line here must be derived from the user's own logged data, no
// generic "many women notice" predictions, no prescribed experiments, nothing invented.

import { buildWeeklyHighlights } from '../lib/weeklyHighlights'
import { buildWeeklyObservation } from '../lib/weeklyObservation'
import { getPhase, isMeaningfulHealthLog } from '../lib/hormoneSync'
import { getUserLocal, setUserLocal } from '../lib/userLocalState'
import { diffCalendarDays, toDateStr } from '../lib/dateUtils.js'

// Rolling weekly cadence, keyed to the last time the review actually appeared (not the calendar
// week). Stored as YYYY-MM-DD so we can measure a true 7-day gap.
const LAST_SHOWN_KEY = 'weekly-last-shown'
const DISMISSED_KEY = 'weekly-last-dismissed'

function scoreEnergy(e) {
  return { 'Very low':1, 'Low':2, 'Normal':3, 'Good':3, 'High':4 }[e] ?? null
}
function scoreSleep(s) {
  return { 'Poor':1, 'Fair':2, 'Good':3, 'Great':4, 'Excellent':4 }[s] ?? null
}

// Enough logged days in the past week to build a meaningful review. Below this, we skip the
// weekly insight entirely rather than show a hollow one.
export const WEEKLY_MIN_LOGS = 4

// Show the weekly review on the FIRST APP OPEN once at least 7 days have passed since it last
// appeared (or it has never appeared), and there is enough logged in the past week to make a real
// recap. Triggered by opening the app (the dashboard loads on every open), NEVER by a login event,
// which almost never fires once the app is installed on a phone.
export function shouldShowWeeklySummary(logs, userId) {
  const last = getUserLocal(userId, LAST_SHOWN_KEY)
  if (last && diffCalendarDays(new Date(), last + 'T00:00:00') < 7) return false
  const thisWeek = (logs || []).filter(l => {
    const diff = diffCalendarDays(new Date(), l.log_date + 'T00:00:00')
    return diff >= 0 && diff < 7 && isMeaningfulHealthLog(l)
  })
  return thisWeek.length >= WEEKLY_MIN_LOGS
}

export function markWeeklySummaryShown(userId) {
  setUserLocal(userId, LAST_SHOWN_KEY, toDateStr())   // today; next review is 7+ days out
}

export function markWeeklySummaryDismissed(userId) {
  // Dismissing also counts as shown, so it will not reappear until the next 7-day window.
  setUserLocal(userId, DISMISSED_KEY, toDateStr())
  setUserLocal(userId, LAST_SHOWN_KEY, toDateStr())
}

export function wasDismissedToday(userId) {
  const d = getUserLocal(userId, DISMISSED_KEY)
  return !!d && diffCalendarDays(new Date(), d + 'T00:00:00') === 0
}

export function buildWeeklySummary(logs, phase, subPhase, confidence, daysUntilPeriod, cycleDay, cycleLen) {
  const now = new Date()
  const thisWeek = logs.filter(l => {
    const diff = diffCalendarDays(now, new Date(l.log_date + 'T00:00:00'))
    return diff >= 0 && diff < 7 && isMeaningfulHealthLog(l)
  })
  const lastWeek = logs.filter(l => {
    const diff = diffCalendarDays(now, new Date(l.log_date + 'T00:00:00'))
    return diff >= 7 && diff < 14
  })
  // Factual recap lines built only from logged data (and last-week comparisons when data exists).
  const highlights = buildWeeklyHighlights(thisWeek, lastWeek)

  const daysLogged = thisWeek.length
  const workouts = thisWeek.filter(l => l.workout_feel && l.workout_feel !== 'Rest day' && l.workout_feel !== 'Skipped').length

  // Percentage stats
  const energyDays = thisWeek.filter(l => scoreEnergy(l.energy) !== null)
  const goodEnergyPct = energyDays.length
    ? Math.round(energyDays.filter(l => scoreEnergy(l.energy) >= 3).length / energyDays.length * 100)
    : null

  const sleepDays = thisWeek.filter(l => scoreSleep(l.sleep_quality) !== null)
  const goodSleepPct = sleepDays.length
    ? Math.round(sleepDays.filter(l => scoreSleep(l.sleep_quality) >= 3).length / sleepDays.length * 100)
    : null

  const workoutRate = daysLogged > 0 ? Math.round(workouts / daysLogged * 100) : null

  // Mood tally, count each mood across the week, return sorted top entries
  const moodTally = {}
  thisWeek.forEach(l => {
    if (l.mood?.length) {
      l.mood.forEach(m => { moodTally[m] = (moodTally[m] || 0) + 1 })
    }
  })
  const topMoods = Object.entries(moodTally).sort((a,b) => b[1]-a[1]).slice(0,5)

  // Sleep-energy correlation
  const paired = thisWeek.filter(l => scoreSleep(l.sleep_quality) !== null && scoreEnergy(l.energy) !== null)
  const goodSleepDays = paired.filter(l => scoreSleep(l.sleep_quality) >= 3)
  const avgEnergyOnGoodSleep = goodSleepDays.length
    ? goodSleepDays.reduce((a,l) => a + scoreEnergy(l.energy), 0) / goodSleepDays.length
    : null
  const sleepEnergyCorrelation = avgEnergyOnGoodSleep !== null && avgEnergyOnGoodSleep >= 3

  const currentPhase = subPhase || phase || 'Observation'
  const confPct = Math.round((confidence || 0) * 100)
  const isLowerEnergyPhase = ['Menstrual','Late luteal','Mid luteal'].includes(currentPhase)

  // ── Weekly Review extras ──────────────────────────────────────────────
  const consistencyPct = Math.round(daysLogged / 7 * 100)
  const dominant = (field) => {
    const t = {}; thisWeek.forEach(l => { if (l[field]) t[l[field]] = (t[l[field]] || 0) + 1 })
    return Object.entries(t).sort((a,b) => b[1]-a[1])[0]?.[0] || null
  }
  const sleepWord = dominant('sleep_quality')
  const energyWord = dominant('energy')
  const moodWord = topMoods[0]?.[0] || null
  // The personalised "one observation", the star of the review.
  const observation = buildWeeklyObservation({ thisWeek, lastWeek, cycleDayToday: cycleDay, cycleLen: cycleLen || 28, phaseAt: getPhase })
  // Looking ahead: the phase she is moving into over the next few days (her own cycle, not a guess).
  let nextPhaseLabel = null
  if (cycleDay && cycleLen && !['Perimenopause','observation','bc'].includes(phase)) {
    const futureCd = ((cycleDay + 5 - 1) % cycleLen) + 1
    const np = getPhase(futureCd, cycleLen)
    if (np && np !== phase) nextPhaseLabel = np
  }

  return {
    daysLogged, workouts, currentPhase, confPct, daysUntilPeriod,
    goodEnergyPct, goodSleepPct, workoutRate, topMoods, highlights,
    isLowerEnergyPhase, sleepEnergyCorrelation, paired,
    consistencyPct, sleepWord, energyWord, moodWord, observation, nextPhaseLabel,
  }
}

export function WeeklySummaryModal({ summary, onDismiss, name }) {
  const {
    workouts, currentPhase, confPct,
    goodEnergyPct, energyWord, sleepWord, moodWord,
    consistencyPct, observation, nextPhaseLabel, lookingAhead, highlights,
  } = summary
  // Keep the wins list positive: the one constructive note lives in "One observation".
  const wins = (highlights || []).filter(h => !/fewer|less|stress was highest/i.test(h))
  const HDR = { fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9a8a6a', marginBottom:10, display:'flex', alignItems:'center', gap:8 }
  const metrics = [
    { label:'Energy', val: goodEnergyPct != null ? `${goodEnergyPct}%` : (energyWord || ', ') },
    { label:'Sleep', val: sleepWord || ', ' },
    { label:'Mood', val: moodWord || ', ' },
    { label:'Cycle', val: currentPhase },
  ]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(44,40,32,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#faf8f5', borderRadius:'20px 20px 0 0', padding:'20px 20px 40px', maxWidth:420, width:'100%', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:'#c8b89a', borderRadius:2, margin:'0 auto 18px' }} />

        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:24, color:'#2c2820' }}>7-Day Review</div>
        <div style={{ fontSize:14, color:'#7a7268', marginBottom:22 }}>{name ? `${name}, here is what your last seven days show.` : 'Here is what your last seven days show.'}</div>

        {/* Biggest win */}
        <div style={{ marginBottom:18 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>⭐</span>Biggest win</div>
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16 }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#2c2820' }}>{workouts} workout{workouts === 1 ? '' : 's'} completed</div>
            <div style={{ fontSize:14, color:'#7a7268', marginTop:4 }}>{consistencyPct}% logging consistency</div>
          </div>
        </div>

        {/* Your wins this week, positive highlights and comparisons to last week */}
        {wins.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={HDR}><span style={{ fontSize:15 }}>🌿</span>Your wins this week</div>
            <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:'14px 16px' }}>
              {wins.map((h, i) => (
                <div key={i} style={{ fontSize:14, color:'#3a3530', lineHeight:1.6, display:'flex', gap:9, marginBottom: i === wins.length - 1 ? 0 : 8 }}>
                  <span style={{ color:'#88c088', fontWeight:700, flexShrink:0 }}>✓</span>{h}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your week */}
        <div style={{ marginBottom:18 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>📈</span>Your week</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {metrics.map((m,i) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:'12px 6px', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#2c2820', lineHeight:1.2 }}>{m.val}</div>
                <div style={{ fontSize:9, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color:'#9a9590', marginTop:4 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* One observation, the star */}
        <div style={{ marginBottom:18 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>🔍</span>One observation</div>
          <div style={{ background:'#f3ede1', border:'1px solid #e4d8c2', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontSize:15, color:'#3a3020', lineHeight:1.6 }}>{observation}</div>
          </div>
        </div>

        {/* Your data */}
        <div style={{ marginBottom:18 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>🧠</span>Your data</div>
          <div style={{ fontSize:14, color:'#5a5048', lineHeight:1.6 }}>
            {confPct >= 55 ? 'You now have enough data for detailed, personalised insights.' : 'Every check-in sharpens how personalised your recommendations become.'} Personalisation is at {confPct}%.
          </div>
        </div>

        {/* Looking ahead */}
        <div style={{ marginBottom:20 }}>
          <div style={HDR}><span style={{ fontSize:15 }}>📚</span>Looking ahead</div>
          <div style={{ fontSize:14, color:'#5a5048', lineHeight:1.6 }}>
            {lookingAhead?.text
              || (nextPhaseLabel
                ? `You're moving into your ${nextPhaseLabel.toLowerCase()} phase soon.`
                : `You'll stay in your ${(currentPhase || 'current').toLowerCase()} phase over the coming days.`)}
          </div>
        </div>

        <button className="btn-primary" onClick={onDismiss} style={{ fontSize:15 }}>Got it</button>
      </div>
    </div>
  )
}
