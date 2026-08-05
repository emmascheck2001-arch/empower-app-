import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'

// Mark the native (iOS/Android) app so safe-area insets apply there ONLY — the web/PWA stays
// exactly as it was. Everything safe-area-related keys off this class via var(--sat).
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('cap-native')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
