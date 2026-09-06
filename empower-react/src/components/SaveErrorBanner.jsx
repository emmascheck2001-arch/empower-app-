// Shown at the point of failure when a write did not reach the server.
//
// The rule this component exists to enforce: she must never leave a screen believing
// something saved that did not. Render it next to the control that failed — an error
// she has to scroll to find is an error she will miss.
//
// `error` is { scope, text, retry } or null; `scope` names which control this banner
// belongs to, so a screen with more than one save path shows the message in the right
// place rather than at the bottom of the page.
export default function SaveErrorBanner({ error, scope, busy = false }) {
  if (!error || error.scope !== scope) return null
  return (
    <div role="alert" style={{
      marginBottom: 10, padding: '12px 14px', borderRadius: 12,
      background: '#f9e9e6', border: '1px solid #e8cdc7', color: '#7a3a33',
      fontSize: 13, lineHeight: 1.55, textAlign: 'left',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <i className="ti ti-cloud-off" style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>{error.text}</div>
      </div>
      {error.retry && (
        <button onClick={error.retry} disabled={busy} style={{
          marginTop: 10, width: '100%', padding: '9px', borderRadius: 10,
          border: '1px solid #d9b3ac', background: '#fff', color: '#7a3a33',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Try again
        </button>
      )}
    </div>
  )
}
