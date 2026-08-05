// route /log, full daily log: energy, mood, cervical fluid, LH, RHR, wrist temp, symptoms, sleep, workout feel, disruptors, flow, pain, hormones
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPhase, interpretHormones, getTodayStatus, mergePeriodStartsNotes } from '../lib/hormoneSync'
import { track } from '../lib/analytics'
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

const ENERGY_OPTS  = ['Very low','Low','Normal','High']
const SLEEP_OPTS   = ['Poor','Fair','Good','Excellent']
const RHR_OPTS     = ['Under 55','55 to 65','65 to 75','Over 75','No data']
const MOOD_POS     = ['Energetic','Motivated','Confident','Social','Calm','Focused']
const MOOD_NEG     = ['Tired','Irritable','Anxious','Sad','Brain fog','Low mood']
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

const BLANK_LOG = {
  energy:null, sleep_quality:null, stress_level:null, resting_hr:null, resting_hr_exact:'',
  wrist_temp:'', cervical_fluid:null, lh_result:null, libido:null, mood:[], symptoms:[], disruptors:[],
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
        return <button key={String(val)} style={pill(active)} onClick={()=>onToggle(val)}>{label}</button>
      })}
    </div>
  )
}
function GridRow({ opts, selected, onSelect }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
      {opts.map(o => <button key={o} style={gridBtn(selected===o)} onClick={()=>onSelect(o)}>{o}</button>)}
    </div>
  )
}

