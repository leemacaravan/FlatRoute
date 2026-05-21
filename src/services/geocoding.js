const ORS_BASE = 'https://api.openrouteservice.org'

// Bias results toward SF; the app is designed for SF first but not hard-restricted to it.
const FOCUS = { lat: 37.7749, lon: -122.4194 }

export async function geocodeAutocomplete(text) {
  const key = import.meta.env.VITE_ORS_KEY
  if (!key || text.trim().length < 2) return []

  const params = new URLSearchParams({
    api_key: key,
    text: text.trim(),
    size: 6,
    'focus.point.lat': FOCUS.lat,
    'focus.point.lon': FOCUS.lon,
    layers: 'venue,address,street,neighbourhood,locality',
  })

  try {
    const res = await fetch(`${ORS_BASE}/geocode/autocomplete?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.features ?? []
  } catch {
    return []
  }
}

// Returns the best short name for a [lon, lat] coordinate, or 'My Location' on failure.
export async function reverseGeocode(lon, lat) {
  const key = import.meta.env.VITE_ORS_KEY
  if (!key) return 'My Location'

  const params = new URLSearchParams({
    api_key: key,
    'point.lon': lon,
    'point.lat': lat,
    size: 1,
  })

  try {
    const res = await fetch(`${ORS_BASE}/geocode/reverse?${params}`)
    if (!res.ok) return 'My Location'
    const data = await res.json()
    const props = data.features?.[0]?.properties
    return props?.name ?? props?.label ?? 'My Location'
  } catch {
    return 'My Location'
  }
}
