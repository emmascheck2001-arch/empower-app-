// route /setup — onboarding: 5 paths (see PATH_OPTIONS), body stats, bc_type, bc_stop_date. IDs do not match display order — see CLAUDE.md.
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPhase } from '../lib/hormoneSync'
import Spinner from '../components/Spinner'

const PATH_OPTIONS = [
  { id:1, label:'I know my last period date', icon:'ti-calendar' },
  { id:5, label:'I am currently on birth control', icon:'ti-pill' },
  { id:2, label:'I just came off birth control', icon:'ti-pill-off' },
  { id:3, label:'My cycles are irregular or I am not sure', icon:'ti-wave-sine' },
  { id:4, label:'I am in perimenopause or menopause', icon:'ti-heart' },
]
const BC_TYPES = [
  'Combined pill (estrogen and progestin)', 'Mini pill (progestin only)', 'Patch',
  'Vaginal ring', 'Hormonal IUD (Mirena, Kyleena)', 'Copper IUD (non-hormonal)',
  'Implant (Nexplanon)', 'Depo-Provera injection', 'Not sure',
]
// Path 5 — currently on BC. Values must match getTodayStatus bc_type checks.
const BC_TYPES_CURRENT = [
  { val:'pill',         label:'Combined pill (estrogen and progestin)' },
  { val:'minipill',     label:'Mini pill (progestin only)' },
  { val:'patch',        label:'Patch' },
  { val:'ring',         label:'Vaginal ring' },
  { val:'hormonal-iud', label:'Hormonal IUD (Mirena, Kyleena)' },
  { val:'copper-iud',   label:'Copper IUD (non-hormonal)' },
  { val:'implant',      label:'Implant (Nexplanon)' },
  { val:'depo',         label:'Depo-Provera injection' },
]
const optCard = (active) => ({
  padding:'14px 16px', borderRadius:12, border:`1px solid ${active?'#c8b89a':'#ede8e0'}`,
  background:active?'#e8dfd0':'#fff', cursor:'pointer', marginBottom:8,
  display:'flex', alignItems:'center', gap:12
})
const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #ede8e0', fontSize:15, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
const sLabel = { fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:8, display:'block' }

