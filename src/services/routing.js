const ORS_BASE = 'https://api.openrouteservice.org'

const PROFILES = {
  driving: 'driving-car',
  cycling: 'cycling-regular',
  walking: 'foot-walking',
}

// Returns all GeoJSON Features from the ORS directions response (primary + alternatives).
// Coordinates include elevation as the third element: [lon, lat, elevation_m].
// waypoints: optional array of [lon, lat] intermediate stops — disables route alternatives.
export async function fetchRoutes(originCoords, destCoords, mode, waypoints = []) {
  const key = import.meta.env.VITE_ORS_KEY
  if (!key) throw new Error('Missing VITE_ORS_KEY — add it to .env')

  const profile = PROFILES[mode] ?? 'driving-car'

  const allCoords = [
    [originCoords[0], originCoords[1]],
    ...waypoints.map(([lon, lat]) => [lon, lat]),
    [destCoords[0], destCoords[1]],
  ]

  const body = {
    coordinates: allCoords,
    elevation: true,
  }
  // ORS only supports alternative routes for exactly two coordinates
  if (allCoords.length === 2) {
    body.alternative_routes = { target_count: 3, weight_factor: 2.0, share_factor: 0.8 }
  }

  const res = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: key,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Routing failed (${res.status}): ${msg}`)
  }

  const data = await res.json()
  if (!data.features?.length) throw new Error('No route found between those points')
  return data.features
}
