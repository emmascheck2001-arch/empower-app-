import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPhase } from '../lib/hormoneSync'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const ENERGY_OPTS  = ['Very low','Low','Normal','High']
const SLEEP_OPTS   = ['Poor','Fair','Good','Excellent']
const RHR_OPTS     = ['Under 55','55 to 65','65 to 75','Over 75','No data']
const MOOD_POS     = ['Energetic','Motivated','Confident','Social','Calm','Focused']
const MOOD_NEG     = ['Tired','Irritable','Anxious','Sad','Brain fog','Low mood']
const SYMPTOMS     = ['Bloating','Cramping','Breast tenderness','Headache','Back pain','Fatigue','Cravings','Mood swings','Acne','None']
const DISRUPTORS   = ['Alcohol','Illness','Travel','Very poor sleep','High stress','None of these']
const FLUID_OPTS   = ['None or dry','Sticky or crumbly','Creamy or lotion-like','Watery','Egg white','Spotting']
const LH_OPTS      = ['No test','Negative','Positive']
const FLOW_OPTS    = ['Spotting only','Light','Moderate','Heavy','Very heavy']
const PAIN_OPTS    = [{v:1,label:'1 None'},{v:2,label:'2 Mild'},{v:3,label:'3 Moderate'},{v:4,label:'4 Severe'},{v:5,label:'5 Debilitating'}]

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
const sLabel = { fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:8, display:'block' }

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState('observation')
  const [isMenstrual, setIsMenstrual] = useState(false)
  const [isPath4, setIsPath4] = useState(false)
  const [showHormones, setShowHormones] = useState(false)
  const [log, setLog] = useState({
    energy:null, sleep_quality:null, resting_hr:null, resting_hr_exact:'',
    wrist_temp:'', cervical_fluid:null, lh_result:null, mood:[], symptoms:[], disruptors:[],
    flow_volume:null, pain_rating:null,
    hormone_estradiol:'', hormone_progesterone:'', hormone_lh:'', hormone_cortisol:'',
    hot_flash_count:'', night_sweats_severity:null, joint_pain_rating:null, brain_fog_rating:null,
  })

  useEffect(()=>{ init() },[])

  async function init() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login',{replace:true}); return }
    const [{ data:profile },{ data:cycleData }] = await Promise.all([
      supabase.from('profiles').select('user_path').eq('id',user.id).single(),
      supabase.from('cycle_data').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ])
    const path4 = profile?.user_path==='4'
    setIsPath4(path4)
    if (!path4 && cycleData?.last_period_date) {
      const last = new Date(cycleData.last_period_date+'T00:00:00')
      const now = new Date(); now.setHours(0,0,0,0)
      const cd = Math.floor((now-last)/86400000)+1
      const p = getPhase(cd, cycleData.cycle_length||28)
      setPhase(p); setIsMenstrual(p==='Menstrual')
    }
    const today = localDateStr()
    const [{ data:existing },{ data:mucus }] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('user_id',user.id).eq('log_date',today).maybeSingle(),
      supabase.from('mucus_logs').select('discharge_type').eq('user_id',user.id).eq('log_date',today).maybeSingle(),
    ])
    if (existing) {
      setLog(prev=>({...prev,
        energy:existing.energy||null, sleep_quality:existing.sleep_quality||null,
        resting_hr:existing.resting_hr||null, resting_hr_exact:existing.resting_hr_exact?String(existing.resting_hr_exact):'',
        wrist_temp:existing.wrist_temp?String(existing.wrist_temp):'',
        lh_result:existing.lh_result||null, mood:existing.mood||[], symptoms:existing.symptoms||[], disruptors:existing.disruptors||[],
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
    setLoading(false)
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
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login',{replace:true}); return }
    const today = localDateStr()
    const payload = {
      user_id:user.id, log_date:today,
      energy:log.energy, symptoms:log.symptoms, lh_result:log.lh_result, mood:log.mood,
      sleep_quality:log.sleep_quality,
      resting_hr:log.resting_hr_exact?String(log.resting_hr_exact):log.resting_hr,
      resting_hr_exact:log.resting_hr_exact?parseInt(log.resting_hr_exact):null,
      disruptors:log.disruptors,
      wrist_temp:log.wrist_temp?parseFloat(log.wrist_temp):null,
      hormone_estradiol:log.hormone_estradiol?parseFloat(log.hormone_estradiol):null,
      hormone_progesterone:log.hormone_progesterone?parseFloat(log.hormone_progesterone):null,
      hormone_lh:log.hormone_lh?parseFloat(log.hormone_lh):null,
      hormone_cortisol:log.hormone_cortisol?parseFloat(log.hormone_cortisol):null,
      flow_volume:log.flow_volume, pain_rating:log.pain_rating,
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
      navigate('/dashboard')
    } catch(e) { console.error(e); setSaving(false) }
  }

  if (loading) return <><TopBar title="Daily log" backTo="/dashboard"/><div style={{paddingTop:60}}><Spinner/></div><BottomNav/></>

  return (
    <>
      <TopBar backTo="/dashboard">
        <div style={{fontSize:13,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase'}}>Daily log</div>
        <div style={{fontSize:12,color:'#7a7268'}}>{phase}</div>
      </TopBar>
      <div style={{padding:'16px 16px 120px'}}>

        {!isMenstrual&&!isPath4&&<>
          <span style={sLabel}>Cervical fluid</span>
          <div style={{fontSize:11,color:'#9a9590',marginBottom:8,fontStyle:'italic'}}>80% sensitivity for detecting your fertile window (Bigelow et al. 2004)</div>
          <PillRow opts={FLUID_OPTS} selected={log.cervical_fluid} single onToggle={v=>set('cervical_fluid',v)}/>
          <span style={sLabel}>LH test</span>
          <PillRow opts={LH_OPTS} selected={log.lh_result} single onToggle={v=>set('lh_result',v)}/>
        </>}

        <span style={sLabel}>Energy today</span>
        <GridRow opts={ENERGY_OPTS} selected={log.energy} onSelect={v=>set('energy',v)}/>

        <span style={sLabel}>Mood — positive</span>
        <PillRow opts={MOOD_POS} selected={log.mood} onToggle={v=>toggleMulti('mood',v)}/>
        <span style={sLabel}>Mood — challenging</span>
        <PillRow opts={MOOD_NEG} selected={log.mood} onToggle={v=>toggleMulti('mood',v)}/>

        <span style={sLabel}>Wrist temperature °C (optional)</span>
        <input type="number" step="0.1" min="34" max="40" placeholder="e.g. 36.2" value={log.wrist_temp} onChange={e=>set('wrist_temp',e.target.value)}
          style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:15,fontFamily:'inherit',marginBottom:16}}/>

        <span style={sLabel}>Resting heart rate</span>
        <PillRow opts={RHR_OPTS} selected={log.resting_hr} single onToggle={v=>{set('resting_hr',v);set('resting_hr_exact','')}}/>
        <input type="number" min="30" max="120" placeholder="Or type exact bpm" value={log.resting_hr_exact}
          onChange={e=>{set('resting_hr_exact',e.target.value);if(e.target.value)set('resting_hr',null)}}
          style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:14,fontFamily:'inherit',marginBottom:16}}/>

        <span style={sLabel}>Physical symptoms</span>
        <PillRow opts={SYMPTOMS} selected={log.symptoms} onToggle={v=>toggleMulti('symptoms',v)}/>

        <span style={sLabel}>Sleep last night</span>
        <GridRow opts={SLEEP_OPTS} selected={log.sleep_quality} onSelect={v=>set('sleep_quality',v)}/>

        <span style={sLabel}>Disruptors</span>
        <PillRow opts={DISRUPTORS} selected={log.disruptors} onToggle={v=>toggleMulti('disruptors',v)}/>

        {isMenstrual&&<>
          <span style={sLabel}>Flow today</span>
          <PillRow opts={FLOW_OPTS} selected={log.flow_volume} single onToggle={v=>set('flow_volume',v)}/>
          <span style={sLabel}>Pain level</span>
          <PillRow opts={PAIN_OPTS} selected={log.pain_rating} single onToggle={v=>set('pain_rating',v)}/>
          <div style={{fontSize:11,color:'#9a9590',fontStyle:'italic',marginBottom:16}}>Pain that disrupts your daily life is not normal. Log it and we will track the pattern.</div>
        </>}

        {isPath4&&<>
          <span style={sLabel}>Hot flashes this week</span>
          <input type="number" min="0" placeholder="Count" value={log.hot_flash_count} onChange={e=>set('hot_flash_count',e.target.value)}
            style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid #ede8e0',fontSize:15,fontFamily:'inherit',marginBottom:16}}/>
          <span style={sLabel}>Night sweats</span>
          <PillRow opts={['None','Mild','Moderate','Severe']} selected={log.night_sweats_severity} single onToggle={v=>set('night_sweats_severity',v)}/>
          <span style={sLabel}>Joint pain (1-5)</span>
          <PillRow opts={[1,2,3,4,5].map(n=>({v:n,label:String(n)}))} selected={log.joint_pain_rating} single onToggle={v=>set('joint_pain_rating',v)}/>
          <span style={sLabel}>Brain fog (1-5)</span>
          <PillRow opts={[1,2,3,4,5].map(n=>({v:n,label:String(n)}))} selected={log.brain_fog_rating} single onToggle={v=>set('brain_fog_rating',v)}/>
        </>}

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
        </div>

        <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save log →'}</button>
      </div>
      <BottomNav/>
    </>
  )
}
