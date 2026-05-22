import { useRef } from 'react'
import ElevationChart from './ElevationChart.jsx'
import DirectionsList from './DirectionsList.jsx'
import './Sidebar.css'

function formatDistance(metres) {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres)} m`
}

function formatDuration(seconds) {
  const totalMin = Math.round(seconds / 60)
  if (totalMin < 1) return '< 1 min'
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function gradeClass(pct) {
  if (pct >= 12) return 'grade--vsteep'
  if (pct >= 8) return 'grade--steep'
  if (pct >= 4) return 'grade--moderate'
  return 'grade--flat'
}

const STEEP_LABELS = {
  driving: { pct: 15, who: 'drivers',  colorName: 'red',    intensityLabel: 'very steep' },
  cycling: { pct: 8,  who: 'cyclists', colorName: 'orange', intensityLabel: 'steep' },
  walking: { pct: 12, who: 'walkers',  colorName: 'red',    intensityLabel: 'very steep' },
}

const GRADE_LEGEND = [
  { cls: 'flat',     label: 'Flat',       range: '0–4%'  },
  { cls: 'moderate', label: 'Moderate',   range: '4–8%'  },
  { cls: 'steep',    label: 'Steep',      range: '8–12%' },
  { cls: 'vsteep',   label: 'Very steep', range: '12%+'  },
]

function StatRow({ label, value, valueClass }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span className={`stat-row__value${valueClass ? ` ${valueClass}` : ''}`}>{value}</span>
    </div>
  )
}

export default function Sidebar({
  open,
  onToggle,
  stats,
  chartData,
  onChartHover,
  routeChoice,
  onChoiceChange,
  hasAlternative,
  sameRouteNote,
  steepWarning,
  mode,
  steps,
  onStartNav,
  onSaveRoute,
  onHandoffOpen,
  loading,
  error,
}) {
  const warnInfo = STEEP_LABELS[mode] ?? STEEP_LABELS.driving
  const touchStartY = useRef(null)

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    if (touchStartY.current === null) return
    const delta = touchStartY.current - e.changedTouches[0].clientY
    touchStartY.current = null
    if (Math.abs(delta) < 40) {
      onToggle()
      return
    }
    if (delta > 0 && !open) onToggle()
    else if (delta < 0 && open) onToggle()
  }

  const hasRoute = !loading && !error && stats

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`} aria-label="Route results">
      <button
        className="sidebar__handle"
        onClick={onToggle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-expanded={open}
        aria-controls="sidebar-body"
      >
        <span className="sidebar__grip" aria-hidden="true" />
        <span className="sidebar__handle-label">Route Results</span>
        <svg
          className="sidebar__chevron"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>

      <div id="sidebar-body" className="sidebar__body" hidden={!open}>
        {/* Non-scrolling top: toggle + notes + warnings + state messages */}
        <div className="sidebar__top">
          {hasRoute && (
            <>
              <div className="route-toggle" role="group" aria-label="Route preference">
                <button
                  className={`route-toggle__btn${routeChoice === 'fastest' ? ' route-toggle__btn--active' : ''}`}
                  onClick={() => onChoiceChange('fastest')}
                  aria-pressed={routeChoice === 'fastest'}
                >
                  Fastest
                </button>
                <button
                  className={`route-toggle__btn${routeChoice === 'flattest' ? ' route-toggle__btn--active' : ''}`}
                  onClick={() => onChoiceChange('flattest')}
                  aria-pressed={routeChoice === 'flattest'}
                  disabled={!hasAlternative}
                >
                  Flattest
                </button>
              </div>

              {sameRouteNote && (
                <p className="sidebar__note">{sameRouteNote}</p>
              )}

              {steepWarning && (
                <div className="sidebar__warning" role="alert">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                  Contains {warnInfo.intensityLabel} ({warnInfo.colorName}) sections above {warnInfo.pct}% — challenging for {warnInfo.who}
                </div>
              )}
            </>
          )}

          {loading && (
            <div className="sidebar__state">
              <span className="sidebar__spinner" aria-hidden="true" />
              Finding route…
            </div>
          )}

          {!loading && error && (
            <div className="sidebar__error" role="alert">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {error}
            </div>
          )}

          {!loading && !error && !stats && (
            <p className="sidebar__empty">Enter an origin and destination to see route results.</p>
          )}
        </div>

        {/* Scrollable middle: stats + chart */}
        {hasRoute && (
          <div className="sidebar__scroll">
            <div className="sidebar__stats">
              <StatRow label="Distance" value={formatDistance(stats.distance)} />
              {stats.duration != null && (
                <StatRow label="Est. time" value={formatDuration(stats.duration)} />
              )}
              <StatRow
                label="Elevation gain"
                value={`↑ ${Math.round(stats.elevationGain)} m`}
              />
              <StatRow
                label="Max grade"
                value={`${stats.maxGrade.toFixed(1)}%`}
                valueClass={gradeClass(stats.maxGrade)}
              />
            </div>
            <div className="grade-legend" aria-label="Route color key">
              {GRADE_LEGEND.map(({ cls, label, range }) => (
                <span key={cls} className="grade-legend__item">
                  <span className={`grade-legend__swatch grade-legend__swatch--${cls}`} aria-hidden="true" />
                  <span className="grade-legend__label">
                    {label}<span className="grade-legend__range"> {range}</span>
                  </span>
                </span>
              ))}
            </div>
            <ElevationChart data={chartData} onHover={onChartHover} />
            <DirectionsList steps={steps} />
          </div>
        )}

        {/* Non-scrolling footer: Go + handoff */}
        {hasRoute && (
          <div className="sidebar__footer">
            <div className="sidebar__footer-row">
              <button
                className="sidebar__go-btn"
                onClick={onStartNav}
              >
                Go
              </button>
              <button
                className="sidebar__save-btn"
                onClick={onSaveRoute}
                aria-label="Save route"
                title="Save route"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                </svg>
              </button>
              <button
                className="sidebar__handoff-btn"
                onClick={onHandoffOpen}
                aria-label="Open in external maps app"
                title="Open in…"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
