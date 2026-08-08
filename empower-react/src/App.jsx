import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { supabase } from './lib/supabase'
import { track } from './lib/analytics'
import { sessionFlags } from './lib/session'
import { getTodayStatus } from './lib/hormoneSync'
import { syncPlanToWatch } from './lib/watchBridge'
import Spinner from './components/Spinner'
import ErrorBoundary from './components/ErrorBoundary'

// Routes are lazy-loaded so each screen ships as its own chunk instead of one ~1MB bundle. The
// large content screens (Workout, Nutrition, Learn) only download when first visited. Login and
// Dashboard are the common entry points but are lazy too; Suspense shows the spinner during the
// (usually cached, same-origin) chunk fetch.
const Login    = lazy(() => import('./pages/Login'))
const Setup    = lazy(() => import('./pages/Setup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Log      = lazy(() => import('./pages/Log'))
const Workout  = lazy(() => import('./pages/Workout'))
const Nutrition = lazy(() => import('./pages/Nutrition'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Feedback = lazy(() => import('./pages/Feedback'))
const Privacy  = lazy(() => import('./pages/Privacy'))
const Learn    = lazy(() => import('./pages/Learn'))
const Sleep    = lazy(() => import('./pages/Sleep'))
const Friends  = lazy(() => import('./pages/Friends'))
const Ask      = lazy(() => import('./pages/Ask'))
const Terms    = lazy(() => import('./pages/Terms'))
const VisitPrep = lazy(() => import('./pages/VisitPrep'))

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
  const resolveVersion = useRef(0)

  async function resolve(session) {
    const version = ++resolveVersion.current
    if (!session) { setState('unauthed'); return }
    const uid = session.user.id
    const stillCurrent = async () => {
      if (version !== resolveVersion.current) return false
      const { data: { session: current } } = await supabase.auth.getSession()
      return version === resolveVersion.current && current?.user?.id === uid
    }
    let prof
    try {
      const { data, error } = await supabase.from('profiles').select('onboarding_complete').eq('id', uid).maybeSingle()
      if (error) throw error
      prof = data
    } catch {
      // Network/DB hiccup, never strand the user on the spinner. Let them through;
      // the destination page runs its own load and has its own error/retry handling.
      if (await stillCurrent()) setState('authed')
      return
    }
    if (!await stillCurrent()) return
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
      if (event === 'SIGNED_OUT' || !session) { resolveVersion.current++; setState('unauthed'); return }
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

function NativeAuthLinkHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    let handle
    CapApp.addListener('appUrlOpen', async ({ url }) => {
      try {
        const parsed = new URL(url)
        const params = new URLSearchParams(parsed.search)
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
        const code = params.get('code')
        const type = params.get('type') || hash.get('type')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (hash.get('access_token') && hash.get('refresh_token')) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get('access_token'),
            refresh_token: hash.get('refresh_token'),
          })
          if (error) throw error
        }
        if (type === 'recovery') sessionStorage.setItem('empowerRecovery', '1')
        navigate(type === 'recovery' ? '/login' : '/dashboard', { replace:true })
      } catch (e) { console.error('Could not complete authentication link', e) }
    }).then(h => { handle = h })
    return () => { handle?.remove?.() }
  }, [navigate])
  return null
}

// Records a pageview on every route change so we can see the activation funnel
// (login -> setup -> dashboard -> log) and where people drop off.
function PageTracker() {
  const loc = useLocation()
  useEffect(() => { track('pageview', { path: loc.pathname }) }, [loc.pathname])
  return null
}

// Re-push today's readiness-led plan to the paired Apple Watch every time the app returns to the
// foreground, so the watch stays current without needing a full reopen. iOS-only in effect:
// syncPlanToWatch no-ops on web/Android and when no watch is paired.
function WatchResumeSync() {
  useEffect(() => {
    let handle
    CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const status = await getTodayStatus(supabase, user.id)
        if (status) syncPlanToWatch(status)
      } catch { /* a missing watch / offline read is harmless — never surface it */ }
    }).then(h => { handle = h })
    return () => { handle?.remove?.() }
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <PageTracker />
      <NativeAuthLinkHandler />
      <WatchResumeSync />
      <ErrorBoundary>
      <Suspense fallback={<div style={{ paddingTop: 60 }}><Spinner /></div>}>
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
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
