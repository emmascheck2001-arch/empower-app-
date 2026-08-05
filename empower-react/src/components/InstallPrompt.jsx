import { useState, useEffect } from 'react'

// Prompts the user to install the PWA. An installed (home-screen) app gets far better return
// visits than a browser tab, the single cheapest retention lever, and the app previously
// never asked. iOS Safari does not fire `beforeinstallprompt`, so we show manual
// "Add to Home Screen" instructions there instead of an install button.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (isStandalone) return                       // already installed, nothing to do
    if (localStorage.getItem('installDismissed')) return

    const ua = window.navigator.userAgent || ''
    const isIos = /iphone|ipad|ipod/i.test(ua)
    if (isIos) { setIosHint(true); setShow(true); return }

    const handler = (e) => { e.preventDefault(); setDeferred(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  const dismiss = () => { localStorage.setItem('installDismissed', '1'); setShow(false) }
  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch { /* ignore */ }
    setDeferred(null); setShow(false)
  }

  return (
    <div style={{ background:'#2c2820', color:'#f5f0e8', borderRadius:16, padding:'14px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
      <i className="ti ti-device-mobile" style={{ fontSize:24, color:'#e0c88a', flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>Add Em~power to your home screen</div>
        <div style={{ fontSize:12, color:'rgba(245,240,232,0.75)', lineHeight:1.5 }}>
          {iosHint
            ? 'Tap the Share icon below, then "Add to Home Screen", so it opens in one tap and you never lose your place.'
            : 'Install the app so it is one tap away and easy to keep up with each day.'}
        </div>
      </div>
      {!iosHint && (
        <button onClick={install} style={{ background:'#e0c88a', color:'#2c2820', border:'none', borderRadius:10, padding:'8px 14px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>Install</button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" style={{ background:'none', border:'none', color:'rgba(245,240,232,0.6)', cursor:'pointer', fontSize:18, flexShrink:0, padding:0, lineHeight:1 }}><i className="ti ti-x" /></button>
    </div>
  )
}
