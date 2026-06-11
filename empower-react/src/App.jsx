import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Spinner from './components/Spinner'

import Login    from './pages/Login'
import Setup    from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Log      from './pages/Log'
import Checkin  from './pages/Checkin'
import Workout  from './pages/Workout'
import Nutrition from './pages/Nutrition'
import Calendar from './pages/Calendar'
import Feedback from './pages/Feedback'
import Privacy  from './pages/Privacy'
import Learn    from './pages/Learn'
import Sleep    from './pages/Sleep'
import Friends  from './pages/Friends'

// Lightweight "active today" tracking. Stamps profiles.last_active_at at most once
// per 30 minutes per app session, fire-and-forget so it never blocks rendering or
// errors visibly. Lets us measure real daily active users (returning sessions don't
// refresh auth.last_sign_in_at, so that alone undercounts activity).
let lastActiveStamp = 0
function stampActive(uid) {
  const now = Date.now()
  if (now - lastActiveStamp < 30 * 60 * 1000) return
  lastActiveStamp = now
  supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', uid).then(() => {}, () => {})
}

function PrivacyGate({ userId, onAgreed }) {
  const [checked, setChecked] = useState(false)

  function agree() {
    if (!checked) return
    localStorage.setItem(`ep_privacy_${userId}`, '1')
    onAgreed()
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 20px', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 32 }}>Em~power</div>

      <div style={{ background: '#fff', border: '1px solid #ede8e0', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 18, marginBottom: 10 }}>Before you continue</div>
        <p style={{ fontSize: 13, color: '#3a3530', lineHeight: 1.7, marginBottom: 0 }}>
          Em~power collects health data you enter — cycle data, symptoms, biometrics, and workout logs. This data is used only to personalise your experience inside the app. It is never sold, never shared, and never used for advertising.
        </p>
      </div>

      <div style={{ background: '#f5f0e8', borderRadius: 12, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9590', marginBottom: 8 }}>Your rights</div>
        {['Your data is stored securely on Supabase (AWS infrastructure) with row-level security.', 'Only you can see your data.', 'You can request access, correction, or deletion at any time by emailing emmascheck2001@gmail.com.', 'Em~power is a wellness app, not a medical device. Nothing here is medical advice.'].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
            <i className="ti ti-circle-check" style={{ color: '#c8b89a', fontSize: 15, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#3a3530', lineHeight: 1.6 }}>{item}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, background: '#fff', border: '1px solid #ede8e0', borderRadius: 12, marginBottom: 20 }}>
        <input type="checkbox" id="privacyCheck" checked={checked} onChange={e => setChecked(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 2, accentColor: '#2c2820', flexShrink: 0, cursor: 'pointer' }} />
        <label htmlFor="privacyCheck" style={{ fontSize: 13, color: '#3a3530', lineHeight: 1.6, cursor: 'pointer' }}>
          I have read and agree to the{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#c8b89a', textDecoration: 'underline' }}>Privacy Policy</a>.
          I understand Em~power is a wellness app and not a substitute for medical advice.
        </label>
      </div>

      <button
        onClick={agree}
        disabled={!checked}
        style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: checked ? '#2c2820' : '#c8c0b8', color: '#f5f0e8', fontSize: 15, fontWeight: 500, cursor: checked ? 'pointer' : 'default', fontFamily: 'inherit' }}>
        {checked ? 'I agree — continue' : 'Check the box above to continue'}
      </button>
    </div>
  )
}

// requireOnboarded: when true (default), a signed-in user whose profile is not
// onboarding_complete is sent to /setup. The /setup route itself passes false so
// the user can actually complete onboarding. This prevents the logged-in-but-pathless
// state where a user could reach /log etc. without ever choosing a path.
function AuthGuard({ children, requireOnboarded = true }) {
  const [state, setState] = useState('loading') // loading | authed | unauthed | needs-privacy | needs-setup
  const [userId, setUserId] = useState(null)

  async function resolve(session) {
    if (!session) { setState('unauthed'); return }
    const uid = session.user.id
    setUserId(uid)
    // Onboarded users already agreed to the privacy policy during setup, so never
    // re-prompt them — and don't rely on localStorage for this, since some browsers
    // clear it between sessions (which made the privacy gate reappear every login).
    const { data: prof } = await supabase.from('profiles').select('onboarding_complete').eq('id', uid).maybeSingle()
    if (prof) stampActive(uid)
    const onboarded = !!prof?.onboarding_complete
    if (onboarded) {
      localStorage.setItem(`ep_privacy_${uid}`, '1')
      setState('authed'); return
    }
    // New user: show the privacy gate once, then route them into setup.
    if (!localStorage.getItem(`ep_privacy_${uid}`)) { setState('needs-privacy'); return }
    if (requireOnboarded) { setState('needs-setup'); return }
    setState('authed')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => resolve(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) setState('unauthed')
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function reResolve() {
    setState('loading')
    supabase.auth.getSession().then(({ data: { session } }) => resolve(session))
  }

  if (state === 'loading') return <div style={{ paddingTop: 60 }}><Spinner /></div>
  if (state === 'unauthed') return <Navigate to="/login" replace />
  if (state === 'needs-privacy') return <PrivacyGate userId={userId} onAgreed={reResolve} />
  if (state === 'needs-setup') return <Navigate to="/setup" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"   element={<Login />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/setup"     element={<AuthGuard requireOnboarded={false}><Setup /></AuthGuard>} />
        <Route path="/log"       element={<AuthGuard><Log /></AuthGuard>} />
        <Route path="/checkin"   element={<AuthGuard><Checkin /></AuthGuard>} />
        <Route path="/workout"   element={<AuthGuard><Workout /></AuthGuard>} />
        <Route path="/nutrition" element={<AuthGuard><Nutrition /></AuthGuard>} />
        <Route path="/calendar"  element={<AuthGuard><Calendar /></AuthGuard>} />
        <Route path="/feedback"  element={<AuthGuard><Feedback /></AuthGuard>} />
        <Route path="/learn"     element={<AuthGuard><Learn /></AuthGuard>} />
        <Route path="/sleep"     element={<AuthGuard><Sleep /></AuthGuard>} />
        <Route path="/friends"   element={<AuthGuard><Friends /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
