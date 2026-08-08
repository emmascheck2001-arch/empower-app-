// route /setup, onboarding: 5 paths (see PATH_OPTIONS), body stats, bc_type, bc_stop_date. IDs do not match display order, see CLAUDE.md.
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPhase, mergePeriodStartsNotes } from '../lib/hormoneSync'
import { track } from '../lib/analytics'
import { sessionFlags } from '../lib/session'
import { isValid, sanitize } from '../lib/validate'
import { diffCalendarDays } from '../lib/dateUtils.js'
import Spinner from '../components/Spinner'

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const SETUP_CLOCK = new Date()
const DUE_DATE_MIN = localDateStr(new Date(SETUP_CLOCK.getFullYear(), SETUP_CLOCK.getMonth(), SETUP_CLOCK.getDate() - 14))
const DUE_DATE_MAX = localDateStr(new Date(SETUP_CLOCK.getFullYear(), SETUP_CLOCK.getMonth(), SETUP_CLOCK.getDate() + 294))

const PATH_OPTIONS = [
  { id:1, label:'I know my last period date', icon:'ti-calendar' },
  { id:5, label:'I am currently on birth control', icon:'ti-pill' },
  { id:2, label:'I just came off birth control', icon:'ti-pill-off' },
  { id:3, label:'My cycles are irregular or I am not sure', icon:'ti-wave-sine' },
  { id:6, label:'I am pregnant', icon:'ti-baby-carriage' },
  { id:4, label:'I am in perimenopause or menopause', icon:'ti-heart' },
]
const BC_TYPES = [
  'Combined pill (estrogen and progestin)', 'Mini pill (progestin only)', 'Patch',
  'Vaginal ring', 'Hormonal IUD (Mirena, Kyleena)', 'Copper IUD (non-hormonal)',
  'Implant (Nexplanon)', 'Depo-Provera injection', 'Not sure',
]
// Path 5, currently on BC. Values must match getTodayStatus bc_type checks.
const BC_TYPES_CURRENT = [
  { val:'pill',        label:'Combined pill (estrogen and progestin)' },
  { val:'minipill',    label:'Mini pill (progestin only)' },
  { val:'patch',       label:'Patch' },
  { val:'ring',        label:'Vaginal ring' },
  { val:'hormonal-iud', label:'Hormonal IUD (Mirena, Kyleena)' },
  { val:'copper-iud',  label:'Copper IUD (non-hormonal)' },
  { val:'implant',     label:'Implant (Nexplanon)' },
  { val:'depo',        label:'Depo-Provera injection' },
]
// Optional, self-reported. Used only to surface ancestry-linked health info (additive, never
// restrictive, never used to assume diet). Multi-select for mixed heritage; "prefer_not" clears the rest.
const ETHNICITY_OPTIONS = [
  { val:'black',         label:'Black, African, or Caribbean' },
  { val:'east_asian',    label:'East Asian' },
  { val:'southeast_asian',label:'Southeast Asian' },
  { val:'south_asian',   label:'South Asian' },
  { val:'white',         label:'White or European' },
  { val:'hispanic',      label:'Hispanic or Latina' },
  { val:'mena',          label:'Middle Eastern or North African' },
  { val:'indigenous',    label:'Indigenous' },
  { val:'other',         label:'Another background' },
  { val:'prefer_not',    label:'Prefer not to say' },
]
const optCard = (active) => ({
  padding:'14px 16px', borderRadius:12, border:`1px solid ${active?'#c8b89a':'#ede8e0'}`,
  background:active?'#e8dfd0':'#fff', cursor:'pointer', marginBottom:8,
  display:'flex', alignItems:'center', gap:12,
  width:'100%', textAlign:'left', font:'inherit', color:'#2c2820',
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
  const [dueDate, setDueDate] = useState('')
  const [showStats, setShowStats] = useState(false)
  const [name, setName] = useState('')
  const [weight, setWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [fitness, setFitness] = useState(null)
  const [ethnicity, setEthnicity] = useState([])
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [preview, setPreview] = useState(null)
  const [birthYear, setBirthYear] = useState('')
  const [menarcheYear, setMenarcheYear] = useState('')
  const [originalProfile, setOriginalProfile] = useState(null)
  const [originalCycle, setOriginalCycle] = useState(null)
  const editing = searchParams.get('edit') === '1'

  // Age gating: a 13+ floor (standard for self-serve health-data collection) plus the
  // age itself, used downstream for teen cycle-irregularity reassurance and perimenopause
  // awareness. Year only, we never store a full date of birth.
  const currentYear = SETUP_CLOCK.getFullYear()
  const age = /^\d{4}$/.test(String(birthYear)) ? currentYear - parseInt(birthYear) : null
  const tooYoung = age != null && age < 13
  const validAge = age != null && age >= 13 && age <= 100

  // Self-correct: if an already-onboarded user lands here (an installed PWA restoring
  // the /setup page, a stray link, or stale routing) send them to the dashboard, they
  // must never be re-shown onboarding. The "Change information" button passes ?edit=1
  // so a user who genuinely wants to update their details can still stay.
  useEffect(() => {
    let cancelled = false
    async function guard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setChecking(false); return }
      const [{ data: prof }, { data: cycle }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('cycle_data').select('*').eq('user_id', user.id).order('created_at', { ascending:false }).limit(1).maybeSingle(),
      ])
      if (cancelled) return
      if (prof?.onboarding_complete && !editing) { navigate('/dashboard', { replace: true }); return }
      if (editing && prof) {
        const savedPath = parseInt(prof.user_path)
        setOriginalProfile(prof)
        setOriginalCycle(cycle || null)
        setPath(Number.isInteger(savedPath) ? savedPath : null)
        setName(prof.name || '')
        setBirthYear(prof.birth_year ? String(prof.birth_year) : '')
        setMenarcheYear(prof.menarche_year ? String(prof.menarche_year) : '')
        setCycleLen(cycle?.cycle_length || prof.cycle_length || 28)
        setLastPeriod(cycle?.last_period_date || '')
        setBcType([2, 5].includes(savedPath) ? prof.bc_type || null : null)
        setBcStopDate(prof.bc_stop_date || '')
        setStage(savedPath === 4 ? prof.bc_type || null : null)
        setDueDate(prof.pregnancy_due_date || '')
        setWeight(prof.body_weight_kg != null ? String(prof.body_weight_kg) : '')
        setFitness(prof.fitness_level || null)
        try {
          const savedEthnicity = Array.isArray(prof.ethnicity) ? prof.ethnicity : JSON.parse(prof.ethnicity || '[]')
          setEthnicity(Array.isArray(savedEthnicity) ? savedEthnicity : [])
        } catch { setEthnicity([]) }
        setAgreed(true)
      }
      setChecking(false)
    }
    guard()
    return () => { cancelled = true }
  }, [editing, navigate])

  useEffect(() => {
    if (path === 1 && lastPeriod) {
      const now = new Date(); now.setHours(0,0,0,0)
      const cd = diffCalendarDays(now, lastPeriod + 'T00:00:00') + 1
      if (cd >= 1 && cd <= cycleLen + 7) {
        setPreview({ cd, phase: getPhase(cd, cycleLen), daysLeft: Math.max(0, cycleLen - cd + 1) })
      } else setPreview(null)
    } else setPreview(null)
  }, [path, lastPeriod, cycleLen])

  function toggleEthnicity(val) {
    setEthnicity(prev => {
      if (val === 'prefer_not') return prev.includes('prefer_not') ? [] : ['prefer_not']
      const base = prev.filter(v => v !== 'prefer_not')
      return base.includes(val) ? base.filter(v => v !== val) : [...base, val]
    })
  }

  const canContinue = () => {
    if (!validAge) return false
    if (menarcheYear && (!/^\d{4}$/.test(menarcheYear) || Number(menarcheYear) > currentYear || Number(menarcheYear) < Number(birthYear) + 7)) return false
    if (!path) return false
    if (!isValid('cycle_length', cycleLen)) return false
    if (path === 1 && (!lastPeriod || lastPeriod > localDateStr())) return false
    if (path === 2 && !bcType) return false
    if (path === 4 && !stage) return false
    if (path === 5 && !bcType) return false
    if (path === 2 && bcStopDate && bcStopDate > localDateStr()) return false
    if (path === 6 && (!dueDate || diffCalendarDays(dueDate + 'T00:00:00', new Date()) < -14 || diffCalendarDays(dueDate + 'T00:00:00', new Date()) > 294)) return false
    return true
  }

  async function finish(skip=false) {
    if (!agreed) return   // consent is mandatory; `skip` only skips the optional body stats, never consent
    if (!canContinue()) { setSaveErr('Check the dates and cycle length before continuing. Future period dates, future stop dates, and due dates outside a current pregnancy cannot be saved.'); return }
    setSaving(true)
    setSaveErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }

    let bodyWeightKg = editing ? originalProfile?.body_weight_kg ?? null : null
    if (!skip && weight) {
      const raw = parseFloat(weight)
      if (!isNaN(raw)) bodyWeightKg = sanitize('body_weight_kg', weightUnit === 'lbs' ? Math.round(raw / 2.20462 * 10) / 10 : raw)
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id, email: user.email,
      name: name.trim() || null,
      user_path: String(path),
      bc_type: path === 4 ? stage : (path === 2 || path === 5) ? bcType : null,
      bc_stop_date: path === 2 && bcStopDate ? bcStopDate : null,
      cycle_length: sanitize('cycle_length', cycleLen),
      pregnancy_due_date: path === 6 && dueDate ? dueDate : null,
      birth_year: birthYear ? parseInt(birthYear) : null,
      menarche_year: menarcheYear ? parseInt(menarcheYear) : null,
      ethnicity: ethnicity.length ? JSON.stringify(ethnicity) : null,
      onboarding_complete: true,
      body_weight_kg: bodyWeightKg,
      fitness_level: skip ? (editing ? originalProfile?.fitness_level || null : null) : (fitness || null),
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
      // Surface failures, a silently-failed cycle_data save was losing users' period
      // dates (their cycle never started). Never proceed to the dashboard as if it worked.
      const { error: cycleErr } = await supabase.from('cycle_data').upsert({
        user_id: user.id, last_period_date: lastPeriod, cycle_length: sanitize('cycle_length', cycleLen),
        notes: mergePeriodStartsNotes(originalCycle?.notes, originalCycle?.last_period_date, lastPeriod)
      }, { onConflict: 'user_id' })
      if (cycleErr) {
        console.error(cycleErr)
        setSaving(false)
        setSaveErr(`Could not save your period date: ${cycleErr.message}. Please try again.`)
        return
      }
    }

    track('onboarding_complete', { path: String(path), skipped: skip })
    sessionFlags.justOnboardedUid = user.id   // only THIS user skips the post-setup bounce, never a different account on the same tab
    navigate('/dashboard', { replace: true })
  }

  if (checking) return <div style={{ paddingTop:60 }}><Spinner /></div>
  if (!showStats) return (
    <div style={{ padding:'calc(24px + var(--sat)) 16px 120px', minHeight:'100svh' }}>
      <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', textAlign:'center', marginBottom:8 }}>Em~power</div>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#b0a89a', textAlign:'center', marginBottom:20 }}>Step 1 of 2 · takes less than a minute</div>
      <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, textAlign:'center', marginBottom:8 }}>Welcome.</div>
      <div style={{ fontSize:13, color:'#7a7268', textAlign:'center', lineHeight:1.7, marginBottom:24 }}>
        You have probably been dismissed before. Em~power is not that. Your body sends signals every single day. This app learns to read them.
      </div>

      <span style={sLabel}>What should we call you?</span>
      <input type="text" aria-label="What should we call you?" placeholder="First name (optional)" value={name}
        onChange={e=>setName(e.target.value)} style={{ ...inputStyle, marginBottom:16 }} />

      <span style={sLabel}>What year were you born?</span>
      <div style={{ fontSize:12, color:'#9a9590', marginBottom:8, lineHeight:1.5 }}>Only the year, to tailor your guidance by life stage. We never store your full date of birth.</div>
      <input type="number" inputMode="numeric" aria-label="What year were you born?" placeholder="e.g. 1995" value={birthYear}
        onChange={e=>setBirthYear(e.target.value)} style={{ ...inputStyle, marginBottom: tooYoung || (validAge && age < 18) ? 8 : 16 }} />
      {tooYoung && (
        <div style={{ background:'#fdf0f0', border:'1px solid #f0d8d8', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#5a2a28', lineHeight:1.6 }}>
          Em~power is built for ages 13 and up. If you are under 13, please use it together with a parent or guardian.
        </div>
      )}
      {validAge && age < 18 && (
        <div style={{ background:'#f5f0e8', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#7a7268', lineHeight:1.6 }}>
          Tracking your cycle this early is a brilliant habit. If you are under 18, we suggest letting a parent or guardian know you are using Em~power.
        </div>
      )}

      <span style={sLabel}>Year your first period started (optional)</span>
      <div style={{ fontSize:12, color:'#9a9590', marginBottom:8, lineHeight:1.5 }}>This helps distinguish the normal variability of the first years after menarche from an established adult pattern. It never changes your workout automatically.</div>
      <input type="number" inputMode="numeric" min={birthYear ? Number(birthYear) + 7 : 1900} max={currentYear} aria-label="Year your first period started (optional)" placeholder="e.g. 2008" value={menarcheYear}
        onChange={e=>setMenarcheYear(e.target.value)} style={{ ...inputStyle, marginBottom:16 }} />

      <span style={sLabel}>How would you describe your cycle right now?</span>
      {PATH_OPTIONS.map(p => (
        <button type="button" key={p.id} aria-pressed={path===p.id} style={optCard(path===p.id)} onClick={() => { setPath(p.id); setBcType(null); setStage(null); setBcStopDate('') }}>
          <i className={`ti ${p.icon}`} aria-hidden="true" style={{ fontSize:20, color:path===p.id?'#5a4a3a':'#c8b89a', flexShrink:0 }} />
          <div style={{ fontSize:14, fontWeight:path===p.id?600:400 }}>{p.label}</div>
        </button>
      ))}

      {path===1 && (
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:16, marginTop:4 }}>
          <span style={sLabel}>Last period start date</span>
          <input type="date" max={localDateStr()} aria-label="Last period start date" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)} style={inputStyle} />
          <div style={{ marginTop:12 }}>
            <span style={sLabel}>Cycle length (days)</span>
            <input type="number" min="15" max="90" aria-label="Cycle length (days)" value={cycleLen} onChange={e=>setCycleLen(parseInt(e.target.value)||28)} style={inputStyle} />
            <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
              {[24,28,30,32,35].map(d=>(
                <button type="button" key={d} aria-label={`${d} day cycle`} aria-pressed={cycleLen===d} onClick={()=>setCycleLen(d)} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${cycleLen===d?'#c8b89a':'#ede8e0'}`, background:cycleLen===d?'#e8dfd0':'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{d}</button>
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
          <div style={{ textAlign:'center', marginTop:12 }}>
            <button onClick={()=>{ setPath(3); setLastPeriod(''); setPreview(null) }} style={{ background:'none', border:'none', color:'#9a8a6a', fontSize:12, textDecoration:'underline', cursor:'pointer', fontFamily:'inherit' }}>
              Not sure of your exact date? Track as irregular instead
            </button>
          </div>
        </div>
      )}

      {path===5 && (
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:16, marginTop:4 }}>
          <span style={sLabel}>What are you currently using?</span>
          <div style={{ fontSize:13, color:'#7a7268', marginBottom:12, lineHeight:1.6 }}>
            Methods differ. Combined methods and injections usually suppress ovulation, while ovulation can continue with some IUDs, implants and mini-pills. Em~power tracks your exact method, bleeding, symptoms and training without assigning an unverified natural phase.
          </div>
          {BC_TYPES_CURRENT.map(t=>(
            <button type="button" key={t.val} aria-pressed={bcType===t.val} style={optCard(bcType===t.val)} onClick={()=>setBcType(t.val)}>
              <div style={{ fontSize:13 }}>{t.label}</div>
            </button>
          ))}
          <div style={{ marginTop:12 }}>
            <span style={sLabel}>Last withdrawal bleed (optional)</span>
            <div style={{ fontSize:12, color:'#9a9590', marginBottom:8, lineHeight:1.5 }}>Only if you get a monthly bleed in your placebo week, and we will predict your next one. Skip this if you take your pills continuously or do not bleed.</div>
            <input type="date" max={localDateStr()} aria-label="Last withdrawal bleed (optional)" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)} style={inputStyle} />
            {lastPeriod && (
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'#9a9590' }}>Cycle length:</span>
                {[24,28,30,32,35].map(d=>(
                  <button type="button" key={d} aria-label={`${d} day cycle`} aria-pressed={cycleLen===d} onClick={()=>setCycleLen(d)} style={{ padding:'4px 10px', borderRadius:8, border:`1px solid ${cycleLen===d?'#c8b89a':'#ede8e0'}`, background:cycleLen===d?'#e8dfd0':'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{d}</button>
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
            <button type="button" key={t} aria-pressed={bcType===t} style={optCard(bcType===t)} onClick={()=>setBcType(t)}>
              <div style={{ fontSize:13 }}>{t}</div>
            </button>
          ))}
          <span style={{ ...sLabel, marginTop:12 }}>When did you stop? (optional)</span>
          <input type="date" max={localDateStr()} aria-label="When did you stop birth control? (optional)" value={bcStopDate} onChange={e=>setBcStopDate(e.target.value)} style={inputStyle} />
        </div>
      )}

      {path===6 && (
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:16, marginTop:4 }}>
          <span style={sLabel}>Congratulations 🌿 When is your due date?</span>
          <div style={{ fontSize:13, color:'#7a7268', marginBottom:12, lineHeight:1.6 }}>
            We use this to show where you are in your pregnancy. In pregnancy, cycle tracking pauses, and your guidance is led by your doctor or midwife. Em~power is here for support and education, never a replacement for prenatal care.
          </div>
          <input type="date" min={DUE_DATE_MIN} max={DUE_DATE_MAX} aria-label="When is your due date?" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={inputStyle} />
          <div style={{ fontSize:12, color:'#9a9590', marginTop:8, lineHeight:1.5 }}>An estimate is fine if you are not sure of the exact date.</div>
        </div>
      )}

      {path===4 && (
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:16, marginTop:4 }}>
          <span style={sLabel}>Where are you in the transition?</span>
          {['Early perimenopause','Late perimenopause','Menopause 12+ months'].map(s=>(
            <button type="button" key={s} aria-pressed={stage===s} style={optCard(stage===s)} onClick={()=>setStage(s)}>
              <div style={{ fontSize:13 }}>{s}</div>
            </button>
          ))}
        </div>
      )}

      <div style={{ position:'fixed', bottom:0, left:0, right:0, maxWidth:420, margin:'0 auto', padding:'12px 16px', background:'#faf8f5', borderTop:'1px solid #ede8e0' }}>
        <button className="btn-primary" disabled={!canContinue()} onClick={()=>setShowStats(true)}>
          {canContinue() ? 'Continue'
            : tooYoung ? 'Em~power is for ages 13 and up'
            : !validAge ? 'Enter your birth year to continue'
            : 'Select an option above to continue'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ padding:'calc(24px + var(--sat)) 16px 120px' }}>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#b0a89a', marginBottom:10 }}>Step 2 of 2 · almost done</div>
      <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, marginBottom:6 }}>One last thing</div>
      <div style={{ fontSize:13, color:'#7a7268', marginBottom:20, lineHeight:1.6 }}>All of this is optional, it just makes your guidance more personal. Your body weight is used only to calculate protein targets.</div>

      <span style={sLabel}>Body weight (optional)</span>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <input type="number" min="30" max="200" step="0.5" aria-label="Body weight (optional)" placeholder="e.g. 65" value={weight} onChange={e=>setWeight(e.target.value)}
          style={{ flex:1, padding:'12px 14px', borderRadius:10, border:'1px solid #ede8e0', fontSize:15, fontFamily:'inherit' }} />
        <div style={{ display:'flex', borderRadius:10, border:'1px solid #ede8e0', overflow:'hidden' }}>
          {['kg','lbs'].map(u=>(
            <button type="button" key={u} aria-label={`Weight in ${u}`} aria-pressed={weightUnit===u} onClick={()=>setWeightUnit(u)} style={{ padding:'0 14px', background:weightUnit===u?'#2c2820':'#fff', color:weightUnit===u?'#f5f0e8':'#2c2820', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>{u}</button>
          ))}
        </div>
      </div>

      <span style={sLabel}>Activity level (optional)</span>
      {[
        { val:'beginner', title:'New to the gym', desc:'Training less than once a week or just starting out' },
        { val:'intermediate', title:'Getting consistent', desc:'Training 1 to 3 times per week' },
        { val:'active', title:'Regularly active', desc:'Training 3 to 5 times per week' },
        { val:'athlete', title:'Athlete', desc:'Training 5 or more times per week or competing' },
      ].map(f=>(
        <button type="button" key={f.val} aria-pressed={fitness===f.val} style={optCard(fitness===f.val)} onClick={()=>setFitness(f.val)}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{f.title}</div>
            <div style={{ fontSize:12, color:'#7a7268' }}>{f.desc}</div>
          </div>
        </button>
      ))}

      <span style={{ ...sLabel, marginTop:20 }}>Your background (optional)</span>
      <div style={{ fontSize:12, color:'#7a7268', marginBottom:10, lineHeight:1.6 }}>
        This lets us show health information that is most relevant to you, since some conditions are more common in certain backgrounds. It is private, never sold, and you can skip it. Choose any that apply.
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:4 }}>
        {ETHNICITY_OPTIONS.map(o => {
          const active = ethnicity.includes(o.val)
          return (
            <button type="button" key={o.val} aria-pressed={active} onClick={()=>toggleEthnicity(o.val)} style={{ padding:'8px 12px', borderRadius:10, border:`1px solid ${active?'#c8b89a':'#ede8e0'}`, background:active?'#e8dfd0':'#fff', cursor:'pointer', fontSize:12, fontWeight:active?600:400, color:active?'#5a4a3a':'#2c2820', fontFamily:'inherit' }}>{o.label}</button>
          )
        })}
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:16, background:'#fff', border:'1px solid #ede8e0', borderRadius:12, margin:'16px 0' }}>
        <input type="checkbox" id="privacyAgree" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
          style={{ width:18, height:18, marginTop:2, accentColor:'#2c2820', flexShrink:0, cursor:'pointer' }} />
        <label htmlFor="privacyAgree" style={{ fontSize:13, color:'#3a3530', lineHeight:1.6, cursor:'pointer' }}>
          I have read and agree to the{' '}
          <a href="/terms" target="_blank" style={{ color:'#c8b89a', textDecoration:'underline' }}>Terms of Use</a>{' '}and{' '}
          <a href="/privacy" target="_blank" style={{ color:'#c8b89a', textDecoration:'underline' }}>Privacy Policy</a>.
          I understand Em~power is an early wellness app for education and tracking, is not medical advice or a method of contraception, and that I use it at my own risk and will consult a healthcare professional for medical decisions.
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
        <button onClick={()=>finish(true)} disabled={!agreed||saving} style={{ background:'none', border:'none', fontSize:13, color:agreed?'#9a9590':'#c8c0b8', cursor:agreed?'pointer':'default', fontFamily:'inherit' }}>Skip body stats</button>
      </div>
    </div>
  )
}
