const GOOGLE_MODE = { driving: 'driving', cycling: 'bicycling', walking: 'walking' }
const APPLE_FLAG  = { driving: 'd', cycling: 'b', walking: 'w' }

// Google Maps directions URL.
// If userWaypoints are provided (explicit stops the user added), they are passed as Google
// waypoints. Otherwise no waypoints — the external app plans its own route.
export function buildGoogleMapsUrl(origin, destination, userWaypoints, mode) {
  const [oLon, oLat] = origin.coords
  const [dLon, dLat] = destination.coords
  const travelmode = GOOGLE_MODE[mode] ?? 'driving'
  let url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${oLat},${oLon}` +
    `&destination=${dLat},${dLon}` +
    `&travelmode=${travelmode}`
  if (userWaypoints.length > 0) {
    url += `&waypoints=${userWaypoints.map(({ coords: [lon, lat] }) => `${lat},${lon}`).join('|')}`
  }
  return url
}

// Apple Maps URL — does not support intermediate waypoints.
export function buildAppleMapsUrl(origin, destination, mode) {
  const [oLon, oLat] = origin.coords
  const [dLon, dLat] = destination.coords
  const flag = APPLE_FLAG[mode] ?? 'd'
  return `https://maps.apple.com/?saddr=${oLat},${oLon}&daddr=${dLat},${dLon}&dirflg=${flag}`
}

// Waze deep-link — only supports a single destination.
export function buildWazeUrl(destination) {
  const [dLon, dLat] = destination.coords
  return `https://waze.com/ul?ll=${dLat},${dLon}&navigate=yes`
}
