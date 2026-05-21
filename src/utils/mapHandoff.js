import { selectWaypoints } from './waypoints.js'

const GOOGLE_MODE = { driving: 'driving', cycling: 'bicycling', walking: 'walking' }
const APPLE_FLAG  = { driving: 'd', cycling: 'b', walking: 'w' }

// Google Maps directions URL — includes up to 5 waypoints.
// Uses the web API URL so it works on all platforms and opens the native app on mobile.
export function buildGoogleMapsUrl(coords, mode) {
  const [oLon, oLat] = coords[0]
  const [dLon, dLat] = coords[coords.length - 1]
  const travelmode = GOOGLE_MODE[mode] ?? 'driving'
  let url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${oLat},${oLon}` +
    `&destination=${dLat},${dLon}` +
    `&travelmode=${travelmode}`
  const waypoints = selectWaypoints(coords, 5)
  if (waypoints.length > 0) {
    url += `&waypoints=${waypoints.map(([lon, lat]) => `${lat},${lon}`).join('|')}`
  }
  return url
}

// Apple Maps URL — the maps:// / maps.apple.com scheme does not support intermediate
// waypoints, so we pass only origin + destination.
export function buildAppleMapsUrl(coords, mode) {
  const [oLon, oLat] = coords[0]
  const [dLon, dLat] = coords[coords.length - 1]
  const flag = APPLE_FLAG[mode] ?? 'd'
  return `https://maps.apple.com/?saddr=${oLat},${oLon}&daddr=${dLat},${dLon}&dirflg=${flag}`
}

// Waze deep-link — only supports a single destination; no origin or waypoints.
export function buildWazeUrl(coords) {
  const [dLon, dLat] = coords[coords.length - 1]
  return `https://waze.com/ul?ll=${dLat},${dLon}&navigate=yes`
}
