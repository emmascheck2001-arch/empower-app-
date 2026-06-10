import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'

const EMMA_EMAIL = 'emmascheck2001@gmail.com'

const CATEGORIES = [
  { id:'something_broken', emoji:'🔧', label:'Something is broken', sub:'Error, crash, or not working' },
  { id:'confusing', emoji:'🤔', label:'Something is confusing', sub:'Hard to understand or use' },
  { id:'missing', emoji:'✨', label:'Something is missing', sub:'Feature or content I want' },
  { id:'wrong', emoji:'📋', label:'Something seems wrong', sub:'Data, science, or recommendations' },
  { id:'love', emoji:'❤️', label:'I love something', sub:'What is working well' },
  { id:'other', emoji:'💬', label:'General feedback', sub:'Anything else' },
]
const SCREENS = [
  { id:'dashboard', label:'Dashboard', icon:'ti-home' },
  { id:'log', label:'Daily log', icon:'ti-pencil' },
  { id:'workout', label:'Workout', icon:'ti-barbell' },
  { id:'checkin', label:'Morning check-in', icon:'ti-sun' },
  { id:'general', label:'General or other', icon:'ti-apps' },
]
const FOLLOWUPS = {
  something_broken: {
    q: 'What happened when it broke?',
    opts: [
      'It showed a blank screen',
      'I got an error message',
      'The button did nothing when I tapped it',
      'It saved but the data disappeared',
      'It redirected me to the wrong screen',
      'It crashed and closed',
    ]
  },
  confusing: {
    q: 'What specifically confused you?',
    opts: [
      'I did not know what to tap next',
      'The wording was hard to understand',
      'I did not know what a feature was for',
      'The phase information was unclear',
      'The workout guidance did not make sense',
      'I could not find something I was looking for',
    ]
  },
  missing: {
    q: 'What type of thing is missing?',
    opts: [
      'A workout or exercise I want to do',
      'A way to track something about my cycle',
      'Better explanations of the science',
      'More personalisation to my data',
      'A way to see my history or trends',
      'Something to connect with other users',
    ]
  },
  wrong: {
    q: 'What type of issue did you notice?',
    opts: [
      'The phase prediction seems wrong for where I am in my cycle',
      'The workout recommendation does not match how I feel',
      'The nutrition advice seems off',
      'A science claim does not seem accurate',
      'The hormone reference ranges look incorrect',
      'The weight suggestions are too high or too low',
    ]
  },
  love: {
    q: 'What made it feel good?',
    opts: [
      'It felt personalised to me specifically',
      'The science explanation was clear and useful',
      'The design looks really good',
      'It was easy and fast to use',
      'It made me feel understood',
      'The workout was exactly what I needed',
    ]
  },
  other: {
    q: 'What is the nature of your feedback?',
    opts: [
      'A suggestion for improvement',
      'A question about how something works',
      'Feedback on the overall experience',
      'Something about the app I want to discuss',
      'A comparison to another app I use',
      'Something else entirely',
    ]
  },
}
const PRIORITY_MAP = {
  something_broken: 'CRITICAL — fix immediately',
  wrong: 'HIGH — science or data accuracy issue',
  confusing: 'MEDIUM — UX improvement needed',
  missing: 'MEDIUM — feature request',
  love: 'INFO — positive signal, do not change',
  other: 'LOW — review and decide',
}

const sLabel = { fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:12, display:'block' }

