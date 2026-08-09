// route /dashboard, main home screen: phase hero card, anomaly alerts, streak, phase info sheet
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus, getPregnancyWeek, getTrimester, HealthDataError, parsePeriodStarts, getHormonalContext } from '../lib/hormoneSync'
import { buildDailyCoach } from '../lib/dailyCoach'
import { buildPhaseOutlook } from '../lib/phaseOutlook'
import { syncPlanToWatch } from '../lib/watchBridge'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'
import InstallPrompt from '../components/InstallPrompt'
import { WeeklySummaryModal, markWeeklySummaryDismissed, markWeeklySummaryShown, shouldShowWeeklySummary, buildWeeklySummary } from '../components/WeeklySummary'
import Confetti from '../components/Confetti'
import HealthConnect from '../components/HealthConnect'
import Disclaimer from '../components/Disclaimer'
import { isNative, readWearableData, connectHealth, healthStoreName } from '../lib/healthkit'
import { wearableCycleSignals } from '../lib/wearableCycle'
import { getUserLocal, removeUserLocal, setUserLocal } from '../lib/userLocalState'
import { signOutAndClear } from '../lib/accountSession'
import { diffCalendarDays } from '../lib/dateUtils'

const HERO_GRADIENT = {
  Menstrual:      'linear-gradient(135deg,#3d2830,#2c1f25)',
  Follicular:     'linear-gradient(135deg,#2c3828,#1f2c20)',
  Ovulatory:      'linear-gradient(135deg,#2c3035,#1f252c)',
  Luteal:         'linear-gradient(135deg,#352c20,#2c2415)',
  'Early luteal': 'linear-gradient(135deg,#352c20,#2c2415)',
  'Mid luteal':   'linear-gradient(135deg,#352c20,#2c2415)',
  'Late luteal':  'linear-gradient(135deg,#352c20,#2c2415)',
  Perimenopause:  'linear-gradient(135deg,#2c2035,#1f1528)',
  observation:    'linear-gradient(135deg,#2c2820,#1f1e18)',
  bc:             'linear-gradient(135deg,#26303a,#1a222c)',
}

// Cycle timing is context. It never overrides today's symptoms, recovery or planned training.
const FOCUS_HEAD = {
  Menstrual:'Check in with yourself', Follicular:'Build your routine', 'Early follicular':'Build your routine',
  'Late follicular':'Train to readiness', Ovulatory:'Train to readiness', 'Early luteal':'Stay consistent',
  'Mid luteal':'Train to readiness', 'Late luteal':'Train to readiness', Luteal:'Train to readiness',
  Perimenopause:'Strong and steady', bc:'Steady', observation:'Tuning in',
}
const MOVE_PLAN = {
  Menstrual:{t:'Your planned move',s:'Adjust for symptoms'}, Follicular:{t:'Your planned move',s:'Use your warm-up'},
  'Early follicular':{t:'Your planned move',s:'Use your warm-up'}, 'Late follicular':{t:'Your planned move',s:'Use your warm-up'},
  Ovulatory:{t:'Your planned move',s:'Use your warm-up'}, 'Early luteal':{t:'Your planned move',s:'Use your warm-up'},
  'Mid luteal':{t:'Your planned move',s:'Use your warm-up'}, 'Late luteal':{t:'Your planned move',s:'Adjust for symptoms'},
  Luteal:{t:'Your planned move',s:'Use your warm-up'}, Perimenopause:{t:'Strength',s:'Build consistently'},
  bc:{t:'Stay steady',s:'Weekly gains'}, observation:{t:'Move to feel',s:'Listen in'},
}
const MINDSET_PLAN = {
  Menstrual:{t:'Notice today',s:'Your experience leads'}, Follicular:{t:'Notice today',s:'Your experience leads'},
  'Early follicular':{t:'Notice today',s:'Your experience leads'}, 'Late follicular':{t:'Notice today',s:'Your experience leads'},
  Ovulatory:{t:'Notice today',s:'Your experience leads'}, 'Early luteal':{t:'Notice today',s:'Your experience leads'},
  'Mid luteal':{t:'Notice today',s:'Your experience leads'}, 'Late luteal':{t:'Notice today',s:'Your experience leads'},
  Luteal:{t:'Notice today',s:'Your experience leads'}, Perimenopause:{t:'Notice today',s:'Your experience leads'},
  bc:{t:'Steady',s:'Consistent'}, observation:{t:'Tune in',s:'Notice, log'},
}

const PHASE_DESC_BASE = {
  Menstrual:      'Estrogen and progesterone are at their lowest and prostaglandins drive cramps. Many women feel lower energy and more tired early on, then lift as the days pass. Prioritise iron-rich foods and rest, and keep your planned session if you feel good.',
  Follicular:     'Rising estrogen improves energy, mood, and how well you build muscle. Many women notice this is their easiest phase to train hard and recover. Make the most of it with progressive strength work and full fuelling.',
  Ovulatory:      'Estrogen peaks and testosterone briefly rises, so many women feel their strongest and most social now. Channel it into a challenging session, and warm up thoroughly since higher estrogen can loosen ligaments.',
  'Early luteal': 'Progesterone is rising with a calming effect and your temperature ticks up slightly. Energy often stays good, so keep training as planned and lean on steady protein and complex carbohydrates.',
  'Mid luteal':   'Progesterone peaks and your resting heart rate and temperature run a little higher, so the same effort may feel harder. Many women notice this. Keep moving, prioritise recovery, sleep, and protein.',
  'Late luteal':  'Both hormones drop and serotonin dips, so many women notice PMS, cravings, and lower mood in the days before their period. Prioritise complex carbohydrates, magnesium, and gentler training if you need it.',
  Luteal:         'Progesterone is elevated and serotonin becomes less stable, so many women notice more cravings and that workouts feel harder. Prioritise protein at every meal, steady sleep, and train from how you feel.',
  Perimenopause:  'Your hormonal landscape is shifting and estrogen is declining. Many women notice changes in sleep, mood, and recovery. Resistance training, higher protein, and consistent sleep are your strongest tools for symptoms and long-term health.',
  observation:    'We are learning your baseline. Keep logging and your personalised recommendations will sharpen from your own data. In the meantime, aim for consistent protein, balanced meals, and regular movement.',
  bc:             'Hormonal contraception changes natural-cycle tracking, and the effect depends on the method. Empower tracks your method, bleeding and symptoms without assigning a natural-cycle phase unless that is appropriate.',
}