export default function Log() {
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
  const [showMore, setShowMore] = useState(false)
  const [showHormones, setShowHormones] = useState(false)
  const [cycleLen, setCycleLen] = useState(28)
  const [periodDate, setPeriodDate] = useState(localDateStr())
  const [savingPeriod, setSavingPeriod] = useState(false)
  const [periodSaved, setPeriodSaved] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedPct, setSavedPct] = useState(null)
  const [lastPeriodDate, setLastPeriodDate] = useState(null)
  const [cycleDay, setCycleDay] = useState(null)
  const [periodLen, setPeriodLen] = useState(null)
  const [periodEnded, setPeriodEnded] = useState(false)
  const [log, setLog] = useState(BLANK_LOG)

  // Reload whenever the selected day changes, so the form shows that day's saved data.
  useEffect(()=>{ init() },[logDate])

  async function init() {
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
    setIsPath4(path4)
    setCycleLen(cycleData?.cycle_length || profile?.cycle_length || 28)
    if (!path4 && cycleData?.last_period_date) {
      const last = new Date(cycleData.last_period_date+'T00:00:00')
      // Phase reflects the day being logged (so backfilling a past period day shows Flow/Pain).
      const ref = new Date(logDate+'T00:00:00')
      const cd = Math.floor((ref-last)/86400000)+1
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
    if (existing) {
      setLog(prev=>({...prev,
        energy:existing.energy||null, sleep_quality:existing.sleep_quality||null, stress_level:existing.stress_level||null,
        resting_hr:existing.resting_hr||null, resting_hr_exact:existing.resting_hr_exact?String(existing.resting_hr_exact):'',
        wrist_temp:existing.wrist_temp?String(existing.wrist_temp):'',
        lh_result:existing.lh_result||null, libido:existing.libido||null, mood:existing.mood||[], symptoms:existing.symptoms||[], disruptors:existing.disruptors||[],
        workout_feel:existing.workout_feel||null, notes:existing.notes||'',
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
      if (error) { console.error(error); setSavingPeriod(false); return }
      const last = new Date(latestStart+'T00:00:00')
      const now = new Date(); now.setHours(0,0,0,0)
      const cd = Math.floor((now-last)/86400000)+1
      const p = getPhase(cd, cycleLen)
      setPhase(p); setIsMenstrual(p==='Menstrual'); setPeriodSaved(true)
      setLastPeriodDate(latestStart); setCycleDay(cd); setPeriodEnded(false)
    } catch(e) { console.error(e) }
    setSavingPeriod(false)
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
        const start = new Date(lastPeriodDate+'T00:00:00')
        const lastFlow = new Date(flowLogs[0].log_date+'T00:00:00')
        len = Math.floor((lastFlow - start)/86400000) + 1
      }
      len = Math.min(Math.max(len,1),14)
      await supabase.from('cycle_data').upsert(
        { user_id:user.id, last_period_date:lastPeriodDate, cycle_length:cycleLen, period_length:len },
        { onConflict:'user_id' }
      )
      setPeriodLen(len); setPeriodEnded(true)
    } catch(e) { console.error(e) }
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
    setSaving(true)
    let user
    try { user = (await supabase.auth.getUser()).data.user } catch { setSaving(false); return }
    if (!user) { navigate('/login',{replace:true}); return }
    const today = logDate
    const payload = {
      user_id:user.id, log_date:today,
      energy:log.energy, symptoms:log.symptoms, lh_result:log.lh_result, mood:log.mood,
      sleep_quality:log.sleep_quality, stress_level:log.stress_level, libido:log.libido,
      resting_hr:log.resting_hr_exact?String(log.resting_hr_exact):log.resting_hr,
      resting_hr_exact:log.resting_hr_exact?parseInt(log.resting_hr_exact):null,
      disruptors:log.disruptors,
      wrist_temp:log.wrist_temp?parseFloat(log.wrist_temp):null,
      hormone_estradiol:log.hormone_estradiol?parseFloat(log.hormone_estradiol):null,
      hormone_progesterone:log.hormone_progesterone?parseFloat(log.hormone_progesterone):null,
      hormone_lh:log.hormone_lh?parseFloat(log.hormone_lh):null,
      hormone_cortisol:log.hormone_cortisol?parseFloat(log.hormone_cortisol):null,
      workout_feel:log.workout_feel,
      flow_volume:log.flow_volume, pain_rating:log.pain_rating, notes:log.notes?.trim()||null,
      hot_flash_count:log.hot_flash_count?parseInt(log.hot_flash_count):null,
      night_sweats_severity:log.night_sweats_severity, joint_pain_rating:log.joint_pain_rating,
      brain_fog_rating:log.brain_fog_rating,
    }
    try {
      const { error } = await supabase.from('daily_logs').upsert(payload,{onConflict:'user_id,log_date'})
      if (error) throw error
      if (log.cervical_fluid) {
        await supabase.from('mucus_logs').upsert({user_id:user.id,log_date:today,discharge_type:log.cervical_fluid},{onConflict:'user_id,log_date'})
      }
      track('log_saved', { isToday, symptoms: (log.symptoms||[]).length, hasMood: (log.mood||[]).length > 0 })
      if (isToday) {
        try { const ns = await getTodayStatus(supabase, user.id); setSavedPct(Math.round((ns?.confidence||0)*100)) } catch { /* ignore */ }
      }
      setSaved(true)
      setTimeout(() => navigate('/dashboard'), 1900)
    } catch(e) { console.error(e); setSaving(false) }
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
          <input type="date" value={logDate} max={localDateStr()}
            onChange={e=>{ if(e.target.value) setLogDate(e.target.value) }}
            style={{padding:'6px 10px',borderRadius:8,border:'1px solid #ede8e0',fontSize:13,fontFamily:'inherit',color:'#2c2820'}}/>
          {!isToday && <button onClick={()=>setLogDate(localDateStr())}
            style={{padding:'6px 10px',borderRadius:8,border:'1px solid #ede8e0',background:'#f5f0e8',color:'#5a5248',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Today</button>}
        </div>

        {/* ── How you feel today (always visible) ───────────────────────── */}
        <span style={{...sectionHead, marginTop:4, paddingTop:0, borderTop:'none'}}>How you feel today</span>
        <span style={sLabel}>Energy today</span>
        <GridRow opts={ENERGY_OPTS} selected={log.energy} onSelect={v=>set('energy',v)}/>

        <span style={sLabel}>Sleep last night</span>
        <div style={{fontSize:11,color:'#9a9590',marginBottom:8,fontStyle:'italic'}}>Sleep is not passive recovery. Estrogen and progesterone are produced and regulated during sleep. (Haver et al. 2025)</div>
        <GridRow opts={SLEEP_OPTS} selected={log.sleep_quality} onSelect={v=>set('sleep_quality',v)}/>

        <span style={sLabel}>Stress today</span>
        <PillRow opts={STRESS_OPTS} selected={log.stress_level} single onToggle={v=>set('stress_level',v)}/>

        <span style={sLabel}>Positive mood</span>
        <PillRow opts={MOOD_POS} selected={log.mood} onToggle={v=>toggleMulti('mood',v)}/>
        <span style={sLabel}>Challenging mood</span>
        <PillRow opts={MOOD_NEG} selected={log.mood} onToggle={v=>toggleMulti('mood',v)}/>
        {(log.mood.includes('Low mood') || log.mood.includes('Sad')) && <CrisisSupport />}

        <span style={sLabel}>Physical symptoms</span>
        <PillRow opts={SYMPTOMS} selected={log.symptoms} onToggle={v=>toggleMulti('symptoms',v)}/>

        {/* Cervical fluid, moved into the quick view: it is the strongest day-to-day, device-free
            signal of cycle phase, and key to inferring the cycle when no period date is known. */}
        {/* Hidden during the period, menstrual flow masks cervical fluid, so it is not a
            meaningful signal then (and asking for it while bleeding confused testers). */}
        {!isPath4&&!isMenstrual&&<>
          <span style={sLabel}>Cervical fluid</span>
          <div id="cervicalFluidWhy" style={{fontSize:11,color:'#9a9590',marginBottom:8,fontStyle:'italic'}}>One of the strongest day-to-day signs of where you are in your cycle. Not sure? That is fine, just tap "Not sure". (Bigelow et al. 2004)</div>
          <PillRow opts={FLUID_OPTS} selected={log.cervical_fluid} single onToggle={v=>set('cervical_fluid',v)}/>
          {log.cervical_fluid && FLUID_HINTS[log.cervical_fluid] && (
            <div style={{fontSize:11.5,color:'#7a7268',marginTop:6,lineHeight:1.5}}>{log.cervical_fluid}: {FLUID_HINTS[log.cervical_fluid]}.</div>
          )}
        </>}

        {isPath4&&<>
          <span style={sectionHead}>Symptoms to track</span>
          <span style={sLabel}>Hot flashes this week</span>
          <input type="number" min="0" placeholder="Count" value={log.hot_flash_count} onChange={e=>set('hot_flash_count',e.target.value)}
            style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:15,fontFamily:'inherit',marginBottom:16}}/>
          <span style={sLabel}>Night sweats</span>
          <PillRow opts={[{v:0,label:'None'},{v:1,label:'Mild'},{v:2,label:'Moderate'},{v:3,label:'Severe'}]} selected={log.night_sweats_severity} single onToggle={v=>set('night_sweats_severity',v)}/>
          <span style={sLabel}>Joint pain (1-5)</span>
          <PillRow opts={[1,2,3,4,5].map(n=>({v:n,label:String(n)}))} selected={log.joint_pain_rating} single onToggle={v=>set('joint_pain_rating',v)}/>
          <span style={sLabel}>Brain fog (1-5)</span>
          <PillRow opts={[1,2,3,4,5].map(n=>({v:n,label:String(n)}))} selected={log.brain_fog_rating} single onToggle={v=>set('brain_fog_rating',v)}/>
        </>}

        {/* Period start, record a period and begin cycle tracking. Shown to non-perimenopause
            users until they are menstruating; essential for observation/Depo-recovery users. */}
        {!isPath4 && (!isMenstrual || periodSaved) && (
          periodSaved ? (
            <div className="card" style={{marginBottom:16, background:'#fdf0f0', border:'1px solid #f0d8d8', padding:'12px 14px'}}>
              <div style={{fontSize:13,color:'#5a2a28',lineHeight:1.5}}>Period start logged 🌿 Your cycle is now tracking from {periodDate}.</div>
            </div>
          ) : (
            <div style={{marginBottom:16, background:'#fdf0f0', border:'1px solid #f0d8d8', borderRadius:14, overflow:'hidden'}}>
              <button onClick={()=>setPeriodOpen(o=>!o)} style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'13px 16px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left'}}>
                <span style={{fontSize:14, fontWeight:600, color:'#5a2a28'}}>Did your period start?</span>
                <i className={`ti ti-chevron-${periodOpen?'up':'down'}`} style={{color:'#c08878', fontSize:16}}/>
              </button>
              {periodOpen && (
                <div style={{padding:'0 16px 14px'}}>
                  <div style={{fontSize:12,color:'#7a7268',marginBottom:10,lineHeight:1.5}}>Log the first day to start tracking your cycle. (If it began earlier, pick that date.)</div>
                  <input type="date" value={periodDate} max={localDateStr()} onChange={e=>setPeriodDate(e.target.value)}
                    style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit',marginBottom:10,boxSizing:'border-box'}}/>
                  <button onClick={logPeriodStart} disabled={savingPeriod}
                    style={{width:'100%',padding:'12px',borderRadius:10,background:'#c05858',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
                    {savingPeriod?'Saving...':'Log period start'}
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {/* Flow + pain stay in the quick view during the period, they matter most then */}
        {isMenstrual&&<>
          <span style={sectionHead}>Your period</span>
          <span style={sLabel}>Flow today</span>
          <PillRow opts={FLOW_OPTS} selected={log.flow_volume} single onToggle={v=>set('flow_volume',v)}/>
          <span style={sLabel}>Pain level</span>
          <PillRow opts={PAIN_OPTS} selected={log.pain_rating} single onToggle={v=>set('pain_rating',v)}/>
          <div style={{fontSize:11,color:'#9a9590',fontStyle:'italic',marginBottom:16}}>Pain that disrupts your daily life is not normal. Log it and we will track the pattern.</div>
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
              : <>Day {cycleDay||1}. {periodLen ? `Yours usually last about ${periodLen} days` : 'Most periods last 3 to 7 days'}{lastPeriodDate?`, likely easing by ${addDaysStr(lastPeriodDate,(periodLen||7)-1)}`:''}. <button onClick={markPeriodEnded} style={{background:'none',border:'none',padding:0,color:'#c05858',fontWeight:600,textDecoration:'underline',cursor:'pointer',fontFamily:'inherit',fontSize:11}}>It ended</button></>}
          </div>}
        </>}

        {/* ── Add more detail (collapsed by default) ───────────────────────── */}
        <button onClick={()=>setShowMore(v=>!v)} style={{width:'100%',padding:'13px 16px',borderRadius:12,border:'1px solid #ede8e0',background:'#f5f0e8',color:'#5a5248',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:16}}>
          <i className={`ti ti-chevron-${showMore?'up':'down'}`}/> {showMore?'Hide extra detail':'Add more detail'}
        </button>

        {showMore&&<>
          {!isPath4&&<>
            <span style={sLabel}>Sex drive</span>
            <div style={{fontSize:11,color:'#9a9590',marginBottom:8,fontStyle:'italic'}}>Often rises around ovulation as estrogen and testosterone peak, and dips when estrogen is low. A small extra cycle signal.</div>
            <PillRow opts={LIBIDO_OPTS} selected={log.libido} single onToggle={v=>set('libido',v)}/>
          </>}

          <span style={sLabel}>Resting heart rate</span>
          <PillRow opts={RHR_OPTS} selected={log.resting_hr} single onToggle={v=>{set('resting_hr',v);set('resting_hr_exact','')}}/>
          <input type="number" min="30" max="120" placeholder="Or type exact bpm" value={log.resting_hr_exact}
            onChange={e=>{set('resting_hr_exact',e.target.value);if(e.target.value)set('resting_hr',null)}}
            style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit',marginBottom:16}}/>

          {!isPath4&&<>
            <span style={sLabel}>LH test</span>
            <div id="lhTestWhy" style={{fontSize:11,color:'#9a9590',marginBottom:8,fontStyle:'italic'}}>Strongest single ovulation signal: a positive test means ovulation is likely within 12 to 36 hours. These signals are for understanding your body, not a reliable method of preventing or planning pregnancy.</div>
            <PillRow opts={LH_OPTS} selected={log.lh_result} single onToggle={v=>set('lh_result',v)}/>
          </>}

          <span style={sLabel}>Wrist temperature °C (optional)</span>
          <div style={{fontSize:11,color:'#9a9590',marginBottom:8,fontStyle:'italic'}}>For this to work, measure first thing on waking, before you get up, at about the same time each day. A small sustained rise (0.3 to 0.5°C) is a sign ovulation has likely passed. (Zhu et al. 2021)</div>
          <input type="number" step="0.1" min="34" max="40" placeholder="e.g. 36.2" value={log.wrist_temp} onChange={e=>set('wrist_temp',e.target.value)}
            style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:15,fontFamily:'inherit',marginBottom:16}}/>

          <span style={sLabel}>Workout today</span>
          <PillRow opts={WORKOUT_OPTS} selected={log.workout_feel} single onToggle={v=>set('workout_feel',v)}/>

          <span style={sLabel}>Disruptors</span>
          <PillRow opts={DISRUPTORS} selected={log.disruptors} onToggle={v=>toggleMulti('disruptors',v)}/>

          <span style={sLabel}>Notes</span>
          <textarea value={log.notes} onChange={e=>set('notes',e.target.value)} placeholder="Anything else worth noting today?" rows={3}
            style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit',marginBottom:16,resize:'vertical',color:'#2c2820'}}/>

          <div style={{marginBottom:20}}>
            <button onClick={()=>setShowHormones(v=>!v)} style={{background:'none',border:'none',fontSize:13,color:'#9a9590',cursor:'pointer',fontFamily:'inherit',padding:0,display:'flex',alignItems:'center',gap:6}}>
              <i className={`ti ti-chevron-${showHormones?'up':'down'}`}/> Hormone test results (optional)
            </button>
            {showHormones&&<div style={{marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[{label:'Estradiol pmol/L',field:'hormone_estradiol',ph:'e.g. 450'},
                {label:'Progesterone nmol/L',field:'hormone_progesterone',ph:'e.g. 28.5'},
                {label:'LH IU/L',field:'hormone_lh',ph:'e.g. 12.0'},
                {label:'Cortisol nmol/L',field:'hormone_cortisol',ph:'e.g. 18.0'}].map(h=>(
                <div key={h.field}>
                  <div style={{fontSize:11,color:'#9a9590',marginBottom:4}}>{h.label}</div>
                  <input type="number" step="0.1" placeholder={h.ph} value={log[h.field]} onChange={e=>set(h.field,e.target.value)}
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

        <button onClick={()=>setLog(p=>({...p, symptoms:['None'], disruptors:['None of these']}))}
          style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid #ede8e0',background:'#fff',color:'#7a7268',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',marginBottom:10}}>
          Nothing notable today
        </button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save check-in →'}</button>
      </div>

      {saved && (
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(44,40,32,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'#faf8f5',borderRadius:18,padding:'28px 24px',textAlign:'center',maxWidth:320,width:'100%'}}>
            <div style={{fontSize:34,marginBottom:8}}>🌿</div>
            <div style={{fontFamily:'Georgia,serif',fontStyle:'italic',fontSize:20,color:'#2c2820',marginBottom:8}}>{isToday ? 'Logged' : 'Saved'}</div>
            <div style={{fontSize:14,color:'#5a5248',lineHeight:1.6,marginBottom:6}}>
              {isToday
                ? (savedPct!=null ? `Your algorithm is now ${savedPct}% personalised to you.` : 'Your data is helping the algorithm learn your pattern.')
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
