import { useState, useEffect, useRef, useMemo } from 'react'
import Map from './components/Map.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import Sidebar from './components/Sidebar.jsx'
import HandoffMenu from './components/HandoffMenu.jsx'
import NavigationHUD from './components/NavigationHUD.jsx'
import { fetchRoutes } from './services/routing.js'
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
  const [mode, setMode] = useState('driving')

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
  const [navActive, setNavActive] = useState(false)
  const [navStepIdx, setNavStepIdx] = useState(0)
  const [muted, setMuted] = useState(false)
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

    fetchRoutes(origin.coords, destination.coords, mode)
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
  }, [origin.coords, destination.coords, mode])

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
        mode={mode}
        setMode={setMode}
        loading={routeLoading}
      />
      <div className="map-area">
        <Map
          route={mapRoute}
          hoverCoord={hoverCoord}
          fitBoundsKey={fitBoundsKey}
          userLocation={userLocation}
          followUser={navActive}
        />

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
          onHandoffOpen={() => setHandoffOpen(true)}
          loading={routeLoading}
          error={routeError}
        />
      </div>

      {handoffOpen && activeAlt && (
        <HandoffMenu
          coords={activeAlt.feature.geometry.coordinates}
          mode={mode}
          onClose={() => setHandoffOpen(false)}
        />
      )}
    </div>
  )
}
