import './NavigationHUD.css'

// ORS maneuver type integers (same mapping as DirectionsList)
const ARROW = 'M12 4 L17 12 H14 V20 H10 V12 H7 Z'
const ROTATION = { 0: -90, 1: 90, 2: -135, 3: 135, 4: -45, 5: 45, 6: 0, 9: 180, 12: -30, 13: 30 }

function NavIcon({ type }) {
  const cls = `nav-icon nav-icon--${type === 11 ? 'depart' : type === 10 ? 'arrive' : 'turn'}`

  if (type === 7 || type === 8) {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 12 A8 8 0 1 1 12 4" />
        <polyline points="12,4 16,4 16,8" />
      </svg>
    )
  }
  if (type === 10) {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    )
  }
  if (type === 11) {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" opacity="0.22" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    )
  }
  const deg = ROTATION[type] ?? 0
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d={ARROW} transform={`rotate(${deg} 12 12)`} />
    </svg>
  )
}

function MuteIcon({ muted }) {
  return muted ? (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97V10.5l2.45 2.45c.03-.31.05-.63.05-.95zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A9.94 9.94 0 0 0 21 12c0-5.52-4-10.09-9.26-10.88v2.06C15.51 3.99 19 7.6 19 12zm-8.61-8L7 7.41V7c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h3l3.39 3.39c.63.63 1.61.18 1.61-.7V4c0-.88-1.01-1.32-1.61-.7zM4.27 3L3 4.27 7.73 9H6c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.39 3.39c.63.63 1.61.18 1.61-.7v-4.73l4.73 4.73c-.74.56-1.56.98-2.46 1.22v2.06c1.38-.31 2.63-.95 3.69-1.81L20.73 21 22 19.73 4.27 3z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  )
}

function formatDist(m) {
  if (m == null || m <= 0) return null
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m)} m`
}

function formatEta(sec) {
  if (!sec || sec < 60) return '< 1 min'
  const mins = Math.round(sec / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h} h ${m} min` : `${h} h`
}

export default function NavigationHUD({ steps, stepIdx, navComputed, muted, onMuteToggle, onEnd }) {
  if (!steps?.length) return null

  const step = steps[stepIdx] ?? steps[steps.length - 1]
  const arrived = step.type === 10
  const distToNext = navComputed?.distToNext ?? null
  const remainingDist = navComputed?.remainingDist ?? null
  const etaSec = navComputed?.etaSec ?? null
  const offRoute = navComputed?.offRoute ?? false

  return (
    <div className="nav-hud" role="region" aria-label="Navigation">
      {/* Instruction card — stays at top, readable at a glance */}
      <div className="nav-hud__step">
        <NavIcon type={step.type} />
        <div className="nav-hud__step-text">
          <span className="nav-hud__instruction">
            {arrived ? 'You have arrived!' : step.instruction}
          </span>
          {!arrived && distToNext != null && (
            <span className="nav-hud__dist-next">in {formatDist(distToNext)}</span>
          )}
        </div>
      </div>

      {/* Off-route banner */}
      {offRoute && (
        <div className="nav-hud__off-route" role="alert">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          Off route — return to the highlighted path
        </div>
      )}

      {/* Bottom action bar — in thumb zone */}
      <div className="nav-hud__bar">
        <div className="nav-hud__bar-stats">
          {!arrived && remainingDist != null && (
            <>
              <span className="nav-hud__remaining">{formatDist(remainingDist)}</span>
              {etaSec != null && (
                <span className="nav-hud__eta">{formatEta(etaSec)}</span>
              )}
            </>
          )}
        </div>
        <div className="nav-hud__bar-actions">
          <button
            className={`nav-hud__mute${muted ? ' nav-hud__mute--active' : ''}`}
            onClick={onMuteToggle}
            aria-label={muted ? 'Unmute voice guidance' : 'Mute voice guidance'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <MuteIcon muted={muted} />
          </button>
          <button className="nav-hud__end" onClick={onEnd} aria-label="End navigation">
            End
          </button>
        </div>
      </div>
    </div>
  )
}