export default function Setup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [checking, setChecking] = useState(true)
  const [path, setPath] = useState(null)
  const [lastPeriod, setLastPeriod] = useState('')
  const [cycleLen, setCycleLen] = useState(28)
  const [bcType, setBcType] = useState(null)
  const [bcStopDate, setBcStopDate] = useState('')
  const [stage, setStage] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [weight, setWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [fitness, setFitness] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [preview, setPreview] = useState(null)

  // Self-correct: if an already-onboarded user lands here (an installed PWA restoring
  // the /setup page, a stray link, or stale routing) send them to the dashboard — they
  // must never be re-shown onboarding. The "Change information" button passes ?edit=1
  // so a user who genuinely wants to update their details can still stay.
  useEffect(() => {
    let cancelled = false
    async function guard() {
      const editing = searchParams.get('edit') === '1'
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setChecking(false); return }
      const { data: prof } = await supabase.from('profiles').select('onboarding_complete').eq('id', user.id).maybeSingle()
      if (cancelled) return
      if (prof?.onboarding_complete && !editing) { navigate('/dashboard', { replace: true }); return }
      setChecking(false)
    }
    guard()
    return () => { cancelled = true }
  }, [navigate, searchParams])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (path === 1 && lastPeriod) {
      const last = new Date(lastPeriod + 'T00:00:00')
      const now = new Date(); now.setHours(0,0,0,0)
      const cd = Math.floor((now - last) / 86400000) + 1
      if (cd >= 1 && cd <= cycleLen + 7) {
        setPreview({ cd, phase: getPhase(cd, cycleLen), daysLeft: Math.max(0, cycleLen - cd + 1) })
      } else setPreview(null)
    } else setPreview(null)
  }, [path, lastPeriod, cycleLen])
  /* eslint-enable react-hooks/set-state-in-effect */

  const canContinue = () => {
    if (!path) return false
    if (path === 1 && !lastPeriod) return false
    if (path === 2 && !bcType) return false
    if (path === 4 && !stage) return false
    if (path === 5 && !bcType) return false
    return true
  }

  async function finish(skip=false) {
    if (!agreed && !skip) return
    setSaving(true)
    setSaveErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }

    let bodyWeightKg = null
    if (!skip && weight) {
      const raw = parseFloat(weight)
      if (!isNaN(raw)) bodyWeightKg = weightUnit === 'lbs' ? Math.round(raw / 2.20462 * 10) / 10 : raw
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id, email: user.email,
      user_path: String(path),
      bc_type: path === 4 ? stage : (path === 2 || path === 5) ? bcType : null,
      bc_stop_date: path === 2 && bcStopDate ? bcStopDate : undefined,
      cycle_length: cycleLen,
      onboarding_complete: true,
      body_weight_kg: bodyWeightKg,
      fitness_level: skip ? null : (fitness || null),
    }, { onConflict: 'id' })

    if (error) {
      console.error(error)
      setSaving(false)
      setSaveErr(
        /jwt|token|auth|session|expired/i.test(error.message || '')
          ? 'Your session has expired. Please sign in again, then finish setup.'
          : `Could not save your setup: ${error.message}. Please try again.`
      )
      return
    }

    if ((path === 1 || path === 5) && lastPeriod) {
      // Surface failures — a silently-failed cycle_data save was losing users' period
      // dates (their cycle never started). Never proceed to the dashboard as if it worked.
      const { error: cycleErr } = await supabase.from('cycle_data').upsert({
        user_id: user.id, last_period_date: lastPeriod, cycle_length: cycleLen
      }, { onConflict: 'user_id' })
      if (cycleErr) {
        console.error(cycleErr)
        setSaving(false)
        setSaveErr(`Could not save your period date: ${cycleErr.message}. Please try again.`)
        return
      }
    }

    navigate('/dashboard', { replace: true })
  }

  if (checking) return <div style={{ paddingTop:60 }}><Spinner /></div>
  if (!showStats) return (
    <div style={{ padding:'24px 16px 120px', minHeight:'100svh' }}>
      <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', textAlign:'center', marginBottom:24 }}>Em~power</div>
      <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, textAlign:'center', marginBottom:8 }}>Welcome.</div>
      <div style={{ fontSize:13, color:'#7a7268', textAlign:'center', lineHeight:1.7, marginBottom:24 }}>
        You have probably been dismissed before. Em~power is not that. Your body sends signals every single day. This app learns to read them.
      </div>

      <span style={sLabel}>How would you describe your cycle right now?</span>
      {PATH_OPTIONS.map(p => (
        <div key={p.id} style={optCard(path===p.id)} onClick={() => { setPath(p.id); setBcType(null); setStage(null); setBcStopDate('') }}>
          <i className={`ti ${p.icon}`} style={{ fontSize:20, color:path===p.id?'#5a4a3a':'#c8b89a', flexShrink:0 }} />
          <div style={{ fontSize:14, fontWeight:path===p.id?600:400 }}>{p.label}</div>
        </div>
      ))}

      {path===1 && (
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:16, marginTop:4 }}>
          <span style={sLabel}>Last period start date</span>
          <input type="date" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)} style={inputStyle} />
          <div style={{ marginTop:12 }}>
            <span style={sLabel}>Cycle length (days)</span>
            <input type="number" min="21" max="45" value={cycleLen} onChange={e=>setCycleLen(parseInt(e.target.value)||28)} style={inputStyle} />
            <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
              {[24,28,30,32,35].map(d=>(
                <button key={d} onClick={()=>setCycleLen(d)} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${cycleLen===d?'#c8b89a':'#ede8e0'}`, background:cycleLen===d?'#e8dfd0':'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{d}</button>
              ))}
            </div>
          </div>
          {preview && (
            <div style={{ marginTop:12, padding:12, background:'#fff', borderRadius:10, border:'1px solid #ede8e0' }}>
              <div style={{ fontSize:12, color:'#9a9590', marginBottom:4 }}>Based on what you entered</div>
              <div style={{ fontSize:14, fontWeight:600 }}>{preview.phase} phase, Day {preview.cd}</div>
              <div style={{ fontSize:13, color:'#7a7268' }}>{preview.daysLeft} days until next period</div>
            </div>
          )}
        </div>
      )}

      {path===5 && (
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:16, marginTop:4 }}>
          <span style={sLabel}>What are you currently using?</span>
          <div style={{ fontSize:13, color:'#7a7268', marginBottom:12, lineHeight:1.6 }}>
            Em~power adapts your nutrition and workout guidance to your method. Hormonal methods affect how your body responds to training.
          </div>
          {BC_TYPES_CURRENT.map(t=>(
            <div key={t.val} style={optCard(bcType===t.val)} onClick={()=>setBcType(t.val)}>
              <div style={{ fontSize:13 }}>{t.label}</div>
            </div>
          ))}
          <div style={{ marginTop:12 }}>
            <span style={sLabel}>Last period or withdrawal bleed (optional)</span>
            <input type="date" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)} style={inputStyle} />
            {lastPeriod && (
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'#9a9590' }}>Cycle length:</span>
                {[24,28,30,32,35].map(d=>(
                  <button key={d} onClick={()=>setCycleLen(d)} style={{ padding:'4px 10px', borderRadius:8, border:`1px solid ${cycleLen===d?'#c8b89a':'#ede8e0'}`, background:cycleLen===d?'#e8dfd0':'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{d}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {path===2 && (
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:16, marginTop:4 }}>
          <span style={sLabel}>What type of birth control did you come off?</span>
          {BC_TYPES.map(t=>(
            <div key={t} style={optCard(bcType===t)} onClick={()=>setBcType(t)}>
              <div style={{ fontSize:13 }}>{t}</div>
            </div>
          ))}
          <span style={{ ...sLabel, marginTop:12 }}>When did you stop? (optional)</span>
          <input type="date" value={bcStopDate} onChange={e=>setBcStopDate(e.target.value)} style={inputStyle} />
        </div>
      )}

      {path===4 && (
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:16, marginTop:4 }}>
          <span style={sLabel}>Where are you in the transition?</span>
          {['Early perimenopause','Late perimenopause','Menopause 12+ months'].map(s=>(
            <div key={s} style={optCard(stage===s)} onClick={()=>setStage(s)}>
              <div style={{ fontSize:13 }}>{s}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ position:'fixed', bottom:0, left:0, right:0, maxWidth:420, margin:'0 auto', padding:'12px 16px', background:'#faf8f5', borderTop:'1px solid #ede8e0' }}>
        <button className="btn-primary" disabled={!canContinue()} onClick={()=>setShowStats(true)}>
          {canContinue() ? 'Continue' : 'Select an option above to continue'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ padding:'24px 16px 120px' }}>
      <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, marginBottom:6 }}>One last thing</div>
      <div style={{ fontSize:13, color:'#7a7268', marginBottom:20, lineHeight:1.6 }}>Your body weight is used only to calculate personalised protein targets.</div>

      <span style={sLabel}>Body weight (optional)</span>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <input type="number" min="30" max="200" step="0.5" placeholder="e.g. 65" value={weight} onChange={e=>setWeight(e.target.value)}
          style={{ flex:1, padding:'12px 14px', borderRadius:10, border:'1px solid #ede8e0', fontSize:15, fontFamily:'inherit' }} />
        <div style={{ display:'flex', borderRadius:10, border:'1px solid #ede8e0', overflow:'hidden' }}>
          {['kg','lbs'].map(u=>(
            <button key={u} onClick={()=>setWeightUnit(u)} style={{ padding:'0 14px', background:weightUnit===u?'#2c2820':'#fff', color:weightUnit===u?'#f5f0e8':'#2c2820', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>{u}</button>
          ))}
        </div>
      </div>

      <span style={sLabel}>Activity level</span>
      {[
        { val:'beginner', title:'New to the gym', desc:'Training less than once a week or just starting out' },
        { val:'intermediate', title:'Getting consistent', desc:'Training 1 to 3 times per week' },
        { val:'active', title:'Regularly active', desc:'Training 3 to 5 times per week' },
        { val:'athlete', title:'Athlete', desc:'Training 5 or more times per week or competing' },
      ].map(f=>(
        <div key={f.val} style={optCard(fitness===f.val)} onClick={()=>setFitness(f.val)}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{f.title}</div>
            <div style={{ fontSize:12, color:'#7a7268' }}>{f.desc}</div>
          </div>
        </div>
      ))}

      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:16, background:'#fff', border:'1px solid #ede8e0', borderRadius:12, margin:'16px 0' }}>
        <input type="checkbox" id="privacyAgree" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
          style={{ width:18, height:18, marginTop:2, accentColor:'#2c2820', flexShrink:0, cursor:'pointer' }} />
        <label htmlFor="privacyAgree" style={{ fontSize:13, color:'#3a3530', lineHeight:1.6, cursor:'pointer' }}>
          I have read and agree to the{' '}
          <a href="/privacy" target="_blank" style={{ color:'#c8b89a', textDecoration:'underline' }}>Privacy Policy</a>.
          I understand Em~power is a wellness app and not a substitute for medical advice.
        </label>
      </div>

      <button className="btn-primary" onClick={()=>finish(false)} disabled={!agreed||saving} style={{ marginBottom:12 }}>
        {saving?'Saving...':agreed?'Finish setup':'Agree to continue'}
      </button>
      {saveErr && (
        <div style={{ fontSize:13, textAlign:'center', marginBottom:12, padding:'10px 14px', borderRadius:8, background:'#fce8e8', color:'#8a2a2a', lineHeight:1.5 }}>
          {saveErr}
        </div>
      )}
      <div style={{ textAlign:'center' }}>
        <button onClick={()=>finish(true)} style={{ background:'none', border:'none', fontSize:13, color:'#9a9590', cursor:'pointer', fontFamily:'inherit' }}>Skip body stats</button>
      </div>
    </div>
  )
}
