import { useEffect } from 'react'
import { buildGoogleMapsUrl, buildAppleMapsUrl, buildWazeUrl } from '../utils/mapHandoff.js'
import './HandoffMenu.css'

function AppButton({ href, bgColor, letter, label, note }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="handoff-app"
    >
      <span className="handoff-app__icon" style={{ background: bgColor }}>
        {letter}
      </span>
      <span className="handoff-app__text">
        <span className="handoff-app__label">{label}</span>
        <span className="handoff-app__note">{note}</span>
      </span>
      <svg
        className="handoff-app__arrow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
      </svg>
    </a>
  )
}

export default function HandoffMenu({ origin, destination, userWaypoints, mode, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const hasStops = userWaypoints.length > 0
  const stopCount = userWaypoints.length
  const stopLabel = stopCount === 1 ? '1 stop' : `${stopCount} stops`

  return (
    <div
      className="handoff-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Open route in external maps app"
    >
      <div
        className="handoff-overlay__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="handoff-menu">
        <div className="handoff-menu__header">
          <h2 className="handoff-menu__title">Open in…</h2>
          <button
            className="handoff-menu__close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="handoff-menu__note">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>
            External apps will re-plan with their own router and may choose a hillier path.
            For the exact flat route, use <strong>Go</strong>.
          </span>
        </div>

        <div className="handoff-menu__apps">
          <AppButton
            href={buildGoogleMapsUrl(origin, destination, userWaypoints, mode)}
            bgColor="#4285F4"
            letter="G"
            label="Google Maps"
            note={
              hasStops
                ? `With your ${stopLabel} — may still choose a hillier path`
                : 'Origin + destination only — may choose a hillier path'
            }
          />
          <AppButton
            href={buildAppleMapsUrl(origin, destination, mode)}
            bgColor="#007AFF"
            letter="A"
            label="Apple Maps"
            note="Origin + destination only — may choose a hillier path"
          />
          <AppButton
            href={buildWazeUrl(destination)}
            bgColor="#09BDDE"
            letter="W"
            label="Waze"
            note="Destination only — may choose a hillier path"
          />
        </div>
      </div>
    </div>
  )
}
