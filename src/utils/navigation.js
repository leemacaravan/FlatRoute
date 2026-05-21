const MODE_FLAGS = { driving: 'd', cycling: 'b', walking: 'w' }

// Returns a URL that opens turn-by-turn directions in the device's default maps app.
// Coordinates are [lon, lat] (GeoJSON order).
export function buildNavigationUrl(originCoords, destCoords, mode) {
  const [oLon, oLat] = originCoords
  const [dLon, dLat] = destCoords
  const flag = MODE_FLAGS[mode] ?? 'd'
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  if (isIOS) {
    return `maps://?saddr=${oLat},${oLon}&daddr=${dLat},${dLon}&dirflg=${flag}`
  }
  // Google Maps URL — opens native app on Android, browser on desktop
  return `https://maps.google.com/maps?saddr=${oLat},${oLon}&daddr=${dLat},${dLon}&dirflg=${flag}`
}
