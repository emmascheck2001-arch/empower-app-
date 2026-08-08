// route /visit-prep, turns the user's own tracked data into a doctor-ready summary.
// The antidote to being dismissed: walk in with data. Read-only; nothing is written.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildVisitSummary, summaryToText } from '../lib/visitPrep'
import { analyzeSymptomPatterns } from '../lib/symptomPatterns'
import { getHormonalContext } from '../lib/hormoneSync'
import { track } from '../lib/analytics'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const card = { background: '#fff', border: '1px solid #ede8e0', borderRadius: 14, padding: 16, marginBottom: 12 }
const sLabel = { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9590', marginBottom: 10, display: 'block' }

export default function VisitPrep() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [profile, setProfile] = useState(null)
  const [symptomTiming, setSymptomTiming] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login', { replace: true }); return }
      try {
        const [{ data: prof }, { data: cycleData }, { data: logs }, { data: baselines }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('cycle_data').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('daily_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(120),
          supabase.from('user_baselines').select('*').eq('id', user.id).maybeSingle(),
        ])
        const context = getHormonalContext(prof)
        const contextLogs = (logs || []).filter(log => log.hormonal_context ? log.hormonal_context === context : context === 'natural-cycle')
        setProfile(prof)
        setSummary(buildVisitSummary({ profile: prof || {}, cycleData, logs: contextLogs, baselines, todayStr: localDateStr() }))
        // Symptom Coach, how her logged symptoms line up (or don't) with her cycle.
        setSymptomTiming(analyzeSymptomPatterns({ logs: contextLogs, cycleData }))
        track('visit_prep_view', { logs: contextLogs.length })
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    init()
  }, [navigate])

  async function copyAll() {
    try {
      let text = summaryToText(summary, profile || {})
      if (symptomTiming?.status === 'ok' && symptomTiming.summary.length) {
        text += '\n\nHOW MY SYMPTOMS LINE UP WITH MY CYCLE\n' + symptomTiming.summary.map(l => `- ${l}`).join('\n')
      }
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      track('visit_prep_copy')
    } catch { /* clipboard blocked, the on-screen summary is still readable */ }
  }

  if (loading) return <><TopBar title="Visit prep" backTo="/dashboard" /><div style={{ paddingTop: 60 }}><Spinner /></div><BottomNav /></>

  return (
    <>
      <TopBar title="Visit prep" subtitle="A summary to bring to your doctor" backTo="/dashboard" />
      <div style={{ padding: '16px 16px 120px' }}>

        {/* intro */}
        <div style={{ ...card, background: '#f5f0e8', border: '1px solid #e8dfd0' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 19, color: '#2c2820', marginBottom: 6 }}>Walk in with data.</div>
          <div style={{ fontSize: 13, color: '#5a5248', lineHeight: 1.6 }}>
            You have been tracking your body. This pulls it together into a clear summary you can show a doctor or midwife, so the conversation starts from evidence, not from being asked to remember. It is a wellness summary, not a diagnosis.
          </div>
        </div>

        {!summary?.hasData && (
          <div style={card}>
            <div style={{ fontSize: 13, color: '#5a5248', lineHeight: 1.6 }}>
              You have not logged enough yet to build a summary. Log how you feel for a few days and this will fill in, the more days you track, the stronger the picture you can bring to an appointment.
            </div>
            <button onClick={() => navigate('/log')} className="btn-primary" style={{ marginTop: 12 }}>Log today</button>
          </div>
        )}

        {summary?.hasData && (
          <>
            {/* snapshot */}
            <div style={card}>
              <span style={sLabel}>Snapshot</span>
              <Row label="Life stage" value={summary.snapshot.lifeStage} />
              {summary.snapshot.ageText && <Row label="Age" value={summary.snapshot.ageText} />}
              <Row label="Tracking" value={summary.snapshot.trackingSpanText} />
              {summary.cycle?.typicalLength && <Row label="Typical cycle" value={`${summary.cycle.typicalLength} days`} />}
              {summary.cycle?.lastPeriod && <Row label="Last period" value={summary.cycle.lastPeriod} />}
            </div>

            {/* what I've tracked */}
            {summary.symptoms.length > 0 && (
              <div style={card}>
                <span style={sLabel}>What I have been tracking</span>
                {summary.symptoms.map((s, i) => (
                  <div key={i} style={{ marginBottom: i === summary.symptoms.length - 1 ? 0 : 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#2c2820' }}>{s.label}</div>
                    <div style={{ fontSize: 13, color: '#7a7268', marginTop: 2 }}>{s.detail}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Symptom timing, how symptoms line up (or don't) with the cycle */}
            {symptomTiming?.status === 'ok' && symptomTiming.summary.length > 0 && (
              <div style={card}>
                <span style={sLabel}>How my symptoms line up with my cycle</span>
                {symptomTiming.summary.map((line, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#3a3530', lineHeight: 1.6, marginBottom: i === symptomTiming.summary.length - 1 ? 0 : 10, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#c8b89a' }}>•</span>{line}
                  </div>
                ))}
              </div>
            )}
            {symptomTiming?.status === 'insufficient' && (
              <div style={card}>
                <span style={sLabel}>How my symptoms line up with my cycle</span>
                <div style={{ fontSize: 13, color: '#7a7268', lineHeight: 1.6 }}>{symptomTiming.summary[0]}</div>
              </div>
            )}

            {/* patterns worth raising */}
            {summary.patternsToRaise.length > 0 && (
              <div style={{ ...card, background: '#fdf8f0', border: '1px solid #ece0c8' }}>
                <span style={{ ...sLabel, color: '#9a7a40' }}>Patterns worth discussing</span>
                {summary.patternsToRaise.map((p, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#5a4a30', lineHeight: 1.6, marginBottom: i === summary.patternsToRaise.length - 1 ? 0 : 10, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#c8a860' }}>•</span>{p}
                  </div>
                ))}
                <div style={{ fontSize: 11, color: '#9a8a60', fontStyle: 'italic', marginTop: 10 }}>These are patterns in your own data, not a diagnosis. A clinician can interpret them properly.</div>
              </div>
            )}

            {/* questions */}
            {summary.questions.length > 0 && (
              <div style={card}>
                <span style={sLabel}>Questions to ask</span>
                {summary.questions.map((q, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#2c2820', lineHeight: 1.6, marginBottom: i === summary.questions.length - 1 ? 0 : 8, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#9a9590' }}>, </span>{q}
                  </div>
                ))}
              </div>
            )}

            {/* tests */}
            {summary.tests.length > 0 && (
              <div style={card}>
                <span style={sLabel}>Tests worth asking about</span>
                {summary.tests.map((t, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#2c2820', lineHeight: 1.6, marginBottom: i === summary.tests.length - 1 ? 0 : 8, paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#9a9590' }}>, </span>{t}
                  </div>
                ))}
              </div>
            )}

            {/* actions */}
            <button onClick={copyAll} className="btn-primary" style={{ marginTop: 4 }}>{copied ? 'Copied to clipboard ✓' : 'Copy summary'}</button>
            <button onClick={() => window.print()} style={{ width: '100%', marginTop: 10, padding: '14px', borderRadius: 12, border: '1px solid #ede8e0', background: '#fff', color: '#5a5248', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Print or save as PDF</button>

            <div style={{ fontSize: 11, color: '#9a9590', lineHeight: 1.6, marginTop: 16, textAlign: 'center' }}>
              Em~power is a wellness app, not a medical device. This summary supports your conversation with a qualified professional, it does not replace it.
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #f5f0e8' }}>
      <span style={{ fontSize: 13, color: '#7a7268' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#2c2820', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
