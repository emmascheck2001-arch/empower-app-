// route /log, full daily log: energy, mood, cervical fluid, LH, RHR, wrist temp, symptoms, sleep, workout feel, disruptors, flow, pain, hormones
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPhase, interpretHormones, getTodayStatus, mergePeriodStartsNotes, mergePeriodLengthNotes, removePeriodStartNotes, parsePeriodStarts, getHormonalContext } from '../lib/hormoneSync'
import { diffCalendarDays } from '../lib/dateUtils.js'
import { track } from '../lib/analytics'
import { sanitize } from '../lib/validate'
import { isNative, readWearableData, healthStoreName } from '../lib/healthkit'
import { getUserLocal } from '../lib/userLocalState'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'
import CrisisSupport from '../components/CrisisSupport'

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+days)
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})
}
function rhrBucket(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  if (v < 55) return 'Under 55'
  if (v <= 65) return '55 to 65'
  if (v <= 75) return '65 to 75'
  return 'Over 75'
}
function round1(n) {
  return Math.round(Number(n) * 10) / 10
}

const ENERGY_OPTS  = ['Very low','Low','Normal','High']
const SLEEP_OPTS   = ['Poor','Fair','Good','Excellent']
const RHR_OPTS     = ['Under 55','55 to 65','65 to 75','Over 75','No data']
const MOOD_POS     = ['Energetic','Motivated','Confident','Social','Calm','Focused']
const MOOD_NEG     = ['Tired','Irritable','Anxious','Sad','Brain fog','Low mood']
const MOOD_OPTS    = [...MOOD_POS, ...MOOD_NEG]
const SYMPTOMS     = ['Bloating','Cramping','Breast tenderness','Headache','Migraine','Back pain','Nausea','Diarrhea','Constipation','Ovulation pain','Fatigue','Cravings','Mood swings','Acne','None']
const DISRUPTORS   = ['Alcohol','Illness','Travel','Very poor sleep','High stress','None of these']
const FLUID_OPTS   = ['None or dry','Sticky or crumbly','Creamy or lotion-like','Watery','Egg white','Spotting','Not sure']
// Plain, relatable descriptions so it is easy to report honestly (mucus is the most
// mis-logged signal). Shown as a small legend under the options.
const FLUID_HINTS = {
  'None or dry':'nothing noticeable', 'Sticky or crumbly':'tacky, like paste',
  'Creamy or lotion-like':'smooth, like lotion', 'Watery':'wet and slippery',
  'Egg white':'clear and stretchy, like raw egg white', 'Spotting':'a little blood',
  'Not sure':"didn't check, or hard to tell",
}
const LH_OPTS      = ['No test','Negative','Positive']
const FLOW_OPTS    = ['Spotting only','Light','Moderate','Heavy','Very heavy']
const PAIN_OPTS    = [{v:1,label:'1 None'},{v:2,label:'2 Mild'},{v:3,label:'3 Moderate'},{v:4,label:'4 Severe'},{v:5,label:'5 Debilitating'}]
const WORKOUT_OPTS = ['Rest day','Weaker than usual','Average','Stronger than usual','Skipped']
const WORKOUT_TO_STORAGE = { 'Weaker than usual':'Felt hard', Average:'Felt average', 'Stronger than usual':'Felt strong' }
const WORKOUT_FROM_STORAGE = { 'Felt hard':'Weaker than usual', 'Felt average':'Average', 'Felt strong':'Stronger than usual' }
const STRESS_OPTS  = [{v:1,label:'1 Calm'},{v:2,label:'2 Low'},{v:3,label:'3 Medium'},{v:4,label:'4 High'},{v:5,label:'5 Overwhelmed'}]
const LIBIDO_OPTS  = ['Low','Normal','High']

const pill = (active) => ({
  padding:'7px 14px', borderRadius:20, border:`1px solid ${active?'#c8b89a':'#ede8e0'}`,
  background: active?'#e8dfd0':'#fff', color: active?'#5a4a3a':'#2c2820',
  fontWeight: active?500:400, fontSize:13, cursor:'pointer', fontFamily:'inherit'
})
const gridBtn = (active) => ({
  padding:'12px 8px', borderRadius:10, border:`1px solid ${active?'#c8b89a':'#ede8e0'}`,
  background: active?'#e8dfd0':'#fff', color: active?'#5a4a3a':'#2c2820',
  fontWeight: active?500:400, fontSize:13, cursor:'pointer', textAlign:'center', fontFamily:'inherit'
})
const sLabel ={ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:8, display:'block' }
// Subtle section divider, groups the form into scannable chunks without hiding anything.
const sectionHead = { fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#5a5248', display:'block', marginTop:24, marginBottom:14, paddingTop:16, borderTop:'1px solid #ede8e0' }
const sectionHint = { fontSize:12, color:'#7a7268', lineHeight:1.5, margin:'-4px 0 12px' }

const BLANK_LOG = {
  energy:null, sleep_quality:null, stress_level:null, resting_hr:null, resting_hr_exact:'',
  wrist_temp:'', temperature_source:'other', cervical_fluid:null, lh_result:null, libido:null, mood:[], symptoms:[], disruptors:[],
  workout_feel:null, flow_volume:null, pain_rating:null, notes:'',
  hormone_estradiol:'', hormone_progesterone:'', hormone_lh:'', hormone_cortisol:'',
  hot_flash_count:'', night_sweats_severity:null, joint_pain_rating:null, brain_fog_rating:null,
}

function PillRow({ opts, selected, onToggle, single=false }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
      {opts.map(o => {
        const val = typeof o==='object'?o.v:o, label = typeof o==='object'?o.label:o
        const active = single ? selected===val : Array.isArray(selected) && selected.includes(val)
        return <button type="button" key={String(val)} aria-pressed={active} style={pill(active)} onClick={()=>onToggle(val)}>{label}</button>
      })}
    </div>
  )
}
function GridRow({ opts, selected, onSelect }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
      {opts.map(o => <button type="button" key={o} aria-pressed={selected===o} style={gridBtn(selected===o)} onClick={()=>onSelect(o)}>{o}</button>)}
    </div>
  )
}

