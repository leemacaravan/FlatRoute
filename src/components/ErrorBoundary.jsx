import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100dvh', padding: '24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif',
        }}>
          <svg viewBox="0 0 24 24" fill="#dc2626" width="40" height="40" aria-hidden="true">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '16px 0 8px', color: '#1a1a1a' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '10px 24px', borderRadius: '20px', background: '#2563eb',
              color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
