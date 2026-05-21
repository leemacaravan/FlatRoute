import './DirectionsList.css'

// ORS maneuver type integers
// 0=left, 1=right, 2=sharp-left, 3=sharp-right, 4=slight-left, 5=slight-right,
// 6=straight, 7=enter-roundabout, 8=exit-roundabout, 9=uturn, 10=arrive, 11=depart,
// 12=keep-left, 13=keep-right

const ARROW = 'M12 4 L17 12 H14 V20 H10 V12 H7 Z'

// Degrees to rotate the up-pointing arrow for each maneuver type
const ROTATION = {
  0: -90,   // left
  1: 90,    // right
  2: -135,  // sharp left
  3: 135,   // sharp right
  4: -45,   // slight left
  5: 45,    // slight right
  6: 0,     // straight
  9: 180,   // u-turn
  12: -30,  // keep left
  13: 30,   // keep right
}

function ManeuverIcon({ type }) {
  const cls = `dir-icon dir-icon--${type === 11 ? 'depart' : type === 10 ? 'arrive' : 'nav'}`

  if (type === 7 || type === 8) {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

function formatDist(m) {
  if (m <= 0) return ''
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m)} m`
}

export default function DirectionsList({ steps }) {
  if (!steps?.length) return null

  return (
    <div className="directions">
      <h3 className="directions__heading">Directions</h3>
      <ol className="directions__list">
        {steps.map((step, i) => {
          const dist = formatDist(step.distance)
          return (
            <li key={i} className="directions__step">
              <ManeuverIcon type={step.type} />
              <span className="directions__instruction">{step.instruction}</span>
              {dist && <span className="directions__dist">{dist}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
