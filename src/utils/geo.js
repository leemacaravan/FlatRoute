const R = 6371000 // Earth radius in metres

// Haversine distance between two [lon, lat] coords, returns metres.
export function haversineMetres([lon1, lat1], [lon2, lat2]) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Minimum distance in metres from a [lon, lat] point to a polyline (array of [lon, lat]).
// Uses flat-earth approximation scaled by cos(lat) — accurate enough for navigation (< 1% error
// within a few km), avoids full haversine on every segment.
export function distanceToPolyline([pLon, pLat], coords) {
  const cosLat = Math.cos((pLat * Math.PI) / 180)
  const mPerDeg = (Math.PI / 180) * R
  // Convert to local metres so we can use simple dot-product projection
  const px = (pLon - coords[0][0]) * cosLat * mPerDeg
  const py = (pLat - coords[0][1]) * mPerDeg

  let minDist = Infinity
  for (let i = 0; i < coords.length - 1; i++) {
    const ax = (coords[i][0] - coords[0][0]) * cosLat * mPerDeg
    const ay = (coords[i][1] - coords[0][1]) * mPerDeg
    const bx = (coords[i + 1][0] - coords[0][0]) * cosLat * mPerDeg
    const by = (coords[i + 1][1] - coords[0][1]) * mPerDeg
    const dx = bx - ax
    const dy = by - ay
    const lenSq = dx * dx + dy * dy
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0
    t = Math.max(0, Math.min(1, t))
    const cx = ax + t * dx
    const cy = ay + t * dy
    const d = Math.hypot(px - cx, py - cy)
    if (d < minDist) minDist = d
  }
  return minDist
}
