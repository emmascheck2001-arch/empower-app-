// FirstLog — the last step of onboarding, and the most important one.
//
// WHY THIS EXISTS: of 24 people who signed up, 22 completed onboarding and only 15 ever
// logged a single day. Nine finished setup and never came back. They never reached the part
// of the app that does anything — setup ended on a dashboard that could not say much yet,
// because it had no logs to say it from.
//
// So onboarding now ENDS with a real log. One question, one tap, a genuine row in daily_logs,
// and one true thing said straight back. She leaves setup already activated, and the dashboard
// she lands on has something of hers in it.
//
// RULES:
//  1. ONE question. This is the end of a setup flow she has already spent a minute on; adding
//     a second question here trades the whole point of it away.
//  2. SKIPPABLE, and skipping is not punished. Consent to be here is not consent to be pushed.
//  3. The line we say back must be TRUE and derived from her data + the phase engine. No
//     "great job", no fabricated insight, and nothing prescriptive for the pregnancy path.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getTodayStatus } from '../lib/hormoneSync'
import { track } from '../lib/analytics'

const ENERGY_OPTS = ['Very low', 'Low', 'Normal', 'High']

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// One honest sentence, built from the engine — never a compliment, never invented.
function firstInsight(status, energy) {
  if (!status) return null
  if (status.phase === 'Pregnancy') {
    return status.subPhase
      ? `You are in your ${String(status.subPhase).toLowerCase()}. Everything in Em~power will follow that from here, and it always defers to your provider.`
      : 'Em~power will follow your pregnancy from here, and always defers to your provider.'
  }
  // Life stages that have no cycle to place her in get their own wording — a birth-control
  // user was previously told "You are in your combined pill phase", which is nonsense.
  if (status.phase === 'bc') {
    const method = status.subPhase ? ` (${status.subPhase.toLowerCase()})` : ''
    return `Your contraception${method} keeps your hormones steady, so there is no natural cycle to track. Em~power will follow your symptoms and training instead.`
  }
  if (status.phase === 'Perimenopause') {
    const stage = status.subPhase ? String(status.subPhase).toLowerCase() : 'perimenopause'
    return `Em~power will track you through ${stage} — symptoms, sleep and training rather than a cycle.`
  }
  const bits = []
  if (status.phase && status.phase !== 'observation') {
    bits.push(`You are in your ${String(status.subPhase || status.phase).toLowerCase()} phase`)
    if (status.cycleDay) bits.push(`day ${status.cycleDay} of your cycle`)
  }
  const lead = bits.length ? bits.join(', ') + '.' : 'That is your first data point.'
  const protein = status.nutritionTargets?.proteinG
  const extra = status.phase === 'observation'
    ? ' Log a few more days and I can start placing you in your cycle from your own signals.'
    : protein ? ` Today that means about ${protein}g of protein, and ${String(status.intensityLabel || '').toLowerCase()}` : ''
  const noticed = energy === 'Very low' || energy === 'Low'
    ? ' I have noted your energy is low today — that matters more once I can see it against the rest of your cycle.'
    : ''
  return (lead + extra + noticed).trim()
}

export default function FirstLog({ onDone }) {
  const [saving, setSaving] = useState(false)
  const [insight, setInsight] = useState(null)
  const [err, setErr] = useState(null)

  async function pick(energy) {
    setSaving(true); setErr(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { onDone(); return }
      const { error } = await supabase.from('daily_logs').upsert(
        { user_id: user.id, log_date: localDateStr(), energy },
        { onConflict: 'user_id,log_date' })
      if (error) throw error
      track('first_log_saved', { energy })
      const status = await getTodayStatus(supabase, user.id).catch(() => null)
      setInsight(firstInsight(status, energy) || 'That is your first data point. Every one after this sharpens the picture.')
    } catch (e) {
      // Never trap her in onboarding over this. Say so plainly and let her move on.
      console.error(e)
      setErr("Could not save that just now — you can log it any time from the dashboard.")
    } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: 'calc(24px + var(--sat)) 16px 120px', minHeight: '100svh' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 8 }}>Em~power</div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b0a89a', textAlign: 'center', marginBottom: 20 }}>
        Last step · one tap
      </div>

      {!insight ? (
        <>
          <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
            How is your energy today?
          </div>
          <div style={{ fontSize: 13.5, color: '#5a5248', lineHeight: 1.65, textAlign: 'center', marginBottom: 24 }}>
            This is your first check-in. One tap and I can tell you something real about today.
          </div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
            {ENERGY_OPTS.map(o => (
              <button key={o} onClick={() => pick(o)} disabled={saving}
                style={{ padding: '15px', borderRadius: 12, border: '1px solid #ede8e0', background: '#fff', color: '#2c2820', fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                {o}
              </button>
            ))}
          </div>
          {err && <div style={{ fontSize: 13, color: '#a83a20', textAlign: 'center', marginBottom: 14, lineHeight: 1.5 }}>{err}</div>}
          <div style={{ textAlign: 'center' }}>
            <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 13, color: '#9a9590', cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip for now
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 34, textAlign: 'center', marginBottom: 10 }}>🌿</div>
          <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 20, textAlign: 'center', marginBottom: 14 }}>
            That is day one.
          </div>
          <div style={{ background: '#faf6ef', border: '1px solid #e6ddd0', borderRadius: 16, padding: 18, marginBottom: 22 }}>
            <div style={{ fontSize: 14.5, color: '#3a352c', lineHeight: 1.7 }}>{insight}</div>
          </div>
          <button className="btn-primary" onClick={onDone}>Go to my dashboard</button>
        </>
      )}
    </div>
  )
}
