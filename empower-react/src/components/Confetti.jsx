import { useEffect, useState } from 'react'

// Lightweight, dependency-free confetti burst for the weekly-review moment. Renders a set of
// falling coloured pieces for a couple of seconds, then removes itself. Non-interactive.
const COLORS = ['#e09898', '#88c088', '#88c0e0', '#e0c070', '#c8b89a', '#d0a040', '#c88878']

export default function Confetti({ count = 46, duration = 2800 }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 400,
      dur: 1900 + Math.random() * 1400,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 5,
      rot: Math.random() * 360,
    }))
  )
  const [gone, setGone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGone(true), duration)
    return () => clearTimeout(t)
  }, [duration])
  if (gone) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: '-20px',
          left: `${p.left}%`,
          width: `${p.size}px`,
          height: `${p.size * 1.6}px`,
          background: p.color,
          borderRadius: '2px',
          transform: `rotate(${p.rot}deg)`,
          animation: `confettiFall ${p.dur}ms ${p.delay}ms cubic-bezier(0.3,0.6,0.4,1) forwards`,
        }} />
      ))}
    </div>
  )
}
