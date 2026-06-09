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

function AuthGuard({ children }) {
  const [state, setState] = useState('loading') // loading | authed | unauthed

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(session ? 'authed' : 'unauthed')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setState(session ? 'authed' : 'unauthed')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (state === 'loading') return <div style={{ paddingTop: 60 }}><Spinner /></div>
  if (state === 'unauthed') return <Navigate to="/login" replace />
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
        <Route path="/setup"     element={<AuthGuard><Setup /></AuthGuard>} />
        <Route path="/log"       element={<AuthGuard><Log /></AuthGuard>} />
        <Route path="/checkin"   element={<AuthGuard><Checkin /></AuthGuard>} />
        <Route path="/workout"   element={<AuthGuard><Workout /></AuthGuard>} />
        <Route path="/nutrition" element={<AuthGuard><Nutrition /></AuthGuard>} />
        <Route path="/calendar"  element={<AuthGuard><Calendar /></AuthGuard>} />
        <Route path="/feedback"  element={<AuthGuard><Feedback /></AuthGuard>} />
        <Route path="/learn"     element={<AuthGuard><Learn /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