function getPersonalisedPhaseDesc(phase, subPhase, recentLogs) {
  const key = subPhase || phase
  const base = PHASE_DESC_BASE[key] || PHASE_DESC_BASE[phase] || PHASE_DESC_BASE.observation
  if (!recentLogs?.length) return base
  const today = recentLogs[0]
  const recent = recentLogs.slice(0, 5)
  const allSymptoms = recent.flatMap(l => l.symptoms || [])
  const allMoods = recent.flatMap(l => l.mood || [])
  const energyValues = recent.map(l => l.energy).filter(Boolean)
  const sleepValues = recent.map(l => l.sleep_quality).filter(Boolean)
  const poorSleepCount = sleepValues.filter(s => s === 'Poor').length
  const lowEnergyCount = energyValues.filter(e => ['Low','Very low'].includes(e)).length
  const hasCramps = allSymptoms.some(s => ['Cramps','Cramping'].includes(s))
  const hasHighEnergy = energyValues.some(e => e === 'High')
  const hasNegMood = allMoods.some(m => ['Anxious','Irritable','Low','Sad'].includes(m))

  if (today?.energy === 'Very low')
    return `${base} You logged very low energy today. Let today’s symptoms and recovery guide your choices, and keep logging if it continues.`
  if (hasCramps && phase === 'Menstrual')
    return `${base} You logged cramps. Heat, gentle movement if comfortable, and your usual pain-relief plan may help. Seek care for severe or disruptive pain.`
  if (poorSleepCount >= 3)
    return `${base} You have logged poor sleep ${poorSleepCount} times recently. Try a steady wind-down and a comfortably cool, dark room; persistent sleep problems deserve attention regardless of cycle timing.`
  if (lowEnergyCount >= 3)
    return `${base} Your recent logs show consistently low energy. Keep tracking the timing, but consider sleep, stress, illness, medicines, nutrition and other causes too.`
  if (hasHighEnergy && ['Follicular','Ovulatory'].includes(phase))
    return `${base} You logged high energy. If your warm-up agrees, you can continue with the session you planned.`
  if (hasNegMood && ['Late luteal','Mid luteal','Luteal'].includes(key))
    return `${base} You logged anxious or low mood. Cycle timing may be one contributor, alongside sleep, stress, health and life events. Keep logging the timing; seek support if it is severe or persistent.`
  return base
}

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)
  const [weeklyModal, setWeeklyModal] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [weeklySummary, setWeeklySummary] = useState(null)
  const [coachOpen, setCoachOpen] = useState(false)
  const [lateOpen, setLateOpen] = useState(false)
  const [pendingFriends, setPendingFriends] = useState(0)
  const [wear, setWear] = useState(null)
  const [healthConnected, setHealthConnected] = useState(false)
  const [resyncing, setResyncing] = useState(false)

  useEffect(() => { load() }, [])

  // Re-run the Apple Health / Health Connect permission sheet, then reload so the tiles re-read.
  // Recovers the common case where Sleep or Wrist Temperature was left OFF in the first grant —
  // iOS never re-prompts on its own, so we give her a manual way to turn them on.
  async function resyncHealth() {
    if (!d?.userId) return
    setResyncing(true)
    const ok = await connectHealth()
    if (ok) {
      const data = await readWearableData()
      if (data?.hasAnyData) {
        setUserLocal(d.userId, 'healthConnected', '1')
        window.location.reload()
        return
      }
    }
    setResyncing(false)
  }

  function disconnectHealth() {
    if (!d?.userId) return
    removeUserLocal(d.userId, 'healthConnected')
    removeUserLocal(d.userId, 'wearableSignals')
    setHealthConnected(false)
    setWear(null)
  }

  // Read the connected wearable (native only) and surface the live numbers in Today's Focus.
  // Also refreshes the stored ovulation signal that the cycle guardian uses. No-op on web.
  useEffect(() => {
    if (!isNative()) return
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || !getUserLocal(user.id, 'healthConnected') || cancelled) return
      setHealthConnected(true)
      const data = await readWearableData()
      if (!data) return
      setUserLocal(user.id, 'wearableSignals', JSON.stringify(wearableCycleSignals(data)))
      const rhr = data.restingHR?.[0] != null ? Math.round(data.restingHR[0]) : null
      const tempC = data.temps?.length ? Math.round(data.temps[data.temps.length - 1].value * 10) / 10 : null
      const sleepH = data.sleepHours != null ? Math.round(data.sleepHours * 10) / 10 : null
      setWear({ rhr, hrv: data.hrv?.[0] != null ? Math.round(data.hrv[0]) : null, tempC, sleepHours: sleepH, tempDays: data.temps?.length || 0, hasAny: data.hasAnyData })

      // Auto-sync today's wearable readings into the daily log, so the algorithm uses them and she
      // never re-enters what the wearable already knows. Only writes fields that actually have
      // data (blank days stay blank), and only plausible values. A partial upsert leaves her
      // manually-logged fields (energy/mood/symptoms) untouched.
      try {
        const dateStr = localDateStr()
        // Only FILL fields that are currently empty for today. This makes the wearable the default
        // source, while any manual value you type in the Log wins and is never overwritten on a
        // later app open (a set value is left alone).
        const [{ data: existing }, { data: wearableProfile }] = await Promise.all([
          supabase.from('daily_logs').select('resting_hr_exact,wrist_temp,sleep_hours').eq('user_id', user.id).eq('log_date', dateStr).maybeSingle(),
          supabase.from('profiles').select('user_path,bc_type').eq('id', user.id).maybeSingle(),
        ])
        const payload = { user_id: user.id, log_date: dateStr, hormonal_context:getHormonalContext(wearableProfile) }
        if (existing?.resting_hr_exact == null && rhr != null && rhr >= 25 && rhr <= 200) payload.resting_hr_exact = rhr
        if (existing?.wrist_temp == null && tempC != null && tempC >= 30 && tempC <= 43) {
          payload.wrist_temp = tempC
          payload.temperature_source = 'wearable-wrist'
        }
        if (existing?.sleep_hours == null && sleepH != null && sleepH >= 0 && sleepH <= 24) payload.sleep_hours = sleepH
        if (Object.keys(payload).length > 3) {
          await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id,log_date' })
        }
      } catch { /* non-fatal, the numbers still show on the dashboard */ }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }

      const cutoffDate = (daysAgo) => {
        const date = new Date(); date.setHours(0,0,0,0); date.setDate(date.getDate() - daysAgo)
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
      }
      const [{ data: profile }, { data: cycleData }, { data: rawRecentLogs }, { data: rawTwoWeekLogs }, { data: rawHistoryLogs }, { data: pendingRequests }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('cycle_data').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('daily_logs').select('energy,resting_hr,resting_hr_exact,wrist_temp,log_date,sleep_quality,disruptors,symptoms,mood,hormonal_context').eq('user_id', user.id).gte('log_date', cutoffDate(6)).order('log_date', { ascending: false }),
        supabase.from('daily_logs').select('log_date,energy,sleep_quality,mood,workout_feel,stress_level,hormonal_context,workout_imported,workout_feel_reported').eq('user_id', user.id).gte('log_date', cutoffDate(13)).order('log_date', { ascending: false }),
        supabase.from('daily_logs').select('log_date,energy,mood,symptoms,hormonal_context,workout_imported,workout_feel_reported').eq('user_id', user.id).order('log_date', { ascending: false }).limit(365),
        supabase.from('friendships').select('id').eq('addressee_id', user.id).eq('status', 'pending'),
      ])
      setPendingFriends(pendingRequests?.length || 0)

      // No profile, or onboarding not finished → send to setup. AuthGuard normally
      // catches this, but guarding here too means a profile-less user never lands on a
      // broken dashboard.
      if (!profile || !profile.onboarding_complete) { navigate('/setup', { replace: true }); return }

      const bw = profile?.body_weight_kg || null
      const isPath4 = profile?.user_path === '4'
      // Hormonal BC (path 5, excluding the non-hormonal copper IUD) suppresses the
      // natural cycle, these users have no real cycle phase even if a last-period
      // date exists in cycle_data, so we must not compute one.
      const isHormonalBC = profile?.user_path === '5' && profile?.bc_type !== 'copper-iud'

      // Single source of truth shared with Workout/Nutrition. Fetched once here so the
      // dashboard can never disagree with those screens about the user's phase.
      let status = null
      try { status = await getTodayStatus(supabase, user.id) }
      catch (e) {
        // A real data-loading failure must show the explicit "couldn't load" UI below, never a
        // fabricated/observation dashboard. Unexpected non-critical errors fall through with null.
        if (e instanceof HealthDataError) throw e
        console.error('getTodayStatus (non-critical):', e)
      }
      // Push today's real phase-based plan to the paired Apple Watch as soon as the app opens
      // (iOS only; no-ops on web/Android or with no watch). Without this the watch only synced
      // when the Workout screen was opened, so it kept showing the built-in sample ("Luteal").
      if (status) syncPlanToWatch(status)
      const contextKey = status?.contextKey || getHormonalContext(profile)
      const inCurrentContext = log => log?.hormonal_context ? log.hormonal_context === contextKey : true
      const recentLogs = (rawRecentLogs || []).filter(inCurrentContext)
      const twoWeekLogs = (rawTwoWeekLogs || []).filter(inCurrentContext)
      const historyLogs = (rawHistoryLogs || []).filter(inCurrentContext)

      let phase = 'observation', subPhase = null, cycleDay = null, cycleLen = 28, daysLeft = null, confidence = 0.05
      let bcBleedDay = null, bcInBleedWindow = false
      let estimated = false   // phase inferred from symptoms (no logged period)

      if (isPath4) {
        phase = 'Perimenopause'; subPhase = status?.subPhase || null; confidence = status?.confidence ?? 0.5
      } else if (isHormonalBC && status) {
        // Hormonal methods affect ovulation differently, so we do not assign an unverified
        // natural phase. For a user who explicitly supplied a scheduled pill/patch/ring bleed,
        // retain a pack-calendar estimate; continuous regimens and unscheduled bleeding skip it.
        phase = 'bc'
        subPhase = status.subPhase            // e.g. "Combined pill", "Hormonal IUD"
        confidence = status.confidence || 0.3
        const hasScheduledCycle = ['pill', 'patch', 'ring'].includes(profile?.bc_type)
        if (hasScheduledCycle && cycleData?.last_period_date) {
          const lastBleed = new Date(cycleData.last_period_date + 'T00:00:00')
          const today = new Date(); today.setHours(0,0,0,0)
          cycleLen = cycleData.cycle_length || 28
          let day = diffCalendarDays(today, lastBleed) + 1
          if (day > cycleLen) day = ((day - 1) % cycleLen) + 1   // fold into the current pack
          bcBleedDay = day
          daysLeft = Math.max(0, cycleLen - day + 1)
          // Period-like symptoms cluster around the withdrawal bleed (pack start / end)
          bcInBleedWindow = day <= 5 || daysLeft <= 2
        }
      } else if (status) {
        // The shared status pipeline includes learned cycle length, symptom inference, and
        // wearable temperature-shift estimates. It is the only phase source used by every screen.
        phase = status.phase || 'observation'
        subPhase = status.subPhase || null
        cycleDay = status.cycleDay ?? null
        cycleLen = status.cycleLen || 28
        daysLeft = status.daysUntilPeriod ?? null
        confidence = status.confidence ?? 0.05
        estimated = !!status.estimated
      }

      const today = localDateStr()
      const { data: rawTodayLog } = await supabase.from('daily_logs').select('energy,sleep_quality,mood,symptoms,workout_feel,disruptors,resting_hr,resting_hr_exact,wrist_temp,lh_result,flow_volume,pain_rating,hormonal_context').eq('user_id', user.id).eq('log_date', today).maybeSingle()
      const todayLog = inCurrentContext(rawTodayLog) ? rawTodayLog : null
      // "Logged" means the user actively logged something (energy/sleep/mood/symptoms/etc.), NOT
      // merely that a row exists — the wearable auto-sync writes a temp/HR/sleep-only row, and that
      // must never count as her having logged the day (would fake the streak and hide "Log today").
      const isManualLog = (l) => !!(l && (l.energy || l.sleep_quality || (l.mood && l.mood.length) || (l.symptoms && l.symptoms.length) || (l.disruptors && l.disruptors.length) || l.workout_feel || l.flow_volume || l.pain_rating))
      const alreadyLogged = isManualLog(todayLog)

      let streak = 0
      if (recentLogs?.length) {
        const check = new Date(); check.setHours(0,0,0,0)
        for (const log of recentLogs.filter(isManualLog)) {
          const diff = diffCalendarDays(check, log.log_date + 'T00:00:00')
          if (diff === streak) { streak++; check.setDate(check.getDate() - 1) } else break
        }
      }

      let anomalyItems = []
      if (status?.anomalies?.length) anomalyItems.push(...status.anomalies.map(a => ({ type: 'anomaly', text: a.text || a.message })))
      if (status?.moodInsight?.message) anomalyItems.push({ type: 'mood', text: status.moodInsight.message })

      // Weekly summary, show as a non-intrusive card whenever there are at least 3
      // logs this calendar week. Tapping the card opens the full modal. It no longer
      // auto-opens as a modal, and no longer depends on localStorage to dedupe (which
      // some browsers clear, making the insight pop up again every day).
      // Compute this week's insights every day so the dashboard "Insights" card can show them.
      // (The auto-popping standalone card still only appears on Sundays, as a deliberate recap.)
      if (twoWeekLogs) {
        const thisWeekCount = twoWeekLogs.filter(l => diffCalendarDays(new Date(), l.log_date + 'T00:00:00') < 7).length
        if (thisWeekCount >= 1) {
          // Pass the honest personalisation fraction (not the internal flag-gating confidence) so
          // the weekly recap shows "Personalisation is at X%" consistent with the rest of the app.
          const personalisationFrac = status?.personalisationPct != null ? status.personalisationPct / 100 : confidence
          const summary = buildWeeklySummary(twoWeekLogs, phase, subPhase, personalisationFrac, daysLeft, cycleDay, cycleData?.cycle_length || 28)
          // Looking ahead, predicted from her own past cycles (needs a couple of cycles first).
          const lookingAhead = buildPhaseOutlook({ logs: historyLogs || [], lastPeriodDate: cycleData?.last_period_date, periodStarts: parsePeriodStarts(cycleData), cycleLen: cycleData?.cycle_length || 28, cycleDay })
          setWeeklySummary({ ...summary, lookingAhead })
          // Weekly review = a once-a-week moment, shown on the FIRST app-open of the week
          // (not every day). Guards, in order: (1) shouldShowWeeklySummary — not already shown
          // this calendar week (localStorage) AND at least WEEKLY_MIN_LOGS logs in the past
          // week; (2) the review must actually have content (a real highlight or a workout),
          // so we never show a hollow one. We only mark it shown when it actually opens, so a
          // thin early-week review can still appear later once there's enough to say.
          const hasContent = (summary.highlights?.length >= 1) || summary.workouts > 0
          if (hasContent && shouldShowWeeklySummary(twoWeekLogs, user.id)) {
            markWeeklySummaryShown(user.id)
            setTimeout(() => { setShowConfetti(true); setWeeklyModal(true) }, 400)
          }
        }
      }

      // Daily Coach, pure synthesis of the status we already have (no new data). First name only.
      const firstName = (profile?.name || '').trim().split(/\s+/)[0] || null
      const coach = buildDailyCoach(status, new Date().getHours(), firstName)
      setD({ userId:user.id, profile, phase, subPhase, cycleDay, cycleLen, daysLeft, confidence, bw, proteinRangeG: status?.nutritionTargets?.proteinRangeG || null, bcBleedDay, bcInBleedWindow, alreadyLogged, todayLog, streak, recentLogs, twoWeekLogs, anomalyItems, isPath4, estimated, latePeriod: status?.latePeriod || false, daysLate: status?.daysLate || 0, latePeriodInsights: status?.latePeriodInsights || [], nextPeriod: status?.nextPeriodPrediction || null, userEmail: user.email, coach, status })
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return <><div style={{ paddingTop: 60 }}><Spinner /></div><BottomNav /></>
  if (!d) return (
    <>
      <div style={{ padding:'80px 24px', textAlign:'center', color:'#7a7268' }}>
        <div style={{ fontSize:14, marginBottom:16, lineHeight:1.6 }}>We could not load your dashboard. Check your connection and try again.</div>
        <button onClick={() => { setLoading(true); load() }} style={{ background:'#2c2820', color:'#f5f0e8', border:'none', borderRadius:12, padding:'12px 24px', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Try again</button>
      </div>
      <BottomNav />
    </>
  )

  // ── Pregnancy mode (path 6), a distinct, safe home: no cycle UI, a prominent safety net,
  //    and everything points back to her provider. ──────────────────────────────────────────
  if (d.profile?.user_path === '6') {
    const week = getPregnancyWeek(d.profile.pregnancy_due_date)
    const tri = getTrimester(week) || 'Pregnancy'
    const pProtein = d.proteinRangeG ? `${d.proteinRangeG[0]}–${d.proteinRangeG[1]}g` : 'Add weight for a range'
    const navCard = (icon, iconColor, iconBg, title, sub, to) => (
      <div className="card" style={{ cursor:'pointer', marginBottom:10 }} onClick={() => navigate(to)}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={`ti ${icon}`} style={{ fontSize:20, color:iconColor }} /></div>
          <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:600 }}>{title}</div><div style={{ fontSize:13, color:'#7a7268' }}>{sub}</div></div>
          <i className="ti ti-chevron-right" style={{ color:'#c8b89a', fontSize:18, flexShrink:0 }} />
        </div>
      </div>
    )
    return (
      <>
        <div style={{ background:'#f5f0e8', padding:'calc(20px + var(--sat)) 20px 16px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' }}>Em~power</div>
          <button onClick={async () => { await signOutAndClear(d.userId); navigate('/login', { replace:true }) }} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Sign out</button>
        </div>
        <div style={{ padding:'16px 16px 100px' }}>
          <div style={{ borderRadius:16, padding:'28px 24px', color:'#e8e0d4', background:'linear-gradient(135deg, #3a2c3a, #2a1f2a)', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(232,224,212,0.6)', marginBottom:6 }}>Pregnancy</div>
            <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:24, marginBottom:6 }}>{tri}</div>
            {week && <div style={{ fontSize:13, color:'rgba(232,224,212,0.75)', marginBottom:14 }}>Around week {week} of 40</div>}
            <div style={{ fontSize:13, color:'rgba(232,224,212,0.8)', lineHeight:1.7 }}>Cycle tracking pauses while you are pregnant. Your care now is led by your doctor or midwife. Em~power is here for support and learning, never a replacement for prenatal care.</div>
          </div>

          {/* Safety net, always visible */}
          <div style={{ background:'#fdeeee', border:'1px solid #e8b0a0', borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#a83a20', marginBottom:8 }}>When to get care now</div>
            <div style={{ fontSize:13, color:'#5a2a20', lineHeight:1.65 }}>
              Contact your provider right away, or emergency services if it is severe, for any of: vaginal bleeding or fluid leaking; a severe or lasting headache, vision changes, or sudden swelling of your face or hands; severe belly pain; your baby moving much less than usual; regular contractions before 37 weeks; chest pain, trouble breathing, or a painful, swollen leg; a fever; or thoughts of harming yourself. Always tell them you are pregnant.
            </div>
            <div style={{ fontSize:11, color:'#9a6a58', marginTop:8, fontStyle:'italic' }}>Urgent maternal warning signs (CDC / ACOG). In crisis, call or text 988.</div>
          </div>

          {navCard('ti-salad', '#2a6a2a', '#e8f8e8', 'Prenatal nutrition', `Protein guidance: ${pProtein}`, '/nutrition')}
          {navCard('ti-book-2', '#7a4a9a', '#f0e8f8', 'Your pregnancy guide', 'Trimesters, safe movement, what to expect', '/learn')}
          {navCard('ti-moon', '#2a4a7a', '#e8f0f8', 'Sleep guide', 'Rest well through pregnancy', '/sleep')}
          {navCard('ti-message-chatbot', '#6a6a9a', '#f0f0f8', 'Ask Em~power', 'Questions about your body and your data', '/ask')}

          <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginTop:4 }}>
            <div style={{ fontSize:12, color:'#7a7268', lineHeight:1.65 }}>Keep all your prenatal appointments, and when in doubt, call your provider. You know your body, your instinct is worth listening to. 🌿</div>
          </div>

          <div style={{ textAlign:'center', marginTop:16, display:'flex', justifyContent:'center', gap:20 }}>
            <button onClick={() => navigate('/setup?edit=1')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Change information</button>
            <button onClick={() => navigate('/feedback')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Share feedback</button>
            <button onClick={() => navigate('/privacy')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Privacy &amp; data</button>
          </div>
        </div>
        <BottomNav />
      </>
    )
  }

  const { phase, subPhase, cycleDay, cycleLen, daysLeft, bcBleedDay, bcInBleedWindow, alreadyLogged, recentLogs, anomalyItems, estimated, latePeriod, daysLate, latePeriodInsights } = d
  const phaseLabel = phase === 'observation' ? 'Observation mode'
    : phase === 'Perimenopause' ? (subPhase || 'Perimenopause')
    : phase === 'bc' ? (subPhase || 'Hormonal birth control')
    : `${subPhase || phase} phase`
  // Age-aware guidance: teens with new/irregular cycles need reassurance that irregularity
  // is normal for the first few years (ACOG Committee Opinion 651).
  const userAge = d.profile?.birth_year ? new Date().getFullYear() - d.profile.birth_year : null
  const teenIrregular = userAge != null && userAge <= 19 && (estimated || phase === 'observation' || d.profile?.user_path === '3')
  const heroGrad = HERO_GRADIENT[subPhase] || HERO_GRADIENT[phase] || HERO_GRADIENT.observation

  return (
    <>
      <div style={{ background:'#f5f0e8', padding:'calc(20px + var(--sat)) 20px 16px', borderBottom:'1px solid #ede8e0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase' }}>Em~power</div>
        <div style={{ display:'flex', alignItems:'center', gap:18 }}>
          <button onClick={() => navigate('/friends')}
            style={{ background:'none', border:'none', fontSize:12, color:'#7a6a50', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
            Friends{pendingFriends > 0 ? ` (${pendingFriends})` : ''}
          </button>
          <button onClick={async () => { await signOutAndClear(d.userId); navigate('/login', { replace:true }) }}
            style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding:'16px 16px 100px' }}>

        {/* Greeting */}
        {d.coach && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:25, fontWeight:700, color:'#2c2820' }}>{d.coach.greeting} {new Date().getHours() < 18 ? '☀️' : '🌙'}</div>
          </div>
        )}

        {/* Apple Health / wearable connect — native iOS only, renders nothing on web. */}
        <HealthConnect userId={d.userId} />

        {/* Retention: prompt install (home-screen apps return far better than browser tabs). */}
        <InstallPrompt />

        {/* Activation: a brand-new user (no logs yet) is dropped on the dashboard after setup
            with nothing pulling them to log. Give them one clear first action so they reach
            value, the personalised insights only start once they log. */}
        {recentLogs && recentLogs.length === 0 && (
          <div onClick={() => navigate('/checkin')} style={{ background:'linear-gradient(135deg,#3f6a3a,#2f5230)', color:'#eef5ea', borderRadius:16, padding:'16px 18px', marginBottom:14, cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}>
            <i className="ti ti-seeding" style={{ fontSize:24, color:'#bfe3b0', flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:2 }}>Start with a 30-second check-in</div>
              <div style={{ fontSize:12.5, color:'rgba(238,245,234,0.85)', lineHeight:1.5 }}>Your personalised insights begin the moment you log your first day. It only takes a minute.</div>
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize:18, color:'rgba(238,245,234,0.8)', flexShrink:0 }} />
          </div>
        )}


        {(() => {
          const eff = subPhase || phase
          const focusHead = FOCUS_HEAD[eff] || FOCUS_HEAD[phase] || 'Today'
          const strong = ['High energy','Peak energy','Energy building'].includes(focusHead)
          const move = MOVE_PLAN[eff] || MOVE_PLAN[phase] || { t:'Move to feel', s:'Listen in' }
          const mind = MINDSET_PLAN[eff] || MINDSET_PLAN[phase] || { t:'Tune in', s:'Notice and log' }
          const tl = d.todayLog || {}
          const cycleText = phase === 'bc'
            ? (bcBleedDay ? (bcInBleedWindow ? `Day ${bcBleedDay} of your pill cycle · bleed likely now` : `Day ${bcBleedDay} · next bleed in about ${daysLeft} days`) : 'Steady hormones, tracking symptoms')
            : cycleDay ? `Day ${cycleDay} of ${cycleLen}` : estimated ? 'Estimated from your symptoms' : 'Tracking your patterns'
          const np = d.nextPeriod
          const stripT = dt => { const x = new Date(dt); x.setHours(0,0,0,0); return x }
          const daysToNext = np ? Math.max(0, diffCalendarDays(stripT(np.predictedDate), stripT(new Date()))) : daysLeft
          const fmtLong = dt => new Date(dt).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
          const fmtShort = dt => new Date(dt).toLocaleDateString('en-US', { month:'short', day:'numeric' })
          return (
          <>
            {/* Today's Focus */}
            <div style={{ background:'#f7f3ec', border:'1px solid #ece4d6', borderRadius:18, padding:'18px 20px', marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:6 }}>Today's focus</div>
              <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:26, color: strong ? '#3f6a3a' : '#8a6a4a', marginBottom:3 }}>{focusHead}</div>
              <div style={{ fontSize:14, color:'#7a7268' }}>{d.coach?.focus?.sub || ''}</div>
              {d.coach?.recoveryNote && <div style={{ fontSize:12, color:'#8a6a3a', background:'#fbf3e6', border:'1px solid #ece0c8', borderRadius:10, padding:'9px 12px', lineHeight:1.5, marginTop:12 }}>{d.coach.recoveryNote}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:16, paddingTop:16, borderTop:'1px solid #ece4d6' }}>
                {(healthConnected ? [
                  // Connected to Apple Health: the tiles show live wearable data instead of
                  // manual logs (temperature, sleep, heart rate). Cycle day stays the same. A
                  // signal with no data yet shows a dash (never a fake value) — the hint below
                  // explains how to turn it on, since people will not wear their device every day.
                  { icon:'ti-temperature', label:'Temp', val: wear?.tempC != null ? `${wear.tempC.toFixed(1)}°` : '—' },
                  { icon:'ti-zzz', label:'Sleep', val: wear?.sleepHours != null ? `${wear.sleepHours.toFixed(1)}h` : '—' },
                  { icon:'ti-heartbeat', label:'Heart rate', val: wear?.rhr != null ? `${wear.rhr} bpm` : '—' },
                  { icon:'ti-calendar-heart', label:'Cycle', val: cycleDay ? `Day ${cycleDay}` : '—' },
                ] : [
                  { icon:'ti-bolt', label:'Energy', val: tl.energy || ', ' },
                  { icon:'ti-zzz', label:'Sleep', val: tl.sleep_quality || ', ' },
                  { icon:'ti-mood-smile', label:'Mood', val: (tl.mood && tl.mood[0]) || ', ' },
                  { icon:'ti-calendar-heart', label:'Cycle', val: cycleDay ? `Day ${cycleDay}` : ', ' },
                ]).map((m,i) => (
                  <div key={i} style={{ textAlign:'center' }}>
                    <i className={`ti ${m.icon}`} style={{ fontSize:19, color:'#a89878' }} />
                    <div style={{ fontSize:13, fontWeight:600, color:'#2c2820', marginTop:4 }}>{m.val}</div>
                    <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', color:'#9a9590', marginTop:2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
              {healthConnected && (
                <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color:'#b0a488', marginTop:10, textAlign:'center' }}>
                  <i className="ti ti-heartbeat" style={{ fontSize:12, marginRight:4, verticalAlign:'-1px' }} />Live from {healthStoreName()}
                </div>
              )}
              {healthConnected && (wear?.tempC == null || wear?.sleepHours == null) && (() => {
                const missing = [wear?.tempC == null && 'temperature', wear?.sleepHours == null && 'sleep'].filter(Boolean).join(' and ')
                return (
                  <div style={{ fontSize:12, color:'#8a6a3a', background:'#fbf3e6', border:'1px solid #ece0c8', borderRadius:10, padding:'9px 12px', lineHeight:1.5, marginTop:10 }}>
                    No {missing} from {healthStoreName()} yet. Open {healthStoreName()} → Sharing → Apps → Em~power and switch on {missing}, and wear your watch to bed so it can record overnight {missing}.
                    <button onClick={resyncHealth} disabled={resyncing} style={{ display:'block', width:'100%', marginTop:8, padding:'8px', borderRadius:9, background:'#2c2820', color:'#f5f0e8', border:'none', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      {resyncing ? 'Syncing…' : `Re-sync ${healthStoreName()} permissions`}
                    </button>
                  </div>
                )
              })()}
              {healthConnected && (
                <button onClick={disconnectHealth} style={{ display:'block', margin:'9px auto 0', background:'none', border:'none', color:'#9a9590', fontSize:11.5, textDecoration:'underline', cursor:'pointer', fontFamily:'inherit' }}>
                  Disconnect in Em~power
                </button>
              )}
              {!alreadyLogged && <button onClick={() => navigate('/log')} style={{ width:'100%', marginTop:14, padding:'11px', borderRadius:12, background:'#2c2820', color:'#f5f0e8', border:'none', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Log today</button>}
            </div>

            {/* Your Cycle */}
            <div style={{ borderRadius:18, padding:'20px', color:'#e8e0d4', background:heroGrad, marginBottom:14 }}>
              <div style={{ display:'flex', gap:14 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(232,224,212,0.6)', marginBottom:6 }}>{estimated ? 'Estimated cycle' : phase === 'bc' ? 'Your pill cycle' : 'Your cycle'}</div>
                  <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:23, marginBottom:4 }}>{estimated ? `Looks like ${phaseLabel}` : phaseLabel}</div>
                  <div style={{ fontSize:13, color:'rgba(232,224,212,0.72)', marginBottom:10 }}>{cycleText}</div>
                  <div style={{ fontSize:13, color:'rgba(232,224,212,0.82)', lineHeight:1.6 }}>{getPersonalisedPhaseDesc(phase, subPhase, recentLogs)}</div>
                </div>
                {np && phase !== 'bc' && cycleDay && !latePeriod && (
                  <div style={{ width:110, height:110, borderRadius:'50%', border:'2px dashed rgba(232,224,212,0.4)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <div style={{ fontSize:26, fontWeight:700 }}>{daysToNext}</div>
                    <div style={{ fontSize:9, color:'rgba(232,224,212,0.7)', textAlign:'center', lineHeight:1.2, padding:'2px 10px 0' }}>days to next period</div>
                  </div>
                )}
              </div>
              {/* Concrete next-period prediction from the user's own history. */}
              {np && phase !== 'bc' && !latePeriod && (
                <div style={{ marginTop:14, padding:'12px 14px', background:'rgba(232,224,212,0.12)', borderRadius:12 }}>
                  <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(232,224,212,0.7)', marginBottom:3 }}>Next period</div>
                  <div style={{ fontSize:17, fontWeight:700 }}>{fmtLong(np.predictedDate)}</div>
                  <div style={{ fontSize:12, color:'rgba(232,224,212,0.72)', marginTop:3, lineHeight:1.5 }}>
                    {np.irregular
                      ? `Your cycles vary, so likely anytime ${fmtShort(np.windowStart)} to ${fmtShort(np.windowEnd)}.`
                      : `Most likely ${fmtShort(np.windowStart)} to ${fmtShort(np.windowEnd)}.`}
                    {(np.confidence === 'low' || np.confidence === 'none') ? ' This sharpens as you log more cycles.' : ''}
                  </div>
                </div>
              )}
              {estimated && <div style={{ fontSize:12, color:'rgba(232,224,212,0.6)', lineHeight:1.5, marginTop:12, fontStyle:'italic' }}>Estimated from cycle-specific observations without a period anchor. Logging a period start improves the calendar estimate, but no method makes it exact.</div>}
              <button onClick={() => navigate('/workout')} style={{ marginTop:16, background:'rgba(232,224,212,0.16)', border:'1px solid rgba(232,224,212,0.3)', borderRadius:22, padding:'9px 16px', color:'#e8e0d4', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6 }}>Plan workout <i className="ti ti-chevron-right" style={{ fontSize:14 }} /></button>
            </div>

            {/* Today's Plan */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590' }}>Today's plan</span>
              {d.coach && <button onClick={() => setCoachOpen(o => !o)} style={{ background:'none', border:'none', fontSize:12, color:'#9a8a6a', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>{coachOpen ? 'Hide plan' : 'View full plan ›'}</button>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 }}>
              {[
                { icon:'ti-barbell', c:'#5f7a4f', bg:'#e8eede', label:'Move', t:move.t, s:move.s, to:'/workout' },
                { icon:'ti-salad', c:'#9a7838', bg:'#f2e9d4', label:'Nourish', t:'Protein', s: d.proteinRangeG ? `${d.proteinRangeG[0]}–${d.proteinRangeG[1]}g range` : 'Add weight for a range', to:'/nutrition' },
                { icon:'ti-moon', c:'#7a6f5c', bg:'#ece5d7', label:'Restore', t:'Sleep', s:'7 to 9 hrs', to:'/sleep' },
                { icon:'ti-mood-heart', c:'#9a6656', bg:'#f0e2da', label:'Mindset', t:mind.t, s:mind.s, to:null },
              ].map((p,i) => (
                <div key={i} onClick={() => p.to && navigate(p.to)} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:'14px 10px 15px', minHeight:132, display:'flex', flexDirection:'column', cursor: p.to ? 'pointer' : 'default' }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:p.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}><i className={`ti ${p.icon}`} style={{ fontSize:17, color:p.c }} /></div>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:p.c, marginBottom:5 }}>{p.label}</div>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'#2c2820', lineHeight:1.25 }}>{p.t}</div>
                  <div style={{ fontSize:11, color:'#9a9590', marginTop:'auto', paddingTop:4 }}>{p.s}</div>
                </div>
              ))}
            </div>
            {coachOpen && d.coach && (
              <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12, display:'flex', flexDirection:'column', gap:14 }}>
                <CoachRow icon="ti-barbell" label="Training" body={d.coach.training} onClick={() => navigate('/workout')} />
                <CoachRow icon="ti-salad" label="Nutrition" body={d.coach.nutrition.join(' ')} onClick={() => navigate('/nutrition')} />
                <CoachRow icon="ti-moon" label="Sleep" body={d.coach.sleep} onClick={() => navigate('/sleep')} />
                <CoachRow icon="ti-mood-heart" label="Mindset" body={d.coach.mindset} />
              </div>
            )}
          </>
          )
        })()}

        {/* Weekly insights live in the "Insights this week" card in the bottom row (not here). */}

        {/* Teen reassurance, irregular cycles are normal in the years after menarche */}
        {teenIrregular && (
          <div style={{ background:'#f5f0e8', borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:16, marginBottom:6 }}>Early cycles can be irregular</div>
            <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.65 }}>
              Irregular timing is common in the first few years after a first period, but symptoms still deserve attention. A gap longer than 90 days, bleeding longer than 7 days, soaking through protection every 1 to 2 hours, faintness, or pain that stops daily activity is worth discussing with a healthcare professional. (ACOG, Menstruation in Girls and Adolescents)
            </div>
          </div>
        )}

        {/* Birth control context, explains why we track a pill cycle, not a true cycle */}
        {phase === 'bc' && (
          <div style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <i className="ti ti-info-circle" style={{ color:'#c8b89a', fontSize:18, flexShrink:0, marginTop:1 }} />
              <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.6 }}>
                Birth control methods affect ovulation and bleeding differently. Empower does not assign a natural cycle phase when it cannot verify one. For scheduled pill, patch or ring use, it can track the schedule you entered; for IUDs, implants, injections and mini-pills it tracks bleeding and symptoms without inventing a 28-day pack cycle.
              </div>
            </div>
          </div>
        )}

        {/* First-time card */}
        {!alreadyLogged && (!recentLogs || recentLogs.length === 0) && (
          <div className="card" style={{ marginBottom:12, border:'1px solid #c8b89a', background:'#faf6ef' }}>
            <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, marginBottom:6 }}>Welcome to Em~power</div>
            <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.65, marginBottom:6 }}>Your first check-in takes under a minute. Each meaningful log helps Empower compare your symptoms, workouts and sleep with your own cycle history.</div>
            <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.65, marginBottom:14 }}>Early guidance uses clearly labelled population ranges. Personal patterns appear only after they repeat in your data.</div>
            <button className="btn-primary" onClick={() => navigate('/log')}>Log today · under a minute</button>
          </div>
        )}


        {/* Anomaly only, mood insight removed (shown in calendar instead) */}
        {anomalyItems.filter(i => i.type !== 'mood').map((item, i) => (
          <div key={i} style={{ background:'#fff', border:'1px solid #ede8e0', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:4 }}>Something worth noting</div>
            <div style={{ fontSize:13, color:'#3a3530', lineHeight:1.6 }}>{item.text}</div>
          </div>
        ))}

        {/* Nutrition card removed, nutrition guidance lives in the Today's Focus dropdown and the
            bottom nav, so it is no longer duplicated as a standalone dashboard card. */}

        {/* Sleep card removed, sleep guidance is now the tappable Sleep row in the Today's
            Focus dropdown (taps through to the full Sleep screen). */}

        {/* Friends now live on their own screen, reachable from "Friends" in the top header. */}

        {/* "Your cycle phases" grid moved to Learn, the home screen stays focused on today.
            The interactive grid + detail sheet now live on the Learn tab. */}

        {/* Ask Em~power, with quick-question chips */}
        <div onClick={() => navigate('/ask')} style={{ cursor:'pointer', marginTop:4, marginBottom:12, border:'1px solid #ddd8ea', background:'#fbfaff', borderRadius:16, padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <i className="ti ti-sparkles" style={{ fontSize:16, color:'#6a6a9a' }} />
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#6a6a9a' }}>Ask Em~power</span>
          </div>
          <div style={{ fontSize:16, fontWeight:600, color:'#2c2820', marginBottom:12 }}>What can I help you with today?</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['What should I eat today?', 'What workout today?', 'Why am I tired?'].map((q,i) => (
              <span key={i} onClick={(e) => { e.stopPropagation(); navigate(`/ask?q=${encodeURIComponent(q)}`) }} style={{ fontSize:12, color:'#4a4a6a', background:'#fff', border:'1px solid #e0dcee', borderRadius:16, padding:'7px 12px', cursor:'pointer' }}>{q}</span>
            ))}
          </div>
        </div>

        {/* Insights this week and Prep for a doctor visit are no longer daily cards here:
            the weekly review is a once-a-week (Sunday) moment with confetti, and doctor prep
            now lives in the Learn tab. */}

        <div style={{ textAlign:'center', marginTop:16, display:'flex', justifyContent:'center', gap:20 }}>
          <button onClick={() => navigate('/setup?edit=1')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Change information</button>
          <button onClick={() => navigate('/feedback')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Share feedback</button>
          <button onClick={() => navigate('/privacy')} style={{ background:'none', border:'none', fontSize:12, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Privacy &amp; data</button>
        </div>
        <Disclaimer>Em~power offers general wellness information, not medical advice or contraception; see Privacy &amp; data for the full disclaimer.</Disclaimer>
      </div>
      <BottomNav />

      {/* Late-period flag, a small tap-to-open flag above the nav, not a big card taking
          over the home screen. Opens a sheet with the personalised contributors + guidance. */}
      {latePeriod && daysLate >= 2 && !lateOpen && (
        <button onClick={() => setLateOpen(true)} style={{ position:'fixed', bottom:74, left:'50%', transform:'translateX(-50%)', zIndex:150, display:'flex', alignItems:'center', gap:7, background:'#fff', border:'1px solid #e0b0a0', borderRadius:22, padding:'8px 14px', boxShadow:'0 3px 12px rgba(44,40,32,0.16)', cursor:'pointer', fontFamily:'inherit' }}>
          <i className="ti ti-flag-filled" style={{ fontSize:15, color:'#c0503a' }} />
          <span style={{ fontSize:13, fontWeight:600, color:'#8a3020' }}>Period {daysLate} day{daysLate===1?'':'s'} late</span>
          <i className="ti ti-chevron-up" style={{ fontSize:14, color:'#b08070' }} />
        </button>
      )}
      {latePeriod && daysLate >= 2 && lateOpen && (
        <>
          <div onClick={() => setLateOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(44,40,32,0.4)', zIndex:200 }} />
          <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:420, background:'#faf8f5', borderRadius:'20px 20px 0 0', zIndex:201, padding:'16px 20px 40px', maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ width:36, height:4, background:'#c8b89a', borderRadius:2, margin:'0 auto 16px' }} />
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <i className="ti ti-flag-filled" style={{ fontSize:18, color:'#c0503a' }} />
              <div style={{ fontSize:16, fontWeight:700, color:'#8a3020' }}>Your period is about {daysLate} day{daysLate===1?'':'s'} late</div>
            </div>
            {latePeriodInsights && latePeriodInsights.length > 0 && (
              <>
                <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.6, marginBottom:8 }}>
                  A late period is common and has many causes. From what you have logged recently, these may be contributing:
                </div>
                <ul style={{ margin:'0 0 10px', paddingLeft:18 }}>
                  {latePeriodInsights.map((t, i) => (
                    <li key={i} style={{ fontSize:13, color:'#5a5248', lineHeight:1.55, marginBottom:6 }}>{t}</li>
                  ))}
                </ul>
              </>
            )}
            {(!latePeriodInsights || latePeriodInsights.length === 0) && (
              <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.6, marginBottom:10 }}>
                A late period is common and has many causes, stress, travel, illness, hard training, coming off birth control, or a change in weight can all delay it.
              </div>
            )}
            <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.6 }}>
              If there is any chance you could be pregnant, a test (first-morning urine is most reliable) gives the clearest answer. If your period keeps not arriving, or this happens often, it is worth checking in with your doctor.
            </div>
            <button onClick={() => setLateOpen(false)} style={{ width:'100%', marginTop:16, padding:'12px', borderRadius:12, background:'#f5f0e8', border:'1px solid #ede8e0', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Close</button>
          </div>
        </>
      )}

      {showConfetti && <Confetti />}
      {weeklyModal && weeklySummary && (
        <WeeklySummaryModal
          summary={weeklySummary}
          name={(d.profile?.name || '').trim().split(/\s+/)[0] || null}
          onDismiss={() => { markWeeklySummaryDismissed(d.userId); setWeeklyModal(false); setShowConfetti(false) }}
        />
      )}
    </>
  )
}

// One row of the Daily Coach expanded plan (training / nutrition / sleep / mindset).
// `dark` adapts the colours for the dark phase card; onClick makes the row tappable.
function CoachRow({ icon, label, body, onClick, dark }) {
  const c = dark
    ? { box:'rgba(232,224,212,0.12)', boxBorder:'rgba(232,224,212,0.2)', icon:'rgba(232,224,212,0.85)', label:'rgba(232,224,212,0.55)', body:'rgba(245,240,232,0.9)', chev:'rgba(232,224,212,0.5)' }
    : { box:'#fff', boxBorder:'#ede8e0', icon:'#7a6a50', label:'#9a9590', body:'#3a3530', chev:'#c8b89a' }
  return (
    <div onClick={onClick} style={{ display:'flex', gap:12, alignItems:'flex-start', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width:32, height:32, borderRadius:9, background:c.box, border:`1px solid ${c.boxBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <i className={`ti ${icon}`} style={{ fontSize:16, color:c.icon }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:c.label, marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:13, color:c.body, lineHeight:1.55 }}>{body}</div>
      </div>
      {onClick && <i className="ti ti-chevron-right" style={{ color:c.chev, fontSize:16, flexShrink:0, marginTop:2 }} />}
    </div>
  )
}
