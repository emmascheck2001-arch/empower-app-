import { useLocation, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Home',      icon: 'ti-home',     path: '/dashboard' },
  { label: 'Workout',   icon: 'ti-barbell',  path: '/workout' },
  { label: 'Log',       icon: 'ti-pencil',   path: '/log' },
  { label: 'Nutrition', icon: 'ti-salad',    path: '/nutrition' },
  { label: 'Learn',     icon: 'ti-book-2',   path: '/learn' },
]

const DASHBOARD_NAV = [
  { label: 'Home',      icon: 'ti-home',     path: '/dashboard' },
  { label: 'Workout',   icon: 'ti-barbell',  path: '/workout' },
  { label: 'Calendar',  icon: 'ti-calendar', path: '/calendar' },
  { label: 'Log',       icon: 'ti-pencil',   path: '/log' },
  { label: 'Nutrition', icon: 'ti-salad',    path: '/nutrition' },
  { label: 'Learn',     icon: 'ti-book-2',   path: '/learn' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/calendar'
  const items = isDashboard ? DASHBOARD_NAV : NAV_ITEMS

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#f5f0e8', borderTop: '1px solid #ede8e0',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
      zIndex: 100, maxWidth: 420, margin: '0 auto'
    }}>
      {items.map(item => {
        const active = location.pathname === item.path
        return (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, background: 'none', border: 'none', cursor: 'pointer',
            color: active ? '#2c2820' : '#9a9590', padding: '4px 8px'
          }}>
            <i className={`ti ${item.icon}`} style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
