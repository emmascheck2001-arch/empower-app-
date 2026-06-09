import { useNavigate } from 'react-router-dom'

export default function TopBar({ title, subtitle, subtitleColor, backTo, children }) {
  const navigate = useNavigate()
  return (
    <div style={{
      background: '#f5f0e8', padding: '16px 20px',
      borderBottom: '1px solid #ede8e0',
      display: 'flex', alignItems: 'center', gap: 12,
      position: 'sticky', top: 0, zIndex: 10
    }}>
      {backTo !== false && (
        <button onClick={() => backTo ? navigate(backTo) : navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#2c2820', fontSize: 20, padding: 0, display: 'flex'
        }}>
          <i className="ti ti-arrow-left" />
        </button>
      )}
      <div style={{ flex: 1 }}>
        {title && <div style={{
          fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase'
        }}>{title}</div>}
        {subtitle && <div style={{ fontSize: 11, color: subtitleColor || '#9a9590', marginTop: 2 }}>{subtitle}</div>}
        {children}
      </div>
    </div>
  )
}