export default function Log({ previewMode = false }) {
  const navigate = useNavigate()
  // A ?date=YYYY-MM-DD param (e.g. from the calendar) edits that day. Never the future.
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date')
  const initialDate = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= localDateStr()) ? dateParam : localDateStr()
  // The day this log applies to. User can change it (to backfill a missed day) via the date picker.
  const [logDate, setLogDate] = useState(initialDate)
  const isToday = logDate === localDateStr()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState('observation')
  const [isMenstrual, setIsMenstrual] = useState(false)
  const [isPath4, setIsPath4] = useState(false)
  const [isPregnant, setIsPregnant] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showHormones, setShowHormones] = useState(false)
  const [cycleLen, setCycleLen] = useState(28)
  const [periodDate, setPeriodDate] = useState(localDateStr())
  const [savingPeriod, setSavingPeriod] = useState(false)
  const [periodSaved, setPeriodSaved] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedPct, setSavedPct] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [lastPeriodDate, setLastPeriodDate] = useState(null)
  const [cycleDay, setCycleDay] = useState(null)
  const [periodLen, setPeriodLen] = useState(null)
  const [periodEnded, setPeriodEnded] = useState(false)
  const [periodStarts, setPeriodStarts] = useState([])
  const [cycleNotes, setCycleNotes] = useState(null)
  const [log, setLog] = useState(BLANK_LOG)
  const [contextKey, setContextKey] = useState('natural-cycle')
  const [wearableInfo, setWearableInfo] = useState({ store:'', rhr:false, temp:false, sleepHours:null })

  function loadPreview(state = 'cycle') {
    const previewDate = localDateStr()
    setLoading(false)
    setCycleLen(29)
    setContextKey('natural-cycle')
    setIsPath4(false)
    setIsPregnant(false)
    setCycleNotes(null)
    setPeriodStarts(['2026-07-09', '2026-08-03'])
    setPeriodSaved(false)
    setPeriodOpen(false)
    setSaveError('')
    setPeriodEnded(false)
    if (state === 'period') {
      setWearableInfo({ store:'Apple Health', rhr:true, temp:false, sleepHours:7.4 })
      setPhase('Menstrual')
      setIsMenstrual(true)
      setLastPeriodDate('2026-08-08')
      setCycleDay(2)
      setPeriodLen(4)
      setLog({
        ...BLANK_LOG,
        flow_volume:'Moderate',
        pain_rating:3,
        symptoms:['Cramping','Fatigue'],
        mood:['Tired'],
        energy:'Low',
        sleep_quality:'Fair',
        stress_level:2,
      })
      return
    }
    setWearableInfo({ store:'Apple Health', rhr:true, temp:true, sleepHours:7.8 })
    setPhase('Follicular')
    setIsMenstrual(false)
    setLastPeriodDate('2026-08-03')
    setCycleDay(7)
    setPeriodLen(4)
    setLog({
      ...BLANK_LOG,
      cervical_fluid:'Creamy or lotion-like',
      lh_result:'No test',
      resting_hr:'55 to 65',
      resting_hr_exact:'59',
      wrist_temp:'36.4',
      temperature_source:'wearable-wrist',
      symptoms:['Bloating'],
      mood:['Focused'],
      energy:'Normal',
      sleep_quality:'Good',
      stress_level:2,
    })
    setLogDate(previewDate)
  }

  // Reload whenever the selected day changes, so the form shows that day's saved data.
  useEffect(()=>{ init() },[logDate])

  async function init() {
    if (previewMode) {
      loadPreview(searchParams.get('state') || 'cycle')
      return
    }
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login',{replace:true}); return }
    setLoading(true)
    setLog(BLANK_LOG)  // clear any previously loaded day before loading the selected one
    try {
    const [{ data:profile },{ data:cycleData }] = await Promise.all([
      supabase.from('profiles').select('user_path,cycle_length').eq('id',user.id).maybeSingle(),
      supabase.from('cycle_data').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ])
    const path4 = profile?.user_path==='4'
    const pregnant = profile?.user_path==='6'
    setContextKey(getHormonalContext(profile))
    setIsPath4(path4)
    setIsPregnant(pregnant)
    if (pregnant) setPhase('Pregnancy')
    setCycleLen(cycleData?.cycle_length || profile?.cycle_length || 28)
    setCycleNotes(cycleData?.notes || null)
    setPeriodStarts(parsePeriodStarts(cycleData))
    if (!path4 && !pregnant && cycleData?.last_period_date) {
      const last = new Date(cycleData.last_period_date+'T00:00:00')
      // Phase reflects the day being logged (so backfilling a past period day shows Flow/Pain).
      const ref = new Date(logDate+'T00:00:00')
      const cd = diffCalendarDays(ref, last)+1
      setLastPeriodDate(cycleData.last_period_date); setCycleDay(cd); setPeriodLen(cycleData.period_length || null)
      if (cd >= 1) {
        const p = getPhase(cd, cycleData.cycle_length||28)
        setPhase(p); setIsMenstrual(p==='Menstrual')
      } else { setPhase('observation'); setIsMenstrual(false) }
    }
    const today = logDate
    const [{ data:existing },{ data:mucus }] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('user_id',user.id).eq('log_date',today).maybeSingle(),
      supabase.from('mucus_logs').select('discharge_type').eq('user_id',user.id).eq('log_date',today).maybeSingle(),
    ])
    setWearableInfo({ store:healthStoreName(), rhr:false, temp:false, sleepHours:existing?.sleep_hours ?? null })
    if (existing) {
      setLog(prev=>({...prev,
        energy:existing.energy||null, sleep_quality:existing.sleep_quality||null, stress_level:existing.stress_level||null,
        resting_hr:existing.resting_hr||null, resting_hr_exact:existing.resting_hr_exact?String(existing.resting_hr_exact):'',
        wrist_temp:existing.wrist_temp?String(existing.wrist_temp):'', temperature_source:existing.temperature_source||'other',
        lh_result:existing.lh_result||null, libido:existing.libido||null, mood:existing.mood||[], symptoms:existing.symptoms||[], disruptors:existing.disruptors||[],
        workout_feel:WORKOUT_FROM_STORAGE[existing.workout_feel] || existing.workout_feel || null, notes:existing.notes||'',
        flow_volume:existing.flow_volume||null, pain_rating:existing.pain_rating||null,
        hot_flash_count:existing.hot_flash_count?String(existing.hot_flash_count):'',
        night_sweats_severity:existing.night_sweats_severity||null,
        joint_pain_rating:existing.joint_pain_rating||null, brain_fog_rating:existing.brain_fog_rating||null,
        hormone_estradiol:existing.hormone_estradiol?String(existing.hormone_estradiol):'',
        hormone_progesterone:existing.hormone_progesterone?String(existing.hormone_progesterone):'',
        hormone_lh:existing.hormone_lh?String(existing.hormone_lh):'',
        hormone_cortisol:existing.hormone_cortisol?String(existing.hormone_cortisol):'',
      }))
    }
    if (mucus?.discharge_type) setLog(prev=>({...prev,cervical_fluid:mucus.discharge_type}))
    if (isNative() && getUserLocal(user.id, 'healthConnected')) {
      try {
        const wearable = await readWearableData()
        const rhr = wearable?.restingHR?.[0] != null ? Math.round(wearable.restingHR[0]) : null
        const tempC = wearable?.temps?.length ? round1(wearable.temps[wearable.temps.length - 1].value) : null
        const sleepHours = wearable?.sleepHours != null ? round1(wearable.sleepHours) : null
        const nextWearable = { store:healthStoreName(), rhr:false, temp:false, sleepHours:sleepHours ?? existing?.sleep_hours ?? null }
        const existingRhr = existing?.resting_hr_exact != null ? Number(existing.resting_hr_exact) : null
        const existingTemp = existing?.wrist_temp != null ? Number(existing.wrist_temp) : null
        const wearablePatch = {}
        if (rhr != null) {
          if (!Number.isFinite(existingRhr)) {
            wearablePatch.resting_hr_exact = String(rhr)
            if (!existing?.resting_hr) wearablePatch.resting_hr = rhrBucket(rhr)
            nextWearable.rhr = true
          } else if (Math.round(existingRhr) === rhr) nextWearable.rhr = true
        }
        if (tempC != null) {
          if (!Number.isFinite(existingTemp)) {
            wearablePatch.wrist_temp = String(tempC)
            wearablePatch.temperature_source = 'wearable-wrist'
            nextWearable.temp = true
          } else if (round1(existingTemp) === tempC && existing?.temperature_source === 'wearable-wrist') nextWearable.temp = true
        }
        if (Object.keys(wearablePatch).length) setLog(prev => ({ ...prev, ...wearablePatch }))
        setWearableInfo(nextWearable)

        // If the user opened Log directly, persist the wearable readings here too so the app can
        // use them without requiring a Dashboard visit first. Manual values always win: we only
        // fill fields that are still empty for today.
        const payload = { user_id:user.id, log_date:today, hormonal_context:getHormonalContext(profile) }
        if (!Number.isFinite(existingRhr) && rhr != null) payload.resting_hr_exact = rhr
        if (!Number.isFinite(existingTemp) && tempC != null) {
          payload.wrist_temp = tempC
          payload.temperature_source = 'wearable-wrist'
        }
        if (existing?.sleep_hours == null && sleepHours != null) payload.sleep_hours = sleepHours
        if (Object.keys(payload).length > 3) {
          await supabase.from('daily_logs').upsert(payload, { onConflict:'user_id,log_date' })
        }
      } catch (e) { console.error('Wearable prefill failed', e) }
    }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  // Log the first day of a period, writes cycle_data so the cycle starts tracking.
  // This is the only place (besides Setup) a user can record a period; essential for
  // observation/Depo-recovery users whose cycle returns and who have no cycle data yet.
  async function logPeriodStart() {
    setSavingPeriod(true)
    try {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login',{replace:true}); return }
      // Read the existing row first so we APPEND this period to the history instead of
      // overwriting it, logging a new period must never erase past periods (a user with
      // irregular cycles lost her whole prior month this way). period-start dates are kept
      // in cycle_data.notes; last_period_date holds the most recent start the app reads.
      const { data:existingCycle } = await supabase.from('cycle_data')
        .select('notes,last_period_date').eq('user_id',user.id)
        .order('created_at',{ascending:false}).limit(1).maybeSingle()
      const notes = mergePeriodStartsNotes(existingCycle?.notes, existingCycle?.last_period_date, periodDate)
      // Keep last_period_date = the most recent start, in case an older date is backfilled.
      const latestStart = [existingCycle?.last_period_date, periodDate].filter(Boolean).sort().slice(-1)[0]
      const { error } = await supabase.from('cycle_data').upsert(
        { user_id:user.id, last_period_date:latestStart, cycle_length:cycleLen, notes },
        { onConflict:'user_id' }
      )
      if (error) { console.error(error); setSaveError('Your period start could not be saved. Please try again.'); setSavingPeriod(false); return }
      const now = new Date(); now.setHours(0,0,0,0)
      const cd = diffCalendarDays(now, latestStart+'T00:00:00')+1
      const p = getPhase(cd, cycleLen)
      setPhase(p); setIsMenstrual(p==='Menstrual'); setPeriodSaved(true)
      setLastPeriodDate(latestStart); setCycleDay(cd); setPeriodEnded(false)
      setCycleNotes(notes)
      setPeriodStarts(parsePeriodStarts({ notes, last_period_date:latestStart }))
    } catch(e) { console.error(e) }
    setSavingPeriod(false)
  }

  async function removeRecordedPeriodStart(date) {
    if (!window.confirm(`Remove ${date} as a recorded period start? Daily symptoms and bleeding logs for that date will stay saved.`)) return
    setSavingPeriod(true); setSaveError('')
    try {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      const next = removePeriodStartNotes(cycleNotes, lastPeriodDate, date)
      const { error } = await supabase.from('cycle_data')
        .update({ notes:next.notes, last_period_date:next.lastPeriodDate, period_length:next.periodLength })
        .eq('user_id', user.id)
      if (error) throw error
      setCycleNotes(next.notes); setPeriodStarts(next.periodStarts); setLastPeriodDate(next.lastPeriodDate)
      setPeriodLen(next.periodLength)
      setPeriodSaved(false)
      if (!next.lastPeriodDate) { setCycleDay(null); setPhase('observation'); setIsMenstrual(false) }
      else {
        const cd = diffCalendarDays(new Date(logDate+'T00:00:00'), next.lastPeriodDate+'T00:00:00') + 1
        setCycleDay(cd)
        const nextPhase = cd >= 1 ? getPhase(cd, cycleLen) : 'observation'
        setPhase(nextPhase); setIsMenstrual(nextPhase === 'Menstrual')
      }
    } catch (error) { console.error(error); setSaveError('That period start could not be removed. Please try again.') }
    finally { setSavingPeriod(false) }
  }

  // Mark the period as finished today → records its length so the app can show an
  // expected end next time and learn the user's personal period length.
  async function markPeriodEnded() {
    if (!lastPeriodDate || !cycleDay) return
    try {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) return
      // Base the recorded length on the LAST day flow was actually logged this period, not
      // today's cycle day. Using cycleDay counted the days after bleeding stopped, so a user
      // who tapped "It ended" a few days later got a too-long period and stayed "Menstrual".
      const { data:flowLogs } = await supabase.from('daily_logs')
        .select('log_date,flow_volume').eq('user_id',user.id)
        .gte('log_date',lastPeriodDate).not('flow_volume','is',null)
        .order('log_date',{ascending:false}).limit(1)
      let len = Math.max(1, cycleDay - 1)  // fallback: ended as of today, so last bleed was before today
      if (flowLogs?.length) {
        len = diffCalendarDays(flowLogs[0].log_date+'T00:00:00', lastPeriodDate+'T00:00:00') + 1
      }
      len = Math.min(Math.max(len,1),14)
      // Record the length against THIS period's start date. cycle_data has a single
      // period_length column, so writing only that made every earlier cycle on the calendar
      // redraw at the newest period's length. The per-cycle map in notes is the real history;
      // period_length stays in sync for the current cycle and older single-value callers.
      const { data:existing } = await supabase.from('cycle_data')
        .select('notes,last_period_date').eq('user_id',user.id)
        .order('created_at',{ascending:false}).limit(1).maybeSingle()
      const notes = mergePeriodLengthNotes(existing?.notes, existing?.last_period_date, lastPeriodDate, len)
      const { error } = await supabase.from('cycle_data').upsert(
        { user_id:user.id, last_period_date:lastPeriodDate, cycle_length:cycleLen, period_length:len, notes },
        { onConflict:'user_id' }
      )
      if (error) throw error
      setPeriodLen(len); setPeriodEnded(true)
    } catch(e) { console.error(e); setSaveError('The period end could not be saved. Please try again.') }
  }

  const set = (field,val) => setLog(prev=>({...prev,[field]:val}))
  function toggleMulti(field,val) {
    setLog(prev=>{
      const arr=prev[field]||[]
      if (field==='disruptors') {
        if (val==='None of these') return {...prev,[field]:['None of these']}
        const f=arr.filter(v=>v!=='None of these')
        return {...prev,[field]:f.includes(val)?f.filter(v=>v!==val):[...f,val]}
      }
      if (field==='symptoms') {
        if (val==='None') return {...prev,[field]:['None']}
        const f=arr.filter(v=>v!=='None')
        return {...prev,[field]:f.includes(val)?f.filter(v=>v!==val):[...f,val]}
      }
      return {...prev,[field]:arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]}
    })
  }

  async function save() {
    if (previewMode) {
      setSavedPct(24)
      setSaved(true)
      setTimeout(() => setSaved(false), 1400)
      return
    }
    setSaving(true)
    setSaveError('')
    let user
    try { user = (await supabase.auth.getUser()).data.user } catch { setSaving(false); return }
    if (!user) { navigate('/login',{replace:true}); return }
    const today = logDate
    const payload = {
      user_id:user.id, log_date:today,
      hormonal_context:contextKey,
      energy:log.energy, symptoms:(log.symptoms || []).filter(s => s !== 'None'), lh_result:log.lh_result, mood:log.mood,
      sleep_quality:log.sleep_quality, stress_level:log.stress_level, libido:log.libido,
      // Sanitize every numeric health field: out-of-range or malformed values are dropped to null
      // rather than persisted, so a typo can never corrupt the algorithm (mirrors DB CHECKs).
      resting_hr:log.resting_hr_exact?String(log.resting_hr_exact):log.resting_hr,
      resting_hr_exact:sanitize('resting_hr_exact', log.resting_hr_exact),
      disruptors:log.disruptors,
      wrist_temp:sanitize('wrist_temp', log.wrist_temp),
      temperature_source:log.wrist_temp ? log.temperature_source : null,
      hormone_estradiol:sanitize('hormone_estradiol', log.hormone_estradiol),
      hormone_progesterone:sanitize('hormone_progesterone', log.hormone_progesterone),
      hormone_lh:sanitize('hormone_lh', log.hormone_lh),
      hormone_cortisol:sanitize('hormone_cortisol', log.hormone_cortisol),
      workout_feel:WORKOUT_TO_STORAGE[log.workout_feel] || log.workout_feel,
      workout_feel_reported:Boolean(log.workout_feel),
      flow_volume:log.flow_volume, pain_rating:log.pain_rating, notes:log.notes?.trim()||null,
      hot_flash_count:sanitize('hot_flash_count', log.hot_flash_count),
      night_sweats_severity:log.night_sweats_severity, joint_pain_rating:log.joint_pain_rating,
      brain_fog_rating:log.brain_fog_rating,
    }
    try {
      const { error } = await supabase.from('daily_logs').upsert(payload,{onConflict:'user_id,log_date'})
      if (error) throw error
      if (log.cervical_fluid) {
        const { error:mucusError } = await supabase.from('mucus_logs').upsert({user_id:user.id,log_date:today,discharge_type:log.cervical_fluid},{onConflict:'user_id,log_date'})
        if (mucusError) throw mucusError
      } else {
        const { error:mucusDeleteError } = await supabase.from('mucus_logs').delete().eq('user_id',user.id).eq('log_date',today)
        if (mucusDeleteError) throw mucusDeleteError
      }
      track('log_saved', { isToday, symptoms: (log.symptoms||[]).length, hasMood: (log.mood||[]).length > 0 })
      if (isToday) {
        try { const ns = await getTodayStatus(supabase, user.id); setSavedPct(ns?.personalisationPct ?? 0) } catch { /* ignore */ }
      }
      setSaved(true)
      setTimeout(() => navigate('/dashboard'), 1900)
    } catch(e) { console.error(e); setSaveError('Your log could not be saved. Please check your connection and try again.'); setSaving(false) }
  }

  if (loading) return <><TopBar title="Daily log" backTo="/dashboard"/><div style={{paddingTop:60}}><Spinner/></div><BottomNav/></>

  return (
    <>
      <TopBar backTo="/dashboard">
        <div style={{fontSize:13,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase'}}>Daily log</div>
        <div style={{fontSize:12,color:'#7a7268'}}>{isToday ? phase : `Editing ${new Date(logDate+'T00:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}`}</div>
      </TopBar>
      <div style={{padding:'16px 16px 120px'}}>

        {/* Day selector, log today or backfill a missed day. Never the future. */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#7a7268'}}>Logging for</span>
          <input type="date" aria-label="Date to log for" value={logDate} max={localDateStr()}
            onChange={e=>{ if(e.target.value) setLogDate(e.target.value) }}
            style={{padding:'6px 10px',borderRadius:8,border:'1px solid #ede8e0',fontSize:13,fontFamily:'inherit',color:'#2c2820'}}/>
          {!isToday && <button type="button" onClick={()=>setLogDate(localDateStr())}
            style={{padding:'6px 10px',borderRadius:8,border:'1px solid #ede8e0',background:'#f5f0e8',color:'#5a5248',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Today</button>}
        </div>
        <div style={{fontSize:13,color:'#5a5248',lineHeight:1.5,marginBottom:16}}>Fast check-in. Log what stands out today.</div>

        {/* Period start, record a period and begin cycle tracking. Shown to non-perimenopause
            users until they are menstruating; essential for observation/Depo-recovery users. */}
        {!isPath4 && !isPregnant && (!isMenstrual || periodSaved) && (
          periodSaved ? (
            <div className="card" style={{marginBottom:16, background:'#fdf0f0', border:'1px solid #f0d8d8', padding:'12px 14px'}}>
              <div style={{fontSize:13,color:'#5a2a28',lineHeight:1.5}}>Period start logged 🌿 Your cycle is now tracking from {periodDate}.</div>
            </div>
          ) : (
            <div style={{marginBottom:16, background:'#fdf0f0', border:'1px solid #f0d8d8', borderRadius:14, overflow:'hidden'}}>
              <button type="button" aria-expanded={periodOpen} onClick={()=>setPeriodOpen(o=>!o)} style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'13px 16px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left'}}>
                <span style={{fontSize:14, fontWeight:600, color:'#5a2a28'}}>Did your period start?</span>
                <i className={`ti ti-chevron-${periodOpen?'up':'down'}`} aria-hidden="true" style={{color:'#c08878', fontSize:16}}/>
              </button>
              {periodOpen && (
                <div style={{padding:'0 16px 14px'}}>
                  <div style={{fontSize:12,color:'#7a7268',marginBottom:10,lineHeight:1.5}}>Log the first day to start tracking your cycle. (If it began earlier, pick that date.)</div>
                  <input type="date" aria-label="Period start date" value={periodDate} max={localDateStr()} onChange={e=>setPeriodDate(e.target.value)}
                    style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit',marginBottom:10,boxSizing:'border-box'}}/>
                  <button type="button" onClick={logPeriodStart} disabled={savingPeriod}
                    style={{width:'100%',padding:'12px',borderRadius:10,background:'#c05858',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
                    {savingPeriod?'Saving...':'Log period start'}
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {!isPath4 && !isPregnant && isMenstrual && periodStarts.length > 0 && (
          <details style={{margin:'-4px 0 12px'}}>
            <summary style={{fontSize:12,color:'#8a8176',cursor:'pointer',textDecoration:'underline',listStyle:'none'}}>Edit cycle history</summary>
            <div style={{marginTop:10,background:'#fff',border:'1px solid #ede8e0',borderRadius:12,padding:'10px 12px'}}>
            <div style={{fontSize:11,color:'#9a9590',lineHeight:1.5,margin:'0 0 10px'}}>Remove only dates that were entered by mistake. This changes future estimates but keeps the daily symptom log.</div>
            {[...periodStarts].reverse().slice(0,8).map(date => (
              <div key={date} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'8px 0',borderTop:'1px solid #f2eee8'}}>
                <span style={{fontSize:13,color:'#3a3530'}}>{new Date(date+'T00:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</span>
                <button type="button" disabled={savingPeriod} onClick={()=>removeRecordedPeriodStart(date)} style={{background:'none',border:'none',color:'#a04a42',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Remove</button>
              </div>
            ))}
            </div>
          </details>
        )}

        {/* Flow + pain stay in the quick view during the period, they matter most then */}
        {isMenstrual&&<>
          <span style={{...sectionHead, marginTop:4, paddingTop:0, borderTop:'none'}}>Your period</span>
          <div style={sectionHint}>Log the bleeding itself first. Everything else is optional.</div>
          <span style={sLabel}>Flow today</span>
          <PillRow opts={FLOW_OPTS} selected={log.flow_volume} single onToggle={v=>set('flow_volume',v)}/>
          <span style={sLabel}>Pain level</span>
          <PillRow opts={PAIN_OPTS} selected={log.pain_rating} single onToggle={v=>set('pain_rating',v)}/>
          {/* Acute red-flag escalation, for very heavy bleeding or severe pain, "track the
              pattern" is the wrong tempo; surface same-day-care guidance at the moment of logging.
              Sources: ACOG, Heavy Menstrual Bleeding (FAQ095); ACOG acute pelvic pain / ectopic. */}
          {(log.flow_volume==='Very heavy' || log.flow_volume==='Heavy' || log.pain_rating>=4) && (
            <div style={{background:'#fdeeee', border:'1px solid #e8b0a0', borderRadius:12, padding:'13px 15px', marginBottom:16}}>
              <div style={{fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#a83a20', marginBottom:6}}>When to seek care today</div>
              {(log.flow_volume==='Very heavy' || log.flow_volume==='Heavy') && (
                <div style={{fontSize:13, color:'#5a2a20', lineHeight:1.6, marginBottom: log.pain_rating>=4?8:0}}>
                  Soaking through a pad or tampon every 1 to 2 hours for several hours in a row, or passing clots larger than a coin, is heavier than typical. If that is happening, or you feel dizzy, breathless, or your heart is racing, contact your doctor or urgent care today. (ACOG)
                </div>
              )}
              {log.pain_rating>=4 && (
                <div style={{fontSize:13, color:'#5a2a20', lineHeight:1.6}}>
                  Pain this severe deserves attention now, not just tracking. If it came on suddenly, is mostly on one side, or comes with fever, vomiting, fainting, or shoulder-tip pain, or there is any chance you could be pregnant, seek same-day medical care. These can be signs of something that needs urgent treatment. (ACOG)
                </div>
              )}
            </div>
          )}
          {/* Compact period-length predictor, only ever shown while menstruating, and only for today (it is today-relative) */}
          {isToday && <div style={{fontSize:11,color:'#9a9590',marginBottom:16,lineHeight:1.5}}>
            {periodEnded
              ? `Period logged as ${periodLen} day${periodLen===1?'':'s'}.`
              : <>Day {cycleDay||1}. {periodLen ? `Yours usually last about ${periodLen} days` : 'Most periods last 3 to 7 days'}{lastPeriodDate?`, likely easing by ${addDaysStr(lastPeriodDate,(periodLen||7)-1)}`:''}. <button type="button" onClick={markPeriodEnded} style={{background:'none',border:'none',padding:0,color:'#c05858',fontWeight:600,textDecoration:'underline',cursor:'pointer',fontFamily:'inherit',fontSize:11}}>It ended</button></>}
          </div>}
        </>}

        {!isPath4 && !isPregnant && (
          <>
            <span style={{...sectionHead, marginTop:4, paddingTop:0, borderTop:'none'}}>Cycle signals</span>
            <div style={sectionHint}>
              {isMenstrual
                ? 'Wearable signals stay editable here in case Apple Health got something wrong.'
                : 'These are the most useful signals for timing your cycle.'}
            </div>

            {!isMenstrual && (
              <>
                <span style={sLabel}>Cervical fluid</span>
                <PillRow opts={FLUID_OPTS} selected={log.cervical_fluid} single onToggle={v=>set('cervical_fluid',v)}/>
                {log.cervical_fluid && FLUID_HINTS[log.cervical_fluid] && (
                  <div style={{fontSize:12,color:'#7a7268',marginTop:-8,marginBottom:16,lineHeight:1.5}}>{FLUID_HINTS[log.cervical_fluid]}</div>
                )}

                <span style={sLabel}>LH test</span>
                <PillRow opts={LH_OPTS} selected={log.lh_result} single onToggle={v=>set('lh_result',v)}/>
              </>
            )}

            <span style={sLabel}>Temperature</span>
            {wearableInfo.temp && <div style={{fontSize:11,color:'#7a7268',marginTop:-4,marginBottom:8}}>{wearableInfo.store} filled this in. Change it if needed.</div>}
            <select aria-label="Temperature source" value={log.temperature_source} onChange={e=>set('temperature_source',e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit',marginBottom:8,background:'#fff'}}>
              <option value="wearable-wrist">Wearable / wrist sensor</option>
              <option value="oral-bbt">Oral basal thermometer</option>
              <option value="other">Other or unknown method</option>
            </select>
            <input type="number" step="0.1" min="34" max="40" aria-label="Temperature in Celsius (optional)" placeholder="°C, optional" value={log.wrist_temp} onChange={e=>set('wrist_temp',e.target.value)}
              style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:15,fontFamily:'inherit',marginBottom:16}}/>

            <span style={sLabel}>Resting heart rate</span>
            {wearableInfo.rhr && <div style={{fontSize:11,color:'#7a7268',marginTop:-4,marginBottom:8}}>{wearableInfo.store} filled this in. Change it if needed.</div>}
            <PillRow opts={RHR_OPTS} selected={log.resting_hr} single onToggle={v=>{set('resting_hr',v);set('resting_hr_exact','')}}/>
            <input type="number" min="30" max="120" aria-label="Resting heart rate, exact bpm" placeholder="Exact bpm, optional" value={log.resting_hr_exact}
              onChange={e=>{set('resting_hr_exact',e.target.value);if(e.target.value)set('resting_hr',null)}}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit',marginBottom:16}}/>
          </>
        )}

        <span style={sectionHead}>{isPregnant ? 'How you feel' : isPath4 ? 'Today' : 'How you feel'}</span>
        <div style={sectionHint}>Log symptoms first. Add mood, sleep, energy, and stress if they stood out.</div>

        <span style={sLabel}>Symptoms</span>
        <PillRow opts={SYMPTOMS} selected={log.symptoms} onToggle={v=>toggleMulti('symptoms',v)}/>

        {!isPregnant && !isPath4 && (
          <>
            <span style={sLabel}>Mood today</span>
            <PillRow opts={MOOD_OPTS} selected={log.mood} onToggle={v=>toggleMulti('mood',v)}/>
            {(log.mood.includes('Low mood') || log.mood.includes('Sad')) && <CrisisSupport />}

            <span style={sLabel}>Energy</span>
            <GridRow opts={ENERGY_OPTS} selected={log.energy} onSelect={v=>set('energy',v)}/>

            <span style={sLabel}>Sleep</span>
            {wearableInfo.sleepHours != null && <div style={{fontSize:11,color:'#7a7268',marginTop:-4,marginBottom:8}}>{wearableInfo.store} recorded {wearableInfo.sleepHours} hours last night.</div>}
            <GridRow opts={SLEEP_OPTS} selected={log.sleep_quality} onSelect={v=>set('sleep_quality',v)}/>

            <span style={sLabel}>Stress</span>
            <PillRow opts={STRESS_OPTS} selected={log.stress_level} single onToggle={v=>set('stress_level',v)}/>
          </>
        )}

        {isPregnant&&<>
          <span style={sLabel}>Vaginal bleeding</span>
          <PillRow opts={FLOW_OPTS} selected={log.flow_volume} single onToggle={v=>set('flow_volume',v)}/>
          <span style={sLabel}>Pain</span>
          <PillRow opts={PAIN_OPTS} selected={log.pain_rating} single onToggle={v=>set('pain_rating',v)}/>
          {((log.flow_volume && log.flow_volume !== 'None') || log.pain_rating>=4) && <div style={{background:'#fdeeee',border:'1px solid #e8b0a0',borderRadius:12,padding:'13px 15px',marginBottom:16,fontSize:13,color:'#5a2a20',lineHeight:1.6}}>Stop exercise and contact your pregnancy care provider now for advice. Seek urgent care for heavy bleeding, severe or one-sided pain, shoulder pain, fainting, chest pain, fluid loss, or feeling very unwell.</div>}
        </>}

        {isPath4&&<>
          <span style={sLabel}>Bleeding</span>
          <PillRow opts={FLOW_OPTS} selected={log.flow_volume} single onToggle={v=>set('flow_volume',v)}/>
          <span style={sLabel}>Pelvic pain</span>
          <PillRow opts={PAIN_OPTS} selected={log.pain_rating} single onToggle={v=>set('pain_rating',v)}/>
          <span style={sLabel}>Hot flashes</span>
          <input type="number" min="0" aria-label="Hot flashes today" placeholder="Count" value={log.hot_flash_count} onChange={e=>set('hot_flash_count',e.target.value)}
            style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:15,fontFamily:'inherit',marginBottom:16}}/>
          <span style={sLabel}>Night sweats</span>
          <PillRow opts={[{v:0,label:'None'},{v:1,label:'Mild'},{v:2,label:'Moderate'},{v:3,label:'Severe'}]} selected={log.night_sweats_severity} single onToggle={v=>set('night_sweats_severity',v)}/>
          <span style={sLabel}>Joint pain</span>
          <PillRow opts={[1,2,3,4,5].map(n=>({v:n,label:String(n)}))} selected={log.joint_pain_rating} single onToggle={v=>set('joint_pain_rating',v)}/>
          <span style={sLabel}>Brain fog</span>
          <PillRow opts={[1,2,3,4,5].map(n=>({v:n,label:String(n)}))} selected={log.brain_fog_rating} single onToggle={v=>set('brain_fog_rating',v)}/>
        </>}

        {/* ── Add more detail (collapsed by default) ───────────────────────── */}
        <button type="button" aria-expanded={showMore} onClick={()=>setShowMore(v=>!v)} style={{width:'100%',padding:'13px 16px',borderRadius:12,border:'1px solid #ede8e0',background:'#f5f0e8',color:'#5a5248',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:16}}>
          <i className={`ti ti-chevron-${showMore?'up':'down'}`} aria-hidden="true"/> {showMore?'Hide optional details':'Optional details'}
        </button>

        {showMore&&<>
          <span style={sLabel}>Workout today</span>
          <PillRow opts={WORKOUT_OPTS} selected={log.workout_feel} single onToggle={v=>set('workout_feel',v)}/>

          <span style={sLabel}>Disruptors</span>
          <PillRow opts={DISRUPTORS} selected={log.disruptors} onToggle={v=>toggleMulti('disruptors',v)}/>

          <span style={sLabel}>Notes</span>
          <textarea aria-label="Notes" value={log.notes} onChange={e=>set('notes',e.target.value)} placeholder="Anything else worth noting today?" rows={3}
            style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit',marginBottom:16,resize:'vertical',color:'#2c2820'}}/>

          <div style={{marginBottom:20}}>
            <button type="button" aria-expanded={showHormones} onClick={()=>setShowHormones(v=>!v)} style={{background:'none',border:'none',fontSize:13,color:'#9a9590',cursor:'pointer',fontFamily:'inherit',padding:0,display:'flex',alignItems:'center',gap:6}}>
              <i className={`ti ti-chevron-${showHormones?'up':'down'}`} aria-hidden="true"/> Hormone test results (optional)
            </button>
            {showHormones&&<div style={{marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[{label:'Estradiol pmol/L',field:'hormone_estradiol',ph:'e.g. 450'},
                {label:'Progesterone nmol/L',field:'hormone_progesterone',ph:'e.g. 28.5'},
                {label:'LH IU/L',field:'hormone_lh',ph:'e.g. 12.0'},
                {label:'Cortisol nmol/L',field:'hormone_cortisol',ph:'e.g. 18.0'}].map(h=>(
                <div key={h.field}>
                  <div style={{fontSize:11,color:'#9a9590',marginBottom:4}}>{h.label}</div>
                  <input type="number" step="0.1" aria-label={h.label} placeholder={h.ph} value={log[h.field]} onChange={e=>set(h.field,e.target.value)}
                    style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit'}}/>
                </div>
              ))}
            </div>}
            {showHormones && (() => {
              const h = interpretHormones(log)
              if (!h) return null
              return (
                <div style={{marginTop:12,padding:'10px 12px',background:'#f5f0e8',borderRadius:10,fontSize:11,color:'#5a5248',lineHeight:1.55}}>
                  {h.notes.map((n,i)=><div key={i} style={{marginBottom:4}}>{n}</div>)}
                  <div style={{color:'#9a9590',marginTop:4,fontStyle:'italic'}}>{h.caveat}</div>
                </div>
              )
            })()}
          </div>
        </>}

        <button type="button" onClick={()=>setLog(p=>({...p, symptoms:['None'], disruptors:['None of these']}))}
          style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid #ede8e0',background:'#fff',color:'#7a7268',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',marginBottom:10}}>
          Nothing notable today
        </button>
        {saveError && <div role="alert" style={{fontSize:12,color:'#9a3f2c',marginBottom:10,lineHeight:1.5}}>{saveError}</div>}
        <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save check-in →'}</button>
      </div>

      {saved && (
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(44,40,32,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'#faf8f5',borderRadius:18,padding:'28px 24px',textAlign:'center',maxWidth:320,width:'100%'}}>
            <div style={{fontSize:34,marginBottom:8}}>🌿</div>
            <div style={{fontFamily:'Georgia,serif',fontStyle:'italic',fontSize:20,color:'#2c2820',marginBottom:8}}>{isToday ? 'Logged' : 'Saved'}</div>
            <div style={{fontSize:14,color:'#5a5248',lineHeight:1.6,marginBottom:6}}>
              {isToday
                ? (savedPct!=null ? `Your personal data coverage is now ${savedPct}%. Guidance remains an estimate.` : 'Your data is helping Empower look for a pattern over time.')
                : `Updated ${new Date(logDate+'T00:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}.`}
            </div>
            <div style={{fontSize:12,color:'#9a9590'}}>Heading to your dashboard...</div>
          </div>
        </div>
      )}
      <BottomNav/>
    </>
  )
}
