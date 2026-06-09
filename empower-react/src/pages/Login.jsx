import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [mode, setMode] = useState('login') // login | newpassword
  const [showReset, setShowReset] = useState(false)
  const [msg, setMsg] = useState(null) // { text, type: 'success'|'error' }
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const hash = window.location.hash
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { setMode('newpassword'); return }
      }
      if (hash.includes('type=recovery')) { setMode('newpassword'); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (session) navigate('/dashboard', { replace: true })
    }
    init()
  }, [navigate])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) { setMsg({ text: 'Please enter your email and password.', type: 'error' }); return }
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMsg({ text: error.message === 'Invalid login credentials' ? 'Email or password is incorrect. Please try again.' : error.message, type: 'error' })
      setLoading(false)
    } else {
      setMsg({ text: 'Signed in! Taking you to your dashboard...', type: 'success' })
      setTimeout(() => navigate('/dashboard', { replace: true }), 800)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!resetEmail) { setMsg({ text: 'Please enter your email.', type: 'error' }); return }
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://empowerhealth.netlify.app/login'
    })
    setLoading(false)
    setMsg(error ? { text: error.message, type: 'error' } : { text: 'Check your email for a reset link.', type: 'success' })
  }

  async function handleNewPassword(e) {
    e.preventDefault()
    if (newPassword.length < 6) { setMsg({ text: 'Password must be at least 6 characters.', type: 'error' }); return }
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) { setMsg({ text: error.message, type: 'error' }) }
    else {
      setMsg({ text: 'Password updated! Taking you to your dashboard...', type: 'success' })
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200)
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid #ede8e0', background: '#fff',
    fontSize: 15, color: '#2c2820', outline: 'none', fontFamily: 'inherit'
  }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#5a5550', marginBottom: 6 }
  const fieldStyle = { marginBottom: 14 }

  return (
    <div style={{ padding: '20px 20px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100svh' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 32 }}>Em~power</div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, fontStyle: 'italic', textAlign: 'center', marginBottom: 8 }}>Welcome.</h1>
      <p style={{ fontSize: 13, color: '#7a7268', textAlign: 'center', marginBottom: 32, lineHeight: 1.6 }}>Sign in to start tracking.</p>

      {mode === 'newpassword' ? (
        <form onSubmit={handleNewPassword}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Set a new password</div>
          <div style={{ fontSize: 13, color: '#7a7268', marginBottom: 16 }}>Choose something you will remember.</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>New password</label>
            <input style={inputStyle} type="password" placeholder="At least 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={loading} style={{ marginTop: 8 }}>{loading ? 'Updating...' : 'Update password'}</button>
        </form>
      ) : (
        <form onSubmit={handleLogin}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Password</label>
            <input style={inputStyle} type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={loading} style={{ marginTop: 8 }}>{loading ? 'Signing in...' : 'Sign in'}</button>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" onClick={() => setShowReset(v => !v)} style={{ background: 'none', border: 'none', fontSize: 14, color: '#c8b89a', textDecoration: 'underline', fontWeight: 500, cursor: 'pointer' }}>
              Forgot your password?
            </button>
          </div>
          {showReset && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #ede8e0' }}>
              <div style={{ fontSize: 13, color: '#5a5550', marginBottom: 12, lineHeight: 1.5 }}>Enter your email and we will send you a reset link.</div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" placeholder="your@email.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
              </div>
              <button type="button" onClick={handleReset} className="btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
            </div>
          )}
        </form>
      )}

      {msg && (
        <div style={{
          fontSize: 13, textAlign: 'center', marginTop: 14, lineHeight: 1.5,
          padding: '10px 14px', borderRadius: 8,
          background: msg.type === 'success' ? '#eef5ee' : '#fce8e8',
          color: msg.type === 'success' ? '#2a5a2a' : '#8a2a2a'
        }}>{msg.text}</div>
      )}
    </div>
  )
}
