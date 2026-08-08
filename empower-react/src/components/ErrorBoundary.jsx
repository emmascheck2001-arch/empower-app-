import { Component } from 'react'

// App-wide error boundary. A render error in any screen would otherwise white-screen the whole
// app; this catches it, shows a calm recovery card, and lets the user reload. Error boundaries
// must be class components (there is no hook equivalent for componentDidCatch).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log for diagnostics; never surface raw error detail to the user.
    console.error('Unhandled UI error:', error, info?.componentStack)
  }

  handleReload = () => {
    // Clear the error and hard-reload so a corrupted route re-mounts from scratch.
    this.setState({ hasError: false })
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px', color: '#7a7268' }}>
        <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 22, color: '#2c2820', marginBottom: 10 }}>Something went wrong</div>
        <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20, maxWidth: 320 }}>
          The app hit an unexpected error. Your data is safe. Reload to get back to where you were.
        </div>
        <button onClick={this.handleReload} style={{ background: '#2c2820', color: '#f5f0e8', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          Reload
        </button>
      </div>
    )
  }
}
