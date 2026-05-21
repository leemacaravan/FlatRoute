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

export default function HandoffMenu({ coords, mode, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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
            External apps may recalculate onto a hillier route. Google Maps receives
            waypoints to stay close to our flat path — Apple Maps and Waze don't
            support them, so they may diverge. For the exact route, use{' '}
            <strong>Go</strong>.
          </span>
        </div>

        <div className="handoff-menu__apps">
          <AppButton
            href={buildGoogleMapsUrl(coords, mode)}
            bgColor="#4285F4"
            letter="G"
            label="Google Maps"
            note="With up to 5 waypoints to preserve your flat route"
          />
          <AppButton
            href={buildAppleMapsUrl(coords, mode)}
            bgColor="#007AFF"
            letter="A"
            label="Apple Maps"
            note="Origin + destination only — may choose a hillier path"
          />
          <AppButton
            href={buildWazeUrl(coords)}
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
