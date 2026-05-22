import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getTileStyle } from '../services/tiles.js'
import './Map.css'

export const MARKER_ICONS = [
  { id: 'dot',    label: 'Dot',          emoji: null   },
  { id: 'car',    label: 'Car',          emoji: '🚗'   },
  { id: 'bike-m', label: 'Cyclist (man)',   emoji: '🚴‍♂️' },
  { id: 'bike-f', label: 'Cyclist (woman)', emoji: '🚴‍♀️' },
  { id: 'walk-m', label: 'Walker (man)',    emoji: '🚶‍♂️' },
  { id: 'walk-f', label: 'Walker (woman)',  emoji: '🚶‍♀️' },
  { id: 'star',   label: 'Star',         emoji: '⭐'   },
  { id: 'paw',    label: 'Paw',          emoji: '🐾'   },
]

const SF_CENTER = [-122.4194, 37.7749]
const SF_ZOOM = 13

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] }
const EMPTY_POINT = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }

function gradeColor(pct) {
  const abs = Math.abs(pct)
  if (abs >= 12) return '#dc2626'
  if (abs >= 8)  return '#ea580c'
  if (abs >= 4)  return '#ca8a04'
  return '#2d6a4f'
}

function safeCoord([lon, lat, elev]) {
  const safeLon = isFinite(lon) ? lon : 0
  const safeLat = isFinite(lat) ? lat : 0
  if (!isFinite(lon) || !isFinite(lat)) {
    console.warn('[Map] coordinate has non-finite lon/lat — substituting 0,0', { lon, lat })
  }
  return elev != null && isFinite(elev) ? [safeLon, safeLat, elev] : [safeLon, safeLat]
}

function buildSegmentCollection(routePayload) {
  if (!routePayload) return EMPTY_COLLECTION
  const { feature, grades } = routePayload
  const coords = feature.geometry.coordinates
  const features = []
  for (let i = 0; i < coords.length - 1; i++) {
    const grade = grades[i]
    const safeGrade = grade != null && isFinite(grade) ? grade : 0
    if (grade !== safeGrade) {
      console.warn(`[Map] grade[${i}] is ${grade} — substituting 0`)
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [safeCoord(coords[i]), safeCoord(coords[i + 1])] },
      properties: { color: gradeColor(safeGrade) },
    })
  }
  return { type: 'FeatureCollection', features }
}

