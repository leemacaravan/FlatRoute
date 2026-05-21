// Perpendicular distance from coord to the line segment a→b, in coordinate units.
function perpDist(coord, a, b) {
  const px = coord[0], py = coord[1]
  const ax = a[0], ay = a[1]
  const dx = b[0] - ax, dy = b[1] - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
  // |cross product of (b-a) and (p-a)| / |b-a|
  return Math.abs(dx * (py - ay) - dy * (px - ax)) / len
}

// RDP-style decomposition: for each sub-segment [lo..hi], find the interior point
// with the greatest perpendicular deviation from the chord lo→hi and record it.
// Recurse on both halves, so the full tree of structurally important points is found.
function findDeviations(coords, lo, hi, results) {
  if (hi <= lo + 1) return
  const a = coords[lo], b = coords[hi]
  let maxDist = 0, maxIdx = -1
  for (let i = lo + 1; i < hi; i++) {
    const d = perpDist(coords[i], a, b)
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxIdx === -1) return
  results.push({ idx: maxIdx, dist: maxDist })
  findDeviations(coords, lo, maxIdx, results)
  findDeviations(coords, maxIdx, hi, results)
}

// Selects up to `maxCount` interior coordinates that best characterise the route's
// shape — prioritising points that deviate most from the straight origin→destination
// line (i.e. the deliberate detours around hills).
// Returns coordinates in route order. Input coords may be [lon,lat] or [lon,lat,elev].
export function selectWaypoints(coords, maxCount = 5) {
  if (coords.length < 3 || maxCount === 0) return []
  const results = []
  findDeviations(coords, 0, coords.length - 1, results)
  // Take the top-N points by deviation magnitude, then restore route order.
  results.sort((a, b) => b.dist - a.dist)
  const top = results.slice(0, maxCount)
  top.sort((a, b) => a.idx - b.idx)
  return top.map((r) => coords[r.idx])
}