export default function Feedback() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [allowed, setAllowed] = useState(null)
  const [category, setCategory] = useState(null)
  const [screen, setScreen] = useState(null)
  const [description, setDescription] = useState('')
  const [followup, setFollowup] = useState(null)
  const [frustration, setFrustration] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { navigate('/login', { replace: true }); return }
      setUser(u)
      setAllowed(u.email === EMMA_EMAIL)
    })
  }, [navigate])

  const canSubmit = category && description.length >= 3
  const showFrustration = category && category !== 'love' && description.length >= 3

  function buildClaudeInstruction(cat, screenId, desc, fu, fr) {
    const priority = PRIORITY_MAP[cat] || 'LOW'
    const catLabel = CATEGORIES.find(c => c.id === cat)?.label || cat
    const screenLabel = SCREENS.find(s => s.id === screenId)?.label || 'General'
    const fuText = fu ? ' Specifically: ' + fu + '.' : ''
    const frText = fr ? ' Frustration: ' + fr + '/5.' : ''
    return priority + ' — ' + catLabel + ' on ' + screenLabel + '. User reported: "' + desc + '".' + fuText + frText
  }

  async function submit() {
    if (!canSubmit) return
    setSaving(true)
    try {
      const priority = PRIORITY_MAP[category] || 'LOW'
      const instruction = buildClaudeInstruction(category, screen || 'general', description, followup, frustration)
      await supabase.from('user_feedback').insert({
        user_id: user.id,
        user_email: user.email,
        category,
        screen: screen || 'general',
        description,
        followup_answer: followup,
        frustration_rating: frustration,
        priority,
        claude_code_instruction: instruction,
        status: 'pending',
      })
      setDone(true)
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  if (allowed === null) return null

  if (!allowed) {
    return (
      <div style={{ paddingBottom:40 }}>
        <TopBar title="FEEDBACK" backTo="/dashboard" />
        <div style={{ padding:'40px 20px', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:20, marginBottom:8 }}>Beta access only</div>
          <div style={{ fontSize:14, color:'#7a7268', lineHeight:1.6, marginBottom:24 }}>The feedback tool is only available during the beta period. Thank you for using Em~power.</div>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ padding:'40px 20px', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🌿</div>
        <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:22, marginBottom:8 }}>Feedback received.</div>
        <div style={{ fontSize:14, color:'#7a7268', lineHeight:1.6, marginBottom:32 }}>Emma has been notified and will review this before the next session.</div>
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:12, textAlign:'left' }}>
          <div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Category</div>
          <div style={{ fontSize:13 }}>{CATEGORIES.find(c=>c.id===category)?.label}</div>
        </div>
        <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:12, textAlign:'left' }}>
          <div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Your feedback</div>
          <div style={{ fontSize:13 }}>{description}</div>
        </div>
        {followup && (
          <div style={{ background:'#f5f0e8', borderRadius:12, padding:14, marginBottom:24, textAlign:'left' }}>
            <div style={{ fontSize:11, color:'#9a9590', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Your answer</div>
            <div style={{ fontSize:13 }}>{followup}</div>
          </div>
        )}
        <button className="btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom:40 }}>
      <TopBar title="FEEDBACK" backTo="/dashboard" />
      <div style={{ padding:'16px 16px 40px' }}>

        <div style={{ background:'#2c2820', borderRadius:14, padding:20, marginBottom:20 }}>
          <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, color:'#f5f0e8', marginBottom:8 }}>You are building this app.</div>
          <div style={{ fontSize:13, color:'#c8b89a', lineHeight:1.6 }}>Every piece of feedback goes directly to the developer and shapes what gets fixed next.</div>
        </div>

        {/* Step 1 — Category */}
        <div style={{ marginBottom:20 }}>
          <span style={sLabel}>1. What kind of feedback?</span>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {CATEGORIES.map(c => (
              <div key={c.id} onClick={() => { setCategory(c.id); setFollowup(null) }} style={{
                padding:'12px', borderRadius:12, border:`1px solid ${category===c.id?'#c8b89a':'#ede8e0'}`,
                background:category===c.id?'#e8dfd0':'#fff', cursor:'pointer'
              }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{c.emoji}</div>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{c.label}</div>
                <div style={{ fontSize:11, color:'#9a9590' }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 2 — Screen */}
        {category && (
          <div style={{ marginBottom:20 }}>
            <span style={sLabel}>2. Which screen?</span>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {SCREENS.map(s => (
                <div key={s.id} onClick={() => setScreen(s.id)} style={{
                  padding:'10px 12px', borderRadius:10, border:`1px solid ${screen===s.id?'#c8b89a':'#ede8e0'}`,
                  background:screen===s.id?'#e8dfd0':'#fff', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:8
                }}>
                  <i className={`ti ${s.icon}`} style={{ fontSize:16, color:screen===s.id?'#5a4a3a':'#c8b89a' }} />
                  <div style={{ fontSize:12, fontWeight:screen===s.id?600:400 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Description */}
        {category && (
          <div style={{ marginBottom:20 }}>
            <span style={sLabel}>3. Tell me more</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what happened, what you expected, or what you want..."
              rows={4}
              style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #ede8e0', fontSize:13, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box', outline:'none', lineHeight:1.6 }}
            />
          </div>
        )}

        {/* Step 4 — Follow-up */}
        {category && FOLLOWUPS[category] && (
          <div style={{ marginBottom:20 }}>
            <span style={sLabel}>4. {FOLLOWUPS[category].q}</span>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {FOLLOWUPS[category].opts.map(o => (
                <button key={o} onClick={() => setFollowup(followup===o ? null : o)} style={{
                  padding:'10px 14px', borderRadius:10, border:`1px solid ${followup===o?'#2c2820':'#ede8e0'}`,
                  background:followup===o?'#f5f0e8':'#fff', color:'#2c2820',
                  fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:followup===o?500:400,
                  textAlign:'left'
                }}>{o}</button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5 — Frustration (hidden for 'love' category) */}
        {showFrustration && (
          <div style={{ marginBottom:24 }}>
            <span style={sLabel}>5. How frustrated are you?</span>
            <div style={{ display:'flex', gap:8, justifyContent:'space-between' }}>
              {[['😌',1],['😊',2],['😐',3],['😕',4],['😤',5]].map(([emoji,val]) => (
                <button key={val} onClick={() => setFrustration(val)} style={{
                  flex:1, padding:'10px 0', borderRadius:10, border:`1px solid ${frustration===val?'#c8b89a':'#ede8e0'}`,
                  background:frustration===val?'#e8dfd0':'#fff', fontSize:20, cursor:'pointer'
                }}>{emoji}</button>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ fontSize:10, color:'#9a9590' }}>Not at all</span>
              <span style={{ fontSize:10, color:'#9a9590' }}>Very frustrated</span>
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={submit} disabled={!canSubmit || saving}>
          {saving ? 'Sending...' : canSubmit ? 'Send feedback' : 'Tell me what you want fixed first'}
        </button>
      </div>
    </div>
  )
}
