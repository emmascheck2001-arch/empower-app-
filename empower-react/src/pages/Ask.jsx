// route /ask, "Ask Em~power": the user asks, the app answers from their own data + Em~power's
// vetted, cited content (see lib/askEngine.js). No LLM, nothing generated. Red flags route to
// seek-care; unmatched questions offer to submit to Em~power instead of guessing.
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import { answerQuestion, buildTopics, STARTERS, localDateStr } from '../lib/askEngine'
import { track } from '../lib/analytics'
import { diffCalendarDays } from '../lib/dateUtils'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

export default function Ask() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialQ = searchParams.get('q')  // a question tapped from a dashboard chip auto-runs
  const [loading, setLoading] = useState(true)
  const [ctx, setCtx] = useState(null)
  const [topics] = useState(() => buildTopics())
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const scroller = useRef(null)

  useEffect(() => { init() }, [])
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [messages])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login', { replace: true }); return }
    try {
      const since = new Date(); since.setDate(since.getDate() - 120)
      const [status, { data: cycle }, { data: logs }] = await Promise.all([
        getTodayStatus(supabase, user.id).catch(() => null),
        supabase.from('cycle_data').select('last_period_date,cycle_length,notes').eq('user_id', user.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
        supabase.from('daily_logs').select('log_date,energy,mood,symptoms,sleep_quality,flow_volume,pain_rating,workout_feel,hormonal_context').eq('user_id', user.id).gte('log_date', localDateStr(since)).order('log_date',{ascending:false}),
      ])
      let streak = 0
      const context = status?.contextKey || 'natural-cycle'
      const ll = (logs || []).filter(log => log.hormonal_context ? log.hormonal_context === context : true)
      const check = new Date(); check.setHours(0,0,0,0)
      for (const l of ll) {
        const diff = diffCalendarDays(check, l.log_date+'T00:00:00')
        if (diff === streak) { streak++; check.setDate(check.getDate()-1) } else break
      }
      const ctxObj = { status, cycle: cycle || null, logs: ll, streak, userEmail: user.email, userId: user.id }
      setCtx(ctxObj)
      // Auto-answer a question passed from a dashboard chip (?q=...)
      if (initialQ) {
        const res = answerQuestion(initialQ, ctxObj, topics)
        track('ask_question', { kind: res.kind, from: 'chip' })
        setMessages([{ role:'user', text:initialQ }, { role:'bot', ...res, submitted:false }])
      }
    } catch(e) { console.error(e); setCtx({ status:null, cycle:null, logs:[], streak:0, userEmail: user.email, userId: user.id }) }
    setLoading(false)
  }

  function send(text) {
    const q = (text ?? input).trim()
    if (!q || !ctx) return
    setInput('')
    const res = answerQuestion(q, ctx, topics)
    track('ask_question', { kind: res.kind })
    setMessages(m => [...m, { role:'user', text:q }, { role:'bot', ...res, submitted:false }])
  }

  async function submitToEmpower(idx, question) {
    try {
      await supabase.from('user_feedback').insert({
        user_id: ctx.userId, user_email: ctx.userEmail,
        category: 'assistant_question', screen: 'ask', description: question,
        priority: 'LOW', status: 'pending',
      })
      track('ask_submitted', {})
    } catch(e) { console.error(e) }
    setMessages(m => m.map((msg,i) => i===idx ? { ...msg, submitted:true } : msg))
  }

  if (loading) return <><TopBar title="Ask Em~power" backTo="/dashboard"/><div style={{paddingTop:60}}><Spinner/></div><BottomNav/></>

  return (
    <>
      <TopBar backTo="/dashboard">
        <div style={{fontSize:13,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase'}}>Ask Em~power</div>
        <div style={{fontSize:12,color:'#7a7268'}}>Your body, your data, instant answers</div>
      </TopBar>

      <div ref={scroller} style={{ padding:'16px 16px 8px', minHeight:'calc(100svh - 250px)' }}>
        {messages.length === 0 && (
          <div>
            <div style={{ background:'#f5f0e8', borderRadius:14, padding:16, marginBottom:16 }}>
              <div style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:18, marginBottom:6 }}>Search your data and Em~power&apos;s reviewed guidance.</div>
              <div style={{ fontSize:13, color:'#5a5248', lineHeight:1.6 }}>This is a guided question library, not a diagnosis or a substitute for a clinician. It uses your logs when a matching answer is available. If it may have misunderstood, try different wording or send the question to Em~power for review.</div>
            </div>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9590', marginBottom:10 }}>Try one of these</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding:'8px 13px', borderRadius:20, border:'1px solid #ede8e0', background:'#fff', color:'#3a3530', fontSize:13, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => m.role === 'user' ? (
          <div key={i} style={{ display:'flex', justifyContent:'flex-end', margin:'14px 0 6px' }}>
            <div style={{ background:'#2c2820', color:'#f5f0e8', borderRadius:'14px 14px 4px 14px', padding:'10px 14px', fontSize:14, maxWidth:'85%', lineHeight:1.5 }}>{m.text}</div>
          </div>
        ) : (
          <div key={i} style={{ display:'flex', justifyContent:'flex-start', marginBottom:8 }}>
            <div style={{
              background: m.kind==='redflag' ? (m.tone==='crisis' ? '#f0f0f8' : '#fdeeee') : '#fff',
              border: `1px solid ${m.kind==='redflag' ? (m.tone==='crisis' ? '#d6d6ea' : '#e8b0a0') : '#ede8e0'}`,
              borderRadius:'14px 14px 14px 4px', padding:'12px 15px', fontSize:14, maxWidth:'90%', lineHeight:1.6, color:'#2c2820'
            }}>
              {m.kind==='redflag' && <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color: m.tone==='crisis' ? '#5a5a8a' : '#a83a20', marginBottom:6 }}>{m.tone==='crisis' ? 'You are not alone' : 'Please read this'}</div>}
              <div>{m.text}</div>
              {m.tone==='crisis' && <a href="tel:988" style={{ display:'inline-block', marginTop:10, background:'#2c2820', color:'#f5f0e8', textDecoration:'none', borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:600 }}>Call or text 988</a>}
              {m.link && (
                <button onClick={() => navigate(m.link.to)} style={{ display:'block', marginTop:10, background:'none', border:'none', color:'#9a8a6a', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                  {m.link.label} →
                </button>
              )}
              {m.kind==='unknown' && (
                m.submitted ? (
                  <div style={{ marginTop:6, fontSize:13, color:'#5a7a5a' }}>Sent, thank you. Real questions like yours decide what we add next. 🌿</div>
                ) : (
                  <div style={{ marginTop:4 }}>
                    <div style={{ marginBottom:10 }}>I do not have a confident, research-backed answer for that yet, and I will not guess. Would you like to send it to Em~power so we can look into adding it?</div>
                    <button onClick={() => submitToEmpower(i, m.question)} style={{ background:'#2c2820', color:'#f5f0e8', border:'none', borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Send to Em~power</button>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position:'sticky', bottom:0, background:'#faf8f5', borderTop:'1px solid #ede8e0', padding:'10px 16px', display:'flex', gap:8, alignItems:'center' }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send() }}
          aria-label="Ask about your cycle, training, nutrition"
          placeholder="Ask about your cycle, training, nutrition…"
          style={{ flex:1, padding:'12px 14px', borderRadius:22, border:'1px solid #ede8e0', fontSize:14, fontFamily:'inherit', outline:'none', background:'#fff', color:'#2c2820' }} />
        <button type="button" aria-label="Send" onClick={()=>send()} disabled={!input.trim()} style={{ width:44, height:44, borderRadius:22, border:'none', background: input.trim() ? '#2c2820' : '#c8c0b8', color:'#f5f0e8', cursor: input.trim()?'pointer':'default', flexShrink:0, fontSize:18 }}>
          <i className="ti ti-arrow-up" aria-hidden="true"/>
        </button>
      </div>
      <BottomNav/>
    </>
  )
}
