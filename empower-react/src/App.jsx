import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { track } from './lib/analytics'
import { sessionFlags } from './lib/session'
import Spinner from './components/Spinner'

import Login    from './pages/Login'
import Setup    from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Log      from './pages/Log'
import Workout  from './pages/Workout'
import Nutrition from './pages/Nutrition'
import Calendar from './pages/Calendar'
import Feedback from './pages/Feedback'
import Privacy  from './pages/Privacy'
import Learn    from './pages/Learn'
import Sleep    from './pages/Sleep'
import Friends  from './pages/Friends'
import Ask      from './pages/Ask'
import Terms    from './pages/Terms'
import VisitPrep from './pages/VisitPrep'

// Lightweight "active today" tracking. Stamps profiles.last_active_at at most once
// per 30 minutes per app session, fire-and-forget so it never blocks rendering or
// errors visibly. Lets us measure real daily active users (returning sessions don't
// refresh auth.last_sign_in_at, so that alone undercounts activity).
// Throttled per-user so switching accounts on the same tab still stamps the new user
// (a single module-level timer would suppress the second user for up to 30 min).
const lastActiveByUser = new Map()
function stampActive(uid) {
  const now = Date.now()
  if (now - (lastActiveByUser.get(uid) || 0) < 30 * 60 * 1000) return
  lastActiveByUser.set(uid, now)
  supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', uid).then(() => {}, () => {})
}

// requireOnboarded: when true (default), a signed-in user whose profile is not
// onboarding_complete is sent to /setup. The /setup route itself passes false so
// the user can actually complete onboarding. This prevents the logged-in-but-pathless
// state where a user could reach /log etc. without ever choosing a path.
function AuthGuard({ children, requireOnboarded = true }) {
  const [state, setState] = useState('loading') // loading | authed | unauthed | needs-setup

  async function resolve(session) {
    if (!session) { setState('unauthed'); return }
    const uid = session.user.id
    let prof = null
    try {
      const { data, error } = await supabase.from('profiles').select('onboarding_complete').eq('id', uid).maybeSingle()
      if (error) throw error
      prof = data
    } catch {
      // Network/DB hiccup, never strand the user on the spinner. Let them through;
      // the destination page runs its own load and has its own error/retry handling.
      setState('authed'); return
    }
    if (prof) stampActive(uid)
    // sessionFlags.justOnboardedUid covers the moment right after setup finishes, so a
    // lagging read-after-write can never bounce a just-onboarded user back into setup.
    // Tied to the uid so a different account signing in on the same tab never inherits it.
    const onboarded = !!prof?.onboarding_complete || sessionFlags.justOnboardedUid === uid
    if (onboarded) { setState('authed'); return }
    // New, un-onboarded user: straight to setup. Privacy consent is collected there
    // (a required checkbox) before they can finish, no separate gate, no loop.
    if (requireOnboarded) { setState('needs-setup'); return }
    setState('authed')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => resolve(session))
    // React to live auth changes: a fresh sign-in (e.g. on another tab, or magic-link
    // return) re-resolves the guard; sign-out drops to /login. TOKEN_REFRESHED and
    // USER_UPDATED are intentionally ignored, the session is unchanged for guard
    // purposes, so we avoid a redundant profiles read and any redirect churn.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) { setState('unauthed'); return }
      if (event === 'SIGNED_IN') resolve(session)
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === 'loading') return <div style={{ paddingTop: 60 }}><Spinner /></div>
  if (state === 'unauthed') return <Navigate to="/login" replace />
  if (state === 'needs-setup') return <Navigate to="/setup" replace />
  return children
}

// Records a pageview on every route change so we can see the activation funnel
// (login -> setup -> dashboard -> log) and where people drop off.
function PageTracker() {
  const loc = useLocation()
  useEffect(() => { track('pageview', { path: loc.pathname }) }, [loc.pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <PageTracker />
      <Routes>
        <Route path="/login"   element={<Login />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms"   element={<Terms />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/setup"     element={<AuthGuard requireOnboarded={false}><Setup /></AuthGuard>} />
        <Route path="/log"       element={<AuthGuard><Log /></AuthGuard>} />
        {/* Check-in and full log are now one merged screen (quick questions + "add more detail") */}
        <Route path="/checkin"   element={<AuthGuard><Log /></AuthGuard>} />
        <Route path="/workout"   element={<AuthGuard><Workout /></AuthGuard>} />
        <Route path="/nutrition" element={<AuthGuard><Nutrition /></AuthGuard>} />
        <Route path="/calendar"  element={<AuthGuard><Calendar /></AuthGuard>} />
        <Route path="/feedback"  element={<AuthGuard><Feedback /></AuthGuard>} />
        <Route path="/learn"     element={<AuthGuard><Learn /></AuthGuard>} />
        <Route path="/sleep"     element={<AuthGuard><Sleep /></AuthGuard>} />
        <Route path="/ask"       element={<AuthGuard><Ask /></AuthGuard>} />
        <Route path="/visit-prep" element={<AuthGuard><VisitPrep /></AuthGuard>} />
        <Route path="/friends"   element={<AuthGuard><Friends /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
