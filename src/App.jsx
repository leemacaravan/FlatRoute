import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Map, { MARKER_ICONS } from './components/Map.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import Sidebar from './components/Sidebar.jsx'
import HandoffMenu from './components/HandoffMenu.jsx'
import NavigationHUD from './components/NavigationHUD.jsx'
import SavedPanel from './components/SavedPanel.jsx'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { fetchRoutes } from './services/routing.js'
import { reverseGeocode } from './services/geocoding.js'
import { watchLocation } from './services/location.js'
import { speak, cancelSpeech } from './services/voice.js'
import { haversineMetres, distanceToPolyline } from './utils/geo.js'
import {
  computeGrades,
  totalElevationGain,
  maxGrade,
  buildChartData,
  hasSteepWarning,
} from './utils/elevation.js'
import { extractSteps } from './utils/directions.js'
import './App.css'

const EMPTY_PLACE = { text: '', coords: null }

// Step-advance radius per mode (metres)
const ADVANCE_THRESHOLD = { driving: 40, cycling: 30, walking: 25 }

// Assumed travel speed per mode (m/s) for ETA
const SPEED_MPS = { driving: 8.3, cycling: 3.5, walking: 1.3 }

// Index of the alternative with lowest elevation gain, tie-broken by max grade.
function flattestIdx(alts) {
  if (alts.length <= 1) return 0
  let best = 0
  for (let i = 1; i < alts.length; i++) {
    const a = alts[i].stats
    const b = alts[best].stats
    if (
      a.elevationGain < b.elevationGain ||
      (a.elevationGain === b.elevationGain && a.maxGrade < b.maxGrade)
    ) {
      best = i
    }
  }
  return best
}

