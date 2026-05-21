import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getTileStyle } from '../services/tiles.js'
import './Map.css'

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

function buildSegmentCollection(routePayload) {
  if (!routePayload) return EMPTY_COLLECTION
  const { feature, grades } = routePayload
  const coords = feature.geometry.coordinates
  const features = []
  for (let i = 0; i < coords.length - 1; i++) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [coords[i], coords[i + 1]] },
      properties: { color: gradeColor(grades[i] ?? 0) },
    })
  }
  return { type: 'FeatureCollection', features }
}

export default function Map({ route, hoverCoord, fitBoundsKey, userLocation, followUser }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const originMarkerRef = useRef(null)
  const destMarkerRef = useRef(null)
  const prevFeatureRef = useRef(null)
  const userLocationRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)

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
          'circle-radius': ['get', 'accuracyRadius'],
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
          'icon-rotate': ['get', 'heading'],
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

      setMapReady(true)
    })

    mapRef.current = map

    return () => {
      originMarkerRef.current?.remove()
      destMarkerRef.current?.remove()
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

    if (userLocation) {
      const { lat, lon, heading, accuracy } = userLocation
      // Convert accuracy (metres) to approximate pixel radius at this zoom level.
      // We store it as a property and use a fixed zoom-based estimate via map projection.
      const metersPerPixel =
        (156543.03392 * Math.cos((lat * Math.PI) / 180)) /
        Math.pow(2, map.getZoom())
      const accuracyRadius = Math.max(4, accuracy / metersPerPixel)

      src.setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          heading: heading ?? 0,
          accuracyRadius,
        },
      })
      const hasHeading = heading !== null && heading !== undefined
      map.setLayoutProperty('user-location-accuracy', 'visibility', 'visible')
      map.setLayoutProperty('user-location-dot', 'visibility', 'visible')
      map.setLayoutProperty('user-location-heading', 'visibility', hasHeading ? 'visible' : 'none')

      if (followUser) {
        map.easeTo({ center: [lon, lat], zoom: 17, duration: 500 })
      }
    } else {
      map.setLayoutProperty('user-location-accuracy', 'visibility', 'none')
      map.setLayoutProperty('user-location-dot', 'visibility', 'none')
      map.setLayoutProperty('user-location-heading', 'visibility', 'none')
    }
  }, [mapReady, userLocation, followUser])

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
    </div>
  )
}
