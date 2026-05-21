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