export default function App() {
  const [origin, setOrigin] = useState(EMPTY_PLACE)
  const [destination, setDestination] = useState(EMPTY_PLACE)
  const [waypoints, setWaypoints] = useState([])
  const [mode, setMode] = useState('driving')

  const waypointCoordsKey = waypoints.map(w => w.coords?.join(',') ?? '').join('|')

  // Each alternative: { feature, grades, stats: { distance, elevationGain, maxGrade }, chartData, steps }
  const [alternatives, setAlternatives] = useState([])
  const [routeChoice, setRouteChoice] = useState('fastest')
  const [fitBoundsKey, setFitBoundsKey] = useState(0)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [hoverCoord, setHoverCoord] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [mapPickTarget, setMapPickTarget] = useState(null)
  const [navActive, setNavActive] = useState(false)
  const [navStepIdx, setNavStepIdx] = useState(0)
  const [muted, setMuted] = useLocalStorage('muted', false)
  const [markerIcon, setMarkerIcon] = useLocalStorage('markerIcon', 'dot')
  const [savedRoutes, setSavedRoutes] = useLocalStorage('savedRoutes', [])
  const [savedPanelOpen, setSavedPanelOpen] = useState(false)
  // Refs to track what voice has already announced — avoids re-announcing on every GPS pulse
  const lastAnnouncedStepRef = useRef(-1)
  const lastAnnouncedBucketRef = useRef(null) // '200' | '50' | null
  const offRouteAnnouncedRef = useRef(false)

  useEffect(() => {
    if (!origin.coords || !destination.coords) {
      setAlternatives([])
      setHoverCoord(null)
      setRouteError(null)
      setNavActive(false)
      setNavStepIdx(0)
      return
    }

    setNavActive(false)
    setNavStepIdx(0)

    let cancelled = false
    setRouteLoading(true)
    setRouteError(null)

    const validWaypointCoords = waypoints.filter(w => w.coords).map(w => w.coords)
    fetchRoutes(origin.coords, destination.coords, mode, validWaypointCoords)
      .then((features) => {
        if (cancelled) return
        const alts = features.map((feature, fi) => {
          try {
            const coords = feature.geometry.coordinates
            const grades = computeGrades(coords)
            return {
              feature,
              grades,
              stats: {
                distance: feature.properties.summary.distance,
                duration: feature.properties.summary.duration,
                elevationGain: totalElevationGain(coords),
                maxGrade: maxGrade(grades),
              },
              chartData: buildChartData(coords, grades),
              steps: extractSteps(feature),
            }
          } catch (err) {
            console.warn(`[App] route alternative ${fi} processing error — skipping:`, err)
            return null
          }
        }).filter(Boolean)

        if (alts.length === 0) throw new Error('Route data could not be processed')

        setAlternatives(alts)
        setFitBoundsKey((k) => k + 1)
        setHoverCoord(null)
        setSidebarOpen(true)
      })
      .catch((err) => {
        if (!cancelled) setRouteError(err.message)
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [origin.coords, destination.coords, mode, waypointCoordsKey])

  useEffect(() => {
    return watchLocation(
      (loc) => {
        setUserLocation(loc)
        setLocationError(null)
      },
      (msg) => setLocationError(msg)
    )
  }, [])

  const flatIdx = useMemo(() => flattestIdx(alternatives), [alternatives])
  const activeIdx = routeChoice === 'flattest' ? flatIdx : 0
  const activeAlt = alternatives[activeIdx] ?? null

  // Stable reference — only changes when activeAlt actually changes, not on every render.
  // This prevents the map route effect from firing on unrelated state updates (e.g. hoverCoord).
  const mapRoute = useMemo(
    () => (activeAlt ? { feature: activeAlt.feature, grades: activeAlt.grades } : null),
    [activeAlt]
  )

  const steepWarning = activeAlt ? hasSteepWarning(activeAlt.grades, mode) : false

  const sameRouteNote = useMemo(() => {
    if (alternatives.length === 0) return null
    if (alternatives.length === 1) return 'No alternative route available'
    if (flatIdx === 0) return 'The flattest option here is also the fastest'
    return null
  }, [alternatives, flatIdx])

  // Compute distance to next maneuver, remaining distance, ETA, and off-route flag.
  // Recalculates on every location update so the display stays live.
  const navComputed = useMemo(() => {
    if (!navActive || !activeAlt?.steps?.length) return null
    const steps = activeAlt.steps
    const nextStep = steps[navStepIdx + 1] ?? null
    const distToNext =
      userLocation && nextStep
        ? haversineMetres([userLocation.lon, userLocation.lat], nextStep.coord)
        : null
    // Remaining = live dist to next maneuver + sum of all subsequent step distances
    const remainingDist =
      (distToNext ?? 0) +
      steps.slice(navStepIdx + 2).reduce((s, st) => s + st.distance, 0)
    const etaSec = remainingDist / (SPEED_MPS[mode] ?? 1.3)
    const routeCoords = activeAlt.feature.geometry.coordinates
    const offRoute =
      userLocation
        ? distanceToPolyline([userLocation.lon, userLocation.lat], routeCoords) > 50
        : false
    return { distToNext, remainingDist, etaSec, offRoute }
  }, [navActive, userLocation, navStepIdx, activeAlt, mode])

  // Advance to the next step when the user passes within threshold of the maneuver point.
  useEffect(() => {
    if (!navComputed || navComputed.distToNext == null) return
    const steps = activeAlt?.steps ?? []
    // Don't advance past the arrive step
    if (navStepIdx >= steps.length - 1) return
    const threshold = ADVANCE_THRESHOLD[mode] ?? 25
    if (navComputed.distToNext < threshold) {
      setNavStepIdx((i) => i + 1)
    }
  }, [navComputed, navStepIdx, activeAlt, mode])

  // Voice announcements: announce upcoming turns at 200m and 50m; announce off-route once.
  useEffect(() => {
    if (!navActive || muted || !navComputed) return
    const steps = activeAlt?.steps ?? []
    const step = steps[navStepIdx] ?? null

    // Off-route: announce once, reset when back on route
    if (navComputed.offRoute) {
      if (!offRouteAnnouncedRef.current) {
        offRouteAnnouncedRef.current = true
        speak('Off route. Return to the highlighted path.')
      }
      return
    }
    offRouteAnnouncedRef.current = false

    if (!step || navComputed.distToNext == null) return
    const nextStep = steps[navStepIdx + 1] ?? null
    if (!nextStep || nextStep.type === 10) {
      // Near arrival
      if (lastAnnouncedStepRef.current !== navStepIdx) {
        lastAnnouncedStepRef.current = navStepIdx
        lastAnnouncedBucketRef.current = null
        speak(nextStep?.instruction ?? 'You have arrived at your destination.')
      }
      return
    }

    // Reset bucket tracking when step changes
    if (lastAnnouncedStepRef.current !== navStepIdx) {
      lastAnnouncedBucketRef.current = null
      lastAnnouncedStepRef.current = navStepIdx
    }

    const dist = navComputed.distToNext
    if (dist <= 50 && lastAnnouncedBucketRef.current !== '50') {
      lastAnnouncedBucketRef.current = '50'
      speak(nextStep.instruction)
    } else if (dist <= 200 && dist > 50 && lastAnnouncedBucketRef.current !== '200') {
      lastAnnouncedBucketRef.current = '200'
      speak(`In ${Math.round(dist)} metres, ${nextStep.instruction}`)
    }
  }, [navActive, muted, navComputed, navStepIdx, activeAlt])

  const handleMapPick = useCallback(async (coords) => {
    const name = await reverseGeocode(coords[0], coords[1])
    setMapPickTarget((target) => {
      if (target === 'origin') setOrigin({ text: name, coords })
      else if (target === 'destination') setDestination({ text: name, coords })
      else if (target?.startsWith('waypoint-')) {
        const idx = parseInt(target.slice(9), 10)
        setWaypoints((prev) => prev.map((w, i) => i === idx ? { text: name, coords } : w))
      }
      return null
    })
  }, [])

  function addWaypoint() {
    setWaypoints((prev) => [...prev, EMPTY_PLACE])
  }

  function removeWaypoint(idx) {
    setWaypoints((prev) => prev.filter((_, i) => i !== idx))
  }

  function changeWaypoint(idx, place) {
    setWaypoints((prev) => prev.map((w, i) => i === idx ? place : w))
  }

  function moveWaypoint(idx, direction) {
    setWaypoints((prev) => {
      const next = [...prev]
      const target = idx + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function saveRoute() {
    if (!activeAlt) return
    const saved = {
      id: crypto.randomUUID(),
      name: `${origin.text} → ${destination.text}`,
      mode,
      origin,
      destination,
      waypoints,
      savedAt: Date.now(),
    }
    setSavedRoutes((prev) => [saved, ...prev])
  }

  function deleteSavedRoute(id) {
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id))
  }

  function loadSavedRoute(saved) {
    setOrigin(saved.origin)
    setDestination(saved.destination)
    setWaypoints(saved.waypoints ?? [])
    setMode(saved.mode ?? 'driving')
    setSavedPanelOpen(false)
  }

  function startNav() {
    lastAnnouncedStepRef.current = -1
    lastAnnouncedBucketRef.current = null
    offRouteAnnouncedRef.current = false
    setNavStepIdx(0)
    setNavActive(true)
    setSidebarOpen(false)
  }

  function endNav() {
    cancelSpeech()
    setNavActive(false)
    setNavStepIdx(0)
    setSidebarOpen(true)
    setFitBoundsKey((k) => k + 1)
  }

  return (
    <div className="app">
      <SearchPanel
        origin={origin}
        setOrigin={setOrigin}
        destination={destination}
        setDestination={setDestination}
        waypoints={waypoints}
        onAddWaypoint={addWaypoint}
        onRemoveWaypoint={removeWaypoint}
        onChangeWaypoint={changeWaypoint}
        onMoveWaypoint={moveWaypoint}
        mode={mode}
        setMode={setMode}
        loading={routeLoading}
        mapPickTarget={mapPickTarget}
        onMapPickRequest={setMapPickTarget}
        onOpenSaved={() => setSavedPanelOpen(true)}
      />
      <div className="map-area">
        <Map
          route={mapRoute}
          hoverCoord={hoverCoord}
          fitBoundsKey={fitBoundsKey}
          userLocation={userLocation}
          followUser={navActive}
          pickTarget={mapPickTarget}
          onMapPick={handleMapPick}
          markerIcon={markerIcon}
          onMarkerIconChange={setMarkerIcon}
        />

        {mapPickTarget && (
          <div className="map-pick-banner" role="alert">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            Tap map to set {mapPickTarget === 'origin' ? 'start' : mapPickTarget === 'destination' ? 'destination' : `stop ${parseInt(mapPickTarget?.slice(9) ?? '0', 10) + 1}`}
            <button className="map-pick-banner__cancel" onClick={() => setMapPickTarget(null)} aria-label="Cancel map pick">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="14" height="14">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        )}

        {navActive && activeAlt && (
          <NavigationHUD
            steps={activeAlt.steps}
            stepIdx={navStepIdx}
            navComputed={navComputed}
            muted={muted}
            onMuteToggle={() => setMuted((m) => !m)}
            onEnd={endNav}
          />
        )}

        {locationError && !navActive && (
          <div className="location-error" role="alert">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="15" height="15">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {locationError}
          </div>
        )}

        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
          stats={activeAlt?.stats ?? null}
          chartData={activeAlt?.chartData ?? null}
          steps={activeAlt?.steps ?? null}
          onChartHover={setHoverCoord}
          routeChoice={routeChoice}
          onChoiceChange={setRouteChoice}
          hasAlternative={alternatives.length > 1}
          sameRouteNote={sameRouteNote}
          steepWarning={steepWarning}
          mode={mode}
          onStartNav={startNav}
          onSaveRoute={saveRoute}
          onHandoffOpen={() => setHandoffOpen(true)}
          loading={routeLoading}
          error={routeError}
        />
      </div>

      {handoffOpen && activeAlt && (
        <HandoffMenu
          origin={origin}
          destination={destination}
          userWaypoints={waypoints.filter(w => w.coords)}
          mode={mode}
          onClose={() => setHandoffOpen(false)}
        />
      )}

      <SavedPanel
        open={savedPanelOpen}
        onClose={() => setSavedPanelOpen(false)}
        routes={savedRoutes}
        onLoad={loadSavedRoute}
        onDelete={deleteSavedRoute}
      />
    </div>
  )
}