export default function Map({ route, hoverCoord, fitBoundsKey, userLocation, followUser, pickTarget, onMapPick, markerIcon, onMarkerIconChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const originMarkerRef = useRef(null)
  const destMarkerRef = useRef(null)
  const userHtmlMarkerRef = useRef(null)
  const prevFeatureRef = useRef(null)
  const userLocationRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Create map once on mount
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getTileStyle(),
      center: SF_CENTER,
      zoom: SF_ZOOM,
      attributionControl: false,
    })

    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
        compact: true,
      }),
      'bottom-right'
    )

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: EMPTY_COLLECTION })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.8 },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.95 },
      })

      map.addSource('hover-point', { type: 'geojson', data: EMPTY_POINT })
      map.addLayer({
        id: 'hover-point',
        type: 'circle',
        source: 'hover-point',
        paint: {
          'circle-radius': 7,
          'circle-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#2563eb',
        },
        layout: { visibility: 'none' },
      })

      map.addSource('user-location', { type: 'geojson', data: EMPTY_POINT })
      map.addLayer({
        id: 'user-location-accuracy',
        type: 'circle',
        source: 'user-location',
        paint: {
          // coalesce guards against null when source holds the empty placeholder feature
          'circle-radius': ['coalesce', ['get', 'accuracyRadius'], 0],
          'circle-color': '#2563eb',
          'circle-opacity': 0.12,
          'circle-stroke-width': 0,
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'user-location-dot',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 8,
          'circle-color': '#2563eb',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'user-location-heading',
        type: 'symbol',
        source: 'user-location',
        layout: {
          'icon-image': 'user-heading-arrow',
          'icon-size': 1,
          // coalesce guards against null when source holds the empty placeholder feature
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          visibility: 'none',
        },
      })

      // Small triangle for the heading indicator (14px tall, 10px wide at base)
      const size = 32
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#2563eb'
      ctx.beginPath()
      ctx.moveTo(size / 2, 0)
      ctx.lineTo(size / 2 - 5, size / 2 + 2)
      ctx.lineTo(size / 2 + 5, size / 2 + 2)
      ctx.closePath()
      ctx.fill()
      map.addImage('user-heading-arrow', ctx.getImageData(0, 0, size, size))

      // HTML marker element for custom emoji icons
      const markerEl = document.createElement('div')
      markerEl.className = 'user-marker'
      userHtmlMarkerRef.current = new maplibregl.Marker({ element: markerEl, anchor: 'center' })

      setMapReady(true)
    })

    mapRef.current = map

    return () => {
      originMarkerRef.current?.remove()
      destMarkerRef.current?.remove()
      userHtmlMarkerRef.current?.remove()
      map.remove()
    }
  }, [])

  // Update route geometry, markers, and flash when the active route changes.
  // mapRoute is memoized in App so this effect only fires when the route genuinely changes,
  // not on every render (e.g. not when hoverCoord updates).
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current

    originMarkerRef.current?.remove()
    destMarkerRef.current?.remove()
    originMarkerRef.current = null
    destMarkerRef.current = null

    map.getSource('route').setData(buildSegmentCollection(route))

    let flashTimer
    if (route) {
      // Brief flash when switching between genuinely different route alternatives
      if (prevFeatureRef.current && prevFeatureRef.current !== route.feature) {
        map.setPaintProperty('route-line', 'line-opacity', 0.1)
        map.setPaintProperty('route-casing', 'line-opacity', 0.1)
        flashTimer = setTimeout(() => {
          if (mapRef.current) {
            map.setPaintProperty('route-line', 'line-opacity', 0.95)
            map.setPaintProperty('route-casing', 'line-opacity', 0.8)
          }
        }, 160)
      }
      prevFeatureRef.current = route.feature

      const coords = route.feature.geometry.coordinates
      const [startLon, startLat] = coords[0]
      const [endLon, endLat] = coords[coords.length - 1]

      originMarkerRef.current = new maplibregl.Marker({ color: '#2d6a4f' })
        .setLngLat([startLon, startLat])
        .addTo(map)

      destMarkerRef.current = new maplibregl.Marker({ color: '#c0392b' })
        .setLngLat([endLon, endLat])
        .addTo(map)
    } else {
      prevFeatureRef.current = null
    }

    return () => clearTimeout(flashTimer)
  }, [mapReady, route])

  // Fit bounds only when a new route is fetched (fitBoundsKey increments), not on toggle.
  // Accounts for the sidebar covering the bottom (mobile) or right side (desktop).
  useEffect(() => {
    if (!mapReady || !route) return
    const map = mapRef.current
    const coords = route.feature.geometry.coordinates
    const coords2d = coords.map(([lng, lat]) => [lng, lat])
    const bounds = coords2d.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords2d[0], coords2d[0])
    )
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    const padding = isDesktop
      ? { top: 60, right: 380, bottom: 60, left: 60 }
      : { top: 60, right: 60, bottom: 280, left: 60 }
    map.fitBounds(bounds, { padding, maxZoom: 16, duration: 600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, fitBoundsKey])

  // Update user location dot and heading indicator
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    const src = map.getSource('user-location')
    if (!src) return

    userLocationRef.current = userLocation ?? null

    const htmlMarker = userHtmlMarkerRef.current
    const isDot = markerIcon === 'dot'

    if (userLocation) {
      const { lat, lon, heading, accuracy } = userLocation
      const metersPerPixel =
        (156543.03392 * Math.cos((lat * Math.PI) / 180)) /
        Math.pow(2, map.getZoom())
      const accuracyRadius = Math.max(4, accuracy / metersPerPixel)

      src.setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { heading: heading ?? 0, accuracyRadius },
      })
      const hasHeading = heading !== null && heading !== undefined
      map.setLayoutProperty('user-location-accuracy', 'visibility', 'visible')
      map.setLayoutProperty('user-location-dot', 'visibility', isDot ? 'visible' : 'none')
      map.setLayoutProperty('user-location-heading', 'visibility', hasHeading ? 'visible' : 'none')

      // Custom emoji marker
      if (htmlMarker) {
        const iconDef = MARKER_ICONS.find(i => i.id === markerIcon)
        const el = htmlMarker.getElement()
        el.textContent = iconDef?.emoji ?? ''
        el.setAttribute('data-icon', markerIcon)
        if (!isDot && iconDef?.emoji) {
          htmlMarker.setLngLat([lon, lat]).addTo(map)
        } else {
          htmlMarker.remove()
        }
      }

      if (followUser) {
        map.easeTo({ center: [lon, lat], zoom: 17, duration: 500 })
      }
    } else {
      htmlMarker?.remove()
      map.setLayoutProperty('user-location-accuracy', 'visibility', 'none')
      map.setLayoutProperty('user-location-dot', 'visibility', 'none')
      map.setLayoutProperty('user-location-heading', 'visibility', 'none')
    }
  }, [mapReady, userLocation, followUser, markerIcon])

  // Map-tap-to-pick: crosshair cursor + one-shot click handler
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!pickTarget) {
      map.getCanvas().style.cursor = ''
      return
    }
    map.getCanvas().style.cursor = 'crosshair'
    function handleClick(e) {
      const { lng, lat } = e.lngLat
      if (onMapPick) onMapPick([lng, lat])
    }
    map.once('click', handleClick)
    return () => {
      map.off('click', handleClick)
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = ''
    }
  }, [mapReady, pickTarget, onMapPick])

  // Show/hide hover point on elevation chart interaction
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    const src = map.getSource('hover-point')
    if (!src) return

    if (hoverCoord) {
      src.setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [hoverCoord.lon, hoverCoord.lat] },
        properties: {},
      })
      map.setLayoutProperty('hover-point', 'visibility', 'visible')
    } else {
      map.setLayoutProperty('hover-point', 'visibility', 'none')
    }
  }, [mapReady, hoverCoord])

  return (
    <div ref={containerRef} className="map-container" aria-label="Map">
      <button
        className="map-locate-btn"
        onClick={() => {
          const loc = userLocationRef.current
          if (loc && mapRef.current) {
            mapRef.current.flyTo({ center: [loc.lon, loc.lat], zoom: 15, duration: 600 })
          }
        }}
        aria-label="Center map on my location"
        title="My location"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      </button>

      <button
        className="map-icon-btn"
        onClick={() => setPickerOpen((o) => !o)}
        aria-label="Choose location marker icon"
        title="Change marker"
        aria-expanded={pickerOpen}
      >
        {MARKER_ICONS.find((i) => i.id === markerIcon)?.emoji ?? (
          <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" width="14" height="14">
            <circle cx="6" cy="6" r="5" />
          </svg>
        )}
      </button>

      {pickerOpen && (
        <div className="map-icon-picker" role="dialog" aria-label="Choose marker icon">
          {MARKER_ICONS.map((icon) => (
            <button
              key={icon.id}
              className={`map-icon-picker__opt${markerIcon === icon.id ? ' map-icon-picker__opt--active' : ''}`}
              onClick={() => { onMarkerIconChange(icon.id); setPickerOpen(false) }}
              aria-label={icon.label}
              aria-pressed={markerIcon === icon.id}
              title={icon.label}
            >
              {icon.emoji ?? (
                <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" width="14" height="14">
                  <circle cx="6" cy="6" r="5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
