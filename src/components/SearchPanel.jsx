import { useState, useEffect, useRef } from 'react'
import { geocodeAutocomplete, reverseGeocode } from '../services/geocoding.js'
import { getCurrentLocation } from '../services/location.js'
import './SearchPanel.css'

// Build the secondary line shown under each suggestion's name.
// Prefers structured fields (street, neighbourhood, locality) over the raw label.
function sublabel({ name, label, street, housenumber, neighbourhood, locality }) {
  const parts = []
  const streetAddr = [housenumber, street].filter(Boolean).join(' ')
  if (streetAddr && street && !name.includes(street)) parts.push(streetAddr)
  if (neighbourhood && neighbourhood !== name) parts.push(neighbourhood)
  if (locality && locality !== name) parts.push(locality)
  if (parts.length > 0) return parts.join(', ')
  if (!label) return ''
  const rest = label.startsWith(name) ? label.slice(name.length).replace(/^,\s*/, '') : label
  return rest.replace(/,\s*(United States of America|United Kingdom|Canada|Australia)$/i, '').trim()
}

function SearchField({ value, onChange, placeholder, pinClass, label, fieldId, isPickTarget, onMapPickRequest }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [locating, setLocating] = useState(false)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  function handleInput(text) {
    onChange({ text, coords: null })
    clearTimeout(timerRef.current)
    if (text.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      setFetching(false)
      return
    }
    setOpen(true)
    setFetching(true)
    timerRef.current = setTimeout(async () => {
      const results = await geocodeAutocomplete(text)
      setSuggestions(results)
      setFetching(false)
    }, 250)
  }

  function handleSelect(feature) {
    const [lon, lat] = feature.geometry.coordinates
    onChange({ text: feature.properties.name, coords: [lon, lat] })
    setSuggestions([])
    setOpen(false)
  }

  function handleClear() {
    onChange({ text: '', coords: null })
    setSuggestions([])
    setOpen(false)
    setFetching(false)
    clearTimeout(timerRef.current)
    inputRef.current?.focus()
  }

  async function handleLocate() {
    setLocating(true)
    try {
      const { lat, lon } = await getCurrentLocation()
      const name = await reverseGeocode(lon, lat)
      onChange({ text: name, coords: [lon, lat] })
      setOpen(false)
    } catch {
      // fail silently — user can type instead
    } finally {
      setLocating(false)
    }
  }

  useEffect(() => {
    function onPointerDown(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const isEmpty = !value.text
  const showDropdown = open && value.text.trim().length >= 2
  const showNoResults = showDropdown && !fetching && suggestions.length === 0

  return (
    <div ref={wrapperRef} className="sf-wrap">
      <div className={[
        'search-field',
        value.coords ? 'search-field--done' : '',
        isPickTarget ? 'search-field--picking' : '',
      ].filter(Boolean).join(' ')}>

        {/* Left side: GPS button when empty, colored pin when something is entered */}
        {isEmpty ? (
          <button
            className={`search-field__locate${locating ? ' search-field__locate--spin' : ''}`}
            onClick={handleLocate}
            disabled={locating}
            aria-label={`Use current location for ${label}`}
            title="Use my current location"
          >
            {locating
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /><circle cx="12" cy="12" r="10" strokeOpacity="0.2" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>
            }
          </button>
        ) : (
          <span className={`search-field__pin ${pinClass}`} aria-hidden="true" />
        )}

        <input
          ref={inputRef}
          type="search"
          className="search-field__input"
          placeholder={placeholder}
          value={value.text}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={showDropdown || showNoResults}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Map-pick toggle */}
        <button
          className={`search-field__mappick${isPickTarget ? ' search-field__mappick--active' : ''}`}
          onClick={() => onMapPickRequest(isPickTarget ? null : fieldId)}
          aria-label={`Tap on map to set ${label}`}
          title="Tap on map"
          aria-pressed={isPickTarget}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </button>

        {!isEmpty && (
          <button className="search-field__clear" onClick={handleClear} aria-label={`Clear ${label}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>

      {(showDropdown || showNoResults) && (
        <ul className="suggestions" role="listbox" aria-label={`${label} suggestions`}>
          {fetching && suggestions.length === 0 && (
            <li className="suggestions__status" role="presentation">Searching…</li>
          )}
          {suggestions.map((f) => (
            <li
              key={f.properties.gid}
              role="option"
              className="suggestions__item"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(f) }}
              onTouchEnd={(e) => { e.preventDefault(); handleSelect(f) }}
            >
              <span className="suggestions__name">{f.properties.name}</span>
              <span className="suggestions__sub">{sublabel(f.properties)}</span>
            </li>
          ))}
          {showNoResults && (
            <li className="suggestions__status suggestions__status--empty" role="presentation">
              No results found
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

const MODES = [
  {
    value: 'driving',
    label: 'Driving',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-5h14v5z" />
        <circle cx="7.5" cy="14.5" r="1.5" />
        <circle cx="16.5" cy="14.5" r="1.5" />
      </svg>
    ),
  },
  {
    value: 'cycling',
    label: 'Cycling',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5S3.1 13.5 5 13.5s3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4C7.3 8.8 7 9.4 7 10c0 .6.3 1.2.8 1.6l3.2 3V19h2v-5l-2.2-3.5zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z" />
      </svg>
    ),
  },
  {
    value: 'walking',
    label: 'Walking',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
      </svg>
    ),
  },
]

export default function SearchPanel({
  origin,
  setOrigin,
  destination,
  setDestination,
  waypoints,
  onAddWaypoint,
  onRemoveWaypoint,
  onChangeWaypoint,
  onMoveWaypoint,
  mode,
  setMode,
  loading,
  mapPickTarget,
  onMapPickRequest,
  onOpenSaved,
}) {
  const hasStops = waypoints.length > 0

  function handleSwap() {
    setOrigin(destination)
    setDestination(origin)
  }

  const panelClass = [
    'search-panel',
    loading ? 'search-panel--loading' : '',
    hasStops ? 'search-panel--has-stops' : '',
  ].filter(Boolean).join(' ')

  return (
    <header className={panelClass}>
      <div className="search-panel__inputs">
        <SearchField
          value={origin}
          onChange={setOrigin}
          placeholder="From…"
          pinClass="search-field__pin--origin"
          label="Origin"
          fieldId="origin"
          isPickTarget={mapPickTarget === 'origin'}
          onMapPickRequest={onMapPickRequest}
        />

        {!hasStops && (
          <div className="search-panel__swap-row">
            <button
              className="swap-btn"
              onClick={handleSwap}
              aria-label="Swap origin and destination"
              title="Swap"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" />
              </svg>
            </button>
          </div>
        )}

        {waypoints.map((wp, i) => (
          <div key={i} className="waypoint-row">
            <div className="waypoint-row__order">
              {waypoints.length > 1 && (
                <>
                  <button
                    className="waypoint-row__move"
                    onClick={() => onMoveWaypoint(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move stop ${i + 1} up`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="14" height="14">
                      <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                    </svg>
                  </button>
                  <button
                    className="waypoint-row__move"
                    onClick={() => onMoveWaypoint(i, 1)}
                    disabled={i === waypoints.length - 1}
                    aria-label={`Move stop ${i + 1} down`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="14" height="14">
                      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <div className="waypoint-row__field">
              <SearchField
                value={wp}
                onChange={(place) => onChangeWaypoint(i, place)}
                placeholder={`Stop ${i + 1}…`}
                pinClass="search-field__pin--waypoint"
                label={`Stop ${i + 1}`}
                fieldId={`waypoint-${i}`}
                isPickTarget={mapPickTarget === `waypoint-${i}`}
                onMapPickRequest={onMapPickRequest}
              />
            </div>
            <button
              className="waypoint-row__remove"
              onClick={() => onRemoveWaypoint(i)}
              aria-label={`Remove stop ${i + 1}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        ))}

        <SearchField
          value={destination}
          onChange={setDestination}
          placeholder="To…"
          pinClass="search-field__pin--dest"
          label="Destination"
          fieldId="destination"
          isPickTarget={mapPickTarget === 'destination'}
          onMapPickRequest={onMapPickRequest}
        />

        <button className="add-stop-btn" onClick={onAddWaypoint} aria-label="Add a stop">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Add stop
        </button>
      </div>
      <div className="mode-selector" role="group" aria-label="Travel mode">
        {MODES.map(({ value, label, icon }) => (
          <button
            key={value}
            className={`mode-btn${mode === value ? ' mode-btn--active' : ''}`}
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            title={label}
          >
            <span className="mode-btn__icon">{icon}</span>
            <span className="mode-btn__label">{label}</span>
          </button>
        ))}
        <button
          className="mode-saved-btn"
          onClick={onOpenSaved}
          aria-label="Saved routes"
          title="Saved routes"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
