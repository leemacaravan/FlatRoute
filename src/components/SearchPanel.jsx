import { useState, useEffect, useRef } from 'react'
import { geocodeAutocomplete } from '../services/geocoding.js'
import './SearchPanel.css'

// Strip the name from the full label to get just the context portion
function sublabel({ name, label }) {
  if (!label) return ''
  const rest = label.startsWith(name) ? label.slice(name.length).replace(/^,\s*/, '') : label
  return rest
}

function SearchField({ value, onChange, placeholder, pinClass, label }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)

  function handleInput(text) {
    onChange({ text, coords: null })
    clearTimeout(timerRef.current)

    if (text.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    setOpen(true)
    timerRef.current = setTimeout(async () => {
      const results = await geocodeAutocomplete(text)
      setSuggestions(results)
    }, 350)
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
    clearTimeout(timerRef.current)
  }

  // Close dropdown when user taps/clicks outside this field
  useEffect(() => {
    function onPointerDown(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const showDropdown = open && suggestions.length > 0

  return (
    <div ref={wrapperRef} className="sf-wrap">
      <div className={`search-field${value.coords ? ' search-field--done' : ''}`}>
        <span className={`search-field__pin ${pinClass}`} aria-hidden="true" />
        <input
          type="search"
          className="search-field__input"
          placeholder={placeholder}
          value={value.text}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {value.text && (
          <button className="search-field__clear" onClick={handleClear} aria-label={`Clear ${label}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && (
        <ul className="suggestions" role="listbox" aria-label={`${label} suggestions`}>
          {suggestions.map((f) => (
            <li
              key={f.properties.gid}
              role="option"
              className="suggestions__item"
              // mousedown fires before blur; preventDefault keeps the input focused
              // so the click can complete before the dropdown hides
              onMouseDown={(e) => { e.preventDefault(); handleSelect(f) }}
              onTouchEnd={(e) => { e.preventDefault(); handleSelect(f) }}
            >
              <span className="suggestions__name">{f.properties.name}</span>
              <span className="suggestions__sub">{sublabel(f.properties)}</span>
            </li>
          ))}
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
  mode,
  setMode,
  loading,
}) {
  return (
    <header className={`search-panel${loading ? ' search-panel--loading' : ''}`}>
      <div className="search-panel__inputs">
        <SearchField
          value={origin}
          onChange={setOrigin}
          placeholder="From…"
          pinClass="search-field__pin--origin"
          label="Origin"
        />
        <SearchField
          value={destination}
          onChange={setDestination}
          placeholder="To…"
          pinClass="search-field__pin--dest"
          label="Destination"
        />
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
      </div>
    </header>
  )
}
